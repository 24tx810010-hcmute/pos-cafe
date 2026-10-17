# Review độc lập TC-PIN-18 — 11/10/2026

Candidate gồm [manifest/archive main, docs và receipt hash](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/source-fingerprints.json), base main `ef2c372aec60d8362549e47b7aedb27126129479`, docs `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Hai reviewer không sửa file, không deploy và không chạy chung DB. Phạm vi một người: canary/role/secret/operator; người còn lại: evidence/oracle/context/spec. [Biên bản thực thi](permission-pin-tc18-closeout-2026-10-11.md) ghi lệnh, môi trường và gate.

## Vòng 1 — candidate trước sửa review

| Reviewer | Phạm vi | Verdict | Finding chặn | Cách xử lý |
| --- | --- | --- | --- | --- |
| `tc18_security_review` | Security, canary, DB role/operator | `CHANGES_REQUESTED` | (S1) TC18 dùng JSON reporter có thể ghi lỗi chứa secret; (S2) `PERMISSION_UPDATE_UNAVAILABLE` bỏ requestId/PIN sau commit mơ hồ; (S3) `autocomplete=new-password` có thể mời password manager lưu PIN | Cấu hình `playwright.pin-tc18.config.ts` dùng duy nhất reporter redaction, chạy lại 7/7; UI giữ `pending` và cho thử lại cùng request, browser test mô phỏng server trả unavailable sau receipt rồi replay; PIN autocomplete off và runbook yêu cầu profile không lưu mật khẩu. |
| `tc18_evidence_review` | Evidence, testplan, docs/candidate | `CHANGES_REQUESTED` | (E1) thiếu lệnh/time/exit/env/hash phục hồi trong docs; (E2) raw JSON reporter còn trên đường tái chạy TC18 | Bổ sung ledger và command trong biên bản, fingerprint receipt ngoài archive, dedicated safe config. Ghi rõ lượt full-file TC13 timeout, lần safe reporter Realtime FAIL và lượt TC18 cuối PASS, không ghép thành full-file PASS. |

Đề xuất không chặn của reviewer evidence: bảng thông báo đã giải quyết còn ghi “cần quyết định” và PIN-D07 thiếu quyền sửa payload khác. Đã đổi thành bảng xử lý, thêm quyết định vào proposal. Chưa ghi `APPROVE` cho vòng 2 cho đến khi từng reviewer xác nhận đúng candidate mới. Không xem review là nghiệm thu của chủ dự án.

## Vòng 2 — exact candidate sau sửa

Hai reviewer xác nhận `APPROVE` độc lập trên main manifest SHA-256 `b253c8f0b1a431f152b2ada2569ac3275dbf60530aa4e9c2122738930a75c05c` và docs manifest SHA-256 `1d121500d328e5165c2a52b711d64ada47ee822dbc20537cccb18af42dc8dcd4`: `tc18_security_review` xác nhận S1–S3 đóng, `tc18_evidence_review` xác nhận E1–E2 đóng; cả hai tự đối chiếu hash file/archive, không sửa hay gọi DB. Gate sau sửa: TC18 safe reporter 7/7, operator real PG riêng 1/1, core 3/3, operator UI desktop/mobile 2/2, unit 110/1.170, build/typecheck; UI audit POS 16×3/0 mới còn phù hợp vì POS code không đổi. Lượt safe đầu bị Realtime timeout được ghi FAIL, ca riêng và lượt đủ cuối PASS; không lấy FAIL làm PASS.

Hậu kiểm cuối trước dừng: fixture zero, `tc18_*` function/trigger zero, membership `postgres → pos_owner_recovery` chỉ có grant gốc `supabase_admin` với `set_option=false`. Đã dừng **đúng 12 container** của `pos-cafe-perm-pin-onboard-20261009`, running 0; giữ `supabase_db_pos-cafe-perm-pin-onboard-20261009` volume và network cùng tên, tắt keepalive PID 43948 sau khi xác minh command. Không đụng ba stack `g2a/g2b/g2c` hay target khác. Đây là đóng TC18 kỹ thuật trên target cô lập; không là nghiệm thu của chủ dự án, CLOSE-1 toàn phần, hosted hay phát hành.

Metadata verdict và cleanup trong phần này được thêm sau khi reviewer duyệt candidate; không đổi code/test/spec/expected/bằng chứng đã duyệt. [Final docs snapshot](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/docs-final-source-manifest.json) giữ metadata này; `source-fingerprints.json` giữ cả hash docs được review và docs-final để tái hiện delta.
