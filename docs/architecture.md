# Architecture

Cập nhật 2026-09-10 theo `main@3ada48c` đã push và nghiệm thu. Phạm vi/SHA/bằng chứng ở [phase 27](implementation-log/phase-27-idempotent-write-operations.md); chưa triển khai migration lên môi trường thật.

## Hexagonal Architecture / Ports & Adapters

Dự án áp dụng kiến trúc Ports & Adapters, lấy cảm hứng từ Hexagonal Architecture. Điểm chính là UI và feature flow không phụ thuộc trực tiếp vào Supabase, browser print hay realtime SDK; các phần hạ tầng này được bọc sau `AppPorts`.

Trong dự án này:

- **Inside:** domain types, core guards, money/order helpers và feature flows.
- **Ports:** interface như `IWriteOperationRepo`, `IOrderRepo`, `IPaymentRepo`, `IPrintPort`, `IRealtimePort`.
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
| Ports | Interface dữ liệu và side-effect: auth, employee, menu, menu images, floor, order, payment, report, settings, seed, print, realtime |
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
- Logged-in shell dùng `LeftNav` left rail và drawer state: `order`, `payment`, `takeaway`, `menuEditor`, `floorEditor`, `report`, `orderHistory`, `employees`, `settings`, `paymentSettings`, `writeRecovery`. Mỗi key map tới đúng một drawer qua `DRAWER_REGISTRY` (Record có type ràng buộc) trong `AppShell`. `KitchenQueueDrawer` là future scaffold, không đăng ký trong registry hiện tại.
- Zustand giữ UI state như current employee, active area/category, drawer context, payment order id và draft items.

## Server State

- TanStack Query quản lý menu, floor plan, open orders, order detail, history, report, settings.
- Mutation invalidates/refetches query liên quan thay vì patch cache thủ công.
- Loading/error/empty states được xử lý ở drawer/screen.

## Floor Asset Catalog

- Decor và nền bàn là static asset đóng gói trong `public/floor-assets`, không dùng Storage bucket hoặc upload runtime.
- `floorDecorAssets` quản lý 9 texture tường + 131 ảnh decor; `floorTableBackgroundAssets` quản lý 11 ảnh nền bàn và option trắng mặc định.
- Database chỉ lưu public path: `floor_decor_items.asset_key` bắt buộc, còn `tables.background_asset_key` nullable (`null` = trắng). Floor Editor và POS dùng cùng resolver để tránh lệch cách render.
- Chọn nullable path thay vì thêm enum/color column vì catalog có thể đổi mà không cần sửa type/database constraint. Upload/custom asset không được chọn trong phase này để tránh mở thêm storage lifecycle, validation và quyền ghi.
- Ảnh nền chỉ là presentation; `tables.status`, shape, geometry và seats giữ contract cũ. Border trạng thái được render độc lập để ảnh nền không làm mất tín hiệu bàn trống/đang phục vụ.

## RPC & Transaction Boundary

Bốn nghiệp vụ tạo/sửa đơn, thu tiền toàn bộ, tách rồi thu tiền và hủy đơn đã thanh toán đi qua giao thức v1. UI gọi port `write`; adapter gọi `register_write_operation` rồi `execute_write_operation`. Register chỉ giữ K/payload, không tạo đơn hay payment. Execute giữ nghiệp vụ, audit và trạng thái terminal/R1 trong một transaction. Hai RPC vẫn là hai transaction riêng; pending đã đăng ký có thể được tiếp tục bằng phiên có quyền khác.

Nguồn: `src/adapters/supabase/writeOperationRepo.ts:31`, `supabase/migrations/016_activate_write_protocol.sql:12` và `:35`. Migration 016 thu hồi mọi overload RPC ghi cũ và DML tài chính (`:258`); các phương thức adapter cũ còn trong mã để tương thích test cũ, không phải đường fallback của UI v1.

### Transaction, khóa và kết quả bất biến

