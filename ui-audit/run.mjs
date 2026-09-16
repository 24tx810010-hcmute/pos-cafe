#!/usr/bin/env node
/**
 * UI Audit runner (pos-cafe flavour).
 *
 *   node ui-audit/run.mjs                    # audit every configured target
 *   node ui-audit/run.mjs --update           # accept current findings as the baseline
 *   node ui-audit/run.mjs --state floor      # audit a single named state
 *   node ui-audit/run.mjs --route /          # audit a single URL route
 *   node ui-audit/run.mjs --viewport tablet  # audit a single viewport
 *   node ui-audit/run.mjs --selftest         # verify the harness against demo-buggy.html
 *   node ui-audit/run.mjs --list             # print configured targets and exit
 *
 * Config:  ui-audit/config.json
 * Output:  ui-audit/report.json, ui-audit/report.md, ui-audit/out/*.png
 * Exit code 1 when a blocking finding appears that is not in ui-audit/baseline.json.
 *
 * pos-cafe has no URL router: the whole app is one page driven by zustand state,
 * so a "target" is usually a named *state* reached by a short list of steps,
 * not a URL. See `states` in config.json and README.md.
 */
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const auditSrc = fs.readFileSync(path.join(here, 'audit.js'), 'utf8');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

const UPDATE = flag('--update');
const SELFTEST = flag('--selftest');
const LIST = flag('--list');
const ONLY_STATE = value('--state');
const ONLY_ROUTE = value('--route');
const ONLY_VIEWPORT = value('--viewport');

const cfg = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const outDir = path.join(here, 'out');
const baselinePath = path.join(here, 'baseline.json');

// ---------------------------------------------------------------- selectors
// "@foo" is shorthand for [data-testid="foo"]; anything else is raw CSS.
const sel = (s) => (s.startsWith('@') ? `[data-testid="${s.slice(1)}"]` : s);

// ---------------------------------------------------------------- targets
/** Flatten `routes` (URL based) and `states` (step driven) into one list. */
function buildTargets(conf) {
  const byName = new Map((conf.states || []).map((s) => [s.name, s]));
  const resolveSteps = (state, seen = new Set()) => {
    if (seen.has(state.name)) throw new Error(`state "${state.name}" extends itself`);
    seen.add(state.name);
    const parent = state.extends ? byName.get(state.extends) : null;
    if (state.extends && !parent) throw new Error(`state "${state.name}" extends unknown "${state.extends}"`);
    return [...(parent ? resolveSteps(parent, seen) : []), ...(state.steps || [])];
  };

  const targets = [];
  for (const route of conf.routes || []) {
    targets.push({ name: route, kind: 'route', route, steps: [], describe: '' });
  }
  for (const state of conf.states || []) {
    if (state.skip) continue;
    targets.push({
      name: state.name,
      kind: 'state',
      route: state.route || (conf.routes && conf.routes[0]) || '/',
      steps: resolveSteps(state),
      describe: state.describe || '',
    });
  }
  return targets;
}

