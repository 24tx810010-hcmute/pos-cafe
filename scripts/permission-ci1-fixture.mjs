// Linux fixture adapter. Imported only after the harness has verified its envelope.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { CI1_PROJECT, CI1_RUNTIME } from './permission-ci1-policy.mjs';
import { ci1ImagesIntake, ci1PinnedImageProof } from './permission-ci1-intake.mjs';
import { ci1PreservationMask } from './permission-ci1-diagnostics.mjs';
import * as runtime from './permission-identity-runtime.mjs';
import { collectInventory } from './permission-inventory.mjs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const refuse = () => { throw new Error('CI1_FIXTURE_REFUSED'); };
let state;
const cliStatus = () => JSON.parse(execFileSync(`${CI1_RUNTIME}/bin/supabase`, ['status', '--workdir', `${CI1_RUNTIME}/stack`, '-o', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 ** 2 }));

export function verifyCi1ImagePins() {
  const pins = ci1ImagesIntake(JSON.parse(readFileSync('tests/permissions/runtime/ci1-images.json', 'utf8')));
  const proof = runtime.runtimeProof();
  for (const container of proof.containers) {
    const pin = pins.find(value => value.ref === container.image);
    if (!pin) ci1PinnedImageProof(pin, container, null);
    const image = JSON.parse(execFileSync('docker', ['image', 'inspect', container.image],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 1024 ** 2 }))[0];
    ci1PinnedImageProof(pin, container, image);
  }
  return proof;
}

async function storageRequest(path, options = {}) {
  const response = await fetch(state.env.api + '/storage/v1/' + path, { ...options,
    headers: { apikey: state.serviceKey, Authorization: 'Bearer ' + state.serviceKey, ...options.headers },
    signal: AbortSignal.timeout(10000) });
  if (!response.ok) refuse();
  return response;
}

export async function prepareCi1Fixture(privateRoot) {
  if (state) refuse();
  const proof = verifyCi1ImagePins();
  const env = runtime.parseBridgeEnvironment({ IDEM_ENV_FILE: privateRoot + '/bridge.env' });
  const status = cliStatus();
  if (status.API_URL !== env.api || status.DB_URL !== env.dsn || !status.SERVICE_ROLE_KEY) refuse();
  const db = new pg.Client({ connectionString: env.dsn, statement_timeout: 20000, connectionTimeoutMillis: 5000 });
  state = { env, db, serviceKey: status.SERVICE_ROLE_KEY, objects: [], containerIds: proof.containers.map(value => value.id) };
  await db.connect();
  await runtime.assertBridgeFixture(db, env);
  if (Number((await db.query('select count(*) n from storage.objects')).rows[0].n) !== 0) refuse();
  if (!(await db.query("select 1 from storage.buckets where id='menu-item-images'")).rowCount) refuse();
  for (const bucket of [
    { id: 'restore-proof-1790591043430', name: 'restore-proof-1790591043430', public: false },
    { id: 'menu-item-image-staging', name: 'menu-item-image-staging', public: false, file_size_limit: 5242880,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] },
  ]) await storageRequest('bucket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bucket) });
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const run = randomUUID();
  for (let index = 0; index < 6; index++) {
    const bucket = index < 4 ? 'menu-item-images' : 'restore-proof-1790591043430';
    const key = runtime.STORE_IDS[index % 2] + '/menu-items/ci1-preservation-' + run + '/' + index + '.png';
    await storageRequest(`object/${bucket}/${key}`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' }, body: bytes });
    const body = Buffer.from(await (await storageRequest(`object/authenticated/${bucket}/${key}`)).arrayBuffer());
    if (hash(body) !== hash(bytes)) refuse();
    state.objects.push({ bucket, key, sha256: hash(bytes) });
  }
  if (Number((await db.query('select count(*) n from storage.objects')).rows[0].n) !== 6) refuse();
  const client = createClient(env.api, env.anonKey, { accessToken: async () => env.storeJwt,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  try {
    await client.realtime.setAuth(env.storeJwt);
    const channel = client.channel('ci1-infrastructure-readiness', { config: { broadcast: { replication_ready: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {});
    await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('CI1_PREWARM_TIMEOUT')), 15000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); accept(); }
        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { clearTimeout(timer); reject(new Error('CI1_PREWARM_FAILED')); }
      });
    });
    let ready = false;
    for (let index = 0; index < 100; index++) {
      if ((await db.query("select 1 from pg_publication where pubname='supabase_realtime_messages_publication'")).rowCount) { ready = true; break; }
      await new Promise(accept => setTimeout(accept, 100));
    }
    if (!ready) refuse();
  } finally { await client.removeAllChannels(); }
  // Prewarm is only infrastructure readiness; T10 retains actual delivery assertions.
  return { authVerified: true, apiBindingVerified: true, markerProof: hash(env.marker) };
}

async function snapshot() {
  if (!state) refuse();
  await runtime.assertBridgeFixture(state.db, state.env);
  const inventory = await collectInventory(state.db);
  const catalog = hash(inventory.surfaces.map(surface => surface.routine
    ? { ...surface, routine: { ...surface.routine, aclHash: 'EFFECTIVE_GRANTS_CHECKED' } } : surface));
  const financial = [];
  for (const name of ['orders', 'order_items', 'order_item_options', 'payments', 'write_operations', 'order_events']) {
    financial.push((await state.db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) h from public.${name} t`)).rows[0].h);
  }
  const metadata = (await state.db.query('select to_jsonb(o) row from storage.objects o order by id')).rows;
  const buckets = (await state.db.query('select to_jsonb(b) row from storage.buckets b order by id')).rows;
  if (metadata.length !== 6 || buckets.length !== 3 || state.objects.length !== 6) refuse();
  const payloads = [];
  for (const object of state.objects) {
    const body = Buffer.from(await (await storageRequest(`object/authenticated/${object.bucket}/${object.key}`)).arrayBuffer());
    const actual = hash(body);
    if (actual !== object.sha256) refuse();
    payloads.push(actual);
  }
  return { catalog, financial, metadata, buckets, payloads };
}

const preservationHashes = value => ({components:[value.catalog,hash(value.financial),hash(value.metadata),hash(value.buckets),hash(value.payloads)],financial:value.financial});
export const captureCi1Baseline = async () => {
  const value=await snapshot(),baseline=hash(value);
  state.baseline={hash:baseline,hashes:preservationHashes(value)};
  return baseline;
};
export const verifyCi1Baseline = async (before, diagnostic=()=>{}) => {
  if(typeof before!=='string')return false;
  const value=await snapshot(),preserved=before===hash(value);
  if(!preserved&&state.baseline?.hash===before){
    const marker=ci1PreservationMask(state.baseline.hashes,preservationHashes(value));
    if(marker)try{diagnostic(marker);}catch{/* Observations cannot alter preservation acceptance. */}
  }
  return preserved;
};

export async function closeCi1Fixture() {
  if (!state) return;
  const current = state; state = undefined;
  await current.db.end();
  // The harness stops its previously validated exact container IDs; never rm/prune.
}
