import { json } from '../../_shared/http.js';
import { clearCookie, guardOrigin } from '../../_shared/auth.js';

export async function onRequestPost({ request }) {
  const blocked = await guardOrigin(request); if (blocked) return blocked;
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
