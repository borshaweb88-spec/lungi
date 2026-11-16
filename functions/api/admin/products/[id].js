import { getDB } from '../../../_shared/database.js';
import { json, error, bodyJSON, cleanText, money } from '../../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../../_shared/auth.js';
import { cleanProductImage } from '../../../_shared/product-image.js';
import { ensureProductDeleteSchema } from '../../../_shared/database.js';

export async function onRequestPut({ request, env, params }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let b; try { b = await bodyJSON(request); } catch (e) { return error(e.message); }
  const id = Number(params.id); const title = cleanText(b.title,160); const slug = cleanText(b.slug,180);
  const category = Number(b.category_id); const description = cleanText(b.description,3000);
  const price = money(b.price); const compare = b.compare_at ? money(b.compare_at) : null;
  const stock = Math.floor(Number(b.stock)); const image = cleanProductImage(b.image_url);
  if (!title || !slug || !Number.isInteger(category) || !Number.isInteger(stock) || stock < 0) return error('পণ্যের তথ্য ঠিক করে দিন।');
  if (image === null) return error('ছবির HTTPS URL দিন অথবা ৬৫০ KB-এর ছোট JPG/PNG/WebP ছবি upload করুন।');
  try {
    const r = await getDB(env).prepare('UPDATE products SET title=?,slug=?,category_id=?,description=?,price=?,compare_at=?,stock=?,image_url=?,featured=?,active=?,updated_at=? WHERE id=?')
      .bind(title,slug,category,description,price,compare,stock,image,Number(Boolean(b.featured)),Number(Boolean(b.active)),new Date().toISOString(),id).run();
    if (!r.meta.changes) return error('Product not found',404);
    return json({ ok: true });
  } catch { return error('পণ্য update হয়নি। Slug unique কিনা দেখুন।',409); }
}

export async function onRequestDelete({ request, env, params }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  const id=Number(params.id);if(!Number.isInteger(id)||id<1)return error('পণ্যের তথ্য সঠিক নয়।');
  try{
    await ensureProductDeleteSchema(env);
    const result=await getDB(env).prepare('DELETE FROM products WHERE id=?').bind(id).run();
    if(!result.meta.changes)return error('পণ্যটি পাওয়া যায়নি।',404);
    return json({ ok:true,deleted:true });
  }catch{return error('পণ্যটি delete করা যায়নি। পুরনো order history অক্ষত রেখে আবার চেষ্টা করুন।',409)}
}
