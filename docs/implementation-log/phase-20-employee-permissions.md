# Phase 20 - Phân quyền thao tác theo từng nhân viên

## Mục tiêu

- Hoàn thiện seam quyền theo hành động từ phase 19 thành cơ chế dùng được trong vận hành.
- Cho admin chỉnh quyền hiệu lực của từng nhân viên bằng checkbox, không phải sửa trực tiếp `grants`/`denies`.
- Chốt quyền tại feature flow cho tạo/sửa/hủy đơn mở và thanh toán; UI chỉ là lớp hướng dẫn sớm.
- Bổ sung guardrail tương ứng trong các RPC ghi dữ liệu mà không đổi chữ ký RPC.

## Trạng thái và migration

- Code commit: `de35d10` (`feat(permissions): enforce employee actions`).
- Migration mới: **`012_action_permission_guardrails.sql`**, áp sau migration 011.
- Migration 012 đã được áp và kiểm chứng trên Supabase cloud ngày 2026-07-19.

## Quyết định thiết kế

1. **Hai trục quyền vẫn độc lập.** Role tiếp tục quyết định module nhìn thấy trên nav; permission quyết định hành động được phép thực hiện. Map module theo role không thay đổi.
2. **Catalog runtime chỉ gồm quyền có consumer thật:** `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`.
3. **Editor hiển thị quyền hiệu lực.** Khi lưu, UI tính diff so với mặc định role: quyền thêm vào `grants`, quyền bị bỏ vào `denies`; diff rỗng lưu `null` để về mặc định.
4. **Đổi role reset checkbox về mặc định role mới.** Quyền chỉ chỉnh sau khi nhân viên đã tồn tại; form tạo mới không hiện editor quyền.
5. **Snapshot quyền tại đăng nhập.** Client giữ `currentEmployee` trong memory; thay đổi quyền có hiệu lực trên thiết bị đó sau khi khóa/đăng nhập lại. RPC đọc override live nên vẫn có thể từ chối mutation ngay khi quyền vừa bị thu hồi.
6. **TypeScript là source of truth cho default role → permission.** SQL helper lặp lại bảng nhỏ này để guardrail; E2E deny-permission là lưới chống drift.
7. **RPC guardrail không phải employee-level DB security.** RLS vẫn cô lập theo store; session store hợp lệ vẫn có thể spoof employee id. Không mô tả cơ chế này như authorization chống tấn công.

## Đã implement

### Domain, core và adapters

- `EmployeePermission` có 5 quyền runtime; thêm `order.voidOpen`.
- Mặc định: admin có cả 5 quyền; cashier có tạo/sửa/hủy đơn mở/thanh toán; kitchen không có quyền thao tác POS.
- `EmployeeUpdate.permissionOverrides?: EmployeePermissionOverrides | null`: `undefined` không đụng field, `null` xóa override.
- Supabase và mock employee repo cùng persist semantics trên; mapper Supabase lọc bỏ permission ngoài catalog.

### Feature flow và UI POS

- Submit flow nhận `actor: Employee` và phân nhánh quyền: đơn mới → `order.create`; đơn hiện hữu còn món → `order.update`; đơn hiện hữu về 0 món → `order.voidOpen`.
- Full payment và instant-pay split đều yêu cầu `payment.take` trước khi gọi payment port.
- Cả nút action header và footer của Order/Payment Drawer bị disable và có lý do tiếng Việt khi thiếu quyền. Guard trong flow vẫn là chốt thật; disabled button không được dùng thay authorization.

### Employees Drawer

- Section `Quyền thao tác` dùng checkbox theo quyền hiệu lực và có mô tả từng quyền.
- Checkbox khởi tạo từ role + overrides; save chuyển ngược thành overrides tối thiểu; tick đúng default lưu `null`.
- Đổi role reset quyền; sửa quyền chính mình có cảnh báo cần đăng nhập lại.
- Giữ rule còn ít nhất một admin active, gồm cả trường hợp đổi role admin cuối sang cashier/kitchen.

### Database guardrail

- Migration 012 tạo helper `has_employee_permission(role, overrides, permission)`.
- `submit_order_changes` đọc quyền live và chặn đúng ba nhánh create/update/void-open.
- `pay_order` và `pay_order_items` yêu cầu `payment.take`.
- Chữ ký ba RPC giữ nguyên; `void_order` của migration 011 không bị thay đổi.

## Kiểm thử 2026-07-19

- `npm test`: **46 files, 243/243 tests pass**.
- `npm run build`: pass; còn Vite chunk-size warning đã biết.
- `npm run smoke`: **27 pass, 18 skipped**, không failure trên bộ đa viewport.
- Full UI mock mới: admin bỏ `payment.take` của Thu ngân 1 → khóa phiên → đăng nhập lại cashier → action thanh toán ở order drawer bị disable với lý do đúng.
- Test flow chứng minh port không được gọi khi thiếu quyền, và kitchen có grant riêng `order.create` tạo đơn được dù role mặc định không có quyền POS.
- Test editor cover default/deny/grant/round-trip/null, reset khi đổi role, self-warning và chặn hạ role admin cuối.
- Test repository cover Supabase payload `permission_overrides`, semantics `undefined`/`null`, mock set/preserve/clear và mapper lọc code lạ.
- `npm run smoke:supabase`: **5/5 pass**. Test phase 20 tạo store cloud, admin deny `payment.take`, đăng nhập lại cashier, xác nhận vẫn tạo đơn được và UI khóa thanh toán; sau đó bypass UI gọi thẳng payment port/RPC và nhận `FORBIDDEN`. Các test create/pay/history/report, void paid, instant-pay split và realtime hai trình duyệt cũng pass.

## Giới hạn và việc còn lại

- Không push quyền mới theo realtime vào session nhân viên đang mở; cần khóa/đăng nhập lại để UI nhận snapshot mới.
- Chưa thêm permission cho discount/refund/shift/cash-drawer hoặc các chức năng chưa implement. Các mã tương lai không nằm trong union runtime để tránh checkbox chết.
- Phase này không đổi logic report/hủy đơn phase 19; đơn paid bị void vẫn bị loại khỏi doanh thu và vẫn giữ audit/payment để đối soát.
