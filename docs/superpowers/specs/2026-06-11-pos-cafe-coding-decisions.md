# Coding Decisions — POS Cafe

> **Ngày chốt:** 2026-06-11  
> **Vai trò:** tóm tắt các quyết định chuẩn bị coding, dùng để chia task/session/agent.  
> **Spec tổng thể:** [2026-06-09-pos-cafe-design.md](2026-06-09-pos-cafe-design.md)  
> **Schema/RLS:** [2026-06-10-pos-cafe-schema-rls-decisions.md](2026-06-10-pos-cafe-schema-rls-decisions.md)
> **Implementation contract:** [2026-06-11-pos-cafe-implementation-contract.md](2026-06-11-pos-cafe-implementation-contract.md)

---

## 1. Frontend state

- App dùng **single URL** (`/` hoặc `/app`), render theo internal state, không dùng browser history cho workflow POS/admin.
- **Zustand** giữ app state/draft state:
  - `currentScreen`
  - `currentEmployee` (**memory only**)
  - POS draft/order context
  - editor dirty state
- Current employee không lưu `localStorage`/`sessionStorage`.
- Refresh:
  - chưa pair store → `pairing`
  - đã pair store → `passcode`
  - không khôi phục `payment`, edit item, edit layout draft.
- **TanStack Query** giữ server state/cache: menu, floor plan, orders, settings, reports.
- Realtime event chỉ dùng để invalidate/refetch query, không patch state thủ công trong MVP.
- Passcode screen dùng flow **chọn nhân viên + nhập PIN**; không dùng PIN-only và không yêu cầu PIN unique toàn store.

---

## 2. UI target

- Target chính: **landscape-first** từ desktop/tablet tới điện thoại xoay ngang.
- Layout POS giữ cùng mô hình trên mọi màn hình ngang; không tách mobile app riêng.
- Phone portrait không cố render đầy đủ POS; hiển thị hướng dẫn xoay ngang để dùng.
- MUI dùng cho controls phổ biến: Button, Input, Dialog, Tabs, Table.
- Tailwind/custom CSS dùng cho layout, POS surface, floor plan, dense dashboard.
- Form dùng **React Hook Form + Zod**.
- UI mặc định dùng tiếng Việt.
- App shell dùng left rail (icon + label).
- Order screen dùng menu/category + cart panel bên phải.
- Admin editor dùng split-pane.
- Permission UI/Core guard:
  - Admin: menu/floor/employees/report/settings/clear demo + POS.
  - Cashier: floor/order/payment/order-history.
  - Kitchen role giữ enum/seam, chưa có màn MVP.

---

## 3. Floor-plan rendering

- Coordinate system: logical stage **1600x900 (16:9)**.
- Render stage bằng `scale-to-fit` theo container để không tràn/cắt bàn khi đổi thiết bị.
- `tables` và `floor_decor_items` render absolute trong stage.
- Drag/resize:
  - `pointermove` mutate DOM thật qua `ref` + `requestAnimationFrame`.
  - Không update React state từng pixel.
  - `pointerup` mới commit draft state vào Zustand.
  - Bấm Save mới ghi Supabase.
- Decor assets là ảnh built-in trong `src/assets/floor-decor`, DB chỉ lưu `asset_key`.

---

## 4. Backend/RPC

- Package manager: **npm**.
- Supabase schema/RLS/RPC quản lý bằng SQL migrations trong `supabase/migrations/*.sql`.
- Dev/apply trực tiếp lên Supabase cloud project; không dùng dashboard-only làm source of truth.
- Không bắt buộc Supabase local CLI/Docker trong MVP.
- Foundation migrations chia 3 file: `001_schema_enums.sql`, `002_indexes_rls_triggers.sql`, `003_rpc_functions.sql`.
- Store creation MVP:
  - FE gọi `get_next_store_no()`; RPC dùng Postgres sequence, race-safe, cho phép hở số.
  - FE sinh secret và Supabase `signUp`.
  - Client seed bằng TS seed bundle.
  - Nếu seed lỗi sau khi store tạo xong: set `seed_status=failed`, UI hiện retry seed, không bắt tạo lại store.
- PIN verify bằng SQL RPC + `pgcrypto`; client không đọc trực tiếp `passcode_hash`.
- RPC critical:
  - `get_next_store_no`
  - `verify_employee_pin`
  - `submit_order_changes`
  - `pay_order`
  - `clear_demo_data`
  - `void_order` reserved/admin/future only
- RPC nào insert row mới vẫn nhận UUID do client sinh trước khi gọi.
- `submit_order_changes` dùng typed scalar params + `jsonb` items/options payload, chiến lược **replace order lines**.
- DB là nguồn giá/tên: client gửi ids/quantity/note/options; RPC đọc menu/options active từ DB rồi snapshot tên + giá.
- Nếu menu item/option bị tombstone/unavailable lúc submit, RPC trả lỗi nghiệp vụ để UI refetch menu và giữ draft.
- `orders.lock_version int default 0`; `submit_order_changes` và `pay_order` nhận `expectedVersion`, check status + version trong transaction, lệch thì trả conflict.
- RPC kiểm tra employee active/role khi cần; `verify_employee_pin` trả safe employee không có hash.
- Role nhân viên vẫn là app-layer/Core guard; RPC role check là guardrail nghiệp vụ/audit, không claim DB-level role security.
- Exact RPC/port signatures nằm trong implementation contract; file này chỉ giữ tóm tắt coding decisions.

