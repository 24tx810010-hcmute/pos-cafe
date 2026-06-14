# POS Cafe Supabase Cloud Setup Checklist

> Vai trò: checklist setup Supabase cloud thật cho demo/integration. File này không thay thế SQL migrations trong repo; migrations vẫn là source of truth.
> Trạng thái 2026-06-12: SQL/RPC đã validate local bằng PostgreSQL `18.4`; Supabase cloud đã check pass bằng REST/RPC E2E trực tiếp sau commit `ae1523b`.

---

## 1. Điều kiện trước khi setup

- Có Supabase project cloud mới hoặc project demo đã được user xác nhận dùng cho POS Cafe.
- Có quyền project owner/admin để chỉnh Auth, SQL Editor, Realtime.
- Code branch dùng để test cloud là integration branch đã qua checklist integration, hoặc `codex/stream-db-rpc` nếu chỉ test adapter/RPC không UI thật.
- Không apply migration bằng thao tác dashboard rời rạc rồi quên commit. Nếu cần đổi schema/RPC, sửa file migration trong repo trước.

---

## 2. Project settings

Trong Supabase dashboard:

- Project region: chọn region gần Việt Nam nếu free plan cho phép.
- Database password: lưu riêng ngoài repo.
- Auth -> Providers -> Email:
  - Enable Email provider.
  - Tắt email confirmation cho demo nếu cần signUp instant.
  - Không bật magic link/social provider trong MVP nếu không dùng.
- API settings:
  - Copy `Project URL`.
  - Copy `anon public key`.
  - Không commit service role key vào repo/frontend.

---

## 3. Apply migrations

Source of truth:

```text
supabase/migrations/001_schema_enums.sql
supabase/migrations/002_indexes_rls_triggers.sql
supabase/migrations/003_rpc_functions.sql
```

Apply theo đúng thứ tự `001` -> `002` -> `003`.

Cloud-direct bằng SQL Editor:

- Mở từng file migration từ repo.
- Paste nguyên file, không sửa tay trong dashboard.
- Run và lưu lại timestamp/log kết quả.
- Nếu fail, dừng. Không chạy tiếp file sau.

Cloud qua CLI nếu máy đã có Supabase CLI:

```powershell
supabase link --project-ref <project-ref>
supabase db push
```

Nếu CLI sinh diff ngoài ý muốn, dừng và báo user trước khi apply.

---

## 4. Post-migration SQL smoke

Chạy các kiểm tra tối thiểu trong SQL Editor sau migration:

```sql
select proname
from pg_proc
where proname in (
  'get_next_store_no',
  'verify_employee_pin',
  'submit_order_changes',
  'pay_order',
  'clear_demo_data',
  'hash_employee_pin'
)
order by proname;
```

Expected: đủ 6 functions.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'stores',
    'employees',
    'store_settings',
    'categories',
    'menu_items',
    'option_groups',
    'option_values',
    'floor_areas',
    'tables',
    'floor_decor_items',
    'orders',
    'order_items',
    'order_item_options',
    'payments'
  )
order by tablename;
```

Expected: các bảng business có RLS enabled theo migration contract.

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name in ('created_at', 'updated_at', 'deleted_at', 'seed_key', 'employee_id')
order by table_name, column_name;
```

Expected:

- Các bảng business chính có `created_at` + `updated_at`.
- Editor/demo rows có `deleted_at`/`seed_key` đúng theo schema.
- `payments` dùng `employee_id`.

---

## 5. Realtime setup

Supabase dashboard -> Database -> Replication/Realtime:

- Bật realtime cho các bảng cần invalidate:
  - `orders`
  - `order_items`
  - `payments`
  - `tables`
  - `categories`
  - `menu_items`
  - `option_groups`
  - `option_values`
  - `floor_areas`
  - `floor_decor_items`
  - `store_settings`
- Không cần realtime cho mọi bảng nếu không dùng trong UI.
- UI chỉ dùng realtime như signal để invalidate TanStack Query, không patch state thủ công.

---

## 6. Frontend env

Trong local `.env.local` hoặc Vercel env:

```text
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Không commit `.env.local`.

Kiểm tra runtime:

- Nếu thiếu URL/key và `VITE_DATA_MODE=supabase`, app phải fail rõ hoặc fallback theo runtime factory hiện tại, không crash mơ hồ.
- Mock mode vẫn chạy được khi không có env.

---

## 7. App smoke cloud

Chạy local app với Supabase mode:

```powershell
npm run build
npm run test
npm run smoke:supabase
npm run dev
```

`npm run smoke:supabase` dùng `playwright.supabase.config.ts` và chạy trên port riêng `5174`. Test mặc định tạo store thật qua UI, lấy Store Key/Admin PIN từ màn result, unlock admin, tạo + thanh toán order, rồi kiểm tra history/report. Không commit Store Key thật vào docs.

Lưu ý: `npm run smoke` vẫn là mock responsive baseline. Khi `.env.local` đặt `VITE_DATA_MODE=supabase`, để test responsive/mock baseline, chạy:

```powershell
$env:VITE_DATA_MODE='mock'; npm run smoke; Remove-Item Env:\VITE_DATA_MODE
```

Manual:

- Create store mới.
- Ghi lại Store Key hiển thị một lần.
- Seed demo success; nếu seed failed, retry seed không tạo trùng data.
- Passcode admin `123456`.
- Cashier demo `111111`.
- Tạo order dine-in, submit.
- Tạo takeaway, submit.
- Payment cash đủ tiền.
- Report hôm nay có paid order, không tính open/void.
- Clear demo:
  - Khi còn open order: blocked.
  - Khi hết open order: tombstone seed rows, deactive cashier demo, giữ admin.

2-browser realtime:

- Browser A submit order.
- Browser B đang cùng Store Key thấy table/order cập nhật sau realtime invalidation/refetch.
- Browser B pay order.
- Browser A thấy table empty/report cập nhật.

Realtime E2E automated:

```powershell
$env:RUN_SUPABASE_REALTIME_E2E='1'
npm run smoke:supabase
Remove-Item Env:\RUN_SUPABASE_REALTIME_E2E
```

Điều kiện: migration `supabase/migrations/004_realtime_publication.sql` phải được apply lên Supabase cloud để add các bảng `orders`, `payments`, `tables`, menu và floor tables vào publication `supabase_realtime`. Nếu chưa apply, test 2-browser sẽ skip mặc định; nếu force chạy thì browser B không nhận `postgres_changes`. Migration này đã được apply trên cloud project hiện tại trong phase 2026-06-14 và realtime E2E đã pass.

Validation log 2026-06-12:

- `.env.local` Supabase mode có URL + anon key hợp lệ.
- Auth settings public: signup enabled, email autoconfirm enabled, email provider enabled.
- REST table/column checks pass cho `stores`, `store_settings`, `employees`, `menu_items`, `tables`, `payments`, `order_item_options`.
- RPC checks pass: `hash_employee_pin`, `verify_employee_pin`, `submit_order_changes`, `pay_order`, `clear_demo_data`.
- Cloud E2E trực tiếp pass: create store test, seed tối thiểu, verify admin PIN, submit dine-in order, negative `PAYMENT_AMOUNT_TOO_LOW`, blocked `OPEN_ORDERS_BLOCK_CLEAR_DEMO`, pay order, clear demo seed rows.
- Một store test đầu tiên bị dừng giữa chừng do assert sai trong script kiểm tra; store test thứ hai pass và đã clear demo seed rows. Nếu cần dọn sạch tuyệt đối, xử lý bằng Supabase dashboard/service-role dưới xác nhận riêng.

Validation log 2026-06-14:

- `npm run smoke:supabase` pass single-browser UI E2E: create store thật, seed demo, admin PIN, submit order, pay cash, history/report hiển thị paid order.
- 2-browser realtime E2E ban đầu phát hiện cloud chưa publish `orders/tables/payments` qua Realtime; migration `004_realtime_publication.sql` đã thêm vào repo.
- Sau khi user apply migration `004` lên Supabase cloud, `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` pass 2 tests: single-browser create/pay/history/report và 2-browser realtime invalidation table status.

---

## 8. Data cleanup cho demo

Nếu cần reset demo trước buổi bảo vệ:

- Ưu tiên tạo store mới để demo sạch.
- Nếu dùng clear demo, nhớ rule: chỉ clear seed bundle, không destructive reset toàn store.
- Không chạy SQL delete thủ công trên cloud trừ khi user xác nhận reset destructive.
- Nếu cần destructive reset, ghi rõ project/store target và backup/export trước.

---

## 9. Security notes cần nhớ

- RLS hiện cô lập theo store account/session.
- Employee role là app-layer/Core guard trong MVP, không claim DB-level employee security.
- Ai có Store Key + ghép máy có thể có session store-level; Store Key phải xem như secret cấp quán.
- `stores.is_active` là conceptual/app-layer license lock trong MVP nếu RLS/RPC chưa check field này.
- Không đưa service role key lên frontend/Vercel public env.

---

## 10. Demo readiness

Trước ngày demo:

- Supabase free project không bị pause; mở dashboard/app để wake trước.
- Vercel env đã set đúng.
- 2 thiết bị/2 browser pair cùng store được.
- Có hotspot dự phòng vì app online-only.
- Có Store Key demo và admin PIN ghi riêng ngoài repo.
- Có phương án fallback mock mode nếu cloud bị pause/mất mạng.
