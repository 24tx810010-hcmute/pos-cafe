# 99 - End-to-End UI Mock Flow

> File cuoi cung cho AI implement UI mock. Folder nay duoc gui tu chu du an; khong sua nhanh `docs`, chi implement trong code worktree/branch dung.

## Preflight

Truoc khi implement flow:

```powershell
cd D:\Workspace\pos-cafe-code
git worktree list
git status --short --branch
git branch --show-current
git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\.md)"
```

- Branch dung: `ui-foundation` hoac branch UI user chi dinh.
- Sai branch + clean: switch ve branch dung.
- Sai branch + dirty: dung lai, bao user, khong discard.
- Khong sua docs branch, khong copy folder docs vao code branch.

## Mock-only Scope

- Muc tieu: tao mot flow UI mock day du de duyet responsive.
- Khong backend, khong Supabase adapter, khong RPC, khong migration, khong core/business logic that.
- Co the dung mock ports hien co hoac local mock data.
- Tat ca thao tac la state/UI-only: create, pair, unlock, submit order, pay, save editor, clear demo.
- Single URL; internal state/drawers only.

## Interactions

- Tat ca click trong flow chi thay doi internal UI state, mock data, toast, dialog, hoac drawer dang mo.
- `Create`, `Pair`, `Unlock`, `In/Gui don`, `Hoan tat`, `Save`, `Clear demo` khong goi backend that.
- Neu flow can simulated delay, dung loading mock ngan va khong block viewport layout.

## Flow Tong

1. Landing
   - Hien hai action: `Da co quan`, `Tao quan moi`.
   - Action khong doi URL.

2. Store Pairing mock
   - Nhap `0001-X8F3QA`.
   - Valid -> toast mock -> Passcode.
   - Invalid -> inline error.

3. Create Store mock
   - Nhap ten quan.
   - Submit -> hien Store Key mock + Admin PIN.
   - Button vao Passcode.

4. Passcode
   - Chon Admin, PIN `123456` -> vao POS Floor.
   - Chon Thu ngan, PIN `111111` -> vao POS Floor voi rail han che admin modules.
   - Sai PIN -> error visual.

5. POS Floor
   - Render shell + rail + floor canvas.
   - Area tabs, tables, decor, status.
   - Click ban trong -> Order Drawer draft.
   - Click ban occupied -> Order Drawer existing.
   - Click Mang di -> Takeaway flow.

6. Order Drawer
   - Add menu item, options, quantity, note.
   - Cart total cap nhat mock.
   - In/Gui don -> toast, table occupied mock, back floor.
   - Existing order no dirty -> Thanh toan -> Payment Drawer.
   - Dirty close -> confirm.

7. Payment Drawer
   - Input tien khach dua.
   - Neu thieu tien -> error/disable.
   - Hoan tat -> toast, table empty mock, receipt preview optional, back floor.

8. Takeaway Orders
   - Tao don mang di -> Order Drawer takeaway.
   - Danh sach takeaway open -> mo don/thanh toan.

9. Order History
   - Open from rail.
   - Filter/search mock.
   - Select order -> detail right, print again mock.

10. Employees
   - Admin only.
   - Add/edit/reset PIN/toggle active mock.
   - Cashier khong thay hoac bi disabled.

11. Menu Editor
   - Admin only.
   - Category/item/option draft mock.
   - Save mock -> toast, dirty clear.
   - Responsive 3 pane/segmented small landscape.

12. Floor-Plan Editor
   - Admin only.
   - Add/select/move/edit table/decor mock.
   - Save mock -> toast.
   - Status display-only, khong edit status.

13. Report
   - Admin only.
   - Metrics/charts mock.
   - Date filters update local mock data.

14. General Settings + Clear Demo
   - Settings form dirty/save mock.
   - Clear Demo opens dialog.
   - If open orders exist -> blocked state.
   - Else confirm -> toast clear demo mock.

15. Optional Screens
   - Kitchen Queue: optional rail/drawer, queue cards, mark done mock.
   - Payment Settings: optional rail/drawer, QR/bank form preview mock.

## Responsive Acceptance Matrix

- Desktop: `1366x768` or larger.
  - Rail visible.
  - Drawer 80-90vw.
  - 3-pane layouts visible.

- Tablet landscape: `1024x600`.
  - All MVP drawers usable.
  - Header/action bars sticky.
  - Save/Pay/Submit buttons visible.

- Phone landscape: `844x390` and `740x360`.
  - POS Floor, Order Drawer, Payment Drawer, Menu Editor, Floor Editor, Report, Settings all reachable.
  - Text does not overflow buttons/cards.
  - Right panes can collapse, but must be accessible.
  - Primary actions visible without body page scroll.

- Phone portrait:
  - Show rotate guidance for POS/admin surfaces.
  - Do not attempt full POS/admin layout in portrait.

## Global Acceptance Criteria

- `npm run build` passes.
- `npm run smoke` passes or is updated to match new mock UI selectors.
- No URL workflow for POS/admin.
- No direct Supabase import in UI.
- No schema/migration/core logic changes for UI mock.
- No docs branch changes by external UI implementer.
