# Context: POS Quán Cà Phê (đa thiết bị, online-only) — TLCN

> **Cập nhật 2026-07-22 sau audit code/docs và chốt kitchen là future-only.** Tóm tắt nhanh cho mỗi session.
> **App truth hiện tại:** baseline `main@7a00fd0`; catalog decor phase 21 đã push; UI hiện tại chỉ mở role Quản lý/Thu ngân, còn kitchen giữ seam code/schema cho tương lai.
> **Docs branch:** nhánh `docs` độc lập, chỉ giữ Markdown knowledge base; không merge vào `main`.
> **Spec đầy đủ (archive):** [docs/archive/superpowers/specs/2026-06-09-pos-cafe-design.md](docs/archive/superpowers/specs/2026-06-09-pos-cafe-design.md)
> **Architecture summary:** [docs/architecture.md](docs/architecture.md)
> **Implementation log:** [docs/implementation-log/README.md](docs/implementation-log/README.md)
> **Demo runbook:** [docs/demo-runbook.md](docs/demo-runbook.md)

## Tóm tắt 1 phút

- **Đề tài:** Quản lý order quán cà phê **đa thiết bị đồng bộ song song**, phân quyền vai trò. Không phải bài toán quản lý chuỗi đa chi nhánh. TLCN, < 1 tháng, 2h/ngày, 0đ. **AI lập trình chính**.
- **Flagship:** Menu Editor + Floor-Plan Editor (sơ đồ bàn trực quan).

## Trạng thái hiện tại (2026-07-22)

- **Main đã đối chiếu:** `main@7a00fd0`; phase 21 catalog decor đã commit/push. Phase 20 phân quyền và migration 012 đã commit/apply trước đó.
- **Docs mới nhất:** nhánh `docs` là knowledge base độc lập, chỉ lưu `.md`; không chứa source code, package/config, HTML prototype, screenshot binary hoặc file tạm.
- **Đã xong trong code:** DB/RPC foundation, Supabase/mock adapters, Store/Auth/Seed, POS order/payment, admin, realtime, UI binding/hardening, instant pay, hủy đơn paid, report audit, editor quyền per-employee và catalog 9 texture tường + 131 ảnh decor cho Floor Editor/POS.
- **Role hiện hành:** UI chỉ cho `admin` và `cashier`. `kitchen` còn trong enum/schema/core để mở rộng sau nhưng đã ẩn khỏi nav, drawer registry, màn PIN và form tạo/sửa nhân viên; kitchen queue chưa phải tính năng hiện tại.
- **Validation local mới nhất:** `npm test -- --maxWorkers=1` pass 48 files/252 tests, `npm run build` pass với Vite chunk-size warning đã biết, `npm run smoke` pass 34/31 theo điều kiện viewport; smoke xác nhận kitchen nav không còn xuất hiện.
- **Backlog kỹ thuật còn lại:** kitchen queue backend thật khi có yêu cầu dữ liệu bếp, bundle/code-splitting để xử lý chunk-size warning, exit animation khi đóng drawer/popup nếu cần polish, screenshot artefact riêng cho tiểu luận nếu cần hình minh họa.

## Quyết định đã chốt

