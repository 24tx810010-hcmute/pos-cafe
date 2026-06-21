# Schema/RLS Decisions — POS Cafe

> **Ngày chốt:** 2026-06-10  
> **Vai trò:** tài liệu quyết định chi tiết cho schema, RLS, delete policy, decor asset.  
> **Spec tổng thể:** [2026-06-09-pos-cafe-design.md](2026-06-09-pos-cafe-design.md)
> **Coding decisions:** [2026-06-11-pos-cafe-coding-decisions.md](2026-06-11-pos-cafe-coding-decisions.md)
> **Implementation contract:** [2026-06-11-pos-cafe-implementation-contract.md](2026-06-11-pos-cafe-implementation-contract.md)

---

## 1. Mục tiêu

- Tránh quyết định schema sai từ đầu, vì dự án này là nền cho luận án chuyên ngành.
- Giữ MVP build được nhanh bằng Supabase, nhưng không chặn đường mở rộng offline/RxDB sau này.
- Làm RLS đơn giản, dễ giải thích khi bảo vệ: mọi dữ liệu quán cô lập theo `store_id = auth.uid()`.
- Floor-plan decor là asset có sẵn của hệ thống, không phải dữ liệu nghiệp vụ như bàn.

---

## 2. Quyết định đã chốt

| Nhóm | Quyết định |
|---|---|
| Store identity | `stores.id = auth.uid()` của Supabase Auth store account |
| Store Key | `STORE_NO-SECRET`, ví dụ `0001-X8F3QA`; `store_no` lấy từ sequence, cho phép hở số; không cho nhập mỗi số store |
| Store-owned rows | Mọi bảng dữ liệu của quán có `store_id` |
| RLS chuẩn | `using (store_id = auth.uid())` + `with check (store_id = auth.uid())` |
| Role boundary | RLS cô lập store; role nhân viên là app-layer/Core guard, không claim DB-level role security |
| Child tables | Child table vẫn có `store_id`, kể cả `option_values`, `order_items`, `order_item_options` |
| FK an toàn | FK quan trọng dùng composite `(store_id, parent_id)` để không trỏ nhầm parent khác store |
| Delete policy | Dữ liệu editor/sync dùng tombstone `deleted_at`, không hard-delete |
| Order delete | `orders.status = void`, không xoá order |
| Order item delete | `order_items.status = removed`, không xoá item đang nằm trong order |
| Order concurrency | `orders.lock_version int default 0`; submit/pay dùng expected version để chống double-submit |
| Order pricing | DB là nguồn giá/tên; RPC snapshot từ `menu_items`/`option_values`, không tin giá client |
| Payment | Có bảng `payments`; UI MVP chỉ cash, enum chừa `bank_transfer`, `qr`, `other`; DB dùng `employee_id`, domain có thể expose `paidByEmployeeId` |
| Critical RPC | `get_next_store_no`, `verify_employee_pin`, `submit_order_changes`, `pay_order`, `clear_demo_data`; `void_order` reserved/admin/future |
| Passcode | UI chọn nhân viên + nhập PIN; không yêu cầu PIN unique toàn store |
| Menu image | MVP không upload ảnh món; dùng text/placeholder hoặc built-in `image_asset_key` |
| Decor asset | Decor dùng `asset_key` trỏ tới ảnh built-in trong frontend; user không upload/custom asset trong MVP |
| Migration | 3 file foundation: schema/enums, indexes/RLS/triggers, RPC/functions; apply cloud trực tiếp |
| Seed | Demo seed medium cafe Việt nằm trong repo dạng TypeScript seed bundle; seed lỗi thì retry |

---

## 3. Schema rules

- Mọi bảng có `id` UUID do client sinh khi insert, trừ `stores.id` lấy từ `auth.uid()`.
- Mọi bảng có `created_at` + `updated_at`; `updated_at` auto update bằng trigger. Không có ngoại lệ cho `stores`, `store_settings`, `payments`, hoặc `order_item_options`.
- Mọi bảng thuộc quán có `store_id`.
- `stores.store_no` là số tăng dần/unique để tạo Store Key dễ đọc; lấy bằng Postgres sequence, race-safe, cho phép hở số; không dùng `store_no` làm credential.
- Bảng editor/sync có tombstone:
  - `categories`
  - `menu_items`
  - `option_groups`
  - `option_values`
  - `floor_areas`
  - `tables`
  - `floor_decor_items`
- Tombstone fields:
  - `deleted_at timestamptz null`
  - `deleted_by_employee_id uuid null`