| Cơ chế | Quy tắc và tác dụng |
| --- | --- |
| Khóa store → K → business rows | Serialize ghi POS trong cùng cửa hàng; thứ tự nhất quán giảm nguy cơ deadlock. Cả void paid cũng đi qua coordinator. |
| Row locks và OCC | Sau khi đợi khóa, đối chiếu expectedVersion không null với trạng thái thực; snapshot cũ bị từ chối. |
| Catalog trước statement | Giữ giá/cấu hình ổn định trong thời gian validate và ghi; kiểm quyền, phiên và hạn K lần cuối sau các lần đợi. |
| Transaction và subtransaction | Lỗi nghiệp vụ đã biết rollback toàn bộ business rồi lưu rejected; lỗi hạ tầng rollback cả transaction, K vẫn pending. |
| K/payload/R1 | Cùng K khác payload bị từ chối. Replay terminal trả kết quả cũ, chỉ tăng replay count với execute được phép, không thêm hiệu ứng hoặc audit nghiệp vụ. |

Nguồn: `015_write_business_helpers.sql:66`, `016_activate_write_protocol.sql:35`–`:113`. Pending hết hiệu lực sau 24 giờ kể từ đăng ký đầu tiên; terminal không bị dọn trong release này. Hạn K không phải hạn đơn. Tra cứu R1 và đọc đơn hiện tại là hai việc riêng vì đơn có thể đã được thao tác tiếp.

Serialize ở phạm vi store là đánh đổi để dễ chứng minh tính đúng cho quán nhỏ. Chưa đo thời gian giữ khóa hoặc tải sản xuất; không khẳng định không ảnh hưởng tốc độ. Nếu cần tối ưu phải đo rồi mới thu hẹp khóa, giữ nguyên oracle race/OCC/atomicity.

UI giữ bản xác nhận trong bộ nhớ, timeout 15 giây chuyển thành kết quả chưa rõ; không có outbox, không tự gửi khi mạng trở lại. Thử lại giữ nguyên K, kind, version, ID và số lượng ban đầu. Nguồn: `src/features/pos/writeOperationFlow.ts:25`, `:84`.

### ADR: Instant Pay — TÁCH ĐƠN ĐỘC LẬP (split-order)

**Quyết định (phase 18, bản chốt):** thanh toán một phần = tách các món được chọn ra một **đơn mới hoàn toàn độc lập** (UUID client cấp) và thanh toán đơn đó ngay trong cùng transaction. Hai đơn tiếp tục độc lập về nghiệp vụ và cùng nhãn bàn; phase 27 bổ sung liên kết nguồn/kết quả trong ledger và audit để tra cứu đúng thao tác, không tạo quan hệ phụ thuộc thanh toán. Đơn gốc còn lại trên bàn là đơn `open` bình thường.

**Lịch sử quyết định:** bản đầu của phase 18 làm theo mô hình "partial payment trên cùng một đơn" (nhiều payments/đơn, `order_items.payment_id`, view `history_entries` — migration 009). Người dùng **không chấp nhận các đánh đổi** của mô hình đó — report lệch két trong ngày, phải ẩn/đóng băng món đã trả, lịch sử phải chế khái niệm "Lần x/y" — nên rework sang split-order (migration 010 dọn toàn bộ 009).

**Lý do chọn split-order:** (1) **report đúng két ngay** — mỗi lần thu là một đơn `paid` nên doanh thu vào report tức thì, không có trạng thái "tiền đã thu nhưng chưa ghi nhận"; (2) **không có trạng thái đặc biệt** — không món đóng băng, không ẩn UI, đơn gốc sửa/void như mọi đơn; (3) **lịch sử giữ nguyên order-centric** — mỗi bill một dòng đơn bình thường; (4) đổi lại chấp nhận từ bỏ "1 phiên bàn = 1 đơn tổng" — điều người dùng chủ động muốn ("hai đơn không liên quan gì nhau").

**Quy tắc đánh số (yêu cầu cứng, có test):** bill thanh toán TRƯỚC mang `order_no` NHỎ hơn. Cơ chế: đơn tách **kế thừa** `order_no` của đơn gốc; đơn gốc nhận `order_no` mới (max+1 theo `business_date`). Ví dụ bàn #12 trả 2 lần → bill #12 (lần 1), phần còn lại trên bàn thành #13, bill #13 (lần 2). Hệ quả chấp nhận: phiếu bếp in trước đó mang số cũ trong khi đơn trên bàn đã đổi số.

