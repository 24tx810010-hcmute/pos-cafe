# POS Cafe Parallel Task Phases

> **Vai trò:** file handoff để chia nhiều session/agent code song song sau milestone code foundation.
> **Base hiện tại:** repo chính `D:\Workspace\pos-cafe` ở `main`; code worktree `D:\Workspace\pos-cafe-code` ở `ui-logic-integration`; docs worktree `D:\Workspace\pos-cafe-docs` ở `docs`.
> **Logic/UI integration:** DB/RPC, adapters, session flow, POS/admin hooks, editor changesets, report/history polish, Supabase UI E2E, realtime migration, Demo Hardening và Demo Readiness đã merge về `main`.
> **Nguyên tắc:** mỗi coding session đọc `WORKTREE-HANDOFF.md` trước, rồi đọc `pos-cafe-context.md`, implementation contract, và file này trước khi code.

---

## 1. Trạng thái nền đã có

Đã hoàn thành:

- Vite React TS scaffold + Tailwind + MUI + Zustand + TanStack Query + RHF/Zod.
- Shared domain DTO trong `src/domain/*`.
- Core guard/error/order helpers trong `src/core/*`.
- Ports trong `src/ports/index.ts`.
- Mock repos trong `src/adapters/mock/*`.
- Interactive UI mock trong `src/app/App.tsx` + `src/styles.css`.
- Repo-first migrations trong `supabase/migrations/001..003`.
- DB/RPC transaction track đã implement và local validated bằng PostgreSQL temp DB.
- Supabase adapter foundation đã có `createSupabasePorts`, row/RPC mappers, Store Key auth, deterministic seed bundle và realtime adapter.
- Runtime port factory + Store/Auth/Seed flow hooks đã có.
- POS order/payment flow hooks đã có.
- Admin flow hooks cho employees/menu/floor/settings/clear-demo/report query đã có.
- Integration support utilities đã có: UI error mapper, dirty/save helper, realtime invalidation hook.
- Adapter hardening/mock parity đã có: Supabase RPC param-shape tests, menu/floor changeset mapping tests, mock takeaway open order, mock paid history/report, unavailable menu/option errors, mock menu/floor save changeset behavior.
- Architecture boundary cleanup đã có trên `stream-db-rpc` commit `9f32291`: demo seed data chuyển sang `src/seed/demoSeedData.ts` để Supabase adapter không import mock adapter; `PortsContext` chuyển sang `src/ports/portsContext.tsx`; query keys chung chuyển sang `src/features/shared/queryKeys.ts`; root `txt.txt` đã xoá.
- Supabase cloud validation 2026-06-12 pass trên `stream-db-rpc` commit `ae1523b`: `pgcrypto` qualified qua `extensions.crypt/extensions.gen_salt`; cloud Auth autoconfirm/signup OK; tables/RPC reachable; create store test + seed tối thiểu + verify PIN + `submit_order_changes` + negative `PAYMENT_AMOUNT_TOO_LOW` + blocked `clear_demo_data` + `pay_order` + `clear_demo_data` pass.
- Test nền:
  - `npm run build`
  - `npm run test`
  - `npm run smoke`

Chưa có:

- UI production component split, hiện `src/app/App.tsx` còn là mock monolith.
- UI thật bind vào hooks/ports mới.
- UI-level Supabase cloud E2E thật vẫn chờ UI branch có landing/pairing/create-store binding.
- Branch integration cuối cùng giữa UI branch và `stream-db-rpc`.

Checklist đã có:

- Integration checklist: `docs/superpowers/specs/2026-06-12-pos-cafe-integration-checklist.md`.
- Supabase cloud setup checklist: `docs/superpowers/specs/2026-06-12-pos-cafe-supabase-cloud-setup-checklist.md`.

---

## 2. Quy tắc chia session

- Mỗi session tạo branch riêng từ `ui-foundation`, ví dụ `stream-db-rpc`, `stream-ui-pos`.
- Không sửa file ngoài vùng ownership nếu không thật sự cần. Nếu cần sửa contract chung, ghi rõ trong PR/commit.
- Không để UI gọi Supabase trực tiếp. UI chỉ gọi hooks/ports.
- Không để Supabase type lọt vào `src/core`, `src/domain`, hoặc component UI.
- Không hard-delete dữ liệu sync/editor; dùng `deleted_at` tombstone.
- Không apply migration lên Supabase cloud trong các session này, trừ khi có yêu cầu riêng.
- Mỗi session phải chạy tối thiểu `npm run build`; nếu chạm core/mock thì chạy `npm run test`; nếu chạm UI thì chạy `npm run smoke`.

