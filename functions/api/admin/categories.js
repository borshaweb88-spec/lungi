import { getDB } from '../../_shared/database.js';
import { json, error, bodyJSON, cleanText } from '../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const {results=[]}=await getDB(env).prepare('SELECT * FROM categories ORDER BY sort_order,id').all();
  return json({categories:results});
}

export async function onRequestPost({ request, env }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let b; try { b = await bodyJSON(request); } catch(e) { return error(e.message); }
  const name=cleanText(b.name,80); const slug=cleanText(b.slug || name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),100); const description=cleanText(b.description,500);
  if(!name || !slug) return error('Category name ও slug দিন।');
  try { const r=await getDB(env).prepare('INSERT INTO categories (name,slug,description,sort_order) VALUES (?,?,?,?)').bind(name,slug,description,Number(b.sort_order)||0).run(); return json({id:r.meta.last_row_id},201); }
  catch { return error('Category save হয়নি। Slugটি unique কিনা দেখুন।',409); }
}
