# UI ↔ Logic Binding Guide — POS Cafe

> Ngày chốt: 2026-06-11
> Vai trò: hướng dẫn nối UI thật với core/ports/adapters sau giai đoạn UI mock.
> Không phải spec cho UI mock-only agent; UI mock package vẫn nằm ở `docs/superpowers/ui-screens/`.
> Trạng thái 2026-06-13: branch `codex/ui-logic-integration` đã có UI checkpoint + logic adapters merge sẵn; dùng file này cho phase bind UI thật và Supabase-mode E2E.

## 1. Preflight cho agent implement

- Bạn nhận file này như tài liệu binding UI thật với logic. Không sửa nhánh `docs` trừ khi chủ dự án yêu cầu.
- Khi implement code, làm ở code worktree `D:\Workspace\pos-cafe-code`.
- Trước khi làm, chạy `git status --short --branch`.
- Nhánh đúng mặc định là branch code hiện tại được user chỉ định, thường tách từ `codex/code-foundation` hoặc branch đã chứa DB/RPC foundation.
- Nếu sai nhánh và worktree sạch, switch về nhánh đúng giúp user. Nếu có thay đổi chưa commit, dừng và báo user; không discard.
- Không commit/push nếu user chưa yêu cầu rõ.

## 2. Boundary bắt buộc

Luồng code chuẩn:

```txt
UI component
  -> feature hook/service
  -> usePorts() / AppPorts
  -> adapter implementation
  -> Supabase table/RPC
```

Quy tắc:

- UI/component không import `@supabase/supabase-js`, không gọi `supabase.rpc(...)`, không biết tên bảng DB.
- Core/domain không import Supabase types.
- Adapter map snake_case DB/RPC result sang camelCase domain DTO.
- Adapter/service throw `AppError`; UI chỉ xử lý `AppError.code` + fallback unknown error.
- Runtime app nhận `AppPorts` qua `PortsContext`; dev/mock mode dùng `createMockPorts`, real mode dùng Supabase adapter factory.
- Không đổi public domain/port contract nếu không có bug contract rõ.

## 3. State ownership

Server state dùng TanStack Query:

- employees active
- store session/settings
- menu catalog
- floor plan
- open orders
- order detail
- takeaway open orders
- order history
- report

UI/session/draft state dùng Zustand:

- current employee memory-only
- active area/category/filter
- drawer/dialog đang mở
- order draft items
- payment input tạm
- editor dirty/local draft state

Không persist:

- raw Store Key/secret
- current employee/PIN
- order draft đang sửa

Được persist bởi Supabase Auth:

- store account session sau pairing/create.

## 4. Screen-to-port map

| Screen/module | Server data/query | Mutation/action | State notes |
|---|---|---|---|
| Landing | `auth.getStoreSession()` | none | Nếu có session -> passcode; nếu không -> pairing/create. |
| Store pairing | none hoặc session sau sign-in | `auth.pairStore(storeKey)` | Parse Store Key ở Auth adapter, không lưu raw key sau success. |
| Create store | `auth.createStore(input)` result | `auth.createStore`, `seed.seedDemo` nội bộ adapter/flow | `CreateStoreResult.storeKey` chỉ hiển thị một lần. |
| Passcode | `employee.listActiveEmployees()` | `employee.verifyPin(employeeId, pin)` | Set `currentEmployee` memory-only; refresh quay lại passcode. |
| App shell/left rail | `settings.getSettings()` nếu cần tên quán | none | Permission hiển thị module qua Core guard. |
| POS floor view | `floorPlan.getFloorPlan()`, `order.listOpenOrders()` | open drawer internal state | Bấm bàn trống chỉ mở draft, chưa tạo DB. |
| Order drawer | `menu.getMenu()`, optional `order.getOrder(orderId)` | `order.submitOrderChanges(input)`, `print.renderOrderTicket(ticket)` | Adapter sinh UUID client cho order/item/option mới trước RPC. |
| Payment drawer | `order.getOrder(orderId)` | `payment.payOrder(input)`, `print.renderReceipt(receipt)` | UI block received < total trước; RPC vẫn là nguồn kiểm tra cuối. |
| Takeaway orders | `order.listTakeawayOpenOrders()` | open order/payment drawer | Takeaway `tableId = null`. |
| Order history | `order.listOrderHistory(filter)` | none | Query phân trang/filter, không load full history ở initial app. |
| Employees drawer | `employee.listActiveEmployees()` | `employee.createEmployee`, `employee.updateEmployee`, `employee.resetPin` | PIN không đọc hash; role guard ở UI/Core. |
| Menu editor drawer | `menu.getMenu()` | `menu.saveMenuChanges(changes)` | Save changeset created/updated/deleted; deleted = tombstone. |
| Floor editor drawer | `floorPlan.getFloorPlan()` | `floorPlan.saveFloorPlan(changes)` | Save layout/decor only, không ghi đè `tables.status`. |
| Report drawer | `report.getCoreReport(filter)` | none | Chỉ tính paid orders, loại open/void. |
| General settings drawer | `settings.getSettings()` | `settings.updateSettings(input)` | Dirty confirm nội bộ khi đóng/chuyển module. |
| Clear demo dialog | optional open-orders check từ query hiện có | `settings.clearDemoData(employeeId)` | Admin-only UI guard; RPC vẫn check và block open orders. |
| Kitchen queue optional | future `order_items.status` seam | none trong MVP | Không implement logic thật nếu user chưa yêu cầu. |
| Payment settings optional | `settings.getSettings()` hoặc future port | none trong MVP | QR/bank config là mở rộng sau. |

