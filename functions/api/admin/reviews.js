import { getDB, ensureReviewTable } from '../../_shared/database.js';
import { json, error, bodyJSON, cleanText } from '../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  await ensureReviewTable(env);
  const { results = [] } = await getDB(env).prepare(`SELECT * FROM customer_reviews
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 300`).all();
  return json({ reviews: results });
}

export async function onRequestPatch({ request, env }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let body; try { body = await bodyJSON(request); } catch (e) { return error(e.message); }
  const id = Number(body.id), status = cleanText(body.status, 12);
  if (!Number.isInteger(id) || id < 1 || !['approved','rejected'].includes(status)) return error('রিভিউর অবস্থা সঠিক নয়।');
  await ensureReviewTable(env);
  const result = await getDB(env).prepare('UPDATE customer_reviews SET status=? WHERE id=?').bind(status,id).run();
  if (!result.meta.changes) return error('রিভিউটি পাওয়া যায়নি।',404);
  return json({ ok: true });
}
