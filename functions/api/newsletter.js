import { getDB } from '../_shared/database.js';
import { bodyJSON, cleanText, error, json } from '../_shared/http.js';

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await bodyJSON(request); } catch { return error('ইমেইল ঠিকানাটি দিন।'); }
  const email = cleanText(data.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('একটি সঠিক ইমেইল ঠিকানা লিখুন।');
  const db = getDB(env);
  await db.prepare(`CREATE TABLE IF NOT EXISTS marketing_subscribers (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    source TEXT NOT NULL,
    consent_at INTEGER NOT NULL,
    unsubscribed_at INTEGER
  )`).run();
  await db.prepare(`INSERT INTO marketing_subscribers (email, source, consent_at, unsubscribed_at) VALUES (?, 'newsletter', ?, NULL)
    ON CONFLICT(email) DO UPDATE SET source='newsletter', consent_at=excluded.consent_at, unsubscribed_at=NULL`)
    .bind(email, Date.now()).run();
  return json({ subscribed: true });
}
