import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ci1Identity } from './permission-ci1-policy.mjs';
import { CI1_SETUP, ci1NpmIntake, ci1RegistryTarball, ci1ToolsIntake, ci1EdgeIntake,
  ci1ImagesIntake, ci1CheckTarListing, assertCi1Supervisor, ci1WorkerLayout } from './permission-ci1-intake.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const identity = ci1Identity('12345', 1);
export const unitSupervisor = () => ({ platform: 'linux', arch: 'x64', root: true, wsl: false, authorized: true,
  githubHosted: true, publicRepository: true, manual: true, repository: 'nguyentronglinh045/pos-cafe-ci-preflight',
  cpus: 4, memoryBytes: 16 * 1024 ** 3, cgroup: `/system.slice/${identity.unit}/supervisor`,
  cpuMax: '300000 100000', memoryMax: String(10 * 1024 ** 3), swapMax: '0', pidsMax: '2048',
  runtime: '30min', stop: '30s', kill: 'control-group', stdout: 'null', stderr: 'null',
  oom: 0, pidsEvents: 0, hostFreeBytes: 60 * 1024 ** 3 });

test('exact npm lock tarballs include all platforms and reject credential/network/integrity escape', () => {
  const lock = json('../package-lock.json');
  const plan = ci1NpmIntake(lock);
  assert.equal(plan.length, 378);
  assert.ok(plan.some(item => item.url.includes('fsevents')));
  assert.ok(plan.every(item => item.maxBytes === CI1_SETUP.npmTarBytes));
  for (const value of ['http://registry.npmjs.org/a.tgz', 'https://example.test/a.tgz',
    'https://SECRET@registry.npmjs.org/a.tgz', 'https://registry.npmjs.org/a.tgz?token=FAKE_UNIT_SECRET']) {
    assert.throws(() => ci1RegistryTarball(value), { message: 'CI1_INTAKE_REFUSED' });
  }
  const path = Object.keys(lock.packages).find(value => value);
  for (const update of [{ integrity: 'sha512-wrong' }, { integrity: lock.packages[path].integrity + '\n' },
    { version: lock.packages[path].version + '\n' }, { resolved: 'git+https://example.test/private' }, { link: true }]) {
    const invalid = structuredClone(lock); Object.assign(invalid.packages[path], update);
    assert.throws(() => ci1NpmIntake(invalid), { message: 'CI1_INTAKE_REFUSED' });
  }
});

test('tool pins require official exact version, size and SHA; image references stay in pinned public registry', () => {
  const tools = json('../tests/permissions/runtime/ci1-tools.json');
  assert.equal(ci1ToolsIntake(tools).length, 2);
  for (const mutate of [value => { value.npmVersion = '12.0.0'; }, value => { value.tools[0].bytes = 0; },
    value => { value.tools[1].url = 'https://example.test/cli.tgz'; }, value => { value.tools[0].sha256 = 'FAKE_UNIT_SECRET'; }]) {
    const value = structuredClone(tools); mutate(value); assert.throws(() => ci1ToolsIntake(value));
  }
  const images = json('../tests/permissions/runtime/ci1-images.json');
  assert.equal(ci1ImagesIntake(images).length, 12);
  const bad = structuredClone(images); bad.images[1].ref = 'private.example.test/image:latest';
  assert.throws(() => ci1ImagesIntake(bad));
  const duplicate = structuredClone(images); duplicate.images[1] = duplicate.images[0];
  assert.throws(() => ci1ImagesIntake(duplicate));
});

test('archive inspection refuses traversal, devices, hardlinks and excessive expanded bytes before extraction', () => {
  const file = '-rwxr-xr-x 0/0 100 2026-05-21 00:00 node-v24.16.0-linux-x64/bin/node';
  const link = 'lrwxrwxrwx 0/0 0 2026-05-21 00:00 node-v24.16.0-linux-x64/bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js';
  assert.deepEqual(ci1CheckTarListing(file + '\n' + link, 'node'), { entries: 2, unpackedBytes: 100 });
  for (const value of [file.replace('bin/node', '../escape'), file.replace('node-v24.16.0-linux-x64', '/host'),
    file.replace('100 ', String(CI1_SETUP.unpackBytes + 1) + ' '), file.replace('-rwx', 'brwx'),
    link.replace('../lib/node_modules/npm/bin/npm-cli.js', '../../../host'), link.replace('lrwx', 'hrwx')]) {
    assert.throws(() => ci1CheckTarListing(value, 'node'), { message: 'CI1_INTAKE_REFUSED' });
  }
  assert.throws(() => ci1CheckTarListing(file, 'supabase'));
});

