# EVC — native ACL và private input proposal v3, 16/10/2026

**Verdict: APPROVE** trong phạm vi hồ sơ lượt v2 đã dừng và proposal local v3, đúng [candidate 01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/candidate-01/manifest.json), SHA256 `67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b`. Không có finding blocking còn mở trong phạm vi EVC. Review này không cấp quyền private resume/probe mới và không xác nhận database compatibility hoặc điều kiện phát hành.

## Candidate và nguồn

Tự hash manifest, đối chiếu regular-file/bytes/SHA của cả **23 snapshot files và 23 nguồn hiện tại: 174.878 byte, 0 mismatch**. Snapshot có original `actor-probe/actor-probe.mjs` cho test so bytes; replay không cần lấy dependency source ngoài snapshot. Node/PowerShell dùng bản đã có, không install.

Sáu pin trong `v3-local-verification-01.json` khớp manifest. Setup v3 SHA `ff6d3904021f9560904680d6e8aba43735f93ba018e74c6fed87f318446618d8`, plan `a3d2c95706624ed8e067f3e0ada690514e98c364f6a542071674aca66ba1ac67`, retry tests `1426b28a9ec53983e9479c977511389c4e08fb533ce9341b04979c3c504c63e0`. Module `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`, launcher `e6c786b31b6f203413aa281b661bf0eec4892f34a5423c5ca186a5867ca68425` và probe tests `95e3caca1177df434c57190c914ef75eff22e3b4af40ebd0f1f66d9ea1da03f8` giữ nguyên bytes của v2 đã review. Các expected trong retry/coordinator tests được điều chỉnh; không gọi toàn bộ 19 test nền là byte-identical.

## Bằng chứng lượt v2 và native controls

1. Intent, invocation marker, result và source v2 đã đóng thống nhất: approval `call_c5e5fed39d324541bc9680abb3fdf3d6`, setup đúng 1 lần, source SHA `d328951b5e1762980ddb686dfd743640c5345ac79f9730eaa21f121d1ccfdd88`, 11:17:38.7139829Z–11:17:39.3989965Z, elapsed làm tròn **685 ms**, script exit 1. `PRIVATE_COPY_FAILED/PRIVATE_COPY_REFUSED`, createdDirectory=true, createdFiles=0, copiedFiles=0, DB probe invocation=0. Parent wrapper lưu receipt thành công không biến script exit 1 thành PASS.
2. Metadata sau lỗi ghi target tồn tại, current-user owner, non-reparse, entries=0, ACL còn inherited/unprotected với 8 rules và 4 unexpected Allow. CreationTimeUtc `2026-10-16T11:17:39.2729671Z` khớp predicate v3. Đây là receipt metadata của tác giả; EVC không truy cập private target để lặp lại. Source v2 khóa/đọc/hash input trước tạo directory: **files/copied=0 không có nghĩa source bytes chưa từng được đọc**; credential vẫn DPAPI ciphertext và chưa giải mã.
3. Hai public control receipts ghi descriptor v2 có SetOwner bị native SetAccessControl từ chối (inner UnauthorizedAccessException), còn DACL-only control đạt protected 3-rule ACL/current owner và CreateNew synthetic file. Chúng hỗ trợ suy luận về yêu cầu ghi owner không cần thiết. Không có actual private native-stage/exception capture; không suy token thiếu privilege cụ thể hay nhận control thành proof của đúng private failure stage.
4. `historical-command-provenance.json` được hash trong candidate: 3 public tool input records, timestamp/call ID, exact wrapper/argv, setup source pin và cwd với cơ sở kế thừa được ghi rõ. EVC đọc/đối chiếu record, không thực thi các wrapper này hoặc tự xác nhận lại session trace gốc. File và báo cáo nói rõ provenance hồi cứu; original control receipts thiếu descriptor/script hash tại thời điểm chạy. Không nhận hồ sơ bổ sung thành hash đồng thời.

## Đọc implementation v3

Đã đọc source effectful adapter cùng helpers và coordinator, không chỉ fake state machine:

- [Default/transaction](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:4) trả trước private metadata/identity/effect khi thiếu `-Prepare`. Guard/reference không tự cấp quyền. Coordinator có fixed stage labels, bắt lỗi, luôn attempt close và không trả success nếu close lỗi; không xuất raw exception.
- [Resume facts](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:79) kiểm đúng path và creation timestamp đã ghi, directory/current owner/accepted ancestors/non-reparse/empty. Adapter recheck trước và sau DACL; không tạo folder mới, overwrite hay delete. Đây là predicate path/timestamp/metadata, không tuyên bố đã giữ OS file-ID lock hoặc ngăn mọi thay đổi đồng thời.
- [DACL helpers](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:67) không yêu cầu SetOwner/elevation/takeown. Owner vẫn được kiểm trước/sau; ACL phải protected với đúng current user/SYSTEM/Administrators. Native CreateNew nhận descriptor trước payload; file owner/ACL được kiểm trước copy.
- [Effectful adapter](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:155) chỉ áp dụng DACL cho target rỗng đã định danh, rồi read-lock nguồn, kiểm size/hash pins trước ba CreateNew files, verify từng copy và close handles. Ba input và pins, source owner/reparse bounds, ngoại lệ TI chỉ non-leaf C-root, SQL/target/CA/DPAPI/stdout policy của launcher/module giữ nguyên. Credential là encrypted CLIXML; scope/CA là plaintext bytes được ACL bảo vệ, không gọi cả ba input là encrypted.

