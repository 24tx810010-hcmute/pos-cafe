# Architecture

## Hexagonal Architecture / Ports & Adapters

Dự án áp dụng kiến trúc Ports & Adapters, lấy cảm hứng từ Hexagonal Architecture. Điểm chính là UI và feature flow không phụ thuộc trực tiếp vào Supabase, browser print hay realtime SDK; các phần hạ tầng này được bọc sau `AppPorts`.

Trong dự án này:

- **Inside:** domain types, core guards, money/order helpers và feature flows.
- **Ports:** interface như `IOrderRepo`, `IPaymentRepo`, `IPrintPort`, `IRealtimePort`.
- **Adapters:** Supabase adapter, mock adapter, browser print adapter và realtime adapter.
- **Driving side:** React screens/drawers gọi feature hooks/flows.
- **Driven side:** database/RPC, realtime, print preview và data seed.

Không nên trình bày đây là Hexagonal Architecture textbook 100%, vì dự án là frontend-heavy và một phần business consistency nằm trong PostgreSQL RPC. Cách nói chính xác hơn là: **dự án dùng Ports & Adapters theo hướng Hexagonal Architecture để tách nghiệp vụ khỏi hạ tầng**.

Kiến trúc hiện tại tách UI, feature flow, domain/ports và adapters để giữ app dễ test, dễ demo và có đường đổi backend/offline sau này.

## Lớp Chính

| Lớp | Vai trò |
| --- | --- |
| App UI | React screens, shell, drawers, portal popup/drawer primitives, local UI state |
| Features | Session/order/admin/realtime flows, query hooks, mutation hooks |
| Core/domain | Money, guards, order draft, AppError, domain types |
| Ports | Interface dữ liệu và side-effect: auth, employee, menu, floor, order, payment, report, settings, seed, print, realtime |
| Adapters | Supabase adapter và mock adapter implement ports |

## Folder Boundary Guard

- `src/architectureBoundaries.test.ts` dùng TypeScript AST import scanner để kiểm tra `import`, `export ... from` và dynamic `import(...)`.
- Production rules: `domain/core/ports` không phụ thuộc React/app/adapters; `features` không import `app/adapters`; `adapters` không import `app/features`; chỉ `src/app/runtimePorts.ts` compose concrete adapters.
- `src/ports` chỉ giữ interfaces/types; React ports context nằm ở `src/features/shared/portsContext.tsx`.
- `src/seed` là shared fixture layer, chỉ dùng bởi mock adapter và Supabase seed bundle.

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
- Phase này dùng browser HTML print preview qua browser print adapter, tách khỏi Supabase adapter.
- Không tích hợp native printer/ESC/POS trong phase tiểu luận.

## UI Overlay Primitives

- Popup/modal dùng `PortalPopup`; drawer dùng `PortalDrawer`; cả hai tự dùng `createPortal` nội bộ.
- Drawer mặc định có workspace viewport để không che left rail, overlay `rgba(0,0,0,0.2)`, click overlay gọi close handler và slide-in animation theo placement.
- Exit animation chưa làm trong pass hiện tại; drawer unmount theo app state.

## Testing

- Vitest kiểm tra core, adapters, feature flows, UI components và demo hardening.
- Playwright smoke kiểm tra flow demo chính và khả năng mở module/drawer.
- Supabase smoke riêng dùng config `playwright.supabase.config.ts` khi cần kiểm tra cloud/realtime.
