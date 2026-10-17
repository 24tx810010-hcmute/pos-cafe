import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { EMPLOYEE_IDS, STORE_IDS, runtimeProof } from '../../scripts/permission-identity-runtime.mjs';
import { assertActivatedCandidate, candidateEnvironment, installStoreSession, refreshStoreSession } from './permissionCandidateEnvironment';

type TimingProbe = {
  blockSignals: boolean;
  subscriptions: number;
  resumes: { time: number; event: string }[];
  signals: { time: number; table: string; revision: number; targetId: string | null; dropped: boolean }[];
  nav: { time: number; present: boolean }[];
  requests: { name: string; start: number; end: number; ok: boolean }[];
};
declare global { interface Window { permissionTimingProbe: TimingProbe } }

async function probe(page: Page) {
  await page.addInitScript(() => {
    const state: TimingProbe = { blockSignals: false, subscriptions: 0, resumes: [], signals: [], nav: [], requests: [] };
    window.permissionTimingProbe = state;
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', event => {
          if (typeof event.data !== 'string') return;
          let message;
          try { message = JSON.parse(event.data); } catch { return; }
          const name = Array.isArray(message) ? message[3] : message.event;
          const payload = Array.isArray(message) ? message[4] : message.payload;
          if (name === 'phx_reply' && payload?.status === 'ok' && Array.isArray(payload.response?.postgres_changes)) {
            if (state.subscriptions > 0) state.resumes.push({ time: performance.now(), event: 'realtime-rejoin' });
            state.subscriptions++;
          }
          const data = payload?.data, row = data?.record;
          if (name !== 'postgres_changes' || !row || !['store_change_signals', 'permission_catalog_signals'].includes(data.table)) return;
          if (data.table === 'store_change_signals' && row.topic !== 'permission') return;
          state.signals.push({ time: performance.now(), table: data.table, revision: Number(row.revision), targetId: row.target_id ?? null, dropped: state.blockSignals });
          // Controlled transport loss, before the app listener receives this
          // event. HTTP remains online so the real foreground poll must repair.
          if (state.blockSignals) event.stopImmediatePropagation();
        });
      }
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      const name = /\/rpc\/(permission_get_revision|permission_get_authority)(?:\?|$)/.exec(url)?.[1];
      const start = performance.now();
      const response = await originalFetch(...args);
      if (name) {
        const originalText = response.text.bind(response), originalJson = response.json.bind(response);
        const finished = () => state.requests.push({ name, start, end: performance.now(), ok: response.ok });
        response.text = async () => { const body = await originalText(); finished(); return body; };
        response.json = async () => { const body = await originalJson(); finished(); return body; };
      }
      return response;
    };
    for (const event of ['focus', 'online']) window.addEventListener(event, () => state.resumes.push({ time: performance.now(), event }));
    document.addEventListener('visibilitychange', () => state.resumes.push({ time: performance.now(), event: `visibility:${document.visibilityState}` }));
    let previous: boolean | undefined;
    const observer = new MutationObserver(() => {
      const present = document.querySelector('[data-testid="nav-report"]') !== null;
      if (present !== previous) { previous = present; state.nav.push({ time: performance.now(), present }); }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

async function login(page: Page) {
  await probe(page); await installStoreSession(page); await page.goto('/');
  await expect(page.getByTestId(`employee-${EMPLOYEE_IDS[2]}`)).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(`employee-${EMPLOYEE_IDS[2]}`).click();
  for (const digit of '384729') await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId('unlock-button').click();
  await expect(page.getByTestId('floor-view')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  await expect.poll(() => page.evaluate(() => window.permissionTimingProbe.subscriptions), { timeout: 15_000 }).toBeGreaterThan(0);
}

test('TC-PERM-55 real Realtime twenty changes, catalog, reconnect and lost-signal fallback', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const env = candidateEnvironment(); runtimeProof();
  const db = new pg.Client({ connectionString: env.dsn, statement_timeout: 15_000 });
  const records: Record<string, unknown>[] = [], failures: string[] = [];
  const contexts = [await browser.newContext(), await browser.newContext()];
  const pages = [await contexts[0].newPage(), await contexts[1].newPage()];
  let savedOverrides: unknown, savedDefault = false, bound = false, connected = false;
  try {
    await db.connect(); connected = true;
    await assertActivatedCandidate(db, env);
    const marker = (await db.query('select marker,store_ids from private.idempotency_test_environment where singleton')).rows[0];
    expect(marker.marker).toBe(env.marker); expect(marker.store_ids).toEqual(STORE_IDS);
    const session = await refreshStoreSession(env);
    const response = await fetch(`${env.api}/rest/v1/rpc/permission_fixture_identity`, { method: 'POST', headers: {
      apikey: env.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'x-pos-permission-contract': '2',
    }, body: '{}', signal: AbortSignal.timeout(10_000) });
    expect(response.ok).toBe(true); expect(await response.json()).toMatchObject({ marker: env.marker, database: 'postgres', storeId: STORE_IDS[0] });
    const unmarked = await fetch(`${env.api}/rest/v1/rpc/permission_fixture_identity`, { method: 'POST', headers: {
      apikey: env.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json',
    }, body: '{}', signal: AbortSignal.timeout(10_000) });
    expect(unmarked.status).toBe(426);
    savedOverrides = (await db.query('select permission_overrides from public.employees where id=$1', [EMPLOYEE_IDS[2]])).rows[0].permission_overrides;
    savedDefault = (await db.query("select 1 from public.role_permission_defaults where role_code='cashier' and permission_code='report.view'")).rowCount === 1;
    bound = true;
    await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='report.view'");
    await db.query('update public.employees set permission_overrides=null where id=$1', [EMPLOYEE_IDS[2]]);
    await db.query('begin');
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' })]);
    const ownerSession = (await db.query('select public.permission_start_session($1,$2) result', [EMPLOYEE_IDS[0], '384729'])).rows[0].result;
    expect(ownerSession.ok).toBe(true);
    await db.query('commit');
    await Promise.all(pages.map(login));
    await Promise.all(pages.map(page => expect(page.getByTestId('nav-report')).toHaveCount(0)));

    // Commit time is bounded by client send/ack, not claimed as an exact server
    // timestamp. Both signal and DOM-apply timestamps use each browser's own
    // monotonic clock; fallback uses the conservative pre-commit lower bound.
    const change = async (present: boolean, catalog = false) => {
      const browserBefore = await Promise.all(pages.map(page => page.evaluate(() => performance.now())));
      const nodeBeforeCommit = performance.now();
      await db.query('begin');
      try {
        if (catalog) {
          if (present) await db.query("insert into public.role_permission_defaults(role_code,permission_code) values('cashier','report.view') on conflict do nothing");
          else await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='report.view'");
        } else {
          const employeeRevision = Number((await db.query('select permission_revision from public.employees where id=$1', [EMPLOYEE_IDS[2]])).rows[0].permission_revision);
          const catalogRevision = Number((await db.query('select revision from public.permission_catalog_state where singleton')).rows[0].revision);
          await db.query('set local role authenticated');
          await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",
            [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' }), JSON.stringify({ 'x-pos-employee-token': ownerSession.token })]);
          const updated = (await db.query('select public.permission_admin_update($1) result', [{ requestId: randomUUID(), targetId: EMPLOYEE_IDS[2],
            expectedRevision: employeeRevision, expectedCatalogRevision: catalogRevision, patch: { overrides: present ? { grants: ['report.view'], denies: [] } : null } }])).rows[0].result;
          expect(updated).toMatchObject({ ok: true, outcome: 'applied' });
          await db.query('reset role');
        }
        const revision = Number((await db.query(catalog ? 'select revision from public.permission_catalog_signals where singleton' : "select revision from public.store_change_signals where store_id=$1 and topic='permission' and target_id=$2", catalog ? [] : [STORE_IDS[0], EMPLOYEE_IDS[2]])).rows[0].revision);
        await db.query('commit');
        return { browserBefore, nodeBeforeCommit, nodeAfterCommit: performance.now(), revision };
      } catch (error) { await db.query('rollback'); throw error; }
    };
    const measure = async (label: string, present: boolean, catalog = false, fallback = false) => {
      for (const page of pages) expect(await page.evaluate(() => ({ visibility: document.visibilityState, online: navigator.onLine }))).toEqual({ visibility: 'visible', online: true });
      const committed = await change(present, catalog);
      await Promise.all(pages.map(async (page, device) => {
        const usesFallback = fallback && device === 0;
        let oracle = 'signal-arrival';
        try {
          if (!usesFallback) await expect.poll(async () => page.evaluate(({ revision, catalog, lower }) =>
            window.permissionTimingProbe.signals.some(event => event.revision === revision && event.time >= lower
              && event.table === (catalog ? 'permission_catalog_signals' : 'store_change_signals') && !event.dropped),
          { revision: committed.revision, catalog, lower: committed.browserBefore[device] }), { timeout: 15_000 }).toBe(true);
          oracle = 'dom-apply';
          await expect(page.getByTestId('nav-report')).toHaveCount(present ? 1 : 0, { timeout: usesFallback ? 35_000 : 5_000 });
          const state = await page.evaluate(() => window.permissionTimingProbe);
          oracle = 'foreground-online';
          expect(await page.evaluate(() => ({ visibility: document.visibilityState, online: navigator.onLine }))).toEqual({ visibility: 'visible', online: true });
          const signal = state.signals.find(event => event.revision === committed.revision && event.time >= committed.browserBefore[device]
            && event.table === (catalog ? 'permission_catalog_signals' : 'store_change_signals'));
          const applied = state.nav.find(event => event.time >= committed.browserBefore[device] && event.present === present);
          oracle = 'signal-and-apply-records';
          expect(applied).toBeTruthy();
          expect(signal?.dropped).toBe(usesFallback);
          const resumes = state.resumes.filter(event => event.time >= committed.browserBefore[device] && event.time <= applied!.time);
          oracle = 'no-resume-during-measurement';
          expect(resumes).toEqual([]);
          const rpcChain = state.requests.filter(request => request.start >= (usesFallback ? committed.browserBefore[device] : signal!.time) && request.start <= applied!.time);
          oracle = 'revision-authority-chain';
          expect(rpcChain.some(request => request.name === 'permission_get_revision')).toBe(true);
          expect(rpcChain.some(request => request.name === 'permission_get_authority')).toBe(true);
          expect(rpcChain.every(request => request.ok)).toBe(true);
          const chainStart = Math.min(...rpcChain.map(request => request.start));
          const chainDuration = applied!.time - chainStart;
          const record = { label, device, present, fallback: usesFallback, commit: { lower: committed.nodeBeforeCommit, upper: committed.nodeAfterCommit, clock: 'node.performance' },
            browserLowerBeforeCommit: committed.browserBefore[device], signal, applied, rpcChain, chainDuration, resumes, clock: 'browser.performance' };
          records.push(record);
          oracle = 'chain-budget-5s';
          expect(chainDuration).toBeLessThanOrEqual(5_000);
          if (usesFallback) {
            oracle = 'fallback-poll-budget-30s';
            expect(chainStart - committed.browserBefore[device]).toBeLessThanOrEqual(30_000);
            oracle = 'fallback-apply-budget-35s';
            expect(applied!.time - committed.browserBefore[device]).toBeLessThanOrEqual(35_000);
          } else { oracle = 'signal-apply-budget-5s'; expect(applied!.time - signal!.time).toBeGreaterThanOrEqual(0); expect(applied!.time - signal!.time).toBeLessThanOrEqual(5_000); }
        } catch {
          const failure = `${label}/device${device}: REALTIME_TIMING_ORACLE_FAILED:${oracle}`;
          const timingProbe = await page.evaluate(() => window.permissionTimingProbe).catch(() => null);
          failures.push(failure); records.push({ label, device, failure, oracle, committed, timingProbe });
        }
      }));
    };
    for (let cycle = 1; cycle <= 10; cycle++) { await measure(`cycle-${cycle}-grant`, true); await measure(`cycle-${cycle}-revoke`, false); }
    await measure('global-catalog-grant', true, true); await measure('global-catalog-revoke', false, true);
    await pages[0].evaluate(() => { window.permissionTimingProbe.blockSignals = true; });
    await measure('lost-signal-grant', true, false, true);
    await Promise.all(pages.map(page => page.evaluate(() => { window.permissionTimingProbe.blockSignals = false; })));
    await measure('restored-signal-revoke', false);
    await Promise.all(contexts.map(context => context.setOffline(true)));
    await Promise.all(pages.map(page => expect(page.getByTestId('permission-verification-gate')).toBeVisible()));
    await change(true);
    const resumes = await Promise.all(pages.map(page => page.evaluate(() => performance.now())));
    const held = [false, false], release: (() => void)[] = [];
    await Promise.all(pages.map(async (page, device) => {
      const barrier = new Promise<void>(resolve => { release[device] = resolve; });
      await page.route('**/rest/v1/rpc/permission_get_authority', async route => {
        const response = await route.fetch(); held[device] = true;
        await barrier; await route.fulfill({ response });
      });
    }));
    try {
      await Promise.all(contexts.map(context => context.setOffline(false)));
      await expect.poll(() => held.every(Boolean), { timeout: 15_000 }).toBe(true);
      await Promise.all(pages.map(page => expect(page.getByTestId('permission-verification-gate')).toBeVisible()));
      await Promise.all(pages.map(page => expect(page.getByTestId('nav-report')).toHaveCount(0)));
      records.push({ label: 'reconnect-held-authority', gatedDevices: [0, 1] });
    } finally { release.forEach(resolve => resolve()); }
    await Promise.all(pages.map(async (page, device) => {
      await expect(page.getByTestId('nav-report')).toHaveCount(1, { timeout: 15_000 });
      await expect(page.getByTestId('permission-verification-gate')).toBeHidden();
      const state = await page.evaluate(() => window.permissionTimingProbe);
      const applied = state.nav.find(event => event.time >= resumes[device] && event.present);
      const verified = state.requests.find(request => request.name === 'permission_get_authority' && request.start >= resumes[device] && request.ok && request.end <= (applied?.time ?? -1));
      expect(verified).toBeTruthy(); records.push({ label: 'reconnect', device, resumed: resumes[device], verified, applied });
    }));
    expect(failures).toEqual([]);
  } finally {
    try {
      await info.attach('permission-realtime-timings.json', { body: JSON.stringify({ records, failures, physicalCommitTimestamp: 'bounded by send/ack; not exact', retries: 0 }, null, 2), contentType: 'application/json' });
    } finally {
      try { await Promise.all(contexts.map(context => context.close())); }
      finally {
        try {
          if (bound) {
            await db.query('rollback');
            await db.query('update public.employees set permission_overrides=$2 where id=$1', [EMPLOYEE_IDS[2], savedOverrides]);
            if (savedDefault) await db.query("insert into public.role_permission_defaults(role_code,permission_code) values('cashier','report.view') on conflict do nothing");
            else await db.query("delete from public.role_permission_defaults where role_code='cashier' and permission_code='report.view'");
          }
        } finally { if (connected) await db.end(); }
      }
    }
  }
});
