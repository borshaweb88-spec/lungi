import { json, error, cleanText } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const url=new URL(request.url); const day=cleanText(url.searchParams.get('day'),10);
  const target=/^\d{4}-\d{2}-\d{2}$/.test(day)?day:new Date().toISOString().slice(0,10);
  const start=new Date(`${target}T00:00:00+06:00`).toISOString(); const end=new Date(`${target}T23:59:59.999+06:00`).toISOString();
  const [summary,top,rejected,orders]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS order_count, COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected') AND payment_status<>'rejected' THEN total ELSE 0 END),0) AS order_value, COALESCE(SUM(CASE WHEN payment_status='verified' OR status='delivered' THEN total ELSE 0 END),0) AS paid_revenue, COALESCE(SUM(CASE WHEN status IN ('cancelled','rejected') OR payment_status='rejected' THEN 1 ELSE 0 END),0) AS rejected_count FROM orders WHERE created_at >= ? AND created_at <= ?").bind(start,end).first(),
    env.DB.prepare(`SELECT oi.product_id, oi.product_title, SUM(oi.quantity) AS units, SUM(oi.line_total) AS sales FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.created_at>=? AND o.created_at<=? AND o.status NOT IN ('cancelled','rejected') AND o.payment_status<>'rejected' GROUP BY oi.product_id,oi.product_title ORDER BY units DESC,sales DESC`).bind(start,end).all(),
    env.DB.prepare(`SELECT oi.product_id,oi.product_title,SUM(oi.quantity) AS units,COUNT(DISTINCT o.id) AS orders FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.created_at>=? AND o.created_at<=? AND (o.status IN ('cancelled','rejected') OR o.payment_status='rejected') GROUP BY oi.product_id,oi.product_title ORDER BY units DESC`).bind(start,end).all(),
    env.DB.prepare('SELECT * FROM orders WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC').bind(start,end).all(),
  ]);
  const orderRows=orders.results??[];const ids=orderRows.map(order=>order.id);
  const items=ids.length?await env.DB.prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`).bind(...ids).all():{results:[]};
  const byOrder=new Map();for(const item of items.results??[]){if(!byOrder.has(item.order_id))byOrder.set(item.order_id,[]);byOrder.get(item.order_id).push(item)}
  return json({day:target,summary,top_selling:top.results??[],rejected:rejected.results??[],orders:orderRows.map(order=>({...order,items:byOrder.get(order.id)??[]}))});
}
