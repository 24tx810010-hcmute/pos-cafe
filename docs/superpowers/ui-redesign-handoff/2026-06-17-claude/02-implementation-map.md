# Implementation Map

Đây là map code hiện tại để AI implementer không phải đoán.

## Main UI Files

- `src/app/App.tsx`
  - `LandingScreen`
  - `StorePairingScreen`
  - `CreateStoreScreen`
  - `PasscodeScreen`
  - `AppShell`
  - `TakeawayDrawer`
  - `OrderHistoryDrawer`
  - `EmployeesDrawer`
  - `PaymentSettingsDrawer`
  - `KitchenQueueDrawer`
  - `GeneralSettingsDrawer`
  - `ClearDemoDialog`
  - `FloorWorkspace`
  - `OrderDrawer`
  - `PaymentDrawer`
  - `MenuEditorDrawer`
  - `FloorEditorDrawer`
  - `ReportSettingsDrawer`

- `src/styles.css`
  - Preauth styles: `.preauth-*`, `.landing-*`
  - Passcode: `.passcode-*`
  - Shell/rail: `.app-shell`, `.left-rail`, `.rail-*`
  - Floor: `.floor-*`, `.table-node`, `.decor-node`
  - Drawer/dialog: `.drawer-*`, `.pane`, `.confirm-*`
  - Payment: `.payment-*`
  - Menu/floor/report admin panes: `.menu-*`, `.fe-*`, `.rp-*`

- `src/app/useAppStore.ts`
  - Internal UI state: screen, drawer, active area/category, order context, payment order.
  - Dùng state hiện có; không thêm router nếu không cần.

## Data/Logic Hooks

Không rewrite các hook này nếu chỉ polish UI:

- `src/features/session/useSessionFlow.ts`
- `src/features/pos/usePosData.ts`
- `src/features/pos/useOrderPaymentFlow.ts`
- `src/features/admin/useAdminData.ts`
- `src/features/admin/useAdminMutations.ts`
- `src/features/integration/useRealtimeInvalidation.ts`

Nếu UI cần data mới mà hook đã có sẵn, dùng hook hiện có. Nếu hook không có, hỏi user trước khi thêm logic mới.

## Tests

- `src/app/demoCopyPolish.test.tsx`: protects visible UI from internal/dev copy.
- `src/app/demoHardening.test.tsx`: clear demo safety and demo hardening.
- `src/app/menuEditorDrawer.test.tsx`
- `src/app/floorEditorDrawer.test.tsx`
- `src/app/reportHistoryDrawer.test.tsx`
- `src/app/employeeDrawer.test.tsx`
- Feature tests under `src/features/**`.

Khi sửa visible text, update tests có query by role/name tương ứng.

## Suggested Refactor Boundary

`App.tsx` đang rất lớn. Có thể tách component nếu làm UI redesign lớn, nhưng tách phải có lợi ích rõ:

- `src/app/screens/PreauthScreens.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/floor/FloorWorkspace.tsx`
- `src/app/order/OrderDrawer.tsx`
- `src/app/payment/PaymentDrawer.tsx`
- `src/app/admin/MenuEditorDrawer.tsx`
- `src/app/admin/FloorEditorDrawer.tsx`
- `src/app/admin/ReportDrawer.tsx`

Nếu tách file, cần giữ import clean và chạy full test/build. Không tách chỉ để "đẹp code" nếu làm tăng risk.

## Current Screenshot References

Audit screenshots:

- `docs/superpowers/ui-audit/2026-06-16-desktop/screenshots/`

Cần dùng các ảnh này để so sánh trước/sau. Sau khi polish, chụp lại screenshot mới trong code worktree, không commit vào docs branch trừ khi user yêu cầu.

