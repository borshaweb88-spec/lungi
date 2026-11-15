import { createClient } from '@libsql/client/web';

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
