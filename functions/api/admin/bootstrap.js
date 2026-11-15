import { getDB } from '../../_shared/database.js';
import { json, error, bodyJSON, cleanText, safeEquals } from '../../_shared/http.js';
import { passwordHash, issueCookie } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_BOOTSTRAP_KEY || !env.ADMIN_SESSION_SECRET) return error('Admin setup secrets are not configured', 503);
  const origin = request.headers.get('Origin'); if (origin && origin !== new URL(request.url).origin) return error('Cross-origin request blocked', 403);
  const count = await getDB(env).prepare('SELECT COUNT(*) AS n FROM admins').first();
  if (count?.n) return error('প্রথম admin account ইতিমধ্যে তৈরি হয়েছে। Admin login করুন।', 409);
  let body; try { body = await bodyJSON(request); } catch (e) { return error(e.message); }
  const email = cleanText(body.email, 160).toLowerCase(); const password = String(body.password ?? '');
  if (!safeEquals(request.headers.get('X-Bootstrap-Key') ?? '', env.ADMIN_BOOTSTRAP_KEY)) return error('Setup key ভুল।', 403);
  if (!email.includes('@') || password.length < 12) return error('Email দিন এবং অন্তত ১২ অক্ষরের admin password ব্যবহার করুন।');
  const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const hash = await passwordHash(password, salt);
  try { await getDB(env).prepare('INSERT INTO admins (email, password_salt, password_hash) VALUES (?, ?, ?)').bind(email, salt, hash).run(); }
  catch { return error('Admin account তৈরি করা যায়নি।', 500); }
  return json({ ok: true }, 201, { 'set-cookie': await issueCookie(email, env.ADMIN_SESSION_SECRET) });
}
