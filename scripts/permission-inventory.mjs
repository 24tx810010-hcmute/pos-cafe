import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMAS = ['public', 'private', 'storage'];
const NOT_RUN = Object.freeze({ http: 'NOT_RUN', realtime: 'NOT_RUN', employeeAuthorization: 'NOT_RUN' });
const financialTables = new Set(['orders', 'order_items', 'order_item_options', 'payments', 'write_operations', 'order_events']);

// Catalog expressions are hashed inside PostgreSQL. No function body, default
// literal, policy expression, auth row, token, object key or file content leaves
// the database. Grants describe PostgreSQL access, not HTTP/RLS authorization.
const SQL = {
  namespaces: `/* permission-inventory:namespaces */
    select nspname as schema, pg_get_userbyid(nspowner) as owner,
      md5(coalesce(nspacl,acldefault('n',nspowner))::text) as "aclHash"
    from pg_namespace where nspname=any($1::text[])`,
  roles: `/* permission-inventory:roles */
    select rolname as name, rolsuper as superuser, rolinherit as inherit,
      rolbypassrls as "bypassRls", rolcanlogin as "canLogin"
    from pg_roles`,
  memberships: `/* permission-inventory:memberships */
    select pg_get_userbyid(roleid) as role, pg_get_userbyid(member) as member,
      pg_get_userbyid(grantor) as grantor, admin_option as "adminOption",
      to_jsonb(m)->>'inherit_option' as "inheritOption",
      to_jsonb(m)->>'set_option' as "setOption"
    from pg_auth_members m`,
  relations: `/* permission-inventory:relations */
    select n.nspname as schema,c.relname as object,c.relkind as "relationKind",
      pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as "rlsEnabled",
      c.relforcerowsecurity as "rlsForced",c.relreplident as "replicaIdentity",
      c.relpersistence as persistence,c.relispartition as "isPartition",
      md5(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))::text) as "aclHash",
      md5(coalesce(c.reloptions::text,'')) as "optionsHash",
      case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid,true)) end as "viewHash",
      case when c.relispartition then md5(pg_get_expr(c.relpartbound,c.oid)) end as "partitionHash"
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=any($1::text[]) and c.relkind in ('r','p','v','m','f','S')`,
  columns: `/* permission-inventory:columns */
    select n.nspname as schema,c.relname as object,a.attname as column,a.attnum as ordinal,
      format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as "notNull",
      a.attidentity as identity,a.attgenerated as generated,
      case when a.attcollation<>0 then co.collname end as collation,
      md5(coalesce(pg_get_expr(d.adbin,d.adrelid),'')) as "defaultHash",
      md5(coalesce(a.attacl::text,'')) as "aclHash",
      has_column_privilege(current_user,c.oid,a.attnum,'SELECT') as "observerCanSelect"
    from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    left join pg_collation co on co.oid=a.attcollation
    where n.nspname=any($1::text[]) and c.relkind in ('r','p','v','m','f')
      and a.attnum>0 and not a.attisdropped`,
  constraints: `/* permission-inventory:constraints */
    select n.nspname as schema,coalesce(c.relname,t.typname) as object,
      k.conname as name,k.contype as type,k.convalidated as validated,
      k.condeferrable as deferrable,k.condeferred as deferred,
      md5(pg_get_constraintdef(k.oid,true)) as "definitionHash"
    from pg_constraint k join pg_namespace n on n.oid=k.connamespace
    left join pg_class c on c.oid=k.conrelid left join pg_type t on t.oid=k.contypid
    where n.nspname=any($1::text[])`,
  indexes: `/* permission-inventory:indexes */
    select n.nspname as schema,c.relname as object,ic.relname as name,
      i.indisvalid as valid,i.indisready as ready,i.indisunique as unique,
      md5(pg_get_indexdef(i.indexrelid)) as "definitionHash"
    from pg_index i join pg_class c on c.oid=i.indrelid
    join pg_class ic on ic.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=any($1::text[])`,
  triggers: `/* permission-inventory:triggers */
    select n.nspname as schema,c.relname as object,t.tgname as name,
      t.tgenabled as enabled,t.tgisinternal as internal,
      md5(pg_get_triggerdef(t.oid,true)) as "definitionHash"
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[])`,
  types: `/* permission-inventory:types */
    select n.nspname as schema,t.typname as name,t.typtype as kind,
      pg_get_userbyid(t.typowner) as owner,format_type(t.typbasetype,t.typtypmod) as "baseType",
      t.typnotnull as "notNull",md5(coalesce(t.typdefaultbin::text,'')) as "defaultHash",
      md5(coalesce(t.typacl::text,'')) as "aclHash",
      (select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid) as labels
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname=any($1::text[])`,
  defaultAcls: `/* permission-inventory:defaultAcls */
    select pg_get_userbyid(d.defaclrole) as role,coalesce(n.nspname,'*') as schema,
      d.defaclobjtype as "objectType",md5(d.defaclacl::text) as "aclHash"
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
    where d.defaclnamespace=0 or n.nspname=any($1::text[])`,
  tableGrants: `/* permission-inventory:tableGrants */
    with principals(name) as (values ('anon'),('authenticated'),('PUBLIC'))
    select n.nspname as schema,c.relname as object,pr.name as principal,v.privilege,
      'table' as scope,null::text as column,(pr.name='PUBLIC' or r.oid is not null) as "roleExists",
      case when pr.name='PUBLIC' then exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x where x.grantee=0 and x.privilege_type=v.privilege)
        when r.oid is not null then has_table_privilege(r.oid,c.oid,v.privilege) end as granted,
      case when pr.name='PUBLIC' then exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x where x.grantee=0 and x.privilege_type='USAGE')
        when r.oid is not null then has_schema_privilege(r.oid,n.oid,'USAGE') end as "schemaUsage"
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join principals pr left join pg_roles r on r.rolname=pr.name
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
    where n.nspname=any($1::text[]) and c.relkind in ('r','p','v','m','f')`,
  columnGrants: `/* permission-inventory:columnGrants */
    with principals(name) as (values ('anon'),('authenticated'),('PUBLIC'))
    select n.nspname as schema,c.relname as object,pr.name as principal,v.privilege,
      'column' as scope,a.attname as column,(pr.name='PUBLIC' or r.oid is not null) as "roleExists",
      case when pr.name='PUBLIC' then (
        exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x where x.grantee=0 and x.privilege_type=v.privilege)
        or exists(select 1 from aclexplode(a.attacl) x where x.grantee=0 and x.privilege_type=v.privilege))
        when r.oid is not null then has_column_privilege(r.oid,c.oid,a.attnum,v.privilege) end as granted,
      case when pr.name='PUBLIC' then exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x where x.grantee=0 and x.privilege_type='USAGE')
        when r.oid is not null then has_schema_privilege(r.oid,n.oid,'USAGE') end as "schemaUsage"
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    cross join principals pr left join pg_roles r on r.rolname=pr.name
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
    where n.nspname=any($1::text[]) and c.relkind in ('r','p','v','m','f') and a.attnum>0 and not a.attisdropped`,
  routines: `/* permission-inventory:routines */
    select n.nspname as schema,p.proname as object,
      pg_get_function_identity_arguments(p.oid) as signature,p.prokind as "routineKind",
      pg_get_userbyid(p.proowner) as owner,p.prosecdef as "securityDefiner",
      p.provolatile as volatility,p.proleakproof as "leakProof",p.proparallel as parallel,
      pg_get_function_result(p.oid) as "resultType",p.proretset as "returnsSet",
      md5(p.prosrc) as "bodyHash",md5(coalesce(p.proconfig::text,'')) as "configHash",
      md5(coalesce(p.proacl,acldefault('f',p.proowner))::text) as "aclHash",
      case when p.prokind='a' then md5(to_jsonb(ag)::text) else md5(pg_get_functiondef(p.oid)) end as "definitionHash"
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    left join pg_aggregate ag on ag.aggfnoid=p.oid where n.nspname=any($1::text[])`,
  routineGrants: `/* permission-inventory:routineGrants */
    with principals(name) as (values ('anon'),('authenticated'),('PUBLIC'))
    select n.nspname as schema,p.proname as object,
      pg_get_function_identity_arguments(p.oid) as signature,pr.name as principal,
      'EXECUTE' as privilege,'routine' as scope,(pr.name='PUBLIC' or r.oid is not null) as "roleExists",
      case when pr.name='PUBLIC' then exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE')
        when r.oid is not null then has_function_privilege(r.oid,p.oid,'EXECUTE') end as granted,
      case when pr.name='PUBLIC' then exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x where x.grantee=0 and x.privilege_type='USAGE')
        when r.oid is not null then has_schema_privilege(r.oid,n.oid,'USAGE') end as "schemaUsage"
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join principals pr left join pg_roles r on r.rolname=pr.name
    where n.nspname=any($1::text[])`,
  policies: `/* permission-inventory:policies */
    select n.nspname as schema,c.relname as object,p.polname as name,
      p.polcmd as command,p.polpermissive as permissive,
      (select jsonb_agg(case when roleid=0 then 'PUBLIC' else pg_get_userbyid(roleid) end order by roleid)
        from unnest(p.polroles) roleid) as roles,
      case when p.polqual is not null then md5(pg_get_expr(p.polqual,p.polrelid)) end as "usingHash",
      case when p.polwithcheck is not null then md5(pg_get_expr(p.polwithcheck,p.polrelid)) end as "checkHash"
    from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[])`,
  publications: `/* permission-inventory:publications */
    select pubname as name,pg_get_userbyid(pubowner) as owner,puballtables as "allTables",
      pubinsert as insert,pubupdate as update,pubdelete as delete,pubtruncate as truncate,
      pubviaroot as "viaPartitionRoot" from pg_publication`,
  publicationMembers: `/* permission-inventory:publicationMembers */
    select pubname as publication,schemaname as schema,tablename as object,
      attnames as columns,case when rowfilter is not null then md5(rowfilter) end as "rowFilterHash"
    from pg_publication_tables where schemaname=any($1::text[])`,
  publicationSchemas: `/* permission-inventory:publicationSchemas */
    select p.pubname as publication,n.nspname as schema
    from pg_publication_namespace pn join pg_publication p on p.oid=pn.pnpubid
    join pg_namespace n on n.oid=pn.pnnspid`,
};

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};
const serialize = (value) => JSON.stringify(stable(value));
const sorted = (rows) => [...rows].sort((a, b) => serialize(a).localeCompare(serialize(b), 'en'));
const hash = (value) => createHash('sha256').update(serialize(value)).digest('hex');
const objectKey = (row) => `${row.schema}.${row.object}`;
const routineKey = (row) => `${objectKey(row)}(${row.signature})`;

