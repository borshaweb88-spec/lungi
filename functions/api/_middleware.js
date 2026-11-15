import { ensureSchema } from '../_shared/database.js';
import { error } from '../_shared/http.js';

// প্রতিটি /api অনুরোধের আগে নিশ্চিত করে Turso-তে table আছে
export async function onRequest({ env, next }) {
  try { await ensureSchema(env); }
  catch (e) { return error('Database সংযোগ করা যায়নি: ' + String(e?.message || e).slice(0, 200), 500); }
  return next();
}
