import { getDB } from '../../../_shared/database.js';
import { json, error, bodyJSON, cleanText, money } from '../../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../../_shared/auth.js';

export async function onRequestPut({ request, env, params }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let b; try { b = await bodyJSON(request); } catch (e) { return error(e.message); }
  const id = Number(params.id); const title = cleanText(b.title,160); const slug = cleanText(b.slug,180);
  const category = Number(b.category_id); const description = cleanText(b.description,3000);
  const price = money(b.price); const compare = b.compare_at ? money(b.compare_at) : null;
  const stock = Math.floor(Number(b.stock)); const image = cleanText(b.image_url,800);
  if (!title || !slug || !Number.isInteger(category) || !Number.isInteger(stock) || stock < 0) return error('পণ্যের তথ্য ঠিক করে দিন।');
  if (image && !/^https:\/\//i.test(image)) return error('Product image-এর secure HTTPS URL দিন।');
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
  await getDB(env).prepare('UPDATE products SET active=0, updated_at=? WHERE id=?').bind(new Date().toISOString(),Number(params.id)).run();
  return json({ ok: true });
}
