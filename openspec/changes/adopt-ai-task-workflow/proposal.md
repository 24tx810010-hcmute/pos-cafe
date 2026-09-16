# Đóng gói quy trình task với AI

Ngày 2026-09-16. Change **quy trình**, không thêm hành vi người dùng cuối của ứng dụng; bỏ `usecases.md` theo ngoại lệ của [SPEC-STANDARD](../../SPEC-STANDARD.md). Có requirement quy trình, testplan và traceability. Kết quả áp dụng/kiểm tra ghi trong [biên bản](../../../docs/implementation-log/workflow-adoption-2026-09-16.md), không dùng số file để tuyên bố quy trình đã chứng minh hiệu quả thực tế.

## Why

Chủ dự án có các proposal chưa đủ chi tiết và muốn đầu vào AI rõ, đầu ra kiểm chứng được, AI chủ động hỏi và hỗ trợ lựa chọn. Dự án phục vụ cả đồ án lẫn khả năng dùng thật; quyết định và lý do chọn A thay B phải lưu trên `docs`.

Sau khi phản biện đề xuất ban đầu, cần chuẩn hóa bằng chứng, độ sâu tài liệu theo tác động, bàn giao giữa các phiên và phần giải thích code. Đồng thời giữ quyền chốt nghiệp vụ, bộ bảy phần của change chính thức và các gate riêng đang có.

## What Changes

- Thêm quy trình sáu bước và mẫu đề bài, câu hỏi, quyết định, task thực hiện, nghiệm thu, bàn giao.
- Thêm câu mở đầu dùng từ worktree code hoặc checkout mới thiếu con trỏ hướng dẫn.
- Tích hợp vào `AGENTS.md`, `CLAUDE.md`, chuẩn spec, config OpenSpec và các chỉ mục hiện có.
- Làm rõ quyền tiếp tục công việc độc lập, hỏi lại khi thông tin mới ảnh hưởng phần đang làm, và không đặt trần tổng câu hỏi.
- Giữ hồ sơ quyết định có nguồn/ngày, bằng chứng gắn code/spec/môi trường, và trạng thái hiện thực/kiểm chứng/nghiệm thu/phát hành riêng.

## Capabilities

### New Capabilities

- `ai-task-workflow`: quy trình làm việc và truy vết cho task. Mã `WF-01`–`WF-08` là requirement quy trình, không thêm FR/NFR chức năng POS.

### Modified Capabilities

Không đổi năng lực ứng dụng.

## Impact

Chỉ tài liệu Markdown và cấu hình hướng dẫn OpenSpec trên nhánh `docs`. Không đổi source, runner kiểm thử, CI, cơ sở dữ liệu, quyền ứng dụng hoặc deployment. Các thay đổi có sẵn của task khác được giữ nguyên; commit riêng chỉ chứa phần đóng gói quy trình.

## Ngoài phạm vi

- Chọn hoặc triển khai tính năng pilot; làm sâu toàn bộ backlog.
- Tạo skill/plugin cá nhân hoặc thay cài đặt toàn cục của công cụ AI.
- Viết runner tổng hợp hoặc CI; tuyên bố mọi gate đang xanh.
- Chuyển hướng dẫn sang `main`, đổi các con trỏ hiện có, push hoặc phát hành.
- Nới gate đã duyệt của task đang làm, hoặc nhận thay chủ dự án rằng họ đã đọc code/nghiệm thu.

## Phụ thuộc

- Mô hình hai nhánh và chuẩn spec hiện tại.
- Các mẫu tham chiếu code/công cụ có thể đổi theo thời gian: task mới phải xác minh checkout và cấu hình thực tế.
- Hiệu quả của quy trình cần được đánh giá qua task áp dụng; chưa có kết quả pilot.

## Câu hỏi phải chốt trước khi làm