| Hạng mục | Chốt |
|---|---|
| Ngôn ngữ | **TypeScript** |
| Stack | React + Vite + TS + Tailwind + MUI controls + Zustand + TanStack Query + Supabase + Recharts + react-hot-toast. Form hiện dùng controlled state/validation thủ công; RHF/Zod có trong dependency nhưng chưa dùng trong `src`. Package: npm. Deploy Vercel + Supabase free |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) |
| Kiến trúc | **Hexagonal** — Core thuần, chỉ adapter import Supabase |
| Navigation | **Single URL** (`/` hoặc `/app`) + internal app state; không dùng browser history cho workflow POS/admin |
| Multi-tenant | Row-level: `store_id` mọi bảng + RLS cô lập theo store account; đây là tenant boundary cho nhiều quán/account, không phải feature quản lý đa chi nhánh trong UI MVP |
| **Auth** | **Store Key** (`STORE_NO-SECRET`, vd `0001-X8F3QA`) ghép máy 1 lần → session persist → daily **chọn nhân viên + PIN**. `STORE_NO` lấy bằng sequence, được hở số, nhưng **không được nhập mỗi số để vào quán**; secret là credential. Không persist raw Store Key/secret sau pairing/create |
| Role enforce | Cô lập **store** = RLS (DB). UI hiện chỉ mở `admin`/`cashier`; `kitchen` là enum/seam tương lai và không xuất hiện trong luồng người dùng. Module visibility theo role; 5 action permission có default theo role + override từng nhân viên (`grants`/`denies`). Flow là chốt client, RPC đọc override live làm guardrail/audit; không claim DB-level employee security. Client giữ snapshot quyền tại login nên phải đăng nhập lại sau khi đổi quyền. PIN verify bằng SQL RPC + `pgcrypto`; client không đọc `passcode_hash` |
| Backend contract | SQL migrations trong `supabase/migrations` apply cloud trực tiếp: `001` schema/enums, `002` indexes/RLS/triggers, `003` RPC/functions, `004` realtime publication, `005`–`006` menu image storage, `007` full wipe, `008` shared modifiers, `009` partial payment (superseded), `010` instant-pay split-order, `011` void-paid-order + `employees.permission_overrides`, `012` action-permission guardrails cho `submit_order_changes`/`pay_order`/`pay_order_items`. RPC critical: `get_next_store_no`, `verify_employee_pin`, `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`, `clear_demo_data`, helper `has_employee_permission`. Cloud đã verify qua migration 012; E2E deny-permission gọi thẳng RPC trả `FORBIDDEN` đúng |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders, payments, tables, menu, floor/decor) làm signal invalidation/refetch. Query floor/open orders/order detail có polling 5s. Giới hạn đã biết: adapter chưa subscribe `menu_item_option_groups`, nên thao tác chỉ gắn/bỏ modifier khỏi món cần refresh/reconnect để máy khác thấy. Offline-first **HOÃN sang mở rộng** |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase. Máy khác realtime-refetch phần lớn thay đổi; riêng link món–modifier đang có giới hạn nêu trên |
| **Demo** | Tạo quán Supabase mặc định **trống** (store/settings + 1 admin); checkbox seed demo mặc định tắt. Khi bật, seed TS bundle bằng deterministic IDs + `seed_key`, retry idempotent; lỗi seed không làm mất store. Clear demo admin-only, block nếu còn open order. Runtime có mock seeded dành cho dev/test; nếu Vercel thiếu cấu hình Supabase và không ép mode, app sẽ fallback mock |
| Landing UI | Render bằng app state: **2 thẻ** "Đã có quán" (nhập key) \| "Tạo quán mới" (checkbox dữ liệu mẫu tùy chọn) |
| Licensing | Conceptual/app-layer: `stores.is_active=false` → khóa. Muốn khóa thật ở DB thì RLS/RPC phải check `stores.is_active`; MVP chưa claim DB-level license enforcement. Không billing thật |

