import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { digest, permissionFingerprint } from "../../scripts/permission-preflight-core.mjs";
import { inspectCompatibilityPreparation, restoreCompatibilityPreparation } from "../../scripts/permission-compatibility-prepare.mjs";
import { PROJECT, runtimeProof } from "../../scripts/permission-identity-runtime.mjs";
import { cleanupReadFixture, db, env, fixtureEvidence, setupReadFixture, STORE_IDS } from "./permissionReadFixture";

type CompatibilityReceipt = { installedByCaller: boolean } | undefined;
type FunctionRow = { signature: string; schema_name: string; definition: string };
type GrantRow = { signature?: string; relname?: string; attname?: string; grantee: string; privilege: string; grantable: boolean };
type PolicyRow = { policyname: string; permissive: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null };

const APP_ROLES = ["PUBLIC", "anon", "authenticated", "service_role"];
const CHANGE_RELATIONS = ["store_settings", "categories", "menu_items", "option_groups", "option_values", "menu_item_option_groups", "floor_areas", "tables", "floor_decor_items"];
const STORAGE_POLICIES = ["permission_image_staging_select", "permission_image_staging_insert", "permission_image_staging_update", "permission_image_staging_delete",
  "menu_item_images_public_read", "menu_item_images_store_insert", "menu_item_images_store_update", "menu_item_images_store_delete"];
const FUNCTION_FILTER = `(
  (n.nspname='public' and (p.proname in ('apply_menu_changes','apply_floor_changes','update_store_settings','clear_demo_data','seed_employee',
    'permission_contract_pre_request','permission_contract_probe') or p.proname like 'permission_menu_image_%'))
  or (n.nspname='private' and (p.proname like 'permission_changes_%' or p.proname in ('permission_floor_asset','permission_floor_valid',
    'permission_lock_changes','permission_menu_valid','permission_lock_menu_image_changes','permission_finalize_menu_image',
    'permission_unpublish_menu_image','permission_unpublish_changed_menu_image','assert_permission_contract')))
)`;
const q = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const role = (value: string) => value === "PUBLIC" ? "PUBLIC" : q(value);

let readStarted = false, baselineReady = false, ownedStorageRemoved = false, cleaning = false, cleaned = false, serviceKey = "";
let sourceBefore = "", runtimeBefore = "", schemaBefore = "", storageBefore = "", restoreProofBefore = "", restoreProofBytesBefore = "";
let compatibilityBefore: "ABSENT" | "PREPARED" = "ABSENT";
let contractGateExisted = false, stagingBucketExisted = false;
let functionsBefore: FunctionRow[] = [], functionGrantsBefore: GrantRow[] = [], relationGrantsBefore: GrantRow[] = [], columnGrantsBefore: GrantRow[] = [];
let contractGateGrantsBefore: GrantRow[] = [];
let policiesBefore: PolicyRow[] = [];
const trackedObjects = new Map<string, string>();

async function verifyMarker() {
  const result = await db.query("select marker,engine,store_ids from private.idempotency_test_environment where singleton");
  const row = result.rows[0];
  if (result.rowCount !== 1 || row?.marker !== env.marker || row?.engine !== "supabase-identity-v1"
    || JSON.stringify(row.store_ids) !== JSON.stringify(STORE_IDS)) throw new Error("IMAGE_FIXTURE_MARKER_REFUSED");
}

function isolatedServiceKey() {
  try {
    const args = ["/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase", "status", "--workdir", "/var/tmp/pos-cafe-perm-s31-t04-20261013/stack", "-o", "json"];
    const raw = process.platform === "win32"
      ? execFileSync("wsl", ["-d", "Ubuntu-24.04", "--", ...args], { encoding: "utf8", timeout: 30_000 })
      : execFileSync(args[0], args.slice(1), { encoding: "utf8", timeout: 30_000 });
    const status = JSON.parse(raw.slice(raw.indexOf("{")));
    if (status.API_URL !== env.api || status.PROJECT_ID && status.PROJECT_ID !== PROJECT || typeof status.SERVICE_ROLE_KEY !== "string" || !status.SERVICE_ROLE_KEY)
      throw new Error();
    return status.SERVICE_ROLE_KEY as string;
  } catch { throw new Error("IMAGE_STORAGE_CREDENTIAL_UNAVAILABLE"); }
}

