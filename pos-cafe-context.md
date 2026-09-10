# Context: POS Quán Cà Phê (đa thiết bị, online-only) — TLCN

> **Cập nhật 2026-08-21 sau lần rà soát đồng bộ docs với code.** Tóm tắt nhanh cho mỗi session.
> **App truth cập nhật 2026-09-10:** giao thức ghi v1 đã nghiệm thu và push `main@3ada48c`, phát triển từ `7183b31`; docs đã duyệt tại `0ecf84d`. Xem [phase 27](docs/implementation-log/phase-27-idempotent-write-operations.md) cho SHA và kết quả cuối. Migration 014–016 chưa apply lên môi trường thật.
> **Docs branch:** nhánh `docs` độc lập, chỉ giữ Markdown knowledge base; không merge vào `main`.
> **Spec đầy đủ (archive):** [docs/archive/superpowers/specs/2026-06-09-pos-cafe-design.md](docs/archive/superpowers/specs/2026-06-09-pos-cafe-design.md)
> **Architecture summary:** [docs/architecture.md](docs/architecture.md)
> **Requirements:** [docs/requirements.md](docs/requirements.md)
> **Testing:** [docs/testing.md](docs/testing.md)
> **Limitations:** [docs/limitations.md](docs/limitations.md)
> **Report source map:** [docs/report-source-map.md](docs/report-source-map.md)
> **Implementation log:** [docs/implementation-log/README.md](docs/implementation-log/README.md)
> **Demo runbook:** [docs/demo-runbook.md](docs/demo-runbook.md)
> **Quy tắc viết báo cáo:** code/file/symbol/commit/migration/SQL/lệnh chỉ dùng để kiểm chứng và suy ra thiết kế; không đưa trực tiếp vào báo cáo nếu người dùng chưa yêu cầu rõ. Bắt buộc đọc `docs/report-source-map.md`.

## Tóm tắt 1 phút

- **Đề tài:** Quản lý order quán cà phê **đa thiết bị đồng bộ song song**, phân quyền vai trò. Không phải bài toán quản lý chuỗi đa chi nhánh. TLCN, < 1 tháng, 2h/ngày, 0đ. **AI lập trình chính**.
- **Flagship:** Menu Editor + Floor-Plan Editor (sơ đồ bàn trực quan).

## Trạng thái hiện tại (cập nhật 2026-09-10)

- **Main đã đối chiếu:** `main@c7f2f4e`; phase 23 nền bàn đã commit, migration 013 đã apply/verify. Sau phase 24: `main@b7b7262` gỡ dependency form không dùng, `main@c7f2f4e` đổi cách liệt kê lịch sử đơn. Phase 22 chốt kitchen future-only nằm trong `main@1b0098b`.
- **Docs mới nhất:** nhánh `docs` là knowledge base độc lập, chỉ lưu `.md`; không chứa source code, package/config, HTML prototype, screenshot binary hoặc file tạm.
- **Đã xong trong code:** DB/RPC foundation, Supabase/mock adapters, Store/Auth/Seed, POS order/payment, admin, realtime, UI binding/hardening, instant pay, hủy đơn paid, report audit, editor quyền per-employee, catalog 9 texture tường + 131 ảnh decor và catalog nền trắng + 11 ảnh nền bàn cho Floor Editor/POS.
- **Role hiện hành:** UI chỉ cho `admin` và `cashier`. `kitchen` còn trong enum/schema/core để mở rộng sau nhưng đã ẩn khỏi nav, drawer registry, màn PIN và form tạo/sửa nhân viên; kitchen queue chưa phải tính năng hiện tại.
- **Validation nền 2026-09-07 (lịch sử):** baseline `main@7183b31`. Bốn cổng chất lượng cục bộ đều pass: `npm run build`, `npm test` 49 files/260 tests, `npm run test:coverage` dòng 92,77%, `npm run smoke` 35 pass/31 skipped/0 failure. Kịch bản demo đã tự động hóa thành `tests/smoke/demo-runbook.spec.ts`, chạy dưới 30 giây. Chiến lược kiểm thử viết thành văn tại `docs/test-strategy.md`. Chi tiết và bằng chứng cloud xem `docs/testing.md`.
- **Validation local 2026-08-21:** `npm test` pass 49 files/260 tests, `npm run build` pass 3197 module với Vite chunk-size warning đã biết. `npm run smoke` KHÔNG chạy lại được ngày này vì Playwright thiếu binary trình duyệt; kết quả 34 pass/31 skipped/0 failure là của 2026-08-12. Cloud evidence có ngày riêng trong `docs/testing.md`.
- **Backlog kỹ thuật còn lại:** realtime subscription cho `menu_item_option_groups`, bundle/code-splitting, exit animation nếu cần polish, siết employee security boundary nếu triển khai ngoài môi trường demo tin cậy, xác minh deployment live và screenshot/diagram artefact cho báo cáo.