**Đánh đổi còn lại:** muốn biết cả phiên bàn tiêu bao nhiêu phải cộng nhiều đơn; mỗi lần tách tốn một `order_no`; hoàn tiền theo payment vẫn ngoài scope phase này; chỉ trả theo món (không trả theo số tiền tuỳ ý).

## Realtime

- Supabase Realtime chỉ dùng làm tín hiệu invalidation/refetch.
- App không merge payload realtime thủ công vào cache.
- Realtime nằm trong `IRealtimePort`/feature integration để giữ transport tập trung.
- **Transport là WebSocket:** `supabase-js` mở WebSocket tới Supabase Realtime (Phoenix channel); app chỉ dùng `client.channel(...)` + `postgres_changes` nên không có code WebSocket thủ công nào trong `src`. Reconnect, auth và lọc `store_id=eq.<id>` do SDK và Realtime server lo. Đánh đổi: app không kiểm soát backoff/heartbeat của socket — đây là một lý do vẫn giữ polling 5s làm lưới an toàn.
- **Quyết định (phase tiểu luận, online-only): KHÔNG optimistic update / KHÔNG patch cache.** Ưu tiên độ chính xác giữa các máy (server là nguồn sự thật) hơn là cảm giác "tức thì" trên máy đang thao tác. Optimistic guessing dễ gây lệch trạng thái đa thiết bị và phá đường đọc đơn nhất — vốn cũng là seam cho offline-first sau này (đổi nguồn đọc sang bản sao local + outbox mà không phải gỡ cache-patch). Đánh đổi chấp nhận: một nhịp refetch nền trên máy đang thao tác.
- **Phủ tín hiệu:** publication gồm `orders, payments, tables` + bảng menu/floor. `order_items` cố ý KHÔNG publish vì nghiệp vụ submit luôn bump `orders.lock_version` → một event trên `orders` đã đủ (tránh double-refetch). `orders/payments/tables` → invalidate open orders + floor + report; order detail (`["orders","detail",id]`) nằm dưới prefix `["orders"]` nên cũng được refetch theo.
- **Giới hạn hiện tại:** migration 008 đã publish `menu_item_option_groups`, nhưng `SupabaseRealtimePort` chưa subscribe bảng nối này. Thao tác chỉ gắn/bỏ một modifier group khỏi món sẽ không tự invalidate menu trên máy khác; cần refresh/reconnect. Các thay đổi category/item/group/value vẫn realtime như bình thường.
- **Tự lành khi rớt kết nối:** `channel.subscribe` lắng trạng thái; mỗi lần `SUBSCRIBED` (lần đầu và mỗi lần auto-reconnect resubscribe) sẽ resync toàn bộ (open orders + floor + report + menu) ngay, không chờ poll.
- **Mục tiêu hội tụ danh nghĩa:** floor plan / open orders / order detail còn poll `refetchInterval` 5s làm lưới an toàn. Đây là khoảng polling khi app online/active, **không phải SLA cứng ≤5s** vì browser throttling, request và mạng có thể làm trễ hơn; E2E cloud quan sát trong timeout rộng hơn.
- **Xung đột ghi:** optimistic locking bằng `lock_version`; ghi sau nhận `ORDER_VERSION_CONFLICT` → UI refetch lại sự thật và báo "đơn đã đổi trên thiết bị khác" (`uiError` → action `reloadOrder`).

## Permission

- Hai trục quyền độc lập trong `core/guards.ts`:
  - **Module** (`canAccessModule`/`requireModuleAccess`): thấy/mở được màn nào — theo role.
  - **Hành động** (`hasPermission`/`requirePermission`): được thực hiện thao tác nào. Mặc định suy từ role qua `defaultRolePermissions`, ghi đè per-employee bằng `Employee.permissionOverrides` (`grants`/`denies`). Quyền hiệu lực = (default ∪ grants) − denies.
