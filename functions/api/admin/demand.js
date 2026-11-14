import { json } from '../../_shared/http.js';
import { requireAdmin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const [summary,top,rejected]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS order_count, COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected') AND payment_status<>'rejected' THEN total ELSE 0 END),0) AS order_value, COALESCE(SUM(CASE WHEN payment_status='verified' OR status='delivered' THEN total ELSE 0 END),0) AS paid_revenue, COALESCE(SUM(CASE WHEN status IN ('cancelled','rejected') OR payment_status='rejected' THEN 1 ELSE 0 END),0) AS rejected_count FROM orders").first(),
    env.DB.prepare("SELECT oi.product_id,oi.product_title,SUM(oi.quantity) AS units,COUNT(DISTINCT o.id) AS orders,SUM(oi.line_total) AS sales FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status NOT IN ('cancelled','rejected') AND o.payment_status<>'rejected' GROUP BY oi.product_id,oi.product_title ORDER BY units DESC,sales DESC LIMIT 100").all(),
    env.DB.prepare("SELECT oi.product_id,oi.product_title,SUM(oi.quantity) AS units,COUNT(DISTINCT o.id) AS orders FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('cancelled','rejected') OR o.payment_status='rejected' GROUP BY oi.product_id,oi.product_title ORDER BY units DESC LIMIT 100").all(),
  ]);
  return json({summary,top_selling:top.results??[],rejected:rejected.results??[]});
}
