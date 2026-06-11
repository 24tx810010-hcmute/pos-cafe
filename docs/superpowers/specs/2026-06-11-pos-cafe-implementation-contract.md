# Implementation Contract — POS Cafe

> **Ngày chốt:** 2026-06-11  
> **Vai trò:** contract để chia multi-agent coding. Không phải code/migration thật.  
> **Spec tổng thể:** [2026-06-09-pos-cafe-design.md](2026-06-09-pos-cafe-design.md)  
> **Schema/RLS:** [2026-06-10-pos-cafe-schema-rls-decisions.md](2026-06-10-pos-cafe-schema-rls-decisions.md)  
> **Coding decisions:** [2026-06-11-pos-cafe-coding-decisions.md](2026-06-11-pos-cafe-coding-decisions.md)

---

## 1. RPC contract

Quy ước chung:

- RPC insert row mới phải nhận UUID do client sinh.
- RPC kiểm tra `employee_id` active và thuộc store hiện tại; admin-only RPC kiểm tra role admin như guardrail nghiệp vụ/audit.
- Role nhân viên vẫn là app-layer/Core guard; RLS chỉ cô lập store, không claim DB-level role security cho employee. RPC role checks là guardrail spoofable nếu người gọi đã có Store Key/session.
- RPC trả lỗi chuẩn để adapter map thành `AppError`.
- `submit_order_changes` dùng typed scalar params + `jsonb` items/options payload; RPC còn lại dùng typed params.
- DB là nguồn sự thật cho giá/tên khi submit order; client không gửi hoặc quyết định final price/name.
- Order/payment conflict trả lỗi chuẩn `ORDER_VERSION_CONFLICT`.

### `get_next_store_no()`

```sql
get_next_store_no() returns integer
```

- Cấp `store_no` tiếp theo để tạo Store Key.
- Dùng Postgres sequence, race-safe, **cho phép hở số** nếu create-store/signUp lỗi.
- Không dùng `store_no` làm credential.

### `verify_employee_pin(...)`

```sql
verify_employee_pin(
  p_employee_id uuid,
  p_pin text
) returns table (
  id uuid,
  name text,
  role employee_role
)
```

- Verify bằng `pgcrypto`.
- Không trả `passcode_hash`.
- UI gọi RPC sau khi user **chọn nhân viên + nhập PIN**; không yêu cầu PIN unique toàn store.
- Client lưu employee trả về trong memory-only Zustand state.

### `submit_order_changes(...)`

```sql
submit_order_changes(
  p_order_id uuid null,
  p_table_id uuid null,
  p_order_type order_type,
  p_employee_id uuid,
  p_expected_lock_version integer null,
  p_items jsonb
) returns jsonb
```

Input `p_items` là draft line selection, không phải nguồn giá/tên:

```ts
type SubmitOrderDraftItem = {
  id: string; // client UUID cho order_items row
  menuItemId: string;
  quantity: number;
  note?: string | null;
  options: Array<{
    id: string; // client UUID cho order_item_options row
    optionValueId: string;
  }>;
};
```

Behavior:

- Với order mới có item quantity > 0, adapter phải sinh UUID client và truyền vào `p_order_id`; `p_order_id = null` chỉ dùng cho draft rỗng/no-op, không tạo order DB. Quy tắc này giữ seam UUID client.
- Khi tạo order mới, RPC tự tính `business_date` và `order_no` tiếp theo trong transaction dựa trên `store_settings.timezone`. Cấp `order_no` bằng cách lock phạm vi `(store_id, business_date)` hợp lý trong transaction, hoặc retry khi unique `(store_id, business_date, order_no)` va chạm.
- Nếu dine-in có `p_table_id`: lock table row, kiểm tra cùng store/chưa tombstone, rồi set table `occupied`.
- Với mỗi item/option: RPC đọc `menu_items`/`option_values` active từ DB, kiểm tra cùng `store_id`, chưa tombstone, món còn `is_available`, option thuộc đúng món, rồi snapshot `item_name`, `option_name`, `unit_price`, `price_delta`.
- Nếu `p_order_id != null`: lock order row, check order `open` + `lock_version = p_expected_lock_version`, sau đó **replace order lines** của order open theo `p_items`.
- Replace lines không hard-delete: mark order_items cũ `status='removed'`, insert các item active mới bằng UUID client; option rows cũ nằm dưới removed item và không xuất hiện trên bill/report.
- Item quantity `0` hoặc bị bỏ khỏi draft được xem là removed.
- Nếu toàn bộ item quantity về `0`: set order `void`, table `empty`, không tạo payment.
- Không cho submit order đã `paid`.
- RPC tính `subtotal/total` từ DB snapshot trong transaction; client không được quyết giá cuối.
- Mỗi lần mutate thành công tăng `orders.lock_version`.
- Nếu version lệch: không mutate và trả `ORDER_VERSION_CONFLICT` để UI refetch.
- Nếu menu item/option không hợp lệ: không mutate và trả `MENU_ITEM_UNAVAILABLE` hoặc `OPTION_VALUE_UNAVAILABLE`; UI refetch menu và giữ draft để user sửa.

