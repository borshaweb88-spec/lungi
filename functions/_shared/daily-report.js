import { getDB } from './database.js';

const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csvLine = values => values.map(quote).join(',');

export async function ensureDailyReportTables(env) {
  const db = getDB(env);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (
      email TEXT PRIMARY KEY COLLATE NOCASE, verified_at INTEGER NOT NULL, created_at INTEGER NOT NULL, last_login_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS marketing_subscribers (
      email TEXT PRIMARY KEY COLLATE NOCASE, source TEXT NOT NULL, consent_at INTEGER NOT NULL, unsubscribed_at INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daily_reports (
      report_day TEXT PRIMARY KEY, summary_json TEXT NOT NULL, csv_text TEXT NOT NULL, generated_at INTEGER NOT NULL
    )`),
  ]);
}

export async function createDailyReport(env, day) {
  await ensureDailyReportTables(env);
  const db = getDB(env);
  const start = new Date(`${day}T00:00:00+06:00`).toISOString();
  const end = new Date(Date.parse(`${day}T00:00:00+06:00`) + 24 * 60 * 60_000).toISOString();
  const startMs = Date.parse(start); const endMs = Date.parse(end);
  const [ordersResult, newCustomers, newSubscribers] = await Promise.all([
    db.prepare('SELECT id, order_no, customer_name, phone, email, status, payment_status, total, created_at FROM orders WHERE created_at>=? AND created_at<? ORDER BY created_at, id').bind(start, end).all(),
    db.prepare('SELECT email, created_at FROM customers WHERE created_at>=? AND created_at<? ORDER BY created_at').bind(startMs, endMs).all(),
    db.prepare('SELECT email, source, consent_at FROM marketing_subscribers WHERE consent_at>=? AND consent_at<? AND unsubscribed_at IS NULL ORDER BY consent_at').bind(startMs, endMs).all(),
  ]);
  const orders = ordersResult.results ?? [];
  const ids = orders.map(order => order.id);
  const itemResult = ids.length ? await db.prepare(`SELECT order_id, product_title, quantity FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).bind(...ids).all() : { results: [] };
  const items = new Map();
  for (const row of itemResult.results ?? []) {
    if (!items.has(row.order_id)) items.set(row.order_id, []);
    items.get(row.order_id).push(row);
  }
  const confirmed = orders.filter(order => !['cancelled', 'rejected'].includes(order.status) && order.payment_status !== 'rejected' && (['processing', 'shipped', 'delivered'].includes(order.status) || order.payment_status === 'verified')).length;
  const rejected = orders.filter(order => ['cancelled', 'rejected'].includes(order.status) || order.payment_status === 'rejected').length;
  const summary = {
    day,
    order_count: orders.length,
    confirmed_count: confirmed,
    rejected_count: rejected,
    pending_count: Math.max(0, orders.length - confirmed - rejected),
    new_customer_accounts: newCustomers.results?.length ?? 0,
    new_offer_subscribers: newSubscribers.results?.length ?? 0,
    order_total: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
  };
  const rows = [
    ['দৈনিক সারাংশ', 'তারিখ', day],
    ['মোট অর্ডার', '', summary.order_count],
    ['নিশ্চিত অর্ডার', '', summary.confirmed_count],
    ['বাতিল/রিজেক্ট', '', summary.rejected_count],
    ['অপেক্ষমাণ অর্ডার', '', summary.pending_count],
    ['নতুন customer account', '', summary.new_customer_accounts],
    ['অফার ইমেইলে সম্মতি', '', summary.new_offer_subscribers],
    ['মোট অর্ডার মূল্য', '', summary.order_total],
    [],
    ['অর্ডারের বিস্তারিত', 'Order ID', 'Customer', 'Email', 'Phone', 'Status', 'Payment', 'Amount', 'Products'],
    ...orders.map(order => [
      'অর্ডার', order.order_no, order.customer_name, order.email, order.phone, order.status,
      order.payment_status, order.total,
      (items.get(order.id) ?? []).map(item => `${item.product_title} × ${item.quantity}`).join(' | '),
    ]),
    [],
    ['নতুন account', 'Email', 'Created (UTC)'],
    ...(newCustomers.results ?? []).map(customer => ['Customer', customer.email, new Date(Number(customer.created_at)).toISOString()]),
    [],
    ['Offer subscriber', 'Email', 'Source', 'Consent (UTC)'],
    ...(newSubscribers.results ?? []).map(subscriber => ['Subscriber', subscriber.email, subscriber.source, new Date(Number(subscriber.consent_at)).toISOString()]),
  ];
  const csv = `\uFEFF${rows.map(csvLine).join('\r\n')}`;
  await db.prepare(`INSERT INTO daily_reports (report_day, summary_json, csv_text, generated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(report_day) DO UPDATE SET summary_json=excluded.summary_json, csv_text=excluded.csv_text, generated_at=excluded.generated_at`)
    .bind(day, JSON.stringify(summary), csv, Date.now()).run();
  return { summary, csv };
}
