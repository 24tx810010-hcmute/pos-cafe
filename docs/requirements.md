# Requirements & Traceability

Tài liệu này chuyển phạm vi hiện hành thành yêu cầu có mã để dùng trong báo cáo tiểu luận và truy vết sang tính năng, thiết kế và kiểm thử. Baseline được đối chiếu ngày **2026-07-30** là `main@3d9b64a`.

> Cột **Bằng chứng chính** là traceability nội bộ cho AI/developer. Khi viết báo cáo, không sao chép tên code, file, symbol hoặc migration từ cột này; chỉ dùng chúng để kiểm chứng rồi diễn đạt lại yêu cầu và thiết kế ở mức hệ thống.

## Tác Nhân

| Tác nhân | Vai trò hiện hành |
| --- | --- |
| Người dùng trước đăng nhập | Tạo cửa hàng, ghép thiết bị bằng Store Key, chọn nhân viên và nhập PIN |
| Thu ngân (`cashier`) | Vận hành bàn, tạo/sửa đơn, thanh toán tiền mặt, xem lịch sử |
| Quản lý (`admin`) | Toàn bộ quyền thu ngân và các module nhân viên, menu, sơ đồ, báo cáo, cài đặt |
| Bếp (`kitchen`) | Chỉ là enum/schema/component seam tương lai; không phải tác nhân UI hiện hành |

## Yêu Cầu Chức Năng