## Data model (15 bảng chính)
`stores` · `employees`(passcode+role+permission overrides) · `store_settings` · `categories` · `menu_items`(upload ảnh qua Storage, lưu `image_asset_key`) · `option_groups` · `option_values` · `menu_item_option_groups` · `floor_areas` · `tables`(area,x,y,layout,status) · `floor_decor_items`(area,asset_key/layout,không order/status) · `orders`(`lock_version`) · `payments` · `order_items` · `order_item_options`. Giá **snapshot** lúc order.

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values/menu_item_option_groups`) và có option/topping dùng chung nhiều-nhiều. Floor plan lưu `floor_areas` + từng bàn là row `tables` + `floor_decor_items`; decor chỉ render, **không có status/không nhận order**. Decor dùng catalog built-in 9 texture tường + 131 ảnh, DB chỉ lưu public path trong `asset_key`; key legacy fallback placeholder và user chưa upload/custom decor. UI sửa local, bấm **Save** mới ghi changeset `created/updated/deleted`; deleted là tombstone. Realtime chỉ là tín hiệu invalidation/refetch, không patch cache; link `menu_item_option_groups` hiện là ngoại lệ chưa được adapter subscribe. Floor-plan save không ghi đè `tables.status`.

## Navigation
MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Mọi màn hình render theo internal state: pairing/create-store/passcode/posFloor/order/payment/adminMenu/adminFloorPlan/employees/report/orderHistory/settings. Browser Back/Forward **không phải workflow nghiệp vụ**; mutation chỉ qua nút rõ ràng như Save/Pay/Void/Clear demo. Current employee giữ memory-only: refresh an toàn là chưa pair → pairing, đã pair → passcode. Editor dirty state phải confirm nội bộ khi chuyển màn.

## Frontend/UI
Zustand giữ app/draft state, TanStack Query giữ server state/cache; form hiện dùng controlled state và validation thủ công. UI tiếng Việt, primary teal `#0F766E`, landscape-first; portrait hiện hướng dẫn xoay ngang. App shell dùng `LeftNav` rộng 176px/68px. Module hiện mở bằng `PortalDrawer` **toàn màn hình** (`viewport="screen"`) và che rail; overlay mặc định `rgba(0,0,0,0.2)`, click ngoài đóng, có slide-in. `PortalPopup` cũng full-screen để chặn toàn app khi cần. Drawer cố định viewport, pane tự scroll. Order drawer giữ category/menu/cart; cart footer sticky. Floor toolbar giữ area tabs, filter, `Làm mới`. Floor plan dùng logical stage `1600x900` và **scale-to-fit tự động**, chưa có pan/zoom thủ công; drag/resize dùng ref/requestAnimationFrame và commit draft ở pointerup.

## Payment/order
Order draft chỉ lưu DB khi bấm **In/Gửi đơn** qua `submit_order_changes`; bàn trống chưa tạo DB, adapter sinh UUID client cho order mới. Submit dùng replace lines, DB snapshot giá/tên/options và tính total. Toàn bộ item về 0 → order `void`, table empty. Order/payment dùng `lock_version`; conflict refetch. 5 quyền runtime: `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`; UI hiện chỉnh quyền cho admin/cashier. Migration 012 guardrail RPC đọc override live. `void_order` giữ total/order_no/paid_at/payment + audit và loại khỏi doanh thu. **Instant pay:** tách món thành đơn mới độc lập, đơn tách kế thừa số cũ, đơn gốc nhận số mới. Payment cash-only. Preview/in nằm ở UI `ReceiptPreview` qua iframe browser print; `BrowserPrintPort` hiện no-op và chỉ giữ seam cho thiết bị thật. Kitchen queue là future-only, không đăng ký trong app shell.

## Ports/seed/tasks
Ports theo domain repo (`Auth/Employee/Menu/FloorPlan/Order/Payment/Report/Settings/Seed/Print/Realtime`), Core/UI dùng camelCase, adapter map snake_case, repo mặc định lọc `deleted_at is null`, lỗi dùng `AppError` gồm `ORDER_VERSION_CONFLICT` + menu unavailable. Realtime tập trung ở `IRealtimePort`/`useRealtimeInvalidation` để invalidate và refetch active TanStack Query; floor/open order/order detail có polling 5s khi active để hồi phục nếu missed websocket event. Seed demo: admin PIN `123456`, cashier PIN `111111`, menu/option cơ bản, 1 area/4 bàn và 7 decor ảnh built-in; mock showcase đầy đủ hơn có 2 areas/14 bàn và 13 decor ảnh. Main hiện đã chứa architecture boundary scanner, split Supabase/mock adapters, runtime port factory, store session flow, POS order/payment hooks, admin hooks, UI error mapper, dirty/save helpers, realtime invalidation hook, Supabase adapter param-shape tests và mock data parity cho takeaway/report/history/editor changesets. Boundary cleanup mới nhất: demo seed data ở `src/seed/demoSeedData.ts`, `PortsContext` ở `src/features/shared/portsContext.tsx`, query keys ở `src/features/shared/queryKeys.ts`, `src/ports` giữ interface/type-only.

