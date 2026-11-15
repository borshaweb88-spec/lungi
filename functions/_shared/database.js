import { createClient } from '@libsql/client/web';
import { schemaSql } from './schema.js';

const clients = new Map();

function getClient(env) {
  const url = env.TURSO_DATABASE_URL || env.TURSO_URL;
  const authToken = env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('Turso database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  const key = `${url}\n${authToken}`;
  if (!clients.has(key)) clients.set(key, createClient({ url, authToken }));
  return clients.get(key);
}

function numeric(value) {
  if (typeof value === 'bigint') return Number(value);
  return value ?? 0;
}

function plainRow(row) {
  if (row == null) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return Object.fromEntries(Object.keys(row).map((key) => [key, row[key]]));
}

function toMeta(result) {
  return {
    changes: numeric(result.rowsAffected),
    last_row_id: numeric(result.lastInsertRowid),
  };
}

function statement(client, sql, args = []) {
  const bound = [...args];
  const input = { sql, args: bound };
  return {
    input,
    async all() {
      const result = await client.execute(input);
      return { results: result.rows.map(plainRow), meta: toMeta(result), success: true };
    },
    async first(column) {
      const result = await client.execute(input);
      const row = result.rows[0];
      if (!row) return null;
      const value = plainRow(row);
      return column ? value[column] ?? null : value;
    },
    async run() {
      const result = await client.execute(input);
      return { meta: toMeta(result), success: true };
    },
    bind(...values) {
      return statement(client, sql, values);
    },
  };
}

export function getDB(env) {
  const client = getClient(env);
  return {
    prepare(sql) {
      return statement(client, sql);
    },
    async batch(statements) {
      const results = await client.batch(statements.map((item) => item.input), 'write');
      return results.map((result) => ({ meta: toMeta(result), success: true }));
    },
  };
}

let proofTableReady = false;

// Payment screenshot Turso database-এ রাখার জন্য table (প্রথমবার নিজে থেকেই তৈরি হয়)
export async function ensureProofTable(env) {
  if (proofTableReady) return;
  await getDB(env).prepare(`CREATE TABLE IF NOT EXISTS order_proofs (
    order_no TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
  proofTableReady = true;
}

// SQL-কে আলাদা আলাদা statement-এ ভাগ করে ('...' এর ভেতরের ; ধরা হয় না)
export function splitStatements(sql) {
  const out = []; let cur = ''; let inQuote = false;
  for (const ch of sql) {
    if (ch === "'") inQuote = !inQuote;
    if (ch === ';' && !inQuote) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let schemaReady = false;

// Turso-তে table না থাকলে প্রথমবার নিজে থেকেই সব table ও শুরুর পণ্য বানায়
export async function ensureSchema(env) {
  if (schemaReady) return;
  const client = getClient(env);
  const found = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'");
  if (!found.rows.length) await client.batch(splitStatements(schemaSql), 'write');
  schemaReady = true;
}
