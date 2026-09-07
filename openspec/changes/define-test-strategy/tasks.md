# Danh sách việc

Ánh xạ sang `docs/roadmap.md`: đây là phần chính của mục 1, tuần 1. Hai change còn lại của mục 1 là `expand-e2e-coverage` và `setup-test-data-environment`, chỉ làm lát mỏng.

Thứ tự dưới đây bắt buộc. Nhóm 1 là cổng: chưa có số đo nền thì mọi việc sau đều dựa trên phỏng đoán.

## 1. Đo nền trước khi quyết bất cứ điều gì

> **Cổng chặn.** Không được đặt ngưỡng, không được viết tài liệu chiến lược trước khi có số đo thật.

- [ ] 1.1 Cài `@vitest/coverage-v8` vào `devDependencies`
- [ ] 1.2 Thêm script `test:coverage` vào `package.json`
- [ ] 1.3 Thêm khối `coverage` vào `vitest.config.ts` với `include` là `src/core/**/*.ts` và `src/features/**/*.ts`, `exclude` là `src/features/**/use*.ts`, `src/domain/**`, và các file test
- [ ] 1.4 Chạy `npm run test:coverage`, **ghi lại con số phần trăm dòng** kèm mã commit và ngày — TC-TEST-01, TC-TEST-02
- [ ] 1.5 Kiểm báo cáo có đúng phạm vi: có `core` và `features` không phải hook, không có `domain`, `app`, `adapters`, `seed` — TC-TEST-01, TC-TEST-08
- [ ] 1.6 Đếm số file trong báo cáo, phải từ 24 trở lên — TC-TEST-11

## 2. Chốt ngưỡng dựa trên số đo được

- [ ] 2.1 Số nền đạt 90% trở lên thì bật ngưỡng 90% ngay
- [ ] 2.2 Số nền dưới 90% thì bật ngưỡng **bằng đúng số nền** làm mốc chống tụt, và ghi khoảng cách vào mục 2.3
- [ ] 2.3 Nếu có khoảng cách: liệt kê các file có độ phủ thấp nhất, ước lượng công đóng khoảng cách, và chốt mốc nâng ngưỡng lên 90% với chủ dự án. **Không hạ mục tiêu 90%**
- [ ] 2.4 Kiểm ngưỡng có tác dụng thật: tạm nâng ngưỡng vượt số hiện đạt, xác nhận lệnh đỏ, rồi trả về — TC-TEST-06
- [ ] 2.5 Kiểm điều kiện là lớn hơn hoặc bằng: đặt ngưỡng đúng bằng số hiện đạt, xác nhận lệnh xanh — TC-TEST-10
- [ ] 2.6 Kiểm file mới tự vào phạm vi: tạo file tạm trong `features`, xác nhận nó xuất hiện với 0%, rồi xóa — TC-TEST-07

## 3. Viết tài liệu chiến lược

- [ ] 3.1 Tạo `docs/test-strategy.md`
- [ ] 3.2 Chép bảng sáu tầng từ `design.md` mục Decisions 1, **giữ nguyên cột "không kiểm"** — đây là phần tài liệu cũ thiếu
- [ ] 3.3 Chép bảng tiêu chí theo loại thay đổi từ `design.md` mục Decisions 2
- [ ] 3.4 Chép bảng cổng chất lượng từ `design.md` mục Decisions 3, **kèm câu ghi rõ dự án chưa có CI nên cổng đang được giữ bằng kỷ luật**
- [ ] 3.5 Ghi quy ước đặt tên và vị trí file test
- [ ] 3.6 Ghi ba tình huống biên bắt buộc trên cloud E2E, kèm ghi chú việc viết chúng thuộc `expand-e2e-coverage` — TC-TEST-12
- [ ] 3.7 Ghi luật chống trùng lặp: một hành vi chỉ kiểm ở tầng thấp nhất có thể kiểm được nó

## 4. Rút gọn `docs/testing.md` về đúng vai trò nhật ký

- [ ] 4.1 Bỏ mục "Chiến Lược" khỏi `docs/testing.md`, thay bằng một dòng trỏ sang `docs/test-strategy.md`
- [ ] 4.2 Giữ nguyên toàn bộ phần nhật ký kết quả chạy, không sửa số liệu cũ và không sửa ngày cũ
- [ ] 4.3 Thêm mục checklist thủ công gồm đúng hai việc: kiểm email vào hộp thư chính, và kiểm trên thiết bị thật ở chế độ ngang. Mỗi việc có cột ngày chạy và cột ghi chú
- [ ] 4.4 Thêm dòng ghi độ phủ nền đo ở mục 1.4, kèm baseline và ngày
- [ ] 4.5 Rà soát hai file không còn nội dung trùng nhau — TC-TEST-05

## 5. Script kịch bản demo

- [ ] 5.1 Thêm một project vào `playwright.config.ts` chạy riêng file kịch bản demo ở viewport `tablet-landscape`
- [ ] 5.2 Viết `tests/smoke/demo-runbook.spec.ts` đi tuần tự bước 1 tới 14 của `docs/demo-runbook.md`, **liền một mạch trong một test**
- [ ] 5.3 Không nhân đôi bước 15 và 16; chúng đã có test riêng
- [ ] 5.4 Xác nhận test xanh và thời gian chạy dưới 90 giây — TC-TEST-03
- [ ] 5.5 Xác nhận test bắt được thay đổi: tạm đổi nhãn một nút ở luồng gửi đơn, xác nhận test đỏ đúng bước, rồi hoàn tác — TC-TEST-09
- [ ] 5.6 Xác nhận trace Playwright lưu lại được để dùng làm bằng chứng trong báo cáo

## 6. Cổng chất lượng

- [ ] 6.1 Xác nhận bốn lệnh `npm run build`, `npm test`, `npm run test:coverage`, `npm run smoke` đều tồn tại và xanh — TC-TEST-04
- [ ] 6.2 Xác nhận `npm run smoke:supabase` **không** nằm trong bốn lệnh trên
- [ ] 6.3 Chạy `npm run smoke:supabase` một lần, ghi kết quả kèm baseline và ngày vào `docs/testing.md`

## 7. Rà soát chất lượng tài liệu

- [ ] 7.1 Rà mục `## Quyết định đã chốt` của `proposal.md`: mọi quyết định có nhiều phương án đều phải ghi phương án bị loại kèm lý do — TC-TEST-13
- [ ] 7.2 Hỏi chủ dự án về đề xuất sửa `SPEC-STANDARD.md` nêu ở cuối `traceability.md`, phần cho phép quyết định không có use case nhưng vẫn phải có test case

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
