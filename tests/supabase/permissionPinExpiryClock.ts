import type { Client } from "pg";

type QueryClient = Pick<Client, "query">;
type Catalog = { metadata: Record<string, unknown>; definition: string; source: string;
  language: string; returnType: string; owner: string; acl: string[] | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK = "private.write_clock()";
const CELL = "private.pin_expiry_test_clock_cell";
const fail = (code: string): never => { throw new Error(code); };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const withoutSource = (value: Record<string, unknown>) => {
  const { prosrc: _source, ...other } = value;
  return other;
};

export function assertFixtureClockDelta(baseline: { metadata: Record<string, unknown>; source: string },
  live: { metadata: Record<string, unknown>; source: string }, otherBefore: unknown, otherDuring: unknown) {
  if (equal(live.metadata, baseline.metadata) || !live.source.includes(CELL)
    || !equal(withoutSource(live.metadata), withoutSource(baseline.metadata))
    || !equal(otherBefore, otherDuring)) fail("PIN_EXPIRY_CLOCK_ALLOWLIST_REFUSED");
}

export function assertRestoredClockCatalog(baseline: unknown, live: unknown,
  otherBefore: unknown, otherAfter: unknown, cellPresent: boolean) {
  if (!equal(baseline, live) || !equal(otherBefore, otherAfter) || cellPresent)
    fail("PIN_EXPIRY_CLOCK_RESTORE_MISMATCH");
}

async function catalog(db: QueryClient): Promise<Catalog> {
  const rows = (await db.query(`select to_jsonb(p)||jsonb_build_object('oid',p.oid::int) metadata,pg_get_functiondef(p.oid) definition,
    p.prosrc source,l.lanname language,p.prorettype::regtype::text "returnType",
    p.proowner::regrole::text owner,p.proacl::text[] acl
    from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure($1)`, [CLOCK])).rows;
  if (rows.length !== 1) fail("PIN_EXPIRY_CLOCK_CATALOG_REFUSED");
  return rows[0] as Catalog;
}

function assertProduction(value: Catalog) {
  const p = value.metadata;
  if (value.language !== "sql" || value.returnType !== "timestamp with time zone")
    fail("PIN_EXPIRY_PRODUCTION_CLOCK_LANGUAGE_REFUSED");
  if (value.source.trim() !== "select clock_timestamp()" || !value.definition.includes("clock_timestamp()"))
    fail("PIN_EXPIRY_PRODUCTION_CLOCK_BODY_REFUSED");
  if (p.provolatile !== "v" || p.prosecdef !== false || p.proisstrict !== false
    || p.proleakproof !== false || p.proparallel !== "u")
    fail("PIN_EXPIRY_PRODUCTION_CLOCK_ATTRIBUTES_REFUSED");
  if (!equal(p.proconfig, ["search_path=pg_catalog"]))
    fail("PIN_EXPIRY_PRODUCTION_CLOCK_CONFIG_REFUSED");
  if (p.pronargs !== 0) fail("PIN_EXPIRY_PRODUCTION_CLOCK_ARGS_REFUSED");
  if (p.prokind !== "f") fail("PIN_EXPIRY_PRODUCTION_CLOCK_KIND_REFUSED");
  if (!Number.isInteger(p.oid)) fail("PIN_EXPIRY_PRODUCTION_CLOCK_OID_REFUSED");
}

async function otherFunctions(db: QueryClient) {
  const rows = (await db.query(`select n.nspname,p.proname,p.oid,to_jsonb(p) metadata from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public') and p.oid<>to_regprocedure($1)
    order by n.nspname,p.proname,p.oid`, [CLOCK])).rows;
  return rows;
}

async function assertNoClientAccess(db: QueryClient) {
  const rows = (await db.query(`select
    exists(select 1 from pg_proc p cross join lateral
      aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=to_regprocedure($1) and a.grantee=0 and a.privilege_type='EXECUTE') public_execute,
    has_function_privilege('anon',$1,'EXECUTE') anon_execute,
    has_function_privilege('authenticated',$1,'EXECUTE') authenticated_execute,
    has_function_privilege('service_role',$1,'EXECUTE') service_execute`, [CLOCK])).rows;
  if (rows.length !== 1 || Object.values(rows[0]).some(Boolean))
    fail("PIN_EXPIRY_CLOCK_CLIENT_ACL_REFUSED");
}

async function assertCellNoClientAccess(db: QueryClient) {
  const rows = (await db.query(`select
    exists(select 1 from pg_class c cross join lateral
      aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid=$1::regclass and a.grantee=0) public_access,
    has_table_privilege('anon',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') anon_access,
    has_table_privilege('authenticated',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') authenticated_access,
    has_table_privilege('service_role',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') service_access`, [CELL])).rows;
  if (rows.length !== 1 || Object.values(rows[0]).some(Boolean))
    fail("PIN_EXPIRY_CLOCK_CELL_ACL_REFUSED");
}

export async function assertPinExpiryProductionClock(db: QueryClient) {
  const live = await catalog(db);
  assertProduction(live);
  await assertNoClientAccess(db);
  const cell = (await db.query("select to_regclass($1) present", [CELL])).rows[0]?.present;
  if (cell) fail("PIN_EXPIRY_CLOCK_CELL_EXISTS");
  return true;
}

export function classifyExpiry(issuedAtIso: string, expiresAtIso: string, nowIso: string,
  revokedAtIso: string | null) {
  const issued = Date.parse(issuedAtIso), expiry = Date.parse(expiresAtIso), now = Date.parse(nowIso);
  if (![issued, expiry, now].every(Number.isFinite) || expiry - issued !== 300_000
    || revokedAtIso !== null && !Number.isFinite(Date.parse(revokedAtIso)))
    fail("PIN_EXPIRY_TIME_INPUT_REFUSED");
  return { expired: now >= expiry, valid: revokedAtIso === null && now < expiry,
    revoked: revokedAtIso !== null, ttlMs: expiry - issued };
}

/** A new-project-only clock. Keep it installed through all old-token probes. */
export async function installPinExpiryClock(db: QueryClient) {
  const baseline = await catalog(db);
  assertProduction(baseline);
  await assertNoClientAccess(db);
  const otherBaseline = await otherFunctions(db);
  const existing = (await db.query("select to_regclass($1) present", [CELL])).rows[0]?.present;
  if (existing) fail("PIN_EXPIRY_CLOCK_CELL_EXISTS");
  let installed = false;
  let restored = false;
  let t0Iso = "";
  try {
    await db.query("begin");
    await db.query(`create table ${CELL} (
      singleton boolean primary key check(singleton),instant timestamptz not null);
      revoke all on ${CELL} from public,anon,authenticated,service_role`);
    await assertCellNoClientAccess(db);
    const rows = (await db.query(`insert into ${CELL} values(true,date_trunc('milliseconds',clock_timestamp()))
      returning instant`)).rows;
    if (rows.length !== 1 || !(rows[0].instant instanceof Date)) fail("PIN_EXPIRY_CLOCK_START_REFUSED");
    t0Iso = rows[0].instant.toISOString();
    await db.query(`create or replace function ${CLOCK} returns timestamptz
      language sql volatile security invoker set search_path=pg_catalog
      as $$ select instant from ${CELL} where singleton $$;
      revoke all on function ${CLOCK} from public,anon,authenticated,service_role`);
    const live = await catalog(db);
    assertFixtureClockDelta(baseline, live, otherBaseline, await otherFunctions(db));
    await assertNoClientAccess(db);
    const now = (await db.query(`select ${CLOCK} now`)).rows[0]?.now;
    if (!(now instanceof Date) || now.toISOString() !== t0Iso) fail("PIN_EXPIRY_CLOCK_INSTALL_REFUSED");
    await db.query("commit");
    installed = true;
  } catch (error) {
    try { await db.query("rollback"); } catch { fail("PIN_EXPIRY_CLOCK_INSTALL_ROLLBACK_FAILED"); }
    if (error instanceof Error && /^PIN_EXPIRY_/.test(error.message)) throw error;
    fail("PIN_EXPIRY_CLOCK_INSTALL_FAILED");
  }
  return {
    t0Iso,
    async read(): Promise<string> {
      if (!installed || restored) fail("PIN_EXPIRY_CLOCK_NOT_ACTIVE");
      const rows = (await db.query(`select ${CLOCK} now`)).rows;
      if (rows.length !== 1 || !(rows[0].now instanceof Date)) fail("PIN_EXPIRY_CLOCK_READ_FAILED");
      return rows[0].now.toISOString();
    },
    async advanceToSessionExpiry(storeId: string, employeeId: string): Promise<{ issuedAtIso: string; expiresAtIso: string }> {
      if (!installed || restored || !UUID.test(storeId) || !UUID.test(employeeId))
        fail("PIN_EXPIRY_CLOCK_ADVANCE_INPUT_REFUSED");
      let begun = false;
      try {
        await db.query("begin"); begun = true;
        const sessions = (await db.query(`select issued_at,expires_at,revoked_at
          from private.employee_sessions where store_id=$1::uuid and employee_id=$2::uuid
          and purpose='required_pin_change' and revoked_at is null`, [storeId, employeeId])).rows;
        if (sessions.length !== 1 || !(sessions[0].issued_at instanceof Date)
          || !(sessions[0].expires_at instanceof Date) || sessions[0].revoked_at !== null)
          fail("PIN_EXPIRY_CLOCK_SESSION_REFUSED");
        const issuedAtIso = sessions[0].issued_at.toISOString();
        const expiresAtIso = sessions[0].expires_at.toISOString();
        if (classifyExpiry(issuedAtIso, expiresAtIso, t0Iso, null).expired)
          fail("PIN_EXPIRY_CLOCK_PREMATURE_EXPIRY");
        const changed = await db.query(`update ${CELL} set instant=$1::timestamptz where singleton
          and instant=$2::timestamptz returning instant`, [expiresAtIso, t0Iso]);
        if (changed.rows.length !== 1 || !(changed.rows[0].instant instanceof Date)
          || changed.rows[0].instant.toISOString() !== expiresAtIso)
          fail("PIN_EXPIRY_CLOCK_ADVANCE_REFUSED");
        await db.query("commit"); begun = false;
        if (await this.read() !== expiresAtIso) fail("PIN_EXPIRY_CLOCK_ADVANCE_VERIFY_FAILED");
        return { issuedAtIso, expiresAtIso };
      } catch (error) {
        if (begun) { try { await db.query("rollback"); }
          catch { fail("PIN_EXPIRY_CLOCK_ADVANCE_ROLLBACK_FAILED"); } }
        if (error instanceof Error && /^PIN_EXPIRY_/.test(error.message)) throw error;
        return fail("PIN_EXPIRY_CLOCK_ADVANCE_FAILED");
      }
    },
    async proof() {
      const live = await catalog(db);
      const other = await otherFunctions(db);
      let liveMatches = false;
      if (restored) liveMatches = equal(live, baseline) && equal(other, otherBaseline);
      else {
        try { assertFixtureClockDelta(baseline, live, otherBaseline, other); liveMatches = true; }
        catch { liveMatches = false; }
      }
      return { installed, restored, liveMatches };
    },
    async restore() {
      if (restored) return;
      if (!installed) fail("PIN_EXPIRY_CLOCK_RESTORE_REFUSED");
      const live = await catalog(db);
      try { assertFixtureClockDelta(baseline, live, otherBaseline, await otherFunctions(db)); }
      catch { fail("PIN_EXPIRY_CLOCK_RESTORE_REFUSED"); }
      let begun = false;
      try {
        await db.query("begin"); begun = true;
        await db.query(baseline.definition);
        await db.query(`drop table ${CELL}`);
        const final = await catalog(db);
        assertRestoredClockCatalog(baseline, final, otherBaseline, await otherFunctions(db),
          !!(await db.query("select to_regclass($1) present", [CELL])).rows[0]?.present);
        await db.query("commit"); begun = false;
        restored = true;
      } catch (error) {
        if (begun) { try { await db.query("rollback"); }
          catch { fail("PIN_EXPIRY_CLOCK_RESTORE_ROLLBACK_FAILED"); } }
        if (error instanceof Error && /^PIN_EXPIRY_/.test(error.message)) throw error;
        fail("PIN_EXPIRY_CLOCK_RESTORE_FAILED");
      }
    },
  };
}
