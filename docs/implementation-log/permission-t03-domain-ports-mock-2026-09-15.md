# PERM-T03 — Domain, core, ports và mock theo catalog

Ngày 2026-09-15. **T03 hoàn tất local theo yêu cầu chủ dự án; T04–T18 chưa thực hiện.** Chủ dự án cho phép push file liên quan nếu cần; T03 không cần push, nên chưa commit/push. Không gọi hoặc áp migration lên Supabase thật. Không sửa UI hoặc activate mô hình mới trong ứng dụng.

## Phần đã thực hiện

[DTO candidate](D:/Workspace/pos-cafe/src/domain/permissions.ts:1) khai báo đúng năm role, 15 mã quyền, catalog, overrides, authority/revision, danh bạ quản trị, request/envelope/audit và signal camelCase. Các kiểu legacy trong models.ts vẫn giữ để client hiện hành chạy bridge; không trộn admin thành một role candidate thứ sáu. Revision phía JavaScript được kiểm là số nguyên không âm an toàn, không ép chuỗi thành số hoặc chấp nhận số đã mất độ chính xác.

[Core catalog](D:/Workspace/pos-cafe/src/core/permissionCatalog.ts:5) kiểm cấu trúc/bất biến; [normalization](D:/Workspace/pos-cafe/src/core/permissionOverrides.ts:5) nhận catalog qua tham số. Không có bảng default role→permission thứ hai trong candidate core. Owner/manager/cashier/waiter/kitchen có 15/12/7/3/0 quyền mặc định; bốn role enabled có floor.view nền, kitchen chưa bật. Quyền cấu hình của target inactive không bị biến thành rỗng.

Input null reset overrides; thiếu trường patch giữ nguyên; arrays rỗng hợp lệ, khử trùng/sort, deny thắng. Array đầu vào tối đa100, sai kiểu/mã/field bị từ chối; deny floor.view và grant data.clearDemo cho non-owner bị chặn. Sources giải thích default/grant/deny/baseline sau chuẩn hóa. Grant/deny trùng ngoài default triệt tiêu; deny đang chặn default vẫn được giữ.

[Authority/module helpers](D:/Workspace/pos-cafe/src/core/permissionAuthority.ts:8) không gọi mạng. Unverified/loading/unavailable hoặc catalog revision không khớp không cho thao tác. Module suy từ metadata catalog và action predicate: order.voidPaid thuộc nhóm lịch sử nhưng không tự mở quyền đọc lịch sử; receipt.reprint phải đi cùng quyền đọc hóa đơn và không tự cấp payment.take hoặc Tra cứu K. Đây là hàm quyết định thuần trên snapshot đã xác minh; không phải cơ chế xác thực token từ boolean do client khai.

[Validator/preview](D:/Workspace/pos-cafe/src/core/permissionInputs.ts:14) kiểm UUID, tên trim1–120 Unicode code points, PIN đúng6 số ASCII, confirm và revision; không echo PIN/input bí mật trong lỗi. Tạo/chuyển role chỉ manager/cashier/waiter. Gửi cùng role giữ deny; preview đổi role thật reset overrides mà không sửa input/revision. Parser giữ dấu hiệu explicit overrides/reset để tính đúng quyền trường; revision catalog stale bị chặn trước normalize. Parser/preview không thay thế server field authority, before/after ceiling, OCC, audit hoặc quy tắc ghép mutation ở T05.

[Ports](D:/Workspace/pos-cafe/src/ports/permissions.ts:8) khai báo authority, employee admin read/mutation, operational/admin reads và signal. T03 có aggregate PermissionFoundationPorts cho authority/admin-read/read; [mock factory riêng](D:/Workspace/pos-cafe/src/adapters/mock/permissionRepos.ts:147) thực thi phần đó. Chưa thêm vào AppPorts đang chạy, chưa có stub Supabase trả dữ liệu giả hoặc fallback bỏ kiểm quyền. T04/T05/T07 sẽ cung cấp adapter server và T11–T14 nối consumer; đây là cách giữ pha bridge của design8.2.

