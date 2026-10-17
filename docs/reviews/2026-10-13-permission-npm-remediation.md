# Review remediation npm — 13/10/2026

**SEC rồi EVC cùng APPROVE phạm vi bản vá tương thích và bàn giao kiểm chứng local. Phát hành vẫn BLOCKED.** Không có finding chặn; EVC không có đề xuất không chặn.

Candidate [candidate-01.json](D:/Workspace/pos-cafe/artifacts/permission-npm-final-20261013/candidate-01.json), SHA256 `7d3aa43aa600ba98d1422fe80d4f9661a6a043905890b7df26bee96b5681b03c`. Cả hai reviewer kiểm cùng candidate, không chỉnh sửa giữa hai lượt. Source34 fingerprint `a711636bf2f9f357d37129603befb6ef388c64b9011156c87705f9c1fe9a2b43`. [Biên bản và cách chạy lại](../implementation-log/permission-npm-remediation-2026-10-13.md), [handoff](../workflow/tasks/permission-npm-remediation-2026-10-13.md).

## SEC — /root/sec_review_final

**APPROVE phạm vi remediation local + bản vá tương thích. Không phải chấp thuận phát hành.** Không có finding chặn.

Kiểm độc lập hash candidate,2753entries/snapshots,812source entries,1093private evidence files; inventory exact-set đúng metadata-only/refetch; TC02 đúng restricted precondition và giữ cache/DOM/zero-RPC/focus/history/DB assertions. Diagnostic raw có12HTTP200 normal trước COMMIT và0restricted. Reviewer lưu ý oracle này không chứng minh mọi khoảng chuyển tiếp sau COMMIT; hồ sơ không nhận phạm vi đó.

Đối chiếu30direct và378package/version giữa hai lock,11npm deltas/11pnpm direct alignment;673candidate và672legacy installed manifests không drift. Audit exit1 với7findings/2root advisories, không miễn rủi ro vì dev dependency. Kiểm shim T02 thực thi native theo allowlist, legacy lock bằng git blob đúng commit, discovery parity và overlay configId. Kiểm10DB/Storage archives trước mutation,2output archives, permissions600/root700, canary transition guard, cleanup/keeper và credential-pattern scan; chỉ gặp chuỗi giả trong test từ chối/redaction.

Giới hạn: read-only, không chạy lại suite/mutation/restart/deploy; full matrix giao EVC. Không audit lại toàn bộ implementation preexisting, không chứng minh cloud equality. [Structured SEC](D:/Workspace/pos-cafe/artifacts/permission-npm-final-20261013/review-sec.json).

## EVC — /root/evc_review_final

**APPROVE — phạm vi bàn giao LOCAL remediation và compatible patch. Không phải approval phát hành.** Không finding chặn hoặc đề xuất không chặn.

Kiểm độc lập2753entries/snapshots,1093private files,tar810files+2deletion markers,Windows/Linux source drift0, fingerprint/HEADs. Kiểm673installed manifests/installed lock,3VITE tuple/bundle/response hashes/154distfiles,80receipt/log hashes. Logs thực: npmci/build/unit1173/expanded306/inventory7/focused110/2tsc; UI selftest23 rồi16×3, đã xem4ảnh và xác nhận6false positives baseline.

Đối chiếu PIN testplan/traceability với executable matrix:55browser=48+7TC18,41SQL,1canary,2operator,strict0skip/retry/expected-failure; TC18 có20scenarios/48scan/control deleted. Tự tái dựng27PERM records bằng collector chỉ đọc và verifier trong bộ nhớ:full valid60cases/726required variants/errors0;10candidate-phase observations đúng source/run/profile/time; không overlap, khớp full-evidence. Không chỉ dùng tổng số để suy coverage.

Kiểm parity overlay, đúng attestation configId, legacy672manifests là fixture riêng;2private output archives và11fixture-preservation archives đọc được/hash đúng; cleanup/keeper và lịch sử failed attempts được ghi trung thực. Giới hạn: không rerun suite/mutation/reset/restart; không audit toàn bộ code có trước hoặc xác nhận cloud runtime/env equality. [Structured EVC](D:/Workspace/pos-cafe/artifacts/permission-npm-final-20261013/review-evc.json).

## Kết luận bàn giao

Gate bàn giao local đạt sau hai APPROVE exact SHA trên. Chỉ bổ sung metadata verdict sau freeze, giữ nguyên snapshot nội dung đã review. Điều này không đóng gate phát hành hoặc CLOSE3: audit còn7findings (5high/2moderate), user chọn giữ Tailwind3 và chờ upstream, chưa chấp nhận residual risk. Cloud build NOT_RUN, next-cloud runtime/env UNKNOWN; STOP trước mục2 live backup/quiescence/rehearsal/cutover. Không push/deploy/hosted mutation. Walkthrough đã cung cấp; chưa có xác nhận owner đã đọc/hiểu.
