# Architecture

Kiến trúc hiện tại tách UI, feature flow, domain/ports và adapters để giữ app dễ test, dễ demo và có đường đổi backend/offline sau này.

## Lớp Chính

| Lớp | Vai trò |
| --- | --- |
| App UI | React screens, shell, drawers, local UI state |
| Features | Session/order/admin/realtime flows, query hooks, mutation hooks |
| Core/domain | Money, guards, order draft, AppError, domain types |
| Ports | Interface dữ liệu và side-effect: auth, employee, menu, floor, order, payment, report, settings, seed, print, realtime |
| Adapters | Supabase adapter và mock adapter implement ports |

## Data Flow Tổng Quát

```text
React screen/drawer
  -> feature hook/flow
  -> AppPorts interface
  -> Supabase adapter hoặc mock adapter
  -> RPC/table query
  -> domain DTO trả về UI
```

UI không gọi Supabase trực tiếp. Nếu cần đổi backend hoặc thêm offline adapter, phần cần thay là adapter/port boundary, không phải toàn bộ UI.

## Navigation & State

- App dùng một URL.
- Pre-login screen state: `landing`, `storePairing`, `createStore`, `passcode`.
- Logged-in shell dùng left rail và drawer state: `order`, `payment`, `takeaway`, `menuEditor`, `floorEditor`, `reportSettings`, `orderHistory`, `employees`, `settings`, `kitchen`, `paymentSettings`.
- Zustand giữ UI state như current employee, active area/category, drawer context, payment order id và draft items.

## Server State

- TanStack Query quản lý menu, floor plan, open orders, order detail, history, report, settings.
- Mutation invalidates/refetches query liên quan thay vì patch cache thủ công.
- Loading/error/empty states được xử lý ở drawer/screen.

## RPC & Transaction Boundary

- Business-critical mutations đi qua RPC để DB quyết định transaction:
  - `submit_order_changes`
  - `pay_order`
  - `clear_demo_data`
- RPC đảm bảo lock/version, order number, snapshot giá/tên/options, status order/table và payment consistency.

## Realtime

- Supabase Realtime chỉ dùng làm tín hiệu invalidation/refetch.
- App không merge payload realtime thủ công vào cache.
- Realtime nằm trong `IRealtimePort`/feature integration để giữ transport tập trung.

## Permission

- `canAccessModule` phân quyền app-layer theo role.
- `admin`: toàn bộ POS/admin.
- `cashier`: floor/order/payment/order history.
- `kitchen`: kitchen seam.
- Các action admin gọi feature flow có guard, không chỉ dựa vào disabled button.

## Print

- `IPrintPort` gồm `renderOrderTicket` và `renderReceipt`.
- Phase này dùng browser HTML print preview.
- Không tích hợp native printer/ESC/POS trong phase tiểu luận.

## Testing

- Vitest kiểm tra core, adapters, feature flows, UI components và demo hardening.
- Playwright smoke kiểm tra flow demo chính và khả năng mở module/drawer.
- Supabase smoke riêng dùng config `playwright.supabase.config.ts` khi cần kiểm tra cloud/realtime.
