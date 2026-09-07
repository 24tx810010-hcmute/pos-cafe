# Danh sách việc

Ánh xạ sang `docs/roadmap.md`: đây là phần chính của mục 1, tuần 1. Hai change còn lại của mục 1 là `expand-e2e-coverage` và `setup-test-data-environment`, chỉ làm lát mỏng.

Thứ tự dưới đây bắt buộc. Nhóm 1 là cổng: chưa có số đo nền thì mọi việc sau đều dựa trên phỏng đoán.

## 1. Đo nền trước khi quyết bất cứ điều gì

> **Cổng chặn.** Không được đặt ngưỡng, không được viết tài liệu chiến lược trước khi có số đo thật.

- [x] 1.1 Cài `@vitest/coverage-v8` vào `devDependencies`
- [x] 1.2 Thêm script `test:coverage` vào `package.json`
- [x] 1.3 Thêm khối `coverage` vào `vitest.config.ts`. Ngoài `exclude` đã dự kiến, thực tế phải loại thêm `**/index.ts` (barrel chỉ re-export) và `**/*.tsx` (thành phần React lọt vào qua `portsContext.tsx`)
- [x] 1.4 Chạy `npm run test:coverage`, **ghi lại con số phần trăm dòng** kèm mã commit và ngày — TC-TEST-01, TC-TEST-02
- [x] 1.5 Kiểm báo cáo có đúng phạm vi — TC-TEST-01, TC-TEST-08. **Lưu ý:** reporter `text` ẩn file đạt 100% cả bốn cột nên bảng in ra chỉ có 16 dòng; phải đọc `coverage/coverage-summary.json` mới thấy đủ 24 file
- [x] 1.6 Đếm số file trong báo cáo, phải từ 24 trở lên — TC-TEST-11

## 2. Chốt ngưỡng dựa trên số đo được

- [x] 2.1 Số nền đạt 90% trở lên thì bật ngưỡng 90% ngay
- [~] 2.2 Không áp dụng: số nền 92,77% đã vượt 90%
- [~] 2.3 Không áp dụng: không có khoảng cách. Sáu file thấp nhất vẫn được ghi vào `docs/testing.md` để theo dõi
- [x] 2.4 Kiểm ngưỡng có tác dụng thật: tạm nâng ngưỡng vượt số hiện đạt, xác nhận lệnh đỏ, rồi trả về — TC-TEST-06
- [x] 2.5 Kiểm điều kiện là lớn hơn hoặc bằng: đặt ngưỡng đúng bằng số hiện đạt, xác nhận lệnh xanh — TC-TEST-10
- [x] 2.6 Kiểm file mới tự vào phạm vi: tạo file tạm trong `features`, xác nhận nó xuất hiện với 0%, rồi xóa — TC-TEST-07

## 3. Viết tài liệu chiến lược

- [x] 3.1 Tạo `docs/test-strategy.md`
- [x] 3.2 Chép bảng sáu tầng từ `design.md` mục Decisions 1, **giữ nguyên cột "không kiểm"** — đây là phần tài liệu cũ thiếu
- [x] 3.3 Chép bảng tiêu chí theo loại thay đổi từ `design.md` mục Decisions 2
- [x] 3.4 Chép bảng cổng chất lượng từ `design.md` mục Decisions 3, **kèm câu ghi rõ dự án chưa có CI nên cổng đang được giữ bằng kỷ luật**
- [x] 3.5 Ghi quy ước đặt tên và vị trí file test
- [x] 3.6 Ghi ba tình huống biên bắt buộc trên cloud E2E, kèm ghi chú việc viết chúng thuộc `expand-e2e-coverage` — TC-TEST-12
- [x] 3.7 Ghi luật chống trùng lặp: một hành vi chỉ kiểm ở tầng thấp nhất có thể kiểm được nó

## 4. Rút gọn `docs/testing.md` về đúng vai trò nhật ký

- [x] 4.1 Bỏ mục "Chiến Lược" khỏi `docs/testing.md`, thay bằng một dòng trỏ sang `docs/test-strategy.md`
- [x] 4.2 Giữ nguyên toàn bộ phần nhật ký kết quả chạy, không sửa số liệu cũ và không sửa ngày cũ
- [x] 4.3 Thêm mục checklist thủ công gồm đúng hai việc: kiểm email vào hộp thư chính, và kiểm trên thiết bị thật ở chế độ ngang. Mỗi việc có cột ngày chạy và cột ghi chú
- [x] 4.4 Thêm dòng ghi độ phủ nền đo ở mục 1.4, kèm baseline và ngày
- [x] 4.5 Rà soát hai file không còn nội dung trùng nhau — TC-TEST-05

