# Audit độc lập gate và oracle trước push — 2026-09-14

Reviewer: `final_gate_audit`. Đã đọc AGENTS.md, CLAUDE.md và SPEC-STANDARD trên worktree docs. Reviewer tự đọc source/diff, tự viết oracle PaymentDrawer trước sửa, chạy lại sau sửa và chạy mutation trong bộ nhớ. Reviewer không chạy DB suite, reset fixture, gọi MCP production, commit hoặc push; các DB/E2E gate do root chạy tuần tự, reviewer kiểm trực tiếp JSON/options/provenance bằng parser riêng.

## Kết luận

**Bằng chứng của lượt gate cuối hợp lệ: 1.183 passed, đủ 818 execution bắt buộc từ 93 TC gốc**, trên working candidate `69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6`, base main `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`. Không lấy số liệu 1.034 hoặc 1.123 cũ làm bằng chứng candidate này. Chưa phát hiện finding nghiệp vụ mới còn mở trong phạm vi source/oracle reviewer kiểm sau khi các callback đã được sửa.

**Còn giới hạn ổn định test:** cùng candidate từng có một E2E `TC-IDEM-068/e2e/terminal=rejected` timeout 45 giây. Lượt diagnostic riêng và lượt chạy lại toàn bộ 47 E2E đều pass, nhưng chưa xác định nguyên nhân lần timeout đầu. Vì vậy PASS ở đây xác nhận cấu trúc/nội dung bằng chứng của lượt cuối, không chứng nhận rằng chưa từng có flaky failure hoặc hệ thống không còn mọi rủi ro. Không được gọi timeout này là “đã sửa nguyên nhân”.

## Finding P2 PaymentDrawer được phát hiện và xác minh sửa

Vị trí trước sửa: `src/app/drawers/pos/PaymentDrawer.tsx:212`, onError gọi notifyUiError mà không kiểm vòng đời. Sau sửa, captureView tại dòng41, chụp isCurrent dòng193, guard onSuccess dòng198 và onError dòng217.

Tái hiện: bấm thanh toán toàn bộ/tách đơn, giữ response execute; đổi thế hệ đăng nhập cùng employee object hoặc offline rồi online; trả AUTH_REQUIRED/EMPLOYEE_SESSION_REQUIRED cũ. Expected: giữ phiên, draft và màn hiện tại; không toast/revoke từ lỗi cũ. Actual trước sửa: null employee, draft bị xóa, drawer đóng và revoke phiên hiện tại. Với applied ACK đến muộn, business rows vẫn chỉ có một hiệu ứng, nhưng callback cũ phát toast WRITE_RESULT_UNKNOWN.

Oracle thực chạy trước sửa: **6 PASS, 12 assertion FAIL**. Sau root thêm guard: **18/18 PASS**. Mutation chỉ bỏ guard onError qua Vite transform, giữ nguyên expectation và source trên đĩa: **12 assertion FAIL, 6 positive PASS**. Không có compile failure/timeout được tính làm mutation kill. Chi tiết, commands và hashes: `PAYMENT-REVIEW.md` cùng thư mục. Tracked test: `src/app/writePaymentLifetime.test.tsx`.

Reviewer cũng đọc diff guard lần gửi đầu trong OrderDrawer và đọc lại reprint/confirmVoid trong OrderHistoryDrawer. Các hook vẫn invalidation dữ liệu server; guard chỉ chặn callback UI hết vòng đời. History dùng voidGeneration riêng để completion của lượt cũ không mở khóa một lượt đọc xác nhận mới; test reopen_confirmation có oracle cụ thể cho trạng thái busy. Không sửa hoặc làm yếu production trong lượt reviewer.

## Đếm trực tiếp report cuối

Lệnh root trong `artifacts/release-final-20260914/commands.json`; Node **24.16.0**. DB **pos_cafe_idem_test_auth_c5b5ce76d5d3**, engine **postgres-postgrest-gotrue**, PostgreSQL **16.15** trên Ubuntu24.04.4/WSL2, PostgREST16.2, GoTrue2.197.0 build Linux từ upstream commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`, không Windows patch. Browser mode Supabase, API `http://127.0.0.1:55444`; server mới, reuseExistingServer=false. Marker/API–observer binding được root preflight và postflight; reviewer đối chiếu các bản ghi, không tự gọi DB để tạo quan sát thứ hai.

