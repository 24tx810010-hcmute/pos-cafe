# PERM-T01 — Baseline, preflight chỉ đọc và oracle bridge

Ngày 2026-09-15. **PERM-T01 hoàn tất và đã kiểm chứng trên fixture cách ly.** Chủ dự án đã cho phép viết code và cập nhật docs, yêu cầu không push. Phạm vi là T01 trong [tasks](../../openspec/changes/redesign-permission-model/tasks.md); T02–T18 chưa thực hiện. Không kết luận mô hình 15 quyền đã được triển khai.

## Baseline và thay đổi

Code ở `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479`; docs ở worktree riêng `D:/Workspace/pos-cafe-docs`, `docs@f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` cộng các thay đổi đã có từ task spec/review. Không đổi file migration 001–016 hoặc code ứng dụng trong src. Không commit/push/deploy.

N01–N03 đã được xử lý trong design/testplan/tasks/limitations: thống nhất 50 message ID và phân loại error/status/success; T01 dùng cấu hình observer riêng; giới hạn tải ảnh công khai được mô tả đúng là phần chưa có cơ chế giới hạn lưu lượng riêng. Không thêm chức năng ảnh, schema hoặc UI trong task này.

Các file code mới nằm ở nhóm [scripts/permission](D:/Workspace/pos-cafe/scripts/permission-preflight.mjs), [test DB T01](D:/Workspace/pos-cafe/tests/contracts/permissionMigration.contract.test.ts), năm file permission*.tool.test.ts và [catalog ca bắt buộc](D:/Workspace/pos-cafe/tests/contracts/permissionCaseCatalog.json). Các thay đổi vào file cũ giới hạn ở script package.json, tách observer gate dùng chung từ preflight phase27 và exclude suite T01 khỏi cấu hình DB phase27. Không tắt gate của suite cũ.

## Cách công cụ hoạt động

`permission-preflight.mjs static` chỉ khảo sát source và xuất 6.144 hồ sơ expected độc lập: 3 role legacy × 2 trạng thái active × 4 trạng thái của từng mã trong 5 quyền cũ. Artifact mang nguồn oracle và ghi rõ chưa chạy helper bridge.

`permission-preflight.mjs run` chỉ nhận profile `legacy-observer-v1` từ IDEM_ENV_FILE được chỉ định. Công cụ từ chối .env/.env.local, DSN không loopback, tên DB/fixture/profile không khớp. Gate kiểm database, marker/engine/store IDs, 16 checksum nguồn, catalog quan sát và private grants. Observer phải đọc được đầy đủ fixture; RLS không được lọc mất cửa hàng mà không báo lỗi. Phải thấy đúng S1/S2 trước khi lập đề xuất.

Trong transaction REPEATABLE READ READ ONLY, công cụ đọc metadata và projection nhân viên/cửa hàng, phát hiện owner mơ hồ, dữ liệu tên/override sai, mapping sai hoặc stale. UUID primary chỉ dùng discovery; không tự xác minh owner. Báo cáo có mapping đề xuất, quyền trước/sau, quyền thêm/bớt và blocker; mọi store phải READY mới đủ điều kiện của preflight. READY không phải lệnh activation hoặc chứng minh đã xác minh con người.

Quyền trước migration là quyền UI/action theo hành vi legacy; không gọi đó là quyền đọc DB đã được kiểm theo nhân viên. Kitchen legacy có thể còn quyền action qua override; oracle giữ đúng hành vi cũ. Owner/manager/cashier dự kiến có 15/12/7 quyền mặc định, chỉ dùng để tính chênh lệch, chưa áp vào ứng dụng.

Snapshot sau lấy trong transaction mới. Cả row được băm trong PostgreSQL để kiểm bất biến nội bộ; checksum chứa trường bí mật không được serialize. Báo cáo chỉ chứa count/hash từ danh sách trường cho phép. Mapping file được kiểm shape trước khi tạo bằng chứng; hash lấy từ chính dữ liệu đã được xét, không đọc lại file sau run.

Inventory gồm nguồn static và catalog public/private/storage: SELECT/DML theo bảng và cột, overload RPC, SECURITY DEFINER, grants hiệu lực/PUBLIC, policy hashes, publication membership và metadata bucket. Catalog hash bao gồm ACL, constraints, triggers, definitions và role metadata quan sát được. Đây là bằng chứng metadata; Auth/REST/Storage HTTP/Realtime và kiểm quyền nhân viên qua dịch vụ đều NOT_RUN.

## Runtime cách ly

