# Oracle TC03 quan sát mutation trước rollback — 09/10/2026

## Quyền và source

Chủ dự án **“ok xử lý giúp tôi”** sau đề nghị G1 trong [inventory08/10](permission-pin-gate-inventory-2026-10-08.md): sửa oracle TC03, regression mutation+denial và kiểm fixture cách ly. Scope test/tooling/harness, auto/UI liên quan và docs; giữ requirement/expected/42business RPC cùng args, SQL nghiệp vụ và production grants. Task nhạy cảm cần hai reviewer non-author. Không reset fixture/hosted/release.

Main/docs giữ dirty baseline và HEAD ef2c372aec60d8362549e47b7aedb27126129479 / e47862b1dfed68d783dc07a2a1fd51ecdabc1b19. [Source-08](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/source-08.json) fingerprint **b927e8bf55a9f75416fa9b67ae16d8cd7471f838c8094133559dfa11ca3e34cf**, 713 paths =711 files+2 deletions. [Archive](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/source-08.tar) SHA256 b946930abeba339c7ab380a8fabc63662beb9494b5bae52f25947a10aed4f863. Đổi đúng7file test/helper/fixture/config/reporter so baseline66e5; không app/migration/candidate SQL. Candidate review đóng băng cả source mới, docs và tooling/evidence ngoài source fingerprint.

## Lỗi oracle và lựa chọn sửa

Test cũ rollback từng RPC rồi mới so fingerprint cuối. Route có thể ghi dữ liệu, trả PIN_CHANGE_REQUIRED rồi rollback xóa dấu vết. Đây là **khoảng trống kiểm thử**, chưa phải quan sát faulty production route.

[Oracle:19](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceOracle.ts:19) baseline→invoke→snapshot sau invoke→kiểm mutation/structural denial→finally cleanup. [SQL matrix:125](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:125) đọc bằng observer cùng connection trước rollback, thấy effects chưa commit. Raw state/DTO/driver errors không vào assertion diff/Error cause/public results; chỉ boolean/mã hữu hạn. Cleanup failure luôn chặn PASS.

[Regression:22](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceOracle.tool.test.ts:22) có14ca: mutation+denial dù cleanup phục hồi baseline; denial/no-effect;6shape mismatches;3callback faults;3cleanup faults. [SQL negative control:143](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:143) UPDATE employee synthetic trong savepoint rồi trả denial phải bị bắt trước rollback; cleanup phục hồi baseline. Mutation thật qua PostgreSQL observer test-only, không sửa một production RPC/grant để tạo lỗi.

So sau rollback bị loại vì che mutation; in raw fingerprints bị loại vì có hash/token. Chỉ mock oracle không đủ nên thêm SQL negative control và42RPC thật. [Reporter:40](D:/Workspace/pos-cafe/scripts/permission-vitest-reporter.mjs:40) chiếu finite PIN code/phase/step/SQLSTATE; không stack/cause/query/rows/DTO.9reporter regressions gồm4ca mới; failed hooks chặn success kể cả bodies đạt.

## Harness, quyền và preservation

[Adapter:110](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:110) giữ default legacy; runner chọn explicit activated-candidate. [Guard:88](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:88) kiểm runtime12services/control/marker/16migration checksums/exact2store+Auth/strict2/marked200-unmarked426. Activated enum/helper has_employee_permission đã bỏ: chỉ tách pure legacy helper khi guard chứng minh absence và role text;42business routes/args giữ nguyên.

[Inventory:95](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:95) đối chiếu đúng55public EXECUTE signatures=42business+13named exceptions. Hai metadata entries của activated profile là permission_contract_probe()/permission_contract_pre_request() từ [compatibility SQL:59](D:/Workspace/pos-cafe/supabase/candidate/permission-compatibility-prepare.sql:59). Cùng test kiểm authenticated probe trả true, hook ghi strict header khi contract2, mọi row/catalog state không đổi trước rollback. Không loại business route để khớp count.

