import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type pg from 'pg';

export class PreflightError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(`BLOCKED_DB_TESTS: ${reason}`); this.reason = reason; }
}

// No API URL, JWT or employee identity is needed for observer-only tooling.
export type ObserverEnvironment = {
  observerDsn: string; database: string; marker: string; engine: string; storeIds: string[];
};

export function migrationChecksums(root = process.cwd(), through?: 16): Record<string, string> {
  const dir = resolve(root, 'supabase/migrations');
  return Object.fromEntries(readdirSync(dir).filter(name => name.endsWith('.sql') && (through === undefined || Number(name.split('_')[0]) <= through)).sort().map(name =>
    [name, createHash('sha256').update(readFileSync(resolve(dir, name))).digest('hex')],
  ));
}

// This is the existing phase-27 observer gate, extracted without weakening it.
// Marker checksums identify the recorded source; callers also inspect live catalog.
export async function observerPreflight(db: pg.Client, env: ObserverEnvironment, through?: 16): Promise<void> {
  const identity = await db.query('select current_database() as database, pg_backend_pid() as pid');
  if (identity.rows[0].database !== env.database) throw new PreflightError('OBSERVER_DATABASE_MISMATCH');
  const marker = await db.query('select marker, engine, migration_checksums, store_ids from private.idempotency_test_environment where singleton = true');
  if (marker.rowCount !== 1 || marker.rows[0].marker !== env.marker || marker.rows[0].engine !== env.engine) throw new PreflightError('DATABASE_MARKER_MISMATCH');
  if (JSON.stringify([...marker.rows[0].store_ids].sort()) !== JSON.stringify([...env.storeIds].sort())) throw new PreflightError('FIXTURE_MARKER_MISMATCH');
  const expected = migrationChecksums(process.cwd(), through);
  const actual = marker.rows[0].migration_checksums as Record<string, string>;
  if (!actual || Object.keys(expected).length !== Object.keys(actual).length || Object.entries(expected).some(([file, hash]) => actual[file] !== hash)) throw new PreflightError('MIGRATION_CHECKSUM_MISMATCH');
  const otherStores = await db.query('select count(*)::int as count from public.stores where not(id = any($1::uuid[]))', [env.storeIds]);
  if (otherStores.rows[0].count !== 0) throw new PreflightError('DATABASE_CONTAINS_NONFIXTURE_STORES');
  const markerPrivilege = await db.query("select has_table_privilege('authenticated','private.idempotency_test_environment','SELECT') or has_function_privilege('authenticated','private.write_clock()','EXECUTE') as exposed");
  if (markerPrivilege.rows[0].exposed) throw new PreflightError('PRIVATE_TEST_SCHEMA_EXPOSED');
}
