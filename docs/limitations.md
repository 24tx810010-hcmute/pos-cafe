# Limitations & Future Work

Tài liệu này ghi các giới hạn đã biết của `main@b7b7262`, lý do chưa triển khai và hướng mở rộng. Đây là nguồn cho chương hạn chế/hướng phát triển của báo cáo; không được biến seam hoặc UI preview thành tính năng hoàn chỉnh.

## Bảo Mật Và Phân Quyền

- RLS hiện cô lập dữ liệu **giữa các store** bằng Auth user/store owner chung; PIN nhân viên không tạo một database identity riêng.
- Employee hiện hành được giữ trong memory của client. Người có store session/token hợp lệ về mặt kỹ thuật có thể giả `p_employee_id` hoặc ghi trực tiếp các bảng được policy `FOR ALL` cho store cho phép.
- Guard trong feature flow và RPC giúp bảo vệ nghiệp vụ/audit, nhưng không phải security boundary per-employee chống client độc hại.
- Thay đổi role/quyền của nhân viên đang đăng nhập chỉ phản ánh đầy đủ trên UI sau khi khóa phiên và đăng nhập lại; RPC đọc override live nên có thể từ chối mutation sớm hơn UI.

**Hướng phát triển:** tạo identity/session per-employee hoặc signed employee context ở backend, siết policy ghi và không nhận actor id do client tự khai báo; thêm audit log thay đổi quyền.

## Online Và Realtime

- Ứng dụng là online-only; mất kết nối thì không có local queue/database để tiếp tục bán hàng.
- Realtime dùng event làm tín hiệu invalidate/refetch và có polling hồi phục; khoảng polling 5 giây không phải SLA cứng.
- `SupabaseRealtimePort` chưa subscribe `menu_item_option_groups`. Thao tác chỉ gắn/bỏ modifier group khỏi món có thể cần refresh/reconnect trên máy khác.
- Self-heal khi reconnect có unit test, nhưng cần diễn tập cloud hai thiết bị định kỳ để xác nhận hành vi thực tế.

**Hướng phát triển:** bổ sung subscription bảng nối, telemetry độ trễ, trạng thái kết nối hiển thị có ý nghĩa và adapter local-first nếu scope cho phép.

## Thanh Toán Và Đối Soát

- Payment thật chỉ hỗ trợ tiền mặt. Thẻ, chuyển khoản và QR chỉ là seam/preview, không có processing hoặc callback đối soát.
- `store_settings.qr_info` chưa được Payment Settings persist qua `settingsRepo`.
- Instant pay tách thành các order độc lập nhưng không lưu liên kết lineage giữa các bill cùng nguồn.
- “Một payment cho mỗi order paid” đang là invariant của RPC/app; schema không có unique constraint trên `payments.order_id`.
- Chưa có refund, discount/voucher, price override, mở két, ca làm việc hoặc kiểm két.

**Hướng phát triển:** provider abstraction cho thanh toán điện tử, transaction/refund ledger, constraint hoặc invariant DB phù hợp và liên kết bill tách nếu nghiệp vụ cần truy vết.

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
- Upload asset runtime chỉ có ảnh món; decor và nền bàn là catalog built-in.

**Lý do hoãn:** các phần này mở rộng đáng kể data model, workflow và testing nhưng không cần để chứng minh core POS cafe nhỏ trong thời gian tiểu luận.

## UX Và Hiệu Năng

- Ứng dụng landscape-first; portrait chỉ đưa hướng dẫn xoay thay vì cung cấp toàn bộ POS workflow.
- Exit animation drawer/popup còn là polish tùy chọn.
- Bundle chính còn vượt ngưỡng cảnh báo 500 KB; baseline build ngày 2026-07-30 khoảng 1.34 MB minified/368 KB gzip cho JS.
- Catalog asset built-in làm tăng static deployment; chưa có pipeline tối ưu/chuyển toàn bộ ảnh phù hợp sang WebP.
- Chưa có tìm kiếm/favorite/quản lý vòng đời cho asset decor và nền bàn.

**Hướng phát triển:** code splitting theo drawer/module, lazy-load chart/editor, audit bundle và tối ưu asset.

## Kiểm Thử, Triển Khai Và Artefact

- Không có số liệu coverage, load test hoặc performance benchmark chính thức.
- Cloud E2E gần nhất không cùng ngày với local baseline; xem [testing.md](testing.md).
- Repository đã cấu hình Vercel, nhưng tài liệu hiện không lưu URL live và ngày xác minh deployment gần nhất. Chỉ nên claim “deployment-ready/configured” cho đến khi bổ sung evidence.
- Nhánh `docs` không giữ ảnh binary. Bộ screenshot current cũ từ 2026-06-20 không đại diện đầy đủ UI phase 23.
- Supabase free có thể pause; demo cần kiểm tra project và chuẩn bị hotspot.

**Hướng phát triển:** chụp lại artefact theo baseline hiện tại ở nơi lưu báo cáo, ghi URL/version/date deploy, bổ sung coverage và rehearsal checklist.

## Thứ Tự Ưu Tiên Đề Xuất

1. Bổ sung realtime subscription cho `menu_item_option_groups`.
2. Chụp screenshot/diagram và xác minh deployment live cho báo cáo.
3. Code splitting và tối ưu asset để xử lý chunk-size warning.
4. Siết employee security boundary nếu dùng ngoài môi trường demo tin cậy.
5. Chọn một hướng sản phẩm lớn tiếp theo: kitchen, thanh toán điện tử hoặc offline-first; không mở đồng thời cả ba.
