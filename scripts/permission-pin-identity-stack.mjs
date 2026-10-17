import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PROJECT, LINUX_ROOT, runtimeProof } from './permission-pin-identity-runtime.mjs';

const CLI = '/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase';
const NETWORK = `supabase_network_${PROJECT}`;
const VOLUME = `supabase_db_${PROJECT}`;
const CONFIG = 'tests/permissions/runtime/identity-close1.toml';
const STACK_CONFIG = `${LINUX_ROOT}/stack/supabase/config.toml`;
const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
const wsl = (args, options = {}) => execFileSync(process.platform === 'win32' ? 'wsl' : args[0],
  process.platform === 'win32' ? ['-d', 'Ubuntu-24.04', '--', ...args] : args.slice(1),
  { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, ...options });
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };

function configBytes() {
  const bytes = readFileSync(CONFIG, 'utf8');
  if (!bytes.includes(`project_id = "${PROJECT}"`) || !bytes.includes('port = 63021')
    || !bytes.includes('port = 63022') || !bytes.includes('inspector_port = 8090')) fail('IDENTITY_CONFIG_REFUSED');
  return bytes;
}

function start() {
  const config = configBytes();
  if (wsl([CLI, '--version']).trim() !== '2.117.0') fail('IDENTITY_CLI_VERSION_REFUSED');
  wsl(['docker', 'info', '--format', '{{.ServerVersion}}']);
  const existing = wsl(['docker', 'container', 'ls', '-a', '--format', '{{.Names}}']).trim().split('\n');
  if (names.some(name => existing.includes(`supabase_${name}_${PROJECT}`))) fail('IDENTITY_CONTAINER_ALREADY_EXISTS');
  if (wsl(['docker', 'volume', 'ls', '-q']).trim().split('\n').includes(VOLUME)) fail('IDENTITY_VOLUME_ALREADY_EXISTS');
  if (wsl(['docker', 'network', 'ls', '--format', '{{.Name}}']).trim().split('\n').includes(NETWORK)) fail('IDENTITY_NETWORK_ALREADY_EXISTS');
  try { wsl(['test', '!', '-e', LINUX_ROOT]); } catch { fail('IDENTITY_ROOT_ALREADY_EXISTS'); }
  // mkdir without -p is atomic. A failed start leaves the target for inspection;
  // this launcher never removes an existing checkout, network, or volume.
  wsl(['mkdir', LINUX_ROOT]);
  wsl(['mkdir', '-p', `${LINUX_ROOT}/stack/supabase`]);
  wsl(['tee', STACK_CONFIG], { input: config });
  wsl(['docker', 'network', 'create', '--driver', 'bridge', '--opt',
    'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', NETWORK]);
  wsl([CLI, 'start', '--workdir', `${LINUX_ROOT}/stack`], { timeout: 600_000 });
  const proof = runtimeProof();
  return { project: proof.project, configHash: sha(config), serviceCount: proof.containers.length,
    apiPort: 63021, dbPort: 63022, network: NETWORK, volume: VOLUME, bootstrapped: false };
}

try {
  if (process.argv.length !== 3 || !['plan', 'start'].includes(process.argv[2])) fail('IDENTITY_STACK_ARGUMENT_REFUSED');
  if (process.argv[2] === 'plan') {
    const config = configBytes();
    console.log(JSON.stringify({ project: PROJECT, configHash: sha(config), apiPort: 63021,
      dbPort: 63022, vitePort: 5190, network: NETWORK, volume: VOLUME, action: 'PLAN_ONLY' }));
  } else console.log(JSON.stringify(start()));
} catch (error) {
  const code = error instanceof Error && /^IDENTITY_[A-Z_]+$/.test(error.message) ? error.message : 'IDENTITY_STACK_FAILED';
  console.error(code); process.exitCode = 1;
}
