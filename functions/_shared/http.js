export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

export const error = (message, status = 400) => json({ error: message }, status);

export async function bodyJSON(request) {
  try { return await request.json(); } catch { throw new Error('Request body must be valid JSON'); }
}

export function cleanText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

export function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) throw new Error('Invalid amount');
  return Math.round(amount);
}

export function safeEquals(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left[i] ^ right[i];
  return result === 0;
}
