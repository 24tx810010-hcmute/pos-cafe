# Review — Supabase chỉ đọc cục bộ, 07/10/2026

## Candidate và phạm vi

Biên bản này chỉ ghi metadata/finding/verdict của review, được loại khỏi candidate để không tạo review đệ quy. Nội dung thực chất đã đóng băng trong manifest/snapshot; không coi chỉnh metadata là quyền sửa candidate.

Candidate cuối: [candidate-2.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/candidate-2.json), SHA256 `ac820fa8750704c7b0cf290001feeeba386f1359d2531d8f61321f09cbdfecd5`; snapshot31 file cùng artifact root. Source gồm bốn script local không có secret, test/config subset/receipts/ảnh metadata và sáu tài liệu trên worktree `docs`. Loại trừ raw global config, backup, CLIXML credential và private input status/process state. Ảnh Dashboard có fragment token đã mask theo UI; JSON provider không ghi fragment hoặc credential value.

| Reviewer | Phạm vi | Verdict cuối |
| --- | --- | --- |
| `pat_setup_security_review` | Nhập/lưu PAT, path/ACL/DPAPI, không rò credential, human authorization/thu hồi và tính đúng hồ sơ | **APPROVE c2**, exact hash trên |
| `pat_transport_review` | Pin/credential precedence, read-only probe/helper, bằng chứng runtime/config và giới hạn fresh CLI/Desktop/product | **APPROVE c2**, exact hash trên |

**Cả hai reviewer bắt buộc đã APPROVE c2** trong phạm vi của mình. Đây là review gói local PAT/direct transport; không chứng nhận fresh CLI/Desktop, email/visibility hoặc product release.

## Kết quả bảo mật

- Verdict thực tế: **APPROVE** `supabase-local-mcp-setup-20261007-c2`, exact hash manifest trên; không còn finding cần sửa trong scope.
- Tự kiểm31 entries/62 hashes source-snapshot; delta c1→c2 chỉ provider JSON.7 scripts parse không lỗi;9 counterexamples cú pháp với dữ liệu giả đạt.
- Review PasswordBox/SecureString, DPAPI ngoài repo, ACL/reparse/owner, Move không overwrite, argv/status/error không chứa secret; đối chiếu ảnh actual scope và list sau Delete với nguồn human authorization.
- Intake3/direct MCP PASS có receipt và source binding; docs phân biệt CLI/Desktop còn chưa kiểm. Không đọc credential/raw config/backup/clipboard/live UI, không chạy whole security script/gọi mạng.

## Kết quả transport

- c1 `0c41caa6402ab31551c8b342369d740ab80a8251686ce34d951bbf1ca9cea437`: **CHANGES_REQUESTED**, duy nhất câu `credentialValueOrMaskedPrefixExported=false` chưa phân biệt JSON với ảnh Dashboard.
- Tác giả sửa đúng receipt: `credentialValueOrMaskedPrefixInThisJson=false`, `screenshotsContainMaskedTokenFragments=true`; các script/docs/test/result không đổi. Snapshot c1 được giữ, c2 freeze lại31 file.
- c2: reviewer tự đối chiếu31 entries/62 hash source-snapshot khớp; xác nhận delta wording. Trước đó AST-only parser kiểm độc lập6/6 PASS. Kiểm full CLI pin/precedence, HTTP fixed readonly query/error whitelist, live receipt/ảnh scope/thu hồi, docs và giới hạn.
- Verdict thực tế: **APPROVE c2**. Chưa xác minh fresh CLI/Desktop MCP, product gate/release. Không đọc credential/config raw hoặc gọi network/mở host/UI trong review.

## Finding lịch sử đã xử lý

- Regex `$` nhận LF cuối: đổi `\A...\z`, thêm boundary checks.
- Launcher chỉ pin enabled: đổi full object override, kiểm parser không gọi mạng.
- Guard hex40 phân loại Legacy sai: rút guard, kiểm cú pháp transport và metadata actual riêng.
- Alphabet/minimum token suy đoán: chuyển RFC6750 alphabet và ghi rõ giới hạn local.
- Receipt bị MessageBox giữ đến cuối: ghi safe receipt/dispose secret trước MessageBox.
- Câu bảo toàn byte quá mức và link handoff: sửa thành giữ nội dung section, link log đúng.
- Probe lần1 parse chưa nhận constant: helper JSON/text depth giới hạn, isolated11 cases và live retry PASS.

Nguồn đề bài, quyết định, test và giới hạn: [log kỹ thuật](../implementation-log/supabase-local-mcp-setup-2026-10-07.md), [handoff](../workflow/tasks/supabase-local-mcp-setup-2026-10-07.md).

## Đối chiếu cuối của tác giả

[Author check c2](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/author-check-candidate-2.json):31 source/snapshot khớp, chỉ JSON receipt đổi so c1; syntax và link inputs không đổi,7 scripts parse0 lỗi và138 local links không thiếu. Kiểm cuối sau ghi metadata review tiếp tục đối chiếu exact source/snapshot; metadata review/author receipts được loại khỏi candidate theo quy tắc tránh đệ quy. Tài liệu vẫn chưa commit/publish; không sửa application hoặc triển khai sản phẩm.
