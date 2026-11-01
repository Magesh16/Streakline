import './env.js';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connect, col, dbName } from './db.js';
import { AuthError, burnPasswordTime, endSession, hashPassword, loadUser, makeLimiter, publicUser, requireAuth, startSession, verifyPassword } from './auth.js';
import { decrypt, encrypt } from './crypto.js';
import { claimLegacyData } from './migrate.js';
import { generateInsights, pingGemini, GeminiError } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4100;
const app = express();
// Behind Render/other proxies req.ip would be the proxy for everyone, which would share one rate-limit bucket.
if (process.env.TRUST_PROXY === 'true' || process.env.RENDER) app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);
const uid = () => crypto.randomUUID();
/** Express 4 doesn't catch rejected promises on its own. */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
/** Mongo doc -> API shape (`_id` becomes `id`, owner id is never exposed). */
const out = ({ _id, userId, ...rest }) => ({ id: _id, ...rest });

/* ---------- request guards ---------- */

// Cross-site pages can't set custom headers without a CORS preflight (which we never allow),
// so requiring one on every write blocks CSRF on top of SameSite=Lax cookies.
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'streakline') return next(new HttpError(403, 'Missing X-Requested-With header'));
  next();
});
app.use('/api', loadUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ---------- auth ---------- */

const loginLimiter = makeLimiter(10, 15 * 60 * 1000); // failed sign-ins per IP+email
const signupLimiter = makeLimiter(20, 60 * 60 * 1000); // sign-ups per IP
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

app.post('/api/auth/register', h(async (req, res) => {
  const { name, email, password } = req.body || {};
  const ip = req.ip;
  const users = col('users');
  if (process.env.ALLOW_SIGNUP === 'false' && (await users.estimatedDocumentCount()) > 0) throw new HttpError(403, 'Sign-ups are closed on this server');
  if (!signupLimiter.check(ip)) throw new HttpError(429, 'Too many sign-ups from this address. Try again later.');
  const cleanName = String(name ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanName || cleanName.length > 40) throw bad('Name must be 1-40 characters');
  if (!EMAIL.test(cleanEmail) || cleanEmail.length > 120) throw bad('Enter a valid email address');
  if (typeof password !== 'string' || password.length < 8) throw bad('Password must be at least 8 characters');
  if (password.length > 128) throw bad('Password is too long (max 128 characters)');
  signupLimiter.hit(ip);

  const user = { _id: uid(), name: cleanName, email: cleanEmail, passwordHash: await hashPassword(password), createdAt: new Date().toISOString(), settings: { model: 'gemini-3.8-flash' } };
  try {
    await users.insertOne(user);
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An account with that email already exists');
    throw err;
  }
  const imported = await claimLegacyData(user._id);
  await startSession(req, res, user._id);
  res.status(201).json({ user: publicUser(user), imported });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const key = `${req.ip}|${email}`;
  if (!loginLimiter.check(key)) throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');
  const user = email ? await col('users').findOne({ email }) : null;
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordTime(password), false);
  if (!ok) {
    loginLimiter.hit(key);
    throw new HttpError(401, 'Incorrect email or password');
  }
  loginLimiter.clear(key);
  await startSession(req, res, user._id);
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', h(async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
}));

