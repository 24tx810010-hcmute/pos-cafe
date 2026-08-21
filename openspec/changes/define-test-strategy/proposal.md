# Định hình chiến lược kiểm thử tự động

## Why

Dự án đã có kiểm thử nhưng chưa có chiến lược được viết thành văn: hiện có Vitest (49 file, 257 test tại baseline `main@b7b7262`), Playwright smoke đa viewport, một architecture boundary test và `docs/testing.md` ghi kết quả chạy. Vấn đề là không ai trả lời được câu "tính năng mới thì phải viết loại test nào, bao nhiêu là đủ, và điều gì chặn merge". Khi 8 nhóm tính năng mở rộng phía sau lần lượt được làm, thiếu chiến lược sẽ dẫn tới mỗi tính năng test một kiểu, và NFR-07 (bằng chứng kiểm thử nhiều lớp) không kiểm chứng được.

## What Changes

- Viết tài liệu chiến lược kiểm thử xác định các tầng test, mỗi tầng test cái gì và không test cái gì, chạy ở đâu, chạy nhanh cỡ nào.
- Xác định tiêu chí "đủ test" cho một thay đổi: loại test bắt buộc theo loại thay đổi (thuần domain, adapter, UI, migration, RPC).
- Xác định cổng chất lượng: điều kiện tối thiểu để một thay đổi được coi là xong.
- Chuẩn hóa quy ước đặt tên, vị trí file test và cách tổ chức test theo ranh giới Ports and Adapters hiện có.
- Rà lại bộ test đang có, phân loại theo tầng và ghi nhận khoảng trống để các change kiểm thử sau nhắm vào.
- Cập nhật `docs/testing.md` thành tài liệu chiến lược thay vì chỉ là nhật ký kết quả chạy.

## Capabilities

### New Capabilities

Không có. Đây là thay đổi về quy trình và công cụ, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Tài liệu: `docs/testing.md`, `docs/requirements.md` (tiêu chí NFR-07), `pos-cafe-context.md`.
- Không đổi source code nghiệp vụ. Có thể đổi cấu hình `vitest.config.ts`, `playwright.config.ts`, `playwright.supabase.config.ts` nếu cần tách project theo tầng test.
- Là nền cho `expand-e2e-coverage`, `setup-test-data-environment`, `add-ci-pipeline`.

## Ngoài phạm vi

- Viết thêm test case mới. Việc đó thuộc `expand-e2e-coverage`.
- Dựng dữ liệu và môi trường test. Việc đó thuộc `setup-test-data-environment`.
- Cấu hình pipeline chạy tự động. Việc đó thuộc `add-ci-pipeline`.
- Kiểm thử hiệu năng và kiểm thử bảo mật.

## Phụ thuộc

- Không phụ thuộc change nào khác. Đây nên là change làm đầu tiên trong nhóm kiểm thử.

## Câu hỏi phải chốt trước khi làm

1. Mục tiêu thật của chiến lược này là gì: đủ để bảo vệ code khi phát triển tiếp, hay còn phải làm bằng chứng trình bày trong báo cáo đồ án? Hai mục tiêu này dẫn tới mức chi tiết rất khác nhau.
2. Có đặt ngưỡng độ phủ (coverage) bằng số không? Nếu có thì ngưỡng bao nhiêu, đo trên toàn bộ `src` hay chỉ trên `domain` và `core`? Nếu không thì lấy gì thay thế làm tiêu chí "đủ test"?
3. Cổng chất lượng có được phép chặn merge không, hay chỉ là khuyến nghị? Nếu chặn thì chặn ở mức nào: chỉ `tsc` và unit test, hay cả E2E?
4. E2E chạy trên Supabase thật có được tính là bắt buộc không? Hiện `npm run smoke:supabase` cần một project Supabase riêng và có chi phí thời gian, cần chốt nó là bắt buộc trước khi merge hay chỉ chạy định kỳ.
5. Có chấp nhận thêm dependency mới cho kiểm thử không (ví dụ thư viện tạo dữ liệu giả, thư viện assertion bổ sung), hay giữ nguyên đúng bộ Vitest và Playwright đang có?
6. Kiểm thử thủ công có còn chỗ trong quy trình không, hay mục tiêu là tự động hóa toàn bộ? Nếu còn thì phần nào giữ thủ công và ghi ở đâu?
7. Tài liệu chiến lược đặt ở đâu: viết đè vào `docs/testing.md`, hay tách file mới và để `docs/testing.md` tiếp tục làm nhật ký kết quả chạy?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
