# Rollout giao thức ghi POS v1

Ngày: 2026-09-10. Trạng thái: kế hoạch phát hành; chưa triển khai môi trường thật.

## Điều kiện bắt đầu

- Code candidate có SHA và fingerprint nguồn; docs/spec đúng phiên bản; toàn bộ test bắt buộc và ba lượt review đã đạt, không còn finding nghiệp vụ hoặc quyền chưa xử lý.
- Lưu backup database và bản app đang chạy. Kiểm thử phục hồi backup trong môi trường tách biệt, đặc biệt `orders`, `order_items`, `order_item_options`, `payments`, employees và cấu hình store.
- Chọn cửa sổ tạm dừng ghi POS; thông báo người vận hành đóng màn ghi đang dở. Xác minh không có thiết bị còn được dùng để ghi qua app cũ.
- Rà dữ liệu legacy theo phần preflight của migration 014. Nếu phát hiện dữ liệu sai invariant, dừng phát hành để phân tích; không tự sửa hoặc xóa payment để ép migration chạy.

## Trình tự phát hành

1. Bật chế độ tạm dừng ghi tại lớp vận hành trong cửa sổ đã thống nhất. Bản hiện tại chưa xây công tắc maintenance riêng; cần quản lý việc truy cập thiết bị và app khi thực hiện.
2. Áp migration 014, 015, 016 theo đúng thứ tự bằng quyền quản trị database. Mỗi migration có transaction riêng; migration 016 chỉ kích hoạt RPC mới sau khi helpers và schema đã tồn tại.
3. Kiểm grants của mọi overload cũ, quyền INSERT/UPDATE/DELETE tài chính và table status, capability v1, dữ liệu ledger/audit cùng employee session. Không có bước cấp lại quyền cũ để cứu client chưa cập nhật.
4. Phát hành app tương ứng, tải lại từng thiết bị, nhập lại PIN để lấy employee session. App phải chặn ghi khi capability server khác phiên bản hỗ trợ.
5. Kiểm tra luồng tạo đơn, thêm phần mới khác giá, thanh toán và tra cứu lại cùng K trên cửa hàng kiểm thử được phép; xác minh chỉ một hiệu ứng tài chính và receipt đúng. Không tạo giao dịch thử vào số liệu thật khi chưa có kế hoạch đối soát cụ thể.
6. Cho phép ghi trở lại sau khi các kiểm tra sau phát hành đạt. Lưu thời gian, migration versions, SHA app/docs, người thực hiện và kết quả để đưa vào báo cáo.

## Khi có lỗi

Giữ dừng ghi, lưu lỗi và trạng thái ledger/database trước khi can thiệp. Ưu tiên sửa tiến về trước bằng migration mới và app tương thích. Không xóa ledger, không đổi payload/R1, không mở lại RPC cũ hoặc quyền ghi bảng tài chính; các cách đó phá bảo đảm chống trùng.

Chỉ phục hồi backup trong cửa sổ chưa có giao dịch mới sau backup, hoặc sau khi đã có phương án đối chiếu và phục hồi các giao dịch phát sinh. App cũ không được mở ghi trên database đã kích hoạt v1. Nếu cần quay lại bản trước, giữ dừng ghi cho đến khi trạng thái app/database và dữ liệu đều được xác minh thống nhất.

## Tái lập kiểm thử trước phát hành

Các lệnh `test:idempotency:unit`, `test:contracts`, `test:idempotency:tools`, `test:idempotency:e2e`, `test:idempotency:discover`, `test:idempotency:verify-results` chỉ dùng cấu hình test riêng qua `IDEM_ENV_FILE`. Preflight phải chứng minh database có marker cách ly, đúng migration checksums, caller không dùng service role, API và observer nhìn cùng token phiên. Không dùng `.env.local` của app nếu nó trỏ môi trường thật.

Runtime và tái dựng GoTrue trên Windows được ghi đầy đủ tại [phase-27-test-runtime.md](phase-27-test-runtime.md), gồm phiên bản, patch nguyên văn, lệnh build, hash binary, bootstrap và giới hạn Auth/REST. Không dùng đường dẫn TEMP của máy tác giả làm điều kiện để người khác đọc kết quả.
