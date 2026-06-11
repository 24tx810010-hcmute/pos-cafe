# Context: POS Quán Cà Phê (multi-store, online-only) — TLCN

> **Cập nhật 2026-06-11 sau foundation decisions.** Tóm tắt nhanh cho mỗi session.
> **Spec đầy đủ (source of truth):** [docs/superpowers/specs/2026-06-09-pos-cafe-design.md](docs/superpowers/specs/2026-06-09-pos-cafe-design.md)
> **Schema/RLS decisions:** [docs/superpowers/specs/2026-06-10-pos-cafe-schema-rls-decisions.md](docs/superpowers/specs/2026-06-10-pos-cafe-schema-rls-decisions.md)
> **Coding decisions:** [docs/superpowers/specs/2026-06-11-pos-cafe-coding-decisions.md](docs/superpowers/specs/2026-06-11-pos-cafe-coding-decisions.md)
> **Implementation contract:** [docs/superpowers/specs/2026-06-11-pos-cafe-implementation-contract.md](docs/superpowers/specs/2026-06-11-pos-cafe-implementation-contract.md)

## Tóm tắt 1 phút

- **Đề tài:** Quản lý order quán cà phê **đa chi nhánh**, phân quyền vai trò. TLCN, < 1 tháng, 2h/ngày, 0đ. **AI lập trình chính**.
- **Flagship:** Menu Editor + Floor-Plan Editor (sơ đồ bàn trực quan).

## Quyết định đã chốt

| Hạng mục | Chốt |
|---|---|
| Ngôn ngữ | **TypeScript** |
| Stack | React + Vite + TS + Tailwind + MUI controls + Zustand + TanStack Query + RHF/Zod + Supabase + recharts + react-hot-toast. Package: npm. Deploy Vercel + Supabase free |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) |
| Kiến trúc | **Hexagonal** — Core thuần, chỉ adapter import Supabase |
| Navigation | **Single URL** (`/` hoặc `/app`) + internal app state; không dùng browser history cho workflow POS/admin |
| Multi-tenant | Row-level: `store_id` mọi bảng + RLS cô lập theo store account |
| **Auth** | **Store Key** (`STORE_NO-SECRET`, vd `0001-X8F3QA`) ghép máy 1 lần → session persist → daily **chọn nhân viên + PIN**. `STORE_NO` lấy bằng sequence, được hở số, nhưng **không được nhập mỗi số để vào quán**; secret là credential |
| Role enforce | Cô lập **store** = RLS (DB). Role **nhân viên** = app-layer (Core guard), không claim DB-level role security. PIN verify bằng SQL RPC + `pgcrypto`; client không đọc `passcode_hash` |
| Backend contract | SQL migrations trong `supabase/migrations` apply cloud trực tiếp, 3 file foundation: schema/enums, indexes/RLS/triggers, RPC/functions. RPC critical: `get_next_store_no`(sequence), `verify_employee_pin`, `submit_order_changes`, `pay_order`, `clear_demo_data`; `void_order` reserved/admin/future |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders, tables, menu, floor/decor). Offline-first **HOÃN sang mở rộng**, chừa seam sẵn (spec §12.1) |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase; máy khác nhận Realtime event rồi **refetch** menu/floor plan |
| **Demo** | Seed-on-create: tạo quán → seed sẵn demo từ TS seed bundle (**user+menu+sơ đồ bàn/decor**). Nếu seed lỗi: `seed_status=failed` + retry seed, không tạo lại store. Nút "Clear demo data" admin-only, block nếu còn open orders, sau đó tombstone demo data, chừa 1 admin. Không local demo mode |
| Landing UI | Render bằng app state: **2 thẻ** "Đã có quán" (nhập key) \| "Tạo quán mới" (seed demo) |
| Licensing | Conceptual: `stores.is_active=false` → khóa. Không billing thật |

