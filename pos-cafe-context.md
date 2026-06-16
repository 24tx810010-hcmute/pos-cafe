# Context: POS Quán Cà Phê (đa thiết bị, online-only) — TLCN

> **Cập nhật 2026-06-16 sau live deploy + payment sync hardening.** Tóm tắt nhanh cho mỗi session.
> **Spec đầy đủ (source of truth):** [docs/superpowers/specs/2026-06-09-pos-cafe-design.md](docs/superpowers/specs/2026-06-09-pos-cafe-design.md)
> **Schema/RLS decisions:** [docs/superpowers/specs/2026-06-10-pos-cafe-schema-rls-decisions.md](docs/superpowers/specs/2026-06-10-pos-cafe-schema-rls-decisions.md)
> **Coding decisions:** [docs/superpowers/specs/2026-06-11-pos-cafe-coding-decisions.md](docs/superpowers/specs/2026-06-11-pos-cafe-coding-decisions.md)
> **Implementation contract:** [docs/superpowers/specs/2026-06-11-pos-cafe-implementation-contract.md](docs/superpowers/specs/2026-06-11-pos-cafe-implementation-contract.md)
> **Integration checklist:** [docs/superpowers/specs/2026-06-12-pos-cafe-integration-checklist.md](docs/superpowers/specs/2026-06-12-pos-cafe-integration-checklist.md)
> **Supabase cloud setup:** [docs/superpowers/specs/2026-06-12-pos-cafe-supabase-cloud-setup-checklist.md](docs/superpowers/specs/2026-06-12-pos-cafe-supabase-cloud-setup-checklist.md)
> **Demo readiness runbook:** [docs/superpowers/specs/2026-06-14-pos-cafe-demo-readiness-runbook.md](docs/superpowers/specs/2026-06-14-pos-cafe-demo-readiness-runbook.md)

## Tóm tắt 1 phút

- **Đề tài:** Quản lý order quán cà phê **đa thiết bị đồng bộ song song**, phân quyền vai trò. Không phải bài toán quản lý chuỗi đa chi nhánh. TLCN, < 1 tháng, 2h/ngày, 0đ. **AI lập trình chính**.
- **Flagship:** Menu Editor + Floor-Plan Editor (sơ đồ bàn trực quan).

## Trạng thái hiện tại (2026-06-16)

