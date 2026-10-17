import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { assertReleaseExecutionRole, assertReleasePrepareBaselineAbsent, capturePrepareState,
  RELEASE_PREPARE_RESTORE_SQL } from './permission-release-cutover.mjs';

const IMAGE = 'sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
const NODE_IMAGE = 'sha256:9a079ac1c94d89629262822a4bd1902d5b1be4adb464e5a0a8fd078aaed72158';
const LIBRARY = '/nix/store/k9wsj5lmsrx4ckyc5yk530wcxpxdsa9z-supautils/lib/supautils.so';
const LIBRARY_HASH = '8226c53a3025eb377de2194e93cd36da328f1b678e33a567ffb1fa2c289a737d';
const SOURCE = 'pos-cafe-restore-1790593558895-4c7ba556';
const KEYS = ['supautils.privileged_role', 'supautils.privileged_role_allowed_configs',
  'supautils.reserved_roles', 'supautils.policy_grants'];
const digest = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value);
const check = (condition, code) => { if (!condition) throw Object.assign(new Error(code), { code }); };
const sqlLiteral = value => "'" + value.replaceAll("'", "''") + "'";
const docker = (args, input) => execFileSync('wsl.exe', ['-d', 'Ubuntu-24.04', '--exec', 'docker', ...args], {
  input, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 12 * 1024 * 1024,
  stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
}).trim();

async function observe(db) {
  const identity = (await db.query(`select current_user role,session_user,current_database() database,
    inet_server_addr()::text address,r.rolsuper superuser,r.rolbypassrls bypass_rls,r.rolcreaterole can_alter_roles,
    has_parameter_privilege(current_user,'pgrst.db_pre_request','SET') can_set_pgrst_hook,
    pg_has_role(current_user,c.relowner,'USAGE') can_manage_storage_objects,
    pg_get_userbyid(c.relowner) storage_objects_owner,
    current_setting('session_preload_libraries') session_preload,
    exists(select 1 from pg_roles p where p.rolname='supabase_privileged_role'
      and pg_has_role(current_user,p.oid,'USAGE')) provider_role_usable
    from pg_roles r cross join pg_class c where r.rolname=current_user and c.oid='storage.objects'::regclass`)).rows[0];
  const relations = (await db.query(`select n.nspname schema,c.relname name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p')
    and n.nspname in('public','private','auth','storage') order by 1,2`)).rows;
  const data = [];
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  for (const relation of relations) {
    const row = (await db.query(`select count(*)::text count,
      encode(sha256(convert_to(coalesce(string_agg(canonical||chr(10),'' order by canonical collate "C"),''),'UTF8')),'hex') sha256
      from(select to_jsonb(t)::text canonical from only ${quote(relation.schema)}.${quote(relation.name)} t) q`)).rows[0];
    data.push({ ...relation, ...row });
  }
  const grants = (await db.query(`select p.parname,p.paracl::text from pg_parameter_acl p
    where p.parname='pgrst.db_pre_request'`)).rows;
  const membership = (await db.query(`select p.rolname,m.admin_option,m.inherit_option,m.set_option
    from pg_auth_members m join pg_roles p on p.oid=m.roleid
    where m.member=(select oid from pg_roles where rolname='postgres') order by p.rolname`)).rows;
  return { identity, prepare: await capturePrepareState(db), data, grants, membership };
}

