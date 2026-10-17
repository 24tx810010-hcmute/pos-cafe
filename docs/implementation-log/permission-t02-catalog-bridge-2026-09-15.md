# PERM-T02 — Catalog bổ sung và bridge quyền legacy

Ngày 2026-09-15. Chủ dự án cho phép bắt đầu T02 sau khi bỏ vai trò Kế toán. **T02 hoàn tất trong phạm vi code local và môi trường test cách ly; T03–T18 chưa thực hiện.** Chưa commit/push, chưa kết nối hoặc áp migration lên dự án Supabase thật. Ứng dụng chưa activate mô hình 15 quyền và chưa thay UI.

## Kết quả và phạm vi

[Migration 017](D:/Workspace/pos-cafe/supabase/migrations/017_permission_catalog_bridge.sql:1) thêm catalog năm role, 15 quyền, defaults, revision và registry private. Owner/manager/cashier/waiter có lần lượt 15/12/7/3 quyền; kitchen rỗng/chưa bật; không có accountant. Bốn role hoạt động giữ floor.view. Catalog và registry chưa cho app đọc/ghi trực tiếp; endpoint authority/quản trị sẽ do T03–T05 cung cấp.

Bridge có catalog legacy riêng trong private cho admin/cashier/kitchen và năm quyền cũ. Wrapper `public.has_employee_permission` đọc dữ liệu bridge, giữ semantics cũ về grant/deny, null và active guard ở caller. Không chuyển enum employees.role, không promote owner, không dùng defaults candidate cho client cũ. Chính sách module/UI vẫn theo legacy. Toàn bộ `src/` và migrations 001–016 giữ nguyên bytes.

Revision catalog được khóa trước khi sửa dữ liệu, tăng một lần mỗi transaction thực sự thay đổi. No-op UPDATE không tăng; hai writer đồng thời đã được chứng minh chờ khóa DB và không mất lần tăng. Constraints giữ đủ catalog, owner defaults, floor baseline, kitchen disabled/rỗng và revision không âm. Chuẩn hóa overrides kiểm kiểu/mã, array 100/101, khử trùng, deny thắng, floor baseline và owner-only. Hợp đồng patch/DTO/UI vẫn thuộc task tiếp theo.

Registry quản trị/bootstrap và MAC key nằm trong private, không cấp quyền app/service_role hoặc thêm publication. Chưa có RPC sử dụng registry nên không gọi đây là tính năng quản trị/audit đã hoàn tất. Quyền authenticated USAGE private và is_verified_admin phục vụ RLS phase27 được giữ đúng; không áp blanket-deny sai baseline.

[Revert rehearsal](D:/Workspace/pos-cafe/scripts/sql/permission-t02-revert.sql:1) chỉ dành cho trước activation; từ chối nếu revision nhân viên đã được dùng, có registry quản trị/bootstrap hoặc role đã chuyển kiểu. DROP dùng RESTRICT. Test áp migration đã commit, kiểm hành vi, gỡ và đối chiếu lại helper trên đủ 6.144 hồ sơ; dữ liệu legacy, credential/session, pending/terminal K, payload/R1 và ACL cũ không mất. Harness khôi phục thêm định nghĩa helper nguyên văn để fixture quay về baseline trước lần chạy sau. Đây không phải phương án rollback sau rollout.

## Phụ thuộc và môi trường

Đầu T02 phát hiện 11 dependency trực tiếp đang cài khác package-lock, gồm Vitest 4.1.10 so với lock 4.1.11. Đã chạy `npm ci --no-audit --no-fund` và kiểm lại bộ thư viện cài theo lock; không sửa hai lockfile. Node 24.16.0; Vite 8.0.16; Vitest 4.1.11. Pnpm lock được giữ nguyên để không mất thay đổi ngoài task, được tính trong source fingerprint nhưng không dùng cho lần cài này.

| Thành phần | Bản thực dùng |
| --- | --- |
| WSL | Ubuntu-24.04, WSL2 |
| Docker | Ubuntu package docker.io, Engine 29.1.3 |
| Supabase CLI | 2.117.0, archive Linux amd64 đã kiểm SHA-256 `69c05f85b9e47ee706d30f1a6ca8a526b4e337bfd12c7ef1ef522d24e7280d24` |
| PostgreSQL full stack | Image supabase/postgres:17.6.1.167 |
| Auth / REST | GoTrue v2.196.0 / PostgREST v16.2 |
| Storage / Realtime | storage-api v1.72.1 / realtime v2.130.0 |
| Project/network/DB volume | pos-cafe-perm-t02-20260915 / cùng tên network / supabase_db_pos-cafe-perm-t02-20260915 |
| API / DB | 127.0.0.1:58421 / 127.0.0.1:58422, database postgres trong dedicated volume |
| Config | [runtime/config.toml](D:/Workspace/pos-cafe/tests/permissions/runtime/config.toml:1), canonical hash `81c9d4b0e5c518fecd213a1e36ab8804b6590172601e1690d54c2f07adb21f87` |

