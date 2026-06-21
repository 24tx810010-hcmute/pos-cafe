# Phase 02 - Product Tracks

## Mục Tiêu Phase

Triển khai các track sản phẩm chính sau foundation: POS order/payment, menu editor, floor editor, employees, settings, report/history và các flow admin cần cho tiểu luận.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `main` commit `ef3ecdb`.
- Tài liệu gốc: `docs/archive/superpowers/specs/2026-06-11-pos-cafe-parallel-task-phases.md`.

## Feature Đã Implement

- POS floor view với khu/tầng, bàn, decor, open order queue.
- Order drawer cho dine-in/takeaway, draft cart, option/topping, dirty close confirm.
- Payment drawer cash-only, quick cash, insufficient cash, stale/closed order states.
- Takeaway drawer với open order list/detail/action.
- Employees drawer: create/update/deactivate/reset PIN.
- Menu editor: category, item, option group/value, save changeset.
- Floor editor: area, table, decor, save changeset không ghi đè table status.
- Order history drawer và report drawer.
- General settings và clear demo dialog.

## Test/Build/Smoke Đã Chạy

- Archive integration notes ghi nhận `npm run test`, `npm run build`, mock smoke và Supabase smoke đã pass ở các checkpoint trước khi merge về `main`.
- Code hiện tại có unit/component tests cho employee drawer, menu editor, floor editor, report/history, order/payment hardening.

## Quyết Định Kỹ Thuật Phát Sinh

- POS/admin screens dùng drawer trên single URL thay vì route riêng.
- Menu/floor editor dùng local draft + explicit Save.
- Payment thật giữ cash-only để tập trung transaction và demo end-to-end.
- Kitchen/payment settings có thể tồn tại như optional UI/seam, không tính là feature bắt buộc.

## Gap Còn Lại

- UI nhìn còn utilitarian, chưa đạt visual polish mong muốn.
- Takeaway paid examples còn có sample UI-side data.
- Kitchen queue thật và QR payment thật nằm ngoài phase bắt buộc.
- Report export chưa nằm trong scope hoàn chỉnh.

## Link Liên Quan

- [../features.md](../features.md)
- [../screens.md](../screens.md)
- [../phase-scope.md](../phase-scope.md)
