# Private inputs — setup dừng và bản sửa local,16/10/2026

## Kết quả đã thực hiện

Owner chấp thuận tạo thư mục private trên D, copy đúng3input và chỉ chạy một lượt READ ONLY nếu setup đạt, qua câu trả lời `call_f7a2cc88b3bb46b287bada7a30597905`. Có điều kiện rõ: lỗi bất kỳ bước nào thì dừng, không tự thử lại hoặc xóa.

Đã kiểm lại6source hashes theo [candidate đã duyệt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-01/candidate-01/manifest.json), SHA `66d1ed6d6528fce8a62a8eee55c6dc9d775e09952cafde2183113b031d85c937`, và dung lượng C/D đều hơn30GiB. Root gọi setup đúng1lần:04:28:20Z ngày16/10 (11:28:20 UTC+7),512ms, exit1 **PRIVATE_COPY_FAILED / PRIVATE_COPY_REFUSED**. Receipt có createdDirectory=false, createdFiles=0, copiedFiles=0, credentialDecrypted=false, databaseConnected=false. Probe mới chưa được gọi. Dừng tại lỗi, không sửa ACL/Cinput, không xóa hoặc tạo bản sao private.

[Artifact run02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-02) giữ intent/sourcepins/Windows disk, setup-invocation/result, owner-diagnosis và các kiểm tra v2. Setup result không cung cấp tên Validate/LockSources stage; không nhận metadata chẩn đoán sau đó thành actual stage trace. Counters0 và quan sát destination không tồn tại xác nhận chưa có output private; không suy lỗi mật khẩu/TLS/SQL hoặc nhận DB PASS.

## Nguyên nhân và trách nhiệm sửa

Guard `Assert-OwnerPath` bản1 yêu cầu cả mọi tổ tiên chỉ do current user/SYSTEM/Administrators sở hữu. Chẩn đoán local Get-Item/Get-Acl cho thấy source leaf và private directories đúng owner, không reparse; các tổ tiên khác phù hợp, riêng **C:\ do NT SERVICE TrustedInstaller sở hữu** bị từ chối. Droot do SYSTEM, D:/Workspace do current user. Đây là điều kiện guard do agent chuẩn bị quá chặt với máy thực tế; root nhận trách nhiệm sửa, không yêu cầu owner đổi quyền sở hữu Windows để làm vừa guard.

Không giải mã credential hoặc đọc private bytes trong các chẩn đoán; chỉ ghi nhãn principal/system owner class/booleans, không account names/SIDs/private values. Không cấp quyền cho TrustedInstaller trên file/thư mục nào và không đổi owner C:\.

## Bản sửa chỉ ở local

Gói [actor-probe-retry-v2](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v2) giữ source v1 đã review. Module DB, launcher, testprobe giữ nguyên bytes; không đổi target/SQL/timeout/DPAPI/CA/scope pins hoặc stdout whitelist. Setup chỉ sửa owner predicate và truyền SID của account hệ thống local vào phép kiểm:

- Chỉ thêm chấp nhận TrustedInstaller ở **directory đúng C:\, là ancestor không phải leaf**, không reparse. Lookup account cố định NT SERVICE TrustedInstaller, lỗi thì từ chối.
- Mọi private leaf/private directory vẫn bắt buộc current user. Không thêm TrustedInstaller vào ACL allowlist; ACL destination vẫn protected với đúng3principals current user/SYSTEM/Administrators và CreateNew trước payload.
- Không cho ngoại lệ ở D:\, C:\subdir, file leaf, root được truyền như leaf hoặc owner khác. Source locks/pins/size, chỉ3file, verifyhash/ACL, giữ partial output, nooverwrite/nodelete và noCchanges vẫn giữ nguyên.

Plan và test được cập nhật theo chính lỗi thật; không bỏ guard hoặc giảm tiêu chí business/permission. Bản setupv2 **chưa được thực thi**, không dùng quyền một lần trước để chạy lại.

## Kiểm chứng mới