## Quyết định đã chốt

| Hạng mục | Chốt |
|---|---|
| Ngôn ngữ | **TypeScript** |
| Stack | React + Vite + TS + Tailwind + MUI controls + Zustand + TanStack Query + Supabase + Recharts + react-hot-toast. Form dùng controlled state và validation thủ công; `react-hook-form`, `@hookform/resolvers` và `zod` đã bị gỡ khỏi dependency ở `main@b7b7262` vì không dùng. Package: npm. Deploy Vercel + Supabase free |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) |
| Kiến trúc | **Ports & Adapters theo hướng Hexagonal Architecture** — domain/core/ports không phụ thuộc Supabase; concrete adapter chỉ được compose ở runtime boundary |
| Navigation | **Single URL** (`/` hoặc `/app`) + internal app state; không dùng browser history cho workflow POS/admin |
| Multi-tenant | Row-level: `store_id` mọi bảng + RLS cô lập theo store account; đây là tenant boundary cho nhiều quán/account, không phải feature quản lý đa chi nhánh trong UI MVP |
| **Auth** | **Store Key** (`STORE_NO-SECRET`, vd `0001-X8F3QA`) ghép máy 1 lần → session persist → daily **chọn nhân viên + PIN**. `STORE_NO` lấy bằng sequence, được hở số, nhưng **không được nhập mỗi số để vào quán**; secret là credential. Không persist raw Store Key/secret sau pairing/create |
| Role enforce | RLS cô lập store. Giao thức v1 xác minh employee session 12 giờ từ PIN; token memory-only, hash tại server. Năm quyền hành động kiểm theo quyền hiện hành, deny thắng grant; DML nguồn quyền/tài chính và RPC ghi cũ bị khóa. SELECT tài chính vẫn theo store, chưa phân quyền đọc đầy đủ theo nhân viên. UI snapshot có thể cần khóa/đăng nhập lại. Nguồn: migration 014–016 |
| Backend contract | Ngoài các bảng nghiệp vụ nền, migration 014 thêm hai bảng public `write_operations`/`order_events` và một bảng private `employee_sessions`. RLS cô lập store; giao thức v1 giữ business/audit/R1 trong transaction. SQL migrations là nguồn triển khai/truy vết nội bộ; database đã có dữ liệu chỉ apply forward migration chưa có, không replay bước reset destructive |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders, payments, tables, menu, floor/decor) làm signal invalidation/refetch. Query floor/open orders/order detail có polling 5s. Giới hạn đã biết: adapter chưa subscribe `menu_item_option_groups`, nên thao tác chỉ gắn/bỏ modifier khỏi món cần refresh/reconnect để máy khác thấy. Offline-first **HOÃN sang mở rộng** |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase. Máy khác realtime-refetch phần lớn thay đổi; riêng link món–modifier đang có giới hạn nêu trên |
| **Lịch sử đơn** | Mặc định liệt kê đơn đã kết thúc **gần đây nhất, không giới hạn ngày kinh doanh**. Màn lịch sử **cố ý KHÔNG hiển thị `order_no`** mà hiển thị số thứ tự theo bộ lọc, vì `order_no` chỉ duy nhất trong phạm vi một `business_date` nên danh sách trải nhiều ngày sẽ trùng số. `order_no` giữ vai trò số bill và chỉ xuất hiện trên hóa đơn in. Ô tìm kiếm và lọc theo bàn **chưa dùng trên UI** dù repository hỗ trợ |
| **Demo** | Tạo quán Supabase mặc định **trống** (store/settings + 1 admin); checkbox seed demo mặc định tắt. Khi bật, seed TS bundle bằng deterministic IDs + `seed_key`, retry idempotent; lỗi seed không làm mất store. Clear demo admin-only, block nếu còn open order. Runtime có mock seeded dành cho dev/test; nếu Vercel thiếu cấu hình Supabase và không ép mode, app sẽ fallback mock |
| Landing UI | Render bằng app state: **2 thẻ** "Đã có quán" (nhập key) \| "Tạo quán mới" (checkbox dữ liệu mẫu tùy chọn) |
| Licensing | `stores.is_active` hiện là cột/seam giấy phép, chưa được app/RLS/RPC dùng để chặn truy cập. Không claim đã khóa giấy phép hoặc có billing thật |