Không còn câu hỏi quan trọng chặn **việc đóng gói quy trình**: chủ dự án đã chấp thuận hướng sửa sau phản biện và yêu cầu đưa vào dự án để dùng cho task mới. Vị trí `docs` tuân theo mô hình nhánh hiện hữu và yêu cầu trước đó phải lưu quyết định ở `docs`. Cấu trúc file/mẫu và commit local riêng là chi tiết thực hiện trong phạm vi này; không suy thành quyền push hoặc làm feature.

## Quyết định đã chốt

Nguồn: cuộc trao đổi ngày 2026-09-16. Chủ dự án yêu cầu: "các thông tin về quyết định (tại sao làm A thay B) cũng cần cân nhắc kĩ và phải lưu lại ở nhánh docs"; sau phản biện yêu cầu "tiến hành đóng gói lại và đưa vào dự án ... áp dụng luôn cho task mới". Các quy tắc dưới đây hiện thực hướng đã được chấp thuận, không ghi rằng chủ dự án chọn từng tên file.

| Mã | Quyết định, phương án và lý do | Căn cứ / hệ quả |
| --- | --- | --- |
| DEC-WF-01 | Quy trình/spec/hồ sơ ở `docs`, công cụ chạy ở `main`. Không nhân đôi hai bản hướng dẫn | Yêu cầu lưu quyết định trên docs và mô hình nhánh hiện hữu; checkout mới cần đường đọc docs rõ ràng |
| DEC-WF-02 | Giữ bộ bảy phần cho change chính thức; task/bảo trì nhẹ dùng mục ngắn hoặc hồ sơ đang có. Loại miễn tài liệu chỉ vì nhãn S/bug/UI | Tác động nghiệp vụ không tỉ lệ số dòng; giảm lặp nội dung nhưng không hạ gate |
| DEC-WF-03 | Hỏi theo nhóm, không giới hạn tổng. AI quyết chi tiết trong quy ước/phạm vi được giao, không đoán nghiệp vụ | Ưu tiên đầu ra đúng và được hỗ trợ quyết định của chủ dự án; có thể chia nhỏ feature khi quá nhiều câu hỏi |
| DEC-WF-04 | Bằng chứng gắn source thực tế/spec/môi trường, có cách tái hiện; dùng lại cơ chế kiểm có sẵn. Không coi một lệnh hay CI là bảo đảm logic đúng | Khảo sát `scripts/idempotency-verify-results.mjs:7` và `vitest.config.ts:10` trên code worktree ngày 16/09; lần này chỉ đọc, không chạy lại test ứng dụng |
| DEC-WF-05 | Một bàn giao cho mỗi task, cập nhật theo checkpoint; chỉ mục liên kết. Không dùng file trạng thái như nguồn tạo quyền | Hạn chế mất ngữ cảnh và xung đột giữa nhiều task; phải kiểm freshness và nguồn ủy quyền |
| DEC-WF-06 | Test cùng từng slice; review trọng điểm và giải thích code; giữ các trạng thái nghiệm thu/phát hành riêng | Phục vụ sản phẩm và đồ án; chưa phản hồi thì không nói chủ dự án đã hiểu/chấp nhận |
| DEC-WF-07 | Khi sửa không tiến triển, chuyển sang chẩn đoán theo bằng chứng. Không bắt đúng ba lần phải đổi design hoặc dừng toàn task | Nguyên nhân có thể ở requirement/code/test/môi trường; số lần chỉ là tín hiệu xem lại cách làm |
| DEC-WF-08 | Không chọn sẵn pilot hoặc hoãn an toàn đồng thời của chuyển bàn | Chưa so sánh ứng viên; xung đột dữ liệu là vấn đề tính đúng cần xử lý ở phạm vi phát hành |

Trạng thái: đã chấp nhận hướng quy trình theo nguồn trên; chi tiết đóng gói do AI thực hiện trong yêu cầu. Chưa có quyết định nào bị thay thế trong change này. Nếu sửa về sau, ghi DEC mới liên kết quyết định cũ; không xóa lý do ban đầu. Bằng chứng thực nghiệm về năng suất chưa có.