## 5. Query invalidation

Realtime chỉ gom ở `IRealtimePort`/`useRealtime`:

- `orders`, `payments`, `tables` event -> invalidate open orders, floor plan/table status, report, relevant order detail.
- `categories`, `menu_items`, `option_groups`, `option_values` event -> invalidate menu.
- `floor_areas`, `tables`, `floor_decor_items` event -> invalidate floor plan.
- Không patch cache thủ công từ realtime payload trong MVP; chỉ refetch.

Sau mutation thành công:

- Submit order -> invalidate open orders, order detail, floor plan, report; nếu có ticket thì gọi print preview.
- Pay order -> invalidate open orders, order detail, floor plan, report, history; nếu có receipt thì gọi print preview.
- Save menu -> invalidate menu.
- Save floor -> invalidate floor plan.
- Clear demo -> invalidate menu, floor plan, employees, open orders, report.

## 6. Error mapping UI bắt buộc

| AppError code | UI behavior |
|---|---|
| `AUTH_REQUIRED` | Đưa về pairing/passcode phù hợp, báo phiên đã hết hạn. |
| `FORBIDDEN` | Toast/dialog không đủ quyền, không retry tự động. |
| `INVALID_PIN` | Xóa PIN input, giữ selected employee, báo PIN không đúng. |
| `ORDER_VERSION_CONFLICT` | Toast "Dữ liệu đã thay đổi, vui lòng tải lại", refetch order/open orders/floor. |
| `MENU_ITEM_UNAVAILABLE` | Refetch menu, giữ draft, đánh dấu draft cần user sửa. |
| `OPTION_VALUE_UNAVAILABLE` | Refetch menu, giữ draft, đánh dấu option không còn hợp lệ. |
| `PAYMENT_AMOUNT_TOO_LOW` | Giữ payment drawer mở, focus received amount, không render receipt. |
| `OPEN_ORDERS_BLOCK_CLEAR_DEMO` | Giữ dialog mở hoặc đóng với toast rõ: cần thanh toán/hủy order đang mở trước. |
| `TABLE_NOT_FOUND` | Refetch floor/open orders, đóng draft nếu bàn bị tombstone. |
| `INVALID_ORDER_ID`/`INVALID_PAYMENT_ID`/`INVALID_ORDER_ITEMS` | Log dev detail, toast lỗi thao tác, giữ UI không mutate thêm. |
| `NOT_FOUND` | Refetch list liên quan, đóng detail nếu record không còn tồn tại. |
| `UNKNOWN` | Toast lỗi chung, không swallow silently. |

Adapter phải map raw Supabase/RPC message chuẩn sang các code trên. UI không parse raw SQL error string trực tiếp.

## 7. Store Key/create-store binding

- Store Key format MVP: `STORE_NO-SECRET`, ví dụ `0001-X8F3QA`.
- `STORE_NO` là định danh public để tạo email ẩn; `SECRET` là credential.
- Pairing adapter:
  - parse key;
  - build email `store<store_no>@store.pos.local`;
  - call Supabase `signInWithPassword`;
  - load `stores` để trả `StoreSession { storeId, storeNo }`;
  - không lưu raw Store Key trong Zustand/domain/session DTO.
- Create-store adapter/flow:
  - call RPC `get_next_store_no`;
  - sinh secret;
  - signUp store account ẩn;
  - insert `stores`/`store_settings`;
  - tạo admin + seed demo;
  - nếu seed lỗi, set `stores.seed_status = failed` và expose retry;
  - return `CreateStoreResult.storeKey` để UI hiển thị một lần.

## 8. Acceptance criteria

- `rg "@supabase|supabase\\.rpc|from\\(" src/app src/features src/components` không phát hiện Supabase access trong UI/component layer sau khi tách feature.
- UI modules gọi hooks/services hoặc `usePorts()`, không gọi adapter cụ thể.
- `StoreSession` không có `storeKey`; current employee không persist qua refresh.
- TanStack Query giữ server state; Zustand giữ drawer/session/draft state.
- Conflict/unavailable/payment/clear-demo errors có UI state rõ, không làm mất draft.
- Single URL/internal state giữ nguyên; mở/đóng drawer/dialog không tạo browser history.
- Responsive behavior vẫn theo specs UI: desktop/tablet/phone landscape đủ thao tác chính; phone portrait hiện hướng dẫn xoay ngang cho POS/admin surface.

## 9. Thứ tự implement khuyến nghị

1. Implement Supabase adapter factory + shared error mapper.
2. Implement Auth/Employee/Seed adapters để chạy pairing/create/passcode.
3. Implement Menu/Floor/Order/Payment/Report/Settings adapters.
4. Tạo feature hooks dùng TanStack Query + `usePorts()`.
5. Bind UI thật từng module theo screen-to-port map.
6. Bật realtime invalidation tập trung.
7. Chạy `npm run build`, `npm run test`; chỉ chạy `npm run smoke` khi chạm UI.