| Mã | Yêu cầu | Trạng thái | Bằng chứng chính |
| --- | --- | --- | --- |
| FR-01 | Tạo cửa hàng mới với tên, địa chỉ tùy chọn, Admin PIN và lựa chọn seed dữ liệu mẫu | Đã triển khai | [features.md](features.md#store--session), `sessionFlow`, `authRepo`, seed bundle |
| FR-02 | Ghép thiết bị vào cửa hàng bằng Store Key và lưu session cửa hàng ở client | Đã triển khai | [screens.md](screens.md#2-store-pairing), `sessionFlow`, `storeKey` |
| FR-03 | Chọn nhân viên hiện hành và xác minh PIN trước khi vào POS | Đã triển khai | [screens.md](screens.md#4-passcode), RPC `verify_employee_pin` |
| FR-04 | Giới hạn module theo role và 5 thao tác theo quyền hiệu lực từng nhân viên | Đã triển khai | [features.md](features.md#role--permission), `core/guards.ts`, migration 012 |
| FR-05 | Quản lý nhân viên: lọc, tạo, sửa tên/role/trạng thái, reset PIN và chỉnh quyền | Đã triển khai | [screens.md](screens.md#12-employees-drawer), phase 22 |
| FR-06 | Xem sơ đồ theo khu/tầng, lọc trạng thái bàn và nhận biết bàn trống/đang phục vụ | Đã triển khai | [features.md](features.md#pos-floor), `FloorWorkspace` |
| FR-07 | Tạo và cập nhật đơn tại bàn, gồm món, số lượng, ghi chú và modifier | Đã triển khai | [features.md](features.md#order), RPC `submit_order_changes` |
| FR-08 | Tạo và tiếp tục xử lý đơn mang đi | Đã triển khai | [features.md](features.md#takeaway), `TakeawayDrawer` |
| FR-09 | Dùng thư viện modifier chung nhiều-nhiều, hỗ trợ single/multi, bắt buộc và số lượng | Đã triển khai | [data-model.md](data-model.md#nhóm-menu), migration 008 |
| FR-10 | Khi gửi đơn, tạo phiếu gửi bếp từ các dòng mới thêm mà không hiển thị giá | Đã triển khai ở mức preview | Phase 14, `ReceiptPreview`; chưa có kitchen queue hoặc máy in thật |
| FR-11 | Thanh toán toàn bộ đơn bằng tiền mặt, tính tiền thiếu/thối và trả bàn về trống | Đã triển khai | [features.md](features.md#payment), RPC `pay_order` |
| FR-12 | Chọn món/số lượng để tách thành đơn độc lập và thanh toán ngay | Đã triển khai | ADR instant pay, RPC `pay_order_items`, migration 010 |
| FR-13 | Preview/in phiếu tạm tính và hóa đơn qua browser | Đã triển khai ở mức web | Phase 13–14, `ReceiptPreview`; không claim tích hợp ESC/POS |
| FR-14 | Xem lịch sử có khoảng ngày, trạng thái, loại đơn, tìm kiếm, phân trang và chi tiết snapshot | Đã triển khai | [features.md](features.md#order-history), `OrderHistoryDrawer` |
| FR-15 | Hủy đơn đã thanh toán theo quyền, lý do, audit và optimistic lock | Đã triển khai | Phase 19, RPC `void_order`, migration 011 |
| FR-16 | Quản lý menu/category/món/modifier và upload ảnh món JPG/PNG/WebP tối đa 5MB | Đã triển khai | [features.md](features.md#menu-editor), migrations 005–006 |
| FR-17 | Quản lý khu, bàn, decor; kéo, resize, xoay, khóa và lưu changeset | Đã triển khai | [features.md](features.md#floor-editor), phase 17 và 21 |
| FR-18 | Chọn asset decor và nền bàn built-in, render đồng nhất ở editor và POS | Đã triển khai | Phase 21 và 23, migration 013 |
| FR-19 | Xem báo cáo doanh thu, số đơn, trung bình đơn, top món, giờ bán và số/tiền đơn hủy | Đã triển khai | [features.md](features.md#report), `reportRepo` |
| FR-20 | Cập nhật thông tin cửa hàng, seed lại hoặc xóa dữ liệu mẫu có kiểm soát | Đã triển khai | [features.md](features.md#settings--maintenance), `settingsRepo`, `seedRepo` |
| FR-21 | Đồng bộ thay đổi chính giữa nhiều thiết bị khi online bằng realtime invalidate/refetch | Đã triển khai có giới hạn | [architecture.md](architecture.md#realtime), phase 15 và [limitations.md](limitations.md) |

## Yêu Cầu Phi Chức Năng

| Mã | Yêu cầu | Tiêu chí chấp nhận hiện tại | Trạng thái |
| --- | --- | --- | --- |
| NFR-01 | Nhất quán giao dịch order/payment | Mutation quan trọng chạy trong RPC; stale update bị chặn bằng `lock_version` | Đã triển khai và có test |
| NFR-02 | Cô lập dữ liệu giữa cửa hàng | Các bảng nghiệp vụ dùng `store_id`; RLS so khớp `auth.uid()` của store | Đã triển khai; không đồng nghĩa bảo mật per-employee |
| NFR-03 | Dễ kiểm thử và thay adapter | UI/features phụ thuộc ports; Supabase/mock cùng implement contract | Đã triển khai và có boundary test |
| NFR-04 | Hỗ trợ màn hình vận hành ngang | Desktop, tablet/phone landscape dùng được; portrait hiển thị hướng dẫn xoay | Đã kiểm tra bằng Playwright đa viewport |
| NFR-05 | Khả năng khôi phục đồng bộ online | Realtime signal kết hợp refetch/polling danh mục đang active | Đã triển khai; không phải SLA cứng |
| NFR-06 | Build kiểm tra kiểu nghiêm ngặt | `tsc -b` với TypeScript strict và Vite production build phải pass | Đạt tại baseline |
| NFR-07 | Có bằng chứng kiểm thử nhiều lớp | Unit/component/feature, architecture, mock smoke và cloud E2E tách riêng | Đạt một phần; xem ngày chạy trong [testing.md](testing.md) |
| NFR-08 | Deploy web không cần server ứng dụng riêng | Vite build ra `dist`, Vercel SPA rewrite, Supabase làm backend managed | Đã cấu hình; URL live cần xác minh riêng trước khi claim |

## Ngoài Phạm Vi Hoặc Hoãn

Các yêu cầu sau không được tính là thiếu so với baseline tiểu luận hiện tại:

- Kitchen queue/backend và role bếp vận hành thật.
- QR/bank/e-wallet processing thật.
- Offline-first/local database.
- Máy in native, USB hoặc ESC/POS.
- Gộp/chuyển bàn, discount/voucher/refund, quản lý kho, ca làm việc, loyalty.
- Quản lý chuỗi nhiều chi nhánh và custom role hoàn chỉnh.

Lý do và hướng mở rộng được tổng hợp tại [limitations.md](limitations.md).

## Quy Tắc Traceability

- `Đã triển khai` nghĩa là có code trên baseline nêu trên; không tự động có nghĩa đã kiểm chứng cloud trong ngày audit.
- `Đã kiểm chứng` phải kèm lệnh, kết quả, ngày và môi trường trong [testing.md](testing.md) hoặc phase log.
- Root docs mô tả current truth; phase log là bằng chứng lịch sử tại checkpoint và có thể đã được phase sau thay thế.
- Code và migrations là source-of-truth cuối cùng khi tài liệu mâu thuẫn.
