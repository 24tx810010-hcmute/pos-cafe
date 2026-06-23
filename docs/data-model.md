# Data Model

Data model dùng PostgreSQL/Supabase, thiết kế theo store-scoped multi-tenant: hầu hết bảng nghiệp vụ có `store_id`, UUID primary key, `created_at`, `updated_at`, và một số bảng editor có `deleted_at` để xóa mềm.

## Enum Chính

| Enum | Giá trị | Dùng cho |
| --- | --- | --- |
| `employee_role` | `admin`, `cashier`, `kitchen` | Quyền nhân viên |
| `seed_status` | `pending`, `seeded`, `failed` | Trạng thái seed dữ liệu mẫu của store |
| `option_select_type` | `single`, `multi` | Cách chọn option/topping |
| `table_shape` | `round`, `square`, `rectangle` | Hình bàn trong floor editor |
| `table_status` | `empty`, `occupied` | Trạng thái vận hành bàn |
| `decor_kind` | `wall`, `plant`, `counter`, `door`, `decor`, `image` | Decor trên sơ đồ |
| `order_type` | `dine_in`, `takeaway` | Loại đơn |
| `order_status` | `open`, `paid`, `void` | Vòng đời order |
| `order_item_status` | `waiting`, `done`, `removed` | Chừa seam cho kitchen/removal |
| `discount_type` | `none`, `percent`, `amount` | Chừa seam discount sau này |
| `payment_method` | `cash`, `bank_transfer`, `qr`, `other` | Phase này UI dùng `cash` |

## Nhóm Store & Settings

- `stores`: store id, số store, email, trạng thái seed, trạng thái active.
- `store_settings`: tên hiển thị, địa chỉ, currency VND, timezone, footer hóa đơn, QR info.
- `employees`: nhân viên thuộc store, role, passcode hash, trạng thái active.

Ý nghĩa:

- Store Key gồm store number và secret để ghép máy vào store.
- Tạo store mới sẽ seed dữ liệu mẫu hoặc blank admin tùy flow.
- Employee role dùng cho app-layer permission trong phase này.
- `store_settings.qr_info` là seam schema cho QR/bank sau này; drawer Payment Settings hiện là preview/local UI, chưa persist field này qua `settingsRepo`.

## Nhóm Menu

- `categories`: danh mục món.
- `menu_items`: món, giá, category, availability, image asset key.
- `option_groups`: nhóm option theo món, single/multi, required, min/max.
- `option_values`: giá trị option và price delta.

Ý nghĩa:

- Menu editor lưu thay đổi bằng changeset.
- Các bảng menu dùng xóa mềm để giữ đường mở rộng sync/offline.
- Khi submit order, backend lấy tên/giá hiện tại từ DB để tạo snapshot; client không quyết định giá cuối.

## Nhóm Floor

- `floor_areas`: khu/tầng.
- `tables`: bàn, vị trí, kích thước, shape, seats, status.
- `floor_decor_items`: decor trên sơ đồ, asset key, vị trí, z-index, lock.

Ý nghĩa:

- Floor editor chỉ chỉnh layout, không ghi đè `table.status`.
- `table.status` do order/payment flow cập nhật.
- Decor không nhận order và không xuất hiện trong nghiệp vụ bàn.

## Nhóm Order

- `orders`: order number theo business date, loại order, table nullable, subtotal/discount/total, status, employee, lock version.
- `order_items`: snapshot item name, quantity, unit price, note, status.
- `order_item_options`: snapshot option name và price delta.

Ý nghĩa:

- `business_date` lấy theo timezone của store, không theo timezone máy.
- `order_no` unique theo `(store_id, business_date, order_no)`.
- `lock_version` dùng để phát hiện stale/conflict khi nhiều máy cùng thao tác.
- Replace order lines không hard-delete item cũ; item cũ được mark `removed`.

## Nhóm Payment & Report

- `payments`: payment theo order, employee, method, amount, received amount, change amount, paid_at.
- Report không có bảng riêng trong MVP; report query tính từ order/payment đã thanh toán.

Ý nghĩa:

- Phase này payment UI dùng cash-only.
- `pay_order` tạo payment, set order paid và set table empty trong cùng transaction.
- Report chỉ tính order paid, loại void, lọc theo `business_date`.

## RPC Chính

- `submit_order_changes`: tạo/cập nhật order mở, snapshot giá/tên/options, cập nhật table occupied/empty, in ticket khi có order mở.
- `pay_order`: tạo payment, set order paid, set table empty, trả payload receipt.
- `clear_demo_data`: admin-only, block nếu còn open orders, xóa mềm dữ liệu seed và giữ admin.

## Domain Types Trong App

- `MenuCatalog`: categories, menuItems, optionGroups, optionValues.
- `FloorPlan`: areas, tables, decorItems.
- `OrderSummary`/`OrderDetail`: order state, total, table/order type, snapshot items.
- `PayOrderInput`/`PayOrderResult`: payment cash flow và receipt payload.
- `MenuChanges`/`FloorPlanChanges`: changeset create/update/delete cho editor.

## Menu Image Storage

- Bucket Supabase Storage: `menu-item-images`.
- `menu_items.image_asset_key` lưu asset key theo dạng `menu-item-images/{store_id}/menu-items/{menu_item_id}/{uuid}.{ext}`.
- Bucket public để POS render ảnh nhanh; upload/update/delete bị giới hạn bằng Storage RLS theo thư mục `auth.uid()`.
- File hỗ trợ JPG, PNG, WebP, tối đa 5MB; UI chặn file lớn hơn giới hạn này trước khi upload.
- Detail preview trong Menu Editor giữ ảnh không crop để nhân viên kiểm tra file đã chọn; card món trong Menu Editor và Order Drawer dùng `object-cover` để lấp đầy khung card.
- Database hiện hữu cần migration bổ sung `menu_items.image_asset_key`; schema mới đã có cột này trong bảng `menu_items`.
