import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function stopLightUnit(adapter) {
  const stopped = adapter.stop(), state = adapter.state();
  const collected = state.load === 'not-found' && state.active === 'inactive';
  if (!collected && (stopped.status !== 0 || stopped.error || !['inactive', 'failed'].includes(state.active)
    || state.load !== 'loaded')) throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');
  const populated = adapter.populated();
  if (populated !== 0 && populated !== null) throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');
}

export function withLightCorePattern(adapter, action) {
  const previous = adapter.read();
  if (typeof previous !== 'string' || previous.length < 1 || previous.length > 4096
    || previous.includes('\0') || /[\r\n]/.test(previous.replace(/\n$/, ''))) throw new Error('PROJECT_CI_CORE_PATTERN_INVALID');
  // Only used on one disposable GitHub-hosted VM. Piped core handlers ignore
  // RLIMIT_CORE; temporarily use the regular-file mechanism with hard/soft 0.
  // systemd-run --wait returns after KillMode=control-group has stopped children.
  try {
    adapter.write('core\n');
    if (adapter.read() !== 'core\n') throw new Error('PROJECT_CI_CORE_PATTERN_INVALID');
    return action();
  } finally {
    adapter.beforeRestore?.();
    adapter.write(previous);
    if (adapter.read() !== previous) throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');
  }
}

export function coreDumpDisabled(limits, pattern) {
  const match = /^Max core file size\s+(\S+)\s+(\S+)\s+bytes\s*$/m.exec(limits);
  return match?.[1] === '0' && match[2] === '0' && pattern === 'core\n';
}

export function linuxCorePatternAdapter(unit) {
  if (typeof unit !== 'string' || /[\r\n\0]/.test(unit)
    || !/^pos-cafe-(?:light|ci1)-r[1-9][0-9]{0,19}-a[1-9][0-9]{0,3}\.service$/.test(unit)) throw new Error('PROJECT_CI_LAUNCH_INVALID');
  const path = '/proc/sys/kernel/core_pattern', cgroup = `/sys/fs/cgroup/system.slice/${unit}`;
  return { read: () => readFileSync(path, 'utf8'), write: input => {
      const write = spawnSync('/usr/bin/sudo', ['--', '/usr/bin/tee', path],
        { input, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 });
      if (write.status !== 0) throw new Error('PROJECT_CI_CORE_PATTERN_INVALID');
    }, beforeRestore: () => {
      // Even a disconnected/timed-out systemd-run client must not restore the
      // piped handler while an owned browser descendant can still crash.
      stopLightUnit({
        stop: () => spawnSync('/usr/bin/sudo', ['--', '/usr/bin/systemctl', 'stop', unit], { stdio: 'ignore', timeout: 20000 }),
        state: () => {
          const show = spawnSync('/usr/bin/systemctl', ['show', unit, '--property=LoadState', '--property=ActiveState'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 4096 });
          const values = Object.fromEntries((show.stdout ?? '').trim().split('\n').map(line => line.split('=')));
          if (show.error || (show.status !== 0 && !(values.LoadState === 'not-found' && values.ActiveState === 'inactive'))
            || Object.keys(values).sort().join(',') !== 'ActiveState,LoadState') throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');
          return { load: values.LoadState, active: values.ActiveState };
        },
        populated: () => {
          try {
            const value = /^populated ([01])$/m.exec(readFileSync(`${cgroup}/cgroup.events`, 'utf8'));
            if (!value) throw new Error('PROJECT_CI_CORE_PATTERN_RESTORE_FAILED');
            return Number(value[1]);
          } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        },
      });
    } };
}

export function lightOwnerMatches(uid, owner) {
  return Number.isSafeInteger(uid) && uid > 0 && uid <= 2147483647 && uid === owner;
}
export function lightService(env, node, root, uid) {
  if (!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
    || env.GITHUB_REPOSITORY !== 'nguyentronglinh045/pos-cafe' || env.GITHUB_REPOSITORY_ID !== '1263057386' || env.GITHUB_ACTIONS !== 'true'
    || env.RUNNER_ENVIRONMENT !== 'github-hosted' || !node.startsWith('/') || !root.startsWith('/')
    || !lightOwnerMatches(uid, uid)) throw new Error('PROJECT_CI_LAUNCH_INVALID');
  const unit = `pos-cafe-light-r${env.GITHUB_RUN_ID}-a${env.GITHUB_RUN_ATTEMPT}.service`;
  const names = ['PATH', 'LANG', 'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH',
    'GITHUB_SHA', 'GITHUB_WORKFLOW_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_STEP_SUMMARY', 'RUNNER_TEMP', 'RUNNER_ENVIRONMENT'];
  const args = ['systemd-run', '--quiet', '--wait', '--pipe', '--collect', `--unit=${unit}`, `--working-directory=${root}`,
    `--property=User=${uid}`,
    '--property=CPUQuota=300%', '--property=MemoryMax=8G', '--property=MemorySwapMax=0', '--property=TasksMax=1024',
    '--property=RuntimeMaxSec=25min', '--property=TimeoutStopSec=10s', '--property=KillMode=control-group', '--property=LimitCORE=0',
    ...names.filter(name => env[name]).map(name => `--setenv=${name}=${env[name]}`), node, resolve(root, 'scripts/project-ci.mjs')];
  if (args.some(arg => /[\r\n\0]/.test(arg))) throw new Error('PROJECT_CI_LAUNCH_INVALID');
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.platform !== 'linux') throw new Error();
    const uid = process.getuid();
    if (!lightOwnerMatches(uid, statSync(process.cwd()).uid)) throw new Error();
    const args = lightService(process.env, process.execPath, process.cwd(), uid);
    const unit = `pos-cafe-light-r${process.env.GITHUB_RUN_ID}-a${process.env.GITHUB_RUN_ATTEMPT}.service`;
    const result = withLightCorePattern(linuxCorePatternAdapter(unit), () => spawnSync('sudo', ['--', ...args], { stdio: 'inherit', timeout: 1560000 }));
    console.log('PROJECT_CI_CORE_PATTERN_RESTORED');
    process.exitCode = result.status === 0 ? 0 : 1;
  } catch { console.log('PROJECT_CI_LAUNCH_BLOCKED'); process.exitCode = 1; }
}
