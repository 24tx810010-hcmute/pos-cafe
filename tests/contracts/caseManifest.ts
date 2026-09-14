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

const baseExecutions: RequiredExecution[] = caseCatalog.flatMap((definition) =>
  definition.backends.flatMap((backend) => (variants[definition.id.slice(-3)] ?? ['']).map((suffix) => ({
    ...definition, backend, suffix, name: `${definition.id}/${backend}${suffix ? '/' + suffix : ''}`,
  }))),
);

// Security regressions of TC006: require the UI oracles as well as the RPC matrix.
const recoveryAccessCase = caseCatalog.find(definition => definition.id === 'TC-IDEM-006')!;
const recoveryAccessVariants = {
  core: ['cache=different_employee', 'cache=same_employee', 'cache=store_change', 'cache=late_response',
    ...product({ cache: ['late_reprint'], transition: ['employee_change', 'permission_denied'] }),
    ...product({ cache: ['list_denied', 'detail_denied'], error: ['FORBIDDEN', 'AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED'] })],
  e2e: ['cache=switch_employee', 'cache=revoked_permission', 'cache=late_response'],
} as const;
// Review regressions are mandatory executions, not optional tests outside the gate.
const reviewExecutions = (id: string, backend: Backend, suffixes: string[], file: string, expected: string): RequiredExecution[] => {
  const definition = caseCatalog.find(entry => entry.id === id)!;
  return suffixes.map(suffix => ({ ...definition, backend, suffix, name: `${id}/${backend}/${suffix}`, expected, plannedFiles: [file] }));
};
export const requiredExecutions: RequiredExecution[] = [
  ...baseExecutions,
  ...Object.entries(recoveryAccessVariants).flatMap(([backend, variants]) => variants.map(suffix => ({
    ...recoveryAccessCase, backend: backend as Backend, suffix, name: `${recoveryAccessCase.id}/${backend}/${suffix}`,
    expected: 'Không hiển thị/cache dữ liệu ledger của phiên/cửa hàng cũ hoặc sau khi server từ chối quyền; phản hồi cũ không khôi phục dữ liệu. Phiên có quyền đọc mới vẫn hoạt động.',
    plannedFiles: [backend === 'core' ? 'src/app/writeRecoveryAccess.test.tsx' : 'tests/supabase/idempotencyRecovery.spec.ts'],
  }))),
  ...reviewExecutions('TC-IDEM-015', 'db', product({ numeric: ['create', 'update_retained', 'update_remove', 'pay', 'split_partial', 'split_whole_line', 'void_open', 'void_paid'], wire: ['decimal', 'exponent'] }),
    'tests/contracts/writeNumericWire.contract.test.ts', 'Raw JSON nguyên dạng thập phân/số mũ execute và replay cùng K/R1; payload::text đã register bất biến, đúng một hiệu ứng.'),
  ...reviewExecutions('TC-IDEM-074', 'db', product({ numeric_field: ['update.expectedVersion', 'pay.expectedVersion', 'void.expectedVersion', 'retained.quantity', 'newLine.quantity', 'newLine.quotedBasePrice', 'option.quantity', 'option.quotedPriceDelta', 'pay.receivedAmount', 'split.quantity'], invalid: ['fractional', 'below_min', 'above_max'] }),
    'tests/contracts/writeNumericWire.contract.test.ts', 'Raw số phân số hoặc vượt miền bị INVALID_WRITE_REQUEST, không ledger/business effect; positive control cùng trường đạt.'),
  ...(['db', 'mock', 'e2e'] as const).flatMap(backend => reviewExecutions('TC-IDEM-030', backend, ['old'],
    backend === 'db' ? 'tests/contracts/writeOperations.contract.test.ts' : backend === 'mock' ? 'src/adapters/mock/writeOperationRepo.test.ts' : 'tests/supabase/idempotencyPricing.spec.ts',
    'Fixture reset riêng: tách old 40.000/source 89.000, đúng identity, tên, option quantity và giá snapshot cũ/mới.')),
  ...reviewExecutions('TC-IDEM-051', 'core', [
    ...product({ print: ['read', 'timer'], transition: ['offline', 'close_reopen', 'lock', 'same_employee', 'unmount'] }), 'print=positive', 'print=late_error',
  ], 'src/app/components/ReceiptPrintLifecycle.test.tsx', 'Không print/notify sau vòng đời mất hiệu lực kể cả timer 200ms; click hợp lệ in đúng một lần.'),
  ...reviewExecutions('TC-IDEM-051', 'e2e', [
    ...product({ reprint: ['offline', 'close_reopen'] }), ...product({ print: ['read', 'timer'], transition: ['offline', 'close_reopen'] }), 'print=positive',
  ], 'tests/supabase/idempotencyLifecycle.spec.ts', 'Response receipt HTTP thật muộn không mở/in; timer browser hủy khi offline/đóng màn; positive control in một lần.'),
  ...reviewExecutions('TC-IDEM-052', 'core', product({ draft: ['pending', 'committed', 'late_retry'] }),
    'src/app/writeRetryDraft.test.tsx', 'Retry cùng K/payload tiêu thụ đúng draft đã ghi, không tự preview/in hay sinh K mới; không xóa draft của lượt mở mới.'),
  ...reviewExecutions('TC-IDEM-052', 'e2e', product({ draft: ['pending', 'committed'] }),
    'tests/supabase/idempotencyLifecycle.spec.ts', 'Sau mất ACK và retry: một register, hai execute cùng K/payload, một đơn; đóng draft đã ghi, không tự in, lần mở mới giỏ rỗng.'),
  ...reviewExecutions('TC-IDEM-053', 'core', ['session=same_employee'],
    'src/app/writeSessionGeneration.test.tsx', 'Đổi thế hệ phiên cùng object nhân viên vô hiệu hóa coordinator: ACK cũ không đóng drawer/xóa draft/mở phiếu bếp; giao dịch server vẫn chỉ một lần.'),
  ...reviewExecutions('TC-IDEM-053', 'core', [
    ...product({ recovery: ['resume', 'cancel'], transition: ['employee_change'], error: ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] }),
    ...product({ recovery: ['resume', 'cancel'], transition: ['close_reopen'], error: ['EMPLOYEE_SESSION_REQUIRED'] }),
  ], 'src/app/writeRecoveryActionLifetime.test.tsx', 'Lỗi action Tra cứu của vòng đời cũ không đăng xuất nhân viên hiện tại, đổi màn, xóa draft, thu hồi phiên hoặc toast.'),
  ...reviewExecutions('TC-IDEM-054', 'core', product({ recovery: ['resume', 'cancel'], transition: ['offline_online'], error: ['EMPLOYEE_SESSION_REQUIRED'] }),
    'src/app/writeRecoveryActionLifetime.test.tsx', 'Offline rồi online không phục hồi quyền tác động UI của lỗi action Tra cứu đang chờ.'),
  ...reviewExecutions('TC-IDEM-006', 'core', product({ recovery: ['resume', 'cancel'], error: ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] }),
    'src/app/writeRecoveryActionLifetime.test.tsx', 'Lỗi xác thực của action hiện hành vẫn khóa phiên, điều hướng và thông báo đúng một lần.'),
  ...reviewExecutions('TC-IDEM-053', 'core', [
    ...product({ initial: ['submit'], transition: ['same_employee'], error: ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] }),
    'initial=submit/transition=same_employee/result=applied',
  ], 'src/app/writeInitialSubmitLifetime.test.tsx', 'Phản hồi lần gửi đầu của phiên cũ không khóa phiên mới, xóa draft, toast hoặc mở phiếu bếp.'),
  ...reviewExecutions('TC-IDEM-054', 'core', [
    ...product({ initial: ['submit'], transition: ['offline_online'], error: ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] }),
    'initial=submit/transition=offline_online/result=applied',
  ], 'src/app/writeInitialSubmitLifetime.test.tsx', 'Offline rồi online không khôi phục quyền tác động UI của callback lần gửi đầu.'),
  ...reviewExecutions('TC-IDEM-006', 'core', product({ initial: ['submit'], error: ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] }),
    'src/app/writeInitialSubmitLifetime.test.tsx', 'Lỗi xác thực lần gửi đầu còn hiện hành vẫn khóa phiên, xóa draft và toast đúng một lần.'),
  ...reviewExecutions('TC-IDEM-051', 'core', ['initial=submit/result=applied'],
    'src/app/writeInitialSubmitLifetime.test.tsx', 'Lần gửi đầu hiện hành tạo một đơn, tiêu thụ draft, đóng drawer và mở phiếu bếp đúng một lần.'),
  ...(['TC-IDEM-053', 'TC-IDEM-054'] as const).flatMap(id => reviewExecutions(id, 'core', [
    ...product({ payment: ['pay', 'split'], transition: [id === 'TC-IDEM-053' ? 'same_employee' : 'offline_online'], error: ['AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED'] }),
    ...product({ payment: ['pay', 'split'], transition: [id === 'TC-IDEM-053' ? 'same_employee' : 'offline_online'], response: ['applied'] }),
  ], 'src/app/writePaymentLifetime.test.tsx', 'Callback thanh toán toàn bộ/tách đơn cũ không khóa phiên, xóa draft, đóng màn, toast hoặc mở hóa đơn; ACK đã ghi vẫn đúng một hiệu ứng.')),
  ...reviewExecutions('TC-IDEM-006', 'core', product({ payment: ['pay', 'split'], error: ['AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED'] }),
    'src/app/writePaymentLifetime.test.tsx', 'Lỗi xác thực thanh toán hiện hành vẫn khóa phiên và thông báo đúng một lần.'),
  ...reviewExecutions('TC-IDEM-051', 'core', product({ payment: ['pay', 'split'], response: ['current_applied'] }),
    'src/app/writePaymentLifetime.test.tsx', 'Thanh toán hiện hành giữ một hiệu ứng và mở hóa đơn theo lựa chọn người dùng; tách đơn không đổi thành trả toàn bộ.'),
  ...reviewExecutions('TC-IDEM-051', 'core', [
    ...product({ history: ['reprint'], stage: ['order', 'receipt'], transition: ['employee_change', 'offline_online'], error: ['AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED'] }),
    'history=reprint/result=applied', 'history=void/result=applied',
  ], 'src/app/writeHistoryLifetime.test.tsx', 'Lỗi đọc hóa đơn muộn không khóa phiên hoặc xóa draft; in lại và hủy đơn hiện hành vẫn phản hồi đúng.'),
  ...(['TC-IDEM-053', 'TC-IDEM-054'] as const).flatMap(id => reviewExecutions(id, 'core',
    product({ history: ['void'], transition: [id === 'TC-IDEM-053' ? 'same_employee' : 'offline_online'], result: ['AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED', 'applied'] }),
    'src/app/writeHistoryLifetime.test.tsx', 'Callback hủy đơn của vòng đời cũ không toast, đóng popup hoặc refetch vào lượt mới; hiệu ứng server đã ghi vẫn giữ nguyên.')),
  ...reviewExecutions('TC-IDEM-006', 'core', product({ history: ['reprint', 'void'], error: ['AUTH_REQUIRED', 'EMPLOYEE_SESSION_REQUIRED'] }),
    'src/app/writeHistoryLifetime.test.tsx', 'Lỗi đọc/hủy đơn hiện hành giữ xử lý thông báo và phiên theo hợp đồng UI tương ứng.'),
  ...reviewExecutions('TC-IDEM-053', 'core', ['history=void/transition=reopen_confirmation/result=late_error'],
    'src/app/writeHistoryLifetime.test.tsx', 'Settlement lệnh hủy cũ không hạ busy của lượt tải xác nhận mới; đóng/mở popup tách thế hệ action.'),
];

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
