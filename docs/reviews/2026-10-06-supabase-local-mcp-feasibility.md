# Review đánh giá Supabase MCP cục bộ — 2026-10-06

## Candidate và phạm vi

[Hồ sơ](../implementation-log/supabase-local-mcp-feasibility-2026-10-06.md) là phân tích cơ chế kết nối và giới hạn riêng tư, không triển khai cấu hình hoặc chứng minh PAT hoạt động. Candidate/snapshot/hash ở [review-candidate.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-feasibility-20261006/review-candidate.json). File review này chỉ ghi metadata/verdict thực tế, không nằm trong candidate nội dung để tránh review đệ quy.

## Review độc lập

Hai phạm vi bắt buộc theo [workflow](../workflow/README.md#review-doc-lap):

- `/root/supabase_mcp_feasibility`: tài liệu provider/PAT/MCP/skills, permission mapping và tính khả thi; không sửa candidate hoặc chạy live mutation.
- `/root/codex_mcp_privacy_review`: tài liệu/client schema/local receipts, Remote/Windows storage và giới hạn privacy/ủy quyền; không sửa candidate hoặc deploy.

Candidate SHA256: `7b6be0286c0ee4b5037220853d75bd3d1b05bdafa69ba0fbb2d094ba2c8a0f4d`; gồm5 file nội dung,5 snapshot và2 receipt. Hai reviewer xác nhận explicit **APPROVE** đúng candidate này; không kế thừa nghiên cứu hoặc approval slice khác.

| Reviewer | Verdict và kiểm tra thực tế | Giới hạn |
| --- | --- | --- |
| `/root/supabase_mcp_feasibility` | **APPROVE**; đối chiếu5 doc/current+snapshot và2 receipt hashes; PAT/project scope, permission mapping, read-only/features, optional skills và default installer phù hợp primary sources. Không actionable finding. | Chỉ analysis/docs; không xác nhận PAT thật, không cho phép setup/deploy hoặc nhận task sản phẩm phát hành. Không sửa file/live provider/auth/browser/install trong review. |
| `/root/codex_mcp_privacy_review` | **APPROVE**; đối chiếu5 doc/current+snapshot,2 receipts, HEAD/binary/config; giới hạn schema vs runtime, hash Remote mới, env storage, account/model-data/email, phạm vi field/token và ủy quyền. Không finding chặn hoặc đề xuất không chặn. | Không xác nhận PAT/effective permissions, initialized MCP, actual Remote/pairings, visibility/email, provider inventory hoặc gate ứng dụng. Không review lại lịch sử cũ. |

## Kiểm tra tác giả và bàn giao

[author-verification.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-feasibility-20261006/author-verification.json), SHA `f0c2ab5e9dfa48f0a0c9a8f680f29175a375bce0a293a34fba1882e50d0a6ea6`, lúc `08:56:15Z`:5 docs/current+snapshot và2 evidence hashes khớp;116 local links có target; hash user config giữ nguyên `5b4087bc…`. Đây là đối chiếu file, không test ứng dụng/runtime.

Phép đối chiếu thêm706 đường dẫn với manifest guard cũ phát hiện **2 file khác**: `src/features/integration/useRealtimeInvalidation.ts` và `src/features/integration/useRealtimeInvalidation.test.tsx`. Lệnh kết hợp exit1 vì mismatch này; giữ receipt, không đổi thành toàn bộ PASS. Slice này không sửa hoặc hoàn nguyên hai file; không kết luận fingerprint ứng dụng cũ `30dd5664…` còn hợp lệ. Reviewer phạm vi Codex đã nhận finding ngoài scope và giới hạn approval tương ứng. Gate hash/link của candidate analysis vẫn khớp; gate sản phẩm phải dùng source hiện hành khi tiếp tục.

**Hoàn tất phạm vi xác minh/đánh giá tài liệu và local schema.** Chưa chọn hoặc áp dụng phương án; chưa kiểm PAT/MCP thật, email, account visibility/Remote hoặc provider inventory. Docs còn local trên nhánh `docs`, chưa commit/publish. Không tạo secret/cài/chỉnh config/env/login/deploy/cleanup; sản phẩm phân quyền chưa hoàn tất/phát hành. Nội dung candidate không đổi sau hai APPROVE; phần thêm ở đây chỉ ghi metadata verdict/verification thực tế theo workflow.
