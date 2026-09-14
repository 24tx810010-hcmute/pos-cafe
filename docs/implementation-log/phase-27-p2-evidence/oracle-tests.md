# F5 — bổ sung oracle, 2026-09-11

Chỉ sửa test/config, không sửa ứng dụng/migration, không commit/push/deploy. Base HEAD `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`, cùng worktree đang có các sửa F1–F4; những lượt dưới đây là kiểm tra mục tiêu trong lúc triển khai, chưa thay kết quả gate cuối với source fingerprint đóng băng.

## Thay đổi

- `tests/contracts/writeOperations.contract.test.ts:82`, `src/adapters/mock/writeOperationRepo.test.ts:58`, `tests/supabase/idempotencyPricing.spec.ts:18`: TC030 có reset riêng cho tách new 49.000/source 80.000 và tách old 40.000/source 89.000, sau tổng thêm món 129.000. Assert identity nguồn/đích, tên món cũ/mới, giá nền, option value/name/quantity/price, tổng/payment/receipt. Tách toàn dòng mới giữ ID dòng/options; tách một phần dòng cũ tạo ID con/options mới, giữ ID/giá của phần nguồn.
- `tests/contracts/writeOperations.contract.test.ts:159`, `src/adapters/mock/writeOperationRepo.test.ts:166`, `tests/supabase/idempotencyRecovery.spec.ts:106`: TC066 kiểm K cũ vẫn expired, đơn paid v6/150.000, paidAt ngày 10, bàn empty; báo cáo ngày 08 revenue 150.000, ngày 10 revenue 0. DB gọi **SupabaseReportRepo thật qua REST**; E2E chọn khoảng ngày trên màn Báo cáo; mock dùng report port tương ứng. Contract config thêm alias `@` để import adapter thật.
- `tests/contracts/writeFaults.contract.test.ts:230`: TC085 dựng DB con mới có marker trên cùng loopback PG, áp đủ 001–013 trước fixture; 4 đơn open/paid/void-paid/void-open, 4 items/options cũ, 2 payments, metadata void/note/time. Áp 014–016, so sánh mọi cột cũ của 12 bảng; assert cột mới không suy diễn creator/editor/receipt, không tạo ledger/event. Kiểm receipt legacy 80.000 với modifier qty2/5.000, void không in; login/capability/pay protocol mới và bootstrap cửa hàng mới vẫn hoạt động. DB con có **Auth SQL shim**, không gọi nó là GoTrue/browser E2E; xóa sau test.

Ba ID execution mới cần manifest: `TC-IDEM-030/db/old`, `TC-IDEM-030/mock/old`, `TC-IDEM-030/e2e/old`. Giữ ID cũ cho nhánh new.

## Lượt tự chạy

Node `24.16.0`; DB HTTP `pos_cafe_idem_test_auth_938220e75d16`, backend `postgres-postgrest-gotrue`, loopback API 55444. `IDEM_ENV_FILE=C:/Users/nguye/AppData/Local/Temp/pos-cafe-p2-fix-20260911/gotrue-stack/idempotency.env`; không dùng `.env.local`. Preflight qua globalSetup hoặc explicit trước mutation; lease DB độc quyền, các lượt tuần tự.

| Lệnh | Kết quả |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run src/adapters/mock/writeOperationRepo.test.ts --reporter=dot` | 33 passed, 0 skip/fail |
| `node node_modules/vitest/vitest.mjs run --config vitest.contract.config.ts tests/contracts/writeOperations.contract.test.ts tests/contracts/writeFaults.contract.test.ts -t 'TC-IDEM-030\|TC-IDEM-066\|TC-IDEM-085' --reporter=json --outputFile=artifacts/p2-oracle-completion/contracts-targeted.json` | 4 passed; 44 deselected, không tính là pass |
| `node node_modules/@playwright/test/cli.js test --config playwright.idempotency.config.ts --grep 'TC-IDEM-030\|TC-IDEM-066' --reporter=json` với PLAYWRIGHT_JSON_OUTPUT_FILE trong thư mục này | 3 passed, retries 0, không skip |
| `node artifacts/p2-oracle-completion/mutation-check.mjs` | Mutant SQL receipt option quantity=1 thay vì 2 bị 2 assertion TC030 bắt; restore hàm byte-for-byte; chạy lại 2 passed |

Mutation summary lưu tên DB, Node, hash định nghĩa hàm và raw quantity2/receipt quantity1 quan sát trong từng nhánh; lỗi là AssertionError ở receipt oracle, không phải compile error/timeout. Không tính hai mutant failures vào gate pass. Lượt đầu contract import adapter bị lỗi alias trước khi chạy; đã sửa config và chạy lại. Lượt đầu verifier mutation yêu cầu chữ `quantity` trong message rút gọn của Vitest nên verifier từ chối dù hai assertions đều fail; đã kiểm đúng callsite và raw snapshot, rồi chạy lại mutant/restore thành công.

## Giới hạn

Gate đầy đủ/fingerprint cuối do root chạy sau khi tất cả source đã chốt; số trên chỉ là targeted evidence. Không có dữ liệu production, managed Supabase, Storage, Realtime hay máy in vật lý. Phần TC085 là diễn tập fixture có chủ đích, không thay việc backup/preflight/đối soát DB thật trước rollout.

Đã trả lease DB cho root sau khi restore function; không còn tiến trình test của agent này.