- `admin`: toàn bộ POS/admin hiện hành. `cashier`: floor/order/payment/order history. `kitchen`: enum/schema/core seam tương lai, không phải role UI hiện hành.
- Catalog đang enforce thật gồm 5 quyền:

  | Permission | Admin mặc định | Cashier mặc định | Kitchen (future seam) | Consumer |
  | --- | --- | --- | --- | --- |
  | `order.create` | Có | Có | Không | Tạo đơn mới |
  | `order.update` | Có | Có | Không | Sửa đơn đang mở còn món |
  | `order.voidOpen` | Có | Có | Không | Đưa đơn đang mở về 0 món/hủy đơn |
  | `payment.take` | Có | Có | Không | Full payment và instant-pay split |
  | `order.voidPaid` | Có | Không | Không | Hủy đơn đã thanh toán từ Lịch sử |

- Employees Drawer cho admin chỉnh switch theo **quyền hiệu lực**. Save chỉ lưu diff so với default role; diff rỗng xóa override (`null`). Đổi role trong form reset quyền về default role mới; không cho tự khóa tài khoản đang đăng nhập hoặc hạ role/khóa admin active cuối.
- UI chỉ liệt kê/tạo/sửa role `admin` và `cashier`. Employee `kitchen` cũ bị lọc khỏi Employees Drawer và Passcode; nav/registry không có kitchen module.
- UI/flow kiểm quyền để hướng dẫn người dùng; server v1 xác minh employee token và quyền hiện hành. Client tự khai actor ID không thay thế token.
- `currentEmployee` là snapshot memory-only của cả role/quyền tại lúc đăng nhập. Admin đổi hồ sơ hiện hành thì thiết bị nhân viên cần khóa/đăng nhập lại để UI nhận đầy đủ snapshot mới; RPC đọc override live nên có thể từ chối mutation ngay sau khi thu hồi.
- RLS cô lập store theo `auth.uid()`. Employee session riêng có token 43 ký tự chỉ giữ trong bộ nhớ, hash tại DB và hiệu lực 12 giờ; lock/reset PIN thu hồi phiên. DML tài chính và nguồn quyền bị khóa; nhân viên chỉ ghi qua RPC được bảo vệ. SELECT tài chính vẫn cô lập theo store, chưa có phân quyền đọc đầy đủ theo nhân viên. Nguồn: `014_write_identity_and_ledger.sql:162`, `016_activate_write_protocol.sql:196`–`:277`.
- Default role → permission còn lặp ở TypeScript và SQL. Bộ contract đối chiếu grant/deny, quyền sau khi chờ khóa và chặn gọi trực tiếp để phát hiện lệch. Chống brute-force PIN và provisioning chủ thật là phần còn hoãn.

## Print

- `IPrintPort` gồm `renderOrderTicket` và `renderReceipt`, nhưng `BrowserPrintPort` hiện chủ ý no-op để giữ seam thiết bị.
- Preview phiếu/hóa đơn và browser print được xử lý ở lớp UI `ReceiptPreview`: popup in-app + iframe ẩn gọi `window.print()` cô lập nội dung.
- Không tích hợp native printer/ESC/POS trong phase tiểu luận.

## UI Overlay Primitives

- Popup/modal dùng `PortalPopup`; drawer dùng `PortalDrawer`; cả hai tự dùng `createPortal` nội bộ.
- `PortalPopup` overlay là full-screen để confirm/modal chặn tương tác toàn bộ app khi đang mở.
- Drawer mặc định dùng full-screen viewport (`inset-0`) và che `LeftNav`; workspace viewport 176px/68px vẫn là option của primitive nhưng các drawer production hiện không truyền option này. Overlay `rgba(0,0,0,0.2)`, click overlay gọi close handler và có slide-in animation theo placement.
- Exit animation chưa làm trong pass hiện tại; drawer unmount theo app state.

## Testing

- Vitest kiểm tra core, adapters, feature flows, UI components và demo hardening.
- Playwright smoke kiểm tra flow demo chính và khả năng mở module/drawer.
- Supabase smoke riêng dùng config `playwright.supabase.config.ts` khi cần kiểm tra cloud/realtime.
- `architectureBoundaries.test.ts` dùng TypeScript AST scanner để kiểm tra hướng import và ngăn Supabase/browser leak vào layer cấm.
- Baseline local ngày 2026-08-12 đạt 49 files/260 tests và mock smoke 34 pass/31 skipped/0 failed; bằng chứng cloud có ngày chạy riêng. Ma trận và gap đầy đủ ở [testing.md](testing.md).