---

## 4.1 Ports/errors

- Domain repos/ports: `IAuthRepo`, `IEmployeeRepo`, `IMenuRepo`, `IFloorPlanRepo`, `IOrderRepo`, `IPaymentRepo`, `IReportRepo`, `ISettingsRepo`, `ISeedRepo`, `IPrintPort`.
- Core/UI dùng camelCase; Supabase adapter map snake_case DB rows sang entity/DTO thuần.
- Repo list/get mặc định lọc active rows (`deleted_at is null`); method đặc biệt mới include deleted rows.
- Adapter/service throw `AppError`, không leak raw Supabase errors lên Core/UI.
- Conflict order/payment map thành `AppError` code `ORDER_VERSION_CONFLICT`; UI báo dữ liệu đã thay đổi và yêu cầu tải lại.
- Menu unavailable khi submit map thành `MENU_ITEM_UNAVAILABLE`/`OPTION_VALUE_UNAVAILABLE`; UI refetch menu và giữ draft.
- `IPrintPort` MVP render HTML/template preview cho phiếu tạm và final bill; chưa tích hợp máy in thật.

---

## 5. Payment/order/report

- `payments` là bảng riêng.
- Order flow:
  - bấm bàn trống chỉ mở draft order UI, chưa tạo DB.
  - bấm **In/Gửi đơn** gọi `submit_order_changes`, lưu DB, in phiếu tạm, quay về floor plan.
  - order open submit theo replace order lines; DB snapshot `item_name`, `option_name`, `unit_price`, `price_delta`.
  - bàn có order open: có draft thay đổi thì **In/Gửi đơn**, không có draft thay đổi thì **Thanh toán**.
  - toàn bộ item về 0 + **In/Gửi đơn** → order open `void`, table `empty`.
  - takeaway có nút **Mang đi** + danh sách takeaway đang mở.
- `OrderSummary`/`OrderDetail` expose `lockVersion`; `SubmitOrderChangesInput` và `PayOrderInput` truyền `expectedVersion`.
- Payment UI MVP chỉ làm **cash**:
  - nhập tiền nhận
  - tính tiền thối
  - tạo payment row
  - set order paid
  - nếu dine-in thì set table empty
- Nếu tiền nhận nhỏ hơn total thì block complete và báo toast/popup.
- Complete thành công rồi mới render/in final bill.
- Paid order không void trong MVP.
- `payments.method` enum chừa: `cash`, `bank_transfer`, `qr`, `other`; UI phase này chỉ dùng `cash`.
- Discount/voucher UI không làm phase này.
- `orders.discount_type`/`discount_value` giữ để mở rộng sau.
- Tiền lưu integer VND.
- Order item/options snapshot cả tên + giá.
- Daily order no/report "hôm nay" theo `store_settings.timezone`, default `Asia/Saigon`.
- Report MVP chỉ tính `orders.status = paid`, loại `void`, lọc theo `business_date`.
- Kitchen queue không làm phase này; chỉ chừa seam `order_items.status = waiting|done|removed`.
- Report MVP: doanh thu theo ngày, số đơn, trung bình đơn, top món; query thiết kế để mở rộng sau.

---

## 6. Seed/assets

- Demo seed nằm trong repo dạng TypeScript seed bundle.
- `seed.demo` gồm:
  - admin PIN `123456` + cashier PIN `111111`
  - menu demo medium kiểu cafe Việt: 4 categories, 22 món
  - option groups/values cho size, đá, đường, topping, thêm shot
  - 2 floor areas: `Tầng trệt` 8 bàn, `Lầu 1` 6 bàn
  - decor dùng placeholder `asset_key` ổn định nếu chưa có ảnh thật
  - không seed order history
- `seed.blank` giữ đúng 1 admin + settings tối thiểu.
- Seed retry dùng lại seed demo idempotent khi `stores.seed_status=failed`.
- Decor image files nằm trong `src/assets/floor-decor`.
- MVP không upload/custom decor asset.
- Menu item MVP không upload ảnh; dùng text/placeholder hoặc built-in `image_asset_key`, không thêm Supabase Storage.

---

## 7. Tests/dev workflow

- Test strategy MVP:
  - **Vitest** cho core/services quan trọng.
  - Playwright hoặc manual smoke cho luồng demo chính.
- Smoke flow bắt buộc:
  - tạo store → seed demo → passcode
  - seed lỗi giả lập → `seed_status=failed` → retry seed thành công
  - order dine-in → chọn option → payment cash → table empty
  - submit order khi menu item/option unavailable → lỗi nghiệp vụ + refetch menu
  - 2 máy/double-click submit hoặc pay cùng order → `ORDER_VERSION_CONFLICT` và refetch
  - menu editor save → POS refetch menu
  - floor editor save table/decor → POS refetch floor plan
  - clear demo data → còn 1 admin
- Multi-agent strategy:
  - Stream 1 chạy trước: foundation/schema/RPC/migrations.
  - Stream 2 chạy sau khi Stream 1 ổn: core types/services/ports.
  - Stream 3: Supabase adapters.
  - Stream 4: auth/session/store flow.
  - Stream 5: menu + floor editors.
  - Stream 6: POS/order/payment/report/settings.
