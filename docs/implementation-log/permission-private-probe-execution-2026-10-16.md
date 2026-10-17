# Thực thi setup v3 và probe chỉ đọc — 16/10/2026

## Phạm vi được duyệt và kết quả

Owner chấp thuận qua `call_cb8dbf502bd24764b1a5aeadf5cfbbf0`: áp dụng v3 vào đúng thư mục rỗng đã định danh, copy ba input, rồi đúng một probe READ ONLY nếu setup verified; gặp lỗi thì dừng, không tự retry/xóa. [Candidate v3 đã duyệt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/candidate-01/manifest.json) SHA256 `67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b` có SEC/EVC APPROVE. Sáu source pins và hai review hashes được kiểm lại trước thực thi; không đổi source đã duyệt.

| Bước thực tế | Thời điểm UTC / kết quả | Ý nghĩa |
| --- | --- | --- |
| Setup v3, một invocation | 11:52:03.5929560Z–11:52:04.4081923Z; 815 ms; exit 0, PRIVATE_COPY_VERIFIED | Resume đúng thư mục cũ, createdDirectory=false, tạo/copy đúng ba file; failureStage=NONE, handlesClosed=true; chưa decrypt/DB |
| Kiểm độc lập bản sao trước probe | 11:52:49.8991358Z; PASS | Root và ba file đúng owner, protected ACL đúng ba principals; đúng bộ tên/kích thước; scope/CA hash pins khớp. Credential copy hash đã được setup so với source qua handles, không công khai hash credential |
| Launcher probe, một invocation | 11:52:49.9075751Z–11:52:50.2640272Z; 356 ms; exit 1, ACTOR_PROBE_FAILED / LAUNCHER_REFUSED | Đã dùng quyền một invocation; dừng. Chưa có actor/scope online PASS mới |

Ba file được giữ tại `D:/Workspace/pos-cafe-db-readonly-private`, tổng **25.782 logical bytes**: DPAPI credential 907 B, scope 23.508 B, CA 1.367 B. Credential vẫn lưu mã hóa DPAPI; scope/CA được ACL bảo vệ. Không xóa/overwrite hoặc đổi owner/ACL bản gốc trên C. Không tạo runtime riêng, cài gói, push, CI, deploy hay ra lệnh cập nhật Supabase.

[Artifact run04](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04) giữ intent/source pins/disk, hai invocation markers, setup-result, copy-verification và probe-result. `invocation-provenance.json` bổ sung hồi cứu đúng hai tool inputs gốc/argv/cwd, không re-execute. Parent tool exit 0 chỉ xác nhận lưu receipt; probe script exit 1 vẫn là FAIL.

**Giới hạn bắt buộc:** launcher cũ trả lỗi tổng quát, không có stage trace. Không biết từ receipt liệu đã giải mã credential, khởi chạy Node, thử kết nối hoặc đi đến SQL/TLS chưa. Không suy stage từ 356 ms, không nhận copy-verification trước probe có decrypted=false thành kết quả giải mã của cả invocation sau đó. Không retry hoặc đọc lại private bytes/credential trong chẩn đoán sau lỗi.

## Chẩn đoán local được phép

Trong các kiểm guard metadata sau lỗi, root và hai reviewer chỉ đọc public source/package metadata, Get-Item/Get-Acl; reviewer trích đúng helper từ AST launcher đã pin và chạy riêng guard metadata. Không chạy nhánh `-RunReadOnly`, Import-Clixml, decrypt, network/DB hoặc sửa ACL trong các kiểm này. Hai receipts reviewer ghi đúng là hồi cứu, không bịa timestamp của phép kiểm gốc. Root có một lượt web mở checksum Node công khai tại `https://nodejs.org/dist/v24.16.0/SHASUMS256.txt`, công cụ trả unavailable; chưa có đối chiếu checksum chính thức. Đây không phải truy cập database hoặc tải runtime.

