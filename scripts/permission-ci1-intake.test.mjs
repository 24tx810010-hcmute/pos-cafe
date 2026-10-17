import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ci1Identity } from './permission-ci1-policy.mjs';
import { CI1_SETUP, ci1NpmIntake, ci1RegistryTarball, ci1ToolsIntake, ci1EdgeIntake,
  ci1ImagesIntake, ci1PinnedImageProof, ci1CheckTarListing, assertCi1Supervisor, ci1WorkerLayout } from './permission-ci1-intake.mjs';

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

test('runtime image proof accepts only exact pinned ECR or official GHCR repository digests', () => {
  for(const pin of ci1ImagesIntake(json('../tests/permissions/runtime/ci1-images.json'))){
    const repository=pin.ref.slice(0,pin.ref.lastIndexOf(':')),container={image:pin.ref,imageId:pin.configDigest};
    for(const repo of [repository,repository.replace('public.ecr.aws/','ghcr.io/')])
      for(const digest of [pin.indexDigest,pin.manifestDigest]){
        const image={Os:'linux',Architecture:'amd64',Id:pin.configDigest,RepoDigests:[`${repo}@${digest}`]};
        assert.equal(ci1PinnedImageProof(pin,container,image),true);
      }
  }
});
test('real fixture image verifier wires all twelve canonical containers to mirror-aware content proof', () => {
  const manifest=json('../tests/permissions/runtime/ci1-images.json');
  const source=readFileSync(new URL('./permission-ci1-fixture.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const start=source.indexOf('export function verifyCi1ImagePins() {'),end=source.indexOf('\nasync function storageRequest',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end).replace('export function','function')+'\nverifyCi1ImagePins();';
  for(const mirror of [false,true]){
    const proof={containers:manifest.images.map(pin=>({image:pin.ref,imageId:pin.configDigest}))};
    let inspected=0;
    const result=runInNewContext(body,{
      readFileSync:path=>{assert.equal(path,'tests/permissions/runtime/ci1-images.json');return JSON.stringify(manifest);},
      runtime:{runtimeProof:()=>proof},ci1ImagesIntake,ci1PinnedImageProof,
      execFileSync:(command,args)=>{
        assert.equal(command,'docker');assert.equal(args[0],'image');assert.equal(args[1],'inspect');
        const pin=manifest.images.find(value=>value.ref===args[2]);assert.ok(pin);inspected++;
        const repository=pin.ref.slice(0,pin.ref.lastIndexOf(':')).replace('public.ecr.aws/',mirror?'ghcr.io/':'public.ecr.aws/');
        return JSON.stringify([{Os:'linux',Architecture:'amd64',Id:pin.configDigest,RepoDigests:[`${repository}@${pin.manifestDigest}`]}]);
      },
      refuse:()=>{throw new Error('CI1_FIXTURE_REFUSED');},
    },{timeout:1000});
    assert.equal(result,proof);assert.equal(inspected,12);
  }
});
test('runtime image proof rejects registry, platform, config and manifest substitution', () => {
  const pin=ci1ImagesIntake(json('../tests/permissions/runtime/ci1-images.json'))[0],repository=pin.ref.slice(0,pin.ref.lastIndexOf(':'));
  const container={image:pin.ref,imageId:pin.configDigest},image={Os:'linux',Architecture:'amd64',Id:pin.configDigest,RepoDigests:[`${repository}@${pin.manifestDigest}`]};
  for(const bad of [undefined,{...pin,ref:'ghcr.io/supabase/postgres:latest'},{...pin,configDigest:'PRIVATE_SECRET'}])
    assert.throws(()=>ci1PinnedImageProof(bad,container,image),e=>e.ci1ImageProofOrdinal===1&&!e.message.includes('PRIVATE_SECRET'));
  assert.throws(()=>ci1PinnedImageProof(pin,{...container,image:pin.ref.replace('public.ecr.aws','ghcr.io')},image),e=>e.ci1ImageProofOrdinal===1);
  for(const update of [{Os:'windows'},{Architecture:'arm64'}])assert.throws(()=>ci1PinnedImageProof(pin,container,{...image,...update}),e=>e.ci1ImageProofOrdinal===2);
  for(const digest of [pin.indexDigest,pin.manifestDigest,'sha256:'+'0'.repeat(64)]){
    assert.throws(()=>ci1PinnedImageProof(pin,container,{...image,Id:digest}),e=>e.ci1ImageProofOrdinal===3);
    assert.throws(()=>ci1PinnedImageProof(pin,{...container,imageId:digest},image),e=>e.ci1ImageProofOrdinal===3);
  }
  for(const digests of [undefined,{},[],[`${repository}:latest`],[`${repository}@${pin.configDigest}`],
    [`ghcr.io/other/postgres@${pin.manifestDigest}`],[`private.example.test/supabase/postgres@${pin.manifestDigest}`],
    [`${repository}@sha256:${'0'.repeat(64)}`]])
    assert.throws(()=>ci1PinnedImageProof(pin,container,{...image,RepoDigests:digests}),e=>e.ci1ImageProofOrdinal===4);
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
  assert.equal(ci1EdgeIntake(edge).length, 20);
  for (const [name, version] of [['@types/node', '22.5.4'], ['undici-types', '6.19.8'], ['@types/node', '26.6.5']])
    assert.ok(edge.packages.some(item => item.name === name && item.version === version));
  assert.ok(edge.packages.some(item => item.name === '@supabase/supabase-js' && item.version === '2.45.0'));
  const duplicate = structuredClone(edge); duplicate.packages.push(duplicate.packages[0]);
  assert.throws(() => ci1EdgeIntake(duplicate));
  const wrong = structuredClone(edge); wrong.packages[0].integrity = 'FAKE_UNIT_SECRET';
  assert.throws(() => ci1EdgeIntake(wrong), { message: 'CI1_INTAKE_REFUSED' });
  for (const list of [['@supabase/supabase-js@2.45.0'], ['bufferutil@4.1.0', 'bufferutil@4.1.0'], ['bufferutil@4.2.0']])
    assert.throws(() => ci1EdgeIntake({ ...edge, metadataOnlyAllowed: list }));
});
