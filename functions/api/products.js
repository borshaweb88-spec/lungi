import { getDB } from '../_shared/database.js';
import { json, cleanText } from '../_shared/http.js';

const select = `SELECT p.id, p.slug, p.title, p.category_id, c.slug AS category_slug, c.name AS category_name,
  p.description, p.price, p.compare_at, p.stock, p.image_url, p.featured
  FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = 1 AND c.active = 1`;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const item = await getDB(env).prepare(`${select} AND p.id = ?`).bind(Number(id)).first();
    if (!item) return json({ error: 'Product not found' }, 404);
    const related = await getDB(env).prepare(`${select} AND p.category_id = ? AND p.id <> ? ORDER BY p.featured DESC, p.id DESC LIMIT 4`).bind(item.category_id, item.id).all();
    return json({ product: item, related: related.results ?? [] });
  }
  const category = cleanText(url.searchParams.get('category'), 40);
  const search = cleanText(url.searchParams.get('q'), 100);
  const sort = url.searchParams.get('sort') === 'price_asc' ? 'p.price ASC' : url.searchParams.get('sort') === 'price_desc' ? 'p.price DESC' : 'p.featured DESC, p.id DESC';
  let sql = select; const bindings = [];
  if (category && category !== 'all') { sql += ' AND c.slug = ?'; bindings.push(category); }
  if (search) { sql += ' AND (p.title LIKE ? OR p.description LIKE ?)'; bindings.push(`%${search}%`, `%${search}%`); }
  sql += ` ORDER BY ${sort} LIMIT 100`;
  const [products, categories] = await Promise.all([
    getDB(env).prepare(sql).bind(...bindings).all(),
    getDB(env).prepare('SELECT id, slug, name, description FROM categories WHERE active = 1 ORDER BY sort_order, id').all(),
  ]);
  return json({ products: products.results ?? [], categories: categories.results ?? [] });
}