1. [Launcher:47](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:47) gọi `Assert-NoReparse('D:/tools/nodejs/node.exe')`. Leaf node.exe không reparse, nhưng parent `D:/tools/nodejs` là **SymbolicLink → D:/tools/nvm/v24.16.0**. Helper thật hiện từ chối alias này; module path và bốn private metadata guards đều PASS. Đây là điểm từ chối local tái hiện được, hỗ trợ giải thích lỗi; không phải actual last-stage trace của invocation đã chạy.
2. Canonical path `D:/tools/nvm/v24.16.0/node.exe` và các tổ tiên hiện non-reparse. Chỉ đổi sang đường dẫn này giải quyết functional guard; chưa đủ để tuyên bố runtime an toàn nhận credential.
3. SEC xác minh **AUTHENTICATED_USERS có Modify** trên canonical Node và pg entry. [Launcher:65](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:65) chạy Node, [module:148](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/actor-probe.mjs:148) import `pg`; launcher hiện pin/lock probe module và private inputs, chưa pin/lock runtime/dependency closure. Đây là khoảng trống trust cho lượt nhận credential tiếp theo, **không có bằng chứng tampering hoặc secret leak**. Không thay ACL của Node/pg để tự đóng phát hiện.

[SEC qualification](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04/launcher-metadata-qualification-sec.json) và [EVC qualification](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04/evc-metadata-qualification-retrospective.json) phân biệt kết quả metadata với invocation thật. `dependency-resolution.json` xác nhận `pg` 8.23.0 resolve được từ vị trí probe; giả thuyết thiếu pg tại bản kiểm thử riêng không là blocker đã chứng minh. Không import/evaluate pg khi khảo sát resolution.

## Đề xuất phạm vi tiếp theo — chưa được chọn

Khuyến nghị **chuẩn bị một runtime riêng được bảo vệ trên D**, dùng Node và dependency đã có, giữ no-reparse và ACL chỉ current user/SYSTEM/Administrators. Không đổi runtime dùng chung hoặc bỏ guard. Trước credential use phải có nguồn integrity đủ tin cậy, closure đầy đủ, protected-before-bytes, pins/locks, source-bound tests và review. Việc sao chép chỉ khóa trạng thái sau copy, không tự chứng minh bytes nguồn trước đó là đúng.

Khảo sát public `runtime-sizing-v2.json`: Node 92.279.112 bytes; 14 packages/138 files, 463.780 bytes; tổng **92.742.892 bytes (~88,45 MiB)**. Có optional peer `pg-native` chưa cài; phải kiểm điều kiện tải thực và không tự cài. Cả 14 package có lock integrity entry khớp version; chưa đối chiếu installed bytes với archive. SHA Node `b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3` chỉ là fingerprint local, chưa đối chiếu nguồn phát hành. Lượt sizing đầu thiếu ba package do package exports; giữ receipt cũ, v2 dùng resolver entry→package root và không nhận lỗi resolver đó thành thiếu dependency.

Đề xuất vị trí `D:/Workspace/pos-cafe-db-probe-runtime-private`, **chưa tạo**. Ước tính nếu được duyệt thực thi sau này: không tải lại runtime/browser; tăng khoảng 100–150 MiB trên D, đỉnh dự trù 150–250 MiB gồm integrity material/temp. Trần đề xuất 250 MiB cho gói này, không phải quota OS đã bật. Nguồn integrity/cache chưa đủ thì dừng; chưa tự tải/cài hoặc nhận estimation thành qualification. Không chi phí dịch vụ mới. Checkpoint trước probe C/D trống lần lượt 203.418.296.320 / 103.392.772.096 bytes, đều vượt dự trữ 30 GiB; phải đo lại trước ghi dữ liệu lớn.

