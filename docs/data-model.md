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
- `employees`: nhân viên thuộc store, role, passcode hash, trạng thái active, `permission_overrides` (jsonb nullable — seam phân quyền theo hành động).

Ý nghĩa:

- Store Key gồm store number và secret để ghép máy vào store.
- Tạo store mới mặc định blank (store/settings + 1 admin), `seed_status=seeded`; chỉ seed dữ liệu mẫu khi `CreateStoreInput.seedDemo=true` (checkbox lúc tạo) hoặc khi admin bấm khởi tạo demo trong Cài đặt. Địa chỉ từ form được lưu vào `store_settings.address`.
- Seed demo upsert theo `id`/`seed_key` và clear `deleted_at`/`deleted_by_employee_id` trên các bảng editor (cashier dùng `is_active`) nên idempotent với `clear_demo_data`.
- Employee role quyết định default permission và module navigation; override từng nhân viên chỉ thay đổi quyền hành động, không mở thêm module trên nav.
- `employees.permission_overrides` (migration 011) là **quyền theo hành động** tách khỏi quyền vào module: shape `{"grants": [...], "denies": [...]}`. Quyền hiệu lực = (default theo role ∪ grants) − denies (denies luôn thắng). Mặc định `null` (mọi người theo role). Từ phase 20, Employees Drawer chỉnh checkbox quyền hiệu lực và persist diff tối thiểu; `undefined` trong update DTO nghĩa là không đụng field, `null` nghĩa là xóa override.
- Catalog runtime hiện có đúng 5 mã được enforce: `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`. Mapper Supabase lọc bỏ mã ngoài catalog.
- Permission vẫn là app-layer authorization; RPC check chỉ để phòng thủ/audit, **không** phải DB-secured — employee id vẫn spoof được với session store hợp lệ.
- `store_settings.qr_info` là seam schema cho QR/bank sau này; drawer Payment Settings hiện là preview/local UI, chưa persist field này qua `settingsRepo`.

## Nhóm Menu

- `categories`: danh mục món.
- `menu_items`: món, giá, category, availability, image asset key.
- `option_groups`: nhóm tuỳ chọn (modifier) **dùng chung cho mọi món** — `select_type` single/multi + `is_required`. Không gắn cứng vào một món (đã bỏ `menu_item_id`, `min_select`, `max_select`).
- `option_values`: giá trị tuỳ chọn và `price_delta` (giá của modifier, có thể 0).
- `menu_item_option_groups`: bảng nối nhiều-nhiều cho biết **món nào dùng nhóm nào** (`menu_item_id` × `option_group_id`, `sort_order`). Cũng xóa mềm như các bảng menu khác.

Ý nghĩa:

- Modifier là thư viện dùng chung: quản lý nhóm/giá trị ở một nơi, gắn vào nhiều món bằng cách tick (tạo/xoá link). Sửa một nhóm ảnh hưởng mọi món đang dùng.
- Nhóm `single` cho chọn tối đa 1 giá trị; `multi` cho chọn nhiều giá trị, mỗi giá trị có số lượng riêng (xem `order_item_options.quantity`). Nhóm `is_required` bắt buộc chọn ≥ 1.
- Menu editor lưu thay đổi bằng changeset (gồm cả changeset cho `menu_item_option_groups`).
- Các bảng menu dùng xóa mềm để giữ đường mở rộng sync/offline.
- Khi submit order, backend lấy tên/giá hiện tại từ DB để tạo snapshot; client không quyết định giá cuối. Tuỳ chọn chỉ hợp lệ khi nhóm của nó **có liên kết với đúng món** qua `menu_item_option_groups`.

## Nhóm Floor

- `floor_areas`: khu/tầng.
- `tables`: bàn, vị trí, kích thước, shape, seats, status.
- `floor_decor_items`: decor trên sơ đồ, asset key, vị trí, z-index, lock.

Ý nghĩa:

- Floor editor chỉ chỉnh layout, không ghi đè `table.status`.
- `table.status` do order/payment flow cập nhật.
- Decor không nhận order và không xuất hiện trong nghiệp vụ bàn.
- `floor_decor_items.asset_key` lưu đường dẫn asset built-in của ứng dụng. Catalog hiện có 9 texture tường và 131 PNG trang trí; thay catalog không cần đổi schema.
- Asset key legacy/không còn trong catalog vẫn được client render bằng placeholder nhãn/màu, tránh làm hỏng floor plan cũ.

