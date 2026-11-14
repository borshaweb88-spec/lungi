import { json } from '../../_shared/http.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM admins').first();
  return json({ needs_setup: !row?.count, bootstrap_available: Boolean(env.ADMIN_BOOTSTRAP_KEY && env.ADMIN_SESSION_SECRET) });
}
