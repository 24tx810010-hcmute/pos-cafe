# Phase 27 — Khắc phục F1 cache Tra cứu giữa phiên nhân viên

Ngày: 2026-09-10. Phạm vi chủ dự án yêu cầu: sửa F1, viết test và kiểm tra độc lập lại với hai subagent. Base code `main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9`; base docs `1bdddd8d92ddb7a619a08362e3a8490fd6dcfe12`. Bản sửa hiện ở working tree, chưa commit/push/deploy.

## Vấn đề và hành vi sau sửa

A có quyền xem K1 đã thanh toán 150.000 VND, khóa máy rồi C không có quyền đăng nhập. Trước sửa, query key không có phiên nhân viên và UI vẫn dùng data cũ sau refetch lỗi; C tiếp tục thấy payload/R1 dù get K1 trả FORBIDDEN. Lỗi nằm ở cache/render phía UI; DB vẫn từ chối ghi/đọc ledger trái quyền.

Sau sửa, query Tra cứu được tách theo storeId/employeeId/employeeSessionVersion; cùng một nhân viên đăng nhập lại cũng là phiên mới. Khóa/đổi phiên remove query và loại kết quả đang chờ. Drawer remount theo scope; cache không sống qua unmount. Khi server trả FORBIDDEN, AUTH_REQUIRED hoặc EMPLOYEE_SESSION_REQUIRED, list/detail/current data và các nút xử lý không còn được hiển thị. Tải lại chủ động sau đó tạo lần đọc mới theo quyền hiện hành.

Reviewer bảo mật phát hiện thêm callback In lại nằm ngoài Query: receipt được xác thực dưới A vẫn mở sau C đăng nhập hoặc sau denial. Bản sửa tiếp theo kiểm vòng đời và generation truy cập sau từng await, bỏ cả success/error cũ. Đây là phần cần thiết để F1 không còn đường lộ receipt qua phiên; chưa xử lý toàn bộ F2 ở nút print của ReceiptPreview.

Nguồn: `src/app/useAppStore.ts:56` (employeeSessionVersion), `src/app/WriteLifecycle.tsx:15` (remove query khi đổi phiên), `src/app/drawers/pos/WriteRecoveryDrawer.tsx:20` (scope), `:36` (denial/abort), `:89` (callback guard). Không đổi SQL, API, payload K, tiền hoặc quyền server; không đưa token vào query key hoặc storage.

## Test và kiểm tra độc lập

Thêm `src/app/writeRecoveryAccess.test.tsx`: 12 core/component cases. Thêm 3 browser cases tại `tests/supabase/idempotencyRecovery.spec.ts`. Tất cả thuộc TC006 với suffix riêng và được thêm vào `caseManifest.ts`; vẫn 93 TC gốc, required executions từ 669 lên 684. Giữ 102 cell DB của TC006, không nới expected/retry/skip.

Hai reviewer không dùng kết luận test của parent làm oracle:

- `cache_security_review`: tự viết 7 oracle component với mock adapter cho phiên/quyền/ledger; 2 oracle từng fail trên bản sửa đầu rồi pass sau guard. Kiểm cả khác nhân viên, cùng người đăng nhập lại, đổi store, late list/receipt/error, deny→Tải lại trước response cũ. Không dùng kết quả mock làm bằng chứng DB.
- `cache_runtime_review`: dùng browser với GoTrue/PostgREST/PostgreSQL thật; tự viết oracle same-A relogin sau revoke, server revoke employee-session khi detail đang mở và list HTTP200 cũ đến sau C đăng nhập. Chạy negative control bằng Vite override nội dung ba file F1 từ commit lỗi trong artifact riêng, không sửa tracked source; các oracle phải thất bại bằng assertion rồi đạt khi quay lại bản sửa.

## Runtime và giới hạn

Node 24.16.0, PostgreSQL 16.15, PostgREST 16.2, GoTrue v2.197.0 với Windows listener patch đã xác minh trong runtime phase 27. Cluster mới: `C:/Users/nguye/AppData/Local/Temp/pos-cafe-cache-fix-20260910`; DB `pos_cafe_idem_test_auth_7d0433b504c4`; API `http://127.0.0.1:55444`. Preflight requireBrowserStack và marker/API–observer binding đầu/cuối đạt. Reviewer runtime giữ lease độc quyền DB lúc chạy, sau đó trả lease để parent chạy gate tuần tự; không có hai suite reset cùng DB đồng thời.

Chưa kiểm cloud, Storage API, Realtime, máy in vật lý hoặc tải sản xuất. Không chạy smoke:supabase hay dùng .env.local làm môi trường DB. Migration014–016 chưa deploy thật. Giữ nguyên pnpm-lock.yaml có sẵn (SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`).

## Trạng thái kiểm chứng

**F1 đã được xử lý và kiểm chứng trong phạm vi đã kiểm.** Gate cuối: 560 unit/component + 415 DB contracts + 37 tooling + 37 E2E = **1.049 pass**; discovery và verifier xác nhận **684/684 required**, không thiếu/skip/retry/flaky. Cả bốn stage cùng fingerprint trước/sau `7e006793780d39218b28712db96bbbe62e4d9e4901ac1bb1cc504a1fec9deeca`; hash ba file triển khai trùng bản cả hai reviewer đã đọc/chạy. Build TypeScript/Vite đạt, còn cảnh báo chunk lớn. Không chạy lại coverage hoặc mock smoke trong lần sửa này và không dùng số cũ làm kết quả mới.

[Bằng chứng cuối và 15 execution F1](phase-27-f1-evidence/verification.md), [review bảo mật](phase-27-f1-evidence/reviewer-security.md), [review browser/runtime](phase-27-f1-evidence/reviewer-runtime.md). Hai reviewer có tổng 7 oracle component và 3 oracle browser riêng ngoài manifest; không cộng vào 1.049 pass gate. Reviewer runtime có 2 assertion thất bại trên source trước sửa rồi đạt sau khôi phục bản sửa, chứng minh oracle nhạy với lỗi. Một lượt review trước khi tooling assertion đổi chỉ được ghi là tiến độ; gate cuối được chạy lại sau khi source ổn định.

F2 phần print muộn còn lại, F3 số JSON nguyên dạng thập phân, F4 draft sau retry create và F5 độ đầy đủ oracle/gate vẫn mở. Chỉ đóng F1; không suy việc sửa F1 thành nghiệm thu toàn phase hoặc đủ điều kiện rollout.


Cập nhật2026-09-11: trạng thái F2–F5 mở phía trên là lịch sử của lần chỉ sửa F1. Các finding này đã được xử lý trong [lần bổ sung tiếp theo](phase-27-p2-fixes.md), với gate mới1123pass/758required và giới hạn riêng.
