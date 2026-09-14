# Cross-review độc lập F2/F4

Ngày 2026-09-11. Reviewer này viết F3, không viết production hoặc tests F2/F4. Base SHA `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`; Node `24.16.0`.

**Không tìm thấy finding mới phải chặn trong phần F2/F4 đã kiểm.** Đây là source review và component oracle trên mock adapter thật của dự án; không gọi kết quả này là kiểm DB, trình duyệt thật hoặc máy in vật lý.

## Đối chiếu source

- `src/app/components/ReceiptPreview.tsx`: chặn cả kết quả đọc receipt, lỗi đọc muộn và timer trước `print`; hủy iframe/timer khi preview/nhân viên/phiên/context/screen đổi hoặc offline. Phiếu bếp/tạm tính cũng đi qua timer guard. Print hiện hành vẫn dùng tài liệu đang xem và chỉ kiểm điều kiện hiện tại bằng receipt endpoint.
- `src/app/useViewLifetime.ts`: generation tăng khi close/reopen, cùng nhân viên nhưng phiên mới, đổi context và offline. Online trở lại không phục hồi generation cũ.
- `src/app/drawers/pos/WriteAttemptNotice.tsx`: callback hoàn tất retry chỉ chạm UI khi capture vẫn hiện hành; phản hồi muộn vẫn được phép invalidate server query nhưng không toast/đóng/xóa UI khác.
- `src/app/drawers/pos/OrderDrawer.tsx`: retry applied tiêu thụ draft và đóng drawer; không dùng R1 để vá current order và không mở preview. Fieldset disabled trong attempt chưa xác định giữ draft đang chờ; người dùng vẫn có thể đóng/tra cứu.

## Oracle tự viết và tự chạy

`artifacts/p2-cross-review.test.tsx` không sử dụng assertions của tracked tests:

1. Update có phần mới, execute chưa commit rồi mất ACK: retry cùng K, tổng 90.000, tổng quantity 3, nguồn cũ quantity 2; consume draft, không preview.
2. Cùng update, execute đã commit rồi mất ACK: cùng assertions và chỉ một register/hai execute cùng arguments.
3. Retry trả FORBIDDEN sau khi đóng/mở drawer mới: không toast lỗi cũ, không xóa draft quantity 7 mới.
4. Receipt trả denial sau offline→online: không toast cũ, click hiện hành tiếp theo vẫn in một lần.
5. Receipt trả success sau offline→online: không in muộn, click hiện hành tiếp theo vẫn in một lần.

Lệnh: `node node_modules/vitest/vitest.mjs run --config artifacts/p2-cross-review.config.mts artifacts/p2-cross-review.test.tsx --reporter=verbose --reporter=json --outputFile=artifacts/p2-cross-review-results.json --allowOnly=false`. **5/5 PASS**.

Negative control dùng config `artifacts/p2-cross-review-baseline.config.mts`: Vite load đúng bốn file production từ `git show 3ada48c:...`, không sửa tracked source. Cùng năm oracle **5/5 FAIL bằng assertion nghiệp vụ**: drawer còn `order`, lỗi muộn vẫn toast một lần, print muộn vẫn một lần. Không có compile error hoặc test timeout trong lần negative control cuối. Sau bỏ override, 5/5 PASS.

Tự chạy tracked tests `src/app/components/ReceiptPrintLifecycle.test.tsx` và `src/app/writeRetryDraft.test.tsx`: **15/15 PASS**. Tracked tests phủ read/timer × offline/close-reopen/lock/same_employee/unmount, positive print, late error, create retry pending/committed và late success không xóa draft khác. Báo cáo `artifacts/p2-cross-review-tracked.json`.

## Ghi nhận thực thi và giới hạn

- Có một lần cấu hình artifact ban đầu merge nhầm include thành cả `src`, đã ngắt và không lấy làm evidence. Đã sửa config thành include riêng.
- Một oracle ban đầu gom close/open trong cùng React act làm exit guard chặn mở; đã tách thành hai tương tác riêng đúng vòng đời UI. Đây là sửa cách dựng oracle, không phải thay expected hoặc sửa app để test xanh.
- Một lần negative config lỗi import thiếu `.mts`, không tính là mutation bị phát hiện. Evidence negative control cuối là năm assertion thất bại rõ ràng.
- Không chạy DB trong cross-review này; DB lease thuộc reviewer khác. Không kiểm máy in vật lý, Storage, Realtime hoặc full gate cuối. Root chạy E2E và full gate sau khi mọi source ổn định.

SHA256 file production đã đọc/chạy:

| File | SHA256 |
| --- | --- |
| ReceiptPreview.tsx | `a15a19b1ba1e0a3a67d78ef8b66de655d266be54a71ad07b1f2260b0c147a9be` |
| useViewLifetime.ts | `1beeb0a97d96493fa4bac4ddf4df27f48dc9e1bb4eb2abf111a87dab72f5e457` |
| WriteAttemptNotice.tsx | `fdb21073ac0f3bd795876a2157370aa485e9112dcb06c9e096ec069ab2fac014` |
| OrderDrawer.tsx | `d39a559aef737f064fadd1824549f4c252fa22fe2e70701c537d658d057029b1` |

## Cross-review bổ sung F5 và session generation

Phần này được đọc/kiểm sau, vẫn ngày 2026-09-11. Reviewer không viết những bổ sung F5 hoặc bản sửa session generation. F3 do reviewer này viết nên không được gọi là review độc lập F3.

**Ba khoảng trống oracle cụ thể của F5 đã được bổ sung phù hợp expected đã duyệt trong source hiện tại:**

- `tests/contracts/writeOperations.contract.test.ts:82`, `src/adapters/mock/writeOperationRepo.test.ts:58`, `tests/supabase/idempotencyPricing.spec.ts:18`: TC030 mỗi backend reset riêng nhánh new/old, kiểm add 129.000, paid new49.000/source80.000 hoặc paid old40.000/source89.000; identity dòng chuyển/copy, dòng nguồn còn lại, modifier quantity2/giá5.000–7.000/tên cũ–mới và receipt snapshot. DB/E2E kiểm cả số dòng/options và nguyên trạng các option nguồn. Manifest buộc đủ sáu execution TC030 (ba gốc và ba `/old`).
- `writeOperations.contract.test.ts:159`, mock `writeOperationRepo.test.ts:166`, E2E `idempotencyRecovery.spec.ts:106`: TC066 giữ businessDate08/09, paidAt10/09, K cũ expired, thanh toán mới150.000; DB gọi SupabaseReportRepo thật và E2E mở UI report kiểm ngày cũ150.000/ngày mới0. Mock bổ sung report riêng; manifest giữ DB/E2E bắt buộc đúng mức đã duyệt, không quảng bá mock như backend DB.
- `tests/contracts/writeFaults.contract.test.ts:257`: TC085 tạo DB con cách ly mới, áp thực 001–013 trước khi dựng legacy. Có open, paid, void-paid và void-open; bốn dòng với bốn option snapshot và hai payment. So toàn bộ cột cũ trước/sau014–016, kiểm giá30.000/Q5.000/quantity2 khác catalog40.000/Q7.000, giữ payment và thông tin void, backfill mới đúng/null không suy diễn creator. Sau upgrade gọi receipt legacy paid80.000/nhận100.000/thối20.000, void trả RECEIPT_UNAVAILABLE, open cũ thanh toán được, onboarding hoạt động. Auth trong DB con là SQL shim được chú thích, không phải GoTrue/browser evidence.

Tự chạy thêm: `node node_modules/vitest/vitest.mjs run src/adapters/mock/writeOperationRepo.test.ts src/app/writeSessionGeneration.test.tsx -t 'TC-IDEM-(030|066|053)' --reporter=verbose --reporter=json --outputFile=artifacts/p2-cross-review-f5-mock.json --allowOnly=false`: **4 PASS, 30 filtered/skipped**, không tính 30 case chưa chạy là pass. Đây là hai TC030 mock, TC066 mock và TC053 session generation. `WriteLifecycle` nay gọi leave khi `employeeSessionVersion` thay đổi; hash `6a1598201bab7d98c085795398566ca2e7338c51f309f7ac399714ccf9b88fb9`.

Đọc manifest trực tiếp bằng Node và gọi `assertManifest`: 758 required, sáu TC030, TC066 DB/E2E, một TC085 DB, thêm TC053/core/session=same_employee. Có hai lệch docs đã báo root sửa trước chốt: đoạn cập nhật cuối `traceability.md` còn ghi757 thay vì758 và gắn TC066 với IDEM-10 thay vì IDEM-11/12/28. Đây là lỗi trình bày/truy vết; không phải finding triển khai mới. Testplan phần chính TC066 vẫn ghi đúng requirement và expected.

Giới hạn: reviewer chỉ đọc source DB/E2E F5, không chạy lại trong đợt cross-review này do root giữ lease chạy gate cuối. Không suy rộng bốn test vừa chạy thành toàn bộ F5 hoặc full gate. Không tái audit toàn bộ 93 testcase trong bước bổ sung này; kết luận tập trung vào ba khoảng trống đã nêu ở F5 ban đầu. Các kết quả root/reviewer khác phải được ghi theo người chạy và backend tương ứng.
