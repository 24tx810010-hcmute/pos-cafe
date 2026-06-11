# POS Cafe Parallel Task Phases

> **Vai trò:** file handoff để chia nhiều session/agent code song song sau milestone `feat: scaffold POS app foundation`.
> **Base hiện tại:** branch `codex/code-kickoff-foundation`, commit `731a527`.
> **Nguyên tắc:** mỗi session đọc `pos-cafe-context.md`, implementation contract, và file này trước khi code.

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
- Test nền:
  - `npm run build`
  - `npm run test`
  - `npm run smoke`

Chưa có:

- Supabase adapters thật.
- RPC transaction thật cho `submit_order_changes`, `pay_order`, `clear_demo_data`.
- Store creation/seed thật.
- Realtime subscription thật.
- UI production component split, hiện `src/app/App.tsx` còn là mock monolith.

---

## 2. Quy tắc chia session

- Mỗi session tạo branch riêng từ `codex/code-kickoff-foundation`, ví dụ `codex/stream-db-rpc`, `codex/stream-ui-pos`.
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

Ownership:

- `supabase/migrations/003_rpc_functions.sql`
- có thể bổ sung migration mới `004_*` nếu cần thay vì sửa migration đã apply; hiện chưa apply cloud nên sửa `003` vẫn được.
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

Done khi:

- SQL không còn `RPC_NOT_IMPLEMENTED` cho 3 RPC chính.
- RPC trả lỗi chuẩn: `ORDER_VERSION_CONFLICT`, `MENU_ITEM_UNAVAILABLE`, `OPTION_VALUE_UNAVAILABLE`, `PAYMENT_AMOUNT_TOO_LOW`, `OPEN_ORDERS_BLOCK_CLEAR_DEMO`.
- Có checklist manual SQL review trong commit/PR.

### Session B — Supabase Adapter Track

Ownership:

- `src/adapters/supabase/*`
- `src/lib/supabase*` nếu cần
- `.env.example`

Tasks:

- Tạo Supabase client đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
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
- Repo list/get mặc định lọc `deleted_at is null`.

Dependency:

- Có thể skeleton song song, nhưng RPC adapter hoàn chỉnh phụ thuộc Session A.

Done khi:

- UI/Core không import `@supabase/supabase-js`.
- Adapter tests hoặc mockable tests cover error mapping cơ bản.
- `npm run build` xanh.

### Session C — Store/Auth/Seed Flow Track

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

Dependency:

- Cần adapter Auth/Employee/Seed từ Session B hoặc dùng fake adapter tới khi B xong.

Done khi:

- Store flow không lưu employee vào localStorage/sessionStorage.
- Auth setting caveat "Confirm email off" vẫn ghi trong docs/context nếu cần.
- Smoke/manual flow: create/pair -> passcode -> floor.

### Session D — POS Order/Payment Track

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

Tasks chung:

- Thay mock ports bằng runtime switch:
  - mock mode cho dev/demo offline UI
  - Supabase mode khi env có URL/key
- Tích hợp Realtime invalidation:
  - orders/payments/tables -> refetch open orders/floor/report
  - menu/floor/decor -> refetch menu/floor plan
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
- Add Supabase setup checklist:
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

- [ ] Đọc `pos-cafe-context.md`.
- [ ] Đọc `2026-06-11-pos-cafe-implementation-contract.md`.
- [ ] Đọc file parallel task phases này.
- [ ] Xác định ownership file.
- [ ] Tạo branch riêng.

Trước khi kết thúc:

- [ ] `npm run build` xanh.
- [ ] `npm run test` nếu chạm core/domain/mock.
- [ ] `npm run smoke` nếu chạm UI.
- [ ] Ghi rõ còn stub hay dependency nào chưa xong.
- [ ] Không commit `.env`, `dist`, `node_modules`, report/caches.
