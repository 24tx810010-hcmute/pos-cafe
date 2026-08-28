# POS Cafe Documentation

Folder này là knowledge base hiện tại của dự án POS Cafe và là nguồn dữ liệu để viết báo cáo tiểu luận. Baseline current-truth gần nhất được audit ngày **2026-08-21** theo `main@c7f2f4e`. Mục tiêu là đọc nhanh được bài toán, yêu cầu, scope, tính năng, data model, kiến trúc, công nghệ, kiểm thử, giới hạn, demo flow và nhật ký implement mà không phải mở code trước.

## Đọc Nhanh Theo Nhu Cầu

| Nhu cầu | Nên đọc |
| --- | --- |
| Hiểu dự án làm gì | [project-overview.md](project-overview.md) |
| Viết phần yêu cầu và traceability | [requirements.md](requirements.md) |
| Biết phase tiểu luận gồm gì, không gồm gì | [phase-scope.md](phase-scope.md) |
| Liệt kê tính năng chính | [features.md](features.md) |
| Biết cái gì có code nhưng chưa dùng trên UI | [features.md](features.md#seam-có-code-nhưng-chưa-dùng-trên-ui) |
| Hiểu dữ liệu và quan hệ nghiệp vụ | [data-model.md](data-model.md) |
| Hiểu kiến trúc code/backend | [architecture.md](architecture.md) |
| Hiểu các màn hình chính | [screens.md](screens.md) |
| Giải thích chọn công nghệ và đánh đổi | [tech-stack.md](tech-stack.md) |
| Lấy số liệu kiểm thử đã phân môi trường | [testing.md](testing.md) |
| Viết hạn chế và hướng phát triển | [limitations.md](limitations.md) |
| Ánh xạ tài liệu sang chương báo cáo | [report-source-map.md](report-source-map.md) |
| Học kiến trúc phổ biến và lý do chọn của dự án | [architecture-explainer.html](architecture-explainer.html) — mở bằng trình duyệt |
| Chuẩn bị bảo vệ/demo | [demo-runbook.md](demo-runbook.md) |
| Chuẩn bị redesign UI/UX | [ui-redesign-context.md](ui-redesign-context.md) |
| Track tiến độ implement theo phase | [implementation-log/README.md](implementation-log/README.md) |
| Ghi chú screenshot/UI baseline | [screenshots/README.md](screenshots/README.md) |
| Truy vết tài liệu cũ | [archive/README.md](archive/README.md) |

## Folder Này Chứa Gì

- Các file `.md` ở root là source-of-truth dễ đọc của dự án hiện tại.
- `implementation-log/` ghi nhật ký implement theo phase, dùng để track nhanh nhánh/commit/tính năng/gap.
- `screenshots/` chỉ giữ chỉ mục/ghi chú Markdown; nhánh `docs` không giữ binary screenshot.
- `archive/` chứa tài liệu cũ, audit, handoff và spec chi tiết theo lịch sử; binary/prototype artifact cũ đã loại khỏi nhánh docs.
- `architecture-explainer.html` là trang học tập tự chứa (mở trực tiếp bằng trình duyệt, không cần cài gì). Nó giải thích 8 kiến trúc phần mềm phổ biến, đối chiếu với lựa chọn của dự án, và gom các lập luận "chọn gì / bỏ gì / vì sao / đánh đổi" theo đúng khuôn dùng cho chương thiết kế kiến trúc. Phần chi tiết cài đặt trong trang được đánh dấu riêng và **không** dùng cho báo cáo, theo [report-source-map.md](report-source-map.md).

## Thứ Tự Tin Cậy

1. Code, tests và migrations trên `main`.
2. Các file root trong `docs/`.
3. `implementation-log/` theo checkpoint lịch sử.
4. `archive/` chỉ để truy vết.

Phase log cũ có thể chứa test/gap đúng tại thời điểm đó nhưng đã được phase sau supersede. Khi viết báo cáo, dùng [testing.md](testing.md) cho số liệu baseline hiện tại và [report-source-map.md](report-source-map.md) để tránh overclaim.

## Quy Tắc Cho AI Viết Báo Cáo

- Bắt buộc đọc và tuân theo [report-source-map.md](report-source-map.md), đặc biệt mục “Quy Tắc Cứng Cho AI Tổng Hợp Báo Cáo”.
- Code, tên file/symbol, commit, migration, SQL và lệnh terminal chỉ dùng để kiểm chứng hoặc suy ra thiết kế; không đưa trực tiếp vào báo cáo.
- Báo cáo phải trình bày thông tin đã tổng hợp ở mức yêu cầu, kiến trúc, dữ liệu, nghiệp vụ, kiểm thử và giới hạn.
- Chỉ đưa artefact triển khai vào phụ lục khi người dùng yêu cầu rõ hoặc mẫu báo cáo bắt buộc.

## Khi Nào Nên Đọc

- Đọc root docs trước khi làm feature, viết báo cáo, chuẩn bị demo hoặc giao việc cho agent khác.
- Đọc `implementation-log/` khi cần biết nhánh `main` đã đi tới đâu.
- Đọc `archive/` chỉ khi cần truy vết quyết định cũ hoặc kiểm chứng chi tiết lịch sử.

## Nguyên Tắc Duy Trì

- Code vẫn là source-of-truth cuối cùng; docs mô tả trạng thái đã kiểm chứng.
- Khi scope thay đổi, cập nhật `phase-scope.md` trước.
- Khi thêm/mở rộng màn hình, cập nhật `features.md`, `screens.md` và ghi chú screenshot; binary screenshot nên lưu ngoài nhánh `docs` nếu cần làm artefact báo cáo.
- Khi hoàn tất một phase/slice lớn, cập nhật `implementation-log/`.
- Khi baseline kiểm thử hoặc giới hạn thay đổi, cập nhật `testing.md`/`limitations.md` và ghi rõ ngày, môi trường.
- Khi một scaffold bị chốt future-only, root docs phải nói rõ entry point nào đã ẩn và không liệt kê nó như màn hình hiện hành.
- Không đưa tài liệu làm việc tạm vào root docs; đưa vào `archive/` nếu cần giữ lại lịch sử.