Activated path không gọi legacy setup/cleanup có commit/delete, không reapply candidate SQL. Outer transaction tạo known PIN/cờ/session và view ACL fixture-only. [Locks:141](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:141): public/private SHARE ROW EXCLUSIVE; Auth/Storage ACCESS SHARE theo quyền SELECT. [Diagnostic](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/lock-diagnostic-01.json) chứng minh23Auth/10Storage tables không UPDATE/DELETE/TRUNCATE/SET owner. Không thay ACL/membership hay dùng admin trong suite. Login local admin được kiểm chỉ đọc như alternate rồi loại vì quyền thừa. ACCESS SHARE không chặn managed writers: drift được quan sát phải FAIL, không bỏ qua. Căn cứ: [PostgreSQL LOCK](https://www.postgresql.org/docs/17/sql-lock.html).

[Snapshot:13](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:13) giữ kín mọi row public/private/auth/storage; constraints/functions/ACL/policies/views/publication/sequences/schema/default ACL/db-role settings/role membership. [Cleanup:161](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:161) rollback riêng trước reset role, so state rồi finally đóng connection. Sequence không tự rollback: drift phải FAIL, không tự sửa sequence. Runner hậu kiểm độc lập whole-row/catalog và6Storage byte files.

Runtime local đúng pos-cafe-perm-t04-20260916, API59421/DB59422/postgres. WSL shutdown làm Edge exited15; runner start đúng container có sẵn, xác minh image/project/bind/no published port, giữ config/volume. Native Node24.16.0/CLI2.117.0/installed package-lock parity; không nâng tool trong run. Credential/control/raw logs chỉ code đọc kín. Auth chỉ refresh bằng existing token sau strict target preflight, chặn password-reset fallback, baseline sau refresh. Source08 không cần refresh; một refresh trong source01-attempt02 được ghi riêng.

## Kết quả thực chạy, cùng source08

[Execution](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/execution-summary.json) PASS lúc 2026-10-09T03:07:50.125Z. Discovery/actual options/commands/exits/safe results giữ đủ: noOnly/retry0/repeat0/no required skip/expectedfailure; body+hook đạt. Oracle14 chạy riêng rồi nằm lại trong suite70; không cộng thành84ca độc lập.

| Kiểm | Kết quả |
| --- | --- |
| Oracle | [14/14 PASS,exit0](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/oracle-tooling-execution.json) |
| Surface | [70/70 PASS,exit0](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/pin-surface-execution.json):47SQL=42routes+inventory+rawACL/publication/private helper+3negative-control cases (employee mutation, JSONB precision, catalog5variants);14oracle+9reporter. Zero failures/skips/hook errors |
| Preservation | [PASS](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/postflight.json):whole rows/catalog/6Storage bytes không đổi,sessions3→3,zero prepared/pending/other idle transactions; candidate guard còn đúng |
| Typecheck | [tsc-b exit0](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/typecheck.json):app/config theo tsconfig, không nhận mọi contract TS đã typecheck |
| UI | [Chromium desktop1/1 PASS](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/ui-execution.json):employee permission editor→re-login→payment denial; DOM/business assertions thật; mock backend,1366×768,retry0/repeat1/trace off |
| Tool inputs | [Hashes](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/tool-inputs.json):runner/reporter/freezer đầu-cuối không đổi |

## Giữ lịch sử FAIL

- [Initial source01](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-01/execution-summary.json):runtime health refused,chưa DB/test.
- [Source01-attempt02](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-01-attempt-02/execution-summary.json):14PASS/45skip do setup hook opaque; nguyên nhân exact của run này chưa xác định.
- [Source02](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-02-attempt-01/pin-surface-results.json):23PASS/45skip; safe diagnosis step locks/42501.
- [Source03](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-03-attempt-01/pin-surface-results.json):67PASS/1inventoryFAIL; [diagnostic](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/inventory-diagnostic-01.json) chỉ ra2metadata functions.

Mọi run có DB baseline hậu kiểm preservation true. Không relabel FAIL hoặc gán locks cho opaque run cũ. Tooling FAIL được sửa tại chỗ, chưa có snapshot runner riêng cho mỗi FAIL nên không nhận replay chính xác driver cũ. Source/test snapshots và receipts giữ nguyên; exact driver attestation áp cho PASS cuối. Diagnostic health false ghi lúc kiểm đọc, không là chứng nhận sức khỏe runtime cuối.

## Review C1 và các kiểm bổ sung

Candidate1 ac3613a9093883d7f692683725a38d5eb6523b515f12020ddcf5abaee3601e59: evidence reviewer APPROVE scope riêng; technical reviewer CHANGES_REQUESTED vì F1 JSONB bị JSON.parse làm tròn numeric và F2 thiếu replica identity/index/typmod. Không nhận C1 hoàn tất.

Đã sửa F1 bằng aggregate ::text tại PostgreSQL trước pg parse. [Precision SQL:162](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:162) đổi 1 thành 1.00000000000000001 phải bị bắt, cleanup phục hồi. Đã mở rộng catalog metadata relation/owner/options/replica identity, attributes/typmod, functions/constraints/triggers/index/type/enum/range/collation/rules/inheritance/aggregate, namespace/global defaultACL và pg_roles view che password. Loại sáu trường thống kê/bảo trì vật lý pg_class: relpages/reltuples/relallvisible/relallfrozen/relfrozenxid/relminmxid; phép so là catalog logic và row state, không kiểm số đo vacuum. [Catalog SQL:181](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:181) năm variants replica identity/fillfactor/typmod/index replacement/policy restrictive phải bị bắt trước cleanup, từng rollback phục hồi.

[Source05](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-05-attempt-01/pin-surface-results.json) 69 PASS/1 catalog-control FAIL, preservation true; test này có thêm owner-change variant chưa đủ chẩn đoán để kết luận exact SQL cause. Bỏ variant harness chưa thiết lập được owner target, không bỏ snapshot owner hoặc thay requirement. [Source06](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-06-attempt-01/execution-summary.json) 70 PASS/UI1, nhưng catalog metadata được bổ sung tiếp nên source08 là final. **Source04 thực tế68 PASS**, UI1; evidence đó chỉ là trước review, không được relabel là final70. Final source08 ghi70/70 (47SQL+14oracle+9reporter), UI1, typecheck và preservation cùng nguồn. Các driver trước final tiếp tục không được nhận exact replay khi không có per-attempt tooling snapshot.

## Review C2 — bổ sung policy semantics

Candidate2 d6d5cc6a909a841507e7d93e6169b108d329853375fe35df520feafd44bac794: evidence APPROVE scope riêng; technical CHANGES_REQUESTED F3 vì thiếu permissive/restrictive trong policy snapshot. [Source07](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-07-attempt-01/execution-summary.json) thực chạy70 PASS/UI1 nhưng chưa đóng G1 do F3; không nhận review evidence thay technical.

Đã bổ sung permissive và canonical full pg_policy metadata; SQL negative control thay cùng tên/role/cmd/expression từ permissive sang restrictive phải bị bắt rồi rollback phục hồi. Final source08 gồm5catalog variants trong cùng testcase, số testcase vẫn70=47SQL+14oracle+9reporter. Bộ auto/UI/typecheck/preservation chạy lại cùng source08 đạt; exact candidate/verdict cuối ghi trong review metadata.

## Gate, rubric và walkthrough

G1 đã kiểm chứng; điều kiện đóng bàn giao là hai APPROVE exact candidate theo [review metadata](../reviews/2026-10-09-permission-pin-oracle.md). Review inventory08/10 không thay G1. Requirement/expected giữ; chỉ cập nhật đường hiện thực TC03 và note PIN-T06 vẫn mở.

**TC03 còn một phần:** missing/wrong-tenant/revoked token,directREST/Storage và allowed restricted projections.19TC,forced complete ACKloss/race/fault,canary/empty preservation,full unit/build/regression/aggregate,UI audit33,PIN-T05/06/T17/T18/release vẫn mở. UI mock không thay forced-PIN server/real browser hoặc audit ba viewport; không đổi UI/update audit baseline.

Nguyên liệu khóa luận: denial phải kiểm effects trước cleanup; negative control chứng minh oracle bắt sai; phase guard tránh phá fixture; quyền tối thiểu/failure projection; rollback và row/catalog/Storage preservation có chứng cứ riêng; tách current/historical và mock/SQL.

Walkthrough đã chuẩn bị:42matrix→oracle→SQL negative control→guard/locks→rollback/bytes. Chưa có phản hồi owner xác nhận đọc/hiểu/nghiệm thu. [Handoff](../workflow/tasks/permission-pin-oracle-2026-10-09.md).
