# Phase 27 — Hậu kiểm trước push

Ngày 2026-09-13. **Chưa commit/push: gate DB/E2E của candidate mới BLOCKED bởi môi trường Windows.** Chủ dự án cho phép push code/docs với điều kiện không còn vấn đề chưa xử lý; điều kiện kiểm chứng chưa hoàn tất.

## Finding P2 bổ sung và bản sửa

Tại [WriteRecoveryDrawer.tsx:89](D:/Workspace/pos-cafe/src/app/drawers/pos/WriteRecoveryDrawer.tsx:89), callback lỗi của action Tiếp tục/Hủy lệnh trước đây không kiểm vòng đời. A gửi action, khóa máy; B đăng nhập và có draft mới; lỗi AUTH_REQUIRED hoặc EMPLOYEE_SESSION_REQUIRED của A trả muộn gọi notifyUiError, đăng xuất B và xóa draft. Expected: giữ phiên/màn/draft B, không toast hoặc revoke B. Không có bằng chứng xóa giao dịch đã lưu trên DB.

Đã chụp captureView vào mutation variables khi click và kiểm trước denyAccess/notifyUiError. Invalidation sau success giữ nguyên; lỗi action hiện hành vẫn xử lý bình thường. Bổ sung [12 regression](D:/Workspace/pos-cafe/src/app/writeRecoveryActionLifetime.test.tsx) và manifest bắt buộc TC006/053/054; tổng required tăng từ 758 lên 770, vẫn 93 TC gốc.

Hai reviewer độc lập xác minh: UI reviewer có oracle 5/5 đạt, nhóm regression 40/40 đạt, negative control bỏ riêng guard cho 8 stale assertion FAIL/4 positive PASS. Gate reviewer viết thêm 3 oracle cho cùng object nhân viên nhưng phiên mới, đổi store session và FORBIDDEN hiện hành: 3/3 đạt. Các lượt này chồng lặp hoặc nằm ngoài gate, không cộng thành tổng mới. [Review UI](D:/Workspace/pos-cafe/artifacts/release-review-ui/REVIEW.md), [review gate](D:/Workspace/pos-cafe/artifacts/release-review-gate/REVIEW.md).

## Kiểm chứng candidate mới

Base main `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`, working changes chưa commit; Node **24.16.0**. Fingerprint cuối **e8f0aeeb298671044013cfe0b0e2e64ce326fed3f29fbf7994c9395e2605a3c5**.

- `npm run test:idempotency:unit`: **589 PASS**, before/after fingerprint cùng candidate; backend jsdom/mock của dự án.
- `npm run build`: **PASS**, cảnh báo chunk lớn đã biết. Lượt đầu bắt lỗi kiểu Promise<unknown> trong test mới; sửa thành Promise<OperationView>, không đổi assertions, sau đó chạy lại build và full unit trên fingerprint cuối.
- Gate DB/contracts, tooling và E2E: **BLOCKED/NOTRUN trên candidate mới**. Runtime cũ đã dừng và token hết hạn; khi dựng runtime mới, Windows chặn initdb.exe trước khi tạo database. Không chạy fixture, migration hoặc giao dịch thử trên Supabase thật.
- Verifier từ chối đúng các report contracts/tools/e2e có fingerprint cũ. 25 checksum của gói lịch sử p2-final đã được kiểm và khớp, nhưng gói đó chỉ chứng minh candidate 11/09, không phải gate mới.
- pnpm-lock.yaml giữ hash `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`, không stage. Các tài liệu tính năng khác trong docs worktree cũng chưa được đưa vào commit phase27.

Bằng chứng candidate cuối: [JSON](phase-27-release-check-2026-09-13.json). Kiểm MCP 45 thân hàm và grants là bằng chứng catalog thật riêng, không thay test ứng dụng.

## Chặn môi trường và điều kiện tiếp tục

Windows 11 Home build 26200 ghi CodeIntegrity events 3077/3033 cho `pos-cafe-idem-runtime/postgresql/pgsql/bin/initdb.exe`; Authenticode status NotSigned, Smart App Control `VerifiedAndReputablePolicyState=1`. Lệnh Start-Process bị từ chối bởi Application Control. Chưa có service/port test 55439/55442/55443/55444 được khởi động trong lượt này. Thư mục chuẩn bị mới `C:/Users/nguye/AppData/Local/Temp/pos-cafe-release-20260913` chỉ chứa log thất bại; không xóa runtime cũ hoặc thay chính sách Windows.

Máy chưa cài WSL hoặc Docker. Đã hướng dẫn chủ dự án có thể dùng WSL/Ubuntu với PostgreSQL Linux để dựng môi trường test riêng. Chưa cài WSL và chưa tuyên bố đã có runtime thay thế; khi có môi trường, phải xác minh binary/phiên bản, marker, preflight, backend và ghi quy trình tái lập rồi chạy đầy đủ gate trước push. Không dùng mock thay DB hoặc suy rằng mọi cảnh báo Security Advisor đã hết.