Output tối thiểu:

```ts
type SubmitOrderChangesResult = {
  orderId: string | null;
  status: "open" | "void";
  tableId: string | null;
  tableStatus: "empty" | "occupied" | null;
  orderNo: number;
  businessDate: string;
  lockVersion: number;
  ticket: PrintTicket | null;
};
```

### `pay_order(...)`

```sql
pay_order(
  p_payment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_method payment_method,
  p_expected_lock_version integer,
  p_received_amount integer
) returns jsonb
```

Behavior:

- Lock order row; chỉ nhận order `open` và `lock_version = p_expected_lock_version`.
- Tính `amount = order.total`.
- Nếu `p_received_amount < total`: lỗi, không tạo payment.
- Tạo `payments`, set order `paid`, `paid_at = now()`.
- Nếu dine-in có table: lock table row và set table `empty`.
- Tăng `orders.lock_version` khi pay thành công.
- Nếu version lệch: không mutate và trả `ORDER_VERSION_CONFLICT` để UI refetch.
- Paid order không void trong MVP.

Output tối thiểu:

```ts
type PayOrderResult = {
  orderId: string;
  paymentId: string;
  status: "paid";
  total: number;
  receivedAmount: number;
  changeAmount: number;
  lockVersion: number;
  receipt: PrintReceipt;
};
```

### `clear_demo_data(...)`

```sql
clear_demo_data(
  p_employee_id uuid
) returns jsonb
```

- Admin-only.
- Block nếu còn open orders; user phải thanh toán hoặc huỷ order trước.
- Tombstone đúng menu/floor/decor demo data được nhận diện bằng deterministic seed IDs theo `store_id + seed_key`.
- Deactive cashier demo và giữ lại đúng 1 admin.
- Không xoá dữ liệu user tự tạo. Destructive reset toàn store là chức năng riêng ngoài MVP.

### `void_order(...)`

```sql
void_order(
  p_order_id uuid,
  p_employee_id uuid
) returns jsonb
```

- Reserved/admin/future only.
- Không dùng để void paid order trong MVP.
- Normal cancel của order open đi qua `submit_order_changes` với toàn bộ item về `0`.

---

## 2. Port/interface contract

Quy ước:

- Core/UI dùng camelCase.
- Supabase adapter map snake_case DB row sang domain entity/DTO.
- Repo list/get mặc định chỉ trả active rows (`deleted_at is null`).
- Method đặc biệt mới include deleted rows.
- Adapter/service throw `AppError`; không leak raw Supabase errors.
- `ORDER_VERSION_CONFLICT` là `AppError` chuẩn cho stale order/payment; UI hiển thị toast/popup "Dữ liệu đã thay đổi, vui lòng tải lại".
- `MENU_ITEM_UNAVAILABLE`/`OPTION_VALUE_UNAVAILABLE` là `AppError` chuẩn khi submit draft dùng menu/option không còn hợp lệ; UI refetch menu và giữ draft.

Ports theo domain:

```ts
interface IAuthRepo {
  pairStore(storeKey: string): Promise<void>;
  createStore(input: CreateStoreInput): Promise<CreateStoreResult>;
  unpairStore(): Promise<void>;
  getStoreSession(): Promise<StoreSession | null>;
}

interface IEmployeeRepo {
  listActiveEmployees(): Promise<Employee[]>;
  verifyPin(employeeId: string, pin: string): Promise<Employee>;
  createEmployee(input: EmployeeInput): Promise<Employee>;
  updateEmployee(input: EmployeeUpdate): Promise<Employee>;
  resetPin(employeeId: string, newPin: string): Promise<void>;
}

interface IMenuRepo {
  getMenu(): Promise<MenuCatalog>;
  saveMenuChanges(changes: MenuChanges): Promise<void>;
}

interface IFloorPlanRepo {
  getFloorPlan(): Promise<FloorPlan>;
  saveFloorPlan(changes: FloorPlanChanges): Promise<void>;
}

interface IOrderRepo {
  listOpenOrders(): Promise<OrderSummary[]>;
  getOrder(orderId: string): Promise<OrderDetail>;
  submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult>;
  listTakeawayOpenOrders(): Promise<OrderSummary[]>;
  listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage>;
}

interface IPaymentRepo {
  payOrder(input: PayOrderInput): Promise<PayOrderResult>;
}

interface IReportRepo {
  getCoreReport(filter: ReportFilter): Promise<CoreReport>;
}

interface ISettingsRepo {
  getSettings(): Promise<StoreSettings>;
  updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings>;
  clearDemoData(employeeId: string): Promise<void>;
}

interface ISeedRepo {
  seedDemo(storeId: string): Promise<void>;
  retrySeedDemo(storeId: string): Promise<void>;
  seedBlank(storeId: string): Promise<void>;
}

interface IPrintPort {
  renderOrderTicket(ticket: PrintTicket): Promise<void>;
  renderReceipt(receipt: PrintReceipt): Promise<void>;
}

interface IRealtimePort {
  startStoreInvalidation(input: RealtimeInvalidationInput): () => void;
}
```

