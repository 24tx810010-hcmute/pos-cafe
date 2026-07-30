# Thesis Report Source Map

Nhánh `docs` là **nguồn dữ liệu để viết báo cáo**, không phải bản Word hoàn chỉnh. Baseline current-truth được audit ngày **2026-07-30** theo `main@3d9b64a`.

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

- Có thể claim app có 15 bảng nghiệp vụ ở final migration state, 13 migration file theo chuỗi 001–013 và RPC transaction cho order/payment.
- Có thể claim local baseline ngày 2026-07-30 đạt 257/257 test và 34 mock smoke pass; phải giữ riêng evidence cloud.
- Có thể claim áp dụng Ports & Adapters theo hướng Hexagonal Architecture; không nên claim textbook hexagonal tuyệt đối.
- Có thể claim RLS cô lập store; không claim employee PIN là DB identity hoặc quyền per-employee chống client độc hại.
- Có thể claim online realtime invalidate/refetch; không claim offline hoặc SLA cứng ≤5 giây.
- Có thể claim cash payment và browser print preview; không claim QR processing hoặc máy in POS thật.

## Artefact Còn Cần Bổ Sung Ngoài Nhánh Docs

- File Word theo mẫu của trường, trang bìa, thông tin sinh viên/giảng viên và quy định định dạng.
- Screenshot mới từ `main@3d9b64a`, sơ đồ kiến trúc/ERD đã render và hình minh họa demo.
- URL deployment live, ngày kiểm tra, cấu hình môi trường đã che secret.
- Tài liệu tham khảo học thuật/chính thức cho React, PostgreSQL, Supabase, realtime, RLS và kiến trúc.
- Kết quả khảo sát người dùng hoặc benchmark nếu báo cáo yêu cầu; repository hiện chưa có dữ liệu này.

## Checklist Trước Khi Viết Word

- Chốt baseline main/docs và ghi ngày.
- Chỉ đưa tính năng `Đã triển khai` từ [requirements.md](requirements.md).
- Dẫn các tính năng hoãn sang chương hướng phát triển, không mô tả như chức năng hiện có.
- Dùng [testing.md](testing.md) làm nguồn duy nhất cho số liệu baseline kiểm thử.
- Chụp lại UI/diagram theo checklist và lưu trong artefact báo cáo riêng.
- Rà lại deployment URL và cloud migration trước ngày nộp/bảo vệ.
