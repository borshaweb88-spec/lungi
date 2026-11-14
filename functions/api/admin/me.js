import { json, error, bodyJSON, cleanText, safeEquals } from '../../_shared/http.js';
import { currentAdmin, passwordHash, requireAdmin, guardOrigin, issueCookie } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, env); if (!admin) return error('Admin sign-in required', 401);
  return json({ email: admin.email });
}

export async function onRequestPut({ request, env }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  const admin = await requireAdmin(request, env); if (admin instanceof Response) return admin;
  let body; try { body = await bodyJSON(request); } catch (e) { return error(e.message); }
  const currentPassword = String(body.current_password ?? '');
  const row = await env.DB.prepare('SELECT password_salt, password_hash FROM admins WHERE id = ?').bind(admin.id).first();
  const actual = await passwordHash(currentPassword, row.password_salt);
  if (!safeEquals(actual, row.password_hash)) return error('বর্তমান password মেলেনি।', 403);
  const nextEmail = cleanText(body.email, 160).toLowerCase(); const nextPassword = String(body.password ?? '');
  if (!nextEmail.includes('@')) return error('সঠিক admin email দিন।');
  if (nextPassword && nextPassword.length < 12) return error('নতুন password অন্তত ১২ অক্ষরের হতে হবে।');
  try {
    if (nextPassword) {
      const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
      const hash = await passwordHash(nextPassword, salt);
      await env.DB.prepare('UPDATE admins SET email=?, password_salt=?, password_hash=? WHERE id=?').bind(nextEmail, salt, hash, admin.id).run();
    } else {
      await env.DB.prepare('UPDATE admins SET email=? WHERE id=?').bind(nextEmail, admin.id).run();
    }
  } catch { return error('Email update হয়নি; emailটি আগে থেকেই ব্যবহৃত হতে পারে।', 409); }
  return json({ email: nextEmail }, 200, { 'set-cookie': await issueCookie(nextEmail, env.ADMIN_SESSION_SECRET) });
}