app.get('/api/auth/me', (req, res) => {
  // 200 + null (not 401) so a signed-out first visit doesn't log a failed request in the browser console
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// everything below needs a signed-in user
app.use('/api', requireAuth);

/* ---------- validation ---------- */

const HABIT_TYPES = ['gym', 'skill', 'dsa', 'custom'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
const int = (v, min, max, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number between ${min} and ${max}`);
  return n;
};

/** Returns only the fields present in `input`, validated. */
function cleanHabit(input) {
  const o = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name || name.length > 40) throw bad('Name must be 1-40 characters');
    o.name = name;
  }
  if (input.type !== undefined) {
    if (!HABIT_TYPES.includes(input.type)) throw bad('Invalid habit type');
    o.type = input.type;
  }
  if (input.icon !== undefined) {
    if (!/^[a-z0-9-]{1,24}$/.test(input.icon)) throw bad('Invalid icon');
    o.icon = input.icon;
  }
  if (input.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw bad('Color must be a #rrggbb hex value');
    o.color = input.color;
  }
  if (input.daysPerWeek !== undefined) o.daysPerWeek = int(input.daysPerWeek, 1, 7, 'Days per week');
  if (input.minutesPerDay !== undefined) o.minutesPerDay = int(input.minutesPerDay, 1, 600, 'Minutes per day');
  return o;
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const o = {};
  const str = (v, max) => String(v).trim().slice(0, max);
  if (meta.split) o.split = str(meta.split, 20);
  if (meta.problem) o.problem = str(meta.problem, 120);
  if (['easy', 'medium', 'hard'].includes(meta.difficulty)) o.difficulty = meta.difficulty;
  if (meta.topic) o.topic = str(meta.topic, 40);
  if (typeof meta.solved === 'boolean') o.solved = meta.solved;
  return Object.keys(o).length ? o : undefined;
}

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Validated expense fields present in `input`. Amounts are integer minor units (paise/cents) so sums are exact. */
function cleanExpense(input) {
  const o = {};
  if (input.amountMinor !== undefined) o.amountMinor = int(input.amountMinor, 1, 100_000_000_000, 'Amount');
  if (input.category !== undefined) {
    const c = String(input.category).trim().replace(/\s+/g, ' ');
    if (!c || c.length > 30) throw bad('Category must be 1-30 characters');
    o.category = c;
  }
  if (input.note !== undefined) o.note = String(input.note).trim().slice(0, 200);
  if (input.date !== undefined) o.date = cleanDay(input.date, 'Date');
  return o;
}

/** A real calendar day as YYYY-MM-DD. Past/present by default; pass maxDays to allow some future (e.g. due dates). */
function cleanDay(value, label, maxFutureDays = 2) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!d || isoDay(d) !== value) throw bad(`${label}: enter a valid date`);
  if (d < new Date(2000, 0, 1)) throw bad(`${label} is too far in the past`);
  if (d > new Date(Date.now() + maxFutureDays * 86400000)) throw bad(maxFutureDays <= 2 ? `${label} is in the future` : `${label} is too far in the future`);
  return value;
}

/** Validated loan fields present in `input`. dueDate '' / null means "clear it". */
function cleanLoan(input) {
  const o = {};
  if (input.person !== undefined) {
    const person = String(input.person).trim().replace(/\s+/g, ' ');
    if (!person || person.length > 40) throw bad('Person must be 1-40 characters');
    o.person = person;
  }
  if (input.amountMinor !== undefined) o.amountMinor = int(input.amountMinor, 1, 100_000_000_000, 'Amount');
  if (input.date !== undefined) o.date = cleanDay(input.date, 'Date lent');
  if (input.dueDate !== undefined) o.dueDate = input.dueDate ? cleanDay(input.dueDate, 'Due date', 3650) : null;
  if (input.note !== undefined) o.note = String(input.note).trim().slice(0, 300);
  return o;
}

async function assertOwnHabit(userId, habitId) {
  if (typeof habitId !== 'string' || !(await col('habits').countDocuments({ _id: habitId, userId }, { limit: 1 }))) throw bad('Unknown habit');
}

/** Validated session fields present in `input`, merged over `base` to derive endedAt. */
async function cleanSession(userId, input, base = {}) {
  const s = { ...base };
  if (input.habitId !== undefined) {
    await assertOwnHabit(userId, input.habitId);
    s.habitId = input.habitId;
  }
  if (input.startedAt !== undefined) {
    if (!isIso(input.startedAt)) throw bad('Invalid start time');
    s.startedAt = new Date(input.startedAt).toISOString();
  }
  if (input.durationSec !== undefined) s.durationSec = int(Math.round(Number(input.durationSec)), 1, 16 * 3600, 'Duration (seconds)');
  if (input.note !== undefined) s.note = String(input.note).trim().slice(0, 500);
  if (input.meta !== undefined) s.meta = cleanMeta(input.meta);
  if (s.startedAt && s.durationSec) s.endedAt = new Date(Date.parse(s.startedAt) + s.durationSec * 1000).toISOString();
  return s;
}

/* ---------- state & settings ---------- */

const keyOf = (user) => process.env.GEMINI_API_KEY || (user.settings?.geminiKeyEnc ? decrypt(user.settings.geminiKeyEnc) : '');
const publicSettings = (user) => ({
  model: user.settings?.model || 'gemini-3.8-flash',
  currency: user.settings?.currency || 'INR',
  hasKey: Boolean(keyOf(user)),
  keySource: user.settings?.geminiKeyEnc ? 'saved' : process.env.GEMINI_API_KEY ? 'env' : null,
});

app.get('/api/state', h(async (req, res) => {
  const userId = req.user._id;
  const [habits, sessions, timer, insightDocs, expenses, loans] = await Promise.all([
    col('habits').find({ userId }).sort({ createdAt: 1 }).toArray(),
    col('sessions').find({ userId }).sort({ startedAt: 1 }).toArray(),
    col('timers').findOne({ _id: userId }),
    col('insights').find({ userId }).toArray(),
    col('expenses').find({ userId }).sort({ date: -1, createdAt: -1 }).limit(20000).toArray(),
    col('loans').find({ userId }).sort({ date: -1, createdAt: -1 }).limit(5000).toArray(),
  ]);
  res.json({
    user: publicUser(req.user),
    habits: habits.map(out),
    sessions: sessions.map(out),
    expenses: expenses.map(out),
    loans: loans.map(out),
    timer: timer ? (({ _id, ...t }) => t)(timer) : null,
    settings: publicSettings(req.user),
    insights: Object.fromEntries(insightDocs.map((d) => [d.weekStart, { generatedAt: d.generatedAt, model: d.model, data: d.data }])),
  });
}));

app.put('/api/settings', h(async (req, res) => {
  const { geminiKey, model, currency } = req.body || {};
  const set = {};
  const unset = {};
  if (geminiKey !== undefined) {
    if (typeof geminiKey !== 'string' || geminiKey.length > 200) throw bad('Invalid API key');
    if (geminiKey.trim() && !/^[\w.\-]{20,200}$/.test(geminiKey.trim())) throw bad('That doesn’t look like an API key (keys have no spaces or quotes). Copy it again from Google AI Studio.');
    if (geminiKey.trim()) set['settings.geminiKeyEnc'] = encrypt(geminiKey.trim());
    else unset['settings.geminiKeyEnc'] = '';
  }
  if (model !== undefined) {
    const m = String(model).trim();
    if (!/^[\w.\-]{1,60}$/.test(m)) throw bad('Invalid model name');
    set['settings.model'] = m;
  }
  if (currency !== undefined) {
    if (!CURRENCIES.includes(currency)) throw bad('Unsupported currency');
    set['settings.currency'] = currency;
  }
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  const user = Object.keys(update).length ? await col('users').findOneAndUpdate({ _id: req.user._id }, update, { returnDocument: 'after' }) : req.user;
  res.json(publicSettings(user));
}));

// Only on explicit request (eye icon): POST so the CSRF header is required, no-store so nothing caches the secret.
app.post('/api/settings/reveal-key', h(async (req, res) => {
  const enc = req.user.settings?.geminiKeyEnc;
  const key = enc ? decrypt(enc) : '';
  if (!key) throw new HttpError(404, 'No saved key to show');
  res.set('Cache-Control', 'no-store').json({ key });
}));

app.post('/api/settings/test', h(async (req, res) => {
  const key = keyOf(req.user);
  if (!key) throw bad('No Gemini API key set yet');
  const model = publicSettings(req.user).model;
  const reply = await pingGemini({ key, model });
  res.json({ ok: true, model, reply });
}));

/* ---------- habits ---------- */

app.post('/api/habits', h(async (req, res) => {
  const fields = cleanHabit(req.body || {});
  if (!fields.name) throw bad('Name is required');
  if ((await col('habits').countDocuments({ userId: req.user._id })) >= 50) throw bad('You can track up to 50 activities');
  const doc = { _id: uid(), userId: req.user._id, type: 'custom', color: '#f5b83d', daysPerWeek: 5, minutesPerDay: 30, ...fields, createdAt: new Date().toISOString() };
  await col('habits').insertOne(doc);
  res.status(201).json(out(doc));
}));

app.patch('/api/habits/:id', h(async (req, res) => {
  const fields = cleanHabit(req.body || {});
  const filter = { _id: req.params.id, userId: req.user._id };
  const doc = Object.keys(fields).length ? await col('habits').findOneAndUpdate(filter, { $set: fields }, { returnDocument: 'after' }) : await col('habits').findOne(filter);
  if (!doc) throw new HttpError(404, 'Habit not found');
  res.json(out(doc));
}));

app.delete('/api/habits/:id', h(async (req, res) => {
  const userId = req.user._id;
  const r = await col('habits').deleteOne({ _id: req.params.id, userId });
  if (!r.deletedCount) throw new HttpError(404, 'Habit not found');
  await Promise.all([col('sessions').deleteMany({ userId, habitId: req.params.id }), col('timers').deleteOne({ _id: userId, habitId: req.params.id })]);
  res.status(204).end();
}));

/* ---------- expenses ---------- */

app.post('/api/expenses', h(async (req, res) => {
  const fields = cleanExpense(req.body || {});
  if (!fields.amountMinor || !fields.category || !fields.date) throw bad('amountMinor, category and date are required');
  const doc = { _id: uid(), userId: req.user._id, note: '', ...fields, createdAt: new Date().toISOString() };
  await col('expenses').insertOne(doc);
  res.status(201).json(out(doc));
}));

app.patch('/api/expenses/:id', h(async (req, res) => {
  const fields = cleanExpense(req.body || {});
  const filter = { _id: req.params.id, userId: req.user._id };
  const doc = Object.keys(fields).length ? await col('expenses').findOneAndUpdate(filter, { $set: fields }, { returnDocument: 'after' }) : await col('expenses').findOne(filter);
  if (!doc) throw new HttpError(404, 'Expense not found');
  res.json(out(doc));
}));

app.delete('/api/expenses/:id', h(async (req, res) => {
  const r = await col('expenses').deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!r.deletedCount) throw new HttpError(404, 'Expense not found');
  res.status(204).end();
}));

/* ---------- loans (money lent to others) ---------- */

const repaid = { $sum: '$repayments.amountMinor' };

app.post('/api/loans', h(async (req, res) => {
  const f = cleanLoan(req.body || {});
  if (!f.person || !f.amountMinor || !f.date) throw bad('person, amountMinor and date are required');
  if (f.dueDate && f.dueDate < f.date) throw bad('Due date can\'t be before the date lent');
  if ((await col('loans').countDocuments({ userId: req.user._id })) >= 2000) throw bad('Loan limit reached');
  const { dueDate, ...rest } = f;
  const doc = { _id: uid(), userId: req.user._id, note: '', ...rest, ...(dueDate ? { dueDate } : {}), repayments: [], createdAt: new Date().toISOString() };
  await col('loans').insertOne(doc);
  res.status(201).json(out(doc));
}));

app.patch('/api/loans/:id', h(async (req, res) => {
  const f = cleanLoan(req.body || {});
  const filter = { _id: req.params.id, userId: req.user._id };
  const existing = await col('loans').findOne(filter);
  if (!existing) throw new HttpError(404, 'Loan not found');
  const { dueDate, ...set } = f;
  const date = set.date ?? existing.date;
  const due = dueDate === undefined ? existing.dueDate : dueDate;
  if (due && due < date) throw bad('Due date can\'t be before the date lent');
  const update = {};
  if (Object.keys(set).length) update.$set = { ...set };
  if (dueDate === null) update.$unset = { dueDate: '' };
  else if (dueDate) update.$set = { ...(update.$set || {}), dueDate };
  if (!Object.keys(update).length) return res.json(out(existing));
  // an amount can never drop below what has already been paid back (checked atomically)
  const guarded = set.amountMinor === undefined ? filter : { ...filter, $expr: { $gte: [set.amountMinor, repaid] } };
  const doc = await col('loans').findOneAndUpdate(guarded, update, { returnDocument: 'after' });
  if (!doc) throw bad('Amount can\'t be less than what has already been repaid');
  res.json(out(doc));
}));

app.delete('/api/loans/:id', h(async (req, res) => {
  const r = await col('loans').deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!r.deletedCount) throw new HttpError(404, 'Loan not found');
  res.status(204).end();
}));

app.post('/api/loans/:id/repayments', h(async (req, res) => {
  const b = req.body || {};
  const amountMinor = int(b.amountMinor, 1, 100_000_000_000, 'Amount');
  const date = cleanDay(b.date, 'Repayment date');
  const filter = { _id: req.params.id, userId: req.user._id };
  const loan = await col('loans').findOne(filter);
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (date < loan.date) throw bad('Repayment can\'t be dated before the loan');
  const rep = { id: uid(), amountMinor, date, note: String(b.note ?? '').trim().slice(0, 300) };
  // only succeeds while the outstanding balance still covers it, so concurrent repayments can't overpay
  const doc = await col('loans').findOneAndUpdate({ ...filter, $expr: { $gte: [{ $subtract: ['$amountMinor', repaid] }, amountMinor] } }, { $push: { repayments: rep } }, { returnDocument: 'after' });
  if (!doc) throw bad('That is more than the amount still owed');
  res.status(201).json(out(doc));
}));

app.delete('/api/loans/:id/repayments/:rid', h(async (req, res) => {
  const doc = await col('loans').findOneAndUpdate({ _id: req.params.id, userId: req.user._id, 'repayments.id': req.params.rid }, { $pull: { repayments: { id: req.params.rid } } }, { returnDocument: 'after' });
  if (!doc) throw new HttpError(404, 'Repayment not found');
  res.json(out(doc));
}));

/* ---------- sessions ---------- */

app.post('/api/sessions', h(async (req, res) => {
  const b = req.body || {};
  if (!b.habitId || !b.startedAt || !b.durationSec) throw bad('habitId, startedAt and durationSec are required');
  const fields = await cleanSession(req.user._id, b);
  const doc = { _id: uid(), userId: req.user._id, ...fields };
  await col('sessions').insertOne(doc);
  res.status(201).json(out(doc));
}));

app.patch('/api/sessions/:id', h(async (req, res) => {
  const filter = { _id: req.params.id, userId: req.user._id };
  const existing = await col('sessions').findOne(filter);
  if (!existing) throw new HttpError(404, 'Session not found');
  const { _id, userId, ...base } = existing;
  const next = await cleanSession(userId, req.body || {}, base);
  // replaceOne so that clearing optional fields (meta) really removes them
  await col('sessions').replaceOne(filter, { _id, userId, ...next });
  res.json(out({ _id, userId, ...next }));
}));

app.delete('/api/sessions/:id', h(async (req, res) => {
  const r = await col('sessions').deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!r.deletedCount) throw new HttpError(404, 'Session not found');
  res.status(204).end();
}));

/* ---------- active timer (one per user) ---------- */

app.put('/api/timer', h(async (req, res) => {
  const t = req.body;
  if (!t) throw bad('Timer is required');
  await assertOwnHabit(req.user._id, t.habitId);
  if (!isIso(t.startedAt)) throw bad('Invalid startedAt');
  if (t.runningSince !== null && !isIso(t.runningSince)) throw bad('Invalid runningSince');
  const acc = Number(t.accumulatedMs);
  if (!Number.isFinite(acc) || acc < 0) throw bad('Invalid accumulatedMs');
  const timer = { habitId: t.habitId, startedAt: t.startedAt, accumulatedMs: Math.round(acc), runningSince: t.runningSince };
  await col('timers').replaceOne({ _id: req.user._id }, { _id: req.user._id, ...timer }, { upsert: true });
  res.json(timer);
}));

app.delete('/api/timer', h(async (req, res) => {
  await col('timers').deleteOne({ _id: req.user._id });
  res.status(204).end();
}));

/* ---------- insights ---------- */

app.post('/api/insights', h(async (req, res) => {
  const { weekStart, payload, force } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart || '')) throw bad('weekStart must be YYYY-MM-DD');
  if (!payload || typeof payload !== 'object') throw bad('payload is required');
  const _id = `${req.user._id}:${weekStart}`;
  if (!force) {
    const cached = await col('insights').findOne({ _id });
    if (cached) return res.json({ generatedAt: cached.generatedAt, model: cached.model, data: cached.data });
  }
  const key = keyOf(req.user);
  if (!key) throw bad('Add a Gemini API key in Setup first');
  const model = publicSettings(req.user).model;
  const data = await generateInsights({ key, model, payload });
  const entry = { generatedAt: new Date().toISOString(), model, data };
  await col('insights').replaceOne({ _id }, { _id, userId: req.user._id, weekStart, ...entry }, { upsert: true });
  res.json(entry);
}));

/* ---------- static client (production) ---------- */

const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON body' });
  const known = err instanceof HttpError || err instanceof GeminiError || err instanceof AuthError;
  if (!known) console.error(err);
  res.status(known ? err.status : 500).json({ error: known ? err.message : 'Internal server error' });
});

try {
  await connect();
} catch (err) {
  console.error(`Cannot connect to MongoDB: ${err.message}\nStart it with: docker compose up -d mongo`);
  process.exit(1);
}
app.listen(PORT, () => console.log(`habit-tracker server on http://localhost:${PORT} (db: ${dbName()}, sign-ups ${process.env.ALLOW_SIGNUP === 'false' ? 'closed once an account exists' : 'open'})`));