- **Main đã nhận đủ code + docs:** code integration và docs readiness đã squash-merge vào `main`, branch `main` đã push lên remote. Worktree code `D:\Workspace\pos-cafe-code` vẫn ở `ui-logic-integration`, docs worktree `D:\Workspace\pos-cafe-docs` vẫn ở `docs` để tiếp tục làm song song nếu cần.
- **Đã xong:** DB/RPC foundation, Supabase adapter foundation, Store/Auth/Seed logic, POS order/payment hooks, admin hooks nền, Supabase cloud RPC/REST E2E, UI foundation binding, Employees binding slice, Menu editor changeset save binding, Floor editor changeset save binding, Report/History polish binding, Supabase single/2-browser UI E2E, Demo Hardening, Demo Readiness runbook, Vercel deploy config, live deploy verification và payment sync hardening.
- **Hotfix live mới nhất:** `Fix payment path for existing orders` xử lý draft tái dùng DB item IDs khi mở lại order cũ; `Harden live payment sync` xử lý stale payment drawer khi 2 thiết bị cùng mở thanh toán một order. Payment/order/floor queries có active refetch qua realtime event và polling hồi phục nhẹ; paid/closed order khóa nút thanh toán và hiện cảnh báo đã cập nhật.
- **Validation mới nhất trên main:** `npm run test` (21 files/82 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` (2 passed), `git diff --check` đều pass trước khi push live hardening. Live Playwright 2-browser đã tái hiện case stale payment drawer trên deployment cũ và fix đã được push/deploy lại.
- **Phase nhỏ tiếp theo:** demo acceptance/final rehearsal trên live URL: test 2 thiết bị cùng Store Key, cả case floor sync cơ bản và case hai máy cùng mở payment drawer trước khi một máy thanh toán.

## Quyết định đã chốt

| Hạng mục | Chốt |
|---|---|
| Ngôn ngữ | **TypeScript** |
| Stack | React + Vite + TS + Tailwind + MUI controls + Zustand + TanStack Query + RHF/Zod + Supabase + recharts + react-hot-toast. Package: npm. Deploy Vercel + Supabase free |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) |
| Kiến trúc | **Hexagonal** — Core thuần, chỉ adapter import Supabase |
| Navigation | **Single URL** (`/` hoặc `/app`) + internal app state; không dùng browser history cho workflow POS/admin |
| Multi-tenant | Row-level: `store_id` mọi bảng + RLS cô lập theo store account; đây là tenant boundary cho nhiều quán/account, không phải feature quản lý đa chi nhánh trong UI MVP |
| **Auth** | **Store Key** (`STORE_NO-SECRET`, vd `0001-X8F3QA`) ghép máy 1 lần → session persist → daily **chọn nhân viên + PIN**. `STORE_NO` lấy bằng sequence, được hở số, nhưng **không được nhập mỗi số để vào quán**; secret là credential. Không persist raw Store Key/secret sau pairing/create |
| Role enforce | Cô lập **store** = RLS (DB). Role **nhân viên** = app-layer (Core guard), không claim DB-level role security. RPC role check chỉ là guardrail/audit spoofable nếu có Store Key. PIN verify bằng SQL RPC + `pgcrypto`; client không đọc `passcode_hash` |
| Backend contract | SQL migrations trong `supabase/migrations` apply cloud trực tiếp, 3 file foundation: schema/enums, indexes/RLS/triggers, RPC/functions. RPC critical: `get_next_store_no`(sequence), `verify_employee_pin`, `submit_order_changes`, `pay_order`, `clear_demo_data`; `void_order` reserved/admin/future. Local validation 2026-06-11: PostgreSQL 18.4 qua Scoop, temp DB, apply `001`/`002`/`003` pass, RPC smoke/negative smoke pass. Supabase cloud validation 2026-06-12 pass: env/Auth settings OK, tables/RPC reachable, cloud E2E create store test + seed tối thiểu + verify PIN + submit/pay/clear-demo pass. Migration fix `ae1523b` dùng `extensions.crypt/gen_salt` cho pgcrypto trên Supabase cloud |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders, payments, tables, menu, floor/decor) làm signal invalidation/refetch. Query floor/open orders/order detail có polling nhẹ để hồi phục nếu tab vừa pair/login miss event. Offline-first **HOÃN sang mở rộng**, chừa seam sẵn (spec §12.1) |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase; máy khác nhận Realtime event rồi **refetch** menu/floor plan |
| **Demo** | Seed-on-create: tạo quán → seed sẵn demo từ TS seed bundle (**user+menu+sơ đồ bàn/decor**) bằng deterministic IDs + `seed_key` theo `store_id + seed_key` để retry idempotent. Nếu seed lỗi: `seed_status=failed` + retry seed, không tạo lại store. Nút "Clear demo data" admin-only, block nếu còn open orders, tombstone đúng seed data, deactive cashier demo, chừa 1 admin. Không local demo mode |
| Landing UI | Render bằng app state: **2 thẻ** "Đã có quán" (nhập key) \| "Tạo quán mới" (seed demo) |
| Licensing | Conceptual/app-layer: `stores.is_active=false` → khóa. Muốn khóa thật ở DB thì RLS/RPC phải check `stores.is_active`; MVP chưa claim DB-level license enforcement. Không billing thật |

## Data model (~15 bảng)
`stores` · `employees`(passcode+role) · `store_settings` · `categories` · `menu_items`(không upload ảnh; optional `image_asset_key`) · `option_groups` · `option_values` · `floor_areas` · `tables`(area,x,y,layout,status) · `floor_decor_items`(area,asset_key/layout,không order/status) · `orders`(`lock_version`) · `payments` · `order_items` · `order_item_options`. Giá **snapshot** lúc order. (Cột → spec §7)

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values`) và **MVP làm luôn option/topping** ở mức 1 cấp group/value; ảnh món không upload, dùng text/placeholder hoặc built-in `image_asset_key`. Floor plan lưu `floor_areas` + từng bàn là row `tables` có tọa độ/layout + `floor_decor_items` cho cây/tường/quầy/cửa/decor; decor chỉ render, **không có status/không nhận order**. Decor asset là ảnh built-in, DB chỉ lưu `asset_key`, user không upload/custom trong MVP. UI cho sửa local, bấm **Save** mới ghi Supabase bằng changeset `created/updated/deleted`; deleted là tombstone. Supabase Realtime chỉ dùng làm tín hiệu invalidation: máy khác nhận event thì gọi `refetchMenu()` hoặc `refetchFloorPlan()`, không patch state thủ công trong MVP. Floor-plan save chỉ cập nhật field layout/decor, **không ghi đè `tables.status`**.

