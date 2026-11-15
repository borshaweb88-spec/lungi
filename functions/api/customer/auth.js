import { getDB } from '../../_shared/database.js';
import { bodyJSON, error, json, safeEquals } from '../../_shared/http.js';

const encoder = new TextEncoder();
const cookieName = '__Host-nawablooms-customer';
let tablesReady = false;

async function ensureTables(env) {
  if (tablesReady) return;
  const db = getDB(env);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      verified_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customer_email_codes (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      code_hash TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customer_email_rate_limits (
      ip_hash TEXT PRIMARY KEY,
      window_started INTEGER NOT NULL,
      request_count INTEGER NOT NULL
    )`),
  ]);
  tablesReady = true;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return [...result].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(value) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function readCookie(request) {
  const entry = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  return entry?.slice(cookieName.length + 1) || '';
}

async function customerFromRequest(request, env) {
  const secret = env.CUSTOMER_SESSION_SECRET || env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const [payload, signature] = readCookie(request).split('.');
  if (!payload || !signature || !safeEquals(signature, await hmac(secret, payload))) return null;
  try {
    const decoded = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
    const session = JSON.parse(decoded);
    return session.exp > Date.now() ? session.email : null;
  } catch { return null; }
}

export async function onRequestGet({ request, env }) {
  const email = await customerFromRequest(request, env);
  return email ? json({ email }) : error('Customer login required', 401);
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { 'set-cookie': `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
}

export async function onRequestPost({ request, env }) {
  const secret = env.CUSTOMER_SESSION_SECRET || env.ADMIN_SESSION_SECRET;
  if (!secret) return error('Customer session signing secret is not configured.', 503);
  let data;
  try { data = await bodyJSON(request); } catch { return error('ফর্মের তথ্য ঠিক নয়।'); }
  const email = String(data.email || '').trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:gmail\.com|googlemail\.com)$/.test(email)) {
    return error('একটি সঠিক Gmail ঠিকানা লিখুন।');
  }
  await ensureTables(env);
  const db = getDB(env);
  const now = Date.now();

  if (data.action === 'request') {
    if (!env.RESEND_API_KEY || !env.CUSTOMER_EMAIL_FROM) return error('ইমেইল কোড পাঠানোর ব্যবস্থা এখনো সেটআপ হয়নি।', 503);
    const previous = await db.prepare('SELECT sent_at FROM customer_email_codes WHERE email=?').bind(email).first();
    if (previous && now - Number(previous.sent_at) < 60_000) return error('নতুন কোড পাঠানোর আগে এক মিনিট অপেক্ষা করুন।', 429);

    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) {
      const ipHash = await hmac(secret, `customer-email:${ip}`);
      const limit = await db.prepare('SELECT window_started, request_count FROM customer_email_rate_limits WHERE ip_hash=?').bind(ipHash).first();
      if (limit && now - Number(limit.window_started) < 15 * 60_000 && Number(limit.request_count) >= 5) {
        return error('অনেকবার কোড চাওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।', 429);
      }
      const windowStarted = limit && now - Number(limit.window_started) < 15 * 60_000 ? Number(limit.window_started) : now;
      const count = limit && windowStarted === Number(limit.window_started) ? Number(limit.request_count) + 1 : 1;
      await db.prepare(`INSERT INTO customer_email_rate_limits (ip_hash, window_started, request_count) VALUES (?, ?, ?)
        ON CONFLICT(ip_hash) DO UPDATE SET window_started=excluded.window_started, request_count=excluded.request_count`)
        .bind(ipHash, windowStarted, count).run();
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const codeHash = await hmac(secret, `${email}:${code}`);
    await db.prepare(`INSERT INTO customer_email_codes (email, code_hash, sent_at, expires_at, attempts) VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, sent_at=excluded.sent_at, expires_at=excluded.expires_at, attempts=0`)
      .bind(email, codeHash, now, now + 10 * 60_000).run();
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.CUSTOMER_EMAIL_FROM,
        to: [email],
        subject: 'নওয়াব লুম · আপনার যাচাইকরণ কোড',
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#171717"><h2>আপনার ইমেইল যাচাই করুন</h2><p>নওয়াব লুমে প্রবেশ করতে নিচের কোডটি ব্যবহার করুন। কোডটি ১০ মিনিট কার্যকর থাকবে।</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0">${code}</p><p>আপনি এই অনুরোধ না করলে এই ইমেইলটি উপেক্ষা করুন।</p></div>`,
        text: `নওয়াব লুম যাচাইকরণ কোড: ${code}\nকোডটি ১০ মিনিট কার্যকর থাকবে।`,
      }),
    });
    if (!mail.ok) {
      await db.prepare('DELETE FROM customer_email_codes WHERE email=?').bind(email).run();
      return error('ইমেইল পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।', 502);
    }
    return json({ sent: true });
  }

  if (data.action === 'verify') {
    const code = String(data.code || '').trim();
    if (!/^\d{6}$/.test(code)) return error('ইমেইলের ৬ সংখ্যার কোডটি লিখুন।');
    const pending = await db.prepare('SELECT code_hash, expires_at, attempts FROM customer_email_codes WHERE email=?').bind(email).first();
    if (!pending || now > Number(pending.expires_at)) {
      await db.prepare('DELETE FROM customer_email_codes WHERE email=?').bind(email).run();
      return error('কোডের সময় শেষ হয়েছে। নতুন কোড নিন।', 410);
    }
    if (Number(pending.attempts) >= 5) {
      await db.prepare('DELETE FROM customer_email_codes WHERE email=?').bind(email).run();
      return error('অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড নিন।', 429);
    }
    await db.prepare('UPDATE customer_email_codes SET attempts=attempts+1 WHERE email=?').bind(email).run();
    if (!safeEquals(pending.code_hash, await hmac(secret, `${email}:${code}`))) return error('কোডটি সঠিক নয়। আবার দেখুন।');
    await db.prepare(`INSERT INTO customers (email, verified_at, created_at, last_login_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET verified_at=excluded.verified_at, last_login_at=excluded.last_login_at`)
      .bind(email, now, now, now).run();
    await db.prepare('DELETE FROM customer_email_codes WHERE email=?').bind(email).run();
    const payload = toBase64Url(JSON.stringify({ email, exp: now + 30 * 24 * 60 * 60_000 }));
    const signature = await hmac(secret, payload);
    return json({ email }, 200, { 'set-cookie': `${cookieName}=${payload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` });
  }
  return error('অ্যাকাউন্ট অনুরোধটি বুঝতে পারিনি।');
}
