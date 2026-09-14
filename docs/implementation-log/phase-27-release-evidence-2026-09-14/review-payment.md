# Oracle độc lập vòng đời thanh toán — 2026-09-14

Reviewer `final_gate_audit` đọc lại AGENTS.md, CLAUDE.md, SPEC-STANDARD trên worktree docs. Phạm vi bổ sung do root giao: PaymentDrawer, thanh toán toàn bộ và tách đơn. Không gọi DB/Supabase, không sửa production, không commit/push. Node v24.16.0; Vitest/jsdom dựng component thật, QueryClient, Zustand, WriteLifecycle, coordinator và mock adapter; chỉ giữ promise ở port execute để điều khiển thời điểm response.

## Finding P2 đã tái hiện và sửa

`src/app/drawers/pos/PaymentDrawer.tsx:212` trước sửa gọi notifyUiError trong onError mà không kiểm vòng đời. Khi response AUTH_REQUIRED hoặc EMPLOYEE_SESSION_REQUIRED của lần xác nhận cũ đến sau đổi thế hệ đăng nhập cùng employee object, hoặc offline rồi online, callback khóa phiên hiện tại, xóa draft, đóng drawer và revoke session. Một response applied đã ghi thành công được coordinator chặn về WRITE_RESULT_UNKNOWN, nhưng callback cũ vẫn toast lỗi vào lượt mới.

Expected: giữ phiên/draft/UI hiện hành, không toast hoặc in từ response cũ; business effect đã commit vẫn chỉ một lần. Actual trước sửa: 8 trường hợp stale auth phá bất biến phiên/draft; 4 trường hợp late applied phát toast cũ. Chưa có bằng chứng duplicate payment hay mất business rows từ lỗi UI này.

Root sửa tại `PaymentDrawer.tsx:41,193,198,217`: captureView theo paymentOrderId, chụp isCurrent trước mutate, kiểm đầu cả onSuccess và onError. Invalidation ở hook vẫn chạy; current positive controls giữ luồng có chủ ý.

## Lệnh và kết quả

| Lệnh thực chạy | Kết quả |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --config artifacts/final-gate-audit/payment.config.ts --reporter=json --outputFile=artifacts/final-gate-audit/payment-before.json` | 6 PASS, 12 FAIL bằng AssertionError, 0 pending/skip |
| `node node_modules/vitest/vitest.mjs run src/app/writePaymentLifetime.test.tsx --reporter=json --outputFile=artifacts/final-gate-audit/payment-fixed.json` | 18 PASS, 0 FAIL/pending |
| `node node_modules/vitest/vitest.mjs run --config artifacts/final-gate-audit/payment-without-error-guard.config.ts --reporter=json --outputFile=artifacts/final-gate-audit/payment-mutant.json` | 6 PASS, 12 FAIL bằng AssertionError; exit 1 là negative control mong đợi |

Mutation chỉ bỏ đúng một guard onError của PaymentDrawer bằng Vite transform trong bộ nhớ, không đụng file production và không bỏ guard onSuccess. Vì vậy 12 lỗi tái hiện đo được độ nhạy của oracle, không phải lỗi compile hoặc timeout. Không cộng các lượt lặp thành nhiều test độc lập.

Tracked `src/app/writePaymentLifetime.test.tsx` có 18 executions: 8 stale auth, 4 late applied ACK có business snapshot bất biến, 4 current auth positives, 2 current success/receipt positives. Chờ mutation cache chuyển error/success trước assert; không dùng một sleep ngắn làm bằng chứng callback không chạy. Baseline artifact đặt 2 offline-applied titles dưới TC053; tracked đã đổi chúng sang TC054 cho đúng phân loại, không đổi bước hoặc expectation.

| Artifact | SHA-256 |
| --- | --- |
| PaymentDrawer sau sửa | `09ceecf49d759bf95f9c06088043ad0432af3cd4621baad4a4f091e4d15d6bd8` |
| writePaymentLifetime.test.tsx | `053fa9d0341097512835bdafe25a2d52d80fde59bc409ee92c3a31c7d2ff57c3` |
| payment-before.json | `0aa2a13ee5f03c804fd009d4576fe803bff513354efc9d4759a0f95271883451` |
| payment-fixed.json | `f15ce2df25603db62761c0b52d4b1920ac225cababef5f90d2aa22e2472924db` |
| payment-mutant.json | `55ec4364fa82fa3e190897448d91ae75e490fdb6ca0ae4a0bdabe1296ae6f209` |

Đây là kiểm UI với memory adapter, không thay chứng cứ PostgreSQL/E2E. Gate toàn bộ phải chạy trên fingerprint mới sau khi root hoàn tất các sửa UI và manifest.
