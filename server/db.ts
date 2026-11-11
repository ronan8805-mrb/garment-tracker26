import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Pool and db are only used by DatabaseStorage, which is only instantiated
// when DATABASE_URL is set. Guard the throw so MemoryStorage path works fine.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : (null as unknown as pg.Pool);

export const db = process.env.DATABASE_URL
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

/**
 * Bring the live database up to date with columns and indexes added after it
 * was first created. Every statement is safe to run on every start.
 */
export async function ensureSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const statements = [
    `ALTER TABLE garments ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now()`,
    `ALTER TABLE garments ADD COLUMN IF NOT EXISTS missing_reset_at timestamp`,
    `ALTER TABLE garments ADD COLUMN IF NOT EXISTS written_off_at timestamp`,
    `CREATE INDEX IF NOT EXISTS idx_scan_events_garment_scanned ON scan_events (garment_id, scanned_at)`,
  ];
  for (const statement of statements) {
    await pool.query(statement);
  }
}
