# Context: POS Quán Cà Phê (đa thiết bị, online-only) — TLCN

> **Cập nhật 2026-07-22 sau phase 21 catalog decor Floor Plan.** Tóm tắt nhanh cho mỗi session.
> **App truth hiện tại:** `main` commit `7a00fd0`; phase 21 catalog decor đã push; migration 012 đã apply và verify cloud.
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
- **Validation phase 21 local:** `npm test` pass 48 files/250 tests, `npm run build` pass với Vite chunk-size warning đã biết, `npm run smoke` pass 34/31 theo điều kiện viewport; Playwright desktop add/save/render decor và sample hai khu đều pass.
- **Backlog kỹ thuật còn lại:** kitchen queue backend thật khi có yêu cầu dữ liệu bếp, bundle/code-splitting để xử lý chunk-size warning, exit animation khi đóng drawer/popup nếu cần polish, screenshot artefact riêng cho tiểu luận nếu cần hình minh họa.

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
| Role enforce | Cô lập **store** = RLS (DB). Role **nhân viên** = app-layer: module visibility theo role; 5 action permission có default theo role + override từng nhân viên (`grants`/`denies`). Flow là chốt client, RPC đọc override live làm guardrail/audit; không claim DB-level employee security. Client giữ snapshot quyền tại login nên phải đăng nhập lại sau khi đổi quyền. PIN verify bằng SQL RPC + `pgcrypto`; client không đọc `passcode_hash` |
| Backend contract | SQL migrations trong `supabase/migrations` apply cloud trực tiếp: `001` schema/enums, `002` indexes/RLS/triggers, `003` RPC/functions, `004` realtime publication, `005`–`006` menu image storage, `007` full wipe, `008` shared modifiers, `009` partial payment (superseded), `010` instant-pay split-order, `011` void-paid-order + `employees.permission_overrides`, `012` action-permission guardrails cho `submit_order_changes`/`pay_order`/`pay_order_items`. RPC critical: `get_next_store_no`, `verify_employee_pin`, `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`, `clear_demo_data`, helper `has_employee_permission`. Cloud đã verify qua migration 012; E2E deny-permission gọi thẳng RPC trả `FORBIDDEN` đúng |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders, payments, tables, menu, floor/decor) làm signal invalidation/refetch. Query floor/open orders/order detail có polling nhẹ để hồi phục nếu tab vừa pair/login miss event. Offline-first **HOÃN sang mở rộng**, chừa seam sẵn (spec §12.1) |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase; máy khác nhận Realtime event rồi **refetch** menu/floor plan |
| **Demo** | Seed-on-create: tạo quán → seed sẵn demo từ TS seed bundle (**user+menu+sơ đồ bàn/decor**) bằng deterministic IDs + `seed_key` theo `store_id + seed_key` để retry idempotent. Nếu seed lỗi: `seed_status=failed` + retry seed, không tạo lại store. Nút "Clear demo data" admin-only, block nếu còn open orders, tombstone đúng seed data, deactive cashier demo, chừa 1 admin. Không local demo mode |
| Landing UI | Render bằng app state: **2 thẻ** "Đã có quán" (nhập key) \| "Tạo quán mới" (seed demo) |
| Licensing | Conceptual/app-layer: `stores.is_active=false` → khóa. Muốn khóa thật ở DB thì RLS/RPC phải check `stores.is_active`; MVP chưa claim DB-level license enforcement. Không billing thật |

## Data model (14 bảng chính)
`stores` · `employees`(passcode+role) · `store_settings` · `categories` · `menu_items`(không upload ảnh; optional `image_asset_key`) · `option_groups` · `option_values` · `floor_areas` · `tables`(area,x,y,layout,status) · `floor_decor_items`(area,asset_key/layout,không order/status) · `orders`(`lock_version`) · `payments` · `order_items` · `order_item_options`. Giá **snapshot** lúc order. (Cột → spec §7)

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values`) và **MVP làm luôn option/topping** ở mức 1 cấp group/value. Floor plan lưu `floor_areas` + từng bàn là row `tables` có tọa độ/layout + `floor_decor_items`; decor chỉ render, **không có status/không nhận order**. Decor dùng catalog built-in 9 texture tường + 131 ảnh (Cây/Ghế/Thiết bị/Khác), DB chỉ lưu public path trong `asset_key`; key legacy fallback placeholder và user chưa upload/custom decor. UI cho sửa local, bấm **Save** mới ghi Supabase bằng changeset `created/updated/deleted`; deleted là tombstone. Supabase Realtime chỉ dùng làm tín hiệu invalidation: máy khác nhận event thì gọi `refetchMenu()` hoặc `refetchFloorPlan()`, không patch state thủ công trong MVP. Floor-plan save chỉ cập nhật field layout/decor, **không ghi đè `tables.status`**.

## Navigation
MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Mọi màn hình render theo internal state: pairing/create-store/passcode/posFloor/order/payment/adminMenu/adminFloorPlan/employees/report/orderHistory/settings. Browser Back/Forward **không phải workflow nghiệp vụ**; mutation chỉ qua nút rõ ràng như Save/Pay/Void/Clear demo. Current employee giữ memory-only: refresh an toàn là chưa pair → pairing, đã pair → passcode. Editor dirty state phải confirm nội bộ khi chuyển màn.

## Frontend/UI
Zustand giữ app/draft state, TanStack Query giữ server state/cache, RHF+Zod validate form. UI tiếng Việt, primary teal `#0F766E`, neutral modern. Landscape-first từ desktop/tablet tới phone xoay ngang; phone landscape vẫn truy cập đủ MVP, không cắt POS/report/editor theo thiết bị; phone portrait hiện hướng dẫn xoay ngang. App shell dùng `LeftNav` dạng left rail sáng: desktop rộng 176px, compact 68px, có session card nhân viên/role, module navigation theo nhóm và lock session; không còn brand/logo copy trong rail. Module mở drawer qua `PortalDrawer` trong workspace viewport sau rail, overlay mặc định `rgba(0,0,0,0.2)`, click overlay đóng drawer và có slide-in theo placement; `PortalPopup` cũng dùng workspace offset tương ứng để không che nav. Popup/confirm dùng `PortalPopup`. Body/shell không scroll tự do: drawer cố định viewport, header/action bar sticky, từng pane tự `overflow:auto`. Module giữ mental model 3 vùng trên mọi màn ngang: trái category/filter/navigation, giữa content chính, phải detail/cart/payment/properties; order drawer category trái + menu grid giữa + cart phải, cart footer sticky. Floor workspace không còn header/action bar riêng phía trên; toolbar trong floor view giữ area tabs, filter và nút `Làm mới`, còn takeaway/new order đi qua left rail/drawer hoặc tương tác bàn/order. Floor plan dùng logical stage `1600x900`, scale-to-fit; pan/zoom canvas riêng; drag/resize mutate DOM qua ref/requestAnimationFrame, pointerup mới commit draft.