Đã kiểm PATH/cache và lịch sử task theo gợi ý của chủ dự án. Chưa tìm thấy executable Supabase CLI trong Windows hoặc Ubuntu WSL được kiểm; task cũ có Supabase MCP và PostgreSQL/PostgREST/GoTrue native, không đủ bằng chứng kết luận CLI đã được cài. T01 dùng PostgreSQL 16.15 trong Ubuntu-24.04/WSL, cụm mới riêng tại `/var/tmp/pos-cafe-perm-t01-20260915/data`, loopback port 55449. Không dùng DB/stack phase27 cũ hoặc cửa hàng thật.

Bootstrap tạo DB tên ngẫu nhiên có tiền tố test, áp nguyên 16 migration, chuẩn bị hai cửa hàng legacy và dữ liệu synthetic. Auth/Storage chỉ có catalog prerequisites cần cho migration; không có bằng chứng dịch vụ tương ứng chạy. Fixture setup và reset có mutation riêng, nằm ngoài cửa sổ quan sát chỉ đọc. Fixture có đơn, dòng món, thanh toán, write ledger, order events, session hash và attribution; các ca bảo toàn không chỉ so bảng rỗng.

Node 24.16.0, Vitest 4.1.11; versions PostgreSQL/pg, checksum migration, source fingerprint và identity fixture được ghi ở report. T02 chịu trách nhiệm dựng full stack Supabase cho các gate sau.

## Kiểm chứng và review

Lượt cuối đạt **152/152 tool tests + 30/30 PostgreSQL tests**, runner exit 0 và verification.valid=true. `tsc -b` đạt. Source fingerprint trước/sau và kiểm lại sau typecheck cùng giá trị `300af0d6fb5f7b9e6e9767dbddd0123ec692b738d958e06f4fa35213aa0923c6`. Nguồn oracle giữ đủ 6.144 profile unique. Inventory có 204 surface ID, tất cả unique.

| Phần nghiệm thu | Kết quả và giới hạn |
| --- | --- |
| TC-PERM-48 | PASS biến thể preflight T01: S1 có mapping provenance synthetic, S2 có earliest active admin duy nhất; toàn TC vẫn PARTIAL, chưa activation |
| TC-PERM-49 | PASS các biến thể T01: dữ liệu/mapping/owner mơ hồ; bound tên và microsecond; observer/RLS; marker/checksum/catalog/private exposure; bảo toàn snapshot |
| TC-PERM-50 | Đủ 6.144 expected độc lập, PARTIAL; helper bridge và đối chiếu candidate NOT_RUN, thuộc T02 |
| Regression phase27 | Parser và full flow được kiểm bằng mock; config tách suite; không chạy lại full Auth/REST DB gate |
| Auth/REST/Storage/Realtime | NOT_RUN, ngoài phạm vi T01 observer-only |

DB cuối là `pos_cafe_idem_test_perm_0c90ae1a267f`. Catalog hash `646c1209047b0c21429d359454c9a5edb7c6a2d650efa72115b64e256af3b4cb`; public snapshot trước/sau `184597efcc184909d19705de3d15d0ff90c77855fbaf33dd7d34f36aa2041af9`. So sánh nội bộ toàn row cũng đạt. Fixture có 5 nhân viên, 5 phiên, 4 đơn, 4 dòng món, 2 thanh toán, 2 write operations và 2 order events. Đơn có identity attribution. Không tạo/revoke phiên từ công cụ preflight.

S1 đề xuất primary `010226d1-5d17-59c0-8232-62bf3a0f6f29` theo mapping đã cung cấp; S2 đề xuất `20000000-0000-4000-8000-000000000004` theo earliest duy nhất. Các admin còn lại khi thành manager sẽ mất `data.clearDemo`, `employee.permission.edit`, `settings.manage` theo defaults mới; chênh lệch này được báo, chưa áp. Cashier fixture không đổi quyền.

Bằng chứng chính là [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/a52cf536-1221-45c1-a66a-fef55d7f43ac/verification.json), SHA256 `12bc732d9afcca6e3059dfa44f9241dce465373694705cde5c178924624f221f`. File này liên kết discovery/results/options/profiles cùng hash, source và identity DB của mọi execution. Manifest ca bắt buộc là dữ liệu literal đã review; runner không tự sinh lại từ discovery. Thiếu một variant trong file còn test khác, sai profile hoặc thiếu event đều làm gate thất bại. Bốn direct controls có 0 event, 25 case có 1 và case mapping có 2, khóa độc lập trong catalog.

Run preflight được verification liên kết: `27c1c3fd-3a85-4366-8017-8e6a04518996`. `manifest.json` của CLI chỉ mô tả lượt standalone, nên TC49 trong đó vẫn NOT_RUN; kết quả suite TC49 nằm ở verification.json. Không dùng manifest standalone thay cho report của suite.