DTO contract tối thiểu:

```ts
type CreateStoreResult = {
  storeId: string;
  storeNo: number;
  storeKey: string;
  adminPin: string;
  seedStatus: "seeded" | "failed";
  canRetrySeed: boolean;
};

type StoreSession = {
  storeId: string;
  storeNo: number;
};

type RealtimeInvalidationInput = {
  storeId: string;
  invalidateMenu(): void;
  invalidateFloorPlan(): void;
  invalidateOpenOrders(): void;
  invalidateReport(): void;
};

type SubmitOrderChangesInput = {
  orderId: string | null;
  tableId: string | null;
  orderType: "dine_in" | "takeaway";
  employeeId: string;
  expectedVersion: number | null;
  items: SubmitOrderDraftItem[];
};

type PayOrderInput = {
  paymentId: string;
  orderId: string;
  employeeId: string;
  method: "cash" | "bank_transfer" | "qr" | "other";
  expectedVersion: number;
  receivedAmount: number;
};

type OrderSummary = {
  id: string;
  orderNo: number;
  status: "open" | "paid" | "void";
  total: number;
  lockVersion: number;
};

type OrderDetail = OrderSummary & {
  businessDate: string;
  tableId: string | null;
  orderType: "dine_in" | "takeaway";
  items: OrderItemSnapshot[];
};

type OrderItemSnapshot = {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  options: Array<{
    id: string;
    optionValueId: string;
    optionName: string;
    priceDelta: number;
  }>;
};

type Changeset<TCreate, TUpdate, TDelete> = {
  created: TCreate[];
  updated: TUpdate[];
  deleted: TDelete[];
};

type MenuChanges = {
  categories: Changeset<CategoryCreate, CategoryUpdate, TombstoneDelete>;
  menuItems: Changeset<MenuItemCreate, MenuItemUpdate, TombstoneDelete>;
  optionGroups: Changeset<OptionGroupCreate, OptionGroupUpdate, TombstoneDelete>;
  optionValues: Changeset<OptionValueCreate, OptionValueUpdate, TombstoneDelete>;
};

type FloorPlanChanges = {
  areas: Changeset<FloorAreaCreate, FloorAreaUpdate, TombstoneDelete>;
  tables: Changeset<TableCreate, TableLayoutUpdate, TombstoneDelete>; // update không chứa status
  decorItems: Changeset<DecorCreate, DecorUpdate, TombstoneDelete>;
};
```

---

## 3. Order/payment behavior

- Bấm bàn trống chỉ mở draft UI, không tạo DB.
- Bấm **In/Gửi đơn** mới gọi `submit_order_changes`, lưu DB, render/in phiếu tạm, quay về floor plan.
- Order open submit theo **replace order lines**; RPC snapshot giá/tên từ DB.
- Client gửi ids/quantity/note/options, không tự quyết giá cuối.
- Bàn có order open:
  - nếu có draft thay đổi → nút chính là **In/Gửi đơn**.
  - nếu không có draft thay đổi → nút chính là **Thanh toán**.
- Order open load vào UI kèm `lockVersion`; submit/pay truyền `expectedVersion`.
- Nếu RPC trả `ORDER_VERSION_CONFLICT`: UI báo dữ liệu đã thay đổi và refetch order/open orders.
- Nếu RPC trả `MENU_ITEM_UNAVAILABLE`/`OPTION_VALUE_UNAVAILABLE`: UI refetch menu và yêu cầu user sửa draft.
- Giảm toàn bộ item về `0` + **In/Gửi đơn** → order `void`, table `empty`.
- Takeaway có nút **Mang đi** và danh sách takeaway open.
- Payment cash:
  - nhập tiền khách đưa.
  - nếu nhỏ hơn total: toast/popup lỗi, không complete.
  - Complete thành công trước, sau đó render/in final bill.
- Paid order không void trong MVP.
- Money là integer VND.
- Item/options snapshot tên + giá.
- Daily `order_no` và report "hôm nay" dùng `store_settings.timezone`, default `Asia/Saigon`.
- Report MVP chỉ tính order `paid`, loại `void`, lọc ngày bằng `business_date`.

