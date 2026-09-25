import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// NUMERIC -> number, BIGINT -> number (all money here is NUMERIC(12,2): far below 2^53).
types.setTypeParser(1700, (v: string) => parseFloat(v));
types.setTypeParser(20, (v: string) => parseInt(v, 10));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 20_000,
  // Managed databases (Render, Neon, RDS...) usually require SSL.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (err) => logger.error({ err }, 'unexpected idle database client error'));

export type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
export type Row = Record<string, any>;

export async function query<T extends QueryResultRow = Row>(text: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query(text, params);
  return res.rows as T[];
}
export async function one<T extends QueryResultRow = Row>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

/** Runs `fn` inside one database transaction: everything is saved, or nothing is. */
export async function withTx<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw err;
  } finally {
    client.release();
  }
}
