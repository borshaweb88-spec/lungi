import { json } from '../_shared/http.js';

export async function onRequestGet({ env }) {
  const result = await env.DB.prepare('SELECT key, value FROM store_settings').all();
  return json(Object.fromEntries((result.results ?? []).map(({ key, value }) => [key, value])));
}
