# Direct actor/scope probe — lượt được duyệt16/10/2026

## Kết quả hiện tại

**Một invocation đã chạy và không đạt: ACTOR_PROBE_FAILED / LAUNCHER_REFUSED, exit1. Không tự thử lại.** Chưa có kết quả TLS/actor/exact scope online; compatibility vẫn BLOCKED. Không coi12pure tests đã PASS ở bước chuẩn bị là lượt kiểm online này PASS.

Owner trả lời “Cho phép đúng một lượt probe chỉ đọc như mô tả (khuyến nghị)” cho câu hỏi `call_3a16b373c5d544d9a23aaf0eb61caf88`. Phạm vi: dùng credential PostgreSQL đã lưu trên máy, đúng target hiện tại, một connection/READ ONLY/ROLLBACK, chỉ ID/Storage metadata trong memory và sanitized counts/booleans/hash; không PIN/token/business payload/object bytes, mutation/cleanup/push/CI/deploy/delete hoặc cài thêm. Quyền này không tự mở lượt thử thứ hai hoặc quyền đổi ACL.

Nguồn đã duyệt: [candidate02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/candidate-02/manifest.json), SHA256 `7b3f7ee368dac71e4f3d876bdfeace3a92f262ef022baf521ee5bc8647a8ed76`. Trước invocation, root kiểm lại đúng4file probe/hash/bytes và trần trống C/D30GiB. Dự trù output tối đa100KiB dưới D:/Workspace; không tải/cài/copy runtime hay tạo môi trường mới.

## Receipt thực thi

Artifact [actor-probe-run-01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-01):

| Receipt | Nội dung/giới hạn |
| --- | --- |
| intent.json | Owner approval, source pins, một lượt tối đa và dung lượng ổ thật trước chạy |
| invocation.json | Marker CreateNew trước invocation để tránh lặp vô ý; không credential/SQL result |
| invocation-provenance.json | Exact argv/cwd từ command trace thực đã chạy; ghi hồi cứu rõ, không thực thi thêm; approval reference không phải secret |
| result.json | Bắt đầu04:10:16.861Z, kết thúc04:10:17.263Z ngày16/10/2026 (11:10:16–17 UTC+7),402ms; launcher exit1 và fixed refusal code; không raw stderr hoặc private values |
| local-metadata-check.json | Chẩn đoán riêng tại máy sau thất bại: existence/type/size bounds/owner/reparse/ACL; không decrypt hoặc network |
| acl-diagnosis.json | Chỉ principal classes/rights/inheritance và số lượng; không account names/SIDs/raw private paths/payload |

Launcher chỉ trả fixed LAUNCHER_REFUSED ở failure, không đánh dấu stage đã đi tới. Vì vậy receipt này không chứng minh actual SQL/connection/rollback thành công hoặc counts hiện tại. Không chạy lệnh online thứ hai để tìm lỗi và không lưu lại mật khẩu.

## Chẩn đoán local có căn cứ

Ngay sau invocation, metadata cho thấy private root có3Allow ACE ngoài tập current user/SYSTEM/Administrators; credential và public CA mỗi file có2Allow ACE ngoài tập; scope directory/manifest không có. Tất cả tồn tại, owner khớp current user, size hợp lệ và không có reparse ancestors. Chưa phân loại được chính xác các principal ngoài tập, không nhận chúng thành bằng chứng credential đã lộ. DPAPI vẫn là lớp bảo vệ của credential đã lưu; slice này không kiểm compromise hoặc cần rotation.

[Launcher đã duyệt:31](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe/invoke-actor-probe.ps1:31) từ chối unexpected Allow ACE; check private root đứng trước Import-Clixml và child PostgreSQL process. Metadata mới tái hiện một điều kiện chắc chắn bị guard từ chối. Đây là chẩn đoán source + local metadata sau lượt chạy, không receipt stage-by-stage của lần chạy. Chưa có căn cứ kết luận mật khẩu DB sai hoặc Supabase/TLS lỗi.

Private root chung có44entries ở cấp đầu; không tự siết ACL cả cây, không đổi ACL đầu vào, không đọc nội dung44entries hoặc xóa gì. Các chẩn đoán không giải mã credential và không khởi tạo connection.

## Phương án đã chuẩn bị local, chưa được chọn/chạy

Giữ guard bảo vệ. Chuẩn bị gói local riêng cho `D:/Workspace/pos-cafe-db-readonly-private`: chỉ ba input (credential DPAPI907B, scope manifest23508B, CA1367B, tổng25782B), user hiện tại/SYSTEM/Administrators, inheritance protected; chỉ sau khi owner duyệt mới tạo/khóa quyền/stream copy vào file mới và đối chiếu hash. Không sửa nguồn/ACL trên C, không ghi token hoặc decrypt trong bước copy. Không overwrite nếu destination đã có. Điều kiện owner/reparse/hash/budget không đạt phải dừng, không bypass.

Probe đề xuất giữ nguyên fixed SQL/target/pins/rollback/timeouts/output whitelist đã review; chỉ đổi nơi đọc ba input sang thư mục D riêng, có candidate/hash/review mới. Setup phải mặc định plan và không chạm private inputs; nhánh effectful chờ owner. Không phải migration/backup/certified provider implementation. Một lượt readonly mới cũng cần owner cho phép rõ, quyền lần đầu không được tái sử dụng.

