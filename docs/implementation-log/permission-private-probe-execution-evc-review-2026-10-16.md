# EVC — checkpoint thực thi private setup/probe, 16/10/2026

**Verdict: APPROVE** cho checkpoint và đề xuất lựa chọn phạm vi chuẩn bị, đúng [run04 candidate 01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04/candidate-01/manifest.json), SHA256 `43e667c605993e3dfc6041a0b1f19e3b09526177d307f7b8d1ce511038cee297`. Không có finding blocking đối với checkpoint này. Runtime trust và khả năng chạy probe tiếp vẫn chưa đạt; đây không phải approval cho implementation/copy/install/download/credential use/probe/DB hoặc phát hành.

## Identity và source binding

Tự hash manifest, kiểm regular-file/bytes/SHA của **23 file snapshot và 23 nguồn hiện tại: 163.918 byte, 0 mismatch**. Sáu source pins trong intent khớp file v3 đã đóng và candidate run03 SHA `67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b`; không có thay đổi v3 cần chạy lại test. Module `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`, launcher `e6c786b31b6f203413aa281b661bf0eec4892f34a5423c5ca186a5867ca68425`, setup `ff6d3904021f9560904680d6e8aba43735f93ba018e74c6fed87f318446618d8` thống nhất giữa source, intent và result tương ứng.

EVC không chạy lại 22 tests lịch sử, launcher hoặc setup ở checkpoint này. Số 22 của v3 là kết quả cũ đã review, gồm 21 fake/default/static và 1 native public fixture; không có test/SQL/backend PASS mới do lần review này.

## Actual receipts và provenance

| Evidence | Đối chiếu | Giới hạn |
| --- | --- | --- |
| Owner/intent/setup invocation | Reference `call_cb8dbf502bd24764b1a5aeadf5cfbbf0`, candidate/pins, đúng một setup và conditional một probe | Không biến quyền đã dùng thành quyền retry |
| Setup result | 11:52:03.592956Z–11:52:04.4081923Z; 815 ms làm tròn; exit 0; PRIVATE_COPY_VERIFIED; resumed=true, createdDirectory=false, created/copied=3/3, handlesClosed=true | PASS của protected-copy setup, chưa phải actor/DB PASS |
| Copy verification trước probe | 3 file, 25.782 logical bytes; owner/protected ACL/đúng principals; credential 907 B, scope 23.508 B, CA 1.367 B | Scope/CA pin checked; credential-copy hash equality do setup kiểm qua handles, không có credential hash công khai hay phép pin độc lập của EVC |
| Probe invocation/result | 11:52:49.9075751Z–11:52:50.2640272Z; **đúng một invocation**, 356 ms làm tròn, exit 1, ACTOR_PROBE_FAILED/LAUNCHER_REFUSED | Đã dùng lượt probe; generic failure không có actual stage/decryption/Node-start/connection/SQL/TLS trace |

`copy-verification.json` có timestamp 11:52:49.8991358Z, trước probe marker; không dùng decrypted=false/DB=false của check trước đó để kết luận trạng thái giải mã/kết nối của invocation sau. `liveMutation=false` là field an toàn của failure reporter, không thay audit/equality proof của database. Không có actor/scope online PASS hoặc chứng minh dataset quiescence/unchanged từ receipt này.

`invocation-provenance.json` đóng đúng hai public tool input records, call IDs, timestamp và exact wrappers/argv. Setup dùng `-Prepare`, probe dùng `-RunReadOnly`, reference thống nhất; các marker CreateNew và preconditions ngăn wrapper tự lặp lại. Cwd được ghi là kế thừa từ task khi original arguments không đặt riêng. Source pin/review hash/source-lock logic và thứ tự copy verification trước probe phù hợp với receipts. File nêu rõ hồi cứu, không re-execute và thiếu generic failure stage. EVC đối chiếu record đã đóng, không tự chứng thực lại local session trace gốc; parent wrapper exit 0 chỉ là lưu receipt thành công.

## Metadata và runtime trust

[EVC qualification hồi cứu](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04/evc-metadata-qualification-retrospective.json) có SHA `1979a4a4eb2acb813ef8e118553a2e7333881d57f44debf0062657d70b4a7d66`, đúng kết quả EVC đã chạy trước freeze: chỉ trích hai guard metadata thật bằng AST từ launcher đã pin; module và private root/ba file qua guard, Node alias không qua. Ghi originalCheckUtc=null và output chunk IDs, không tạo timestamp lịch sử giả hoặc chạy lại checks khi lập receipt.

