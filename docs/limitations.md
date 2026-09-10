# Limitations & Future Work

Cập nhật 2026-09-10 theo `main@3ada48c` đã push và nghiệm thu. Phạm vi/SHA/bằng chứng ở [phase 27](implementation-log/phase-27-idempotent-write-operations.md); chưa triển khai migration lên môi trường thật.

## Bảo Mật Và Phân Quyền

- Phase 27 bổ sung phiên nhân viên được server xác minh và khóa đường ghi tài chính/nguồn quyền trực tiếp. Không còn mô tả spoof employee ID là đường ghi được phép sau activation v1. Nguồn: `014_write_identity_and_ledger.sql:162`, `016_activate_write_protocol.sql:258`.
- Store Auth/RLS vẫn là phạm vi cô lập dữ liệu đọc; chưa xây đầy đủ quyền SELECT theo từng nhân viên, chủ sở hữu thật hoặc chống brute-force PIN.
- UI giữ snapshot role/quyền tại đăng nhập; server kiểm quyền mới khi ghi, còn giao diện phản ánh đầy đủ sau khóa/đăng nhập lại.
- Token chỉ giữ memory nên mất local cần nhập PIN lại. Đơn và K đã đăng ký khôi phục từ server; nháp chưa đăng ký có thể mất.

**Hướng phát triển:** provisioning chủ thật, giới hạn thử PIN, audit quản trị quyền và policy đọc theo scope được duyệt.

## Online Và Realtime

- Ứng dụng là online-only; mất kết nối thì không có local queue/database để tiếp tục bán hàng.
- Realtime dùng event làm tín hiệu invalidate/refetch và có polling hồi phục; khoảng polling 5 giây không phải SLA cứng.
- `SupabaseRealtimePort` chưa subscribe `menu_item_option_groups`. Thao tác chỉ gắn/bỏ modifier group khỏi món có thể cần refresh/reconnect trên máy khác.
- Self-heal khi reconnect có unit test, nhưng cần diễn tập cloud hai thiết bị định kỳ để xác nhận hành vi thực tế.

**Hướng phát triển:** bổ sung subscription bảng nối, telemetry độ trễ, trạng thái kết nối hiển thị có ý nghĩa và adapter local-first nếu scope cho phép.

## Thanh Toán Và Đối Soát

- Payment thật chỉ hỗ trợ tiền mặt. Thẻ, chuyển khoản và QR chỉ là seam/preview, không có processing hoặc callback đối soát.
- `store_settings.qr_info` chưa được Payment Settings persist qua `settingsRepo`.
- Instant pay giữ hai đơn độc lập; ledger/audit v1 lưu ID nguồn/kết quả của lần tách nhưng chưa có màn tổng hợp cả phiên bàn.
- “Một payment cho mỗi order paid” là invariant của transaction v1 với DML client bị thu hồi; schema chưa thêm unique constraint trên `payments.order_id`.
- Chưa có refund, discount/voucher, price override, mở két, ca làm việc hoặc kiểm két.

**Hướng phát triển:** provider abstraction cho thanh toán điện tử, transaction/refund ledger, constraint hoặc invariant DB phù hợp và liên kết bill tách nếu nghiệp vụ cần truy vết.

## Giá Và Ghi Nhận Doanh Thu

Phase 27 thay replace-submit bằng retained/new. Phần đã lưu giữ source ID, giá và options; giảm số lượng/sửa note không định giá lại. Phần thêm mới kiểm catalog hiện tại, kể cả khi tên và modifier giống phần cũ. Nguồn: `src/features/pos/orderFlow.ts:73`, `:183`, `015_write_business_helpers.sql`.

- Chưa có price history của menu theo thời gian; snapshot order/receipt chỉ cho biết giá đã bán.
- `business_date` vẫn chốt lúc tạo đơn; bàn quên thanh toán qua ngày không tự chuyển ngày doanh thu. Đây là quy tắc hiện hành, không lấy hạn pending 24 giờ để đóng đơn.
- Chưa có discount/voucher/price override; cột discount vẫn là seam.
- Receipt legacy thiếu metadata được đánh dấu; không tự gán creator hoặc tên lịch sử không biết.

**Hướng phát triển:** price history hoặc thay quy tắc ngày kinh doanh chỉ khi có yêu cầu được duyệt và test báo cáo tương ứng.

## In Ấn Và Bếp

- `ReceiptPreview`/browser print đáp ứng demo web; `BrowserPrintPort` hiện no-op và không tích hợp máy in native/USB/ESC/POS.
- Phiếu gửi bếp chỉ là preview từ dòng mới thêm; không có queue backend, trạng thái chế biến hoặc màn bếp vận hành.
- Role `kitchen` và component scaffold còn trong code/schema nhưng đã ẩn khỏi nav, PIN và Employees Drawer.

