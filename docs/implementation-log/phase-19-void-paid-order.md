# Phase 19 - Hủy đơn đã thanh toán + seam phân quyền theo hành động

## Mục tiêu

- Cho phép **hủy (void) một đơn ĐÃ THANH TOÁN** từ màn Lịch sử đơn — thao tác đụng tới tiền nên cần chặt chẽ và ghi audit.
- Vì tính năng này gắn với quyền, đồng thời dựng sẵn **seam phân quyền theo hành động** (quyền tách khỏi role, ghi đè per-employee) để hai nhân viên cùng role vẫn có thể khác quyền — consumer đầu tiên của seam chính là hủy đơn.
- Lý do hủy chọn từ danh sách ghi sẵn + ô ghi chú (bắt buộc khi "Lý do khác"); ghi ai hủy/lúc nào; có tổng hợp đơn hủy cho admin/chủ trong Report.

## Branch/Commit

- Branch code: `main` (cập nhật hash sau khi commit).
- Migration: **`011_void_paid_order.sql`** (áp sau 010; cần áp lên cloud thủ công trước khi test supabase/demo live).

## Quyết định thiết kế

1. **Làm seam quyền trước, full phân quyền sau.** Hủy đơn check qua `requirePermission(actor, "order.voidPaid")` chứ không check cứng role → khi làm phân quyền đầy đủ, tính năng này không phải sửa lại. Chi phí seam nhỏ: 1 vùng trong `core/guards.ts` + 1 cột DB + vài test.
2. **Hai trục quyền độc lập:** module (`canAccessModule` — thấy gì trên nav) và hành động (`hasPermission` — được làm gì). Quyền hành động mặc định suy từ role (`defaultRolePermissions`), ghi đè per-employee bằng `permissionOverrides {grants, denies}`. Hiệu lực = (default ∪ grants) − denies (denies thắng).
3. **Void đơn paid giữ nguyên số liệu:** không đụng `total`/`subtotal`/`order_no`/`business_date`/`paid_at` và payment row; chỉ đổi `status='void'`, ghi metadata hủy, bump `lock_version`. Không đụng bàn (đơn paid đã trả bàn). Giữ số tiền để đối soát + để report loại đúng.
4. **Report tự đúng:** report tính live từ `status='paid'` theo `business_date`, không có bảng tổng hợp → void là doanh thu tự giảm. Phân biệt "hủy sau thanh toán" (`paid_at not null`, tính vào tổng hợp đơn hủy) với "hủy đơn open trước thanh toán" (đường cũ qua `submit_order_changes` quantity 0, `paid_at` null, `total` 0, không tính).
5. **Chốt quyền ở app-layer, RPC chỉ guardrail/audit** — nhất quán caveat bảo mật: quyền theo nhân viên không phải DB-secured.

## Đã implement

### DB (`011_void_paid_order.sql`)
- `orders` +`voided_at`, `voided_by_employee_id` (FK employees), `void_reason_code` (check 5 giá trị), `void_reason_note`.
- `employees` +`permission_overrides jsonb` (nullable; `{"grants":[...],"denies":[...]}`).
- `verify_employee_pin` **drop + tạo lại** (đổi return table) để trả thêm `permission_overrides`.
- `void_order` **drop stub (uuid,uuid) + tạo lại** 5 tham số `(p_order_id, p_employee_id, p_expected_lock_version, p_reason_code, p_reason_note)`: check store session → lookup nhân viên active → check quyền `order.voidPaid` (admin hoặc grant; denies thắng) → validate reason (other bắt buộc note) → lock đơn `for update`, chỉ nhận `paid` + đúng `lock_version` (sai → `ORDER_VERSION_CONFLICT`) → set void + metadata + bump version. Lỗi mới: `VOID_REASON_REQUIRED`.

### Domain/Ports
- `VoidReasonCode`, `EmployeePermission`, `EmployeePermissionOverrides`; `Employee.permissionOverrides?`; `OrderDetail` +4 field void; `CoreReport` +`voidCount`/`voidAmount`; `VoidOrderInput`/`VoidOrderResult`.
- `IOrderRepo.voidOrder`.

### Core/Flow (features/pos)
- `core/guards.ts`: `hasPermission`/`requirePermission` + `defaultRolePermissions` (giữ nguyên `canAccessModule`).
- `orderFlow.ts`: `voidPaidOrder` (requirePermission + validate note, gọi port). `useOrderPaymentFlow.ts`: `useVoidOrderMutation` (onSuccess → `invalidateAfterOrderMutation`, đã phủ history + order detail + report). `historyHelpers.ts`: `VOID_REASON_OPTIONS`, `voidReasonLabel`.

