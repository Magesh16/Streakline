import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { col } from './db.js';

const scrypt = promisify(crypto.scrypt);
export const COOKIE = 'sl_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const RENEW_AFTER_MS = 24 * 3600 * 1000;
const N = 16384;

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- passwords ---------- */

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, n, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
  return crypto.timingSafeEqual(key, expected);
}

// compared against when the email is unknown, so "no such user" costs the same time as "wrong password"
const DUMMY = await hashPassword('streakline-dummy-password');
export const burnPasswordTime = (password) => verifyPassword(password, DUMMY);

/* ---------- cookies & sessions ---------- */

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const isSecure = (req) => process.env.COOKIE_SECURE === 'true' || req.secure || req.headers['x-forwarded-proto'] === 'https';

function writeCookie(req, res, value, maxAgeMs) {
  const attrs = [`${COOKIE}=${encodeURIComponent(value)}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (isSecure(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export async function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await col('auth_sessions').insertOne({ _id: sha(token), userId, createdAt: now, lastSeen: now, expiresAt: new Date(now.getTime() + SESSION_MS), ua: String(req.headers['user-agent'] || '').slice(0, 160) });
  writeCookie(req, res, token, SESSION_MS);
}

export async function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await col('auth_sessions').deleteOne({ _id: sha(token) });
  writeCookie(req, res, '', 0);
}

/** Attaches req.user when the cookie maps to a live session. Never rejects. */
export async function loadUser(req, _res, next) {
  try {
    const token = readCookie(req, COOKIE);
    if (token) {
      const s = await col('auth_sessions').findOne({ _id: sha(token) });
      if (s && s.expiresAt > new Date()) {
        const user = await col('users').findOne({ _id: s.userId });
        if (user) {
          req.user = user;
          if (Date.now() - s.lastSeen.getTime() > RENEW_AFTER_MS) {
            const now = new Date();
            await col('auth_sessions').updateOne({ _id: s._id }, { $set: { lastSeen: now, expiresAt: new Date(now.getTime() + SESSION_MS) } });
          }
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new AuthError(401, 'Not signed in'));
  next();
}

export const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });

/* ---------- throttling (in-memory, per process) ---------- */

export function makeLimiter(max, windowMs) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || h.reset < now) return true;
      return h.count < max;
    },
    hit(key) {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || h.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
      else h.count++;
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    },
    clear: (key) => hits.delete(key),
  };
}
