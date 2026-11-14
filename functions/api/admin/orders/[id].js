import { json, error, bodyJSON, cleanText } from '../../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../../_shared/auth.js';

export async function onRequestPatch({ request, env, params }) {
  const blocked=await guardOrigin(request); if(blocked) return blocked;
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  let b; try{b=await bodyJSON(request);}catch(e){return error(e.message);}
  const status=cleanText(b.status,40); const requestedPayment=cleanText(b.payment_status,40); const note=cleanText(b.admin_note,500);
  const allowedStatus=new Set(['pending','processing','shipped','delivered','cancelled','rejected','awaiting_payment_review']);
  const allowedPayment=new Set(['due_on_delivery','review_pending','verified','rejected']);
  if(!allowedStatus.has(status)||(requestedPayment&&!allowedPayment.has(requestedPayment))) return error('Order/payment status অবৈধ।');
  const order=await env.DB.prepare('SELECT id,status,payment_status FROM orders WHERE id=?').bind(Number(params.id)).first(); if(!order) return error('Order not found',404);
  if(['cancelled','rejected','delivered'].includes(order.status)) return error('এই order-এর final status আর পরিবর্তন করা যাবে না।',409);
  if(requestedPayment && order.payment_status!=='review_pending') return error('এই order-এর payment review pending নয়।',409);
  const paymentStatus=requestedPayment||order.payment_status;
  const now=new Date().toISOString();
  const statements=[env.DB.prepare('UPDATE orders SET status=?,payment_status=?,admin_note=?,updated_at=? WHERE id=?').bind(status,paymentStatus,note,now,order.id)];
  if(['cancelled','rejected'].includes(status)&&!['cancelled','rejected','shipped','delivered'].includes(order.status)){
    const rows=await env.DB.prepare('SELECT product_id,quantity FROM order_items WHERE order_id=?').bind(order.id).all();
    for(const row of rows.results||[]) statements.push(env.DB.prepare('UPDATE products SET stock=stock+?,updated_at=? WHERE id=?').bind(row.quantity,now,row.product_id));
  }
  await env.DB.batch(statements);
  return json({ok:true});
}