## Nhóm Order

- `orders`: order number theo business date, loại order, table nullable, subtotal/discount/total, status, employee, lock version, và metadata hủy (`voided_at`, `voided_by_employee_id`, `void_reason_code`, `void_reason_note` — migration 011).
- `order_items`: snapshot item name, quantity, unit price, note, status.
- `order_item_options`: snapshot option name, price delta và **`quantity`** (số lượng modifier; nhóm single luôn 1, nhóm multi cho >1).

Ý nghĩa:

- `business_date` lấy theo timezone của store, không theo timezone máy.
- `order_no` unique theo `(store_id, business_date, order_no)`.
- `lock_version` dùng để phát hiện stale/conflict khi nhiều máy cùng thao tác (tách đơn instant pay cũng bump version đơn gốc).
- Replace order lines không hard-delete item cũ; item cũ được mark `removed`.
- Hủy đơn có 2 đường khác nhau: (1) đơn `open` bị hủy trước thanh toán = submit toàn bộ quantity 0 (đặt `total=0`, trả bàn, `paid_at` vẫn null); (2) đơn `paid` bị hủy = RPC `void_order` — **giữ nguyên** `total`/`order_no`/`business_date`/`paid_at` và payment row (audit + report tính đúng), chỉ đổi `status='void'`, ghi metadata hủy, bump `lock_version`, không đụng bàn. Dấu `paid_at is not null` phân biệt đơn "hủy sau khi đã thu tiền" với đơn "hủy trước thanh toán".

## Nhóm Payment & Report

- `payments`: payment theo order, employee, method, amount, received amount, change amount, paid_at. Mỗi đơn có đúng một payment khi `paid`.
- Report không có bảng riêng trong MVP; report query tính từ order/payment đã thanh toán.

Ý nghĩa:

- Phase này payment UI dùng cash-only.
- **Instant pay (split-order, migration 010)**: thanh toán một phần = `pay_order_items` **tách các món được chọn ra một ĐƠN MỚI độc lập** (UUID client cấp) và pay đơn đó ngay trong cùng transaction. Hai đơn không liên kết gì nhau — chỉ chung `table_id` lúc thanh toán. Đơn gốc còn lại trên bàn là đơn `open` bình thường (sửa/void được); bàn chỉ trống khi đơn gốc được trả nốt (qua `pay_order`).
- **Quy tắc đánh số**: bill trả trước mang `order_no` nhỏ hơn — đơn tách kế thừa số của đơn gốc, đơn gốc nhận số mới (max+1 theo `business_date`). Bàn #12 trả 2 lần → bill #12, phần còn lại thành #13, bill #13.
- Trả một phần số lượng của một dòng (vd 1 trong 2 Cà phê sữa) → tách dòng: dòng mới (UUID client cấp qua `splitItemId`) thuộc **đơn tách**; dòng gốc giảm quantity. Options của dòng tách là snapshot copy (id server cấp).
- Report tính order `paid` theo `business_date` — **mỗi lần thu vào report NGAY** vì đơn tách paid tức thì (không có trạng thái "tiền đã thu nhưng chưa ghi nhận"). Không có bảng tổng hợp lưu sẵn nên khi một đơn chuyển `paid → void`, doanh thu ngày/tháng tự loại đơn đó ra (không cần bút toán điều chỉnh).
- `CoreReport` bổ sung `voidCount`/`voidAmount` = số đơn và tổng tiền của các đơn **paid-rồi-hủy** (`status='void'` và `paid_at is not null`) theo `business_date`; đơn open-bị-hủy (`paid_at` null, `total` 0) không tính vào đây.
- Order history là order-centric: mỗi bill (đơn tách hoặc đơn thường) một dòng, không có liên kết giữa các đơn tách từ cùng một bàn. Đơn `void` hiển thị trong history (filter "Đã hủy") kèm người hủy/thời điểm/lý do.

## RPC Chính