## Replay độc lập

Chạy trực tiếp từ thư mục v3 bên trong snapshot, 11:36:38.984Z–11:36:55.128Z, bằng Node hiện có v24.16.0:

```text
D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2 actor-probe.test.mjs retry-preparation.test.mjs
```

**22 PASS, 0 FAIL/SKIP/cancelled/todo, exit 0, stderr rỗng**. Gồm 21 fake/default/static và 1 native public fixture; không gọi đây là bộ hoàn toàn pure. Gồm 19 test nền được giữ/adapt và 3 test mới (fixed failures, exact resume facts, native helpers), không cộng các lượt replay thành ca mới. Test facts phủ 7 delta âm; owner-chain test giữ 11 kịch bản (2 positive/9 negative). Fixed stages được kiểm qua các step giả lập; stage label không tự chứng minh mọi side effect của một step đã hoàn tất.

Native test trích đúng sáu ACL/hash helpers qua AST của setup snapshot. Fixture EVC riêng: [e0aa2248-33e9-4251-ac3c-2d0e64a34353](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/native-fixtures/e0aa2248-33e9-4251-ac3c-2d0e64a34353). Test kiểm descriptor không có owner section, native DACL apply, ACL trước payload, hash copy và CreateNew collision bị từ chối. EVC đọc lại metadata của fixture công khai: directory và hai file owner current user, non-reparse, protected với 3 rules; hai file 24 byte, tổng **48 logical bytes**. Không xóa fixture; disk allocation chưa đo. Trước replay C/D trống lần lượt 203.522.396.160/103.461.208.064 byte, đều vượt 30 GiB.

Tự parse hai PS scripts: 0 lỗi. Chạy cả hai default mode từ snapshot, exit 0: setup `PREPARE_PLAN_OWNER_APPROVAL_REQUIRED` với privateInputsRead/aclChanged/decrypted/DB/resumed/created=false, copied=0; launcher `PREPARED_OWNER_APPROVAL_REQUIRED` với credentialRead/connectionAttempted=false. Sau replay cả 23 snapshot files không đổi.

Đối chiếu TAP tác giả: 5.251 byte, SHA `3737eeb5c03fc0578aab10daa679446f326aa2cdcbfe762c16c2e1cd00eb2b6d`, khớp receipt và 22/22. Supplement ngoài snapshot `snapshot-replay-01.json` cũng gắn đúng candidate, 22/22 và additionalUniqueCases=0. `precloseout-state.json`/`precloseout-private-metadata.json` là receipt sau freeze, không phải nguồn đóng mới: ghi source/snapshot 0 drift, HEAD/index như baseline, private target vẫn empty/inherited8, v3Applied=false/probe0. EVC đọc receipt; không nhận các metadata private đó thành check do EVC trực tiếp chạy.

EVC cũng đọc lại HEAD và staged entries hai checkout. `indexSha256` ở baseline/precloseout là SHA256 của bytes từ `git --no-optional-locks -C <root> ls-files --stage -z`, theo `permission-file-inventory-20261016/audit.cjs:49`, không phải SHA physical `.git/index`. Tính đúng phép đo này đều khớp: main `8da3848e1e83794b8b78cdd9816f0000c3cc7198c793b94d1c41f789fa507e86`, docs `0d071392c4dfc84b8de40153bbdbdeaf563851d15398a44a9d2d362aeb8823e4`; `git diff --cached --name-status` rỗng ở cả hai và HEAD giữ nguyên. So SHA raw index ban đầu của reviewer là so khác đại lượng, đã loại khỏi kết luận; không có finding staged-entry drift.

## Ranh giới verdict

[Báo cáo](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-input-native-2026-10-16.md) và [task index](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/README.md:3) phân biệt actual v2 failure, public native controls, v3 local tests và việc chờ owner. Không overclaim actor/scope online PASS, compatibility contract 2, backend/full backup/recovery/cutover hoặc đủ điều kiện phát hành/push.

APPROVE đủ cho root trình proposal cụ thể sau SEC/EVC; **actual v3 private resume/copy và conditional ONE read-only probe vẫn cần quyền mới** theo stop-on-error. EVC không chạy `-Prepare`/`-RunReadOnly`, đọc/hash private bytes, giải mã credential, đổi private/C ACL, network/DB/browser, install, CI, Git push, deploy hoặc delete. Chỉ native fixture công khai mới có ACL/file writes; Node heap/concurrency là giới hạn process/test, không OS CPU/RAM quota. Không sửa candidate/source/task index/review cũ.