// ---------------------------------------------------------------- dev server
async function reachable(url, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetch(url, { signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function startDevServer(conf) {
  const ds = conf.devServer;
  if (!ds || !ds.command) return null;
  if (await reachable(conf.baseUrl)) {
    console.log(`dev server already up at ${conf.baseUrl}`);
    return null;
  }
  console.log(`starting dev server: ${ds.command}`);
  const child = spawn(ds.command, {
    shell: true,
    cwd: path.resolve(here, '..'),
    env: { ...process.env, ...(ds.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', // own process group, so the tree can be signalled
  });
  const log = [];
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));

  const deadline = Date.now() + (ds.readyTimeoutMs || 90000);
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`dev server exited early:\n${log.join('').slice(-1200)}`);
    }
    if (await reachable(conf.baseUrl)) {
      console.log(`dev server ready at ${conf.baseUrl}`);
      return child;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server never became ready at ${conf.baseUrl}:\n${log.join('').slice(-1200)}`);
}

function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  // Vite runs as a child of npm, so the whole process tree has to go.
  // spawnSync, not spawn: process.exit() further down would kill an async
  // taskkill before it ran and leave the dev server listening.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

// ---------------------------------------------------------------- steps
async function runSteps(page, steps) {
  for (const step of steps) {
    if (step.click) {
      await page.locator(sel(step.click)).first().click({ timeout: step.timeout || 15000 });
    } else if (step.fill) {
      await page.locator(sel(step.fill)).first().fill(String(step.value ?? ''), { timeout: step.timeout || 15000 });
    } else if (step.press) {
      await page.keyboard.press(step.press);
    } else if (step.waitFor) {
      await page
        .locator(sel(step.waitFor))
        .first()
        .waitFor({ state: step.state || 'visible', timeout: step.timeout || 20000 });
    } else if (step.wait) {
      await page.waitForTimeout(step.wait);
    } else if (step.clickAll) {
      // one click per listed selector, in order (PIN pads, quantity steppers)
      for (const s of step.clickAll) {
        await page.locator(sel(s)).first().click({ timeout: step.timeout || 15000 });
      }
    } else {
      throw new Error(`unknown step: ${JSON.stringify(step)}`);
    }
  }
}

// ---------------------------------------------------------------- findings
// Selectors of repeated rows differ only by :nth-of-type(N). Collapsing them
// keeps one menu item's defect from producing forty baseline entries, and keeps
// the baseline stable when the seed data changes.
// React `useId` ids (MUI inputs) change between renders, so they are normalised
// too or the baseline would churn on every unrelated re-render.
const normalizeSel = (s) =>
  s.replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(n)').replace(/#:r[0-9a-z]*:/gi, '#:r:');

const keyOf = (f, target, vp, collapse) =>
  [target.name, vp.name, f.rule, collapse ? normalizeSel(f.sel) : f.sel].join(' :: ');

function collapseFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    const g = groups.get(f.key);
    if (!g) {
      groups.set(f.key, { ...f, count: 1, examples: [f.sel] });
    } else {
      g.count += 1;
      if (g.examples.length < 3 && !g.examples.includes(f.sel)) g.examples.push(f.sel);
    }
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------- reporting
const SEV_ORDER = { error: 0, warn: 1, info: 2 };

function tally(findings, field) {
  const m = new Map();
  for (const f of findings) m.set(f[field], (m.get(f[field]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function writeMarkdown(all, targets, viewports) {
  const fresh = all.filter((f) => !f.known);
  const lines = [];
  lines.push('# UI audit report', '');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`targets: ${targets.length} x viewports: ${viewports.length}`);
  lines.push(`findings: ${all.length} total, ${fresh.length} not in baseline`, '');

  lines.push('## By severity', '');
  lines.push('| severity | total | new |');
  lines.push('| --- | ---: | ---: |');
  for (const [s] of tally(all, 'severity')) {
    lines.push(
      `| ${s} | ${all.filter((f) => f.severity === s).length} | ${fresh.filter((f) => f.severity === s).length} |`,
    );
  }
  lines.push('');

  lines.push('## By rule', '');
  lines.push('| rule | severity | total | new |');
  lines.push('| --- | --- | ---: | ---: |');
  for (const [rule, n] of tally(all, 'rule')) {
    const sev = all.find((f) => f.rule === rule).severity;
    lines.push(`| \`${rule}\` | ${sev} | ${n} | ${fresh.filter((f) => f.rule === rule).length} |`);
  }
  lines.push('');

  lines.push('## By target', '');
  lines.push('| target | viewport | total | new |');
  lines.push('| --- | --- | ---: | ---: |');
  for (const t of targets) {
    for (const vp of viewports) {
      const scope = all.filter((f) => f.target === t.name && f.viewport === vp.name);
      if (!scope.length) continue;
      lines.push(`| ${t.name} | ${vp.name} | ${scope.length} | ${scope.filter((f) => !f.known).length} |`);
    }
  }
  lines.push('');

  lines.push('## Findings', '');
  const sorted = [...all].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.rule.localeCompare(b.rule),
  );
  for (const f of sorted) {
    const n = f.count > 1 ? ` x${f.count}` : '';
    lines.push(`### \`${f.rule}\` (${f.severity})${f.known ? ' - baseline' : ''}${n}`);
    lines.push(`- target: **${f.target}** / ${f.viewport}`);
    lines.push(`- selector: \`${f.sel}\``);
    lines.push(`- detail: ${f.detail}`);
    if (f.label) lines.push(`- text: "${f.label}"`);
    if (f.rect) lines.push(`- rect: ${f.rect.w}x${f.rect.h} at (${f.rect.x}, ${f.rect.y})`);
    lines.push('');
  }
  fs.writeFileSync(path.join(here, 'report.md'), lines.join('\n'));
}

