# Review — fresh Codex MCP host,07/10/2026

Metadata review được loại khỏi candidate theo quy tắc tránh đệ quy. Hai reviewer đã trả APPROVE độc lập trên exact candidate cuối; không đổi source/evidence sau freeze.

## Candidate cuối

- Candidate `supabase-fresh-host-20261007-c3`, [manifest](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/candidate-3.json), SHA256 `b2c79983dc2878bfc5d11262ef561d6de0967871c3fdc14de46a044b5b0332d0`.
- [Snapshot phục hồi](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/snapshot-candidate-3): 28 entries gồm tooling/evidence, hai dependency source không credential, stable protocol schemas và sáu docs. Raw credential/config/auth/backup/private state không nằm trong candidate.
- [Author check](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/author-check-candidate-3.json): 56 source/snapshot hashes khớp; năm script parse không lỗi; 138 local links tồn tại; live receipt PASS khớp exact harness hash. Chỉ static read, không chạy lại host/PAT/mạng.
- [Receipt review cuối](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/final-review-receipt.json) ghi verdict thực tế và phạm vi; metadata này cũng được loại khỏi candidate.

| Reviewer | Scope | Verdict cuối |
| --- | --- | --- |
| pat_setup_security_review | Credential isolation, startup/config/features/env/cleanup, human scope và hồ sơ | **APPROVE C3**; 28 entries/56 hashes khớp; AST guard thật13/13 PASS; runtime predicate loại các server khác chưa disabled; ba findings docs đã sửa |
| pat_transport_review | Protocol, host runtime proof/constant/parser/evidence và giới hạn | **APPROVE C3**; 28 entries/56 hashes khớp; guard/stream độc lập10/10 PASS; protocol và source-bound runtime receipts phù hợp |

## Finding và lịch sử sửa

1. Draft security review b0b8ca0... **CHANGES_REQUESTED**: case-insensitive env, preflight module/helper pin, exact tools, strict disabled-other-server/canonical cwd, remove StartInfo bearer. Tác giả đã sửa trước live; final review kiểm exact source `972d7a14bd8277a38b019eb7e99e0cd489262fbe07ac31011260dfa050480f11`.
2. [C1 manifest](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/candidate-1.json), SHA256 `bebb0238d6d67bb9ade3a8a785437e8016ff3316746f078dbf563cf325ad9cfc`: cả hai **CHANGES_REQUESTED** về timestamp start bị mô tả như completion. Security thêm hai finding: bound là ký tự UTF-16, và env filter chỉ gỡ những tên được liệt kê, không mọi bearer khác.
3. [C2 manifest](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/candidate-2.json), SHA256 `813422912389abdc1c8d7106e0a229f38f20751c8bd65c08a78b4812b8b8cd0e`: chỉ sửa log timestamp/UTF-16; không nhận là candidate được approve.
4. C3 chỉ sửa tiếp log cho env names cụ thể và biến khác vẫn inherited. Harness/runtime/test receipts không đổi; hai reviewer recheck source/snapshot và **APPROVE** C3. Các snapshot lịch sử giữ nguyên.

Reviewer không đọc PAT/raw config/private state, không chạy host/mạng hoặc ghi file. Synthetic checks đọc AST/class/predicate thật và không thực thi whole harness; không ghi đè receipt đã freeze. Live PASS dựa trên receipt gắn exact source, không nhận là reviewer tự chạy live lần nữa.

## Kết luận và giới hạn

Scope chứng minh fresh Codex app-server gọi MCP Database Read bằng PAT hiện có đã đạt; query chỉ `select 1 as pos_cafe_mcp_check`, không model turn, own child đã dừng. Guard test và hai reviewer không chứng nhận mọi OS process/log; Desktop đang mở/model-driven MCP, Edge/Storage/Vercel, gate ứng dụng và release vẫn chưa được xác minh trong scope này. Không bảo đảm email/visibility hoặc bí mật với chủ tài khoản dùng chung.

Docs/source chưa commit/publish. Walkthrough đã cung cấp trong log, chủ dự án chưa xác nhận đã đọc/hiểu. Scope nhỏ tiếp theo: inventory Edge/Storage chỉ đọc, giữ PAT Database Read hiện tại.

Nguồn: [log](../implementation-log/supabase-fresh-host-2026-10-07.md), [handoff](../workflow/tasks/supabase-fresh-host-2026-10-07.md).