---

## 3. Phase 1 — Foundation Hardening

Mục tiêu: biến scaffold/mock hiện tại thành nền đủ ổn để các track UI/adapter chạy lâu dài.

### Session F1 — Contract Cleanup

Ownership:

- `src/domain/*`
- `src/ports/index.ts`
- `src/core/*`
- test liên quan trong `src/**/*.test.ts`

Tasks:

- Rà DTO theo implementation contract: order, payment, menu, floor, report, settings.
- Thêm missing DTO nếu adapters/UI cần, nhưng không thêm Supabase-specific type.
- Tách helpers rõ hơn nếu cần: pricing, order draft, permission guard.
- Thêm unit tests cho `AppError`, role guard, order draft snapshot, payment amount guard.

Done khi:

- `npm run build` xanh.
- `npm run test` xanh.
- Không có import `@supabase/*` trong `src/core`, `src/domain`, `src/ports`.

### Session F2 — App Structure Split

Ownership:

- `src/app/*`
- `src/features/*` nếu tạo mới
- `src/components/*` nếu tạo mới
- `src/styles.css`

Tasks:

- Tách `src/app/App.tsx` monolith thành feature/components:
  - passcode/auth shell
  - app shell/left rail/drawer
  - floor view
  - order drawer
  - payment drawer
  - menu editor
  - floor editor
  - report/settings
- Giữ behavior hiện có, không đổi workflow.
- Không thay đổi ports/domain nếu không thật sự cần.

Done khi:

- UI mock vẫn chạy giống hiện tại.
- `npm run build` xanh.
- `npm run smoke` xanh ở desktop/tablet/phone landscape/portrait.

---

## 4. Phase 2 — Parallel Product Tracks

Các session dưới đây có thể chạy song song sau Phase 1 hoặc song song với F1/F2 nếu giữ đúng ownership.

### Session A — DB/RPC Transaction Track

Status 2026-06-12: implemented trên code branch. Local validation 2026-06-11 bằng PostgreSQL `18.4` temp DB pass cho `001`/`002`/`003`, happy-path smoke `submit_order_changes`/`pay_order`/`clear_demo_data`, negative smoke `PAYMENT_AMOUNT_TOO_LOW` và `OPEN_ORDERS_BLOCK_CLEAR_DEMO`. Supabase cloud validation 2026-06-12 pass sau fix `pgcrypto` schema `extensions` ở commit `ae1523b`.

Ownership:

- `supabase/migrations/003_rpc_functions.sql`
- có thể bổ sung migration mới `004_*` nếu cần thay vì sửa migration đã chạy trên cloud; hiện cloud migration chưa chạy nên sửa `003` vẫn được.
- SQL docs/test notes nếu tạo.

Tasks:

- Implement thật `submit_order_changes`.
- Implement thật `pay_order`.
- Implement thật `clear_demo_data`.
- Giữ `void_order` reserved/admin/future.
- Đảm bảo DB-source pricing: RPC đọc menu/options active từ DB, không tin giá/tên client.
- Đảm bảo `orders.lock_version` + `expectedVersion`.
- Đảm bảo all-zero submit void order open và release table.
- Đảm bảo payment cash: block thiếu tiền, set paid, create payment, release table.
- Đảm bảo replace order lines không hard-delete: mark item cũ `removed`, insert snapshot mới, option cũ đi theo removed item.
- Đảm bảo `stores`, `store_settings`, `payments`, `order_item_options` cũng có `created_at` + `updated_at` và trigger phù hợp.
- Đảm bảo seedable demo tables có `seed_key` + unique partial index `(store_id, seed_key)` để `clear_demo_data` không xoá nhầm dữ liệu user tự tạo.

Done khi:

- SQL không còn `RPC_NOT_IMPLEMENTED` cho 3 RPC chính.
- RPC trả lỗi chuẩn: `ORDER_VERSION_CONFLICT`, `MENU_ITEM_UNAVAILABLE`, `OPTION_VALUE_UNAVAILABLE`, `PAYMENT_AMOUNT_TOO_LOW`, `OPEN_ORDERS_BLOCK_CLEAR_DEMO`.
- Local PostgreSQL validation pass: migrations apply bằng `psql -v ON_ERROR_STOP=1`, happy-path RPC smoke pass, negative smoke pass.