## 5. Script kịch bản demo

> **Phần này do agent lập trình thực hiện.** Mục dưới đây là spec đủ chi tiết để làm mà không phải đoán. Đọc kèm `design.md` mục "Script kịch bản demo" và TC-TEST-03, TC-TEST-09 trong `testplan.md`.

### 5a. Ràng buộc bắt buộc

- [ ] 5a.1 File đặt tại `tests/smoke/demo-runbook.spec.ts`, chạy trên **adapter mock**, không dùng Supabase
- [ ] 5a.2 **Đúng một `test()` duy nhất** đi liền mạch 14 bước. Không tách thành nhiều test — giá trị của script nằm ở chỗ nối giữa các bước, tách ra là mất
- [ ] 5a.3 Chỉ chạy ở **một viewport** `tablet-landscape`. Bố cục đã có `pos-cafe.spec.ts` phủ ở 5 kích thước; chạy lại 5 lần chỉ làm chậm mà không thêm thông tin
- [ ] 5a.4 Dùng `data-testid` làm selector chính, **không** bám vào chuỗi tiếng Việt hiển thị trên giao diện. Chuỗi hiển thị đổi thường xuyên hơn testid
- [ ] 5a.5 Tái dùng helper đang có trong `tests/smoke/pos-cafe.spec.ts`: `loginAsAdmin`, `waitForTransientOverlays`, `waitForStageFit`. Trích chúng ra module dùng chung nếu cần, **không chép lại**
- [ ] 5a.6 Không nhân đôi bước 15 và 16 của runbook (quản trị thực đơn, sơ đồ, cài đặt, xóa dữ liệu mẫu) — đã có test riêng phủ

### 5b. Mười bốn bước, kèm testid đã có sẵn trong mã

Cột "testid" liệt kê định danh **đã tồn tại** trong `src/app`. Thiếu testid nào thì **thêm vào component**, đừng lách bằng selector theo chuỗi hiển thị.

- [ ] 5b.1 Bước 1–3, vào ứng dụng: `landing-screen` → `go-store-pairing` hoặc `go-passcode` → `store-pairing-screen` + `store-key-input` nếu chưa ghép → `passcode-screen` → `unlock-button`. Khẳng định: vào được `floor-view`
- [ ] 5b.2 Bước 4, mở bàn trống: `floor-view` → `table-tbl-b01`. Khẳng định: `order-drawer` mở
- [ ] 5b.3 Bước 5, tạo đơn có tùy chọn món: `menu-item-mi-ca-phe-sua` → `modifier-confirm` → chỉnh số lượng → `submit-order-button-footer`. Khẳng định: đơn có đúng số dòng món mong đợi
- [ ] 5b.4 Bước 6, quay lại sơ đồ. Khẳng định: `table-tbl-b01` đổi sang trạng thái đang phục vụ
- [ ] 5b.5 Bước 7, mở lại đơn rồi chuyển sang thanh toán: `pay-button-footer`. Khẳng định: `payment-drawer` mở
- [ ] 5b.6 Bước 8, tách đơn thanh toán — **điểm nhấn của demo**: bỏ `pay-select-all` → tick 1–2 `pay-item-checkbox` → dùng `pay-item-plus` chỉnh số lượng → hoàn tất. Khẳng định: sinh **hai đơn độc lập**, đơn tách giữ số bill gốc và đơn còn lại mang số mới
- [ ] 5b.7 Bước 9, thanh toán phần còn lại: nhập tiền khách đưa qua `payment-keypad`. Khẳng định: khi tiền thiếu thì `payment-insufficient-warning` hiện; khi đủ thì thanh toán được. **Phải kiểm cả hai trạng thái**, đây là ranh giới nghiệp vụ chứ không phải đường trang trí
- [ ] 5b.8 Bước 10, xem trước hóa đơn rồi quay lại sơ đồ. Khẳng định: `table-tbl-b01` về trạng thái trống
- [ ] 5b.9 Bước 11, mở lịch sử và báo cáo. Khẳng định: hai đơn độc lập từ cùng một bàn, số đơn tăng **theo thứ tự thanh toán**
- [ ] 5b.10 Bước 12, hủy đơn đã thanh toán: `history-void-order` → `history-void-reason` → nếu chọn lý do khác thì `history-void-note` bắt buộc → `history-void-confirm`. Khẳng định: badge đã hủy, `history-void-info` hiện người và thời điểm, nút in lại bị khóa
- [ ] 5b.11 Bước 13, mở báo cáo. Khẳng định: đơn vừa hủy **bị loại khỏi doanh thu**, đồng thời số đơn đã hủy và tiền hủy **tăng đúng**
- [ ] 5b.12 Bước 14, đổi quyền per-employee: `nav-employees` → chọn thu ngân → bỏ quyền thanh toán → `save-employee-button` → khóa phiên → đăng nhập lại bằng thu ngân đó. Khẳng định: vẫn tạo và sửa đơn được, nhưng nút thanh toán **bị vô hiệu và có nêu lý do**
- [ ] 5b.13 Khôi phục quyền về như cũ ở cuối test, để lần chạy sau không phụ thuộc thứ tự