Toàn bộ 12 container, image IDs, trạng thái và port bindings thực nằm trong evidence. Storage, Realtime, Auth và REST là service thật, không dùng bảng Storage giả của native fixture. Imgproxy/pooler không bật theo config; không cần cho phạm vi T02. Chưa đo tải, latency Realtime, thao tác gateway Storage hoặc kiểm bản PostgreSQL của production.

Cổng 602xx thử ban đầu rơi vào dải Windows đã dành riêng, nên chuyển config sang 5842x; không sửa loại trừ cổng Windows. Network Docker đặt `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`; binding thực đã kiểm localhost. Hai relay socat thử khi chẩn đoán đã dừng, không dùng trong runtime nghiệm thu. Chỉ dùng Supabase CLI/container local; Supabase MCP không được gọi trong task.

Nguồn chuẩn bị công cụ: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [release CLI 2.117.0](https://github.com/supabase/cli/releases/tag/v2.117.0). Chỉ dùng tài liệu công cụ, không suy service PASS từ hướng dẫn.

## Bằng chứng kiểm thử

Code HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, gồm thay đổi T01/T02 chưa commit. **Source fingerprint nghiệm thu: `e25599ee0e5368b7a8ef26066db5449b48a5e5c536e54438b3637f4dea3dd112`.** Không dùng riêng HEAD hoặc kết quả ở fingerprint trước để đóng T02.

| Bộ kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| T02, profile supabase-bridge-v1 | 52/52 test; 6.144/6.144 hồ sơ comparison; không skip/retry/expected-failure | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/1ec94d77-31d6-4421-9036-50d0d2eb5d54/verification.json), [evidence.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/1ec94d77-31d6-4421-9036-50d0d2eb5d54/evidence.json) |
| Regression T01 native legacy | 152 tool + 30 PostgreSQL tests, preflight READY | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/50b67fd0-797e-4bc5-9bb9-aa6d8b515855/verification.json) |
| Unit/component ứng dụng | 637/637 test, 65 file; gồm guard, quyền UI, employee drawer và architecture | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02-unit-c57378e1-7d88-49aa-b4c8-75413609d6d3/verification.json) |
| TypeScript và production build | PASS | `npm run build`; chỉ cảnh báo chunk lớn đã biết |
| Kiểm tài liệu và truy vết | 33 file Markdown; 30 requirement, 15 UC, 60 TC; không requirement/UC thiếu TC; không lỗi liên kết/ma trận | [docs-verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/1ec94d77-31d6-4421-9036-50d0d2eb5d54/docs-verification.json); chỉ T01/T02 được đánh hoàn tất |

6.144 là hồ sơ tham số hóa trong TC50, không phải 6.144 TC nghiệp vụ. T02 runner đối chiếu discovery/results/options và [manifest 52 biến thể](D:/Workspace/pos-cafe/tests/contracts/permissionBridgeCases.json:1); report chỉ serialize metadata đã chọn, không stack/SQL row/secret. Source, runtime và profile được ghi riêng. Bộ unit cũng đối chiếu discovery với options thực, không tính test bị skip là PASS.

Các kiểm chứng chính:

- SQL catalog/defaults từng mã (75 ô), chuẩn hóa overrides và fixture waiter chỉ xem; grant reprint không cấp payment.take.
- 6.144 hồ sơ so đồng thời expected độc lập T01, helper SQL 012 gốc, wrapper/bridge mới và guard/module UI legacy; kiểm thêm null, duplicate và unknown grant giữ semantics cũ.
- Auth tạo/đăng nhập tài khoản synthetic thật; RPC marker riêng fixture chứng minh REST và observer cùng DB/store. Sai config/profile/marker/engine/phase bị chặn; private schema không expose qua REST.
- Tạo/sửa đơn, hủy đơn mở, tách thanh toán, thu tiền, hủy paid, replay cùng K/R1 và revoke session qua REST thật. Thu payment.take sau register trả FORBIDDEN, không hủy K pending hoặc sinh payment.
- Mỗi run tạo K pending qua RPC trước additive và có K terminal từ fixture; kiểm invariants trước/sau additive/revert. Schema variants dùng rollback; các HTTP positive controls dùng UUID mới riêng, giữ dữ liệu synthetic để kiểm revert không xóa giao dịch.
- Catalog/registry/key không app SELECT/DML/EXECUTE; raw financial writes và overload cũ không được mở lại. SQL và REST có cả positive control và denial.