async function functionRows() {
  return (await db.query(`select p.oid::regprocedure::text signature,n.nspname schema_name,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where ${FUNCTION_FILTER}
    order by (n.nspname='private') desc,p.oid::regprocedure::text`)).rows as FunctionRow[];
}

async function functionGrants() {
  return (await db.query(`select p.oid::regprocedure::text signature,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
    where ${FUNCTION_FILTER} and (a.grantee=0 or r.rolname=any($1::text[])) order by 1,2,3`, [APP_ROLES.slice(1)])).rows as GrantRow[];
}

async function schemaFingerprint() {
  const functions = await functionRows();
  const functionAcl = await functionGrants();
  const relationAcl = (await db.query(`select c.relname,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type,a.is_grantable
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) order by c.relname,grantee,a.privilege_type`, [CHANGE_RELATIONS])).rows;
  const columnAcl = (await db.query(`select c.relname,x.attname,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type,a.is_grantable
    from pg_attribute x join pg_class c on c.oid=x.attrelid cross join lateral aclexplode(x.attacl) a left join pg_roles r on r.oid=a.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and x.attnum>0 and not x.attisdropped
    order by c.relname,x.attnum,grantee,a.privilege_type`, [CHANGE_RELATIONS])).rows;
  const policies = (await db.query(`select policyname,permissive,roles,cmd,qual,with_check from pg_policies
    where schemaname='storage' and tablename='objects' order by policyname`)).rows;
  const triggers = (await db.query(`select t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t
    where t.tgrelid='public.menu_items'::regclass and not t.tgisinternal order by t.tgname`)).rows;
  const relations = (await db.query(`select to_regclass('private.menu_image_uploads')::text uploads,to_regclass('private.menu_image_assets')::text assets,
    to_regclass('private.permission_contract_gate')::text contract_gate`)).rows[0];
  const gate = relations.contract_gate ? (await db.query("select to_jsonb(g) row from private.permission_contract_gate g order by singleton")).rows : [];
  const gateAcl = relations.contract_gate ? (await db.query(`select coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type,a.is_grantable
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee
    where c.oid='private.permission_contract_gate'::regclass order by grantee,a.privilege_type`)).rows : [];
  return digest({ functions, functionAcl, relationAcl, columnAcl, policies, triggers, relations, gate, gateAcl });
}

async function storageFingerprint(bucket?: string) {
  const parameter = bucket ? [bucket] : [];
  const where = bucket ? "where bucket_id=$1" : "";
  const objects = (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(o)::text),'' order by md5(to_jsonb(o)::text)),'')) hash from storage.objects o ${where}`, parameter)).rows[0].hash;
  const buckets = bucket ? null : (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' order by md5(to_jsonb(b)::text)),'')) hash from storage.buckets b`)).rows[0].hash;
  return digest({ objects, buckets });
}

