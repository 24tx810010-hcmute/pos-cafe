# POS Cafe Documentation

Folder này là knowledge base hiện tại của dự án POS Cafe. Mục tiêu là đọc nhanh được bài toán, scope phase tiểu luận, tính năng chính, data model, kiến trúc, công nghệ, màn hình, demo flow và nhật ký implement mà không phải mở code trước.

## Đọc Nhanh Theo Nhu Cầu

| Nhu cầu | Nên đọc |
| --- | --- |
| Hiểu dự án làm gì | [project-overview.md](project-overview.md) |
| Biết phase tiểu luận gồm gì, không gồm gì | [phase-scope.md](phase-scope.md) |
| Liệt kê tính năng chính | [features.md](features.md) |
| Hiểu dữ liệu và quan hệ nghiệp vụ | [data-model.md](data-model.md) |
| Hiểu kiến trúc code/backend | [architecture.md](architecture.md) |
| Hiểu các màn hình chính | [screens.md](screens.md) |
| Giải thích chọn công nghệ và đánh đổi | [tech-stack.md](tech-stack.md) |
| Chuẩn bị bảo vệ/demo | [demo-runbook.md](demo-runbook.md) |
| Chuẩn bị redesign UI/UX | [ui-redesign-context.md](ui-redesign-context.md) |
| Track tiến độ implement theo phase | [implementation-log/README.md](implementation-log/README.md) |
| Xem ảnh UI hiện tại | [screenshots/README.md](screenshots/README.md) |
| Truy vết tài liệu cũ | [archive/README.md](archive/README.md) |

## Folder Này Chứa Gì

- Các file `.md` ở root là source-of-truth dễ đọc của dự án hiện tại.
- `implementation-log/` ghi nhật ký implement theo phase, dùng để track nhanh nhánh/commit/tính năng/gap.
- `screenshots/` chứa ảnh UI hiện tại để audit và redesign.
- `archive/` chứa tài liệu cũ, audit, prototype, handoff và spec chi tiết theo lịch sử.

## Khi Nào Nên Đọc

- Đọc root docs trước khi làm feature, viết báo cáo, chuẩn bị demo hoặc giao việc cho agent khác.
- Đọc `implementation-log/` khi cần biết nhánh `main` đã đi tới đâu.
- Đọc `archive/` chỉ khi cần truy vết quyết định cũ hoặc kiểm chứng chi tiết lịch sử.

## Nguyên Tắc Duy Trì

- Code vẫn là source-of-truth cuối cùng; docs mô tả trạng thái đã kiểm chứng.
- Khi scope thay đổi, cập nhật `phase-scope.md` trước.
- Khi thêm/mở rộng màn hình, cập nhật `features.md`, `screens.md` và ảnh trong `screenshots/current/`.
- Khi hoàn tất một phase/slice lớn, cập nhật `implementation-log/`.
- Không đưa tài liệu làm việc tạm vào root docs; đưa vào `archive/` nếu cần giữ lại lịch sử.