## Data model (~15 bảng)
`stores` · `employees`(passcode+role) · `store_settings` · `categories` · `menu_items`(không upload ảnh; optional `image_asset_key`) · `option_groups` · `option_values` · `floor_areas` · `tables`(area,x,y,layout,status) · `floor_decor_items`(area,asset_key/layout,không order/status) · `orders`(`lock_version`) · `payments` · `order_items` · `order_item_options`. Giá **snapshot** lúc order. (Cột → spec §7)

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values`) và **MVP làm luôn option/topping** ở mức 1 cấp group/value; ảnh món không upload, dùng text/placeholder hoặc built-in `image_asset_key`. Floor plan lưu `floor_areas` + từng bàn là row `tables` có tọa độ/layout + `floor_decor_items` cho cây/tường/quầy/cửa/decor; decor chỉ render, **không có status/không nhận order**. Decor asset là ảnh built-in, DB chỉ lưu `asset_key`, user không upload/custom trong MVP. UI cho sửa local, bấm **Save** mới ghi Supabase bằng changeset `created/updated/deleted`; deleted là tombstone. Supabase Realtime chỉ dùng làm tín hiệu invalidation: máy khác nhận event thì gọi `refetchMenu()` hoặc `refetchFloorPlan()`, không patch state thủ công trong MVP. Floor-plan save chỉ cập nhật field layout/decor, **không ghi đè `tables.status`**.

## Navigation
MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Mọi màn hình render theo internal state: pairing/create-store/passcode/posFloor/order/payment/adminMenu/adminFloorPlan/employees/report/orderHistory/settings. Browser Back/Forward **không phải workflow nghiệp vụ**; mutation chỉ qua nút rõ ràng như Save/Pay/Void/Clear demo. Current employee giữ memory-only: refresh an toàn là chưa pair → pairing, đã pair → passcode. Editor dirty state phải confirm nội bộ khi chuyển màn.

## Frontend/UI
Zustand giữ app/draft state, TanStack Query giữ server state/cache, RHF+Zod validate form. UI tiếng Việt, landscape-first từ desktop/tablet tới phone xoay ngang; phone portrait hiện hướng dẫn xoay ngang. App shell dùng left rail; order screen menu/category + cart phải; admin editor split-pane. Floor plan dùng logical stage `1600x900`, scale-to-fit; drag/resize mutate DOM qua ref/requestAnimationFrame, pointerup mới commit draft.

## Payment/order
Order draft chỉ lưu DB khi bấm **In/Gửi đơn** qua `submit_order_changes`; bàn trống chưa tạo DB, bàn có order nếu không có draft thay đổi thì nút chính là **Thanh toán**. Submit order open dùng replace order lines; **DB là nguồn giá/tên**, RPC snapshot `item_name/option_name/unit_price/price_delta` từ menu active. Toàn bộ item về 0 + In/Gửi → order open `void`, table empty. Order/payment dùng `orders.lock_version` + `expectedVersion`; conflict trả `ORDER_VERSION_CONFLICT` và UI refetch. Payment có bảng `payments`; UI MVP chỉ cash, enum chừa `bank_transfer/qr/other`; Complete trước rồi mới render/in final bill, paid order không void trong MVP. Tiền integer VND, daily `order_no` theo `store_settings.timezone`. Print qua `IPrintPort` HTML/template preview. Kitchen queue không làm, chỉ giữ seam `order_items.status`.

## Ports/seed/tasks
Ports theo domain repo (`Auth/Employee/Menu/FloorPlan/Order/Payment/Report/Settings/Seed/Print`), Core/UI dùng camelCase, adapter map snake_case, repo mặc định lọc `deleted_at is null`, lỗi dùng `AppError` gồm `ORDER_VERSION_CONFLICT` + menu unavailable. Seed demo: admin PIN `123456`, cashier PIN `111111`, menu cafe Việt 4 categories/22 món, option size/đá/đường/topping/thêm shot, 2 areas 14 bàn, decor placeholder. Coding đi Stream 1 trước rồi Stream 2; sau foundation mới chia UI/adapters.

## Delete policy
Dữ liệu editor/sync (`categories/menu_items/option_groups/option_values/floor_areas/tables/floor_decor_items`) **không hard-delete** từ UI; dùng tombstone `deleted_at` + `deleted_by_employee_id`, query mặc định lọc `deleted_at is null`. `orders` huỷ bằng `status=void`; `order_items` xoá bằng `status=removed`. Đây là seam cho RxDB/offline sau này.

## Initial load
Khi vào app/POS chỉ load dữ liệu đang cần: employees active, settings, menu active, floor plan active (`floor_areas/tables/floor_decor_items`), open orders/chưa thanh toán. **Không load toàn bộ order history/report**. Order history/report fetch riêng khi vào màn đó, mặc định hôm nay, có filter 7 ngày/tháng/khoảng ngày và limit/phân trang nếu dài. Report MVP chỉ tính order `paid`, loại `void`, theo `business_date`/timezone store.

## Màn hình
landing(2 thẻ) · store-pairing · create-store · passcode · quản-lý-NV · menu-editor⭐ · floor-plan-editor⭐ · report · floor-plan(view) · order · payment · order-history · general-setting(+clear demo) · kitchen-queue(opt) · payment-setting(opt)

## Tier
- **1 MVP:** landing/pairing/create(+seed demo)/passcode, NV+role, menu-editor⭐ có option/topping, floor-plan-editor⭐ có floor areas/khu/tầng + decor cơ bản, order dine-in+takeaway, payment cash+bill, core report, general-setting
- **2 nếu kịp:** history filter nâng cao, tinh chỉnh editor nâng cao, report mở rộng
- **3 mở rộng sau:** gộp bàn, kitchen queue, QR, discount/voucher UI

## Ngoài scope
kho · loyalty · chấm công · native · **offline-first/local DB (online-only)** · billing · super-admin

## Caveat nhớ khi bảo vệ
- **Passcode chỉ chặn tầng app**, không phải rào DB (Store Key + ghép máy = đọc được data quán qua API). Store Key = bí mật cấp quán như license.
- RPC role check là guardrail nghiệp vụ/audit, không thay thế RLS theo từng nhân viên.
- **Online-only** — mất mạng không dùng được. Offline-first HOÃN sang mở rộng, **đã chừa seam** (UUID client, updated_at, `deleted_at` tombstone, ports/transport cô lập — spec §12.1). GV hỏi → "điểm yếu đã biết, seam sẵn, mở rộng sau".
- Supabase free **pause sau ~7 ngày** → wake trước demo.

## Deploy (0đ, demo live — spec §14)
FE → Vercel free · BE → Supabase managed (không server code deploy). GV mở URL công khai, 2 máy sync realtime live. **Gotcha:** free pause sau 7 ngày → cron GitHub Action ping/ngày; online-only → mang hotspot 4G; tắt "Confirm email" để signUp instant.

## Luật cứng khi build (seam offline — spec §12.2, enforce mọi task)
1. UUID sinh **client** (không Postgres default) · 2. Dữ liệu sync/editor **không hard-delete** (`deleted_at` tombstone; order→void; item→removed) · 3. **Supabase type không lọt Core** (chỉ adapter biết) · 4. Realtime **gom 1 module** (`useRealtime`) · 5. Order/payment phải dùng `lock_version`/`expectedVersion`. Vi phạm = seam hỏng.

## Bước kế
Docs đã khóa foundation options; bước kế tiếp là tạo task plan cho Stream 1 schema/RLS/RPC migrations trước, rồi Stream 2 core types/services/ports.
