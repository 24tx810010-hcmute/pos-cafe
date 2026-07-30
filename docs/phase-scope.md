# Phase Scope

File này khóa phạm vi phase tiểu luận để tránh nhầm giữa tính năng bắt buộc, phần hoàn thiện tùy chọn và hướng mở rộng sau này.

## Phase Tiểu Luận Bắt Buộc

| Nhóm | Tính năng |
| --- | --- |
| Vào hệ thống | Landing, ghép Store Key, tạo store mới, seed dữ liệu mẫu, hiển thị Store Key/Admin PIN một lần, nhập PIN nhân viên |
| Quyền | Role hiện hành `admin`, `cashier`; quyền vào module tách khỏi quyền theo hành động; editor override per-employee (`grants`/`denies`); enforce `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid` ở flow/UI và RPC guardrail. `kitchen` chỉ là enum/schema seam tương lai, ẩn khỏi UI |
| POS core | Floor view, mở bàn, tạo/sửa order dine-in, tạo/sửa takeaway, trạng thái bàn trống/đang phục vụ |
| Order | Chọn món, option/topping, ghi chú, cập nhật order mở; hủy order mở bằng cách xóa hết item; người có quyền `order.voidPaid` hủy đơn đã thanh toán từ Lịch sử với lý do, ghi chú và audit |
| Payment | Thanh toán tiền mặt, nhập tiền khách đưa, tính tiền thối, hoàn tất order, set bàn trống, bill/receipt preview; instant pay: chọn món/số lượng tách thành đơn độc lập thanh toán ngay (bill trả trước mang số nhỏ hơn) |
| Admin | Quản lý nhân viên và quyền, menu editor có option/topping + upload ảnh món, floor editor có khu/tầng/bàn/decor, transform trực tiếp và catalog asset |
| Report | Doanh thu theo ngày, số đơn đã thanh toán, trung bình đơn, top món, biểu đồ giờ; số đơn và tổng tiền của đơn paid-rồi-hủy |
| Settings | Tên quán, địa chỉ, footer hóa đơn, timezone, clear dữ liệu mẫu có block khi còn order mở |
| Demo hardening | Loading/error/empty/blocked states cho flow quan trọng, smoke test cho demo |

## Scope Update 2026-06-22

- Upload ảnh món được đưa vào scope hiện tại cho Menu Editor và màn chọn món POS.
- Upload ảnh decor vẫn là mở rộng sau phase này.

## Scope Update 2026-06-23

- Menu Editor được polish thêm: ảnh card món dùng cover, món hết hàng có overlay `Đã bán hết`, selector danh mục chuyển sang select và sắp xếp món dùng switch swap vị trí.
- Giới hạn upload ảnh món theo bucket Supabase: JPG/PNG/WebP, tối đa 5MB.

## Scope Update 2026-07-16

- Hủy đơn đã thanh toán được đưa vào scope hiện tại: mặc định admin có quyền `order.voidPaid`; cashier chỉ thực hiện được khi có grant override và không bị deny.
- Đơn paid bị hủy giữ nguyên số tiền/payment để đối soát, ghi người hủy/thời điểm/lý do, bị loại khỏi doanh thu và được cộng vào `voidCount`/`voidAmount`.
- Phase 19 hoàn thành seam quyền theo hành động và consumer đầu tiên; phần editor/enforce rộng hơn được hoàn tất tiếp ở phase 20.

## Scope Update 2026-07-19

- Employees Drawer đã có editor checkbox theo quyền hiệu lực cho từng nhân viên; đổi role reset default, lưu diff grants/denies và chặn hạ role admin active cuối.
- 5 quyền runtime được enforce ở feature flow; Order/Payment UI có soft gate và migration 012 guardrail ba RPC `submit_order_changes`, `pay_order`, `pay_order_items`.
- Client nhận permission mới khi đăng nhập lại; server guardrail đọc override live. Migration 012 đã apply và Supabase E2E 5/5 pass ngày 2026-07-19.

## Scope Update 2026-07-22

- Decor built-in đầy đủ được đưa vào Floor Editor: 9 texture tường và 131 ảnh chia nhóm Cây/Ghế/Thiết bị/Khác.
- Admin chọn hoặc đổi mẫu trong popup; Floor Editor và POS Floor cùng render ảnh từ `asset_key` đã lưu. Không đổi schema/database migration.
- Đây là catalog đóng gói cùng ứng dụng, không phải upload ảnh decor của người dùng; upload/custom asset vẫn thuộc mở rộng sau phase.
- Sau audit code/docs, role/module kitchen được chốt là future-only: bỏ khỏi nav, drawer registry, màn PIN và form nhân viên; giữ enum/schema/component scaffold để phát triển sau.

