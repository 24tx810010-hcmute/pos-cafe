# Phase 27 — Kiểm lại sau khi dựng WSL

Ngày 2026-09-14. Findings code đã sửa và kiểm độc lập; gate cuối PASS. Code đã commit thành `8ed7418573fe88e27796d3b09807a3c55db4d0d6`; đã push cùng docs và đối chiếu remote, xem biên bản bên dưới.

## Findings và thay đổi

- **P2 — callback lỗi của lần gửi đơn đầu không kiểm vòng đời.** Ở [OrderDrawer.tsx:173](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:173), `submitMutation.mutate(...).onError` gọi `notifyUiError` kể cả khi phiên đã đổi thế hệ hoặc đã offline/online. Oracle độc lập giữ response execute, thực hiện chuyển trạng thái rồi trả AUTH_REQUIRED/EMPLOYEE_SESSION_REQUIRED: cả bốn trường hợp làm currentEmployee thành null, mất draft, toast lỗi cũ và revoke phiên. Expected: giữ phiên/draft hiện tại, không tác động UI từ lượt cũ. Bản sửa chụp `useViewLifetime(context)` lúc bấm và kiểm cả success/error. Chín regression gồm lỗi muộn, lỗi hiện hành, ACK muộn và gửi thành công hiện hành.
- **P2 — callback thanh toán/tách đơn cũ còn tác động phiên/UI.** [PaymentDrawer.tsx:193](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:193). Giữ execute đang chờ hoặc đã commit nhưng chưa trả ACK; đổi thế hệ cùng nhân viên hoặc offline/online; lỗi auth muộn gây logout, mất draft, đóng payment và revoke phiên. ACK muộn chỉ có một hiệu ứng server nhưng vẫn toast vào lượt cũ. Baseline 12 assertion FAIL, 6 positive PASS; fixed 18 PASS. Bản sửa kiểm lifetime của paymentOrderId trước success/error. Mutation bỏ riêng error guard làm 12 case FAIL, 6 positive PASS.
- **P2 — lỗi đọc/in lại và callback hủy trong lịch sử không được cô lập đầy đủ.** [OrderHistoryDrawer.tsx:201](D:/Workspace/pos-cafe/src/app/drawers/admin/OrderHistoryDrawer.tsx:201) và [confirmVoid:235](D:/Workspace/pos-cafe/src/app/drawers/admin/OrderHistoryDrawer.tsx:235). Giữ getOrder/getReceipt, đổi nhân viên hoặc offline/online rồi trả auth error: phiên mới bị khóa, mất draft, revoke/toast. Giữ execute void rồi đổi generation/offline: lỗi hoặc ACK cũ còn toast/refetch vào lượt mới. Baseline đã xác nhận 14 assertion FAIL/6 positive PASS. Fixed thêm captureView cho catch và mutation callbacks, cùng voidGeneration cho cleanup busy; test thứ 21 chứng minh settlement cũ không mở khóa một lượt tải xác nhận mới.
- **Gate tooling — assertion đếm TC006/core chưa phân biệt nhóm mới.** Sau khi thêm bốn positive recovery error ngày 13/09, kiểm tổng bằng 12 bị lỗi vì có 16 execution. Bản sửa vẫn đòi đủ 12 oracle cache theo file của chúng, đồng thời đòi riêng bốn positive recovery và các positive mới; không bỏ test hoặc đổi expected nghiệp vụ.

Hai subagent kiểm độc lập cả callback và gate. Bổ sung trong ngày 48 tracked regressions: submit 9, payment/split 18, history 21. Các lượt oracle chồng lặp hoặc mutation được báo riêng, không cộng vào tổng gate.

## Lịch sử lượt chạy trong ngày

Base code `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`; code sửa chưa commit trong lúc chạy test. Candidate đầu `e8f0aeeb298671044013cfe0b0e2e64ce326fed3f29fbf7994c9395e2605a3c5`.

