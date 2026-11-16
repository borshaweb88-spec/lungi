import { getDB, ensureReviewTable } from '../_shared/database.js';
import { json, error, bodyJSON, cleanText } from '../_shared/http.js';
import { guardOrigin } from '../_shared/auth.js';

export async function onRequestGet({ env }) {
  await ensureReviewTable(env);
  const { results = [] } = await getDB(env).prepare(`SELECT id, customer_name, rating, review_text, is_demo, created_at
    FROM customer_reviews WHERE status='approved' ORDER BY created_at DESC LIMIT 40`).all();
  return json({ reviews: results });
}

export async function onRequestPost({ request, env }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  let body; try { body = await bodyJSON(request); } catch (e) { return error(e.message); }
  const name = cleanText(body.customer_name, 60);
  const text = cleanText(body.review_text, 700);
  const rating = Number(body.rating);
  if (name.length < 2) return error('আপনার নাম লিখুন।');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return error('১ থেকে ৫-এর মধ্যে রেটিং নির্বাচন করুন।');
  if (text.length < 10) return error('রিভিউ অন্তত ১০ অক্ষরে লিখুন।');
  await ensureReviewTable(env);
  await getDB(env).prepare(`INSERT INTO customer_reviews (customer_name, rating, review_text, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)`).bind(name, rating, text, new Date().toISOString()).run();
  return json({ ok: true }, 201);
}
