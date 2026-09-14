# Review UI độc lập cuối — phase 27, 2026-09-14

Đã tìm và tái hiện ba điểm còn sót thuộc nhóm P2 ở initial submit, History reprint và History void. Root đã sửa; kiểm độc lập sau sửa không thấy blocker còn mở trong phạm vi dưới đây. Kết luận này không thay gate DB/E2E và không bảo đảm toàn bộ hệ thống không có lỗi.

Đã đọc `D:/Workspace/pos-cafe-docs/AGENTS.md`, `CLAUDE.md`, `openspec/SPEC-STANDARD.md` trước review. Không dùng kết luận/số test cũ làm bằng chứng. Không DB, MCP, reset fixture, migration, commit hoặc push từ reviewer này.

## Findings và cách tái hiện

| Mức | Vị trí hiện tại | Trước sửa: expected / actual | Cách sửa đã kiểm |
|---|---|---|---|
| P2 — đã xử lý | `src/app/drawers/pos/OrderDrawer.tsx:173` | Giữ `execute` đang chờ, renew session cùng object nhân viên hoặc offline→online, rồi trả `AUTH_REQUIRED`/`EMPLOYEE_SESSION_REQUIRED`. Expected: giữ phiên/draft, không toast hay revoke phiên hiện tại. Actual: logout, draft rỗng, revoke và toast cũ. 4 case lỗi thật thất bại, 2 positive current pass. | Capture lifetime trước mutate và kiểm ở cả success/error. 9 tracked cases pass. |
| P2 — đã xử lý | `src/app/drawers/admin/OrderHistoryDrawer.tsx:201` | Bấm in lại, giữ getOrder/getReceipt, đổi nhân viên hoặc offline→online, rồi trả lỗi auth. Expected: bỏ lỗi cũ. Actual: nhân viên mới bị logout, draft mất, revoke và toast. 8 case stale read tái hiện. | Catch kiểm `stillHere()`. Current auth errors vẫn xử lý. |
| P2 — đã xử lý | `src/app/drawers/admin/OrderHistoryDrawer.tsx:252` | Confirm void, đổi generation hoặc offline→online rồi trả lỗi/ACK. Expected: không toast/refetch màn cũ. Actual: cả 6 case chạy callback cũ. Khi đóng popup cũ rồi bắt đầu read xác nhận mới, settlement cũ còn có thể hạ `isVoiding` của read mới. | Success/error kiểm view + confirmation generation. Settlement dọn busy khi đúng generation; giữ dọn sau offline nhưng không chạm lượt read mới. Mutation chỉ bỏ guard settlement làm đúng oracle đọc mới thất bại. |

Các vị trí là code sau sửa; hành vi trước sửa được giữ trong `initial-submit-confirmed.json` và `history-confirmed.json`. Test reprint dùng lỗi qua port và component thật, không mock hook. Lỗi auth là fault injection tại read/execute; tính hợp lệ của mã lỗi server không được kiểm bằng backend thật trong subtask này.

## Kiểm tra đã chạy

Node **24.16.0**, Vitest/jsdom + memory adapter. Main HEAD **3ada48c0c9c494d9b34838fd3739bda6091e0bb9**, cùng các sửa chưa commit. Candidate trước/sau lượt cuối:

`69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6`.

| Lượt | Kết quả quan sát |
|---|---|
| Recovery oracle riêng + 40 regressions hiện hữu, candidate e8 | 52/52 pass; kết quả này có trước khi phát hiện initial submit còn sót. |
| Recovery memory mutation cho phép error cũ | 6 fail / 6 pass; cả 6 stale assertions phát hiện regression. |
| Recovery memory mutation bỏ mọi current error | 6 fail / 6 pass; current controls bắt được việc bỏ xử lý lỗi. |
| Initial submit trước sửa, oracle độc lập | 4 fail / 2 pass. |
| History trước sửa, xác nhận lại với detail-ready | 14 fail / 6 pass. |
| Submit + History sau sửa | 30/30 pass: 9 submit + 21 History. |
| Lượt cuối: 40 regressions cũ + 30 tracked mới + 12 recovery oracle riêng | **82/82 pass**, 0 pending/todo/runner errors. |
| Initial submit memory mutation bỏ stale guard | 6 fail / 3 pass. |
| Initial submit memory mutation bỏ current error | 2 fail / 7 pass. |
| History memory mutation bỏ read/action stale guards | 15 fail / 6 pass. |
| History memory mutation chỉ bỏ settlement generation guard | 1 fail / 20 pass, đúng `transition=reopen_confirmation/result=late_error`. |
| History memory mutation bỏ current error/action callbacks | 5 fail / 16 pass. |