- Seedable demo tables có thêm `seed_key text null` để seed retry idempotent và `clear_demo_data` chỉ clear dữ liệu seed. Các bảng này gồm `employees`, `categories`, `menu_items`, `option_groups`, `option_values`, `floor_areas`, `tables`, `floor_decor_items`; mỗi bảng có unique partial index `(store_id, seed_key) where seed_key is not null`.
- `menu_items.is_available` chỉ có nghĩa "tạm hết món", không phải xoá.
- Ảnh món MVP không upload: `menu_items.image_asset_key null` nếu dùng asset built-in/placeholder; không tạo Supabase Storage bucket/policy cho ảnh món trong MVP.
- `employees.is_active` là khoá/mở nhân viên.
- `stores.is_active` là license/app-layer conceptual trong MVP. Nếu muốn khóa store thật ở DB, mọi policy/RPC phải check `stores.is_active`; chưa claim đây là DB-level enforcement trong MVP.
- `store_settings.timezone` default `Asia/Saigon`; report "hôm nay" và daily `order_no` theo timezone của store, không theo thiết bị.
- `orders` có unique/index theo `(store_id, business_date, order_no)`; RPC tự cấp `order_no` trong transaction.
- `orders.lock_version int default 0`; `submit_order_changes` và `pay_order` nhận expected version, chỉ mutate nếu status + version còn khớp, rồi tăng `lock_version`.
- `submit_order_changes` không tin giá/tên client gửi; RPC đọc `menu_items`/`option_values` active trong DB, kiểm tra cùng `store_id`, chưa tombstone, món còn available, option thuộc đúng món, rồi snapshot tên + giá.
- `payments` là record thanh toán, không hard-delete trong luồng UI.
- `orders.discount_type`/`discount_value` được giữ để mở rộng, nhưng phase hiện tại không làm UI discount/voucher.
- Tiền lưu integer VND.
- `order_items`/`order_item_options` snapshot cả tên + giá (`item_name`, `option_name`, `unit_price`, `price_delta`).
- Report MVP chỉ tính order `status = paid`, loại `void`, và lọc ngày bằng `business_date` theo `store_settings.timezone`.

FK rule:

```txt
categories(store_id, id)
menu_items(store_id, category_id) -> categories(store_id, id)
option_groups(store_id, menu_item_id) -> menu_items(store_id, id)
option_values(store_id, option_group_id) -> option_groups(store_id, id)
floor_areas(store_id, id)
tables(store_id, area_id) -> floor_areas(store_id, id)
floor_decor_items(store_id, area_id) -> floor_areas(store_id, id)
orders(store_id, table_id) -> tables(store_id, id)
payments(store_id, order_id) -> orders(store_id, id)
order_items(store_id, order_id) -> orders(store_id, id)
order_items(store_id, menu_item_id) -> menu_items(store_id, id)
order_item_options(store_id, order_item_id) -> order_items(store_id, id)
order_item_options(store_id, option_value_id) -> option_values(store_id, id)
```

---

## 4. RLS rules

Policy mặc định cho bảng có `store_id`:

```sql
using (store_id = auth.uid())
with check (store_id = auth.uid())
```

`stores`:

```sql
using (id = auth.uid())
with check (id = auth.uid())
```

Nguyên tắc:

- Không tạo bảng lookup public để tìm store bằng `store_no`.
- Không cho client đọc store khác bằng join parent.
- RLS chỉ cô lập giữa các store. Role nhân viên vẫn enforce ở tầng app/core guard; RPC role check chỉ là guardrail nghiệp vụ/audit, không phải DB-level role security tuyệt đối.
- Bảng child có `store_id` để RLS không phải join sâu qua parent, đồng thời dễ sync/offline.

### 4.1 RPC rules

RPC dùng cho các thao tác cần tính nhất quán hoặc cần che hash:

| RPC | Trách nhiệm |
|---|---|
| `get_next_store_no()` | cấp `store_no` tiếp theo bằng Postgres sequence; cho phép hở số |
| `verify_employee_pin(...)` | verify PIN bằng `pgcrypto`, client không đọc `passcode_hash`; UI chọn nhân viên + PIN |
| `submit_order_changes(...)` | tạo/cập nhật/huỷ order open bằng replace order lines; DB đọc giá/tên active rồi snapshot; nếu dine-in thì cập nhật table status trong cùng transaction |
| `pay_order(...)` | tạo `payments`, set order `paid`/`paid_at`, set table `empty` nếu có |
| `clear_demo_data(...)` | admin-only guardrail; block nếu còn open orders; tombstone đúng seed data bằng deterministic seed IDs, deactive cashier demo, giữ 1 admin |
| `void_order(...)` | reserved/admin/future only; không dùng để void paid order trong MVP |