| Lệnh | Đếm từ từng assertion/attempt |
| --- | --- |
| `npm run test:idempotency:discover` | 1.183 discovered, đủ 818 required, 93 base |
| `npm run test:idempotency:unit` | 637 passed, 637 options attestations hợp lệ |
| `npm run test:contracts` | 462 passed, 462 options attestations hợp lệ |
| `npm run test:idempotency:tools` | 37 passed, 37 options attestations hợp lệ |
| `npm run test:idempotency:e2e -- --reporter=./artifacts/release-wsl/step-reporter.mjs,json` | 47 passed, 47 attempts, retry=0, expectedStatus=passed |
| `npm run test:idempotency:verify-results` | 818/818 required |
| `npm run build` | exit0, cùng candidate |

Suffix E2E chỉ thêm reporter quan sát bước. Reviewer đọc file: chỉ ghi category/op/line/duration/error vào JSONL, không sửa event, result hoặc source. Không đổi testMatch, filter, timeout hay retry. SHA reporter được ghi trong `audit.json`.

Parser độc lập tại `audit.mjs` không import `resultVerifier`, `checkResults`, parser discovery hoặc helper fingerprint của dự án. Kiểm từng assertion gồm status, failureMessages, duration, thời điểm; từng module/suite, global errors, totals; mọi Vitest option kể cả test không có TC-IDEM; mỗi E2E attempt/expectedStatus/annotations; số lần thử; file/backend thực; tên discovery và tên chạy; uniqueness và completeness của required executions. Cả 4 metadata đều cùng raw candidate, exit0, đúng report hash và options hash.

Không pending/todo/skipped/fails/only/retry/repeats/flaky/expected-failure trong lượt gate cuối. Lượt root chạy test fixture DB, tooling có DB positive và E2E không chồng thời gian. Postflight `postflight.json` lúc03:48:57UTC khớp candidate cuối và đủ16 migration checksums. Giữ preflight cũ e8 riêng, không sửa nó để giả thành bản mới.

## Kiểm âm tính của chính auditor và độ nhạy oracle

Reviewer tự chạy:

```
node artifacts/final-gate-audit/audit.mjs artifacts/release-final-20260914 69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6 818
node artifacts/final-gate-audit/checker-controls.mjs artifacts/release-final-20260914 69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6 818
node artifacts/final-gate-audit/mutation-audit.mjs
node artifacts/final-gate-audit/secret-scan.mjs
```

Auditor nguyên bản exit0. **9/9 semantic controls bị từ chối**: bỏ required case; options fails, only, retry; metadata source cũ hoặc đổi source giữa run; chuyển contract sang file core; skip test unit không gắn TC; thêm browser retry. Các bản sao report đã được tính lại hash khai báo, nên đây là kiểm semantics chứ không chỉ phát hiện checksum khác. Không sửa source hoặc DB. `checker-controls.json` lưu từng outcome; bản chính audit.json được phục hồi về kết quả bundle không chỉnh sửa.

6 mutation bắt buộc mới của memory adapter được parse raw baseline/mutant và đối chiếu source hash: always_pending, always_reject, duplicate_payment, reprice_old, drop_option_qty, replay_current. Từng baseline chọn đúng một oracle passed, mutant có đúng một AssertionError; source mutant khác đúng file mục tiêu và original hash khớp candidate. Đây là mutation memory adapter, không gọi nó là SQL evidence.

Lịch sử SQL cũng được kiểm raw: F3 ngày11/9 baseline46pass, 8 decimal cases fail `RPC_ERROR:22P02` khi thay helper bằng bản gốc, sau restore46pass; F5 receipt qty1 thay2 gây2 AssertionError, sau restore2pass. Các case không chọn của targeted run được ghi deselected, không cộng pass. Reviewer đọc script restore nhưng không thể tái quan sát DB lịch sử đã dừng. Không cộng các lượt targeted/mutation/history vào1.183. Chi tiết `mutation-audit.json`.

## Các lượt thất bại và rerun được giữ riêng

