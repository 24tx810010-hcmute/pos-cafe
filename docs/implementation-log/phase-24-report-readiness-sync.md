# Phase 24 - Audit current truth và chuẩn hóa nguồn báo cáo

## Mục Tiêu

- Đối chiếu toàn bộ root docs với `main@3d9b64a`.
- Sửa claim lỗi thời hoặc dễ overstate trước khi dùng làm nguồn viết báo cáo.
- Bổ sung requirements, testing, limitations và bản đồ nguồn cho báo cáo.
- Ghi đầy đủ phần redesign Employees Drawer trong commit `1b0098b` từng bị phase 22 mô tả thiếu.

## Trạng Thái

- Đây là **docs-only phase**, không thay đổi code ứng dụng hay database.
- Baseline code: `main@3d9b64a`.
- Baseline migration: 001–013; migration 013 đã được apply/verify trước lần audit.
- Audit và local verification thực hiện ngày 2026-07-30.

## Nội Dung Đồng Bộ

- Cập nhật overview/tech stack từ baseline cũ `7a00fd0` sang `3d9b64a`.
- Tách bằng chứng local, cloud E2E và PostgREST để không suy rộng mức kiểm chứng.
- Mở rộng phase 22 và root feature/screen docs cho Employees Drawer hai pane, filter theo role/trạng thái, status/PIN/quyền inline và các rule tự khóa/admin cuối.
- Phân loại lại scope đã triển khai, phần hoàn thiện tùy chọn và hướng mở rộng có lý do.
- Bổ sung ERD/cardinality rút gọn, migration ledger và cảnh báo migration 007 destructive/009 transitional.
- Sửa claim payment “mỗi đơn đúng một payment” thành invariant của app/RPC, không phải unique constraint DB.
- Diễn đạt realtime 5 giây là polling/target danh nghĩa, không phải SLA cứng.
- Mở rộng threat model: RLS cô lập store, không tạo security boundary per-employee.
- Ghi deployment ở mức configured/deployment-ready cho đến khi có URL/ngày verify live.

## Tài Liệu Mới

- [../requirements.md](../requirements.md)
- [../testing.md](../testing.md)
- [../limitations.md](../limitations.md)
- [../report-source-map.md](../report-source-map.md)

## Verification 2026-07-30

- `npm test`: **49/49 files, 257/257 tests pass**.
- `npm run build`: pass; còn chunk-size warning đã biết.
- `npm run smoke`: **34 passed, 31 skipped, 0 failed**.
- Kiểm tra Markdown link nội bộ và `git diff --check` được chạy sau khi hoàn tất chỉnh sửa.
- Không chạy lại `npm run smoke:supabase`; bằng chứng cloud gần nhất vẫn là 5/5 ngày 2026-07-19 và PostgREST migration 013 ngày 2026-07-27.

## Giới Hạn

- Phase này không tạo screenshot/diagram binary hoặc file Word.
- Không xác minh lại deployment URL/live environment.
- Các phase log cũ được giữ như evidence lịch sử; kết quả/gap cũ có thể đã được phase sau supersede.