Exact RPC signatures nằm ở implementation contract; file này chốt responsibility + transaction boundary.
RPC nào insert row mới vẫn phải nhận UUID do client sinh, không dựa vào Postgres default UUID.
`submit_order_changes` dùng typed scalar params + `jsonb` items/options payload; các RPC khác dùng typed params.
`submit_order_changes` và `pay_order` nhận expected lock version; nếu `orders.lock_version` lệch thì trả conflict error (`ORDER_VERSION_CONFLICT`) để UI yêu cầu tải lại.
Nếu menu item/option không còn hợp lệ lúc submit, RPC trả lỗi nghiệp vụ như `MENU_ITEM_UNAVAILABLE` hoặc `OPTION_VALUE_UNAVAILABLE`; UI refetch menu và giữ draft để user sửa.
RPC kiểm tra `employee_id` active, thuộc store hiện tại và role khi cần; admin-only RPC kiểm tra role admin như guardrail nghiệp vụ/audit. Guardrail này spoofable nếu người gọi đã có Store Key/session, không thay thế caveat role app-layer và không được trình bày như employee-level DB security.
`verify_employee_pin` trả safe employee (`id`, `name`, `role`), không trả hash.

### 4.2 Migration policy

- Tất cả schema, enum, index, trigger, RLS policy và RPC nằm trong `supabase/migrations/*.sql`.
- Dev/apply trực tiếp lên Supabase cloud project bằng SQL migrations.
- Không dùng dashboard-only làm source of truth.
- Không bắt buộc Supabase local CLI/Docker trong MVP.
- Foundation chia 3 migration:
  - `001_schema_enums.sql`: extensions, enums, tables, composite keys/FK.
  - `002_indexes_rls_triggers.sql`: indexes, `updated_at` triggers, RLS enable/policies.
  - `003_rpc_functions.sql`: `get_next_store_no`, `verify_employee_pin`, `submit_order_changes`, `pay_order`, `clear_demo_data`, reserved `void_order`.
- Không thêm ORM migration trong MVP.

### 4.3 Local SQL validation — 2026-06-11

Đã validate thật trên PostgreSQL local, nên bỏ caveat cũ về việc migration local chưa được kiểm chứng:

- Máy dev cài PostgreSQL `18.4` qua Scoop để có `psql`, `initdb`, `pg_ctl`.
- Dựng PostgreSQL temp cluster riêng, bootstrap tối thiểu Supabase `auth` gồm schema `auth`, bảng `auth.users`, function `auth.uid()`.
- Apply thành công `001_schema_enums.sql`, `002_indexes_rls_triggers.sql`, `003_rpc_functions.sql` với `ON_ERROR_STOP=1`.
- Happy-path smoke RPC pass:
  - `submit_order_changes`: tạo order, snapshot giá/option từ DB, set bàn `occupied`.
  - `pay_order`: tạo payment, set order `paid`, release bàn về `empty`.
  - `clear_demo_data`: tombstone seed data, deactivate cashier demo, giữ admin.
- Negative smoke pass:
  - `PAYMENT_AMOUNT_TOO_LOW` khi khách đưa thiếu tiền.
  - `OPEN_ORDERS_BLOCK_CLEAR_DEMO` khi còn order open.
- PostgreSQL temp cluster đã stop và thư mục temp đã xóa sau test.
- Supabase cloud không chạy migration trong lượt validation này; cloud migration vẫn là bước setup/deploy riêng khi có project/env thật.

---

## 5. Delete/tombstone policy

Không dùng `DELETE` trong luồng UI cho dữ liệu sync/editor:

```txt
categories
menu_items
option_groups
option_values
floor_areas
tables
floor_decor_items
```

Khi user xoá các record trên:

```txt
deleted_at = now()
deleted_by_employee_id = currentEmployee.id
updated_at = now()
```

Query UI mặc định:

```txt
where deleted_at is null
```

Order:

- Không xoá order khỏi DB.
- Huỷ/cancel order open bình thường: dùng `submit_order_changes` với toàn bộ item về 0 → `orders.status = void`, table `empty`.
- Paid order không void trong MVP.
- Xoá món khỏi order đang mở: `order_items.status = removed`.
- `order_item_options` đi theo `order_items`; không hard-delete trong luồng UI.
- `payments` không xoá khỏi DB trong luồng UI; hoàn/void payment là hướng mở rộng sau, không làm phase này.

Clear demo data:

- Dùng tombstone cho menu/floor/decor demo được nhận diện bằng deterministic seed IDs theo `store_id + seed_key`.
- Admin-only.
- MVP block nếu còn open orders; user phải thanh toán hoặc huỷ order trước khi clear demo.
- Deactive cashier demo và giữ lại đúng 1 admin.
- Nếu cần slate trắng thật, tạo record mới bằng UUID mới thay vì hồi sinh record demo cũ.
- Nếu sau này muốn xoá toàn bộ dữ liệu user tự tạo, đó là destructive reset riêng, phải đổi tên và có confirm rõ.

Seed source:

- Demo seed nằm trong repo dạng TypeScript seed bundle.
- Seed demo dùng deterministic IDs và `seed_key` theo `store_id + seed_key` cho nhân viên demo, category, món, option, floor area, bàn, decor để retry idempotent và không tạo trùng dữ liệu.
- `seed.demo` gồm admin PIN `123456`, cashier PIN `111111`, menu demo medium kiểu cafe Việt, 2 floor areas medium, tables và decor placeholder.
- Menu demo mặc định: 4 categories, 22 món cafe Việt phổ thông, option size/đá/đường/topping/thêm shot.
- Floor demo mặc định: `Tầng trệt` 8 bàn, `Lầu 1` 6 bàn, decor placeholder `plant_01`, `wall_01`, `counter_01`, `door_01`.
- Không seed order history.
- Nếu seed lỗi sau khi store tạo xong: set `stores.seed_status = failed`; UI retry bằng seed idempotent, không xoá store.
- `seed.blank` giữ đúng 1 admin và settings tối thiểu.
- Seed decor chỉ lưu `asset_key`, không lưu URL ảnh.

---

## 6. Decor asset policy

Decor là lớp hiển thị trên floor plan, không phải bàn:

- Không có `status`.
- Không nhận order.
- Không tính vào thống kê bàn.
- Không xuất hiện trong payment/order flow.

Schema MVP của `floor_decor_items`:

```txt
id
store_id
area_id
kind: wall | plant | counter | door | decor | image
label NULL
asset_key
pos_x
pos_y
width
height
rotation
z_index
is_locked
deleted_at NULL
deleted_by_employee_id NULL
created_at
updated_at
```

Asset source:

- `asset_key` trỏ tới catalog ảnh built-in trong frontend.
- Ảnh decor đặt trong `src/assets/floor-decor`.
- Ví dụ: `plant_01`, `wall_01`, `counter_01`, `door_01`.
- MVP không làm upload ảnh decor.
- MVP không lưu `image_url`/`storage_path` cho decor.
- Nếu sau này cần custom asset, thêm migration riêng, không thiết kế ngay.

---

## 7. Offline/RxDB readiness

Chưa làm offline-first trong MVP, nhưng schema phải chừa đường:

- UUID client giúp record tạo offline có ID ổn định.
- `updated_at` là checkpoint sync.
- `deleted_at` là tombstone để client offline biết record đã bị xoá.
- Không hard-delete giúp pull replication không bị mất sự kiện xoá.
- Ports/adapters giữ Core/UI không phụ thuộc Supabase, sau này thay adapter bằng RxDB vẫn được.

MVP không làm:

- RxDB/local DB.
- Conflict resolver phức tạp.
- `_deleted` replication field riêng.
- Upload/sync decor custom asset.

---

## 8. Checklist khi build schema

- [ ] `stores.id = auth.uid()`.
- [ ] Mọi bảng store-owned có `store_id`.
- [ ] Mọi insert dùng UUID client, không dựa vào Postgres default UUID; riêng `stores.id = auth.uid()`.
- [ ] Mọi bảng có `created_at` + `updated_at`.
- [ ] `stores.store_no` dùng sequence/race-safe, chấp nhận hở số.
- [ ] Bảng editor/sync có `deleted_at` + `deleted_by_employee_id`.
- [ ] UI query mặc định lọc `deleted_at is null`.
- [ ] Không hard-delete menu/floor/decor/table từ UI.
- [ ] `orders` huỷ bằng `status = void`.
- [ ] `order_items` xoá bằng `status = removed`.
- [ ] `payments` tồn tại và có RLS theo `store_id`.
- [ ] `orders.lock_version int default 0`; `submit_order_changes`/`pay_order` check expected version và trả `ORDER_VERSION_CONFLICT` khi lệch.
- [ ] `submit_order_changes` đọc giá/tên từ DB và snapshot; client không làm nguồn giá.
- [ ] Lỗi menu item/option unavailable được map thành `AppError` để UI reload menu.
- [ ] Menu item MVP không dùng upload/Supabase Storage; nếu cần ảnh thì dùng `image_asset_key` built-in/placeholder.
- [ ] Report MVP chỉ tính `orders.status = paid`, loại `void`.
- [ ] `floor_decor_items` chỉ lưu `asset_key`, không có cột ảnh custom.
- [ ] RPC critical được tạo bằng SQL migrations, không viết logic transaction ở client.
- [ ] Foundation migration chia 3 file: schema/enums, indexes/RLS/triggers, RPC/functions.
- [ ] Demo seed nằm trong TS seed bundle, decor asset nằm trong `src/assets/floor-decor`.
- [ ] RLS bảng có `store_id`: `store_id = auth.uid()`.
- [ ] FK quan trọng dùng composite `(store_id, parent_id)`.
