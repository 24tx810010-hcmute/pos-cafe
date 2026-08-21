# Thesis Report Source Map

Nhánh `docs` là **nguồn dữ liệu để viết báo cáo**, không phải bản Word hoàn chỉnh. Baseline current-truth được audit ngày **2026-08-21** theo `main@c7f2f4e`.

## Quy Tắc Cứng Cho AI Tổng Hợp Báo Cáo

Khi dùng nhánh này để viết báo cáo tiểu luận, AI **không được sao chép hoặc đưa trực tiếp artefact triển khai vào nội dung báo cáo**, gồm:

- Source code hoặc code snippet.
- Tên/đường dẫn file, folder và test file trong repository.
- Tên class, function, hook, component hoặc biến nội bộ.
- Commit hash, branch, pull request hoặc lịch sử Git.
- Tên/số từng migration như `001`–`013`, nội dung SQL hoặc migration ledger.
- Lệnh terminal, package config, environment variable hoặc chi tiết setup nội bộ.

Các artefact trên chỉ được dùng nội bộ để:

- Kiểm chứng một claim là đúng với code hiện hành.
- Suy ra bảng, trường, kiểu dữ liệu, PK/FK, quan hệ và constraint cuối cùng.
- Hiểu luồng nghiệp vụ, transaction, phân quyền, kiểm thử và giới hạn.
- Hỗ trợ triển khai hoặc bảo trì dự án, không phải làm nội dung báo cáo.

Khi chuyển thông tin sang báo cáo, AI phải diễn đạt ở mức **bài toán, yêu cầu, thiết kế, kiến trúc, mô hình dữ liệu, thuật toán/luồng nghiệp vụ và kết quả kiểm thử**. Dùng văn xuôi, bảng, ERD, flowchart hoặc pseudocode khái quát; không thay bằng code thật.

Riêng chương cơ sở dữ liệu:

- Trình bày trạng thái schema cuối cùng, không kể lịch sử từng migration.
- Nêu bảng, trường quan trọng, kiểu dữ liệu, PK/FK, cardinality, constraint và quy tắc nghiệp vụ.
- Có thể nói một câu rằng schema được quản lý bằng SQL migration có phiên bản; không liệt kê tên/số/file migration.

Chỉ được đưa code/file/migration vào **phụ lục** khi người dùng yêu cầu rõ hoặc mẫu báo cáo bắt buộc. Trước khi làm vậy phải hỏi lại người dùng và chỉ trích phần tối thiểu cần thiết.

## Thứ Tự Tin Cậy

1. Code, tests và SQL migrations trên `main`.
2. Root docs trong thư mục `docs/` — trạng thái hiện hành đã tổng hợp.
3. `implementation-log/` — bằng chứng lịch sử theo checkpoint.
4. `archive/` — spec/audit cũ để truy vết, không phải current truth.

Nếu có mâu thuẫn, kiểm tra code/migration trước rồi cập nhật root docs. Không lấy kết quả test hoặc gap trong phase cũ làm trạng thái hiện hành khi phase sau đã supersede.

## Ánh Xạ Sang Cấu Trúc Báo Cáo

| Phần báo cáo gợi ý | Nguồn chính |
| --- | --- |
| Mở đầu, bài toán, mục tiêu | [project-overview.md](project-overview.md) |
| Phạm vi và đối tượng sử dụng | [requirements.md](requirements.md), [phase-scope.md](phase-scope.md) |
| Khảo sát/chức năng hệ thống | [features.md](features.md), [screens.md](screens.md) |
| Phân tích yêu cầu và traceability | [requirements.md](requirements.md) |
| Thiết kế kiến trúc | [architecture.md](architecture.md), [tech-stack.md](tech-stack.md) |
| Thiết kế cơ sở dữ liệu | [data-model.md](data-model.md) |
| Cài đặt và quyết định kỹ thuật | [implementation-log/README.md](implementation-log/README.md) |
| Kiểm thử và đánh giá | [testing.md](testing.md), [demo-runbook.md](demo-runbook.md) |
| Hạn chế và hướng phát triển | [limitations.md](limitations.md) |
| Phụ lục/demo | [demo-runbook.md](demo-runbook.md), [screenshots/README.md](screenshots/README.md) |

## Cách Dùng Phase Log