async function storageBytesFingerprint(bucket: string, expectedCount?: number) {
  const names = (await db.query("select name from storage.objects where bucket_id=$1 order by name", [bucket])).rows.map(row => row.name as string);
  if (expectedCount !== undefined && names.length !== expectedCount) throw new Error("IMAGE_STORAGE_PROOF_COUNT_MISMATCH");
  const hashes = [];
  for (const name of names) {
    const encoded = name.split("/").map(part => encodeURIComponent(part)).join("/");
    const response = await fetch(`${env.api}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`, { headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
    }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("IMAGE_STORAGE_BASELINE_UNREADABLE");
    hashes.push({ name, sha256: createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex") });
  }
  return digest(hashes);
}

async function captureAcl() {
  relationGrantsBefore = (await db.query(`select c.relname,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and a.privilege_type=any($2::text[])
    and (a.grantee=0 or r.rolname=any($3::text[])) order by 1,2,3`, [CHANGE_RELATIONS, ["INSERT", "UPDATE", "DELETE", "TRUNCATE"], APP_ROLES.slice(1)])).rows;
  columnGrantsBefore = (await db.query(`select c.relname,x.attname,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_attribute x join pg_class c on c.oid=x.attrelid cross join lateral aclexplode(x.attacl) a left join pg_roles r on r.oid=a.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and a.privilege_type=any($2::text[])
    and (a.grantee=0 or r.rolname=any($3::text[])) order by 1,2,3,4`, [CHANGE_RELATIONS, ["INSERT", "UPDATE"], APP_ROLES.slice(1)])).rows;
}

export async function setupImagesRuntimeFixture() {
  readStarted = true;
  await setupReadFixture();
  await verifyMarker();
  if ((await db.query("select to_regclass('private.menu_image_uploads') uploads,to_regclass('private.menu_image_assets') assets")).rows[0].uploads)
    throw new Error("IMAGE_FIXTURE_BASELINE_NOT_CLEAN");
  sourceBefore = permissionFingerprint(); runtimeBefore = digest(runtimeProof());
  compatibilityBefore = await inspectCompatibilityPreparation(db);
  contractGateExisted = Boolean((await db.query("select to_regclass('private.permission_contract_gate') present")).rows[0].present);
  stagingBucketExisted = Boolean((await db.query("select 1 from storage.buckets where id='menu-item-image-staging'")).rowCount);
  functionsBefore = await functionRows(); functionGrantsBefore = await functionGrants(); await captureAcl();
  policiesBefore = (await db.query(`select policyname,permissive,roles::text[] roles,cmd,qual,with_check from pg_policies where schemaname='storage'
    and tablename='objects' and policyname=any($1::text[]) order by policyname`, [STORAGE_POLICIES])).rows;
  await db.query("create temporary table t09_storage_buckets on commit preserve rows as table storage.buckets");
  await db.query("create temporary table t09_storage_objects on commit preserve rows as table storage.objects");
  if (contractGateExisted) await db.query("create temporary table t09_contract_gate on commit preserve rows as table private.permission_contract_gate");
  if (contractGateExisted) contractGateGrantsBefore = (await db.query(`select coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a left join pg_roles r on r.oid=a.grantee
    where c.oid='private.permission_contract_gate'::regclass and (a.grantee=0 or r.rolname=any($1::text[])) order by 1,2`, [APP_ROLES.slice(1)])).rows;
  serviceKey = isolatedServiceKey();
  storageBefore = await storageFingerprint(); restoreProofBefore = await storageFingerprint("restore-proof-1790591043430");
  restoreProofBytesBefore = await storageBytesFingerprint("restore-proof-1790591043430", 2);
  schemaBefore = await schemaFingerprint(); baselineReady = true;
}

export async function trackImageUpload(uploadHandle: string) {
  if (!baselineReady || !/^[0-9a-f-]{36}$/.test(uploadHandle)) throw new Error("IMAGE_UPLOAD_HANDLE_INVALID");
  const row = (await db.query("select store_id,object_key from private.menu_image_uploads where upload_handle=$1", [uploadHandle])).rows[0];
  if (!row || row.store_id !== STORE_IDS[0] || !row.object_key.startsWith(`${STORE_IDS[0]}/menu-items/`)
    || !row.object_key.includes(`/${uploadHandle}.`)) throw new Error("IMAGE_UPLOAD_OWNERSHIP_UNVERIFIED");
  trackedObjects.set(uploadHandle, row.object_key);
}

async function restoreCompatibility(receipt: CompatibilityReceipt) {
  const gate = (await db.query("select to_regclass('private.permission_contract_gate') present")).rows[0].present;
  if (gate) await db.query("update private.permission_contract_gate set strict=false where singleton");
  const current = await inspectCompatibilityPreparation(db);
  if (compatibilityBefore === "ABSENT" && current === "PREPARED") await restoreCompatibilityPreparation(db, receipt ?? { installedByCaller: true });
  else if (compatibilityBefore !== current) throw new Error("IMAGE_COMPATIBILITY_STATE_DRIFT");
}

async function deleteOwnedStorageObjects() {
  const uploadsPresent = (await db.query("select to_regclass('private.menu_image_uploads') present")).rows[0].present;
  const rows = uploadsPresent
    ? (await db.query(`select upload_handle::text,store_id::text,object_key from private.menu_image_uploads order by upload_handle`)).rows
    : [];
  for (const row of rows) {
    if (row.store_id !== STORE_IDS[0] || !row.object_key.startsWith(`${STORE_IDS[0]}/menu-items/`) || !row.object_key.includes(`/${row.upload_handle}.`))
      throw new Error("IMAGE_STORAGE_SCOPE_REFUSED");
    const tracked = trackedObjects.get(row.upload_handle);
    if (tracked && tracked !== row.object_key) throw new Error("IMAGE_STORAGE_TRACKING_DRIFT");
    trackedObjects.set(row.upload_handle, row.object_key);
  }
  for (const [uploadHandle, objectKey] of [...trackedObjects].sort(([left], [right]) => left.localeCompare(right))) {
    if (!objectKey.startsWith(`${STORE_IDS[0]}/menu-items/`) || !objectKey.includes(`/${uploadHandle}.`)) throw new Error("IMAGE_STORAGE_SCOPE_REFUSED");
    if ((await db.query("select 1 from pg_temp.t09_storage_objects where bucket_id='menu-item-image-staging' and name=$1", [objectKey])).rowCount)
      throw new Error("IMAGE_STORAGE_PREEXISTING_OBJECT_REFUSED");
    const response = await fetch(`${env.api}/storage/v1/object/menu-item-image-staging`, { method: "DELETE", headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json",
    }, body: JSON.stringify({ prefixes: [objectKey] }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("IMAGE_STORAGE_DELETE_FAILED");
    if ((await db.query("select 1 from storage.objects where bucket_id='menu-item-image-staging' and name=$1", [objectKey])).rowCount)
      throw new Error("IMAGE_STORAGE_DELETE_UNCONFIRMED");
    const encoded = objectKey.split("/").map((part: string) => encodeURIComponent(part)).join("/");
    const absent = await fetch(`${env.api}/storage/v1/object/menu-item-image-staging/${encoded}`, { headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
    }, signal: AbortSignal.timeout(10_000) });
    if (![400, 404].includes(absent.status)) throw new Error("IMAGE_STORAGE_BYTES_REMAIN");
  }
}

async function restoreFunctionSurface() {
  await db.query("drop trigger if exists permission_menu_image_withdrawal on public.menu_items");
  const baseline = new Map(functionsBefore.map(row => [row.signature, row]));
  const current = await functionRows();
  for (const row of current.filter(row => !baseline.has(row.signature) && row.schema_name === "public")) await db.query(`drop function ${row.signature}`);
  for (const row of current.filter(row => !baseline.has(row.signature) && row.schema_name === "private")) await db.query(`drop function ${row.signature}`);
  for (const row of functionsBefore) await db.query(row.definition);
  for (const row of functionsBefore) {
    await db.query(`revoke all privileges on function ${row.signature} from PUBLIC,anon,authenticated,service_role`);
    for (const grant of functionGrantsBefore.filter(entry => entry.signature === row.signature))
      await db.query(`grant ${grant.privilege} on function ${row.signature} to ${role(grant.grantee)}${grant.grantable ? " with grant option" : ""}`);
  }
}

async function restoreChangeAcl() {
  for (const name of CHANGE_RELATIONS) {
    await db.query(`revoke insert,update,delete,truncate on public.${q(name)} from PUBLIC,anon,authenticated,service_role`);
    const columns = (await db.query("select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped", [`public.${name}`])).rows;
    for (const column of columns) await db.query(`revoke insert(${q(column.attname)}),update(${q(column.attname)}) on public.${q(name)} from PUBLIC,anon,authenticated,service_role`);
  }
  for (const grant of relationGrantsBefore)
    await db.query(`grant ${grant.privilege} on public.${q(grant.relname!)} to ${role(grant.grantee)}${grant.grantable ? " with grant option" : ""}`);
  for (const grant of columnGrantsBefore)
    await db.query(`grant ${grant.privilege}(${q(grant.attname!)}) on public.${q(grant.relname!)} to ${role(grant.grantee)}${grant.grantable ? " with grant option" : ""}`);
}

async function restorePolicy(row: PolicyRow) {
  const roles = row.roles.map(value => value.toLowerCase() === "public" ? "PUBLIC" : q(value)).join(",");
  await db.query(`create policy ${q(row.policyname)} on storage.objects as ${row.permissive} for ${row.cmd} to ${roles}`
    + (row.qual ? ` using (${row.qual})` : "") + (row.with_check ? ` with check (${row.with_check})` : ""));
}

async function restoreStorageSurface() {
  for (const name of STORAGE_POLICIES) await db.query(`drop policy if exists ${q(name)} on storage.objects`);
  if (stagingBucketExisted) {
    const columns = (await db.query(`select attname from pg_attribute where attrelid='storage.buckets'::regclass and attnum>0 and not attisdropped
      and attgenerated='' and attname<>'id' order by attnum`)).rows.map(row => q(row.attname)).join(",");
    await db.query(`update storage.buckets b set (${columns})=(select ${columns} from pg_temp.t09_storage_buckets old where old.id=b.id)
      where b.id='menu-item-image-staging'`);
  } else if ((await db.query("select 1 from storage.objects where bucket_id='menu-item-image-staging'")).rowCount === 0) {
    const response = await fetch(`${env.api}/storage/v1/bucket/menu-item-image-staging`, { method: "DELETE", headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
    }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok && response.status !== 404) throw new Error("IMAGE_STAGING_BUCKET_DELETE_FAILED");
  } else throw new Error("IMAGE_STAGING_BUCKET_NOT_EMPTY");
  for (const policy of policiesBefore) await restorePolicy(policy);
}

async function restoreContractGate() {
  const exists = Boolean((await db.query("select to_regclass('private.permission_contract_gate') present")).rows[0].present);
  if (!contractGateExisted) {
    if (exists) await db.query("drop table private.permission_contract_gate");
    return;
  }
  if (!exists) throw new Error("IMAGE_CONTRACT_GATE_MISSING");
  const columns = (await db.query(`select attname from pg_attribute where attrelid='private.permission_contract_gate'::regclass and attnum>0
    and not attisdropped and attgenerated='' order by attnum`)).rows.map(row => q(row.attname)).join(",");
  await db.query(`delete from private.permission_contract_gate; insert into private.permission_contract_gate(${columns}) select ${columns} from pg_temp.t09_contract_gate`);
  await db.query("revoke all privileges on private.permission_contract_gate from PUBLIC,anon,authenticated,service_role");
  for (const grant of contractGateGrantsBefore)
    await db.query(`grant ${grant.privilege} on private.permission_contract_gate to ${role(grant.grantee)}${grant.grantable ? " with grant option" : ""}`);
}

export async function cleanupImagesRuntimeFixture(receipt?: CompatibilityReceipt) {
  if (cleaned) return;
  if (cleaning) throw new Error("IMAGE_FIXTURE_CLEANUP_IN_PROGRESS");
  cleaning = true;
  const failures: string[] = [];
  const diagnostics: { phase: string; step: string; code: string; sqlstate: string | null }[] = [];
  const codes = new Set(["IMAGE_COMPATIBILITY_STATE_DRIFT", "IMAGE_STORAGE_SCOPE_REFUSED", "IMAGE_STORAGE_TRACKING_DRIFT",
    "IMAGE_STORAGE_PREEXISTING_OBJECT_REFUSED", "IMAGE_STORAGE_DELETE_FAILED", "IMAGE_STORAGE_DELETE_UNCONFIRMED",
    "IMAGE_STORAGE_BYTES_REMAIN", "IMAGE_STAGING_BUCKET_DELETE_FAILED", "IMAGE_STAGING_BUCKET_NOT_EMPTY",
    "IMAGE_CONTRACT_GATE_MISSING", "IMAGE_SCHEMA_RESTORE_MISMATCH", "IMAGE_STORAGE_METADATA_RESTORE_MISMATCH",
    "IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH", "IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH",
    "IMAGE_STORAGE_PROOF_COUNT_MISMATCH", "IMAGE_STORAGE_BASELINE_UNREADABLE"]);
  const sqlstates = new Set(["0A000", "42501", "42704", "42P01", "42883", "42710", "2BP01", "23505", "23503",
    "23514", "55000", "57014", "40001", "40P01", "25P02", "42601", "22P02"]);
  const failed = (phase: string, step: string, error: unknown) => {
    const value = error && typeof error === "object" ? error as { message?: unknown; code?: unknown } : {};
    failures.push(phase);
    diagnostics.push({ phase, step, code: typeof value.message === "string" && codes.has(value.message)
      ? value.message : "IMAGE_CLEANUP_STEP_FAILED", sqlstate: typeof value.code === "string" && sqlstates.has(value.code) ? value.code : null });
  };
  try {
    try { await verifyMarker(); } catch { serviceKey = ""; await db.end().catch(() => {}); throw new Error("IMAGE_FIXTURE_MARKER_REFUSED"); }
    if (baselineReady) {
      try { await restoreCompatibility(receipt); } catch (error) { failed("compatibility", "restore-compatibility", error); }
      let storageObjectsRemoved = ownedStorageRemoved;
      if (!storageObjectsRemoved) try {
        await deleteOwnedStorageObjects();
        ownedStorageRemoved = storageObjectsRemoved = true;
      } catch (error) { failed("storage-objects", "delete-owned-storage", error); }
      let step = "restore-functions";
      try {
        await restoreFunctionSurface();
        if (storageObjectsRemoved) {
          step = "drop-image-tables";
          await db.query("drop table if exists private.menu_image_assets; drop table if exists private.menu_image_uploads");
          step = "restore-storage";
          await restoreStorageSurface();
        }
        step = "restore-change-acl"; await restoreChangeAcl();
        step = "restore-contract-gate"; await restoreContractGate();
        step = "reload-schema";
        await db.query("notify pgrst,'reload schema'");
        step = "verify-schema";
        if (storageObjectsRemoved && await schemaFingerprint() !== schemaBefore) throw new Error("IMAGE_SCHEMA_RESTORE_MISMATCH");
        step = "verify-storage-metadata";
        if (storageObjectsRemoved && await storageFingerprint() !== storageBefore) throw new Error("IMAGE_STORAGE_METADATA_RESTORE_MISMATCH");
        step = "verify-sentinel-metadata";
        if (storageObjectsRemoved && await storageFingerprint("restore-proof-1790591043430") !== restoreProofBefore) throw new Error("IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH");
        step = "verify-sentinel-bytes";
        if (storageObjectsRemoved && await storageBytesFingerprint("restore-proof-1790591043430", 2) !== restoreProofBytesBefore) throw new Error("IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH");
      } catch (error) { failed("database-surface", step, error); }
    }
    // Preserve the still-open TEMP snapshots and fixture state for a bounded
    // retry when an earlier cleanup phase fails.
    if (!failures.length) try { if (readStarted) await cleanupReadFixture(); } catch (error) { failed("read-fixture", "cleanup-read", error); }
    if (!failures.length) try {
      if (baselineReady && (permissionFingerprint() !== sourceBefore || digest(runtimeProof()) !== runtimeBefore || fixtureEvidence.reverted !== true))
        failed("source-runtime", "verify-source-runtime", undefined);
    } catch (error) { failed("source-runtime", "verify-source-runtime", error); }
    if (failures.length) {
      const error = new Error(`IMAGE_FIXTURE_CLEANUP_FAILED:${[...new Set(failures)].join(",")}`) as Error & { permissionCleanupDiagnostics: typeof diagnostics };
      error.permissionCleanupDiagnostics = diagnostics;
      throw error;
    }
    serviceKey = ""; cleaned = true;
  } finally { cleaning = false; }
}
