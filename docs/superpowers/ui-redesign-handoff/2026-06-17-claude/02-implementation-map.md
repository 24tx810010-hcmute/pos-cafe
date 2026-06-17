# Implementation Map

Day la map code hien tai de AI implementer khong phai doan.

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
  - Dung state hien co; khong them router neu khong can.

## Data/Logic Hooks

Khong rewrite cac hook nay neu chi polish UI:

- `src/features/session/useSessionFlow.ts`
- `src/features/pos/usePosData.ts`
- `src/features/pos/useOrderPaymentFlow.ts`
- `src/features/admin/useAdminData.ts`
- `src/features/admin/useAdminMutations.ts`
- `src/features/integration/useRealtimeInvalidation.ts`

Neu UI can data moi ma hook da co san, dung hook hien co. Neu hook khong co, hoi user truoc khi them logic moi.

## Tests

- `src/app/demoCopyPolish.test.tsx`: protects visible UI from internal/dev copy.
- `src/app/demoHardening.test.tsx`: clear demo safety and demo hardening.
- `src/app/menuEditorDrawer.test.tsx`
- `src/app/floorEditorDrawer.test.tsx`
- `src/app/reportHistoryDrawer.test.tsx`
- `src/app/employeeDrawer.test.tsx`
- Feature tests under `src/features/**`.

Khi sua visible text, update tests co query by role/name tuong ung.

## Suggested Refactor Boundary

`App.tsx` dang rat lon. Co the tach component neu lam UI redesign lon, nhung tach phai co loi ich ro:

- `src/app/screens/PreauthScreens.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/floor/FloorWorkspace.tsx`
- `src/app/order/OrderDrawer.tsx`
- `src/app/payment/PaymentDrawer.tsx`
- `src/app/admin/MenuEditorDrawer.tsx`
- `src/app/admin/FloorEditorDrawer.tsx`
- `src/app/admin/ReportDrawer.tsx`

Neu tach file, can giu import clean va chay full test/build. Khong tach chi de "dep code" neu lam tang risk.

## Current Screenshot References

Audit screenshots:

- `docs/superpowers/ui-audit/2026-06-16-desktop/screenshots/`

Can dung cac anh nay de so sanh truoc/sau. Sau khi polish, chup lai screenshot moi trong code worktree, khong commit vao docs branch tru khi user yeu cau.