async function worker() {
  const marker = JSON.parse(readFileSync('/restore/provider-capability-isolation.json', 'utf8'));
  check(marker.kind === 'permission-provider-capability-clone' && marker.image === IMAGE
    && /^pos-cafe-provider-capability-[0-9]+-[a-f0-9]{8}$/.test(marker.name), 'WORKER_ISOLATION_REQUIRED');
  const connect = async user => {
    const db = new pg.Client({ host: '/restore', database: 'postgres', user,
      statement_timeout: 15_000, query_timeout: 20_000, application_name: 'permission-provider-capability-rehearsal' });
    await db.connect(); return db;
  };
  const admin = await connect('supabase_admin');
  let actor;
  const cases = [];
  const result = { kind: 'permission-provider-capability-runtime', mode: marker.ddlOnly ? 'DDL_DIAGNOSTIC' : 'GUARD_AND_DDL',
    image: IMAGE, supautils: { version: '3.4.0', sha256: LIBRARY_HASH }, node: process.version,
    pg: JSON.parse(readFileSync('/runtime/source/node_modules/pg/package.json', 'utf8')).version,
    sourceFingerprint: marker.sourceFingerprint, profileSha256: marker.profileSha256, cases };
  const configuration = async values => {
    for (const [name, value] of Object.entries(values)) {
      check([...KEYS, 'session_preload_libraries'].includes(name) && typeof value === 'string'
        && !/[\\\r\n\0]/.test(value), 'UNSUPPORTED_TEST_CONFIGURATION');
      // RESET yields the empty default. SET ... TO '' quotes an empty list item
      // for preload libraries, which PostgreSQL then tries to load as a file.
      if (name === 'session_preload_libraries' && value === '') await admin.query('alter system reset session_preload_libraries');
      else await admin.query(`alter system set ${name} to ${sqlLiteral(value)}`);
    }
    await admin.query('select pg_reload_conf()');
    if (actor) { await actor.end(); actor = undefined; }
    for (let attempt = 0; attempt < 30; attempt++) {
      actor = await connect('postgres');
      const rows = (await actor.query(`select name,setting from pg_settings where name=any($1::text[])`, [Object.keys(values)])).rows;
      if (Object.entries(values).every(([name, value]) => rows.find(row => row.name === name)?.setting === value)) return;
      await actor.end(); actor = undefined;
      await new Promise(done => setTimeout(done, 100));
    }
    throw Object.assign(new Error('PROFILE_RELOAD_TIMEOUT'), { code: 'PROFILE_RELOAD_TIMEOUT' });
  };
  const sameBaseline = async (before, code) => {
    const after = await observe(actor);
    check(stable(before) === stable(after), code);
    return { catalogMatched: true, dataTablesMatched: after.data.length, identityMatched: true,
      nativeGrantsAndMembershipMatched: true, baselineSha256: digest(stable(before)), afterSha256: digest(stable(after)) };
  };
  try {
    const setup = (await admin.query(`select current_user role,inet_server_addr()::text address,
      current_setting('server_version') version,(select rolsuper from pg_roles where rolname=current_user) superuser`)).rows[0];
    check(setup.role === 'supabase_admin' && setup.address === null && setup.version === '17.6' && setup.superuser === true,
      'LOCAL_SETUP_ACTOR_REQUIRED');
    await admin.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_privileged_role') then
      create role supabase_privileged_role nologin; end if; end $$;
      grant supabase_privileged_role to postgres with inherit true,set true;`);
    await configuration({ session_preload_libraries: 'supautils', ...marker.profile });
    const baseline = await observe(actor);
    check(baseline.identity.role === 'postgres' && baseline.identity.session_user === 'postgres'
      && baseline.identity.address === null && baseline.identity.superuser === false && baseline.identity.bypass_rls === true
      && baseline.identity.can_alter_roles === true && baseline.identity.can_set_pgrst_hook === false
      && baseline.identity.can_manage_storage_objects === false && baseline.identity.provider_role_usable === true,
      'PROVIDER_ACTOR_PROFILE_MISMATCH');
    result.baseline = { identity: baseline.identity, data: baseline.data, prepareSha256: digest(stable(baseline.prepare)),
      parameterGrants: baseline.grants, memberships: baseline.membership };
    await assertReleasePrepareBaselineAbsent(actor);
    if (!marker.ddlOnly) await assertReleaseExecutionRole(actor, { executionRole: 'postgres' });
    const prepare = readFileSync('/runtime/source/supabase/candidate/permission-compatibility-prepare.sql', 'utf8');
    await actor.query('begin'); await actor.query(prepare); await actor.query('commit');
    const prepared = (await actor.query(`select strict,contract_version from private.permission_contract_gate where singleton`)).rows[0];
    check(prepared?.strict === false && prepared.contract_version === 2, 'PREPARE_EXPECTATION_FAILED');
    const hook = (await actor.query(`select x setting from pg_db_role_setting s cross join lateral unnest(s.setconfig) x
      where s.setrole=(select oid from pg_roles where rolname='authenticator') and x like 'pgrst.db_pre_request=%'`)).rows;
    check(hook.length === 1 && hook[0].setting === 'pgrst.db_pre_request=public.permission_contract_pre_request', 'HOOK_EXPECTATION_FAILED');
    await actor.query('begin'); await actor.query(RELEASE_PREPARE_RESTORE_SQL); await actor.query('commit');
    cases.push({ id: 'prepare-fixed-restore', passed: true, ...await sameBaseline(baseline, 'PREPARE_RESTORE_DRIFT') });
    const images = readFileSync('/runtime/source/supabase/candidate/permission-images.sql', 'utf8');
    await actor.query('begin');
    try {
      await actor.query(images);
      const image = (await actor.query(`select (select count(*)::int from storage.buckets where id='menu-item-image-staging') bucket,
        (select count(*)::int from pg_policy where polrelid='storage.objects'::regclass
          and polname in('menu_item_images_public_read','menu_item_images_store_insert','menu_item_images_store_update','menu_item_images_store_delete')) legacy_policies,
        (select pg_get_userbyid(relowner) from pg_class where oid='storage.objects'::regclass) owner`)).rows[0];
      check(image.bucket === 1 && image.legacy_policies === 0 && image.owner === 'supabase_storage_admin', 'IMAGE_DDL_EXPECTATION_FAILED');
    } finally { await actor.query('rollback'); }
    cases.push({ id: 'images-rollback', passed: true, ...await sameBaseline(baseline, 'IMAGES_ROLLBACK_DRIFT') });
    if (!marker.ddlOnly) {
      const variants = [
        { id: 'RT01', values: { session_preload_libraries: '' } },
        { id: 'RT02', membership: false },
        { id: 'RT03', values: { 'supautils.privileged_role_allowed_configs': 'log_duration' } },
        { id: 'RT04', values: { 'supautils.reserved_roles': 'authenticator' } },
        { id: 'RT05', values: { 'supautils.policy_grants': '{"postgres":["storage.buckets"]}' } },
      ];
      for (const variant of variants) {
        await configuration({ session_preload_libraries: 'supautils', ...marker.profile });
        if (variant.membership === false) await admin.query('revoke supabase_privileged_role from postgres');
        if (variant.values) await configuration(variant.values);
        const before = await observe(actor);
        check(before.identity.can_set_pgrst_hook === false && before.identity.can_manage_storage_objects === false,
          'NEGATIVE_NATIVE_CAPABILITY_DRIFT');
        if (variant.membership === false) check(before.identity.provider_role_usable === false, 'MEMBERSHIP_NEGATIVE_INVALID');
        let errorCode;
        try { await assertReleaseExecutionRole(actor, { executionRole: 'postgres' }); } catch (error) { errorCode = error.code; }
        check(errorCode === 'PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED', 'NEGATIVE_GUARD_EXPECTATION_FAILED');
        cases.push({ id: variant.id, passed: true, errorCode, ...await sameBaseline(before, 'NEGATIVE_GUARD_EFFECT') });
        if (variant.membership === false) await admin.query('grant supabase_privileged_role to postgres with inherit true,set true');
      }
      await configuration({ session_preload_libraries: 'supautils', ...marker.profile });
      await assertReleaseExecutionRole(actor, { executionRole: 'postgres' });
      result.finalBaseline = await sameBaseline(baseline, 'FINAL_BASELINE_DRIFT');
    }
    result.status = 'PASSED_LOCAL_ONLY';
  } catch (error) {
    result.status = 'FAILED'; result.errorCode = /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'UNEXPECTED_RUNTIME_FAILURE';
    result.errorMessage = typeof error?.message === 'string' ? error.message.slice(0, 250) : null;
    process.exitCode = 1;
  } finally { if (actor) await actor.end(); await admin.end(); }
  console.log(JSON.stringify(result));
}

async function main() {
  const args = process.argv.slice(2); const ddlOnly = args.includes('--ddl-only');
  const value = flag => args[args.indexOf(flag) + 1];
  check(args.includes('--source-container') && args.includes('--profile') && args.includes('--profile-sha256') && args.includes('--output')
    && value('--source-container') === SOURCE, 'EXPLICIT_PROVIDER_REHEARSAL_INPUTS_REQUIRED');
  const profileBytes = readFileSync(resolve(value('--profile')));
  check(digest(profileBytes) === value('--profile-sha256'), 'PROFILE_HASH_MISMATCH');
  const live = JSON.parse(profileBytes);
  check(live.kind === 'permission-release-live-capabilities-readonly' && live.projectRef === 'kfqjdfwxhkdwihjobpny', 'PROFILE_BINDING_MISMATCH');
  const settings = live.results?.providerSettings;
  const profile = Object.fromEntries(KEYS.map(name => [name, settings?.find(row => row.name === name)?.setting]));
  check(Object.values(profile).every(value => typeof value === 'string' && !/[\\\r\n\0]/.test(value)), 'UNSUPPORTED_TEST_CONFIGURATION');
  const source = JSON.parse(docker(['inspect', SOURCE]))[0];
  check(source.Image === IMAGE && !source.State.Running && source.HostConfig.NetworkMode === 'none'
    && !Object.keys(source.HostConfig.PortBindings ?? {}).length && source.Mounts.length === 1
    && source.Mounts[0].Type === 'volume' && source.Mounts[0].Name === SOURCE + '-data'
    && source.Mounts[0].Destination === '/restore', 'SOURCE_ISOLATION_MISMATCH');
  check(docker(['run', '--rm', '--network', 'none', '--entrypoint', '/bin/sh', IMAGE, '-c', 'sha256sum ' + LIBRARY]).split(/\s+/)[0] === LIBRARY_HASH,
    'SUPAUTILS_BINARY_MISMATCH');
  const output = resolve(value('--output')); check(!existsSync(output), 'OUTPUT_ALREADY_EXISTS'); mkdirSync(dirname(output), { recursive: true });
  const name = `pos-cafe-provider-capability-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const volume = name + '-data'; const nodeName = name + '-node'; const sourceFingerprint = permissionFingerprint();
  const marker = { kind: 'permission-provider-capability-clone', name, volume, image: IMAGE, source: SOURCE,
    sourceVolume: SOURCE + '-data', profile, profileSha256: digest(profileBytes), sourceFingerprint, ddlOnly,
    network: 'none', publishedPorts: [], createdAt: new Date().toISOString() };
  const report = { kind: 'permission-provider-capability-rehearsal', marker, liveMutations: false, cleanupExecuted: false,
    storageApiMutations: false, pushOrDeploy: false };
  let started = false; let nodeStarted = false;
  try {
    docker(['volume', 'create', '--label', 'purpose=permission-provider-capability', volume]);
    docker(['run', '--rm', '--network', 'none', '--user', '0', '--entrypoint', '/bin/bash',
      '--mount', `type=volume,source=${SOURCE}-data,target=/source,readonly`, '--mount', `type=volume,source=${volume},target=/copy`,
      IMAGE, '-ceu', 'cp -a /source/. /copy/']);
    docker(['run', '-d', '--name', name, '--network', 'none', '--label', 'purpose=permission-provider-capability',
      '--mount', `type=volume,source=${volume},target=/restore`, '--entrypoint', '/bin/bash', IMAGE, '-ceu',
      'exec gosu postgres postgres -D /restore/pgdata -c listen_addresses= -c unix_socket_directories=/restore -c shared_preload_libraries= -c max_connections=40']);
    started = true;
    docker(['exec', name, 'bash', '-ceu', 'for attempt in $(seq 1 30); do pg_isready -h /restore -U supabase_admin -d postgres >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1']);
    docker(['exec', '-i', name, 'bash', '-ceu', 'cat > /restore/provider-capability-isolation.json'], JSON.stringify(marker));
    check(docker(['image', 'inspect', NODE_IMAGE, '--format', '{{.Id}}']) === NODE_IMAGE, 'NODE_IMAGE_MISMATCH');
    docker(['run', '-d', '--name', nodeName, '--network', 'container:' + name, '--user', '0',
      '--mount', `type=volume,source=${volume},target=/restore`,
      '--mount', 'type=bind,source=/mnt/d/Workspace/pos-cafe,target=/runtime/source,readonly',
      '--mount', 'type=bind,source=/var/tmp/pos-cafe-idem-release-20260914/node-v24.16.0-linux-x64,target=/opt/node,readonly',
      '--mount', 'type=bind,source=/var/tmp/pos-cafe-perm-t08-20260917/linux/source/node_modules,target=/runtime/source/node_modules,readonly',
      '--entrypoint', '/bin/sh', NODE_IMAGE, '-c', 'exec sleep infinity']);
    nodeStarted = true;
    const info = JSON.parse(docker(['inspect', name]))[0];
    check(info.Image === IMAGE && info.State.Running && info.HostConfig.NetworkMode === 'none'
      && !Object.keys(info.HostConfig.PortBindings ?? {}).length && info.Mounts.length === 1
      && info.Mounts[0].Name === volume && info.Config.Labels.purpose === 'permission-provider-capability', 'CLONE_ISOLATION_MISMATCH');
    let text;
    try { text = docker(['exec', nodeName, '/opt/node/bin/node', '/runtime/source/scripts/permission-provider-capability-rehearsal.mjs', '--worker']); }
    catch (error) { text = error.stdout; }
    report.runtime = JSON.parse(text);
    check(report.runtime.status === 'PASSED_LOCAL_ONLY', 'RUNTIME_CASE_FAILED');
    check(permissionFingerprint() === sourceFingerprint, 'SOURCE_CHANGED_DURING_RUN');
    report.status = 'PASSED_LOCAL_ONLY';
  } catch (error) {
    report.status = 'FAILED'; report.errorCode = /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'UNEXPECTED_REHEARSAL_FAILURE';
    process.exitCode = 1;
  } finally {
    if (nodeStarted) docker(['stop', '-t', '5', nodeName]);
    if (started) docker(['stop', '-t', '10', name]);
    report.servicesStopped = true; report.volumesRetained = true;
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ status: report.status, output, container: name, cases: report.runtime?.cases?.length ?? 0,
    errorCode: report.errorCode ?? report.runtime?.errorCode ?? null, servicesStopped: report.servicesStopped }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--worker')) await worker();
  else await main();
}
