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
- Logged-in shell dùng `LeftNav` left rail và drawer state: `order`, `payment`, `takeaway`, `menuEditor`, `floorEditor`, `report`, `orderHistory`, `employees`, `settings`, `kitchen`, `paymentSettings`. Mỗi key map tới đúng một drawer qua `DRAWER_REGISTRY` (Record có type ràng buộc) trong `AppShell`.
- Zustand giữ UI state như current employee, active area/category, drawer context, payment order id và draft items.

## Server State

- TanStack Query quản lý menu, floor plan, open orders, order detail, history, report, settings.
- Mutation invalidates/refetches query liên quan thay vì patch cache thủ công.
- Loading/error/empty states được xử lý ở drawer/screen.

## RPC & Transaction Boundary

- Business-critical mutations đi qua RPC để DB quyết định transaction:
  - `submit_order_changes`
  - `pay_order`
  - `pay_order_items` (instant pay: TÁCH các món được chọn ra một đơn mới độc lập và thanh toán đơn đó ngay trong cùng transaction)
  - `clear_demo_data`
- RPC đảm bảo lock/version, order number, snapshot giá/tên/options, status order/table và payment consistency. Mỗi lần tách đơn cũng bump `lock_version` của đơn gốc nên các máy khác nhận tín hiệu như mọi mutation khác.

### ADR: Instant Pay — TÁCH ĐƠN ĐỘC LẬP (split-order)

**Quyết định (phase 18, bản chốt):** thanh toán một phần = tách các món được chọn ra một **đơn mới hoàn toàn độc lập** (UUID client cấp) và thanh toán đơn đó ngay trong cùng transaction. Hai đơn không có liên kết dữ liệu nào — chỉ tình cờ chung `table_id` lúc thanh toán. Đơn gốc còn lại trên bàn là đơn `open` bình thường.

**Lịch sử quyết định:** bản đầu của phase 18 làm theo mô hình "partial payment trên cùng một đơn" (nhiều payments/đơn, `order_items.payment_id`, view `history_entries` — migration 009). Người dùng **không chấp nhận các đánh đổi** của mô hình đó — report lệch két trong ngày, phải ẩn/đóng băng món đã trả, lịch sử phải chế khái niệm "Lần x/y" — nên rework sang split-order (migration 010 dọn toàn bộ 009).

**Lý do chọn split-order:** (1) **report đúng két ngay** — mỗi lần thu là một đơn `paid` nên doanh thu vào report tức thì, không có trạng thái "tiền đã thu nhưng chưa ghi nhận"; (2) **không có trạng thái đặc biệt** — không món đóng băng, không ẩn UI, đơn gốc sửa/void như mọi đơn; (3) **lịch sử giữ nguyên order-centric** — mỗi bill một dòng đơn bình thường; (4) đổi lại chấp nhận từ bỏ "1 phiên bàn = 1 đơn tổng" — điều người dùng chủ động muốn ("hai đơn không liên quan gì nhau").

**Quy tắc đánh số (yêu cầu cứng, có test):** bill thanh toán TRƯỚC mang `order_no` NHỎ hơn. Cơ chế: đơn tách **kế thừa** `order_no` của đơn gốc; đơn gốc nhận `order_no` mới (max+1 theo `business_date`). Ví dụ bàn #12 trả 2 lần → bill #12 (lần 1), phần còn lại trên bàn thành #13, bill #13 (lần 2). Hệ quả chấp nhận: phiếu bếp in trước đó mang số cũ trong khi đơn trên bàn đã đổi số.

**Đánh đổi còn lại:** muốn biết cả phiên bàn tiêu bao nhiêu phải cộng nhiều đơn; mỗi lần tách tốn một `order_no`; hoàn tiền theo payment vẫn ngoài scope phase này; chỉ trả theo món (không trả theo số tiền tuỳ ý).

## Realtime

- Supabase Realtime chỉ dùng làm tín hiệu invalidation/refetch.
- App không merge payload realtime thủ công vào cache.
- Realtime nằm trong `IRealtimePort`/feature integration để giữ transport tập trung.
- **Quyết định (phase tiểu luận, online-only): KHÔNG optimistic update / KHÔNG patch cache.** Ưu tiên độ chính xác giữa các máy (server là nguồn sự thật) hơn là cảm giác "tức thì" trên máy đang thao tác. Optimistic guessing dễ gây lệch trạng thái đa thiết bị và phá đường đọc đơn nhất — vốn cũng là seam cho offline-first sau này (đổi nguồn đọc sang bản sao local + outbox mà không phải gỡ cache-patch). Đánh đổi chấp nhận: một nhịp refetch nền trên máy đang thao tác.
- **Phủ tín hiệu:** publication gồm `orders, payments, tables` + bảng menu/floor. `order_items` cố ý KHÔNG publish vì `submit_order_changes` luôn bump `orders.lock_version` → một event trên `orders` đã đủ (tránh double-refetch). `orders/payments/tables` → invalidate open orders + floor + report; order detail (`["orders","detail",id]`) nằm dưới prefix `["orders"]` nên cũng được refetch theo.
- **Tự lành khi rớt kết nối:** `channel.subscribe` lắng trạng thái; mỗi lần `SUBSCRIBED` (lần đầu và mỗi lần auto-reconnect resubscribe) sẽ resync toàn bộ (open orders + floor + report + menu) ngay, không chờ poll.
- **SLA hội tụ:** floor plan / open orders / order detail còn poll `refetchInterval` 5s làm lưới an toàn — cam kết mọi máy đồng bộ trong **≤5s** kể cả khi realtime gián đoạn.
- **Xung đột ghi:** optimistic locking bằng `lock_version`; ghi sau nhận `ORDER_VERSION_CONFLICT` → UI refetch lại sự thật và báo "đơn đã đổi trên thiết bị khác" (`uiError` → action `reloadOrder`).

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
- `PortalPopup` overlay là full-screen để confirm/modal chặn tương tác toàn bộ app khi đang mở.
- Drawer mặc định có workspace viewport sau `LeftNav` để không che left rail: desktop offset 176px, compact offset 68px, overlay `rgba(0,0,0,0.2)`, click overlay gọi close handler và slide-in animation theo placement.
- Exit animation chưa làm trong pass hiện tại; drawer unmount theo app state.

## Testing

- Vitest kiểm tra core, adapters, feature flows, UI components và demo hardening.
- Playwright smoke kiểm tra flow demo chính và khả năng mở module/drawer.
- Supabase smoke riêng dùng config `playwright.supabase.config.ts` khi cần kiểm tra cloud/realtime.