- Dùng để lấy timeline, commit, mục tiêu, cách triển khai, test tại thời điểm đó và quyết định phát sinh.
- Khi trích số liệu test, ghi rõ đó là checkpoint lịch sử hay baseline hiện tại.
- Nếu phase cũ ghi failure/gap đã được phase sau sửa, trình bày như diễn biến phát triển, không ghi thành lỗi hiện hành.
- Phase 09–23 phù hợp làm case study feature; phase 24 mô tả lần audit tài liệu report-ready, không phải feature code mới.

## Các Claim An Toàn

- Có thể claim app có 15 bảng nghiệp vụ ở trạng thái schema cuối cùng, schema được quản lý bằng migration có phiên bản và order/payment dùng transaction phía database; không liệt kê migration cụ thể trong báo cáo.
- Có thể claim local baseline ngày 2026-08-21 trên `main@c7f2f4e` đạt 260/260 test (49 test files) và production build pass. Mock smoke 34 pass là kết quả ngày 2026-08-12; phải ghi đúng ngày và giữ riêng evidence cloud.
- Có thể claim áp dụng Ports & Adapters theo hướng Hexagonal Architecture; không nên claim textbook hexagonal tuyệt đối.
- Có thể claim RLS cô lập store; không claim employee PIN là DB identity hoặc quyền per-employee chống client độc hại.
- Có thể claim online realtime invalidate/refetch; không claim offline hoặc SLA cứng ≤5 giây.
- Có thể claim cash payment và browser print preview; không claim QR processing hoặc máy in POS thật.
- Có thể claim mutation order/payment chạy trong transaction phía database, có khóa chống tranh chấp giữa nhiều thiết bị và optimistic locking chống ghi đè; **không** liệt kê tên hàm khóa, tên RPC hay số migration trong báo cáo. Có thể nêu như một hạn chế rằng phạm vi khóa hiện ở mức cửa hàng nên ghi POS trong cùng một cửa hàng là tuần tự.
- Có thể claim đồng bộ đa thiết bị dùng kênh thời gian thực trên nền WebSocket do nền tảng backend cung cấp, kết hợp tải lại theo chu kỳ làm lưới an toàn; **không** claim đã tự hiện thực giao thức WebSocket, và **không** claim kiểm soát được backoff/heartbeat của kết nối.
- **Không claim seam là tính năng.** Danh sách đầy đủ các phần có code hoặc schema nhưng chưa có entry point trên UI nằm ở mục "Seam: Có Code Nhưng CHƯA Dùng Trên UI" trong [features.md](features.md). Khi nhắc tới chúng phải dùng đúng chữ **chưa dùng trên UI** hoặc **chưa có entry point**, đưa vào chương hạn chế và hướng phát triển; không viết "đã hỗ trợ", "đã có" hay liệt kê trong bảng chức năng.
- Có thể claim màn lịch sử đơn hiển thị số thứ tự theo bộ lọc và **cố ý không hiển thị số bill**, vì số bill chỉ duy nhất trong phạm vi một ngày kinh doanh; trình bày đây là quyết định thiết kế, không phải hạn chế.

## Artefact Còn Cần Bổ Sung Ngoài Nhánh Docs

- File Word theo mẫu của trường, trang bìa, thông tin sinh viên/giảng viên và quy định định dạng.
- Screenshot mới từ `main@c7f2f4e`, sơ đồ kiến trúc/ERD đã render và hình minh họa demo.
- URL deployment live, ngày kiểm tra, cấu hình môi trường đã che secret.
- Tài liệu tham khảo học thuật/chính thức cho React, PostgreSQL, Supabase, realtime, RLS và kiến trúc.
- Kết quả khảo sát người dùng hoặc benchmark nếu báo cáo yêu cầu; repository hiện chưa có dữ liệu này.

## Checklist Trước Khi Viết Word

- Chốt baseline main/docs và ghi ngày.
- Chỉ đưa tính năng `Đã triển khai` từ [requirements.md](requirements.md).
- Dẫn các tính năng hoãn sang chương hướng phát triển, không mô tả như chức năng hiện có.
- Dùng [testing.md](testing.md) làm nguồn duy nhất cho số liệu baseline kiểm thử.
- Chuyển evidence kỹ thuật thành mô tả thiết kế; không sao chép code, đường dẫn file, symbol, commit, migration hoặc lệnh terminal.
- Chụp lại UI/diagram theo checklist và lưu trong artefact báo cáo riêng.
- Rà lại deployment URL và cloud migration trước ngày nộp/bảo vệ.