## Navigation
MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Mọi màn hình render theo internal state: pairing/create-store/passcode/posFloor/order/payment/adminMenu/adminFloorPlan/employees/report/orderHistory/settings. Browser Back/Forward **không phải workflow nghiệp vụ**; mutation chỉ qua nút rõ ràng như Save/Pay/Void/Clear demo. Current employee giữ memory-only: refresh an toàn là chưa pair → pairing, đã pair → passcode. Editor dirty state phải confirm nội bộ khi chuyển màn.

## Frontend/UI
Zustand giữ app/draft state, TanStack Query giữ server state/cache, RHF+Zod validate form. UI tiếng Việt, primary teal `#0F766E`, neutral modern. Landscape-first từ desktop/tablet tới phone xoay ngang; phone landscape vẫn truy cập đủ MVP, không cắt POS/report/editor theo thiết bị; phone portrait hiện hướng dẫn xoay ngang. App shell dùng left rail; mọi module mở overlay drawer theo internal state: desktop `80-90vw`, tablet `90-96vw`, small `100vw`. Body/shell không scroll tự do: drawer cố định viewport, header/action bar sticky, từng pane tự `overflow:auto`. Module giữ mental model 3 vùng trên mọi màn ngang: trái category/filter/navigation, giữa content chính, phải detail/cart/payment/properties; order drawer category trái + menu grid giữa + cart phải, cart footer sticky. UI reference: `docs/superpowers/assets/pos-cafe-ui-overview.png` + `docs/superpowers/ui-prototype/pos-cafe-ui-reference.html`; responsive shell: `docs/superpowers/ui-prototype/pos-cafe-responsive-shell.html`, screenshots `1024x600`/`844x390`/`740x360`. Floor plan dùng logical stage `1600x900`, scale-to-fit; pan/zoom canvas riêng; drag/resize mutate DOM qua ref/requestAnimationFrame, pointerup mới commit draft.

## Payment/order
Order draft chỉ lưu DB khi bấm **In/Gửi đơn** qua `submit_order_changes`; bàn trống chưa tạo DB, adapter sinh UUID client cho order mới trước khi gọi RPC, bàn có order nếu không có draft thay đổi thì nút chính là **Thanh toán**. Khi load order cũ vào draft, item/option draft IDs phải là UUID mới, không tái dùng `order_items.id`/`order_item_options.id` trong DB. Submit order open dùng replace order lines **không hard-delete**: mark item cũ `removed`, insert snapshot mới; **DB là nguồn giá/tên**, RPC snapshot `item_name/option_name/unit_price/price_delta` từ menu active và tính total trong transaction. Toàn bộ item về 0 + In/Gửi → order open `void`, table empty. Order/payment dùng `orders.lock_version` + `expectedVersion`; conflict trả `ORDER_VERSION_CONFLICT` và UI refetch. Payment có bảng `payments` với `employee_id`; UI MVP chỉ cash, enum chừa `bank_transfer/qr/other`; Complete trước rồi mới render/in final bill, paid order không void trong MVP. Nếu thiết bị khác đã thanh toán/đóng order trong khi payment drawer còn mở, order detail refetch sẽ chuyển UI sang trạng thái closed, disable nút thanh toán và hiện cảnh báo. Tiền integer VND, daily `order_no` theo `store_settings.timezone`. Print qua `IPrintPort` HTML/template preview. Kitchen queue không làm, chỉ giữ seam `order_items.status`.

