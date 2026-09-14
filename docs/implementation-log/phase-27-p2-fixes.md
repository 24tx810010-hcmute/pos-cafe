# Phase 27 — Khắc phục F2–F5 sau review độc lập

Ngày 2026-09-11. Chủ dự án yêu cầu sửa bốn finding còn lại sau F1, kiểm lại và nhắc chạy migration khi hoàn tất. **F1–F5 đã được xử lý trong phạm vi kiểm chứng dưới đây; chưa commit/push/deploy, chưa áp migration lên môi trường thật.**

**Cập nhật trạng thái ngày 2026-09-13:** chủ dự án xác nhận đã áp dụng migration 014–016; agent đã kiểm catalog qua MCP: 45/45 thân hàm khớp local và grants quan trọng đã được kiểm, xem [báo cáo MCP](phase-27-live-mcp-check-2026-09-13.md). Chưa kiểm nghiệp vụ trên dữ liệu thật hoặc phiên bản app đang chạy; bản sửa code vẫn chưa commit trong worktree. Trạng thái và số liệu ngày 2026-09-11 bên dưới được giữ làm bằng chứng lịch sử. Theo dõi các bước còn lại tại [log rollout](phase-27-idempotency-rollout.md).

Code base main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9; docs base1bdddd8d92ddb7a619a08362e3a8490fd6dcfe12. Local/remote hai branch được kiểm lại và vẫn ở hai SHA này. Bản sửa là working changes với fingerprint **35c5f9485b42056303e63a688b8d4a711e0603161a77028e659313796028ea51**, không gọi base SHA là commit chứa bản sửa.

## Những gì đã sửa

| Finding | Hành vi sau sửa và nguồn |
| --- | --- |
| F2 — phản hồi/in muộn | [ReceiptPreview.tsx:51](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:51) kiểm lifetime sau đọc receipt và ngay trước print; hủy timer/iframe khi offline, đổi preview/context/phiên; lỗi muộn không toast vào màn khác. [useViewLifetime.ts:14](D:/Workspace/pos-cafe/src/app/useViewLifetime.ts:14) ghi nhận generation, kể cả offline rồi online hoặc cùng nhân viên đăng nhập lại. Click mới hợp lệ vẫn in một lần. |
| F3 — số JSON hợp lệ | [015:97](D:/Workspace/pos-cafe/supabase/migrations/015_write_business_helpers.sql:97) đọc số đã validate qua numeric rồi integer/bigint, gồm jsonb_to_recordset. Các biểu diễn 2,2.0,2e0 cùng nghĩa; payload đã đăng ký giữ nguyên. Fraction/range/NULL không được nới. |
| F4 — draft sau retry | [WriteAttemptNotice.tsx:13](D:/Workspace/pos-cafe/src/app/drawers/pos/WriteAttemptNotice.tsx:13) chỉ thực hiện callback của lượt hiện hành; [OrderDrawer.tsx:197](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:197) tiêu thụ draft và đóng drawer khi retry applied, không tự mở phiếu bếp/in hay dùng R1 vá current cache. Giỏ khóa chỉnh trong lúc lượt ghi chưa rõ kết quả để không mất sửa đổi mới. |
| F5 — thiếu oracle/gate | TC030 reset riêng nhánh new49k/source80k và old40k/source89k ở mock/DB/browser, kiểm IDs/names/options/prices. TC066 đọc report adapter REST và màn Báo cáo: ngày08/09 revenue150k, ngày10/09 revenue0. TC085 nâng cấp fixture có open,paid,void-paid,void-open; 4 items/options và2 payments, so toàn bộ cột cũ trước/sau014–016. |

Review chéo phát hiện thêm thiếu nhất quán thế hệ phiên tại [WriteLifecycle.tsx:19](D:/Workspace/pos-cafe/src/app/WriteLifecycle.tsx:19). Root đã thêm employeeSessionVersion vào điều kiện coordinator.leave. Oracle giữ ACK create, gọi setter cùng employee object với thế hệ mới: baseline mở phiếu bếp, fixed không mở. Đây là kiểm invariant bằng setter có kiểm soát; các callsite PIN hiện tại qua null/object mới nên không tuyên bố đã tìm exploit UI production mới.

F1 cache/quyền giữ nguyên và được chạy lại trong gate này; lịch sử sửa F1 nằm ở [log F1](phase-27-f1-recovery-cache-fix.md).

## Test tự chạy trên candidate cuối

Node24.16.0; PostgreSQL16.15/PostgREST16.2/GoTruev2.197.0 thật, cùng Windows listener patch đã mô tả ở runtime docs. Cluster mới C:/Users/nguye/AppData/Local/Temp/pos-cafe-p2-fix-20260911; DB **pos_cafe_idem_test_auth_938220e75d16**, API **http://127.0.0.1:55444**, engine postgres-postgrest-gotrue. Preflight browser/marker/API–observer binding trước và sau đạt. Các lượt DB/reset fixture được cấp lease và chạy tuần tự.

Thiết lập IDEM_ENV_FILE tới gotrue-stack/idempotency.env của runtime trên; không dùng .env.local. Không đưa credentials vào docs.