Gói [actor-probe-retry](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry) gồm6file/54.106bytes. `actor-probe.mjs` giữ SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`; launcher mới SHA `e6c786b31b6f203413aa281b661bf0eec4892f34a5423c5ca186a5867ca68425`, setup SHA `3fce5e68718b21b746f10a1bc88527780d50f395e03fd1e3c06200c39508a4e0`. Bản cũ giữ nguyên. Thư mục private mới ở ngoài hai checkout Git, không thuộc payload source/docs.

Setup khóa source để chống ghi/xóa trong lúc copy; pin scope/CA, kiểm exact sizes cả3, hash bản credential mã hóa chỉ so sánh nội bộ không xuất. Nó tạo thư mục mới rỗng không Force, đặt và kiểm ACLprotected, tạo file CreateNew kèm FileSecurityprotected trước payload, kiểm lại ACL/hash/bytes và đóng streams. Nếu lỗi giữa chừng giữ nguyên output riêng để chủ dự án quyết định, không tự xóa/ghi đè/chạy tiếp. Chỉ credential được DPAPI mã hóa; scope/CA là bytecopy được bảo vệ ACL. Setup không cấp quyền cho một lượt DB mới; quyền phải đến trực tiếp từ owner.

Recipe sau review và **chỉ sau owner duyệt mới**: chạy `setup-private-inputs.ps1 -Prepare -ApprovalReference <quyền mới>`; chỉ khi result PRIVATE_COPY_VERIFIED, đúng source/hash/3file ACL và budget thì chạy launcher mới `-RunReadOnly -ApprovalReference <cùng quyền mới cho một lượt>`. Chỉ một invocation mới, không retry nếu fail. Không có permission này ở checkpoint hiện tại; không dùng chuỗi reference/flag như nguồn cấp quyền.

Tổng payload sao chép dự kiến khoảng26KiB, gói source/test/snapshot/receipt bổ sung dự trù dưới1MiB trên D, không package/network/install hoặc chi phí dịch vụ. Đây là ước tính logical bytes, không quota OS/NTFS allocation. Đo C/D và ngân sách task trước thực hiện nếu được giao.

## Bàn giao và kiểm chứng

[retry-local-verification.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-01/retry-local-verification.json) gắn6SHA/runtime/lệnh: Node24.16.0, pwsh7.6.5, **18/18pure tests PASS/0FAIL/0SKIP**, gồm12ca probe cũ+6ca default/fake-copy mới; không phải30ca độc lập hoặc18backend tests. HaiPS syntax0errors, haiACLshape chỉ tạo trong memory đều protected/currentowner/3AllowFullControl, cả hai defaultplans không đọc privateinputs/kết nối. Nodeheap512MiB/testconcurrency2 chỉ là giới hạn testprocess, không quota OS. Không chạy -Prepare/ACL thật, không copy ba input, không đọc nội dung private trong chuẩn bị hoặc invocation mới. Destination chưa tồn tại lúc root kiểm. Rerun tests vì source helper mới, không lặp probe online.

[Khảo sát Supabase/source](permission-online-compatibility-2026-10-16.md) và [kiểm kê code/docs](permission-file-inventory-2026-10-16.md) vẫn là evidence trước invocation. Các closeout/candidate cũ giữ nguyên để tái kiểm, không sửa status lịch sử từ chưa chạy thành PASS.

Phần ghi DB/cutover/Storage/Realtime/Edge/full gates/recovery/Vercel vẫn chưa hoàn tất hoặc được phép. Chuẩn bị walkthrough: approval một lượt→source pins→điều kiện ACL→refusal→diagnostic không network→gói đầu vào riêng→đợi owner. Owner chưa xác nhận nghiệm thu walkthrough. Cần SEC/EVC review candidate mới gồm receipts, chẩn đoán và gói đề xuất trước khi bàn giao phần phân tích này hoàn tất.

## Metadata review cuối — sau freeze

**SEC và EVC cùng APPROVE** run/proposal candidate01 SHA256 `66d1ed6d6528fce8a62a8eee55c6dc9d775e09952cafde2183113b031d85c937`,22snapshots/160.024bytes. [SEC](permission-direct-actor-probe-sec-review-2026-10-16.md) và [EVC](permission-direct-actor-probe-evc-review-2026-10-16.md) đối chiếu source/hash, failure/authority boundary, setup/launcher thật, tự chạy18pure tests/defaultplans/syntax/in-memory ACL; không findings mở. Hai review assessment cũ giữ nguyên.

Hoàn tất **biên bản một lượt thất bại và gói đề xuất local**, không phải hoàn tất actor/scope online hoặc cấp quyền chuẩn bị private copies/chạy probe mới. Actual setup/ACL trên đĩa/private inputcopy/retry vẫn NOT RUN; chờ owner mới. [Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-01/closeout.json) ghi kiểm cuối và review fingerprints; mọi giới hạn frozen giữ nguyên.
