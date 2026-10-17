# Review EVC — probe01 từ chối và gói đề xuất thử lại,16/10/2026

**APPROVE candidate01** của gói run/proposal, manifest SHA256 **66d1ed6d6528fce8a62a8eee55c6dc9d775e09952cafde2183113b031d85c937**. [Manifest/snapshot](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-01/candidate-01/manifest.json).

Reviewer độc lập chỉ đọc receipts/source và chạy pure fake/default-plan/syntax/in-memory ACL checks đã được giao. Không sửa candidate/index, không đọc private inputs, không dùng Prepare/RunReadOnly, không actual SetAcl/copy/DPAPI/DB/network, không CI/push/deploy/delete. Review cũ của online assessment giữ nguyên; báo cáo này là gate riêng của kết quả thất bại và đề xuất mới.

## Bằng chứng và nguồn

- Tự kiểm **22snapshot/source files,160.024bytes**: mọi SHA/bytes khớp manifest. Source helper cũ và mới được đọc trực tiếp, không chỉ fake coordinator/tests. Các file proposal được giữ nguyên trước/sau kiểm độc lập.
- intent/invocation/result ghi đúng quyền **một lượt** từ call_3a16b373c5d544d9a23aaf0eb61caf88, candidate online02 SHA7b3f7ee368dac71e4f3d876bdfeace3a92f262ef022baf521ee5bc8647a8ed76,4source pins, marker một lượt và disk reserve. Result ghi **exit1/ACTOR_PROBE_FAILED/LAUNCHER_REFUSED**,04:10:16.8610256Z→04:10:17.2628280Z, làm tròn402ms; không retry. Invocation-provenance có exact argv/cwd và ghi rõ hồi cứu từ command trace, không là một execution mới.
- Fixed refusal không chứa last-completed-stage. Báo cáo không suy thành SQL/connection/ROLLBACK PASS, counts mới, password sai hoặc lỗi TLS/Supabase. Một invocation đã tiêu thụ quyền một lượt; chưa có bằng chứng actor/scope online đạt. Reviewer không tái thực hiện invocation hoặc kiểm toán toàn bộ lịch sử OS/network.
- Hai diagnostic receipts nhất quán: root3unexpected Allow ACE, credential/CA2mỗi file, scope directory/manifest0; existence/type/size/owner/reparse checks đạt,44entries tại private root. Source launcher thực từ chối unexpected Allow trước Import-Clixml/child. Đây là điều kiện từ chối tái hiện được từ source+metadata sau lần chạy, không proof stage của invocation. Không có căn cứ trong gói này kết luận compromise/leak hoặc cần rotation.

## Đối chiếu đề xuất copy và retry

- Module retry byte-identical với module cũ: SHA cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e. Launcher delta chỉ đổi base sang D:/Workspace/pos-cafe-db-readonly-private và flat scope path; không giảm ACL/owner/reparse/pin/TLS/identity/SQL/output/timeout guards. Launcher mới SHA e6c786b31b6f203413aa281b661bf0eec4892f34a5423c5ca186a5867ca68425.
- [Setup:101](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry/setup-private-inputs.ps1:101) kiểm fixed paths/source owner bounds/reparse/existence/exact lengths; source read handles khóa write/delete; pin scope/CA trước tạo destination. Credential hash chỉ dùng so source/destination nội bộ. Không Import-Clixml hoặc gọi network/DB trong setup.
- [Setup:123](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry/setup-private-inputs.ps1:123) tạo directory mới không Force, đặt/kiểm protected ACL trước payload; file dùng CreateNew+FileSecurity protected, rồi verify ACL trước mỗi copy, kiểm lại bytes/hash/ACL và đóng mọi stream. Chỉ đúng3inputs, không enumerate/copy44entries, không đổi nguồn/ACL trên C. Partial output được giữ; failure không thành success, không tự overwrite/delete/retry. Setup SHA3fce5e68718b21b746f10a1bc88527780d50f395e03fd1e3c06200c39508a4e0.
- **907+23.508+1.367=25.782logical bytes**,6proposal files54.106bytes. Chỉ credential có DPAPI protection; scope/CA là bytecopy cần ACL, không nhận cả3file đều encrypted. Dự trù dưới1MiB output bổ sung khác trần/quota OS; phải đo actual disk/task budget lại trước effectful step.
- Source ACL metadata đã khảo sát được phân biệt với actual protected D-copy/byte pins/DPAPI/TLS/actor chưa kiểm. Bản plan sửa đúng giới hạn này. Nguyên quyền một lượt đã dùng không được tái sử dụng; cần **quyền owner mới** cho chính protected copy và đúng một invocation mới, chỉ chạy launcher sau PRIVATE_COPY_VERIFIED và guards đạt. Flag/reference string không tạo quyền; plan không cấp cleanupEligible, backup/full-row/provider certification hoặc release PASS.

## Kiểm độc lập đã chạy

Cwd `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry`, Node24.16.0 có sẵn:

`D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2 actor-probe.test.mjs retry-preparation.test.mjs`

**18PASS/0FAIL/0SKIP/0cancelled,exit0**, stderr rỗng.18gồm12case probe cũ+6case retry/copy mới; không thành30case độc lập hoặc backend cases. Copy tests gọi coordinator thực được extract từ PowerShell AST với fake scriptblocks, phủ thứ tự ACL-before-copy, preflight/hash refusal, partial failure/close và output sanitization; không thực thi production copy adapters.

Cả hai PowerShell default plans exit0 với private-input/credential read/copy/ACL/DB flags false. Hai PS ParseFile checks báo0syntax errors. Extract riêng New-ProtectedSecurity, tạo DirectorySecurity/FileSecurity **trong memory** với SID synthetic: owner đúng, protected và3AllowFullControl cho cả hai; không apply ACL xuống filesystem. Sáu proposal source SHA trước/sau không đổi và khớp root retry-local-verification. Không đánh các phép kiểm này thành actual NTFS ACL/copy/TLS/DB proof.

## Verdict và giới hạn

**Finding chặn:0. Finding không chặn còn mở:0. APPROVE exact candidate SHA66d1ed6d6528fce8a62a8eee55c6dc9d775e09952cafde2183113b031d85c937 trong phạm vi tính đúng của failure record và gói chuẩn bị local.**

Chưa thử copy/private owner/ACL/hash inputs thực hoặc DPAPI, chưa actual retry. Kết quả actor/exact scope online vẫn chưa có; application compatibility, cutover/full gates/provider control/backup/recovery/Vercel còn BLOCKED. Review không xác nhận đã xử lý xong DB và không mở quyền chuẩn bị private destination, thử probe lần hai, mutation/cleanup/push/CI/deploy/delete. Cần giữ receipt thất bại và candidate cũ nguyên trạng.