- `has_employee_permission` (migration 012): helper SQL áp default theo role + grants/denies. Bảng default bị lặp với TypeScript `core/guards.ts` (TypeScript là source of truth), nên E2E deny-permission phải được chạy sau khi apply migration để phát hiện drift.
- `submit_order_changes`: tạo/cập nhật order mở, snapshot giá/tên/options, cập nhật table occupied/empty, in ticket khi có order mở. Migration 012 giữ nguyên chữ ký và yêu cầu lần lượt `order.create`, `order.update` hoặc `order.voidOpen` theo nhánh mutation.
- `pay_order`: tạo payment, set order paid, set table empty, trả payload receipt; migration 012 giữ nguyên chữ ký và yêu cầu `payment.take`.
- `pay_order_items`: instant pay tách đơn — validate từng dòng + tính tiền phía server, swap `order_no` (đơn tách kế thừa số, đơn gốc nhận số mới), move/tách dòng sang đơn mới, tạo payment và set đơn mới `paid` ngay, tính lại tổng + bump `lock_version` đơn gốc. Từ chối selection phủ 100% đơn (client phải dùng `pay_order`). Trả về thông tin đơn tách (`orderId/orderNo/total/receipt`) + đơn gốc (`sourceOrderId/sourceOrderNo/sourceTotal/sourceLockVersion`). Migration 012 giữ nguyên chữ ký và yêu cầu `payment.take`.
- `void_order` (migration 011, thay stub reserved cũ): hủy một đơn **đã thanh toán**. Tham số `(p_order_id, p_employee_id, p_expected_lock_version, p_reason_code, p_reason_note)`. Check quyền `order.voidPaid` (role admin hoặc grant override, denies thắng), validate `reason_code` (5 giá trị; `other` bắt buộc có note), khóa đơn `for update`, chỉ nhận `status='paid'` + đúng `lock_version` (sai → `ORDER_VERSION_CONFLICT`), rồi set `void` + metadata hủy + bump version. Không đụng total/order_no/paid_at/payment/bàn.
- `verify_employee_pin` (migration 011): trả thêm cột `permission_overrides` để client dựng quyền của nhân viên đang đăng nhập.
- `clear_demo_data`: admin-only, block nếu còn open orders, xóa mềm dữ liệu seed và giữ admin.

## Domain Types Trong App

- `MenuCatalog`: categories, menuItems, optionGroups, optionValues.
- `FloorPlan`: areas, tables, decorItems.
- `OrderSummary`/`OrderDetail`: order state, total, table/order type, snapshot items; `OrderDetail.payment` giữ payment snapshot nullable cho đơn đã thanh toán; `OrderDetail` còn có metadata hủy (`voidedAt`, `voidedByEmployeeId`, `voidReasonCode`, `voidReasonNote`).
- `VoidOrderInput`/`VoidOrderResult`: hủy đơn đã thanh toán (`reasonCode: VoidReasonCode`, `reasonNote`, `expectedVersion`). `EmployeePermission`/`EmployeePermissionOverrides`: seam quyền theo hành động trên `Employee.permissionOverrides`.
- `PayOrderInput`/`PayOrderResult`: payment cash flow và receipt payload.
- `PayOrderItemsInput`/`PayOrderItemsResult`: instant pay tách đơn (`newOrderId` + `items: {orderItemId, quantity, splitItemId}`), kết quả gồm đơn tách đã paid + trạng thái đơn gốc còn lại.
- `MenuChanges`/`FloorPlanChanges`: changeset create/update/delete cho editor.

## Menu Image Storage

- Bucket Supabase Storage: `menu-item-images`.
- Migration `005_menu_item_images_storage.sql` tạo/cập nhật bucket public, giới hạn 5MB, MIME JPG/PNG/WebP và policy public-read/store-scoped write; migration `006_menu_item_image_asset_key.sql` bổ sung cột asset key cho database hiện hữu.
- `menu_items.image_asset_key` lưu asset key theo dạng `menu-item-images/{store_id}/menu-items/{menu_item_id}/{uuid}.{ext}`.
- Bucket public để POS render ảnh nhanh; upload/update/delete bị giới hạn bằng Storage RLS theo thư mục `auth.uid()`.
- File hỗ trợ JPG, PNG, WebP, tối đa 5MB; UI chặn file lớn hơn giới hạn này trước khi upload.
- Detail preview trong Menu Editor giữ ảnh không crop để nhân viên kiểm tra file đã chọn; card món trong Menu Editor và Order Drawer dùng `object-cover` để lấp đầy khung card.
- Database hiện hữu phải áp cả migration 005 (bucket/policy) và 006 (cột `menu_items.image_asset_key`); schema mới đã có cột này trong bảng `menu_items`.