1. WSL2/Ubuntu 24.04.4 mới, PostgreSQL 16.15, PostgREST 16.2, GoTrue v2.197.0 sạch upstream, Node 24.16.0. Bootstrap xác minh Auth API/password login; preflight browser kiểm marker, migration checksums, caller và API/observer cùng DB đạt.
2. Discovery: 93 TC gốc, 770 required, 1.135 discovered, không thiếu/sai backend. Unit/component: 589 PASS.
3. Contracts đầu: 427 PASS / 35 FAIL / 0 skipped. Nguyên nhân được SQL oracle tái hiện: runtime thiếu alias timezone Asia/Saigon. Bổ sung `tzdata` + `tzdata-legacy`, kiểm trực tiếp ranh giới nửa đêm đạt; code và fixture giữ nguyên. Xem [runtime WSL](phase-27-test-runtime-wsl.md).
4. Contracts sau sửa runtime trên cùng candidate: 462 PASS. Tools: 36 PASS / 1 FAIL ở assertion manifest nêu trên. Gate dừng, chưa chạy E2E ở lượt này. Raw artifact lỗi/lượt đầu được giữ tại `artifacts/release-wsl/failed-attempt-1` và `artifacts/release-wsl/e8-attempt-before-initial-fix`; file E2E cũ trong archive sau chỉ là report có sẵn, không được tính kết quả của lượt 14/09.
5. Review độc lập phát hiện initial-submit P2; sửa code và thêm required test nên candidate thay đổi. Những kết quả trên là lịch sử chẩn đoán, không được ghép vào gate candidate cuối khác fingerprint.

## Kết quả candidate cuối

Fingerprint raw bytes `69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6`; Git clean-content fingerprint `02046f390831d1e141684cc204d90214fea37910f316bc556e54905412dbb24f`. 459 file được đối chiếu; 183 file được Git chuẩn hóa CRLF thành LF. Không đánh đồng hash raw worktree với hash checkout khác quy ước newline. Node 24.16.0, DB `pos_cafe_idem_test_auth_c5b5ce76d5d3`, PostgreSQL 16.15/PostgREST 16.2/GoTrue v2.197.0 Linux không patch.

| Lệnh thực chạy | Kết quả |
| --- | --- |
| `npm run test:idempotency:discover` | 93 TC, 818 required, 1.183 discovered; không missing/duplicate/wrong backend |
| `npm run test:idempotency:unit` | 637 PASS |
| `npm run test:contracts` | 462 PASS |
| `npm run test:idempotency:tools` | 37 PASS |
| `npm run test:idempotency:e2e -- --reporter=./artifacts/release-wsl/step-reporter.mjs,json` | 47 PASS; 1 worker, retries 0, timeout 45s, không filter/only/expected-failure |
| `npm run test:idempotency:verify-results` | valid, 818/818 required, không report lỗi/cũ |
| `npm run build` | PASS; cảnh báo chunk lớn đã biết |
| `npm run test:coverage -- --reporter=json --outputFile=artifacts/release-final-20260914/coverage-tests.json` | PASS; dòng 93,03% (748/804), chỉ core/pure features; không đo SQL/hooks/UI |
| `npm run smoke -- --reporter=json --forbid-only --retries=0` | 35 PASS/31 skipped theo viewport, backend mock; ngoài gate idempotency |

Tổng **1.183 test gate PASS = 637 + 462 + 37 + 47**. Các test chạy lại để đo coverage hoặc oracle của reviewer không cộng thêm. Tất cả stage có cùng fingerprint trước/sau; preflight sau gate PASS lúc `2026-09-14T03:48:57.978Z`, kiểm đủ 16 migration checksum và cùng backend API/observer.

**Lượt E2E trước đã thất bại và được giữ nguyên bằng chứng:** 46 PASS/1 timeout tại TC068/terminal=rejected (45s). Stack ở `fresh.close()` có thể che bước bị kẹt trước đó; không khẳng định cleanup là nguyên nhân. Chạy riêng cùng case với log bước đạt 8,139s; chạy lại toàn bộ suite giữ nguyên source/assertions/timeout, chỉ thêm reporter thời gian, đạt 47/47 (case rejected 2,659s). Không bật retry hoặc loại testcase. **Nguyên nhân timeout đầu chưa được xác định; độ ổn định gate trong môi trường này còn giới hạn bằng chứng.** Không viết rằng lỗi timeout đã được sửa hoặc chưa từng có flake.