test('pinned Supabase two-binary archive requires both colocated regular files and rejects extra or duplicate entries', () => {
  const file='-rwxr-xr-x 1001/1001 95393248 2026-09-07 16:40 supabase';
  const companion='-rwxr-xr-x 1001/1001 40521890 2026-09-07 16:40 supabase-go';
  assert.deepEqual(ci1CheckTarListing(file+'\n'+companion,'supabase'),{entries:2,unpackedBytes:135915138});
  for(const value of [file,file+'\n'+file,file+'\n'+companion.replace('supabase-go','../supabase-go'),
    file+'\n'+companion.replace('supabase-go','unknown'),file+'\n'+companion.replace('-rwx','lrwx')])
    assert.throws(()=>ci1CheckTarListing(value,'supabase'));
});

test('npm named roots are bound to the exact @types tarball and reject mixed roots, links and traversal', () => {
  const record = root => `-rw-r--r-- 1001/1001 100 2026-10-01 00:00 ${root}/index.d.ts`;
  const node = 'https://registry.npmjs.org/@types/node/-/node-25.9.3.tgz';
  const react = 'https://registry.npmjs.org/@types/react/-/react-18.3.31.tgz';
  for (const root of ['node', 'node v25.9', 'package'])
    assert.deepEqual(ci1CheckTarListing(record(root), 'npm', node), { entries: 1, unpackedBytes: 100 });
  assert.deepEqual(ci1CheckTarListing(record('react v18.3'), 'npm', react), { entries: 1, unpackedBytes: 100 });
  for (const [text, url] of [[record('node'), null], [record('node'), react],
    [record('node'), node.replace('@types', '@other')], [record('node v25.8'), node],
    [record('node')+'\n'+record('package'), node], [record('node/..'), node],
    [record('/node'), node], [record('node').replace('-rw-', 'hrw-'), node],
    [record('node').replace('-rw-', 'lrw-')+' -> ../escape', node],
    [record('node').replace('100 ', String(CI1_SETUP.unpackBytes + 1)+' '), node],
    [record('node'), node.replace('registry.npmjs.org', 'example.test')]])
    assert.throws(() => ci1CheckTarListing(text, 'npm', url), { message: 'CI1_INTAKE_REFUSED' });
});

test('supervisor proof refuses missing/lax hardware, public-runner, logging and reserve facts', () => {
  assert.equal(assertCi1Supervisor(unitSupervisor(), identity), true);
  for (const [key, value] of Object.entries({ platform: 'win32', root: false, wsl: true, authorized: false,
    githubHosted: false, publicRepository: false, manual: false, repository: 'other/project', cpus: 32,
    memoryBytes: 8 * 1024 ** 3, cgroup: `/system.slice/${identity.unit}`, cpuMax: 'max 100000',
    memoryMax: 'max', swapMax: '1', pidsMax: 'max', runtime: 'infinity', stop: '90s', kill: 'process',
    stdout: 'journal', stderr: 'inherit', oom: 1, pidsEvents: 1, hostFreeBytes: 29 * 1024 ** 3 })) {
    assert.throws(() => assertCi1Supervisor({ ...unitSupervisor(), [key]: value }, identity), { message: 'CI1_INTAKE_REFUSED' });
  }
  const layout = ci1WorkerLayout('12345', 1);
  assert.ok(layout.task.startsWith('/var/lib/')); // visible across systemd PrivateTmp
  assert.equal(layout.edgeVolume, 'supabase_edge_runtime_pos-cafe-perm-s31-t04-20261013');
});

test('Edge metadata pins are a separate closure from application npm lock and reject malformed/duplicate packages', () => {
  const edge = json('../tests/permissions/runtime/ci1-edge.json');
  assert.equal(ci1EdgeIntake(edge).length, 18);
  assert.ok(edge.packages.some(item => item.name === '@supabase/supabase-js' && item.version === '2.45.0'));
  const duplicate = structuredClone(edge); duplicate.packages.push(duplicate.packages[0]);
  assert.throws(() => ci1EdgeIntake(duplicate));
  const wrong = structuredClone(edge); wrong.packages[0].integrity = 'FAKE_UNIT_SECRET';
  assert.throws(() => ci1EdgeIntake(wrong), { message: 'CI1_INTAKE_REFUSED' });
});
