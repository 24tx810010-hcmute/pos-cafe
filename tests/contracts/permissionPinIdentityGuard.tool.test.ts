import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { assertIdentityTopology, parseBridgeEnvironment, PROJECT } from '../../scripts/permission-pin-identity-runtime.mjs';

const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
const networkName = `supabase_network_${PROJECT}`;
const config = readFileSync('tests/permissions/runtime/identity-close1.toml', 'utf8');

function topology() {
  return {
    config,
    network: [{ Name: networkName, Options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' } }],
    containers: names.map((name, index) => ({
      Name: `/supabase_${name}_${PROJECT}`,
      Id: `container-${index}`, Image: `image-${index}`,
      Config: { Labels: { 'com.supabase.cli.project': PROJECT } },
      State: { Running: true, Health: { Status: 'healthy' } },
      NetworkSettings: { Networks: { [networkName]: {} }, Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '63022' }] } },
      Mounts: index === 0 ? [{ Type: 'volume', Name: `supabase_db_${PROJECT}` }] : [],
    })),
  };
}

test('identity topology accepts only the dedicated complete local target', () => {
  const value = topology();
  expect(assertIdentityTopology(value.config, value.containers, value.network)).toMatchObject({ project: PROJECT });
});

test('identity environment refuses an alternate private path before reading it', () => {
  expect(() => parseBridgeEnvironment({ IDEM_ENV_FILE: '/var/tmp/wrong/private/bridge.env' }))
    .toThrow('EXPLICIT_FIXTURE_ENV_REQUIRED');
});

test.each([
  ['project config', (value: ReturnType<typeof topology>) => { value.config = value.config.replace(PROJECT, 'wrong-project'); }, 'ISOLATED_RUNTIME_CONFIG_MISMATCH'],
  ['port config', (value: ReturnType<typeof topology>) => { value.config = value.config.replace('port = 63021', 'port = 62921'); }, 'ISOLATED_RUNTIME_CONFIG_MISMATCH'],
  ['network bind', (value: ReturnType<typeof topology>) => { value.network[0].Options['com.docker.network.bridge.host_binding_ipv4'] = '0.0.0.0'; }, 'ISOLATED_NETWORK_MISMATCH'],
  ['network membership', (value: ReturnType<typeof topology>) => { value.containers[1].NetworkSettings.Networks = {}; }, 'ISOLATED_NETWORK_MISMATCH'],
  ['project label', (value: ReturnType<typeof topology>) => { value.containers[1].Config.Labels['com.supabase.cli.project'] = 'wrong-project'; }, 'ISOLATED_SERVICE_NOT_HEALTHY'],
  ['host exposure', (value: ReturnType<typeof topology>) => { value.containers[1].NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0'; }, 'NONLOCAL_CONTAINER_PORT_REFUSED'],
  ['db volume', (value: ReturnType<typeof topology>) => { value.containers[0].Mounts = []; }, 'DEDICATED_DB_VOLUME_REQUIRED'],
] as const)('identity topology rejects %s', (_name, change, code) => {
  const value = topology();
  change(value);
  expect(() => assertIdentityTopology(value.config, value.containers, value.network)).toThrow(code);
});