**Hướng phát triển:** service/adapter in cục bộ, kitchen ticket persistence, item status workflow và kitchen display riêng trước khi mở lại role bếp.

## Phạm Vi Sản Phẩm

- Không có quản lý kho/nguyên liệu, loyalty, khách hàng, chấm công, ca làm việc hoặc chuỗi chi nhánh.
- Không có gộp/chuyển bàn.
- Order history dùng fallback `Khách lẻ` vì domain chưa có customer entity.
- Custom role và module permission per-employee chưa có; catalog hiện chỉ gồm 5 quyền hành động.
- Một số phần đã có code hoặc schema nhưng **chưa dùng trên UI** vì không có entry point: tìm kiếm và lọc theo bàn trong lịch sử đơn, cột giảm giá trên đơn, `store_settings.qr_info`, `stores.is_active`, xuất báo cáo ra tệp, kitchen queue. Danh sách đầy đủ kèm lý do ở mục seam trong [features.md](features.md#seam-có-code-nhưng-chưa-dùng-trên-ui); không kể chúng như chức năng hiện hành.
- Upload asset runtime chỉ có ảnh món; decor và nền bàn là catalog built-in.

**Lý do hoãn:** các phần này mở rộng đáng kể data model, workflow và testing nhưng không cần để chứng minh core POS cafe nhỏ trong thời gian tiểu luận.

## UX Và Hiệu Năng

- Ứng dụng landscape-first; portrait chỉ đưa hướng dẫn xoay thay vì cung cấp toàn bộ POS workflow.
- Exit animation drawer/popup còn là polish tùy chọn.
- Bundle chính còn vượt ngưỡng cảnh báo 500 KB; build xác minh lại ngày 2026-08-21 cho một chunk JS duy nhất 1.347,25 KB minified / 368,88 KB gzip (CSS 62,61 KB / 12,17 KB gzip). Chưa có code splitting.
- Catalog asset built-in làm tăng static deployment; chưa có pipeline tối ưu/chuyển toàn bộ ảnh phù hợp sang WebP.
- Chưa có tìm kiếm/favorite/quản lý vòng đời cho asset decor và nền bàn.
- **Ghi POS trong một store là tuần tự.** Coordinator v1 của cả bốn nghiệp vụ lấy cùng một advisory lock phạm vi store (`':pos-write'`), nên hai thu ngân gửi đơn cho hai bàn khác nhau vẫn phải xếp hàng chờ nhau. Đây là đánh đổi để đơn giản hóa tính đúng cho quán nhỏ; chưa có số liệu để khẳng định không ảnh hưởng tốc độ. Chưa có đo đạc thời gian giữ khóa hay thử tải đồng thời. Rủi ro tăng nếu thêm việc vào trong cùng transaction (ví dụ trừ tồn kho theo định lượng) hoặc số thiết bị ghi tăng. Chi tiết ở [architecture.md](architecture.md).

**Hướng phát triển:** code splitting theo drawer/module, lazy-load chart/editor, audit bundle và tối ưu asset.

## Kiểm Thử, Triển Khai Và Artefact

- Đã có coverage nghiệp vụ và kiểm thử nhiều tầng; xem số liệu theo ngày ở [testing.md](testing.md). Chưa có load test hoặc performance benchmark sản xuất.
- Cloud E2E gần nhất không cùng ngày với local baseline; xem [testing.md](testing.md).
- Repository đã cấu hình Vercel, nhưng tài liệu hiện không lưu URL live và ngày xác minh deployment gần nhất. Chỉ nên claim “deployment-ready/configured” cho đến khi bổ sung evidence.
- Nhánh `docs` không giữ ảnh binary. Bộ screenshot current cũ từ 2026-06-20 không đại diện đầy đủ UI phase 23.
- Supabase free có thể pause; demo cần kiểm tra project và chuẩn bị hotspot.

**Hướng phát triển:** chụp lại artefact theo baseline hiện tại ở nơi lưu báo cáo, ghi URL/version/date deploy, bổ sung coverage và rehearsal checklist.

## Thứ Tự Ưu Tiên Đề Xuất

1. Bổ sung realtime subscription cho `menu_item_option_groups`.
2. Nghiệm thu và rollout giao thức v1 theo cửa sổ dừng ghi; giữ giá từng phần đã được hiện thực trong phase 27.
3. Chụp screenshot/diagram và xác minh deployment live cho báo cáo.
4. Code splitting và tối ưu asset để xử lý chunk-size warning.
5. Hoàn thiện các phần bảo mật còn hoãn: provisioning chủ thật, chống brute-force PIN, audit quản trị và quyền đọc.
6. Chọn một hướng sản phẩm lớn tiếp theo: kitchen, thanh toán điện tử hoặc offline-first; không mở đồng thời cả ba.