## Ports/seed/tasks
Ports theo domain repo (`Auth/Employee/Menu/FloorPlan/Order/Payment/Report/Settings/Seed/Print/Realtime`), Core/UI dùng camelCase, adapter map snake_case, repo mặc định lọc `deleted_at is null`, lỗi dùng `AppError` gồm `ORDER_VERSION_CONFLICT` + menu unavailable. Realtime tập trung ở `IRealtimePort`/`useRealtimeInvalidation` để invalidate và refetch active TanStack Query; floor/open order/order detail có polling 5s khi active để hồi phục nếu missed websocket event. Seed demo: admin PIN `123456`, cashier PIN `111111`, menu cafe Việt 4 categories/22 món, option size/đá/đường/topping/thêm shot, 2 areas 14 bàn, decor placeholder. Main hiện đã chứa DB/RPC foundation, Supabase adapter foundation, runtime port factory, store session flow, POS order/payment hooks, admin hooks, UI error mapper, dirty/save helpers, realtime invalidation hook, Supabase adapter param-shape tests, mock data parity cho takeaway/report/history/editor changesets và boundary cleanup: demo seed data ở `src/seed/demoSeedData.ts`, `PortsContext` ở `src/ports/portsContext.tsx`, query keys ở `src/features/shared/queryKeys.ts`, root `txt.txt` đã xoá.

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
- RPC role check là guardrail nghiệp vụ/audit, spoofable nếu có Store Key/session; không thay thế RLS theo từng nhân viên.
- **Online-only** — mất mạng không dùng được. Offline-first HOÃN sang mở rộng, **đã chừa seam** (UUID client, updated_at, `deleted_at` tombstone, ports/transport cô lập — spec §12.1). GV hỏi → "điểm yếu đã biết, seam sẵn, mở rộng sau".
- Supabase free **pause sau ~7 ngày** → wake trước demo.

## Deploy (0đ, demo live — spec §14)
FE → Vercel free · BE → Supabase managed (không server code deploy). GV mở URL công khai, 2 máy sync realtime live. **Gotcha:** free pause sau 7 ngày → cron GitHub Action ping/ngày; online-only → mang hotspot 4G; tắt "Confirm email" để signUp instant.

## Luật cứng khi build (seam offline — spec §12.2, enforce mọi task)
1. UUID sinh **client** (không Postgres default) · 2. Dữ liệu sync/editor **không hard-delete** (`deleted_at` tombstone; order→void; item→removed) · 3. **Supabase type không lọt Core** (chỉ adapter biết) · 4. Realtime **gom 1 module** (`useRealtime`) · 5. Order/payment phải dùng `lock_version`/`expectedVersion`. Vi phạm = seam hỏng.

## Bước kế
DB/RPC, Supabase adapter foundation, Store/Auth/Seed logic, POS order/payment hooks, admin hooks, integration support utilities, adapter hardening tests, mock data parity, architecture boundary cleanup, Supabase cloud pgcrypto fix, UI binding, editor changesets, report/history polish, Supabase UI E2E, realtime migration, Demo Hardening, Demo Readiness, Vercel deploy verification và live payment sync hardening đã hoàn tất. Bước kế tiếp: demo acceptance/final rehearsal trên live URL, gồm 2 thiết bị cùng Store Key, stale payment drawer, report/history sau paid order, editor save và clear-demo guard.