// ---------------------------------------------------------------- selftest
// demo-buggy.html carries nine deliberate defects. If the harness stops seeing
// them the harness is broken, and every clean run against the real app is a lie.
const SELFTEST_REQUIRED = [
  'hit-blocked',
  'empty-icon',
  'placeholder-leak',
  'bad-inline-style',
  'tiny-target',
  'overflow-x',
  'no-accessible-name',
  'broken-image',
  'low-contrast',
  'tiny-font',
  'clipped-text',
  'bad-class-token',
  'zero-size-interactive',
  'overlapping-controls',
];
const SELFTEST_MIN = 18;
const SELFTEST_MAX = 30;

async function selftest() {
  const file = pathToFileURL(path.join(here, 'demo-buggy.html')).toString();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await ctx.addInitScript({ content: auditSrc });
  const page = await ctx.newPage();
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const findings = await page.evaluate(() => window.__uiAudit());
  await browser.close();

  const rules = new Set(findings.map((f) => f.rule));
  const missing = SELFTEST_REQUIRED.filter((r) => !rules.has(r));

  console.log(`selftest: ${findings.length} finding(s) on demo-buggy.html`);
  console.log(`  severity: ${tally(findings, 'severity').map(([k, v]) => `${k}=${v}`).join(' ')}`);
  for (const [rule, n] of tally(findings, 'rule')) console.log(`  ${rule.padEnd(24)} ${n}`);

  let ok = true;
  if (missing.length) {
    ok = false;
    console.log(`\nFAIL missing rule(s): ${missing.join(', ')}`);
  }
  if (findings.length < SELFTEST_MIN || findings.length > SELFTEST_MAX) {
    ok = false;
    console.log(`\nFAIL finding count ${findings.length} outside expected ${SELFTEST_MIN}..${SELFTEST_MAX}`);
  }
  console.log(
    ok
      ? '\nselftest OK - harness detects every seeded defect class'
      : '\nselftest FAILED - fix the harness before trusting any app result',
  );
  process.exit(ok ? 0 : 1);
}

if (SELFTEST) await selftest();

// ---------------------------------------------------------------- main
const targets = buildTargets(cfg).filter(
  (t) =>
    (!ONLY_STATE || (t.kind === 'state' && t.name === ONLY_STATE)) &&
    (!ONLY_ROUTE || (t.kind === 'route' && t.route === ONLY_ROUTE)),
);
const viewports = (cfg.viewports || [{ name: 'desktop', width: 1440, height: 900 }]).filter(
  (v) => !ONLY_VIEWPORT || v.name === ONLY_VIEWPORT,
);