## Payment/order
Order draft chỉ lưu DB khi bấm **In/Gửi đơn** qua `submit_order_changes`; bàn trống chưa tạo DB, adapter sinh UUID client cho order mới trước khi gọi RPC, bàn có order nếu không có draft thay đổi thì nút chính là **Thanh toán**. Khi load order cũ vào draft, item/option draft IDs phải là UUID mới. Submit dùng replace order lines không hard-delete; DB snapshot giá/tên/options và tính total trong transaction. Toàn bộ item về 0 + In/Gửi → order open `void`, table empty. Order/payment dùng `lock_version`; conflict trả `ORDER_VERSION_CONFLICT` và UI refetch. Phase 20 enforce 5 quyền: `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`; admin chỉnh checkbox quyền hiệu lực từng nhân viên trong Employees Drawer. Tạo/sửa/hủy đơn mở và full/split payment bị chốt ở flow, UI disable sớm, migration 012 guardrail RPC bằng override đọc live. Đơn `paid` hủy qua `void_order` (migration 011), giữ nguyên total/order_no/paid_at/payment + audit; report tự loại khỏi doanh thu và vẫn cộng `voidCount`/`voidAmount`. Popup hủy refetch detail để lấy `lock_version` tươi. **Instant pay (migration 010):** chọn một phần sẽ tách món thành đơn mới độc lập và pay ngay; đơn tách kế thừa số đơn gốc, đơn gốc nhận số mới nên bill trả trước có số nhỏ hơn. Đơn gốc còn lại là order mở bình thường; mỗi lần thu là một đơn paid vào report/history ngay. Payment UI hiện cash-only; tiền integer VND, `order_no` theo timezone store. Print qua `IPrintPort` HTML/template preview. Kitchen queue chưa có backend thật.

## Ports/seed/tasks
Ports theo domain repo (`Auth/Employee/Menu/FloorPlan/Order/Payment/Report/Settings/Seed/Print/Realtime`), Core/UI dùng camelCase, adapter map snake_case, repo mặc định lọc `deleted_at is null`, lỗi dùng `AppError` gồm `ORDER_VERSION_CONFLICT` + menu unavailable. Realtime tập trung ở `IRealtimePort`/`useRealtimeInvalidation` để invalidate và refetch active TanStack Query; floor/open order/order detail có polling 5s khi active để hồi phục nếu missed websocket event. Seed demo: admin PIN `123456`, cashier PIN `111111`, menu/option cơ bản, 1 area/4 bàn và 7 decor ảnh built-in; mock showcase đầy đủ hơn có 2 areas/14 bàn và 13 decor ảnh. Main hiện đã chứa architecture boundary scanner, split Supabase/mock adapters, runtime port factory, store session flow, POS order/payment hooks, admin hooks, UI error mapper, dirty/save helpers, realtime invalidation hook, Supabase adapter param-shape tests và mock data parity cho takeaway/report/history/editor changesets. Boundary cleanup mới nhất: demo seed data ở `src/seed/demoSeedData.ts`, `PortsContext` ở `src/features/shared/portsContext.tsx`, query keys ở `src/features/shared/queryKeys.ts`, `src/ports` giữ interface/type-only.

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
Phase 20 đã hoàn tất và validation local/mock/cloud đều xanh. Bước kế tiếp: commit/push code trên `main` và tài liệu trên `docs`; sau đó chuẩn bị artefact/báo cáo tiểu luận và refresh screenshot nếu cần.
