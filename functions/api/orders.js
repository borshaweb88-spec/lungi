import { getDB } from '../_shared/database.js';
import { json, error, cleanText, money } from '../_shared/http.js';

const methods = new Set(['cod', 'bkash', 'nagad', 'rocket', 'card']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return error('Order form is invalid'); }
  let data;
  try { data = JSON.parse(form.get('order') ?? '{}'); } catch { return error('Order information is invalid'); }
  const name = cleanText(data.name, 100); const phone = cleanText(data.phone, 30);
  const email = cleanText(data.email, 160); const address = cleanText(data.address, 500); const area = cleanText(data.area, 120);
  const method = cleanText(data.payment_method, 20).toLowerCase();
  const txn = cleanText(data.transaction_code, 100);
  if (name.length < 2 || phone.length < 7 || address.length < 8) return error('নাম, সঠিক ফোন নম্বর এবং পূর্ণ ঠিকানা দিন।');
  if (!methods.has(method)) return error('Payment method is not supported');
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 30) return error('কার্টে পণ্য যোগ করুন।');
  const proof = form.get('proof');
  if (method !== 'cod' && (!(proof instanceof File) || proof.size < 1 || proof.size > 5 * 1024 * 1024 || !imageTypes.has(proof.type))) {
    return error('COD ছাড়া পেমেন্টে সর্বোচ্চ ৫ MB-এর JPG, PNG বা WebP স্ক্রিনশট দিন।');
  }
  if (method !== 'cod' && !txn) return error('পেমেন্টের transaction/reference code লিখুন।');
  if (method !== 'cod' && !env.PROOFS) return error('Payment proof storage is not configured yet.');

  const ids = [...new Set(data.items.map(row => Number(row.id)).filter(id => Number.isInteger(id) && id > 0))];
  if (!ids.length) return error('Cart item is invalid');
  const rows = await getDB(env).prepare(`SELECT id, title, price, stock FROM products WHERE active = 1 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const catalog = new Map((rows.results ?? []).map(row => [row.id, row]));
  const itemMap = new Map();
  for (const row of data.items) {
    const product = catalog.get(Number(row.id)); const qty = Number(row.quantity);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99 || qty > product.stock) return error('একটি পণ্য আর মজুতে নেই বা পরিমাণ মজুতের বেশি। Cart আপডেট করে আবার চেষ্টা করুন।', 409);
    const existing=itemMap.get(product.id);
    itemMap.set(product.id,{...product,quantity:(existing?.quantity||0)+qty,lineTotal:product.price*((existing?.quantity||0)+qty)});
  }
  const items=[...itemMap.values()];
  if(items.some(row=>row.quantity>row.stock)) return error('একটি পণ্য আর মজুতে নেই বা পরিমাণ মজুতের বেশি। Cart আপডেট করে আবার চেষ্টা করুন।',409);
  const subtotal = items.reduce((sum, row) => sum + row.lineTotal, 0);
  const setting = await getDB(env).prepare("SELECT value FROM store_settings WHERE key='shipping_fee'").first();
  const shipping = money(setting?.value || 0);
  const total = subtotal + shipping;
  let proofKey = '';
  const orderNo = `NL${new Date().toISOString().slice(2,10).replaceAll('-', '')}${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  if (method !== 'cod') {
    const ext = proof.type === 'image/png' ? 'png' : proof.type === 'image/webp' ? 'webp' : 'jpg';
    proofKey = `proofs/${orderNo}.${ext}`;
    await env.PROOFS.put(proofKey, proof.stream(), { httpMetadata: { contentType: proof.type } });
  }
  const status = method === 'cod' ? 'pending' : 'awaiting_payment_review';
  const paymentStatus = method === 'cod' ? 'due_on_delivery' : 'review_pending';
  const now = new Date().toISOString();
  const reservation=await getDB(env).batch(items.map(row=>getDB(env).prepare('UPDATE products SET stock=stock-?, updated_at=? WHERE id=? AND active=1 AND stock>=?').bind(row.quantity,now,row.id,row.quantity)));
  if(reservation.some(result=>result.meta.changes!==1)){
    const release=items.map((row,i)=>reservation[i]?.meta.changes===1?getDB(env).prepare('UPDATE products SET stock=stock+?, updated_at=? WHERE id=?').bind(row.quantity,now,row.id):null).filter(Boolean);
    if(release.length) await getDB(env).batch(release);
    if(proofKey) await env.PROOFS.delete(proofKey);
    return error('স্টক পরিবর্তন হয়েছে। Cart refresh করে আবার চেষ্টা করুন।',409);
  }
  try {
    const statements=[getDB(env).prepare(`INSERT INTO orders
      (order_no, customer_name, phone, email, address, area, payment_method, transaction_code, proof_key, payment_status, status, subtotal, shipping_fee, total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderNo, name, phone, email, address, area, method, method === 'cod' ? '' : txn, proofKey, paymentStatus, status, subtotal, shipping, total, now, now)];
    for (const row of items) {
      statements.push(getDB(env).prepare('INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, line_total) VALUES ((SELECT id FROM orders WHERE order_no=?), ?, ?, ?, ?, ?)')
        .bind(orderNo,row.id,row.title,row.price,row.quantity,row.lineTotal));
    }
    await getDB(env).batch(statements);
    return json({ order_no: orderNo, status, payment_status: paymentStatus, subtotal, shipping_fee: shipping, total }, 201);
  } catch (e) {
    await getDB(env).batch(items.map(row=>getDB(env).prepare('UPDATE products SET stock=stock+?, updated_at=? WHERE id=?').bind(row.quantity,now,row.id)));
    if (proofKey) await env.PROOFS.delete(proofKey);
    return error('অর্ডার save হয়নি। আবার চেষ্টা করুন।', 500);
  }
}
