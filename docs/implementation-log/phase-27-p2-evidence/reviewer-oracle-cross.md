# Review chéo độc lập F2/F3/F4 — 2026-09-11

Agent này viết F5, **không viết các bản sửa ứng dụng F2/F3/F4**. Đã đọc diff thực tế, useViewLifetime/WriteLifecycle/coordinator và những regression mới; không sử dụng số test của phiên trước để suy ra kết luận.

**Kết luận trong phạm vi bản sửa: không còn finding F2/F3/F4 cần xử lý từ lượt review này.** Có một thiếu nhất quán generation được oracle độc lập phát hiện, root đã sửa và kiểm lại như dưới đây. Gate toàn bộ và fingerprint cuối vẫn thuộc lượt chạy sau khi source đã chốt, không lấy report mục tiêu dưới đây thay gate.

## Đối chiếu mã và oracle

- F2: `src/app/components/ReceiptPreview.tsx:335` chụp generation trước await getReceipt, kiểm lại sau response và trước timer print tại dòng 68. Effect dòng 265 hủy timer/iframe khi session/context/preview/offline đổi. `src/app/useViewLifetime.ts:14` ghi nhận thế hệ phiên, context, màn và receipt; offline→online không hồi sinh callback cũ. Late error cũng không toast sang màn mới. Đã đọc 12 component regressions và các browser regressions: giữ HTTP response thật, tách checkpoint trước response và trước timer, có positive print một lần. Agent này tự chạy 12 component, không tự chạy lại browser F2 khi root đang giữ DB lease.
- F3: `supabase/migrations/015_write_business_helpers.sql:119` và các điểm đọc số đều đi qua numeric trước integer/bigint; phép chiếu jsonb_to_recordset ở dòng 153 đổi quantity sang numeric. Đã tìm tất cả `->>` cast số trong 014–016, không còn đường trực tiếp text→integer/bigint cho payload. Validator ở 014 vẫn xác nhận integer/range trước helper; thay đổi không nới fraction/NULL/range hay sửa payload ledger. Raw-wire tests tự dựng `2.0`/`2e0` qua fetch, đọc payload::text từ DB, đăng ký lại bằng integer JSON, execute/replay và so frozen payload. Các nhánh create/update-retain/remove/pay/split-partial/whole/void-open/paid có oracle; invalid fields kiểm trước ghi ledger và positive control. Tôi không gọi đây là DB numeric tests do mình tự chạy: numeric agent/root giữ và thực hiện lease DB đó. Tôi đã tự chạy các contracts thực F5 trên SQL 015 đã sửa và upgrade rehearsal.
- F4: `WriteAttemptNotice.tsx:13–20` scope callback theo operationId/lifetime; chỉ applied mới gọi consume-draft. `OrderDrawer.tsx:197` xóa draft/đóng context, không dùng R1 để vá current cache hay mở preview; fieldset dòng 268 chặn sửa draft lúc unknown/executing. Rejected retry vẫn giữ draft. Đã đọc và tự chạy ba regression pending/committed/late-retry; oracle độc lập bổ sung PRICE_CHANGED rejected retry giữ nguyên draft, không tạo order/preview.

## Thiếu nhất quán generation phát hiện và đã đóng

Trước sửa bổ sung, `WriteLifecycle.tsx` xóa recovery cache khi employeeSessionVersion đổi, nhưng `coordinator.leave()` chỉ xét identity employee/context. Oracle component độc lập: initial create commit, giữ ACK; gọi setter với cùng employee object để tăng generation; thả ACK. **Actual:** kitchen preview mở; **expected:** ACK phiên cũ không mở preview.

Tất cả callsite production đã được tìm: chỉ PasscodeScreen gán employee khác null; App chỉ render PIN khi currentEmployee=null, và login Supabase trả object mới. Vì vậy đây là **invariant tái hiện bằng setter có kiểm soát**, chưa chứng minh được exploit/đường UI hiện hành có cùng object và không qua null. Không nâng kết luận thành lỗ hổng production P1/P2.

Root bổ sung employeeSessionVersion vào điều kiện leave tại `src/app/WriteLifecycle.tsx:19`. Agent chuyển oracle thành `src/app/writeSessionGeneration.test.tsx`, ID `TC-IDEM-053/core/session=same_employee`, rồi tự chạy lại. Baseline assertion fail là preview không null; fixed passed. Positive current initial submit vẫn mở preview và rejected retry vẫn giữ draft: cùng bộ độc lập 3/3 passed sau sửa.

## Lệnh và bằng chứng tự chạy

Node 24.16.0, base SHA `3ada48c0c9c494d9b34838fd3739bda6091e0bb9` cộng working changes; các lượt này dùng jsdom/memory adapter, không gọi DB hoặc .env.local. Không dùng expected-failure/retry để làm xanh.

| Lệnh | Kết quả/artifact |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --config artifacts/p2-oracle-completion/cross-review.config.ts artifacts/p2-oracle-completion/cross-review.test.tsx --reporter=json --outputFile=...` trước guard | 2 pass / 1 assertion fail; `cross-review-baseline.json` |
| Cùng lệnh sau guard | 3 pass / 0 fail; `cross-review-fixed.json` |
| `node node_modules/vitest/vitest.mjs run src/app/writeSessionGeneration.test.tsx --reporter=json --outputFile=artifacts/p2-oracle-completion/session-generation-fixed.json` | 1 pass |
| `node node_modules/vitest/vitest.mjs run src/app/components/ReceiptPrintLifecycle.test.tsx src/app/writeRetryDraft.test.tsx --reporter=json --outputFile=artifacts/p2-oracle-completion/cross-review-regressions.json` | 15 pass |

Một lần cấu hình merge đã union include với toàn suite unit; tiến trình riêng của agent được dừng và chạy lại bằng positional filename đúng một file. Lượt bị dừng không được tính là pass hay gate. Artifact config/test chỉ phục vụ review; tracked regression không phụ thuộc artifact.

Không chứng minh mọi interleaving hoặc thiết bị in thật. Kết luận còn phụ thuộc gate cuối cùng đúng fingerprint và rollout có kiểm soát; không có migration/deploy production trong lượt này.