### Session B — Supabase Adapter Track

Status 2026-06-12: implemented trên code branch ở mức foundation + hardening. Đã có `src/adapters/supabase/*`, `createSupabasePorts`, Store Key auth adapter, row/RPC mappers, deterministic seed bundle, realtime invalidation, tests nền và adapter param-shape tests cho `submit_order_changes`/`pay_order`/`clear_demo_data` + menu/floor changeset mapping. Boundary cleanup commit `9f32291` đã tách demo seed data khỏi mock adapter dependency. Cloud E2E trực tiếp pass ở commit `ae1523b`; `npm run build`, `npm run test`, `VITE_DATA_MODE=mock npm run smoke` pass.

Ownership:

- `src/adapters/supabase/*`
- `src/lib/supabase*` nếu cần
- `.env.example`

Tasks:

- Tạo Supabase client đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Tạo adapter factory trả về `AppPorts`; runtime app chỉ nhận ports, không import Supabase ở Core/UI.
- Implement adapters cho ports:
  - Auth
  - Employee
  - Menu
  - FloorPlan
  - Order
  - Payment
  - Report
  - Settings
  - Seed
  - Print vẫn có thể là HTML preview.
- Map snake_case row/RPC result sang camelCase DTO.
- Map raw Supabase/RPC errors sang `AppError`.
- Auth adapter parse Store Key `STORE_NO-SECRET`, sign in bằng email ẩn `store<store_no>@store.pos.local`, không persist raw Store Key/secret sau pairing/create.
- RPC adapters sinh UUID client cho row/order/payment mới trước khi gọi RPC; UI không gọi RPC trực tiếp.
- Seed adapter dùng deterministic IDs + `seed_key`; retry idempotent theo `(store_id, seed_key)`.
- Repo list/get mặc định lọc `deleted_at is null`.
- Realtime adapter triển khai `IRealtimePort`/`useRealtime` tập trung để invalidate Query; không thêm subscribe vào từng repo domain trong MVP.

Dependency:

- Có thể skeleton song song, nhưng RPC adapter hoàn chỉnh phụ thuộc Session A.

Done khi:

- UI/Core không import `@supabase/supabase-js`.
- Adapter tests hoặc mockable tests cover error mapping cơ bản.
- `npm run build` xanh.

### Session C — Store/Auth/Seed Flow Track

Status 2026-06-11: implemented trên code branch ở mức logic foundation. Đã có runtime port factory (`mock` mặc định, `supabase` khi env đủ hoặc `VITE_DATA_MODE=supabase`), session flow service/hooks cho load/pair/create/retry seed/verify PIN/unpair, tests đảm bảo `StoreSession` không chứa raw `storeKey`. UI create/pair màn thật chưa bind.
Update 2026-06-12: seed demo source nằm ở `src/seed/demoSeedData.ts`; mock adapter chỉ re-export data này để giữ compatibility. Supabase seed bundle dùng trực tiếp module seed trung lập, không import `src/adapters/mock/*`.

Ownership:

- auth/session feature files
- store pairing/create-store UI files
- seed bundle files, ví dụ `src/seed/*`

Tasks:

- Pair store bằng Store Key.
- Create store nhanh:
  - gọi `get_next_store_no`
  - Supabase signUp bằng store account ẩn
  - insert `stores`/`store_settings`
  - seed demo bằng TS seed bundle
  - nếu seed lỗi set `seed_status = failed`
  - UI có retry seed
- Passcode flow chọn nhân viên + PIN qua port `verifyPin`.
- Current employee memory-only; refresh về passcode nếu đã pair.
- Raw Store Key/secret chỉ dùng lúc pair/create; `StoreSession` không chứa `storeKey` và không persist secret vào local app state.
- Seed bundle dùng deterministic IDs + `seed_key` theo `store_id + seed_key`; retry seed idempotent theo `(store_id, seed_key)`, không tạo trùng data.

Dependency:

- Cần adapter Auth/Employee/Seed từ Session B hoặc dùng fake adapter tới khi B xong.

Done khi:

