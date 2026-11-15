import { bodyJSON, error, json, safeEquals } from '../../_shared/http.js';
import { createDailyReport } from '../../_shared/daily-report.js';

export async function onRequestPost({ request, env }) {
  const expected = env.DAILY_REPORT_CRON_SECRET;
  const provided = request.headers.get('X-Daily-Report-Token') || '';
  if (!expected || !safeEquals(provided, expected)) return error('Scheduled report authorization failed.', 401);
  let data;
  try { data = await bodyJSON(request); } catch { return error('Report date is required.'); }
  const day = String(data.day || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return error('Report date is invalid.');
  const result = await createDailyReport(env, day);
  return json({ saved: true, summary: result.summary });
}
