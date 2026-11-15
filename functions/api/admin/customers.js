import { getDB } from '../../_shared/database.js';
import { error, json } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';
import { ensureDailyReportTables } from '../../_shared/daily-report.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  await ensureDailyReportTables(env);
  const db = getDB(env);
  const [accounts, subscribers, orderContacts] = await Promise.all([
    db.prepare('SELECT email, created_at, verified_at FROM customers ORDER BY created_at DESC').all(),
    db.prepare('SELECT email, source, consent_at FROM marketing_subscribers WHERE unsubscribed_at IS NULL ORDER BY consent_at DESC').all(),
    db.prepare(`SELECT lower(email) AS email_key, email, COUNT(*) AS order_count, MAX(created_at) AS last_order_at
      FROM orders WHERE trim(email)<>'' GROUP BY lower(email)`).all(),
  ]);
  const rows = new Map();
  for (const account of accounts.results ?? []) rows.set(account.email.toLowerCase(), {
    email: account.email, is_account: true, created_at: account.created_at, verified_at: account.verified_at,
    marketing_opt_in: false, marketing_source: '', consent_at: null, order_count: 0, last_order_at: '',
  });
  for (const subscriber of subscribers.results ?? []) {
    const key = subscriber.email.toLowerCase();
    const row = rows.get(key) ?? { email: subscriber.email, is_account: false, created_at: null, verified_at: null, order_count: 0, last_order_at: '' };
    Object.assign(row, { marketing_opt_in: true, marketing_source: subscriber.source, consent_at: subscriber.consent_at });
    rows.set(key, row);
  }
  for (const contact of orderContacts.results ?? []) {
    const row = rows.get(contact.email_key) ?? { email: contact.email, is_account: false, created_at: null, verified_at: null, marketing_opt_in: false, marketing_source: '', consent_at: null };
    row.order_count = Number(contact.order_count) || 0;
    row.last_order_at = contact.last_order_at || '';
    rows.set(contact.email_key, row);
  }
  return json({ customers: [...rows.values()].sort((a, b) => Number(b.created_at || b.consent_at || 0) - Number(a.created_at || a.consent_at || 0)) });
}