## Scope Update 2026-07-25

- Employees Drawer được redesign thành layout hai pane: danh bạ/filter ở trái và hồ sơ/quyền/PIN ở phải.
- Bộ lọc hiện hành gồm Tất cả, Quản lý, Thu ngân và Tạm khoá, có count; chọn nhân viên đầu tiên tự động khi tải xong.
- Trạng thái đăng nhập, role, quyền và reset PIN được chỉnh trong cùng form; có dirty confirm khi đổi lựa chọn.
- Không cho tự tạm khóa tài khoản đang đăng nhập hoặc tạm khóa/hạ role quản lý active cuối. Không có migration mới.

## Scope Update 2026-07-27

- Floor Editor có thêm catalog 11 ảnh nền bàn built-in và lựa chọn nền trắng mặc định; bàn mới và dữ liệu cũ dùng trắng khi `background_asset_key` là `null`.
- Admin chọn/đổi nền từ inspector; lựa chọn persist qua changeset và hiển thị đồng nhất trên Floor Editor/POS. Status bàn tiếp tục dùng border xanh/cam.
- Migration 013 thêm `tables.background_asset_key`; đã được apply và xác minh PostgREST đọc được cột cùng full floor-plan select.
- Đây là catalog đóng gói, không phải upload nền bàn. Upload/custom table background tiếp tục nằm ngoài scope.

## Scope Update 2026-07-30

- Root docs được audit lại theo `main@b7b7262` và chuẩn hóa thành source material cho báo cáo.
- Order history filter, report master/detail và các catalog floor đã là **implemented**, không còn nằm trong nhóm “làm nếu kịp”.
- Bổ sung traceability yêu cầu, baseline kiểm thử, giới hạn và hướng phát triển; tách rõ bằng chứng local, cloud và deployment readiness.

## Phần Hoàn Thiện Tùy Chọn

- Exit animation khi đóng drawer/popup và visual polish bổ sung.
- Tìm kiếm/favorite/tối ưu asset cho Floor Editor.
- Code splitting/lazy-load để xử lý chunk-size warning.
- Bổ sung insight/report nâng cao ngoài các metric hiện có.
- Refresh screenshot/diagram artefact cho báo cáo ở nơi lưu binary riêng.

## Mở Rộng Sau Phase Này

| Hướng mở rộng | Lý do hoãn | Hướng triển khai dự kiến |
| --- | --- | --- |
| Gộp/chuyển bàn | Cần quy tắc merge order, conflict và audit mới | Thiết kế RPC transaction riêng và lịch sử thao tác |
| Kitchen queue/role bếp thật | Chưa có queue backend và item workflow | Persist ticket/item status, màn bếp và realtime riêng |
| QR/bank/e-wallet | Cần provider/callback/đối soát ngoài | Payment provider abstraction và transaction ledger |
| Discount/voucher/refund | Làm rộng pricing, permission và report | Bổ sung policy tính giá, audit và report adjustment |
| Upload decor/nền bàn | Cần storage lifecycle và quyền ghi | Tái dùng pattern upload ảnh món, thêm tối ưu asset |
| Offline-first/local database | Tăng lớn độ phức tạp sync/conflict | Thêm local adapter, outbox và conflict policy |
| Native printer/ESC/POS | Phụ thuộc driver/phần cứng | Service/adapter in cục bộ sau `IPrintPort` |
| Kho, loyalty, ca/chấm công | Ngoài core flow POS hiện tại | Mỗi nhóm cần domain và module độc lập |
| Super-admin/chuỗi chi nhánh | MVP hiện cô lập từng store, chưa có aggregate UI | Tenant hierarchy và quyền cấp tổ chức |
| Custom role/quyền mở rộng | Catalog runtime mới có 5 action | Role editor, module permission và audit log |

## Ghi Chú Quan Trọng

- Một số màn optional có thể đang tồn tại dưới dạng UI scaffold để chứng minh seam, nhưng không được tính là thiếu nếu chưa có logic thật trong phase tiểu luận.
- Schema có chừa field/enum cho mở rộng sau như `payment_method`, `discount_type`, `order_item_status`, nhưng UI phase này chỉ cần phần đã khóa ở mục bắt buộc.
- Khi bảo vệ, nên nói rõ: dự án ưu tiên vận hành cafe nhỏ, realtime online, dữ liệu quan hệ và demo end-to-end thay vì mở rộng quá rộng.
- Xem [requirements.md](requirements.md) cho yêu cầu có mã và [limitations.md](limitations.md) cho giới hạn/hướng phát triển đầy đủ.
