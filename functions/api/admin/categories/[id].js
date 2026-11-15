import { getDB } from '../../../_shared/database.js';
import { json, error, bodyJSON, cleanText } from '../../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../../_shared/auth.js';

export async function onRequestPut({ request, env, params }) {
  const blocked=await guardOrigin(request); if(blocked) return blocked;
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  let b; try{b=await bodyJSON(request);}catch(e){return error(e.message);}
  const id=Number(params.id); const name=cleanText(b.name,80); const slug=cleanText(b.slug,100); const description=cleanText(b.description,500);
  if(!name||!slug) return error('Category name ও slug দিন।');
  try{await getDB(env).prepare('UPDATE categories SET name=?,slug=?,description=?,active=?,sort_order=? WHERE id=?').bind(name,slug,description,Number(Boolean(b.active)),Number(b.sort_order)||0,id).run(); return json({ok:true});}
  catch{return error('Category update হয়নি। Slugটি unique কিনা দেখুন।',409);}
}
