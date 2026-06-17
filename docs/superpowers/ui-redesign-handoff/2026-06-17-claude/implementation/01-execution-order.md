# Execution Order

Nếu user không chỉ định khác, làm theo thứ tự này để giảm risk demo.

## Phase 1 - Core Demo Journey

1. `screens/06-pos-floor.md`
2. `screens/07-order-drawer.md`
3. `screens/08-payment-drawer.md`
4. `screens/05-app-shell-left-rail.md`

Acceptance phase 1:

- Cashier có thể nhìn bàn, mở đơn, thêm món, gửi đơn, thanh toán mà không bị khung UI rỗng/rối.
- Desktop 1440x900 và phone landscape 844x390 không overlap.
- `npm run test`, `npm run build`, `VITE_DATA_MODE=mock npm run smoke` pass.

## Phase 2 - Admin Tools High Risk

1. `screens/12-menu-editor.md`
2. `screens/13-floor-editor.md`
3. `screens/14-report.md`

Acceptance phase 2:

- Admin drawers không còn cảm giác debug panel.
- Advanced/read-only controls được ẩn hoặc gom lại.
- Dirty/save/confirm states vẫn hoạt động.
- `npm run test -- menuEditorDrawer floorEditorDrawer reportHistoryDrawer` pass.

## Phase 3 - Supporting Screens

1. `screens/09-takeaway.md`
2. `screens/10-order-history.md`
3. `screens/11-employees.md`
4. `screens/15-general-settings.md`
5. `screens/16-clear-demo-dialog.md`
6. `screens/17-kitchen-queue.md`
7. `screens/18-payment-settings.md`

Acceptance phase 3:

- List/detail screens auto-select hoặc provide clear next action.
- Empty/error/loading states look designed, not blank.
- Optional/future functionality is hidden or framed as unavailable without prototype language.

## Phase 4 - Preauth Polish

1. `screens/01-landing.md`
2. `screens/02-store-pairing.md`
3. `screens/03-create-store.md`
4. `screens/04-passcode.md`

Acceptance phase 4:

- First impression professional.
- Store Key/Admin PIN flow clear without exposing internal security wording.
- Passcode remains fast and operational.

