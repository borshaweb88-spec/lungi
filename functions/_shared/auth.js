import { getDB } from './database.js';
import { error } from './http.js';

const enc = new TextEncoder();
const cookieName = '__Host-nawablooms-admin';

function b64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, material, 256);
  return b64(new Uint8Array(bits));
}

export async function issueCookie(email, secret) {
  const data = b64(enc.encode(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  const sig = b64(await hmac(secret, data));
  return `${cookieName}=${data}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}

export function clearCookie() {
  return `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function currentAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return null;
  const cookie = request.headers.get('Cookie') ?? '';
  const raw = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return null;
  const [data, signature] = raw.split('.');
  if (!data || !signature) return null;
  const expected = b64(await hmac(env.ADMIN_SESSION_SECRET, data));
  if (!safeCompare(signature, expected)) return null;
  try {
    const decoded = atob(data.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - data.length % 4) % 4));
    const payload = JSON.parse(decoded);
    if (!payload.email || payload.exp < Date.now()) return null;
    return await getDB(env).prepare('SELECT id, email FROM admins WHERE email = ?').bind(payload.email).first();
  } catch { return null; }
}

function safeCompare(a, b) {
  const aa = enc.encode(String(a)); const bb = enc.encode(String(b));
  if (aa.length !== bb.length) return false;
  let mismatch = 0; for (let i = 0; i < aa.length; i++) mismatch |= aa[i] ^ bb[i];
  return mismatch === 0;
}

export async function requireAdmin(request, env) {
  const admin = await currentAdmin(request, env);
  return admin || error('Admin sign-in required', 401);
}

export async function guardOrigin(request) {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  if (origin && origin !== url.origin) return error('Cross-origin request blocked', 403);
  return null;
}

export { cookieName };
