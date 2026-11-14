import { json, error, bodyJSON, cleanText } from '../../_shared/http.js';
import { passwordHash, issueCookie } from '../../_shared/auth.js';
import { safeEquals } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_SESSION_SECRET) return error('Admin session is not configured', 503);
  const origin = request.headers.get('Origin'); if (origin && origin !== new URL(request.url).origin) return error('Cross-origin request blocked', 403);
  let body; try { body = await bodyJSON(request); } catch (e) { return error(e.message); }
  const email = cleanText(body.email, 160).toLowerCase(); const password = String(body.password ?? '');
  const admin = await env.DB.prepare('SELECT email, password_salt, password_hash FROM admins WHERE email = ?').bind(email).first();
  const salt = admin?.password_salt ?? 'invalid-user-salt';
  const actual = await passwordHash(password, salt);
  if (!admin || !safeEquals(actual, admin.password_hash)) return error('Email অথবা password সঠিক নয়।', 401);
  return json({ ok: true }, 200, { 'set-cookie': await issueCookie(admin.email, env.ADMIN_SESSION_SECRET) });
}