## Data model (15 bảng chính)
`stores` · `employees`(passcode+role+permission overrides) · `store_settings` · `categories` · `menu_items`(upload ảnh qua Storage, lưu `image_asset_key`) · `option_groups` · `option_values` · `menu_item_option_groups` · `floor_areas` · `tables`(area,x,y,layout,status,nullable `background_asset_key`) · `floor_decor_items`(area,asset_key/layout,không order/status) · `orders`(`lock_version`) · `payments` · `order_items` · `order_item_options`. Giá **snapshot** lúc order.

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values/menu_item_option_groups`) và có option/topping dùng chung nhiều-nhiều. Floor plan lưu `floor_areas` + từng bàn là row `tables` + `floor_decor_items`; decor chỉ render, **không có status/không nhận order**. Decor dùng catalog built-in 9 texture tường + 131 ảnh. Bàn có catalog 11 ảnh nền; `tables.background_asset_key=null` là nền trắng mặc định. DB chỉ lưu public path; resolver decor fallback placeholder, resolver nền bàn fallback trắng. UI sửa local, bấm **Save** mới ghi changeset `created/updated/deleted`; deleted là tombstone. Realtime chỉ là tín hiệu invalidation/refetch, không patch cache; link `menu_item_option_groups` hiện là ngoại lệ chưa được adapter subscribe. Floor-plan save không ghi đè `tables.status`.

## Navigation
MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Mọi màn hình render theo internal state: pairing/create-store/passcode/posFloor/order/payment/adminMenu/adminFloorPlan/employees/report/orderHistory/settings. Browser Back/Forward **không phải workflow nghiệp vụ**; mutation chỉ qua nút rõ ràng như Save/Pay/Void/Clear demo. Current employee giữ memory-only: refresh an toàn là chưa pair → pairing, đã pair → passcode. Editor dirty state phải confirm nội bộ khi chuyển màn.

## Frontend/UI
Zustand giữ app/draft state, TanStack Query giữ server state/cache; form hiện dùng controlled state và validation thủ công. UI tiếng Việt, primary teal `#0F766E`, landscape-first; portrait hiện hướng dẫn xoay ngang. App shell dùng `LeftNav` rộng 176px/68px. Module hiện mở bằng `PortalDrawer` **toàn màn hình** (`viewport="screen"`) và che rail; overlay mặc định `rgba(0,0,0,0.2)`, click ngoài đóng, có slide-in. `PortalPopup` cũng full-screen để chặn toàn app khi cần. Drawer cố định viewport, pane tự scroll. Order drawer giữ category/menu/cart; cart footer sticky. Floor toolbar giữ area tabs, filter, `Làm mới`. Floor plan dùng logical stage `1600x900` và **scale-to-fit tự động**, chưa có pan/zoom thủ công; drag/resize dùng ref/requestAnimationFrame và commit draft ở pointerup.

## Payment/order
Đơn chỉ được công nhận sau khi server ghi. Giao thức v1: register K/payload bất biến → execute nguyên tử business/audit/R1. Nháp chưa register có thể mất local; K đã register và đơn đã ghi phục hồi từ server bằng phiên có quyền, kể cả đổi máy/hết ca. Pending hiệu lực 24 giờ, không phải hạn đơn; không GC terminal trong release này. Retry giữ K/kind/version/IDs/qty, không tự gửi khi reconnect hoặc đổi selection qua polling. Retained lines giữ ID/giá/options, phần mới lấy giá hiện hành và cần xác nhận nếu quote đổi: A 2 × 30.000 + thêm 40.000 = 100.000. Modifier có giá riêng, chọn ở phần mới, không sửa vào phần đã lưu. Payment cash-only; phần mềm không xác nhận đã nhận tiền vật lý. Split giữ độc lập nghiệp vụ/số bill như trước, audit lưu liên kết nguồn/kết quả. Void paid giữ tiền/receipt lịch sử; in lại kiểm trạng thái paid hiện tại. Nguồn: `src/features/pos/orderFlow.ts:73`, `writeOperationFlow.ts:25`, migrations 014–016; [chi tiết phase 27](docs/implementation-log/phase-27-idempotent-write-operations.md).

## Ports/seed/tasks
Ports theo domain repo (`Auth/Employee/WriteOperation/Menu/FloorPlan/Order/Payment/Report/Settings/Seed/Print/Realtime`), Core/UI dùng camelCase, adapter map snake_case, repo mặc định lọc `deleted_at is null`, lỗi dùng `AppError` gồm `ORDER_VERSION_CONFLICT` + menu unavailable. Realtime tập trung ở `IRealtimePort`/`useRealtimeInvalidation` để invalidate và refetch active TanStack Query; floor/open order/order detail có polling 5s khi active để hồi phục nếu missed websocket event. Seed demo: admin PIN `123456`, cashier PIN `111111`, menu/option cơ bản, 1 area/4 bàn và 7 decor ảnh built-in; mock showcase đầy đủ hơn có 2 areas/14 bàn và 13 decor ảnh. Main hiện đã chứa architecture boundary scanner, split Supabase/mock adapters, runtime port factory, store session flow, POS order/payment hooks, admin hooks, UI error mapper, dirty/save helpers, realtime invalidation hook, Supabase adapter param-shape tests và mock data parity cho takeaway/report/history/editor changesets. Boundary cleanup mới nhất: demo seed data ở `src/seed/demoSeedData.ts`, `PortsContext` ở `src/features/shared/portsContext.tsx`, query keys ở `src/features/shared/queryKeys.ts`, `src/ports` giữ interface/type-only.