- Store flow không lưu employee vào localStorage/sessionStorage.
- Store flow không lưu raw Store Key/secret sau pairing/create.
- Auth setting caveat "Confirm email off" vẫn ghi trong docs/context nếu cần.
- Smoke/manual flow: create/pair -> passcode -> floor.
- Logic foundation done khi `npm run build`, `npm run test`, `npm run smoke` pass ở mock runtime; UI binding thật là bước riêng.

### Session D — POS Order/Payment Track

Status 2026-06-12: logic foundation implemented/pushed trên `stream-db-rpc`. Đã có `src/features/pos/*`: order draft/cart helpers, submit/pay services qua `AppPorts`, TanStack Query hooks, invalidation và tests. Chưa bind vào UI thật.
Mock parity 2026-06-12: mock repos đã có takeaway open order, paid history/report state và unavailable menu/option errors để UI test flow trước khi Supabase thật.

Ownership:

- POS floor view
- order drawer
- payment drawer
- order hooks/services

Tasks:

- Dine-in table click:
  - bàn trống mở draft, chưa ghi DB.
  - bàn có order load order detail + `lockVersion`.
- Takeaway:
  - nút Mang đi
  - danh sách takeaway open.
- Submit order:
  - gọi `submitOrderChanges`
  - nếu success render ticket qua `IPrintPort`
  - refetch open orders/floor/report.
- Payment:
  - cash-only UI
  - block nếu received < total
  - gọi `payOrder`
  - complete trước, render receipt sau.
- Conflict/unavailable handling:
  - `ORDER_VERSION_CONFLICT` -> toast + refetch
  - menu unavailable -> refetch menu, giữ draft.

Dependency:

- Có thể dùng mock ports song song.
- Tích hợp Supabase thật sau Session A/B.

Done khi:

- `npm run smoke` pass.
- Phone landscape `844x390` và `740x360` vẫn thấy nút In/Gửi/Complete.
- Không tạo browser history khi mở/đóng drawer.

### Session E — Menu/Floor Editor Track

Status 2026-06-12: UI/editor thật chưa implement trong logic branch. Admin support đã có helper tạo empty changeset/dirty check và mutation hooks gọi `menu.saveMenuChanges`/`floorPlan.saveFloorPlan`, nhưng editor draft UI/changset builder vẫn thuộc UI/integration phase sau.
Mock parity 2026-06-12: mock `saveMenuChanges` và `saveFloorPlan` đã apply changeset trong memory; floor-plan mock save giữ nguyên `tables.status`.

Ownership:

- menu editor feature
- floor editor feature
- editor draft state/hooks

Tasks:

- Menu editor:
  - categories CRUD draft
  - menu items CRUD draft
  - option groups/values CRUD draft
  - Save gửi changeset `created/updated/deleted`
  - deleted = tombstone.
- Floor editor:
  - floor areas tabs CRUD draft
  - table CRUD + drag/resize draft
  - decor built-in asset picker: plant/wall/counter/door/decor
  - Save không ghi đè `tables.status`.
- Responsive editor:
  - giữ 3 vùng trên landscape
  - pane scroll riêng
  - phone landscape vẫn đủ Save.

Dependency:

- Có thể dùng mock ports song song.
- Tích hợp Supabase thật sau Session B.

Done khi:

- `npm run smoke` pass.
- Có test hoặc manual checklist cho Save changeset và no status overwrite.

### Session G — Report/Settings/Print Track

Status 2026-06-12: logic hooks foundation implemented một phần trong `src/features/admin/*` và `src/features/pos/*`: report query, settings mutation, clear-demo admin guard/invalidation, POS print call qua `IPrintPort` khi submit/pay. UI report/settings/print preview production chưa tách khỏi mock monolith.

Ownership:

- report feature
- settings feature
- print port/preview

Tasks:

- Report MVP:
  - mặc định hôm nay theo `business_date`
  - chỉ tính `orders.status = paid`
  - loại `void`
  - filter 7 ngày/tháng/khoảng ngày nếu kịp.
- Settings:
  - display name/address/bill footer/timezone
  - clear demo admin-only
  - block/cảnh báo khi còn open orders.
  - clear demo chỉ tombstone seed data bằng deterministic seed IDs, deactive cashier demo, giữ đúng 1 admin; không xoá dữ liệu user tự tạo.