Hai subagent đọc source và tự kiểm: UI reviewer 82/82 với mutation bắt stale/current/settlement, payment reviewer 18/18 và mutation 12 FAIL/6 positive PASS. Auditor độc lập đọc mọi assertion/attempt của 1.183 test, kiểm hash/source/options, discovery và backend; không dùng chính verifier của dự án làm oracle duy nhất. Không tìm thêm blocker code trong phạm vi review sau các sửa; kết luận không phải bảo đảm phần mềm không có lỗi.

## Bằng chứng đóng gói và liên kết commit

Các raw reports, metadata, options, discovery, commands, postflight, reviewer và mutation audit nằm trong [bundle 14/09](phase-27-release-evidence-2026-09-14/summary.json), với [SHA256SUMS](phase-27-release-evidence-2026-09-14/SHA256SUMS.txt). Thuộc tính Git `* -text` ngay trong bundle giữ nguyên byte bằng chứng qua các nền tảng. [Auditor độc lập](phase-27-release-evidence-2026-09-14/review-gate.md) có 9/9 kiểm tra sửa bằng chứng đều bị từ chối đúng; [UI reviewer](phase-27-release-evidence-2026-09-14/review-ui.md) và [payment reviewer](phase-27-release-evidence-2026-09-14/review-payment.md) ghi oracle cùng mutation cụ thể.

[Commit binding](phase-27-release-evidence-2026-09-14/commit-binding.json) đối chiếu 459 Git blob với mapping độc lập: index và tree `9f8cfda3cf46e1ec64d136d5bc12d61ff6af5823` của commit `8ed7418573fe88e27796d3b09807a3c55db4d0d6` khớp source đã test sau clean filter. Raw fingerprint trước/sau commit vẫn là `69ffe205…`; không tuyên bố đã chạy một gate mới sau commit. `pnpm-lock.yaml` vẫn untracked, nguyên SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`.

`historical-failed-*` là các lượt lỗi đã nêu, không cộng vào gate. Hai file `idempotency-faults.json` và `idempotency-unit-progress.json` từ 10/09 bị wildcard copy vào thư mục artifact local ban đầu; chúng không phải input của verifier/auditor gate cuối và đã được loại khỏi bundle phát hành để tránh nhầm report cũ với lượt 14/09. Bản reporter quan sát bước được lưu nguyên byte trong `step-reporter.mjs.txt`; để tái hiện đúng command E2E có thể sao chép thành `artifacts/release-wsl/step-reporter.mjs` trong code worktree. Mọi cấu hình/assertion nghiệp vụ nằm trong commit code, không nằm trong reporter.

Runtime test đã được dừng sau khi ghi postflight và coverage/smoke; không để PostgreSQL trust hoặc proxy test chạy nền sau kiểm tra.

## Giới hạn và rollout

Không gọi mutation trên Supabase thật. Migration 014–016 đã được chủ dự án áp và catalog đã kiểm chỉ đọc ngày 13/09; các sửa UI bổ sung không yêu cầu chạy lại migration. Chưa có bằng chứng app đang phục vụ đã chứa bản sửa hoặc đã kiểm nghiệp vụ sau phát hành. Runtime WSL thiếu Storage API/Realtime và không kiểm máy in vật lý. Các cảnh báo bảo mật legacy/owner provisioning ghi trong báo cáo MCP vẫn là giới hạn riêng, không tuyên bố toàn hệ thống hết mọi vấn đề.

## Xuất bản Git

Đã push docs trước, main sau và dùng `git ls-remote` đối chiếu lúc `2026-09-14T04:07:02.559Z`: main `8ed7418573fe88e27796d3b09807a3c55db4d0d6`, docs evidence `70bd11d0874d1a229d28513c1123278779762ce6`. Đây là SHA commit chứa bundle đã kiểm 53 checksum trực tiếp từ Git blobs. [Biên bản xuất bản](phase-27-publication-2026-09-14.json) được ghi ở commit docs tiếp theo; không tự gán SHA của commit chưa tồn tại vào biên bản. Giữ nguyên 23 file tài liệu ngoài phạm vi và pnpm-lock. Push Git không xác minh app đang phục vụ; bước kiểm nghiệp vụ sau phát hành vẫn chưa thực hiện.