TC01/04 đã có SQL implementation tại [permissionBridge.contract.test.ts](D:/Workspace/pos-cafe/tests/contracts/permissionBridge.contract.test.ts:1); phần core/DTO/patch/UI dự kiến của hai TC vẫn thuộc T03/T05. TC50 đạt gate T02 gồm parity, Auth/REST và regression UI legacy; chưa có candidate UI/E2E hoặc rollout để nghiệm thu cả feature. T09/T10 vẫn cần chạy gateway/Storage và Realtime hai client thật, không lấy health trong T02 thay bằng chứng hành vi đó.

## Tái chạy trên máy này

Sau nghiệm thu dừng stack T02 và cụm PostgreSQL T01 riêng, giữ dữ liệu/volume. Docker/CLI đã cài trong WSL và được giữ để dùng tiếp. Không dừng toàn WSL hoặc container của dự án khác.

Khởi động lại stack đã có (PowerShell):

```powershell
wsl -d Ubuntu-24.04 -- systemctl start docker
wsl -d Ubuntu-24.04 -- /var/tmp/pos-cafe-perm-t02-20260915/bin/supabase start --workdir /var/tmp/pos-cafe-perm-t02-20260915/stack --network-id pos-cafe-perm-t02-20260915
node scripts/permission-bridge-runtime.mjs refresh C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t02-20260915/fixture
$env:IDEM_ENV_FILE = 'C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t02-20260915/fixture/bridge.env'
node scripts/permission-bridge-verify.mjs
```

Chạy từ worktree code. Refresh là setup có mutation Auth synthetic trước snapshot, không phải công cụ T01 chỉ đọc; dùng refresh token ngoài repo, không sửa employee PIN/role. Môi trường test và secret không đọc từ .env.local. Lần dựng mới dùng CLI đúng version, config trong repo và network localhost ở trên, rồi gọi `node scripts/permission-bridge-runtime.mjs bootstrap <runtimeDirectoryNgoàiRepo>`; bootstrap từ chối DB đã có stores hoặc control hiện hữu, không tự reset môi trường lạ. Khi cần dựng lại toàn bộ phải xác minh dedicated project/volume và backup dữ liệu test trước khi chọn cách dọn, không dùng lệnh reset mặc định với dự án thật.

T01 vẫn dùng observer.env/cụm riêng theo [runbook T01](permission-t01-preflight-2026-09-15.md). Profile legacy được khóa migrations 001–016; full bridge kiểm hash baseline 001–016 và migration017 riêng. Hàm observer mặc định của phase27 vẫn kiểm toàn bộ bundle; tham số through=16 chỉ do caller legacy T01 truyền, không lấy từ config để bỏ qua migration tùy ý.

## Bàn giao T03

Đầu vào là migration/catalog/normalization đã kiểm, manifest runtime và fixture bridge. T03 đưa catalog vào domain/ports/mock và authority DTO; vẫn giữ bridge đến khi các consumer đổi xong. Không tự activate role hoặc đổi điều hướng trong T02. Các việc bảo vệ đọc/ghi đủ 15 quyền, owner/audit/recovery, cập nhật quyền đa thiết bị và in lại theo Q15 tiếp tục theo tasks đã chốt.

## Regression khi hoàn tất T03, 2026-09-15

T02 được chạy lại52/52 test,6.144 comparison và revert PASS cùng source T03 `925b167be58eff127514aa5930c723607a13a864af62e45258d5d8e7810cc94e`; xem [biên bản T03](permission-t03-domain-ports-mock-2026-09-15.md). Migrations001–017 giữ nguyên. Khi restart WSL, giữ một tiến trình nền trong suốt gate như runbook T03 trước khi start stack; không nới health check để bỏ service.

**Regression sau T04, 2026-09-16:** xem [biên bản T04](permission-t04-identity-owner-sessions-2026-09-16.md) tại source `946c6dfd0b01e80ca2790790fed6d5bb92b8a67e4d792e08e5fbc456cb0b6e74`. Bằng chứng ở trên giữ nguyên cho checkpoint lịch sử; kết quả T04 không thay thế gate consumer/service/activation còn lại.

**Regression sau T05, 2026-09-16:** xem [biên bản T05](permission-t05-employee-administration-audit-2026-09-16.md) tại source `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`. Giữ bằng chứng trên cho checkpoint lịch sử; consumer/service/activation còn lại chưa được thay bằng gate administration.

**Regression sau T06, 2026-09-16:** xem [biên bản T06](permission-t06-financial-authority-2026-09-16.md) tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. Giữ các kết quả trên cho checkpoint lịch sử; T06 không thay gate consumer/service/activation còn lại.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