Mọi mutation chạy bằng Vite `enforce: pre`, biến đổi source trong memory của worker; không sửa source trên đĩa. Negative controls trả exit 1 vì assertion thật thất bại, không dùng `test.fails`, skip, retry hay expected-failure trong gate. Config đặt `allowOnly:false`, `retry:0`. Các bộ JSON giữ tên case và failure để kiểm lại độ nhạy.

Lệnh chính (cwd `D:/Workspace/pos-cafe`):

```powershell
$env:FINAL_UI_TRACKED='1'
node node_modules/vitest/vitest.mjs run --config artifacts/final-ui-audit/vitest.config.ts artifacts/final-ui-audit/recovery.test.tsx src/app/writeHistoryLifetime.test.tsx src/app/writeInitialSubmitLifetime.test.tsx src/app/writeRecoveryAccess.test.tsx src/app/components/ReceiptPrintLifecycle.test.tsx src/app/writeRetryDraft.test.tsx src/app/writeSessionGeneration.test.tsx src/app/writeRecoveryActionLifetime.test.tsx --reporter=json --outputFile=artifacts/final-ui-audit/final-baseline.json

$env:FINAL_UI_MUTANT='initial-allow-stale' # hoặc initial-suppress-current
node node_modules/vitest/vitest.mjs run --config artifacts/final-ui-audit/vitest.config.ts src/app/writeInitialSubmitLifetime.test.tsx --reporter=json --outputFile=artifacts/final-ui-audit/initial-allow-stale.json

$env:FINAL_UI_MUTANT='history-allow-stale' # hoặc history-settle-unguarded / history-suppress-current
node node_modules/vitest/vitest.mjs run --config artifacts/final-ui-audit/vitest.config.ts src/app/writeHistoryLifetime.test.tsx --reporter=json --outputFile=artifacts/final-ui-audit/history-allow-stale.json
```

Mỗi lệnh thực tế chạy trong process PowerShell riêng; môi trường mutant không truyền sang gate root. `final-before.json` và `final-after.json` ghi fingerprint/hashes, `result.json` ghi SHA256 từng report và danh sách 30 tracked tests có TC-IDEM.

## Phạm vi và giới hạn

Đã đọc diff `WriteRecoveryDrawer`, `WriteLifecycle`, `useAppStore`, `useViewLifetime`, `ReceiptPreview`, `WriteAttemptNotice`, `OrderDrawer` và đối chiếu các test cache, retry/draft, print timer, same-object employee generation. Recovery key bao gồm store/employee/session, read cũ bị abort, lỗi quyền xóa data, in lại kiểm lifetime/access generation; các positive controls vẫn đọc/xử lý được. Hai test files mới được ghi theo phân công root sau khi kết thúc source freeze cũ; production source do root sửa.

Không cộng 12 oracle trong artifacts vào tổng gate chính thức. Không chứng minh SQL/RLS/TTL/race/rollback, runtime thật hay máy in từ các test memory này. Không sửa `pnpm-lock.yaml`.

`history-baseline.json` lần đầu có một lỗi setup vì bấm reprint khi detail chưa sẵn sàng; nó không được dùng làm bằng chứng finding. Đã sửa fixture đợi nút void có detail và tắt refetch-on-reconnect trong QueryClient của oracle để phân biệt read do callback với polling hợp lệ; `history-confirmed.json` mới là baseline 14 assertion failures/6 positive passes.

Không báo finding PRICE_CHANGED dựa trên mock `execute.reject(AppError('PRICE_CHANGED'))`: protocol chuẩn trả `OperationView rejected`; coordinator kiểm generation sau await trước khi flow chuyển rejected thành AppError. Không tự mở rộng thay đổi code từ một wire behavior chưa có chứng cứ.

Root cần hoàn tất full gate và xác minh SHA remote trước push. Review này chỉ chốt không còn blocker được tìm thấy trong phạm vi UI đã kiểm sau sửa.