[Launcher:47](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:47) từ chối reparse, nhưng parent `D:/tools/nodejs` là SymbolicLink tới `D:/tools/nvm/v24.16.0`. Đây là counterexample functional hiện tại, không là actual last-stage proof của lần 356 ms. Canonical Node và tổ tiên hiện non-reparse chỉ giải quyết phần alias; không đủ bảo đảm runtime nhận credential.

Đọc SEC metadata receipt và kiểm lại ACL của **public canonical Node và pg entry**: cả hai có AUTHENTICATED_USERS Allow `Modify, Synchronize` (Node inherited, pg entry explicit). [Launcher:65](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:65) chạy Node và [module:148](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/actor-probe.mjs:148) import pg; source hiện chưa có equivalent content pins/locks/trust qualification cho runtime/dependency closure. Đây là gap cần khép trước credential-bearing run tiếp theo, không bằng chứng tampering/leak. Không nới guard hoặc sửa ACL của tools dùng chung trong review.

Hai reviewer receipts phân biệt private metadata reads với private contents/decryption/probe. Việc root ghi một lần web checksum Node unavailable được báo cáo riêng; không coi là checksum chính thức đã kiểm. EVC không mở web hoặc kết nối database khi review.

## Recompute public sizing

Tự duyệt 14 package directories bằng lstat/readdir, không follow link hoặc evaluate code: **138 regular files, 463.780 byte, 0 symlink trong các directories đó**; tên/version/dependency metadata đều khớp sizing v2. Stat và hash local Node canonical: **92.279.112 byte**, SHA `b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3` khớp receipt. Tổng **92.742.892 byte (~88,45 MiB)** đúng phép cộng.

Kiểm metadata lock hiện tại: 14 package/version đều có integrity entry; điều này không chứng minh installed content khớp archive. `require.resolve` từ vị trí probe tìm đúng pg 8.23.0; không import/evaluate pg. `pg-native` được metadata pg đánh dấu optional peer và resolve hiện MODULE_NOT_FOUND. Không coi absent optional peer là lỗi SQL hoặc tự cho phép cài package. Sizing v1 và v2 được giữ riêng, không nhận package-exports resolution refusal cũ thành dependency thực sự vắng mặt.

Binary/package source bytes không nằm trong 23-file snapshot. Recount trên public installed tree và fingerprint local không xác minh phát hành tin cậy, closure điều kiện/dynamic load, copied bundle hoặc khả năng chạy độc lập. Ước tính tăng 100–150 MiB, peak/cap đề xuất 150–250 MiB là planning trên D, không quota OS đã bật hay quyền ghi dữ liệu. Phải có integrity material/recipe/candidate cụ thể và kiểm dung lượng lại trước thao tác tương lai.

## Findings và phạm vi quyết định

Không có finding blocking cho **checkpoint trung thực hiện tại**. Hai gap alias/runtime trust nêu trên vẫn chặn future credential probe, được báo cáo đầy đủ và không được đánh dấu CLOSED bởi sizing.

Ghi chú không blocking tại [task index:5](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/README.md:5): row hồ sơ native cũ còn “chờ SEC/EVC/chưa áp dụng v3”; top row và báo cáo mới mô tả actual run04 đúng. Đọc row cũ như lịch sử trước run04; nên thêm nhãn lịch sử ở lượt upkeep sau để không nhầm thành trạng thái hiện tại. Không yêu cầu đổi frozen candidate cho ghi chú này.

[Báo cáo checkpoint](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-probe-execution-2026-10-16.md) đề nghị owner **chọn phạm vi chuẩn bị**, chưa chọn sẵn. Nếu chọn runtime private trên D, chỉ chuẩn bị recipe/helper/tests local và review; chưa cho tạo/copy runtime, đổi ACL, install/download, credential use, probe mới, DB hay deploy. Nếu dừng direct probe, không suy thêm quyền online từ kênh MCP đang có. Chưa có implementation runtime và retryReady=false là chính xác.

APPROVE này cho phép bàn giao checkpoint để owner quyết định hướng chuẩn bị; không cấp quyền thực thi bước tiếp theo. Không hạ TLS/ACL, đổi source hoặc nhận historical tests thành backend/hosted gate PASS. Push phát hành/Vercel, database contract 2, backup/recovery/cutover còn chưa đủ điều kiện như báo cáo đã nêu. Private copies vẫn cần cho bước sau, không coi là temp để tự xóa.

EVC chỉ đọc public source/receipts/package metadata, hash public Node và đọc ACL public trong review cuối. Không đọc/hash private bytes, decrypt credential, sửa candidate/private input/ACL/tools, chạy launcher/setup/tests, install/download, DB/network/browser/CI/push/deploy/delete. Chỉ tạo file review này; receipt hồi cứu EVC đã được lập riêng trước freeze theo yêu cầu root.