| Lệnh | Kết quả cuối |
| --- | --- |
| npm run test:idempotency:discover | 93 TC gốc, 758 required, 1123 discovered, không thiếu/trùng/sai backend |
| npm run test:idempotency:unit | 577 passed |
| npm run test:contracts | 462 passed |
| npm run test:idempotency:tools | 37 passed |
| npm run test:idempotency:e2e | 47 passed |
| npm run test:idempotency:verify-results | 758/758 required, 0 missing/notPassed/errors |
| npm run build | PASS; cảnh báo Vite chunk lớn vẫn có |
| npm run test:coverage | 92.78% lines (746/804), PASS ngưỡng90% |
| npm run smoke | 35 passed, **31 skipped**, backend mock riêng |

Tổng gate **1123 passed**. Không cộng lượt coverage lặp unit, smoke, targeted runs hoặc mutant failures vào số này. Không required skip/retry/flaky/expected-failure/only. Coverage chỉ đo804 dòng logic thuần core/features, **không phải phần trăm toàn hệ thống/SQL/hooks/JSX/adapters**.

Cả bốn stage có fingerprint trước/sau khớp candidate cuối; report hashes/options attestation được verifier xác nhận. Lượt gate trước có unit576/DB462/tooling37 chạy xanh nhưng source đổi trong tooling khi bổ sung generation guard: wrapper đã trả lỗi, lượt ấy được loại và giữ riêng ở artifacts/p2-before-session-guard. Gate cuối chạy lại đầy đủ sau khi source ổn định.

## Hai subagent và độ nhạy oracle

- Reviewer numeric viết F3, kiểm độc lập F2/F4 và đọc đối chiếu F5: 5 oracle component mới đạt, baseline Vite override khiến5/5 thất bại đúng assertion (draft chưa đóng, stale toast/print). Bổ sung4 kiểm mục tiêu mock/session đạt. Không tự gọi đó là DB/E2E F5 do mình chạy. [Review chéo1](phase-27-p2-evidence/reviewer-numeric-cross.md).
- Reviewer oracle viết F5, kiểm độc lập F2/F3/F4: 3 oracle mới đạt sau guard, baseline generation1 assertion fail/2 positive pass; tự chạy15 regressions F2/F4 và tracked generation1 đạt. Đọc SQL numeric, không nhận các numeric DB test do reviewer khác chạy là bằng chứng tự chạy. [Review chéo2](phase-27-p2-evidence/reviewer-oracle-cross.md).
- F3:46 raw-wire DB tests đạt, helper baseline làm8 decimal cases lỗi22P02, khôi phục definition nguyên vẹn rồi46/46 đạt. F5: mutant SQL receipt option quantity1 thay2 bị2 oracle TC030 bắt bằng assertion, khôi phục hàm byte-for-byte rồi2/2 đạt. Không sửa marker để che mutation.

Các lần chỉnh harness ban đầu được ghi riêng: component click đổi từ fireEvent tổng hợp sang userEvent để mô phỏng đúng fieldset disabled; DTO stub receipt sửa đúng kiểu; một browser test gặp Route already handled khi unroute request đang giữ, đã sửa handler giữ riêng request cũ, expected không thay và9/9 đạt. Lỗi config/compile của oracle artifact không được tính mutation kill. Hai reviewer ghi rõ những lượt config/include bị ngắt hoặc sửa trước evidence cuối.

## Giới hạn và bàn giao rollout

Không kiểm Supabase managed/Storage API/Realtime, tải production hay máy in vật lý. Print oracle đếm window.print/iframe trong browser. TC085 là fixture legacy có chủ đích trên DB con mới có marker và **Auth SQL shim**; không phải bản sao dữ liệu cửa hàng. HTTP/browser suite dùng GoTrue thật. Không suy các tests này thành chứng minh mọi interleaving hoặc mọi dữ liệu sản xuất.

pnpm-lock.yaml có sẵn giữ SHA256 86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996. Không commit/push/deploy. Các file014–016 trên DB thật chưa được chạy trong công việc này; trạng thái live migration history chưa truy vấn lại.

**Nhắc chủ dự án:** khi chuẩn bị rollout, kiểm migration history đang đến013, dùng đúng bản file mới trong worktree, đặc biệt015 đã sửa. Theo [kế hoạch rollout](phase-27-idempotency-rollout.md), sao lưu/kiểm phục hồi, dừng ghi, áp **014→015→016**, phát hành app tương ứng và tải lại thiết bị trước khi mở ghi. 016 thu hồi RPC/DML cũ; không mở quyền cũ để cứu app chưa cập nhật. Nếu môi trường nào đã áp015 bản cũ ngoài phiên này, không chạy lại create-function migration mù quáng; cần kế hoạch migration tiến về trước cho môi trường đó.

[Bằng chứng máy đọc và log](D:/Workspace/pos-cafe/artifacts/p2-final/summary.json), [checksum gói](D:/Workspace/pos-cafe/artifacts/p2-final/SHA256SUMS.txt), [bằng chứng tóm tắt](phase-27-p2-evidence/verification.md).

Runtime test do phiên này tạo đã được dừng sau preflight và đóng gói bằng chứng cuối; các cổng55439/55442/55443/55444 đã giải phóng. Cluster/log còn ở thư mục TEMP để tái dựng; credential test không đưa vào docs. Hai đính chính của reviewer (758 execution và TC066 truy IDEM-11/12/28) đã cập nhật trong traceability.