- PrintPort:
  - HTML/template preview cho phiếu tạm
  - HTML/template preview cho final bill
  - không tích hợp máy in thật trong MVP.

Dependency:

- Report thật cần Payment/Order adapters.
- Print preview có thể làm độc lập với mock data.

Done khi:

- Report không tính order void/open.
- Print preview render được từ `PrintTicket`/`PrintReceipt`.
- `npm run smoke` pass nếu chạm UI.

---

## 5. Phase 3 — Integration

Mục tiêu: nối UI với Supabase adapters thật sau khi RPC và adapters ổn.

Status 2026-06-12: integration support utilities implemented/pushed trên `stream-db-rpc` commit `0f71594`: `src/features/integration/uiError.ts`, `dirtyFlow.ts`, `realtimeInvalidation.ts`, `useRealtimeInvalidation.ts` và tests. Adapter hardening/mock parity pushed commit `773ed45`. Architecture boundary cleanup pushed commit `9f32291`; Supabase cloud pgcrypto fix + RPC/REST E2E pushed commit `ae1523b`. Integration checklist đã có ở `2026-06-12-pos-cafe-integration-checklist.md`.

Status 2026-06-13: UI checkpoint `ui-foundation` đã push spacing fix `6009b47`. Đã tạo/push branch tích hợp `ui-logic-integration`, merge `stream-db-rpc` vào UI checkpoint bằng merge commit `1c420d9`. Validation sau merge pass: `npm run build`, `npm run test` (16 files/60 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, scan conflict marker/import cũ. Phase này sau đó đã tiếp tục tới UI binding thật, Supabase-mode UI E2E và merge về `main`.

Status 2026-06-13b: binding nền UI thật đã push trên `ui-logic-integration` commit `47f17f6`. Đã nối session bootstrap, pairing/create store, passcode, realtime invalidation, POS floor, takeaway, order drawer, payment drawer, settings và clear-demo qua feature hooks/AppPorts; `App.tsx` không còn gọi `usePorts()` trực tiếp và không có Supabase boundary leak trong UI/features. Validation pass: `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (16 files/60 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là admin editor changesets, report/history polish và Supabase-mode UI E2E.

Status 2026-06-13c: Employees binding slice đã push commit `4d7d1ae`. Đã thêm `employee.listEmployees()` để admin thấy cả inactive employees, giữ `listActiveEmployees()` cho màn PIN, bind Employees drawer qua `useAdminEmployeesQuery` và create/update/reset PIN mutations, thêm component tests cho create/deactivate/reset PIN, adapter tests cho admin/passcode list split, và sửa smoke locator settings responsive. Validation pass: `npm run test -- employeeDrawer`, `npm run test` (17 files/65 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là menu/floor editor changesets, report/history polish và Supabase-mode UI E2E.

Status 2026-06-13d: Menu editor changeset save đã implement trên `ui-logic-integration` và sau đó merge về `main`. Drawer giữ `baseMenu` snapshot, tạo diff `MenuChanges` cho categories/menuItems/optionGroups/optionValues, sinh UUID client cho row mới, gửi `created/updated/deleted` qua `useSaveMenuMutation` -> `menu.saveMenuChanges`, refetch menu sau save, và có component tests cho create item + tombstone category. Validation pass: `npm run test -- menuEditorDrawer`, `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (18 files/67 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là floor editor changesets, report/history polish và Supabase-mode UI E2E.

Status 2026-06-13e: Floor editor changeset save đã implement trên `ui-logic-integration` và sau đó merge về `main`. Drawer giữ `baseFloorPlan` snapshot, tạo diff `FloorPlanChanges` cho areas/tables/decorItems, sinh UUID client cho row mới, gửi `created/updated/deleted` qua `useSaveFloorPlanMutation` -> `floorPlan.saveFloorPlan`, refetch floor plan sau save, giữ render/save theo logical stage `1600x900` scale-to-fit, và không gửi/ghi đè `tables.status`. Có component tests cho create table, update logical table fields, tombstone table/decor, và render scale theo percentage. Validation pass: `npm run test -- floorEditorDrawer`, `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (19 files/71 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là report/history polish và Supabase-mode UI E2E.

Status 2026-06-14: Report/History polish đã implement trên `ui-logic-integration` và sau đó merge về `main`. Order History drawer dùng `useOrderHistoryQuery` cho `order.listOrderHistory(filter)`, `useOrderDetailQuery` cho detail snapshot, custom date range + server pagination, loading/error/empty states, không còn dataset mock. Report drawer dùng `useCoreReportsQuery` để aggregate daily `report.getCoreReport({ businessDate })` cho hôm nay/7 ngày/tháng/custom, dùng `useOrderHistoryQuery` cho recent paid orders, và mock report repo lọc đúng `businessDate` như Supabase. Component test `reportHistoryDrawer.test.tsx` cover history query payload/detail, custom range, daily report metric, và 7-day range expansion. Validation pass: `npm run test -- reportHistoryDrawer`, `npm run test` (20 files/75 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là Supabase-mode UI E2E.

Status 2026-06-14b: Supabase single-browser UI E2E đã implement. Thêm `playwright.supabase.config.ts`, `tests/supabase/pos-cafe-supabase.spec.ts`, script `npm run smoke:supabase`; test tạo store cloud thật qua UI, lấy Store Key/Admin PIN từ result, unlock admin, tạo + thanh toán dine-in order, kiểm tra order history/report. Runtime ports có singleton cache để tránh tạo nhiều Supabase GoTrueClient trong React StrictMode dev. 2-browser realtime test cũng đã viết nhưng skip mặc định tới khi apply migration `supabase/migrations/004_realtime_publication.sql`, vì cloud hiện chưa phát `postgres_changes` cho `orders/tables/payments`; migration `004` add các bảng orders/payments/tables/menu/floor vào publication `supabase_realtime` theo cách idempotent. Validation pass: `npm run smoke:supabase` (1 passed/1 skipped), `npm run test` (20 files/75 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep. Phần còn lại lúc đó là apply migration `004` lên cloud rồi chạy `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase`.

Status 2026-06-14c: User đã apply migration `004_realtime_publication.sql` lên Supabase cloud và realtime UI E2E đã pass. `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` chạy 2 tests: single-browser create/pay/history/report và 2-browser realtime invalidation table status qua cùng Store Key. Kết quả: 2 passed. Phase sau đó đã được commit/push và chuyển sang Demo Hardening.

Status 2026-06-14d: Supabase UI E2E + realtime migration đã push code commit `9ccfd48` và docs commit `f95d767`. Demo Hardening slice đầu đã implement/push trên `ui-logic-integration` commit `c2f1558` và docs commit `9de26d0`: UI error toast formatter có title/message, order submit error tự refetch menu hoặc order/floor theo `UiError.action`, payment conflict tự refetch order/floor, payment/order/floor/takeaway/settings/menu editor/floor editor có loading/error states rõ hơn, clear-demo chặn khi open-order check đang loading/error và retry được, overlay clear-demo chỉ đóng khi click backdrop, và copy settings bỏ "mock". Test mới `demoHardening.test.tsx` cover clear-demo loading/error guard, payment error state, payment conflict refetch. Validation pass: `npm run test -- demoHardening uiError` (15 tests), `npm run test` (21 files/80 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `npm run smoke:supabase` (1 passed/1 skipped).

Status 2026-06-14e: Demo Readiness đã thêm runbook `2026-06-14-pos-cafe-demo-readiness-runbook.md` cho pre-demo checklist, Vercel/Supabase env, kịch bản create/pair/order/payment/realtime/report/editor/settings, fallback cloud/network/realtime, và câu trả lời ngắn khi bảo vệ. Verification cloud pass: `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` (2 passed).

Status 2026-06-14f: Code + docs đã squash-merge về `main` và push. Validation trên `main` pass: `npm run test` (21 files/80 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `git diff --check`. Bước tiếp theo là deploy verification trên Vercel/Supabase env thật và diễn tập demo 2 thiết bị.

Status 2026-06-16: Vercel deploy verification và live payment sync hardening đã hoàn tất trên `main`. Sau khi live test phát hiện case stale payment drawer (browser A và B cùng mở thanh toán cùng một order; B thanh toán trước; A vẫn giữ nút pay enabled và chỉ lỗi khi bấm), code đã được harden bằng active refetch khi realtime event đến, polling hồi phục 5s cho floor/open orders/order detail, và trạng thái closed cho paid/void order để disable payment button + hiện cảnh báo đã cập nhật. Trước đó cũng đã fix payment path cho existing order bằng cách sinh fresh UUID cho draft item/option khi mở lại order cũ, tránh `INVALID_ORDER_ITEMS` khi submit lại. Validation pass trước push: `npm run test -- realtimeInvalidation orderFlow demoHardening`, `npm run test` (21 files/82 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` (2 passed), `git diff --check`. Live deployment sau push đổi bundle thành deployment mới và cần final rehearsal trên live URL trước demo.

Tasks chung:

- Duy trì runtime switch:
  - mock mode cho dev/demo offline UI
  - Supabase mode khi env có URL/key
- Tích hợp Realtime invalidation:
  - orders/payments/tables -> refetch open orders/floor/report
  - menu/floor/decor -> refetch menu/floor plan
- Realtime nằm ở `IRealtimePort`/`useRealtime`, không rải `supabase.channel()` trong feature/component.
- Chạy full smoke với Supabase project thật sau khi user cung cấp env.
- Không đổi domain DTO trong phase này nếu không có bug contract.

Done khi:

- 2 máy/browser cùng store thấy order/table status update qua realtime/refetch và polling fallback.
- Nếu 2 máy cùng mở payment drawer cho một order, máy còn lại tự khóa payment sau khi order được thiết bị khác thanh toán/đóng.
- Create store + seed demo + passcode + order + payment + report chạy end-to-end.

---

## 6. Phase 4 — Demo Hardening

Tasks:

- Add loading/error/empty states cho mọi drawer. Slice 2026-06-14d đã cover payment/order/floor/takeaway/settings/menu editor/floor editor; report/history đã cover ở phase trước.
- Add toasts rõ cho conflict, unavailable menu, insufficient cash, clear-demo blocked. Slice 2026-06-14d đã dùng `UiError.action` cho order/payment/clear-demo và toast title+message.
- Add Vercel deploy config nếu cần.
- Supabase setup checklist đã có ở `2026-06-12-pos-cafe-supabase-cloud-setup-checklist.md`; khi có project/env thật thì chạy theo checklist:
  - project cloud
  - apply migrations
  - Auth email confirmation off
  - Realtime enabled cho bảng cần thiết
  - wake/check trước demo.
- Add final smoke checklist cho luận án/demo.

Done khi:

- `npm run build`, `npm run test`, `npm run smoke` xanh.
- Demo checklist trong docs hoàn chỉnh.
- Không còn `RPC_NOT_IMPLEMENTED` ở flow MVP đang dùng.
- Live final rehearsal pass trên public URL, gồm payment sync/stale drawer.

---

## 7. Merge order khuyến nghị

1. Merge F1/F2 trước nếu có refactor lớn.
2. Merge Session A DB/RPC.
3. Merge Session B adapters.
4. Merge Session C auth/store/seed.
5. Merge Session D/E/G UI tracks theo mức conflict thấp nhất.
6. Merge Phase 3 integration.
7. Merge Phase 4 hardening.

Nếu chạy nhiều session cùng lúc, ưu tiên merge theo rule:

- Contract/domain thay đổi merge sớm nhất.
- UI refactor merge trước feature UI mới.
- Adapter thật merge sau RPC thật.
- Không merge code làm `npm run build` hoặc smoke chính bị đỏ.

---

## 8. Checklist cho mỗi session

Trước khi code:

- [ ] Đọc `docs/superpowers/specs/WORKTREE-HANDOFF.md`.
- [ ] Đọc `pos-cafe-context.md`.
- [ ] Đọc `2026-06-11-pos-cafe-implementation-contract.md`.
- [ ] Đọc file parallel task phases này.
- [ ] Chạy `git worktree list` để xác nhận repo chính ở `main`, docs worktree ở `docs`, và code worktree ở branch code đang làm.
- [ ] Chạy `git status --short --branch` ở cả docs và code worktree.
- [ ] Ở code worktree, chạy `git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\.md)"`; lệnh này không được trả kết quả.
- [ ] Xác định ownership file.
- [ ] Tạo branch riêng.

Trước khi kết thúc:

- [ ] `npm run build` xanh.
- [ ] `npm run test` nếu chạm core/domain/mock.
- [ ] `npm run smoke` nếu chạm UI.
- [ ] Ghi rõ còn stub hay dependency nào chưa xong.
- [ ] Không commit `.env`, `dist`, `node_modules`, report/caches.
