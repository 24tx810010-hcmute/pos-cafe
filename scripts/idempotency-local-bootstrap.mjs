import { randomBytes, createHmac, createHash } from 'node:crypto';
import { writeFileSync, readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';

// Creates a NEW, loopback-only database. Never reads the application's .env files.
const runtime = process.env.IDEM_RUNTIME_DIR;
if (!runtime || !existsSync(runtime)) throw new Error('Set IDEM_RUNTIME_DIR to the dedicated portable runtime directory');
const database = `pos_cafe_idem_test_${randomBytes(6).toString('hex')}`;
const marker = `pos-cafe-idem-${randomBytes(20).toString('hex')}`;
const storeIds = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const admin = new pg.Client({ host: '127.0.0.1', port: 55439, user: 'postgres', database: 'postgres' });
await admin.connect();
try { await admin.query(`create database ${database}`); } finally { await admin.end(); }
const dsn = `postgresql://postgres@127.0.0.1:55439/${database}`;
const db = new pg.Client({ connectionString: dsn });
await db.connect();
try {
  await db.query(`
    do $$ begin
      if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      if not exists (select from pg_roles where rolname='idem_authenticator') then create role idem_authenticator login noinherit; end if;
    end $$;
    grant anon, authenticated to idem_authenticator;
    create schema auth;
    create table auth.users (id uuid primary key, email text, aud text default 'authenticated', role text default 'authenticated');
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to authenticated, service_role;
    alter default privileges in schema public grant all on sequences to authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects to authenticated;
    create schema private;
    revoke all on schema private from public, anon, authenticated;
  `);
  const checksums = {};
  const migrations = resolve('supabase/migrations');
  for (const name of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    const source = readFileSync(join(migrations, name));
    await db.query(source.toString('utf8'));
    checksums[name] = createHash('sha256').update(source).digest('hex');
  }
  await db.query(`create table private.idempotency_test_environment (
    singleton boolean primary key default true check(singleton), marker text not null, engine text not null,
    migration_checksums jsonb not null, store_ids uuid[] not null
  ); revoke all on private.idempotency_test_environment from public, anon, authenticated`);
  await db.query('insert into private.idempotency_test_environment values(true,$1,$2,$3,$4)', [marker, 'postgres-postgrest', checksums, storeIds]);
  // Minimal literal fixture sufficient for preflight/session setup. Individual tests own the business fixtures.
  await db.query('insert into auth.users(id,email) values($1,$3),($2,$4)', [...storeIds, 'fixture-s1@invalid.local', 'fixture-s2@invalid.local']);
  await db.query('insert into public.stores(id,store_no,name) values($1,1,$3),($2,2,$4)', [...storeIds, 'IDEM fixture S1', 'IDEM fixture S2']);
  await db.query('insert into public.store_settings(store_id,display_name) values($1,$3),($2,$4)', [...storeIds, 'IDEM fixture S1', 'IDEM fixture S2']);
  for (const [suffix,storeIndex,name,role,pin] of [[11,0,'A','admin','123456'],[12,0,'B','cashier','111111'],[13,0,'C','cashier','222222'],[14,0,'E','cashier','333333'],[15,1,'X','admin','123456']]) {
    await db.query("insert into public.employees(id,store_id,name,role,passcode_hash) values($1,$2,$3,$4,extensions.crypt($5,extensions.gen_salt('bf')))",
      [`00000000-0000-4000-8000-${suffix.toString(16).padStart(12,'0')}`,storeIds[storeIndex],name,role,pin]);
  }
  const jwtSecret = randomBytes(48).toString('hex');
  const jwt = (claims) => {
    const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({...claims,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');
    const signature = createHmac('sha256',jwtSecret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  };
  const envFile = join(runtime, 'idempotency.env');
  writeFileSync(envFile, [
    'VITE_DATA_MODE=supabase','VITE_SUPABASE_URL=http://127.0.0.1:55440',
    `VITE_SUPABASE_ANON_KEY=${jwt({role:'anon'})}`,`IDEM_STORE_JWT=${jwt({role:'authenticated',sub:storeIds[0]})}`,
    `IDEM_STORE_S2_JWT=${jwt({role:'authenticated',sub:storeIds[1]})}`,
    `IDEM_OBSERVER_DSN=${dsn}`,`IDEM_TEST_MARKER=${marker}`,`IDEM_FIXTURE_STORE_IDS=${storeIds.join(',')}`,
    'IDEM_TEST_ENGINE=postgres-postgrest',
  ].join('\n')+'\n');
  writeFileSync(join(runtime,'postgrest.conf'), [
    `db-uri = "postgresql://idem_authenticator@127.0.0.1:55439/${database}"`, 'db-schemas = "public"',
    'db-anon-role = "anon"',`jwt-secret = "${jwtSecret}"`,'server-host = "127.0.0.1"','server-port = 55441',
    'db-pool = 10','db-pool-acquisition-timeout = 30','log-level = "crit"',
  ].join('\n')+'\n');
  console.log(JSON.stringify({status:'CREATED_LOCAL_CONTRACT_DATABASE',database,envFile,engine:'postgres-postgrest',migrations:Object.keys(checksums)}));
} catch (error) {
  console.error(JSON.stringify({status:'BOOTSTRAP_FAILED',database,code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',message: typeof error?.message === 'string' ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted-dsn]') : 'Unknown error'}));
  process.exitCode = 1;
} finally { await db.end(); }
