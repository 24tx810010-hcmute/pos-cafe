import catalog from './caseCatalog.json' with { type: 'json' };

export type Backend = 'core' | 'mock' | 'db' | 'e2e' | 'tool';
export type CaseDefinition = {
  id: string;
  title: string;
  backends: Backend[];
  expected: string;
  plannedFiles: string[];
};
export type RequiredExecution = CaseDefinition & { name: string; backend: Backend; suffix: string };

// Independent, literal expectations transcribed from the approved testplan.
// A catalog entry is a requirement, never an executed test or a passing result.
export const caseCatalog = catalog as CaseDefinition[];

const product = (axes: Record<string, readonly string[]>): string[] => Object.entries(axes).reduce(
  (rows, [key, values]) => rows.flatMap((row) => values.map((value) => `${row}${row ? '/' : ''}${key}=${value}`)), [''],
);

export const schemaFields = [
  'common.schemaVersion', 'common.kind', 'register.operationId', 'execute.operationId',
  'submit.action', 'submit.orderId', 'create.expectedVersion', 'create.orderType', 'create.tableId', 'create.newLines',
  'takeaway.tableId', 'update.expectedVersion', 'update.retainedLines', 'update.newLines',
  'retained.sourceItemId', 'retained.quantity', 'newLine.id', 'newLine.menuItemId', 'newLine.quantity',
  'newLine.quotedBasePrice', 'newLine.options', 'option.id', 'option.optionValueId', 'option.quantity', 'option.quotedPriceDelta',
  'pay.orderId', 'pay.paymentId', 'pay.expectedVersion', 'pay.method', 'pay.receivedAmount',
  'split.newOrderId', 'split.lines', 'split.orderItemId', 'split.quantity', 'split.splitItemId', 'void.reason', 'void.expectedVersion',
] as const;

const variants: Record<string, string[]> = {
  '005': ['boundary=minus_1ms', 'boundary=equal', 'boundary=plus_1ms', 'reset_pin', 'race=start_first', 'race=reset_first'],
  '006': [
    ...product({ action: ['create', 'update', 'void_open', 'pay', 'split', 'void_paid'], endpoint: ['register', 'execute', 'get', 'list', 'cancel'], actor: ['A', 'B', 'C'] }),
    ...product({ action: ['create', 'update', 'void_open', 'pay', 'split', 'void_paid'], override: ['grant', 'deny_both'] }),
  ],
  '020': product({ winner: ['P1', 'P2'] }),
  '021': product({ winner: ['K1', 'K2'] }),
  '023': product({ pair: ['update_pay', 'update_split', 'pay_split', 'update_voidOpen', 'voidPaid_voidPaid'], winner: ['left', 'right'] }),
  '024': product({ winner: ['create', 'split'] }),
  '032': product({ source: ['other_order', 'other_store', 'removed', 'moved', 'duplicate', 'omitted', 'over_quantity'] }),
  '047': product({ kind: ['update', 'pay', 'split', 'void'], version: ['missing', 'null', 'positive'] }),
  '060': product({ winner: ['cancel', 'execute'] }),
  '062': ['boundary=minus_1ms', 'boundary=equal', 'boundary=plus_1ms', 'validation_k_expiry', 'validation_session_expiry'],
  '063': product({ blocker: ['operation', 'store', 'order', 'table'] }),
  '068': product({ terminal: ['applied', 'rejected', 'cancelled', 'expired'] }),
  '069': product({ point: ['submit_removed', 'submit_option', 'split_number', 'split_move', 'split_copy_option', 'split_payment', 'pay_payment', 'pay_order', 'pay_table', 'void_order'] }),
  '070': product({ kind: ['pay', 'split'] }),
  '074': [
    ...product({ field: schemaFields, variant: ['missing', 'null', 'wrong_type', 'positive'] }),
    ...product({ field: ['kind', 'schemaVersion', 'action', 'orderType', 'method', 'reason'], variant: ['invalid_literal'] }),
    ...product({ field: ['common', 'retained', 'newLine', 'option'], variant: ['unknown_field'] }),
  ],
  '078': [...product({ array: ['create_lines', 'options'], count: ['0', '1', 'max', 'max_plus_1'] }), ...product({ bytes: ['262144', '262145'] })],
  '079': [...product({ note: ['absent', 'null', 'empty', '500_ascii', '501_ascii', '500_emoji', '501_emoji'] }), ...product({ reason_other: ['absent', 'null', 'empty', 'spaces', 'nonblank'] })],
  '088': ['always_pending','always_reject','duplicate_payment','reprice_old','drop_option_qty','replay_current'],
};

export const requiredExecutions: RequiredExecution[] = caseCatalog.flatMap((definition) =>
  definition.backends.flatMap((backend) => (variants[definition.id.slice(-3)] ?? ['']).map((suffix) => ({
    ...definition, backend, suffix, name: `${definition.id}/${backend}${suffix ? '/' + suffix : ''}`,
  }))),
);

export const executionId = (title: string): string | undefined => title.match(/TC-IDEM-\d{3}\/(?:core|mock|db|e2e|tool)(?:\/[\w=,.-]+)*/)?.[0];

export function assertManifest() {
  const ids = new Set(caseCatalog.map((entry) => entry.id));
  if (ids.size !== 93 || caseCatalog.length !== 93) throw new Error('MANIFEST_INVALID: expected 93 unique base cases');
  for (let index = 1; index <= 93; index++) {
    if (!ids.has(`TC-IDEM-${String(index).padStart(3, '0')}`)) throw new Error('MANIFEST_INVALID: missing base case');
  }
  const names = new Set(requiredExecutions.map((entry) => entry.name));
  if (names.size !== requiredExecutions.length || requiredExecutions.some((entry) => !entry.expected || !entry.plannedFiles.length)) {
    throw new Error('MANIFEST_INVALID: duplicate execution or missing oracle/file');
  }
}