function expectedProtection(kind, schema, object) {
  if (kind === 'publication') return 'Signal metadata only; publication membership is not proof of safe Realtime payloads or employee authorization. Runtime verification NOT_RUN.';
  if (kind === 'Storage') return 'Check bucket visibility, object policies and actual Storage HTTP access separately. Public URL access and mutation authorization NOT_RUN.';
  if (schema === 'private') return 'Application roles must not bypass approved entry points; validate schema USAGE, effective grants and helper callers. Runtime authorization NOT_RUN.';
  if (kind === 'SELECT') return 'Tenant isolation and employee read scope require policy/endpoint tests; SELECT privileges alone do not establish either. Runtime authorization NOT_RUN.';
  if (kind === 'DML' && financialTables.has(object)) return 'Preserve protocol v1: no direct application financial/ledger DML; use authorized register/execute/get/list/cancel. Runtime verification NOT_RUN.';
  if (kind === 'RPC') return 'Check each overload, effective PUBLIC/inherited EXECUTE and authoritative employee/tenant guards; SECURITY DEFINER alone is not protection. HTTP invocation NOT_RUN.';
  return 'Check current employee authorization, tenant boundary and RLS predicates; grants alone are insufficient. Runtime authorization NOT_RUN.';
}

function surface(kind, schema, object, signature, evidence, extra = {}) {
  return {
    surfaceId: `${evidence === 'static' ? 'static:' : ''}${kind}:${schema}.${object}${signature == null ? '' : `(${signature})`}`,
    kind, schema, object, signature, source: [], observedGrants: [], policies: [], evidence,
    expectedProtection: expectedProtection(kind, schema, object),
    runtimeVerification: { ...NOT_RUN }, ...extra,
  };
}