### Adapters
- Supabase: `mapEmployee` đọc `permission_overrides` phòng thủ (rác/null → undefined); `mapOrderDetail` +4 field void; `mapVoidOrderResult`; `orderRepo` thêm cột select + `voidOrder` (rpc), đổi điều kiện fetch payment sang `paid_at != null` (để đơn void vẫn hiển thị thông tin thanh toán); `employeeRepo` select thêm `permission_overrides`; `reportRepo` query thêm đơn paid-rồi-hủy → `voidCount`/`voidAmount` (đúng ở cả nhánh 0 đơn paid).
- Mock: `orderRepo.voidOrder` mirror guardrail RPC (permission qua `requirePermission`, NOT_FOUND, version conflict, giữ nguyên total/paidAt/payment); `paymentRepo`/`mockData` điền 4 field void null; `reportRepo` tính void stats.

### UI
- `OrderHistoryDrawer`: `canVoid = hasPermission(currentEmployee, "order.voidPaid")`; popup `PortalPopup` xác nhận (cảnh báo tiền + ngày, select lý do, textarea note, nút xác nhận đỏ disable khi other-thiếu-note/đang chạy); onError conflict → refetch.
- `OrderHistoryDetailPane`: nút `Hủy đơn` (chỉ khi canVoid + đơn paid, disable khi chưa load detail); khối "Người hủy / Thời điểm / Lý do" cho đơn void; disable in lại với đơn void.
- `ReportDrawer` + `reportHelpers`: `voidCount`/`voidAmount` lấy từ CoreReport (thay vì đếm mảng orders phân trang — nguồn cũ sai); hiển thị thêm dòng "Tiền hủy".

### Tests
- `guards.test.ts`: default theo role; cashier có grant → được; admin bị denies → cấm; inactive/null → cấm; requirePermission throw FORBIDDEN.
- `voidOrder.test.ts` (flow): void giữ nguyên total/paidAt/payment; cashier bị chặn; cashier có grant được; other-thiếu-note → VOID_REASON_REQUIRED (không gọi repo); lock cũ + double-void → conflict; report revenue giảm đúng + voidCount/voidAmount đúng + history paid/void; đơn open hủy trước thanh toán không vào void stats.
- `mockRepos.test.ts`: guardrail NOT_FOUND / non-paid / thiếu quyền.
- `repos.test.ts`: contract rpc `void_order` (5 tham số) + mapVoidOrderResult; mapOrderDetail void fields; mapEmployee permission_overrides (null/rác → undefined).
- `orderHistoryVoid.test.tsx` (component, render App thật): admin void qua port đúng input; cashier không thấy nút; other-thiếu-note disable confirm; đơn void hiện người hủy + in lại disabled.
- `reportHelpers.test.ts`: cộng voidCount/voidAmount từ CoreReport.
- `npm run build` + `npm test` (231 test) xanh. Verify trực quan mock mode: admin hủy đơn #23 (77.000đ) → badge Đã hủy, khối người hủy/lý do đúng, nút in lại disabled, popup cảnh báo đúng số tiền/ngày.

## Validate trên Supabase cloud (2026-07-16)

Áp `011_void_paid_order.sql` lên cloud rồi chạy E2E thật (`smoke:supabase`) — bắt được một bug
mà mock không lộ:

- **Conflict giả khi hủy đơn vừa thanh toán.** Cache order-detail (TanStack Query) sau khi
  thanh toán có thể còn `lock_version` cũ (phiên bản lúc đơn còn `open`, trước khi pay bump
  version). Popup hủy đọc `selectedDetail.lockVersion` từ cache đó → gửi version cũ lên
  `void_order` → server trả `ORDER_VERSION_CONFLICT` dù chẳng có ai sửa đơn. An toàn (server
  từ chối, không hủy sai) nhưng UX sai: lần hủy đầu báo "dữ liệu đã thay đổi".
- **Fix (tất định):** `confirmVoid` **refetch order detail ngay trước khi hủy** và dùng
  `lock_version` tươi từ kết quả refetch (không phụ thuộc trạng thái cache/poll); chặn
  double-click bằng cờ `isVoiding`; nếu sau refetch đơn không còn `paid` thì báo tải lại thay
  vì gọi RPC. `void_order` và `verify_employee_pin` (đã đổi return type) chạy đúng trên cloud.
- Bổ sung E2E `tests/supabase`: admin tạo store → thanh toán → hủy đơn (chọn lý do) → assert
  popup đóng, khối "Người hủy" hiện, badge chuyển "Đã hủy". Chạy lặp 3× đều pass.

## Lưu ý vận hành

- **Phải áp `011_void_paid_order.sql`** lên Supabase (sau 010): thêm cột orders/employees, drop+tạo lại `verify_employee_pin` và `void_order`. Mock mode đủ tính năng, không cần migration.
- Realtime không cần đổi: void bump `orders` (đã publish) → các máy khác invalidate open orders + report + order detail.
- Chưa làm (phase phân quyền sau): UI chỉnh `permission_overrides` per-employee trong EmployeesDrawer; gắn `requirePermission` vào các flow còn lại (tạo đơn/thanh toán); RPC guardrail đọc overrides cho các RPC cũ.