| Artifact | SHA256 |
| --- | --- |
| [inventory.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/27c1c3fd-3a85-4366-8017-8e6a04518996/inventory.json) | 557feb43ca6c611d6150119b1f33059f9b021f94b6366cfc37331cf3a543fdff |
| [preflight.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/27c1c3fd-3a85-4366-8017-8e6a04518996/preflight.json) | a8216330250278876a271f934e0d3afd5e07410e5860e52de78d0c658f997ef1 |
| [bridge-oracle.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/27c1c3fd-3a85-4366-8017-8e6a04518996/bridge-oracle.json) | 688c612391de21884a876a56f6b355b73961dacbb3e2e9da6d8fb3738fae6821 |
| [manifest.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/27c1c3fd-3a85-4366-8017-8e6a04518996/manifest.json) | f08a1f61c3438ac649f38acd545504655d7cd613791654340f19ee82d4c9a268 |

Chỉ chấp nhận report khớp discovery, kết quả thực thi và actual runner options: không skip/todo/test.fails/retry/repeats/only. Reporter riêng chỉ serialize tên/status/count và actual options, không ghi exception/diff/stack tùy ý. Có negative tests cho thiếu variant, thiếu/sai event/profile và sentinel PIN/hash/MAC. Review bảo mật cuối đã khép V01–V03 về bằng chứng.

Review bảo mật độc lập đã phát hiện và kiểm lại ba sửa đổi: observer bị RLS lọc; digest của trường bí mật và mapping chưa kiểm; glob suite phase27 nạp nhầm test T01. Kiểm DB còn đính chính mô tả private schema: migration 016 đã cấp authenticated USAGE private + EXECUTE is_verified_admin cho RLS. Gate T01 giữ grant baseline này, chặn anon USAGE và marker/write_clock bị lộ; inventory hash kiểm drift. Không sửa migration hoặc revoke quyền hợp lệ để làm test đạt. Review nghiệp vụ không phát hiện sai lệch trong planner/oracle so với design8/T01. Các review này là đọc code, không thay cho kết quả runtime.

Các lần chạy thăm dò không dùng để nghiệm thu: lỗi SQL inventory do ACL array rỗng; fixture observer thiếu BYPASSRLS; seed dùng cột đã bị migration cũ loại; blanket private-USAGE gate trái baseline016; suite tooling rộng chạy nhầm gate phase27 cần full API config và dừng `VITE_DATA_MODE_MUST_BE_SUPABASE` (147 pass/1 fail). Lượt dựng verifier cũng bắt được tên test tham số trùng/không ổn định và lỗi redaction chuỗi JSON; đã dùng tên ca cố định, duy nhất và xử lý JSON theo cấu trúc. Đã sửa lỗi thuộc T01 và tách runner đúng phạm vi; gate API phase27 không được báo đã chạy lại. Parser và toàn chuỗi phase27 start/binding/capability/revoke/Auth-health được kiểm hồi quy bằng mock riêng.

## Bảo toàn workspace

Lockfile pnpm-lock.yaml đã có trước task và không thuộc thay đổi cần bàn giao. Một lệnh pnpm của subagent đã tự cài dependency và ghi đè file này. Đã dừng pnpm, tìm bản gốc trong Git capture của Codex, khôi phục byte chính xác và chạy `npm ci --ignore-scripts` theo package-lock.json hiện có. SHA256 lockfile trước/sau khôi phục: `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`. Package-lock.json không đổi. Các kết quả nghiệm thu cuối dùng Vitest 4.1.11 sau khôi phục.

Snapshot docs trước task và bản sao lockfile nằm trong thư mục tạm `pos-cafe-perm-t01-before-20260915`. Đối chiếu 299 file Markdown trước task: 289 file giữ nguyên hash, 10 file thay đổi đúng phạm vi, không mất file; thêm biên bản này. Review lịch sử chỉ bổ sung ghi chú liên kết khi source đổi số dòng. Kiểm tài liệu đạt 30 requirement/15 UC/60 TC/18 task/13 file spec, 50 message ID khớp M0, không lỗi truy vết/liên kết; chỉ checkbox T01 được đóng.

## Chạy lại

Sau nghiệm thu đã dừng riêng cụm PostgreSQL T01; dữ liệu fixture vẫn giữ trên đĩa. Muốn chạy lại, khởi động đúng cụm riêng này:

```powershell
wsl -d Ubuntu-24.04 -- runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pos-cafe-perm-t01-20260915/data -l /var/tmp/pos-cafe-perm-t01-20260915/server.log -o '-h 127.0.0.1 -p 55449 -k /var/tmp/pos-cafe-perm-t01-20260915/socket' -w start
```

Trong PowerShell, đặt IDEM_ENV_FILE trỏ đúng observer.env synthetic đã được bootstrap; file này nằm ngoài repo trong thư mục tạm `pos-cafe-perm-t01-runtime-20260915`. Không dùng .env ứng dụng. Lệnh kiểm tra và sinh report:

```powershell
$env:IDEM_ENV_FILE = 'C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t01-runtime-20260915/observer.env'
node scripts/permission-verify.mjs --mapping C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t01-runtime-20260915/primary-mapping.json
```

Runner chỉ reset DB fixture khi database/marker/data_directory khớp fixture-control được tạo cùng bootstrap; không tự dò môi trường thật. Mapping primary dùng tham chiếu synthetic và snapshot của fixture. Test reset xong làm mới mapping synthetic cho lần chạy sau. Mỗi run tạo thư mục UUID mới dưới artifacts/permissions/t01, không ghi đè report cũ.

Muốn dựng fixture mới, gọi export bootstrapFixture của [permission-fixture-bootstrap.mjs](D:/Workspace/pos-cafe/scripts/permission-fixture-bootstrap.mjs) với adminDsn cách ly, expectedDataDirectory chính xác và runtimeDirectory mới. Bootstrap kiểm loopback + data_directory trước CREATE DATABASE; không nhận live target. Không ghi DSN hoặc fixture-control vào report. Dữ liệu test có thể giữ trên đĩa khi dừng cụm riêng; không dừng WSL hoặc dịch vụ khác.

Điểm dừng của T01 là bàn giao công cụ và bằng chứng trên fixture. T02 additive schema/bridge, server enforcement, UI, activation và rollout chưa được thực hiện.

## Cập nhật sau nghiệm thu, 2026-09-15

Chủ dự án chốt bỏ role Kế toán, giữ 15 quyền và yêu cầu cập nhật tài liệu/chuẩn bị T02. Quyết định, fixture thay thế và đầu vào code nằm trong [bàn giao T02](../reviews/2026-09-14-permission-model/11-bo-ke-toan-chuan-bi-t02-2026-09-15.md). Không sửa kết quả lịch sử T01 thành kết quả của catalog mới.

Lúc bắt đầu lượt cập nhật docs này, source fingerprint hiện tại khác fingerprint của lần nghiệm thu T01 do bytes `pnpm-lock.yaml` đã khác. Đối chiếu dùng hash lock của lần nghiệm thu tái tạo đúng fingerprint T01 cũ; không phát hiện phần khác của source fingerprint bị lệch. Giữ nguyên lock hiện tại, ghi hai baseline tại bàn giao và yêu cầu khóa baseline/chạy lại gate phù hợp khi code T02. Các số 152 + 30 ở trên vẫn thuộc lần chạy T01 đã dẫn, không phải kiểm thử runtime mới của lượt docs.

## Đối chiếu lại khi hoàn tất T02, 2026-09-15

Đã giữ nguyên hai lockfile, cài lại bằng npm ci theo package-lock và chạy regression T01 152 tool + 30 DB tests đạt ở source fingerprint `e25599ee0e5368b7a8ef26066db5449b48a5e5c536e54438b3637f4dea3dd112`. [Biên bản T02](permission-t02-catalog-bridge-2026-09-15.md) liên kết verification mới, runtime bridge và các gate cùng source. T01 native chỉ áp/đối chiếu migrations 001–016 qua caller cố định; observer mặc định của phase27 vẫn kiểm toàn bundle. Những kết quả/fingerprint ban đầu phía trên giữ nguyên tính lịch sử.

## Regression khi hoàn tất T03, 2026-09-15

T01 được chạy lại đầy đủ152 tool +30 DB, preflight READY tại source `925b167be58eff127514aa5930c723607a13a864af62e45258d5d8e7810cc94e`. [Biên bản T03](permission-t03-domain-ports-mock-2026-09-15.md) liên kết report và ghi điều chỉnh runtime sau restart (port55449 được lưu trong config cụm riêng). Không thay kết quả lịch sử hoặc lấy lần thất bại kết nối trước đó làm PASS.

**Regression sau T04, 2026-09-16:** xem [biên bản T04](permission-t04-identity-owner-sessions-2026-09-16.md) tại source `946c6dfd0b01e80ca2790790fed6d5bb92b8a67e4d792e08e5fbc456cb0b6e74`. Bằng chứng ở trên giữ nguyên cho checkpoint lịch sử; kết quả T04 không thay thế gate consumer/service/activation còn lại.

**Regression sau T05, 2026-09-16:** xem [biên bản T05](permission-t05-employee-administration-audit-2026-09-16.md) tại source `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`. Giữ bằng chứng trên cho checkpoint lịch sử; consumer/service/activation còn lại chưa được thay bằng gate administration.

**Regression sau T06, 2026-09-16:** xem [biên bản T06](permission-t06-financial-authority-2026-09-16.md) tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. Giữ các kết quả trên cho checkpoint lịch sử; T06 không thay gate consumer/service/activation còn lại.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