- Runtime Ubuntu mới thiếu alias timezone Asia/Saigon. Lượt contract e8 đầu:427pass/35fail; root chẩn đoán log PostgreSQL, cài tzdata-legacy từ apt signed, không đổi fixture timezone hoặc SQL để né lỗi. Lượt thất bại giữ ở `artifacts/release-wsl/failed-attempt-1`.
- Tooling e8:36pass/1fail do assertion tổng TC006/core vẫn mong12 dù đã thêm4 current-error positives. Root sửa thành cache12, recovery4, rồi tách riêng initial/payment/history; DB102 và E2E3 giữ nguyên. Đây là sửa assertion đếm sai, không bỏ oracle. Candidate đã đổi và toàn bộ gate được chạy lại.
- Candidate69ffe có E2E46pass/1timeout. Report/meta/error-context gốc giữ tại `artifacts/release-wsl/69ffe-e2e-failure`. Stack ở finally fresh.close có thể che nơi timeout ban đầu; screenshot là page fixture cũ với phiên đã hết hạn sau dịch clock3ngày, không đủ kết luận context mới login lỗi. Diagnostic riêng pass8.139s, full-suite rerun case rejected pass2.659s. Nguyên nhân timeout đầu chưa biết. Không chỉnh assertion/timeout hoặc bật retry để chạy lại.

## Coverage, smoke và mapping Git

Reviewer cộng lại **27 file** coverage: **748/804 dòng, tool báo93,03%**, khớp total JSON. Lượt coverage637testpass cùng candidate, đo core/pure features; không đại diện SQL, hooks, JSX hay adapters. Mock smoke riêng: **35pass, 31skipped**, 0 unexpected/flaky; không thuộc gate818 và không cộng vào1.183. `extra-audit.json` ghi counts và hashes; không dùng92,53%/92,78% cũ cho candidate cuối.

`core.autocrlf=true`: raw working fingerprint là69ffe…; projected Git clean-content fingerprint **02046f390831d1e141684cc204d90214fea37910f316bc556e54905412dbb24f**. Reviewer tính Git blob qua clean filter từng file không ghi object/index:459paths,183 chỉ đổiCRLF→LF; không có chuyển đổi filter không giải thích được. FileMapping trong audit.json dùng kiểm staged blobs trước commit. Không nói một checkout LF mới có raw hash giống byte Windows đã test.

`pnpm-lock.yaml` giữ SHA256 **86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996**, loại khỏi fingerprint theo harness và phải tiếp tục ngoài commit. Những test mới untracked phải stage cùng source; các chỉnh sửa docs ngoài phase27 phải để ngoài phạm vi push.

`caseCatalog.json` dùng `plannedFiles` từ kế hoạch cũ;497 expanded entries không trùng file hiện chạy. Ví dụ TC001/db dự kiến writeConcurrency nhưng thực hiện writeOperations; TC005 ngược lại; một số mock chỉ ghi fileDB dự kiến. Đây không phải497 test thiếu. Docs testplan đã có “Nơi hiện thực” riêng; audit dùng file/backend thực từ report và discovery. Các regression mới có plannedFiles chính xác và được auditor kiểm chặt. Không dùng catalog path cũ để chứng minh nơi hiện thực hiện tại.

Pattern scan phase27 docs/spec và bundle cuối:69file tại lượt đầu sau gate, không match JWT/private key/PostgreSQL URL chứa password/Supabase token/GitHub token. Chỉ in path/category nếu có; không dump values. Root có thể bổ sung docs/evidence sau lượt này nên cần quét lại khi đóng gói cuối.

## Giới hạn kết luận

Không kiểm tải production, Storage API, Realtime, máy in vật lý hoặc phiên bản app đang triển khai. Không có quan sát DB/Supabase production của reviewer này; live catalog thuộc báo cáo MCP riêng. Hash đầu/cuối phát hiện thay đổi tồn tại sau run, không chống một thay đổi rồi hoàn nguyên giữa run hoặc giả mạo có chủ ý của runner. Metadata không có chữ ký mật mã. PASS bằng chứng không tương đương bảo đảm không còn mọi lỗi; đặc biệt timeout E2E chưa giải thích phải tiếp tục được công khai.