Mock dùng [fixture catalog](D:/Workspace/pos-cafe/src/seed/permissionCatalog.json:1) tại tầng seed/adapter, được đối chiếu từng row với SQL017 thật; core không import fixture. State/identity candidate riêng không chuyển nhân viên legacy của mock ứng dụng. Fixture A là waiter grant history/report, deny create/update; chưa có reprint. Mock session chỉ phục vụ kiểm contract, chưa hiện thực login PIN/bootstrap mới của T04.

Mock đọc quyền hiện hành mỗi request: roster trước PIN chỉ id/name của active enabled cùng store; admin read cần employee.manage hoặc employee.permission.edit, không trả credential. Floor trả layout và summary đơn mở; create-only không đọc detail đơn khác, void-paid-only không đọc tổng lịch sử. Read-only waiter đọc history/report nhưng không có action/K. Mock không cung cấp mutation/audit write/print authorization mới: đó là T05/T14, không lấy mock read làm bằng chứng DB enforcement.

AppErrorCode thêm mã đã khai trong design; mapper Supabase nhận catalog câu lỗi mới. Các câu lỗi legacy giữ nguyên. Full message/consumer gate vẫn ở TC57/59 về sau; không nói toàn bộ 50 thông báo đã được UI sử dụng.

## Bằng chứng nghiệm thu

HEAD vẫn `ef2c372aec60d8362549e47b7aedb27126129479`, bao gồm thay đổi local T01–T03 chưa commit. **Source fingerprint chung: `925b167be58eff127514aa5930c723607a13a864af62e45258d5d8e7810cc94e`.** Gate sau sửa code không dùng kết quả cũ ở fingerprint T02.

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| Unit/component toàn ứng dụng | 761/761 test, gồm 124 test mới của T03 và 637 test có trước | [verification T03](D:/Workspace/pos-cafe/artifacts/permissions/t03/5de76428-5aed-4b24-8ea2-c373ae388f71/verification.json) |
| SQL T03, full Supabase cách ly | 4/4 test; 1.280 tổ hợp hợp lệ qua5 role, 9 ca lỗi đối chiếu core/SQL; catalog seed giống từng row; đổi default/revision phản ánh vào core | [database evidence](D:/Workspace/pos-cafe/artifacts/permissions/t03/5de76428-5aed-4b24-8ea2-c373ae388f71/database-evidence.json) |
| TypeScript và Vite production build | PASS; chỉ cảnh báo chunk lớn đã biết | Exit codes trong verification T03 |
| Regression T02 bridge | 52/52 test + 6.144/6.144 tổ hợp; Auth/REST, K/R1/ACL và revert giữ nguyên | [verification T02](D:/Workspace/pos-cafe/artifacts/permissions/t02/a2bb7d8b-630b-4e4d-8077-91ccb134a1fd/verification.json) |
| Regression T01 | 152 tool + 30 DB test; preflight READY | [verification T01](D:/Workspace/pos-cafe/artifacts/permissions/t01/4d90c73c-250d-494d-838f-55fcbaaacab1/verification.json) |
| Tài liệu/truy vết | 34 file Markdown;30 requirement,15 UC,60 TC; không requirement/UC thiếu TC hoặc lỗi liên kết | [docs-verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t03/5de76428-5aed-4b24-8ea2-c373ae388f71/docs-verification.json); chỉ T01–T03 hoàn tất |

[Runner T03](D:/Workspace/pos-cafe/scripts/permission-foundation-verify.mjs:1) kiểm Node/dependency lock, source trước/sau, discovery/results/options thực và [manifest132 biến thể bắt buộc](D:/Workspace/pos-cafe/tests/permissions/permissionFoundationCases.json:1): 128 unit (gồm4 architecture test cũ) +4 SQL. Không skip/retry/expected-failure. 1.280 và6.144 là tổ hợp bên trong ca đối chiếu, không phải số TC nghiệp vụ. Test SQL áp017 trên fixture đúng profile, rollback biến thể, revert trước activation và khôi phục helper nguyên văn ở cleanup.

Phạm vi TC01/03/04/19/57 đã kiểm là core/DTO/mock, SQL parity và boundary kiến trúc mới. DOM/nav thực, form employee, scheduler/cache/revocation, server admin/audit/ceiling và cleanup toàn consumer chưa được nghiệm thu. T09/T10 vẫn cần Storage/gateway và Realtime hai client thật; health service không thay thế hành vi đó. Không có browser E2E hoặc live business smoke ở T03.

