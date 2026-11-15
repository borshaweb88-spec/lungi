import { getDB } from '../../_shared/database.js';
import { json, error, cleanText } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';
import { ensureDailyReportTables } from '../../_shared/daily-report.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const url=new URL(request.url); const day=cleanText(url.searchParams.get('day'),10);
  const target=/^\d{4}-\d{2}-\d{2}$/.test(day)?day:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const start=new Date(`${target}T00:00:00+06:00`).toISOString(); const end=new Date(`${target}T23:59:59.999+06:00`).toISOString();
  await ensureDailyReportTables(env);
  const startMs=Date.parse(start);const endMs=startMs+24*60*60_000;
  const [summary,top,rejected,orders,newAccounts,newSubscribers]=await Promise.all([
    getDB(env).prepare("SELECT COUNT(*) AS order_count, COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected') AND payment_status<>'rejected' THEN total ELSE 0 END),0) AS order_value, COALESCE(SUM(CASE WHEN payment_status='verified' OR status='delivered' THEN total ELSE 0 END),0) AS paid_revenue, COALESCE(SUM(CASE WHEN status IN ('cancelled','rejected') OR payment_status='rejected' THEN 1 ELSE 0 END),0) AS rejected_count FROM orders WHERE created_at >= ? AND created_at <= ?").bind(start,end).first(),
    getDB(env).prepare(`SELECT oi.product_id, oi.product_title, SUM(oi.quantity) AS units, SUM(oi.line_total) AS sales FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.created_at>=? AND o.created_at<=? AND o.status NOT IN ('cancelled','rejected') AND o.payment_status<>'rejected' GROUP BY oi.product_id,oi.product_title ORDER BY units DESC,sales DESC`).bind(start,end).all(),
    getDB(env).prepare(`SELECT oi.product_id,oi.product_title,SUM(oi.quantity) AS units,COUNT(DISTINCT o.id) AS orders FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.created_at>=? AND o.created_at<=? AND (o.status IN ('cancelled','rejected') OR o.payment_status='rejected') GROUP BY oi.product_id,oi.product_title ORDER BY units DESC`).bind(start,end).all(),
    getDB(env).prepare('SELECT * FROM orders WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC').bind(start,end).all(),
    getDB(env).prepare('SELECT COUNT(*) AS count FROM customers WHERE created_at>=? AND created_at<?').bind(startMs,endMs).first(),
    getDB(env).prepare('SELECT COUNT(*) AS count FROM marketing_subscribers WHERE consent_at>=? AND consent_at<? AND unsubscribed_at IS NULL').bind(startMs,endMs).first(),
  ]);
  const orderRows=orders.results??[];const ids=orderRows.map(order=>order.id);
  const items=ids.length?await getDB(env).prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`).bind(...ids).all():{results:[]};
  const byOrder=new Map();for(const item of items.results??[]){if(!byOrder.has(item.order_id))byOrder.set(item.order_id,[]);byOrder.get(item.order_id).push(item)}
  const confirmed=orderRows.filter(order=>!['cancelled','rejected'].includes(order.status)&&order.payment_status!=='rejected'&&(['processing','shipped','delivered'].includes(order.status)||order.payment_status==='verified')).length;
  return json({day:target,summary:{...summary,confirmed_count:confirmed,pending_count:Math.max(0,orderRows.length-confirmed-Number(summary.rejected_count||0)),new_customer_accounts:Number(newAccounts?.count||0),new_offer_subscribers:Number(newSubscribers?.count||0)},top_selling:top.results??[],rejected:rejected.results??[],orders:orderRows.map(order=>({...order,items:byOrder.get(order.id)??[]}))});
}