**Quyết định đang cần:** owner có chọn hướng chuẩn bị runtime private này không, hay dừng direct probe tại checkpoint và giữ kênh MCP chỉ đọc hiện có. Việc chọn hướng chỉ cho chuẩn bị recipe/helper/tests local và review (dự kiến source/evidence dưới 1 MiB trên D); chưa cho tạo/copy runtime, cài/download package, dùng lại credential, probe mới, sửa DB hoặc deploy. Runtime chưa có implementation và chưa retry-ready; execution sẽ cần gói cụ thể đã kiểm/review và quyền mới.

Các ràng buộc giữ nguyên: SQL READ ONLY/rollback, target/scope/CA, một connection, heap Node 512 MiB, process timeout 90 giây. Heap không là quota RAM/CPU OS. Không hạ coverage, bỏ TLS/ACL, nới cleanup scope hoặc nhận kiểm local thành hosted gate PASS.

## Push và nội dung báo cáo đồ án

Có thể ghi nhận cụ thể: đã áp dụng/kiểm chứng setup v3 trên máy thật, tạo ba input được bảo vệ; đã thực hiện đúng một launcher probe và tìm ra guard runtime chưa đạt bằng kiểm metadata độc lập. Không báo cáo direct actor/scope online, database contract 2 hoặc cutover thành công. [Backend hiện còn legacy](permission-online-compatibility-2026-10-16.md); backup/recovery, hosted profile/control và các backend gates vẫn chưa hoàn tất. **Chưa đủ điều kiện push phát hành** khi main có trigger Vercel Production; giữ lệnh chưa push của owner.

[File inventory](permission-file-inventory-2026-10-16.md) vẫn giữ phân loại source/docs và local exclusions; không có file nào bị xóa. Ba private inputs đang cần cho bước sau, không là temp đề xuất xóa. Public fixtures/receipts lịch sử được giữ để đối chiếu; không nhân runtime lớn hoặc tạo lab Linux/Docker mới.

Walkthrough: quyền owner → pins/empty target → setup thật PASS → kiểm bản sao → một launcher FAIL → metadata alias/trust gap → khảo sát sizing → review checkpoint → chờ owner chọn hướng. Chưa nhận owner đã đọc/hiểu hoặc nghiệm thu walkthrough. Các biên bản cũ giữ nguyên, không sửa kết quả FAIL thành PASS.

## Metadata review và bàn giao cuối

**SEC/EVC cùng APPROVE checkpoint candidate-01**, SHA256 `43e667c605993e3dfc6041a0b1f19e3b09526177d307f7b8d1ce511038cee297`, 23 files/163.918 bytes. [SEC](permission-private-probe-execution-sec-review-2026-10-16.md), SHA `e3358fa53987e1ef8fabf7b8d01f998c15f26571d72c205f119a646c7bd70de8`; [EVC](permission-private-probe-execution-evc-review-2026-10-16.md), SHA `351303387965a4dec002816f1ea3fe71826494cc70831f9d014bce16881f4fc9`. Không finding cần sửa đối với hồ sơ checkpoint; SEC-RUN04-01/02 vẫn OPEN, chặn execution mới. Review không phê duyệt implementation/copy runtime hoặc probe mới.

Hai reviewer đối chiếu source/receipts/counters/provenance và giới hạn UNKNOWN. EVC kiểm lại sizing/package metadata/Node fingerprint và public ACL; không import pg, chạy test/probe hoặc đọc private bytes mới. Không cộng các metadata checks thành test DB. [Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-04/closeout.json) giữ kiểm cuối và review pins; metadata này chỉ nối thêm sau freeze.

Ghi chú EVC không chặn: hàng native-v3 cũ trong task index là lịch sử trước run04; top entry run04 mới hơn mới là hiện trạng. Giữ nguyên frozen candidate, đánh dấu rõ trong metadata này; sửa prefix ở lượt upkeep kế tiếp. Hiện tại đã có ba bản sao protected; đã dùng một launcher invocation và dừng trên lỗi, chưa retry/runtime copy. Chờ owner chọn hướng PREPARATION ONLY, không tự chọn khi chưa trả lời.
