import { MongoClient } from 'mongodb';

let client = null;
let db = null;

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (see .env / docker-compose.yml)');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, ignoreUndefined: true });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'streakline');
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('habits').createIndex({ userId: 1, createdAt: 1 }),
    db.collection('sessions').createIndex({ userId: 1, startedAt: -1 }),
    db.collection('sessions').createIndex({ userId: 1, habitId: 1 }),
    db.collection('insights').createIndex({ userId: 1 }),
    db.collection('expenses').createIndex({ userId: 1, date: -1 }),
    db.collection('loans').createIndex({ userId: 1, date: -1 }),
    db.collection('auth_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // Mongo deletes expired logins itself
    db.collection('auth_sessions').createIndex({ userId: 1 }),
  ]);
  return db;
}

export const col = (name) => db.collection(name);
export const dbName = () => db?.databaseName;
export const close = () => client?.close();
