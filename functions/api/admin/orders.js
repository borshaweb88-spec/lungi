import { getDB } from '../../_shared/database.js';
import { json, error, cleanText } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const url=new URL(request.url); const day=cleanText(url.searchParams.get('day'),10);
  let sql='SELECT * FROM orders'; const args=[];
  if(day && /^\d{4}-\d{2}-\d{2}$/.test(day)){sql+=' WHERE date(created_at)=?';args.push(day);}
  sql+=' ORDER BY created_at DESC LIMIT 500';
  const {results=[]}=await getDB(env).prepare(sql).bind(...args).all();
  const ids=results.map(o=>o.id);
  const items=ids.length ? await getDB(env).prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all() : {results:[]};
  const grouped=new Map(); for(const item of items.results??[]){if(!grouped.has(item.order_id))grouped.set(item.order_id,[]);grouped.get(item.order_id).push(item);}
  return json({orders:results.map(o=>({...o,items:grouped.get(o.id)??[]}))});
}