## Delete policy
Dữ liệu editor/sync (`categories/menu_items/option_groups/option_values/menu_item_option_groups/floor_areas/tables/floor_decor_items`) **không hard-delete** từ UI; dùng tombstone `deleted_at` + `deleted_by_employee_id`. `orders` huỷ bằng `status=void`; `order_items` xoá bằng `status=removed`.

## Initial load
Khi vào app/POS chỉ load dữ liệu đang cần: employees active, settings, menu active, floor plan active (`floor_areas/tables/floor_decor_items`), open orders/chưa thanh toán. **Không load toàn bộ order history/report**. Hai màn fetch riêng khi mở: lịch sử mặc định recent không giới hạn ngày, report mặc định hôm nay; bộ lọc/phân trang theo từng màn. Report MVP chỉ tính order `paid`, loại `void`, theo `business_date`/timezone store.

## Màn hình
landing(2 thẻ) · store-pairing · create-store · passcode · quản-lý-NV · menu-editor⭐ · floor-plan-editor⭐ · report · floor-plan(view) · order · payment · order-history · general-setting(+clear demo) · payment-setting(opt). Kitchen queue không phải màn hiện hành.

## Phân loại phạm vi
- **Đã implement:** landing/pairing/create(+seed demo)/passcode, nhân viên+role/quyền, menu editor + modifier/ảnh, floor editor + transform/decor/nền bàn, dine-in/takeaway, cash full/split payment, history filter/detail/void paid, report, settings/maintenance.
- **Polish tùy chọn:** exit animation, asset search/favorite, report insight sâu hơn, code splitting và refresh artefact.
- **Mở rộng sau:** role/module kitchen + queue backend thật, gộp/chuyển bàn, QR/bank/e-wallet, discount/refund, offline-first, native printer, kho/loyalty/ca.

## Ngoài scope
kho · loyalty · chấm công · native · **offline-first/local DB (online-only)** · billing · super-admin

## Caveat nhớ khi bảo vệ
- **Store Key và PIN có hai phạm vi:** Store Auth cô lập dữ liệu quán; PIN được server xác minh để cấp employee token cho thao tác ghi v1. Người có Store Key vẫn có phạm vi đọc theo store, không tự có quyền ghi của nhân viên.
- Giao thức v1 có employee session server và chặn ghi vượt quyền; phần SELECT theo role, brute-force PIN, provisioning chủ thật vẫn ngoài scope. Không suy rộng việc đóng đường ghi thành đã giải quyết toàn bộ bảo mật.
- **Online-only** — mất mạng không dùng được. Offline-first HOÃN sang mở rộng, **đã chừa seam** (UUID client, updated_at, `deleted_at` tombstone, ports/transport cô lập — spec §12.1). GV hỏi → "điểm yếu đã biết, seam sẵn, mở rộng sau".
- Trạng thái/giới hạn Supabase free có thể thay đổi → kiểm tra project active và chính sách hiện hành trước demo.

## Deploy (configured/deployment-ready)
FE → Vercel free · BE → Supabase managed (không server code deploy). Bắt buộc cấu hình `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; thiếu cấu hình có thể làm runtime fallback sang mock seeded. Tắt "Confirm email" để signUp Store Key có session ngay. Chỉ claim deployment live sau khi bổ sung URL, commit/version và ngày verify; online-only → chuẩn bị hotspot khi demo.

## Luật cứng khi build (seam offline — spec §12.2, enforce mọi task)
1. UUID sinh **client** (không Postgres default) · 2. Dữ liệu sync/editor **không hard-delete** (`deleted_at` tombstone; order→void; item→removed) · 3. **Supabase type không lọt Core** (chỉ adapter biết) · 4. Realtime **gom 1 module** (`useRealtime`) · 5. Order/payment phải dùng `lock_version`/`expectedVersion`. Vi phạm = seam hỏng.

## Bước kế
Kitchen đã được chốt future-only và ẩn khỏi UI hiện hành. Việc nên làm tiếp: bổ sung realtime subscription cho `menu_item_option_groups`, tối ưu bundle/code-splitting, rồi refresh screenshot/artefact cho báo cáo.