[v2-local-verification.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-02/v2-local-verification.json) gắn6SHA, Node24.16.0/pwsh7.6.5, lệnh và TAP: **19/19pure tests PASS/0FAIL/0SKIP**, gồm18ca trước+1ca mới có11kịch bản owner-chain giả lập qua hàm Assert-OwnerPath thật được trích AST. Các ca âm bao gồm TrustedInstaller tại leaf/nonroot/Droot, wrong leaf owner, unresolved SID, reparse và root không phải directory. Không cộng thành37ca hoặc gọi đây là test database. HaiPS syntax0errors, hai defaultplans không copy/ACL/credential/DB.

[v2-owner-metadata-verification.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-02/v2-owner-metadata-verification.json) chạy riêng hàm Assert-OwnerPath đã sửa trên **6đường dẫn metadata thực**: parentD, source root/scope dir và3input đều PASS; không chạy setup/copy/hash private bytes/DPAPI/ACL mutation/network. Source setup SHA `d328951b5e1762980ddb686dfd743640c5345ac79f9730eaa21f121d1ccfdd88`. Destination vẫn không tồn tại. Đây là qualification cho owner/reparse predicate, không actual copy proof hay permission-runtime PASS.

## Phạm vi còn chờ owner

Sau SEC/EVC review đúng candidate v2, trình owner cho phép chạy lại setup đã sửa và chỉ một probe READ ONLY khi setup verified. Quyền mới phải ghi trực tiếp từ owner vì điều kiện dừng trên lỗi đã áp dụng; lượt probe mới của gói trước chưa dùng, không nhận nó thành đã chạy hoặc ngầm cho setup lần2. Không có quyền mới ở checkpoint này.

Recipe giữ3input25.782B, new-only private Dfolder ngoài2checkout, full pinned source/budget kiểm lại trước chạy. Phần tăng dự kiến dưới1MiB trên D, không install/package/image/WSL/Docker/dịch vụ trả phí. Probe future vẫn một connection, Nodeheap512MiB, chờprocess90giây, chỉ ID/metadata transient và safe result; đây không là OS CPU/RAM quota. Không đổi Supabase/cleanup/CI/Git/push/Vercel/deploy. Database compatibility, fullrow/backup/recovery/profile/cutover và backend tests vẫn chưa hoàn tất.

Walkthrough: source1→setup fail counters0→Croot owner metadata→ngoại lệ ancestor hẹp→11kịch bản owner-chain (2positive/9negative)→6real metadata checks→review→đợi owner. Chưa nhận owner đã nghiệm thu/hiểu walkthrough. Hồ sơ trước: [run01/proposal](permission-direct-actor-probe-2026-10-16.md), [online gaps](permission-online-compatibility-2026-10-16.md), [file inventory](permission-file-inventory-2026-10-16.md).

## Metadata review cuối — sau freeze

**SEC/EVC cùng APPROVE candidate02**, SHA256 `274a5fe18e4c4fd1ef54f4bd8b1343f3dbb96f8302023fadf46dc5ab6aec1073`,21snapshot files/154.090bytes. [SEC](permission-private-input-setup-sec-review-2026-10-16.md) và [EVC](permission-private-input-setup-evc-review-2026-10-16.md) độc lập kiểm delta,19pure tests từ snapshot, defaultplans/syntax và giới hạn6metadata checks. Thiếu reference module để replay ở candidate01 đã được bổ sung vào02; wording11scenarios2positive/9negative đã sửa. Không finding chặn.

SEC-SETUP-N01 không chặn: một câu limitation plan còn underclaim chưa kể6real metadata checks; báo cáo và receipt mô tả đúng, không mở quyền hoặc nhận copy/DB PASS. Giữ ghi nhận này, không đổi code/expected/frozen bytes sau approval.

Hoàn tất hồ sơ lỗi setup và bản sửa guard local; **chưa chạy setupv2, đổi ACL trên đĩa, tạo/copy private inputs hoặc gọi probe DB mới**. Chờ owner duyệt mới do điều kiện dừng trên lỗi; compatibility vẫn BLOCKED. [Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-02/closeout.json) gắn review hashes/kiểm cuối; metadata này không thay kết luận frozen.