---

## 4. UI shell/layout

- UI mặc định tiếng Việt.
- Single URL, internal app state.
- App shell dùng left rail icon + label.
- Primary color: teal `#0F766E`; neutral modern surfaces and slate text.
- Landscape screens, including phone landscape, must expose all MVP modules/features; do not remove POS/report/editor functionality by device.
- The app body/shell is not the primary scroll surface. Drawer/module height is fixed to viewport; module header/action bar stays visible; each pane owns its own `overflow: auto`.
- All modules open as overlay drawer/workspace from left rail:
  - large desktop: `80-90vw`, max around `1440px`
  - medium/tablet: `90-96vw`
  - small width: `100vw`
- Drawer switching with dirty state must confirm internally; no browser history entry.
- POS floor là màn mặc định sau passcode.
- Passcode screen dùng chọn nhân viên + PIN.
- All module drawers use the same 3-zone mental model on landscape screens: left category/filter/navigation, center primary content, right detail/cart/payment summary/properties.
- Order drawer: vertical categories left, responsive menu grid center, cart/order summary right. Cart list scrolls independently; totals and primary action stay sticky at bottom.
- Admin menu/floor editor drawers: split-pane with independent pane scrolling; phone landscape keeps full functionality with compact density.
- Floor view/editor canvas uses pan/zoom internally, independent from page scroll.
- UI reference prototype: `docs/superpowers/ui-prototype/pos-cafe-ui-reference.html`; screenshot: `docs/superpowers/assets/pos-cafe-ui-overview.png`.
- Responsive shell prototype: `docs/superpowers/ui-prototype/pos-cafe-responsive-shell.html`; tablet/phone landscape screenshots: `docs/superpowers/assets/pos-cafe-ui-tablet-1024x600.png`, `docs/superpowers/assets/pos-cafe-ui-phone-844x390.png`, `docs/superpowers/assets/pos-cafe-ui-phone-740x360.png`.
- Permission guard:
  - Admin: menu/floor/employees/report/settings/clear demo + POS.
  - Cashier: floor/order/payment/order-history.
  - Kitchen role giữ enum/seam, chưa có màn MVP.
- Phone portrait: hướng dẫn xoay ngang, không cố render POS đầy đủ.
- PrintPort MVP render HTML/template preview cho phiếu tạm và final bill.

---

## 5. Seed contract

- `seed.demo`:
  - admin PIN `123456`
  - cashier PIN `111111`
  - menu demo medium kiểu cafe Việt: 4 categories, 22 món
  - option groups/values cho size, đá, đường, topping, thêm shot
  - 2 floor areas: `Tầng trệt` 8 bàn, `Lầu 1` 6 bàn
  - decor placeholder assets nếu chưa có ảnh thật
  - không seed order history
- Nếu seed lỗi sau create store: set `stores.seed_status = failed`, cho retry seed idempotent; không bắt tạo store lại.
- `seed.blank`:
  - đúng 1 admin
  - settings tối thiểu
- Decor assets nằm trong `src/assets/floor-decor`, map bằng `asset_key`.
- Menu item MVP không upload ảnh; dùng text/placeholder hoặc built-in `image_asset_key`, không thêm Supabase Storage.
- Seed demo dùng deterministic IDs và cột `seed_key` theo `store_id + seed_key` cho mọi row demo. Retry seed upsert/fill row thiếu theo `(store_id, seed_key)` và không tạo trùng category/menu/option/floor/table/decor.
- `CreateStoreResult.storeKey` chỉ dùng để hiển thị Store Key một lần sau create. Sau pairing/create, persisted session không chứa raw Store Key/secret.

---

## 6. Multi-agent split

Stream 1 — Foundation/schema/RPC/migrations:
- Chạy trước. SQL migrations cloud-direct: `001_schema_enums.sql`, `002_indexes_rls_triggers.sql`, `003_rpc_functions.sql`.

Stream 2 — Core types/services/ports:
- Chạy sau khi Stream 1 ổn. Entities, value types, `AppError`, ports, pure services.

Stream 3 — Supabase adapters:
- Implement repos, row/entity mapping, TanStack Query-friendly methods.

Stream 4 — Auth/session/store flow:
- Pair/create store, passcode, current employee memory-only, role guard.

Stream 5 — Menu + floor editors:
- Menu editor, floor plan editor, save flow, dirty state, PrintPort-independent.

Stream 6 — POS/order/payment/report/settings:
- Floor view, order draft/cart, submit changes, payment cash, reports, settings/clear demo.

Rule: Stream 1 chạy trước Stream 2; các stream UI/adapters chỉ chạy song song sau khi DB contract và core types ổn định.