## Delete policy
Dữ liệu editor/sync (`categories/menu_items/option_groups/option_values/menu_item_option_groups/floor_areas/tables/floor_decor_items`) **không hard-delete** từ UI; dùng tombstone `deleted_at` + `deleted_by_employee_id`. `orders` huỷ bằng `status=void`; `order_items` xoá bằng `status=removed`.

## Initial load
Khi vào app/POS chỉ load dữ liệu đang cần: employees active, settings, menu active, floor plan active (`floor_areas/tables/floor_decor_items`), open orders/chưa thanh toán. **Không load toàn bộ order history/report**. Order history/report fetch riêng khi vào màn đó, mặc định hôm nay, có filter 7 ngày/tháng/khoảng ngày và limit/phân trang nếu dài. Report MVP chỉ tính order `paid`, loại `void`, theo `business_date`/timezone store.

## Màn hình
landing(2 thẻ) · store-pairing · create-store · passcode · quản-lý-NV · menu-editor⭐ · floor-plan-editor⭐ · report · floor-plan(view) · order · payment · order-history · general-setting(+clear demo) · payment-setting(opt). Kitchen queue không phải màn hiện hành.

## Tier
- **1 MVP:** landing/pairing/create(+seed demo)/passcode, NV+role, menu-editor⭐ có option/topping, floor-plan-editor⭐ có floor areas/khu/tầng + decor cơ bản, order dine-in+takeaway, payment cash+bill, core report, general-setting
- **2 nếu kịp:** history filter nâng cao, tinh chỉnh editor nâng cao, report mở rộng
- **3 mở rộng sau:** role/module kitchen + queue backend thật, gộp bàn, QR, discount/voucher UI

## Ngoài scope
kho · loyalty · chấm công · native · **offline-first/local DB (online-only)** · billing · super-admin

## Caveat nhớ khi bảo vệ
- **Passcode chỉ chặn tầng app**, không phải rào DB (Store Key + ghép máy = đọc được data quán qua API). Store Key = bí mật cấp quán như license.
- RPC role check là guardrail nghiệp vụ/audit, spoofable nếu có Store Key/session; không thay thế RLS theo từng nhân viên.
- **Online-only** — mất mạng không dùng được. Offline-first HOÃN sang mở rộng, **đã chừa seam** (UUID client, updated_at, `deleted_at` tombstone, ports/transport cô lập — spec §12.1). GV hỏi → "điểm yếu đã biết, seam sẵn, mở rộng sau".
- Supabase free **pause sau ~7 ngày** → wake trước demo.

## Deploy (0đ, demo live — spec §14)
FE → Vercel free · BE → Supabase managed (không server code deploy). Bắt buộc cấu hình `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; thiếu cấu hình có thể làm runtime fallback sang mock seeded. Tắt "Confirm email" để signUp Store Key có session ngay. Online-only → chuẩn bị hotspot khi demo.

## Luật cứng khi build (seam offline — spec §12.2, enforce mọi task)
1. UUID sinh **client** (không Postgres default) · 2. Dữ liệu sync/editor **không hard-delete** (`deleted_at` tombstone; order→void; item→removed) · 3. **Supabase type không lọt Core** (chỉ adapter biết) · 4. Realtime **gom 1 module** (`useRealtime`) · 5. Order/payment phải dùng `lock_version`/`expectedVersion`. Vi phạm = seam hỏng.

## Bước kế
Kitchen đã được chốt future-only và ẩn khỏi UI hiện hành. Việc nên làm tiếp: bổ sung realtime subscription cho `menu_item_option_groups`, tối ưu bundle/code-splitting, rồi refresh screenshot/artefact cho báo cáo.
