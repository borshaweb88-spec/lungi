import { getDB } from '../../_shared/database.js';
import { bodyJSON, error, json } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';
import { createDailyReport, ensureDailyReportTables } from '../../_shared/daily-report.js';

const dhakaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  await ensureDailyReportTables(env);
  const url = new URL(request.url);
  const day = url.searchParams.get('day');
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return error('তারিখটি সঠিক নয়।');
    const saved = await getDB(env).prepare('SELECT csv_text FROM daily_reports WHERE report_day=?').bind(day).first();
    if (!saved) return error('এই তারিখের সংরক্ষিত sheet এখনো নেই।', 404);
    return new Response(saved.csv_text, { headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="nawab-daily-${day}.csv"`,
      'cache-control': 'no-store',
    } });
  }
  const { results = [] } = await getDB(env).prepare('SELECT report_day, summary_json, generated_at FROM daily_reports ORDER BY report_day DESC LIMIT 90').all();
  return json({ reports: results.map(row => ({ day: row.report_day, summary: JSON.parse(row.summary_json), generated_at: row.generated_at })) });
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;
  let body = {};
  try { body = await bodyJSON(request); } catch { /* Today's report is the default. */ }
  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : dhakaToday();
  const { summary } = await createDailyReport(env, day);
  return json({ summary, saved: true });
}
