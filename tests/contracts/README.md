# Kiểm thử giao thức ghi chống trùng

Bộ kiểm thử này chạy trên database riêng. Không dùng `.env.local` của ứng dụng để
chọn database, không dùng service-role làm người gọi nghiệp vụ, và không chạy
migration hay dọn dữ liệu trên project Supabase đang dùng.

## Chạy kiểm thử

Đặt `IDEM_ENV_FILE` tới file cấu hình riêng, ngoài git. File cần các biến:

```text
VITE_DATA_MODE
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
IDEM_OBSERVER_DSN
IDEM_STORE_JWT
IDEM_STORE_S2_JWT
IDEM_TEST_MARKER
IDEM_TEST_ENGINE
IDEM_FIXTURE_STORE_IDS
IDEM_TEST_STORE_KEY
```

URL API và DSN phải là loopback; database phải có tiền tố
`pos_cafe_idem_test_`. Marker riêng, danh sách hai store fixture và SHA-256 của
mọi migration phải khớp. Preflight tạo employee session qua API, kiểm token hash
trong observer DB, thu hồi qua API rồi kiểm lại observer. Cách này chứng minh
API và observer trỏ tới cùng instance trước khi cho phép reset fixture.

```powershell
$env:IDEM_ENV_FILE = 'C:/path/to/private/idempotency.env'
npm run test:idempotency:discover
npm run test:idempotency:unit
npm run test:contracts
npm run test:idempotency:tools
npm run test:idempotency:e2e
npm run test:idempotency:verify-results
```

Chạy các stage lần lượt, sau khi đã dừng sửa source. Contracts, tools và E2E
cùng reset fixture; không chạy chúng đồng thời trên một DB. Có thể truyền bộ lọc
sau tên stage để chẩn đoán; kết quả chạy riêng không thỏa gate toàn bộ.

## Môi trường và giới hạn

`scripts/idempotency-local-bootstrap.mjs` tạo database mới cho PostgreSQL và
PostgREST cục bộ. Nó dùng lớp tương thích `auth` để chạy contract SQL/API; lớp này
không phải GoTrue và không đủ điều kiện chạy browser E2E.

E2E chấp nhận engine `supabase` hoặc `postgres-postgrest-gotrue`, yêu cầu GoTrue
Auth hoạt động thật. Kiểm thử browser ghép Store Key bằng password login, tạo
store bằng signup, nhập PIN và gọi PostgREST thật. Bản runtime native gồm
PostgreSQL, PostgREST và GoTrue chỉ chứng minh phạm vi Auth/REST của change này;
không chứng minh Storage API hoặc Realtime. Proxy cục bộ chỉ phục vụ runtime test.

Fixture, clock và trigger gây lỗi nằm trong DB riêng, chỉ observer truy cập.
RPC ứng dụng không cung cấp endpoint chỉnh giờ hoặc gây lỗi. Fixture reset tắt
trigger chỉ trong transaction dọn dữ liệu; bật lại trước khi người gọi nghiệp vụ
thực thi. Race chờ khóa có PID khác nhau và ghi bằng chứng `pg_blocking_pids`,
virtual transaction, XID khi đã được cấp. XID null trước lần ghi đầu tiên được
ghi rõ, không tự gán một XID giả.

## Bằng chứng và gate

`caseCatalog.json` chứa 93 TC gốc và oracle từ testplan đã duyệt. `caseManifest.ts`
mở rộng chúng thành các execution bắt buộc theo backend và suffix. Catalog hoặc
discovery đầy đủ chỉ chứng minh test tồn tại; chưa chứng minh hành vi đã pass.

Các stage sinh report, hash source trước/sau, hash report và metadata riêng trong
`artifacts/`. Vitest reporter bổ sung options thực tế để không chấp nhận
`test.fails`, retry, repeat hoặc only như một pass bình thường. Playwright retry,
expected failure và skip cũng không thỏa yêu cầu. Thiếu test, trùng tên, sai
backend, skip, failure, report cũ hoặc source thay đổi giữa lúc chạy đều làm gate
thất bại. Các test bổ sung không thay thế execution bắt buộc bị thiếu.

Oracle nghiệp vụ dùng số tiền literal và snapshot observer; không gọi helper
tính tổng/in hóa đơn của ứng dụng để xây expected. TC088 sửa SUT trong bản sao
isolated và yêu cầu baseline pass, mỗi mutant bị assertion phù hợp bắt được.
Lỗi compile hoặc không tìm thấy test không được tính là đã bắt mutant.

Snapshot nghiệp vụ ở `artifacts/idempotency-snapshots/`, barrier race ở
`artifacts/idempotency-races/`. Runner xóa credential test đã biết khỏi report và
DOM failure snapshot trước khi tính hash; không commit file cấu hình credential.
