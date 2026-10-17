# PERM-T04 — Identity, owner và khóa phiên

Ngày 2026-09-16. **Hoàn tất phạm vi T04 local; T05–T18 chưa thực hiện.** Chủ dự án đã cho phép tiếp tục code. Không commit/push/deploy hoặc thao tác Supabase thật. UI và runtime composition vẫn legacy.

## Nguồn và trạng thái

- Code HEAD: `ef2c372aec60d8362549e47b7aedb27126129479`, nhánh main, gồm thay đổi local T01–T04 chưa commit; docs ở worktree nhánh docs.
- Source fingerprint cuối: `946c6dfd0b01e80ca2790790fed6d5bb92b8a67e4d792e08e5fbc456cb0b6e74`.
- [SQL candidate](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:1) nằm ngoài migrations tự động; không có migration018 được tự áp. Fragment đòi role text và mapping owner hợp lệ; [fixture stage](D:/Workspace/pos-cafe/tests/contracts/permissionIdentityFixture.ts:1) chỉ map hai cửa hàng synthetic của runtime riêng.
- Chưa có launcher activation hoặc rollback phát hành T16. Cleanup fixture T04 gỡ candidate, khôi phục enum/helper/grants baseline và giữ nguyên hash business/ledger. Đây không phải quyền rollback cửa hàng thật.

## Kết quả thực hiện

1. DB giữ đúng một owner active mỗi store bằng unique index, check active và deferred constraint cả stores/employees. Owner tạo cùng stores/settings khi bootstrap. Catalog role gồm năm mã đã chốt, kitchen vẫn disabled.
2. Cấp phiên opaque12h; xác minh store/PIN/active/role sau khóa. Authority catalog+snapshot và revision dùng employee token thật; roster chỉ id/name. Đăng xuất token expired/revoked là idempotent.
3. Identity mutex khóa store FK trước employee/session; target sessions prelock theo token hash trước revoke. Catalog SHARE sau row locks; writer EXCLUSIVE trước catalog state. Current authority VOLATILE và đọc lại sau chờ; không tái dùng preliminary record.
4. Owner tự đổi PIN cần currentPin; PIN trùng noop, PIN khác revoke mọi phiên và tăng revision một lần. Audit applied/noop/verified denied cùng request registry HMAC private; lỗi audit/signal/registry rollback toàn bộ. Replay cùng payload không băm lại PIN hoặc revoke phiên mới.
5. Recovery SQL private chỉ role `pos_owner_recovery`, không cấp cho anon/authenticated/service_role. Bắt operatorRef/caseRef/proofRef và store/target owner đúng; audit actorType=operator. Membership fixture chỉ cấp tạm cho postgres của runtime test rồi revoke. Không thêm recovery_contact hoặc đường reset owner trong app.
6. Bootstrap strict requestId/ownerId/storeNo/name/address; provisioning email phải khớp storeNo. Không nhận PIN hoặc seedDemo ở RPC; giữ chính sách PIN ban đầu phase27 nhưng không trả/replay bí mật. Cùng request replay an toàn; đổi owner/input conflict; lỗi owner insert rollback store/settings/registry. Seed sau bootstrap do flow riêng T08/T16.
7. [Port/DTO](D:/Workspace/pos-cafe/src/ports/permissions.ts:1), [Supabase adapter](D:/Workspace/pos-cafe/src/adapters/supabase/permissionIdentityRepo.ts:1), [mock session](D:/Workspace/pos-cafe/src/adapters/mock/permissionIdentityRepo.ts:1), [parser](D:/Workspace/pos-cafe/src/core/permissionIdentityInputs.ts:1) đã có. Token không vào DTO; adapter chặn response generation cũ, logout xóa memory trước ACK; replay PIN không khóa phiên mới. Mock chỉ mô phỏng credential/session, không thay DB concurrency, operator verification hoặc bootstrap provisioning thật.

## Bằng chứng cùng source

| Gate | Kết quả | Báo cáo và SHA-256 |
| --- | --- | --- |
| T04 | 788 unit/component (761 cũ +27 mới),42 SQL/Auth/REST, typecheck/build PASS;74 required variants gồm32 unit/architecture +42 DB | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/dc8d3006-f53f-46c1-a6e0-477ddd4553e4/verification.json); `6498d1c8628277ce1cc91b7af74657cbe9f131e8b212c3b2c825caa97d7e3295` |
| T03 regression | 4 SQL,1.280 tổ hợp +9 lỗi PASS; dùng lại unit/build T04 cùng source, đối chiếu đầy đủ manifest T03 và hash artifact | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t03/8bb261e9-ae35-44eb-80ca-cb00af62c57c/verification.json); `c561675449f33cae4c2d24075cec8106e2d68bf35100f2c34b65a8d33294841a` |
| T02 regression | 52 test,6.144 comparison và protocol/revert thật PASS | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/7a5dec56-b749-4633-bd48-8f5e39065a33/verification.json); `35002314ccf4576e58545121213472a9cea404722b3fe34b8b8ada2ca55cacfa` |
| T01 regression | 152 tool +30 PostgreSQL, preflight READY | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/438015d7-389c-4231-b6be-23e2c7c6d814/verification.json); `8dbb04b6df819412de2c7ecfb3165e07eac74f4b8b6d5a762a2ccc8bcea92b06` |
| Docs | Kiểm đủ artifact, liên kết, truy vết và chỉ T01–T04 đóng | [docs-verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/dc8d3006-f53f-46c1-a6e0-477ddd4553e4/docs-verification.json) |

