# F3 — Số JSON nguyên có biểu diễn thập phân

Ngày kiểm: 2026-09-11. Base SHA `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`, thay đổi chưa commit. Node `24.16.0`; DB `pos_cafe_idem_test_auth_938220e75d16`, API `http://127.0.0.1:55444`, backend `postgres-postgrest-gotrue`. Không dùng `.env.local`, Supabase thật hoặc mock thay DB.

## Thay đổi

- `supabase/migrations/015_write_business_helpers.sql:97`: số đã qua `valid_integer` được đọc qua `numeric` rồi `integer`/`bigint`; payload đã register không đổi.
- `015_write_business_helpers.sql:153`: projection `jsonb_to_recordset` dùng `quantity numeric`, tránh lỗi `1.0` trước bước kiểm tách toàn bộ đơn. Đây là điểm cast ẩn ngoài các biểu thức `->>`.
- `tests/contracts/writeNumericWire.contract.test.ts:96`: 16 execution raw-wire cho 8 thao tác/nhánh × decimal/exponent. Kiểm register chỉ ledger, execute bằng dạng số nguyên tương đương, replay cùng K/R1, dữ liệu nghiệp vụ và `payload::text` bất biến.
- `writeNumericWire.contract.test.ts:124`: 30 execution cho 10 trường số × phân số/dưới min/vượt max; từ chối trước register, không tác dụng phụ, có control hợp lệ qua execute cho từng trường.

## Kiểm tra tự chạy

Thiết lập `IDEM_ENV_FILE=C:/Users/nguye/AppData/Local/Temp/pos-cafe-p2-fix-20260911/gotrue-stack/idempotency.env`; preflight có `requireBrowserStack:true` trước/sau. Root cấp lease độc quyền; không suite nào reset DB đồng thời.

1. `node --experimental-strip-types --check tests/contracts/writeNumericWire.contract.test.ts` và `git diff --check`: PASS.
2. `node node_modules/vitest/vitest.mjs run --config vitest.contract.config.ts tests/contracts/writeNumericWire.contract.test.ts --reporter=verbose --reporter=json --outputFile=artifacts/p2-numeric-targeted.json --allowOnly=false`: **46/46 PASS**.
3. `node artifacts/p2-numeric-mutation.mjs`: thay tạm hai definition `prepare_write`/`apply_write` bằng đúng baseline 3ada48c, chỉ ở DB cách ly. **8/8 decimal cases FAIL** tại lỗi cast; 38 case bị filter không được tính pass. Không đổi checksum marker. `finally` khôi phục hai definition, hash khớp trước, postflight PASS. Chi tiết `p2-numeric-mutation-summary.json` và `p2-numeric-mutant.json/.log`.
4. `node node_modules/vitest/vitest.mjs run --config vitest.contract.config.ts tests/contracts/writeNumericWire.contract.test.ts --reporter=dot --reporter=json --outputFile=artifacts/p2-numeric-restored.json --allowOnly=false`: **46/46 PASS** sau khôi phục. Postflight cuối PASS.

Đây là kiểm chứng tập trung F3; chưa phải bằng chứng full gate. Không sửa manifest, docs hoặc các file F1/F2/F4/F5 trong subtask này. Không commit/push/deploy; không áp migration lên DB thật.