## Runtime và tái chạy

Node24.16.0, Vitest4.1.11 theo package-lock. Khi bắt đầu T03, node_modules lại có Vitest4.1.10; đã chạy npm ci và lấy kết quả sau cài lại để nghiệm thu. Không sửa package-lock/pnpm-lock hoặc nâng dependency. Source baseline trước T03 là `e25599ee0e5368b7a8ef26066db5449b48a5e5c536e54438b3637f4dea3dd112`.

Tái sử dụng [stack T02](permission-t02-catalog-bridge-2026-09-15.md): CLI2.117.0, Docker29.1.3, PostgreSQL17.6.1.167, 12 service thật, project/container/volume riêng và localhost5842x. Fixture T01 riêng dùng PostgreSQL16, port55449. Không thay schema/migrations001–017 trong T03.

Trong lượt dựng lại, nhiều container đổi thời điểm start và Edge dừng exit15 giữa các lần gọi WSL. Giữ một tiến trình WSL nền trong cửa sổ ẩn suốt gate và khởi động lại Edge đã giúp runtime qua health ổn định; không gỡ hoặc nới kiểm health. Native PostgreSQL khởi động ở5432 do port trước đó truyền bằng command-line; đã lưu port55449/listen127.0.0.1 vào config cụm test và chờ forwarding hoạt động. Lượt T01 đầu bị ECONNREFUSED nên chưa thực thi30 test DB; report thất bại được giữ, chỉ lần chạy đầy đủ ở bảng trên được nghiệm thu. Không sửa cấu hình mạng hay DB dự án thật.

Khởi động stack theo runbook T02, giữ tiến trình WSL trong thời gian gate, rồi chạy từ worktree code:

```powershell
$permissionKeepalive = Start-Process -FilePath 'wsl.exe' -ArgumentList @('-d','Ubuntu-24.04','--','sleep','14400') -WindowStyle Hidden -PassThru
node scripts/permission-bridge-runtime.mjs refresh C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t02-20260915/fixture
$env:IDEM_ENV_FILE = 'C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t02-20260915/fixture/bridge.env'
npm run test:permission:t03
```

Nên mở keepalive trước khi start stack để giữ WSL sống liên tục. Sau gate dừng stack/cụm test riêng rồi dừng đúng PID keepalive do lần chạy này tạo; không shutdown toàn WSL/Docker hoặc dừng container dự án khác. Credential/refresh token ở thư mục runtime ngoài repo, không lấy .env.local và không đưa vào report. Không chạy song song các suite dùng cùng fixture DB.

Sau nghiệm thu T03 đã dừng stack Supabase riêng, cụm PostgreSQL16 riêng và tiến trình keepalive của lượt này; dữ liệu/volume được giữ để tái chạy.

## Bàn giao T04

T04 dùng DTO/ports/core đã kiểm để triển khai danh tính, owner invariant, khóa phiên và server authority. T05 tiếp tục admin mutation/audit/ceiling; T07 nối projection SQL; T10 signal transport; T11–T14 nối UI. Aggregate mock T03 không phải xác nhận các phần này đã xong. UI hiện vẫn legacy admin/cashier, kitchen chưa bật; bộ role mới chỉ có ở catalog/contract candidate.

**Regression sau T04, 2026-09-16:** xem [biên bản T04](permission-t04-identity-owner-sessions-2026-09-16.md) tại source `946c6dfd0b01e80ca2790790fed6d5bb92b8a67e4d792e08e5fbc456cb0b6e74`. Bằng chứng ở trên giữ nguyên cho checkpoint lịch sử; kết quả T04 không thay thế gate consumer/service/activation còn lại.

**Regression sau T05, 2026-09-16:** xem [biên bản T05](permission-t05-employee-administration-audit-2026-09-16.md) tại source `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`. Giữ bằng chứng trên cho checkpoint lịch sử; consumer/service/activation còn lại chưa được thay bằng gate administration.

**Regression sau T06, 2026-09-16:** xem [biên bản T06](permission-t06-financial-authority-2026-09-16.md) tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. Giữ các kết quả trên cho checkpoint lịch sử; T06 không thay gate consumer/service/activation còn lại.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
