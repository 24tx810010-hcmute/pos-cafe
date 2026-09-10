import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';

const repo = 'src/adapters/mock/writeOperationRepo.ts';
const business = 'src/adapters/mock/writeBusiness.ts';
export const mutationNames = ['always_pending', 'always_reject', 'duplicate_payment', 'reprice_old', 'drop_option_qty', 'replay_current'];
const cases = {
  always_pending: { file: repo, needle: 'const transaction = clone(this.state);', replacement: 'return clone(op);\n      const transaction = clone(this.state);', oracle: 'TC-IDEM-014/mock' },
  always_reject: { file: repo, needle: 'const transaction = clone(this.state);', replacement: 'return { ...clone(op), status: "rejected", error: businessError("INVALID_ORDER_ITEMS") };\n      const transaction = clone(this.state);', oracle: 'TC-IDEM-014/mock' },
  duplicate_payment: { file: repo, needle: 'this.state.orders = transaction.orders;', replacement: 'this.state.orders = transaction.orders; if ("payment" in r) { const paid = transaction.orders.find(order => order.payment?.id === r.payment.id)!; this.state.orders.push({ ...clone(paid), id: crypto.randomUUID() }); }', oracle: 'TC-IDEM-051/mock' },
  reprice_old: { file: business, needle: 'return { ...clone(source), quantity: l.quantity, note: l.note ?? null };', replacement: 'return { ...clone(source), unitPrice: state.menu.menuItems.find(item => item.id === source.menuItemId)!.price, quantity: l.quantity, note: l.note ?? null };', oracle: 'TC-IDEM-025/mock' },
  drop_option_qty: { file: business, needle: 'checkedMoney(o.priceDelta * o.quantity)', replacement: 'checkedMoney(o.priceDelta)', oracle: 'TC-IDEM-038/mock' },
  replay_current: { file: repo, needle: 'op.replayCount = (BigInt(op.replayCount) + 1n).toString();', replacement: 'op.replayCount = (BigInt(op.replayCount) + 1n).toString(); if (op.result?.kind === "pay_order_items") { op.result.sourceOrder.total = this.state.orders.find(order => order.id === payload.orderId)!.total; }', oracle: 'TC-IDEM-051/mock' },
};

/** Each fault runs in a fresh source copy, never against the application's files. */
export function runMutation(name, sourceRoot = process.cwd()) {
  const mutant = cases[name]; if (!mutant) throw new Error('Unknown mutant');
  const runDirectory = resolve(sourceRoot, 'artifacts', 'mutations', `${name}-${randomUUID()}`);
  mkdirSync(runDirectory, { recursive: true });
  cpSync(join(sourceRoot, 'src'), join(runDirectory, 'src'), { recursive: true });
  for (const file of ['package.json', 'vitest.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']) cpSync(join(sourceRoot, file), join(runDirectory, file));
  symlinkSync(join(sourceRoot, 'node_modules'), join(runDirectory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const run = (label) => {
    const output = join(runDirectory, `${label}.json`);
    const child = spawnSync(process.execPath, [join(sourceRoot, 'node_modules/vitest/vitest.mjs'), 'run', '--config', join(runDirectory, 'vitest.config.ts'), 'src/adapters/mock/writeOperationRepo.test.ts', '-t', mutant.oracle, '--reporter=json', `--outputFile=${output}`], { cwd: runDirectory, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' }, windowsHide: true });
    writeFileSync(join(runDirectory, `${label}.log`), (child.stdout ?? '') + (child.stderr ?? ''));
    if (child.error || child.signal) throw new Error(`${name}: runner did not complete`);
    let report; try { report = JSON.parse(readFileSync(output, 'utf8')); } catch { throw new Error(`${name}: no valid assertion report`); }
    const assertions = report.testResults.flatMap(file => file.assertionResults).filter(test => test.fullName.includes(mutant.oracle));
    return { exit: child.status, report, assertions };
  };
  const baseline = run('baseline');
  if (baseline.exit !== 0 || baseline.assertions.length !== 1 || baseline.assertions[0].status !== 'passed' || baseline.report.numFailedTestSuites !== 0) throw new Error(`${name}: unchanged baseline did not pass exactly one selected oracle`);
  const target = join(runDirectory, mutant.file), original = readFileSync(target, 'utf8');
  if (original.split(mutant.needle).length !== 2) throw new Error(`${name}: mutation anchor must occur once`);
  const changed = original.replace(mutant.needle, mutant.replacement); writeFileSync(target, changed);
  const result = run('mutant');
  const assertion = result.assertions[0];
  const killed = result.exit === 1 && result.assertions.length === 1 && assertion.status === 'failed'
    && result.report.numFailedTests === 1 && assertion.failureMessages.some(message => message.startsWith('AssertionError:'));
  const record = { name, backend: 'memory-adapter', runDirectory, oracle: mutant.oracle, baselinePassed: true, killed,
    originalSha256: createHash('sha256').update(original).digest('hex'), mutantSha256: createHash('sha256').update(changed).digest('hex'),
    mutationFile: mutant.file, baselineExit: baseline.exit, mutantExit: result.exit, assertionStatus: assertion?.status };
  writeFileSync(join(runDirectory, 'mutation-result.json'), JSON.stringify(record, null, 2) + '\n');
  if (!killed) throw new Error(`${name}: mutant survived or failed for a reason other than the selected assertion; ${runDirectory}`);
  return record;
}
