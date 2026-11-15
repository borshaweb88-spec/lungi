import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error('Set TURSO_DATABASE_URL (or TURSO_URL) and TURSO_AUTH_TOKEN before migrating.');
  process.exit(1);
}

const client = createClient({ url, authToken });
try {
  const schema = await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
  await client.executeMultiple(schema);
  console.log('Turso schema and starter catalog applied.');
} finally {
  client.close();
}