function sourceFiles(directory) {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return entries.flatMap((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name))
    : entry.isFile() && /\.(sql|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [join(directory, entry.name)] : []).sort();
}

/** Repository source references are static evidence, never proof of deployed permissions. */
export function scanSourceInventory({ rootDir = ROOT } = {}) {
  const found = new Map();
  const add = (kind, schema, object, file, text, offset, consumer) => {
    const row = surface(kind, schema, object, null, 'static');
    const entry = found.get(row.surfaceId) ?? { ...row, staticConsumers: [] };
    const source = { file: relative(rootDir, file).replaceAll('\\', '/'), line: text.slice(0, offset).split('\n').length };
    if (!entry.source.some((ref) => ref.file === source.file && ref.line === source.line)) entry.source.push(source);
    if (!entry.staticConsumers.includes(consumer)) entry.staticConsumers.push(consumer);
    found.set(row.surfaceId, entry);
  };
  for (const file of [...sourceFiles(join(rootDir, 'supabase/migrations')), ...sourceFiles(join(rootDir, 'src/adapters/supabase'))]) {
    const text = readFileSync(file, 'utf8');
    if (file.endsWith('.sql')) {
      for (const match of text.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(public|private|storage)\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
        add('RPC', match[1], match[2], file, text, match.index, 'Migration routine declaration; overload signature must be read from catalog');
      }
      for (const match of text.matchAll(/\b(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+)(public|private|storage)\.([a-z_][a-z0-9_]*)/gi)) {
        for (const kind of ['SELECT', 'DML']) add(kind, match[1], match[2], file, text, match.index, 'Migration relation declaration/reference');
      }
      for (const match of text.matchAll(/\balter\s+publication\s+([a-z_][a-z0-9_]*)\s+add\s+table\s+([\s\S]*?);/gi)) {
        for (const table of match[2].matchAll(/(public|private|storage)\.([a-z_][a-z0-9_]*)/gi)) {
          add('publication', table[1], table[2], file, text, match.index, `Migration publication ${match[1]}; current membership NOT_RUN`);
        }
      }
      if (/\bstorage\.(?:buckets|objects)\b/.test(text)) {
        for (const match of text.matchAll(/\bstorage\.(buckets|objects)\b/g)) add('Storage', 'storage', match[1], file, text, match.index, 'Storage schema/policy migration');
      }
      continue;
    }
    const constants = new Map([...text.matchAll(/\bconst\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g)].map((m) => [m[1], m[2]]));
    for (const match of text.matchAll(/\.from\(\s*(?:['"]([^'"]+)['"]|([A-Za-z_]\w*))\s*\)/g)) {
      const before = text.slice(Math.max(0, match.index - 100), match.index);
      const after = text.slice(match.index + match[0].length).split(';', 1)[0];
      const object = match[1] ?? constants.get(match[2]) ?? `<dynamic:${match[2]}>`;
      if (/\.storage\s*$/.test(before)) {
        add('Storage', 'storage', object, file, text, match.index, 'Storage SDK consumer; HTTP NOT_RUN');
      } else {
        const mutation = /\.(insert|upsert|update|delete)\s*\(/.test(after);
        const select = /\.select\s*\(/.test(after);
        if (mutation) add('DML', 'public', object, file, text, match.index, 'Direct PostgREST mutation');
        if (select || !mutation) add('SELECT', 'public', object, file, text, match.index, 'Direct PostgREST read/returned row projection');
      }
    }
    for (const match of text.matchAll(/\b(?:insertRows|upsertRows|updateRow|tombstoneRow)\s*\(\s*[\w.]+\s*,\s*['"]([^'"]+)['"]/g)) {
      add('DML', 'public', match[1], file, text, match.index, 'Direct DML through shared adapter helper');
    }
    for (const match of text.matchAll(/(?:\.rpc|this\.operation)\(\s*(?:['"]([^'"]+)['"]|([A-Za-z_]\w*))/g)) {
      add('RPC', 'public', match[1] ?? `<dynamic:${match[2]}>`, file, text, match.index, 'RPC adapter consumer; live overload resolution NOT_RUN');
    }
    for (const match of text.matchAll(/for\s*\(\s*const\s+\w+\s+of\s+\[([^\]]+)\]\s*\)/g)) {
      if (!/postgres_changes/.test(text.slice(match.index, match.index + 500))) continue;
      for (const table of match[1].matchAll(/['"]([^'"]+)['"]/g)) add('publication', 'public', table[1], file, text, match.index, 'Realtime postgres_changes subscription; delivery/filtering NOT_RUN');
    }
    for (const match of text.matchAll(/['"]postgres_changes['"][\s\S]{0,180}?\btable\s*:\s*['"]([^'"]+)['"]/g)) {
      add('publication', 'public', match[1], file, text, match.index, 'Realtime postgres_changes subscription; delivery/filtering NOT_RUN');
    }
  }
  return sorted([...found.values()].map((entry) => ({ ...entry, source: sorted(entry.source), staticConsumers: entry.staticConsumers.sort() })));
}

async function queryRows(db, name, sql, values = []) {
  try {
    const result = await db.query(sql, values);
    if (!Array.isArray(result?.rows)) throw new Error('INVALID_RESULT');
    return result.rows;
  } catch (error) {
    // Driver errors may embed URLs, SQL or credentials. Keep only a SQLSTATE.
    const code = /^[A-Z0-9]{5}$/.test(error?.code ?? '') ? `; SQLSTATE ${error.code}` : '';
    throw new Error(`Permission inventory failed at ${name}${code}`);
  }
}

/**
 * A pg-compatible client, already connected inside the caller's read-only
 * transaction. This function only executes SELECTs; it never connects, begins,
 * commits or invokes application routines. Caller must roll back on any error.
 */
export async function collectInventory(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('A connected pg-compatible client is required');
  const catalog = {};
  for (const [name, sql] of Object.entries(SQL)) {
    catalog[name] = sorted(await queryRows(db, name, sql, sql.includes('$1') ? [SCHEMAS] : []));
  }

  const bucketRelation = catalog.relations.find((row) => row.schema === 'storage' && row.object === 'buckets');
  const bucketColumns = catalog.columns.filter((row) => row.schema === 'storage' && row.object === 'buckets');
  const bucketFields = ['id', 'name', 'public', 'file_size_limit', 'allowed_mime_types'];
  const available = new Map(bucketColumns.map((row) => [row.column, row]));
  const canReadBuckets = bucketRelation && ['id', 'name', 'public'].every((name) => available.get(name)?.observerCanSelect === true)
    && bucketFields.every((name) => !available.has(name) || available.get(name).observerCanSelect === true);
  const storageStatus = !bucketRelation ? 'SCHEMA_NOT_PRESENT' : !canReadBuckets ? 'METADATA_ACCESS_NOT_AVAILABLE' : 'CATALOG_METADATA_ONLY';
  catalog.storageStatus = storageStatus;
  catalog.buckets = canReadBuckets ? sorted(await queryRows(db, 'buckets', `/* permission-inventory:buckets */ select ${bucketFields.map((name) => available.has(name) ? `"${name}"` : `null as "${name}"`).join(',')} from storage.buckets`)) : [];

  const sources = scanSourceInventory();
  const refs = (schema, object, kind) => {
    const all = sources.filter((row) => row.schema === schema && row.object === object && (!kind || row.kind === kind)).flatMap((row) => row.source);
    return sorted([...new Map(all.map((ref) => [`${ref.file}:${ref.line}`, ref])).values()]);
  };
  const grants = (rows) => sorted(rows.map(({ schema, object, signature, ...grant }) => ({
    ...grant, accessible: grant.granted == null || grant.schemaUsage == null ? null : grant.granted && grant.schemaUsage,
  })));
  const policies = (schema, object) => catalog.policies.filter((row) => row.schema === schema && row.object === object)
    .map(({ schema: _schema, object: _object, ...policy }) => policy);
  const surfaces = [];
  for (const table of catalog.relations.filter((row) => row.relationKind !== 'S')) {
    const tableGrants = [...catalog.tableGrants, ...catalog.columnGrants].filter((row) => objectKey(row) === objectKey(table));
    for (const kind of ['SELECT', 'DML']) {
      surfaces.push(surface(kind, table.schema, table.object, null, 'catalog', {
        source: refs(table.schema, table.object),
        observedGrants: grants(tableGrants.filter((row) => kind === 'SELECT' ? row.privilege === 'SELECT' : row.privilege !== 'SELECT')),
        policies: policies(table.schema, table.object),
        relation: table, columns: catalog.columns.filter((row) => objectKey(row) === objectKey(table)),
        sourceMatch: 'Object-name references; catalog is authoritative for current definitions',
      }));
    }
  }
  for (const routine of catalog.routines) {
    surfaces.push(surface('RPC', routine.schema, routine.object, routine.signature, 'catalog', {
      source: refs(routine.schema, routine.object, 'RPC'),
      observedGrants: grants(catalog.routineGrants.filter((row) => routineKey(row) === routineKey(routine))),
      securityDefiner: routine.securityDefiner, routine,
      sourceMatch: 'Name-only source references; exact overload identity comes from catalog',
    }));
  }
  for (const publication of catalog.publications) {
    surfaces.push(surface('publication', 'pg_catalog', publication.name, null, 'catalog', {
      publication, members: catalog.publicationMembers.filter((row) => row.publication === publication.name),
      schemaMemberships: catalog.publicationSchemas.filter((row) => row.publication === publication.name),
      source: sorted([...new Map(catalog.publicationMembers.filter((row) => row.publication === publication.name)
        .flatMap((row) => refs(row.schema, row.object, 'publication')).map((ref) => [`${ref.file}:${ref.line}`, ref])).values()]),
    }));
  }
  for (const member of catalog.publicationMembers) {
    surfaces.push(surface('publication', member.schema, member.object, member.publication, 'catalog', {
      source: refs(member.schema, member.object, 'publication'), membership: member,
      policies: policies(member.schema, member.object),
    }));
  }
  for (const bucket of catalog.buckets) {
    surfaces.push(surface('Storage', 'storage', `bucket:${bucket.id}`, null, 'catalog', {
      bucket, source: sorted([...refs('storage', bucket.id, 'Storage'), ...refs('storage', 'buckets', 'Storage')]),
      policies: policies('storage', 'objects'),
      observedGrants: grants([...catalog.tableGrants, ...catalog.columnGrants].filter((row) => row.schema === 'storage' && row.object === 'objects')),
      metadataStatus: storageStatus,
    }));
  }
  if (!canReadBuckets) surfaces.push(surface('Storage', 'storage', 'buckets', null, bucketRelation ? 'catalog' : 'static', {
    source: refs('storage', 'buckets', 'Storage'), metadataStatus: storageStatus,
  }));

  // Static references remain separate so an absent endpoint/subscription or a
  // dynamic target is visible rather than silently discarded as "protected".
  // The current observer's privileges affect metadata readability, not the
  // database catalog itself. Setup and observer connections must agree.
  const catalogState = { ...catalog, columns: catalog.columns.map(({ observerCanSelect: _observerCanSelect, ...column }) => column) };
  return { surfaces: sorted([...surfaces, ...sources]), catalogHash: hash(catalogState) };
}
