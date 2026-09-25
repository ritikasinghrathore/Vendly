import fs from 'node:fs';
import path from 'node:path';
import { pool } from './pool';
import { logger } from '../utils/logger';

/** Applies every migrations/*.sql file once, in name order. Safe to run on every start. */
export async function migrate(): Promise<string[]> {
  const dir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('select pg_advisory_lock(727274)'); // only one migrator at a time
    await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.info(`migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    try { await client.query('select pg_advisory_unlock(727274)'); } catch { /* ignore */ }
    client.release();
  }
  return applied;
}

if (require.main === module) {
  migrate()
    .then((a) => { logger.info(a.length ? `done: ${a.length} migration(s) applied` : 'database is up to date'); return pool.end(); })
    .catch((err) => { logger.error(err.message); process.exit(1); });
}
