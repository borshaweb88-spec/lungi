import { getDB } from '../_shared/database.js';
import { json } from '../_shared/http.js';

export async function onRequestGet({ env }) {
  const result = await getDB(env).prepare('SELECT key, value FROM store_settings').all();
  return json(Object.fromEntries((result.results ?? []).map(({ key, value }) => [key, value])));
}