[Runner T04](D:/Workspace/pos-cafe/scripts/permission-identity-verify.mjs:1) khóa Node/dependency versions, fingerprint trước/sau; so discovery/results/options và [manifest](D:/Workspace/pos-cafe/tests/permissions/permissionIdentityCases.json:1). Không skip/retry/expected-failure. 42 là execution của suite, không phải42 TC nghiệp vụ đã hoàn tất. Test đầu phát hiện trigger owner dùng cột store_id trên stores; đã sửa và chạy lại trước gate cuối.

[Suite SQL](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:1) dùng barrier và pg_blocking_pids để chứng minh issuance trước/sau đổi PIN, catalog commit khi reader chờ, clock hết hạn sau chờ. Negative control bỏ expiry check làm request hết hạn được chấp nhận; oracle deny phát hiện được biến thể yếu, rồi khôi phục helper. Inject fault vào audit/signal/registry và owner insert chứng minh rollback. [database-evidence.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/dc8d3006-f53f-46c1-a6e0-477ddd4553e4/database-evidence.json) xác nhận business/ledger không đổi và fixture revert.

## Phạm vi TC còn lại

| TC | T04 đã kiểm | Chưa đóng |
| --- | --- | --- |
| 08/09 | SQL prelock, revoke, reactivate và phiên cũ; đổi PIN primitive | Admin active/reset endpoint, ceiling/OCC/audit T05 |
| 10/11/58 | Self PIN RPC, adapter/mock; operator contract, grant, hồ sơ synthetic, retry, rollback | UI T12; xác minh con người/bàn giao thật ngoài DB |
| 14 | DB owner invariant, non-owner self PIN bị chặn, direct app DML bị đóng trên fixture | Mọi admin owner/self field rule T05 |
| 28/43 | Identity tenant/session/lock/fresh-clock và hai chiều issuance/PIN race | Financial T06, projection T07, admin integration T05 |
| 52 | Bootstrap candidate SQL/parser/adapter, bounds/replay/rollback | Seed flow T08 và A→E/bootstrap toàn UC T16 |

Audit đọc và ceiling chưa có (T05). Bảng signal permission chưa được subscribe/publication, gate hành vi Realtime thuộc T10. Storage thuộc T09; UI T11–T14. Không dùng các gate identity để khẳng định mọi15 quyền đã bảo vệ toàn ứng dụng.

## Runtime cách ly và tái chạy

- T04: WSL Ubuntu-24.04, Supabase CLI2.117.0/Docker29.1.3, project/volume `pos-cafe-perm-t04-20260916`, API127.0.0.1:59421, DB127.0.0.1:59422; config [identity.toml](D:/Workspace/pos-cafe/tests/permissions/runtime/identity.toml:1). Images/service health được ghi trong report, không suy service behavior PASS.
- CLI: `/var/tmp/pos-cafe-perm-t04-20260916/bin/supabase`; workdir `/var/tmp/pos-cafe-perm-t04-20260916/stack`; network cùng project với host_binding_ipv4=127.0.0.1.
- Fixture env/refresh token ngoài repo: `C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t04-20260916/fixture/bridge.env` (tên file kế thừa helper, profile thực là supabase-identity-v1). [Runtime launcher](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:1) pin đúng project/ports/marker/Auth↔DB, không nhận .env.local. Không in keys/token/DSN.
- Giữ một tiến trình WSL keepalive ẩn trong thời gian test, khởi động Docker và đúng stack trước khi refresh. Không chạy song song suite dùng chung fixture.

`node scripts/permission-identity-runtime.mjs refresh C:/Users/nguye/AppData/Local/Temp/pos-cafe-perm-t04-20260916/fixture`, đặt `IDEM_ENV_FILE` vào env trên, rồi `npm run test:permission:t04`. Runtime T01/T02 và lệnh regression giữ theo biên bản trước. T03 regression lần này dùng lại unit/build T04 đã kiểm hash vì cùng source, chạy riêng SQL4; script điều phối lưu ngoài repo trong thư mục temp T04.

Sau nghiệm thu đã dừng đúng hai stack Supabase test T04/T02, cụm PostgreSQL16 T01 và tiến trình WSL keepalive của lượt này; xác minh không còn container chạy thuộc hai project test. Giữ dữ liệu/volume và không shutdown WSL/Docker toàn máy.

## Bàn giao T05

T05 xây create/update/reset non-owner, before/after ceiling, field permission, OCC/catalog revision, audit read cho owner hoặc permission.edit, ACL và mock parity. Tái dùng identity lock nhưng multi-target phải khóa actor+target theo UUID, phiên theo hash; không gọi helper đơn target nhiều lần đảo thứ tự. Credential helper T04 chỉ cho self/recovery, không dùng như endpoint admin bỏ ceiling. Registry actor_type candidate dùng employee/operator; audit không FK cascade. Không bật owner role hoặc endpoint mới trên cửa hàng thật từ log này.

**Regression sau T05, 2026-09-16:** xem [biên bản T05](permission-t05-employee-administration-audit-2026-09-16.md) tại source `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`. Giữ bằng chứng trên cho checkpoint lịch sử; consumer/service/activation còn lại chưa được thay bằng gate administration.

**Regression sau T06, 2026-09-16:** xem [biên bản T06](permission-t06-financial-authority-2026-09-16.md) tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. Giữ các kết quả trên cho checkpoint lịch sử; T06 không thay gate consumer/service/activation còn lại.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