### 5c. Kiểm chứng

- [ ] 5c.1 Thêm một project vào `playwright.config.ts` chạy riêng file này ở `tablet-landscape`
- [ ] 5c.2 Test xanh, thời gian chạy **dưới 90 giây** — TC-TEST-03
- [ ] 5c.3 Trace Playwright lưu lại được, dùng làm bằng chứng trong báo cáo — TC-TEST-03
- [ ] 5c.4 Tạm đổi nhãn hoặc gỡ một testid ở luồng gửi đơn, xác nhận test **đỏ đúng bước đó**, rồi hoàn tác — TC-TEST-09. Bỏ phép thử này thì không biết script có thực sự đi qua các bước hay chỉ mở ứng dụng rồi kết thúc
- [ ] 5c.5 Chạy lại hai lần liên tiếp, cả hai đều xanh. Test nhấp nháy thì coi như chưa xong

### 5d. Bàn giao

- [ ] 5d.1 Ghi kết quả chạy vào `docs/testing.md` kèm baseline và ngày
- [ ] 5d.2 Điền "Nơi hiện thực" cho TC-TEST-03 và TC-TEST-09 trong `testplan.md`

## 6. Cổng chất lượng

- [ ] 6.1 Xác nhận bốn lệnh `npm run build`, `npm test`, `npm run test:coverage`, `npm run smoke` đều tồn tại và xanh — TC-TEST-04
- [ ] 6.2 Xác nhận `npm run smoke:supabase` **không** nằm trong bốn lệnh trên
- [ ] 6.3 Chạy `npm run smoke:supabase` một lần, ghi kết quả kèm baseline và ngày vào `docs/testing.md`

## 7. Rà soát chất lượng tài liệu

- [x] 7.1 Rà mục `## Quyết định đã chốt` của `proposal.md`: mọi quyết định có nhiều phương án đều phải ghi phương án bị loại kèm lý do — TC-TEST-13
- [x] 7.2 Đề xuất sửa `SPEC-STANDARD.md` đã được chủ dự án chốt ngày 2026-09-07: cho phép cột use case khác 0 nếu vẫn có test case và có giải trình. Đã sửa chuẩn và sửa `traceability.md`

## 8. Cập nhật tài liệu liên quan

- [ ] 8.1 Cập nhật `docs/requirements.md` phần NFR-07, trỏ tới `docs/test-strategy.md` làm định nghĩa "bằng chứng nhiều lớp"
- [ ] 8.2 Cập nhật `pos-cafe-context.md` nếu phần mô tả quy trình kiểm thử đã lỗi thời
- [ ] 8.3 Đánh dấu mục 1 trong `docs/roadmap.md` là xong, ghi ngày
- [ ] 8.4 Chạy `openspec archive define-test-strategy --store pos-cafe-docs`

## Việc không thuộc change này

Ghi ra để không ai làm nhầm sang:

| Việc | Thuộc change |
| --- | --- |
| Viết ba ca cloud E2E bắt buộc | `expand-e2e-coverage` |
| Dựng dữ liệu và môi trường test | `setup-test-data-environment` |
| Biến cổng chất lượng thành cấu hình chạy tự động | `add-ci-pipeline` |
| Đóng khoảng cách độ phủ nếu nền dưới 90% | Change tương ứng với vùng mã đó, theo lộ trình chốt ở mục 2.3 |