if (LIST) {
  console.log('targets:');
  for (const t of targets) console.log(`  ${t.kind.padEnd(6)} ${t.name.padEnd(24)} ${t.describe}`);
  console.log('viewports:');
  for (const v of viewports) console.log(`  ${v.name.padEnd(10)} ${v.width}x${v.height}`);
  process.exit(0);
}
if (!targets.length) {
  console.error('no targets matched. try: node ui-audit/run.mjs --list');
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
const baseline = fs.existsSync(baselinePath)
  ? new Set(JSON.parse(fs.readFileSync(baselinePath, 'utf8')))
  : new Set();
const collapse = cfg.collapse !== false;
const failOn = new Set(cfg.failOn || ['error']);
const severityOverride = cfg.severityOverride || {};

let devServer = null;
let exitCode = 0;
const all = [];

try {
  devServer = await startDevServer(cfg);

  const browser = await chromium.launch();
  const ctxOpts = {};
  if (cfg.storageState && fs.existsSync(path.join(here, cfg.storageState))) {
    ctxOpts.storageState = path.join(here, cfg.storageState);
  }

  for (const vp of viewports) {
    for (const target of targets) {
      // A fresh context per target: pos-cafe persists store pairing and session
      // in localStorage, so a reused context would skip the landing screen and
      // make every target after the first one order-dependent.
      const ctx = await browser.newContext({
        ...ctxOpts,
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      // audit.js is installed before any page script, so it survives client-side
      // navigation and stays callable at any point in a state's step sequence.
      await ctx.addInitScript({ content: auditSrc });
      const page = await ctx.newPage();

      const url = new URL(target.route, cfg.baseUrl).toString();
      let stepError = null;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: cfg.timeout || 30000 });
      } catch {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      if (cfg.waitFor) await page.waitForSelector(sel(cfg.waitFor), { timeout: 10000 }).catch(() => {});

      try {
        await runSteps(page, target.steps);
      } catch (err) {
        stepError = String(err.message).split('\n')[0];
      }

      await page.waitForTimeout(cfg.settleMs ?? 400); // let animations finish
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});

      if (stepError) {
        console.log(`SKIP  ${vp.name.padEnd(8)} ${target.name.padEnd(24)} steps failed: ${stepError}`);
        exitCode = Math.max(exitCode, 2);
        await ctx.close();
        continue;
      }

      const raw = await page.evaluate((o) => window.__uiAudit(o), {
        minTarget: cfg.minTarget ?? 24,
        minFont: cfg.minFont ?? 10,
        contrastMin: cfg.contrastMin ?? 4.5,
        checkContrast: cfg.checkContrast !== false,
        ignore: cfg.ignore || '',
      });

      // null unless a drawer/modal was up, in which case only that layer was audited
      const scope = await page.evaluate(() => window.__uiAuditScope || null);

      for (const f of raw) {
        if (severityOverride[f.rule]) f.severity = severityOverride[f.rule];
        f.scope = scope;
        f.target = target.name;
        f.route = target.route;
        f.viewport = vp.name;
        f.key = keyOf(f, target, vp, collapse);
      }
      const grouped = collapse ? collapseFindings(raw) : raw.map((f) => ({ ...f, count: 1, examples: [f.sel] }));
      for (const f of grouped) {
        f.known = baseline.has(f.key);
        all.push(f);
      }

      const fresh = grouped.filter((f) => !f.known);
      if (fresh.length) {
        await page.evaluate((fs2) => window.__uiAuditMark(fs2), fresh);
        const name = target.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'root';
        await page.screenshot({ path: path.join(outDir, `${name}__${vp.name}.png`), fullPage: true });
      }

      const bad = fresh.filter((f) => failOn.has(f.severity)).length;
      console.log(
        `${bad ? 'FAIL' : ' ok '}  ${vp.name.padEnd(8)} ${target.name.padEnd(24)} ` +
          `${grouped.length} finding(s), ${fresh.length} new` +
          (scope ? `  [scoped to top layer ${scope}]` : ''),
      );
      await ctx.close();
    }
  }
  await browser.close();
} finally {
  stopDevServer(devServer);
}

fs.writeFileSync(path.join(here, 'report.json'), JSON.stringify(all, null, 2));
writeMarkdown(all, targets, viewports);

console.log('');
console.log(`total ${all.length} finding(s): ${tally(all, 'severity').map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`);
for (const [rule, n] of tally(all, 'rule')) console.log(`  ${rule.padEnd(24)} ${n}`);
console.log('\nreport: ui-audit/report.md, ui-audit/report.json');

if (UPDATE) {
  const keys = [...new Set(all.map((f) => f.key))].sort();
  fs.writeFileSync(baselinePath, JSON.stringify(keys, null, 2));
  console.log(`baseline updated: ${keys.length} accepted finding(s)`);
  process.exit(0);
}

const blocking = all.filter((f) => !f.known && failOn.has(f.severity));
if (blocking.length) {
  console.log(`\n${blocking.length} new ${[...failOn].join('/')} finding(s):\n`);
  for (const f of blocking) {
    console.log(`  ${f.target} [${f.viewport}] ${f.rule}${f.count > 1 ? ` x${f.count}` : ''}`);
    console.log(`    ${f.sel}`);
    console.log(`    ${f.detail}${f.label ? `  ("${f.label}")` : ''}`);
  }
  console.log(`\nannotated screenshots: ${path.relative(process.cwd(), outDir)}`);
  console.log('accept them all with: node ui-audit/run.mjs --update');
  process.exit(1);
}
console.log('\nno new UI anomalies');
process.exit(exitCode);
