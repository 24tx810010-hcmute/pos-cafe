# Tasks

- [x] Khảo sát catalog live chỉ đọc và current shared guard, giữ source hiện có.
- [x] Ghi PGCG-D01 từ câu “ok” của chủ dự án ngày 06/10 và spec/design/testplan/traceability của slice.
- [x] Hai reviewer APPROVE spec candidate trước implementation.
- [x] Dựng clone owned từ volume nguồn offline/read-only; pin binary/profile và kiểm native flags absent.
- [x] Chứng minh exact prepare/restore và image fragment rollback trên profile provider bằng actor postgres.
- [x] Điều chỉnh shared guard theo bằng chứng; thêm focused tooling/security tests và runtime runner tái hiện trên main.
- [x] Chạy tooling/syntax và runtime positive/negative cùng source mới; giữ artifacts/failure lịch sử.
- [x] Đồng bộ docs/handoff/report-source-map, hai final reviews APPROVE code/evidence/docs, đối chiếu final hashes.
- [x] Dừng dịch vụ owned, lưu hồ sơ/volume và hướng dẫn đọc code; tương tác walkthrough chờ chủ dự án.

Kết quả và final review theo [implementation log](../../../docs/implementation-log/permission-provider-capability-guard-2026-10-06.md) và biên bản liên kết; final review checkbox chỉ cập nhật khi có verdict đúng candidate.

Nếu runtime/profile không đủ, dừng phần guard acceptance phụ thuộc và ghi hạn chế; không bỏ case hoặc thêm native quyền để nhận provider PASS. Hai review spec/code là gate slice, không thay final product release review hoặc cho phép deploy live. Kênh management và full product gate là phần tiếp theo trong bàn giao phân quyền, không tự nối sau slice này.
