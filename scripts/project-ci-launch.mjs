import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function lightService(env, node, root) {
  if (!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
    || env.GITHUB_REPOSITORY !== 'nguyentronglinh045/pos-cafe' || env.GITHUB_REPOSITORY_ID !== '1263057386' || env.GITHUB_ACTIONS !== 'true'
    || env.RUNNER_ENVIRONMENT !== 'github-hosted' || !node.startsWith('/') || !root.startsWith('/')) throw new Error('PROJECT_CI_LAUNCH_INVALID');
  const unit = `pos-cafe-light-r${env.GITHUB_RUN_ID}-a${env.GITHUB_RUN_ATTEMPT}.service`;
  const names = ['PATH', 'LANG', 'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_EVENT_NAME', 'GITHUB_EVENT_PATH',
    'GITHUB_SHA', 'GITHUB_WORKFLOW_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_STEP_SUMMARY', 'RUNNER_TEMP', 'RUNNER_ENVIRONMENT'];
  const args = ['systemd-run', '--quiet', '--wait', '--pipe', '--collect', `--unit=${unit}`, `--working-directory=${root}`,
    '--property=CPUQuota=300%', '--property=MemoryMax=8G', '--property=MemorySwapMax=0', '--property=TasksMax=1024',
    '--property=RuntimeMaxSec=25min', '--property=TimeoutStopSec=10s', '--property=KillMode=control-group',
    ...names.filter(name => env[name]).map(name => `--setenv=${name}=${env[name]}`), node, resolve(root, 'scripts/project-ci.mjs')];
  if (args.some(arg => /[\r\n\0]/.test(arg))) throw new Error('PROJECT_CI_LAUNCH_INVALID');
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.platform !== 'linux') throw new Error();
    const result = spawnSync('sudo', ['--', ...lightService(process.env, process.execPath, process.cwd())], { stdio: 'inherit', timeout: 1560000 });
    process.exitCode = result.status === 0 ? 0 : 1;
  } catch { console.log('PROJECT_CI_LAUNCH_BLOCKED'); process.exitCode = 1; }
}
