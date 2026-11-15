import { getDB } from '../../_shared/database.js';
import { json, error, bodyJSON, cleanText, money } from '../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  const {results=[]}=await getDB(env).prepare('SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC').all();
  return json({products:results});
}

export async function onRequestPost({ request, env }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let b; try { b = await bodyJSON(request); } catch (e) { return error(e.message); }
  const title = cleanText(b.title, 160); const category = Number(b.category_id); const slug = cleanText(b.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 180);
  const description = cleanText(b.description, 3000); const price = money(b.price); const compareAt = b.compare_at ? money(b.compare_at) : null;
  const stock = Math.floor(Number(b.stock)); const image = cleanText(b.image_url, 800);
  if (!title || !slug || !Number.isInteger(category) || !Number.isInteger(stock) || stock < 0) return error('পণ্যের তথ্য ঠিক করে দিন।');
  if (image && !/^https:\/\//i.test(image)) return error('Product image-এর secure HTTPS URL দিন।');
  try {
    const result = await getDB(env).prepare('INSERT INTO products (slug,title,category_id,description,price,compare_at,stock,image_url,featured,active) VALUES (?,?,?,?,?,?,?,?,?,1)')
      .bind(slug,title,category,description,price,compareAt,stock,image,Number(Boolean(b.featured))).run();
    return json({ id: result.meta.last_row_id }, 201);
  } catch { return error('পণ্য save হয়নি। Slug unique কিনা এবং category আছে কিনা দেখুন।', 409); }
}
