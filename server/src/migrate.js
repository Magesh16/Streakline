import fs from 'node:fs';
import path from 'node:path';
import { col } from './db.js';
import { DATA_DIR, encrypt } from './crypto.js';

const LEGACY = path.join(DATA_DIR, 'db.json');

/**
 * One-time import of the old single-user JSON file. The first account to sign up claims it.
 * Idempotent (upserts by id) and non-destructive: the file is only renamed after a successful import.
 */
export async function claimLegacyData(userId) {
  if (!fs.existsSync(LEGACY)) return null;
  try {
    await col('meta').insertOne({ _id: 'legacy-import', userId, at: new Date() });
  } catch (err) {
    if (err.code === 11000) return null; // someone already claimed it
    throw err;
  }
  try {
    const old = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
    const up = (c, docs) => Promise.all(docs.map((d) => col(c).replaceOne({ _id: d._id }, d, { upsert: true })));
    await up('habits', (old.habits || []).map(({ id, ...h }) => ({ _id: id, userId, ...h })));
    await up('sessions', (old.sessions || []).map(({ id, ...s }) => ({ _id: id, userId, ...s })));
    await up('insights', Object.entries(old.insights || {}).map(([weekStart, v]) => ({ _id: `${userId}:${weekStart}`, userId, weekStart, ...v })));
    if (old.timer) await col('timers').replaceOne({ _id: userId }, { _id: userId, ...old.timer }, { upsert: true });
    const set = {};
    if (old.settings?.model) set['settings.model'] = old.settings.model;
    if (old.settings?.geminiKey) set['settings.geminiKeyEnc'] = encrypt(old.settings.geminiKey);
    if (Object.keys(set).length) await col('users').updateOne({ _id: userId }, { $set: set });
    fs.renameSync(LEGACY, `${LEGACY}.migrated-${Date.now()}`);
    return { habits: (old.habits || []).length, sessions: (old.sessions || []).length };
  } catch (err) {
    await col('meta').deleteOne({ _id: 'legacy-import' }); // let a retry happen
    console.error('legacy import failed:', err.message);
    return null;
  }
}
