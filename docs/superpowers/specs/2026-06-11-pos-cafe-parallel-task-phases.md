# POS Cafe Parallel Task Phases

> **Vai trò:** file handoff để chia nhiều session/agent code song song sau milestone code foundation.
> **Base hiện tại:** code worktree `D:\Workspace\pos-cafe-code`, branch `codex/code-foundation`.
> **Logic branch đang tích lũy:** `codex/stream-db-rpc` đã chứa DB/RPC, adapters, session flow, POS/admin hooks, integration support, adapter/mock hardening và architecture boundary cleanup; chưa merge vào `codex/code-foundation` vì UI branch đang làm từ base đó.
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
- Architecture boundary cleanup đã có trên `codex/stream-db-rpc` commit `9f32291`: demo seed data chuyển sang `src/seed/demoSeedData.ts` để Supabase adapter không import mock adapter; `PortsContext` chuyển sang `src/ports/portsContext.tsx`; query keys chung chuyển sang `src/features/shared/queryKeys.ts`; root `txt.txt` đã xoá.
- Test nền:
  - `npm run build`
  - `npm run test`
  - `npm run smoke`

Chưa có:

- UI production component split, hiện `src/app/App.tsx` còn là mock monolith.
- UI thật bind vào hooks/ports mới.
- Supabase cloud project apply migration và end-to-end smoke thật.
- Branch integration cuối cùng giữa UI branch và `codex/stream-db-rpc`.

Checklist đã có:

- Integration checklist: `docs/superpowers/specs/2026-06-12-pos-cafe-integration-checklist.md`.
- Supabase cloud setup checklist: `docs/superpowers/specs/2026-06-12-pos-cafe-supabase-cloud-setup-checklist.md`.

---

## 2. Quy tắc chia session

- Mỗi session tạo branch riêng từ `codex/code-foundation`, ví dụ `codex/stream-db-rpc`, `codex/stream-ui-pos`.
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

Status 2026-06-11: implemented trên code branch và local validated bằng PostgreSQL `18.4` temp DB. Apply `001`/`002`/`003` pass; happy-path smoke `submit_order_changes`/`pay_order`/`clear_demo_data` pass; negative smoke `PAYMENT_AMOUNT_TOO_LOW` và `OPEN_ORDERS_BLOCK_CLEAR_DEMO` pass. Supabase cloud migration là bước setup riêng.

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

Status 2026-06-12: implemented trên code branch ở mức foundation + hardening. Đã có `src/adapters/supabase/*`, `createSupabasePorts`, Store Key auth adapter, row/RPC mappers, deterministic seed bundle, realtime invalidation, tests nền và adapter param-shape tests cho `submit_order_changes`/`pay_order`/`clear_demo_data` + menu/floor changeset mapping. Boundary cleanup commit `9f32291` đã tách demo seed data khỏi mock adapter dependency. `npm run build`, `npm run test`, `npm run smoke` pass.

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

Status 2026-06-12: logic foundation implemented/pushed trên `codex/stream-db-rpc`. Đã có `src/features/pos/*`: order draft/cart helpers, submit/pay services qua `AppPorts`, TanStack Query hooks, invalidation và tests. Chưa bind vào UI thật.
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

Status 2026-06-12: integration support utilities implemented/pushed trên `codex/stream-db-rpc` commit `0f71594`: `src/features/integration/uiError.ts`, `dirtyFlow.ts`, `realtimeInvalidation.ts`, `useRealtimeInvalidation.ts` và tests. Adapter hardening/mock parity pushed commit `773ed45`. Architecture boundary cleanup pushed commit `9f32291`: `PortsContext` ở `src/ports/portsContext.tsx`, query keys ở `src/features/shared/queryKeys.ts`. Integration checklist đã có ở `2026-06-12-pos-cafe-integration-checklist.md`. Chưa merge vào UI branch.

Tasks chung:

- Thay mock ports bằng runtime switch:
  - mock mode cho dev/demo offline UI
  - Supabase mode khi env có URL/key
- Tích hợp Realtime invalidation:
  - orders/payments/tables -> refetch open orders/floor/report
  - menu/floor/decor -> refetch menu/floor plan
- Realtime nằm ở `IRealtimePort`/`useRealtime`, không rải `supabase.channel()` trong feature/component.
- Chạy full smoke với Supabase project thật sau khi user cung cấp env.
- Không đổi domain DTO trong phase này nếu không có bug contract.

Done khi:

- 2 máy/browser cùng store thấy order/table status update qua refetch realtime.
- Create store + seed demo + passcode + order + payment + report chạy end-to-end.

---

## 6. Phase 4 — Demo Hardening

Tasks:

- Add loading/error/empty states cho mọi drawer.
- Add toasts rõ cho conflict, unavailable menu, insufficient cash, clear-demo blocked.
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
- [ ] Chạy `git worktree list` ở docs worktree để xác nhận `D:\Workspace\pos-cafe-code` đang ở branch `codex/code-foundation` hoặc branch stream tách từ branch đó.
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
