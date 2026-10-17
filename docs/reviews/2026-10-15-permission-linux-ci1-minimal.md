# Review gói CI1 tối thiểu — 15/10/2026

Phạm vi: cập nhật acceptance evidence theo ownerD11, safe public proof/free log-summary policy, metadata image và scope/budget còn chặn. Không review actual harness hoặc runtime chưa có. [Gói hiện hành](../workflow/tasks/permission-linux-ci1-minimal-2026-10-15.md), [biên bản](../implementation-log/permission-linux-ci1-minimal-preparation-2026-10-15.md).

Candidate01 khóa tại `D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/candidate-01.json`, SHA256 `062c1f567406815f964ce6be454559d70af0d52c11fad5dbfade75989a971f95`,20files/359168bytes. Giữ nguyên snapshot01 và verdict lịch sử. Candidate02 sẽ khóa correction và hồ sơ sửa; không nhận review gói mã hóa trước thành approval gói tối thiểu.

| Reviewer bắt buộc | Phạm vi | Trạng thái lúc freeze |
| --- | --- | --- |
| SEC |OwnerD11 override/secret exclusion/public proof/scope/free/limits |Candidate01 CHANGES_REQUESTED; candidate02 PENDING |
| EVC |Registry digest/platform/bytes/status, source/test counts/budget labels/recoverable package |Candidate01 CHANGES_REQUESTED; candidate02 PENDING |

Reviewer không chỉnh file, push/CI/DB, đọc raw secret hoặc tạo runtime; chỉ rà khảo sát/plan và trả finding/verdict. Metadata kết quả bổ sung sau freeze không đổi acceptance hoặc bằng chứng.

## Findings candidate01 và xử lý trước candidate02

| ID | Reviewer/finding chặn | Xử lý của tác giả | Trạng thái |
| --- | --- | --- | --- |
| SEC-MIN-01 |Task index còn ghi chờ duyệt crypto |Đổi dòng proposal cũ thành lịch sử/superseded bởi D11, không hỏi lại owner |Đã sửa; chờ SEC xác nhận candidate02 |
| EVC-MIN-01 |Intent ghi25433giây thay vì233,354818giây từ initial completed |Giữ intent gốc và snapshot01, thêm timestamp-correction.json với UTC anchors/hash; actual retry233,4025036giây vẫn>60; ghi guard chuyển kiểu cũ không đáng tin |Đã sửa; chờ EVC xác nhận candidate02 |

SEC candidate01 đã đối chiếu20/20live/snapshot hashes và đọc quyết định/làm rõ trước câu trả lời; không thấy finding khác trong policy/scope. EVC candidate01 đối chiếu20files/40checks,12metadata rows/106layers/bytes/17local links; không thấy finding khác trong evidence scope. Cả hai chưa kiểm reporter/runtime/test/CI actual; approval khảo sát sau sửa vẫn không thay những việc ấy.

## Verdict cuối — candidate02

[Manifest candidate02](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/candidate-02.json), SHA256 `950abb1aaea99f32e00cf59e146cf9ffe7d133f73fe43d02ce7aa9f04e44e206`,22files/371839bytes; snapshot02 giữ nội dung trước verdict. Đây là metadata ghi kết quả review sau freeze, không sửa snapshot hoặc acceptance.

| Reviewer | Verdict trên candidate02 | Finding và phép kiểm |
| --- | --- | --- |
| SEC |APPROVE |SEC-MIN-01 đóng;22/22live/snapshot hashes/bytes khớp. Xác nhận D11/safe public proof/secret exclusions/free-policy limits và hai file reporter/test mới chỉ là đề xuất, chưa tồn tại. Không còn finding |
| EVC |APPROVE |EVC-MIN-01 đóng;22files/44hash-size checks,371839bytes. Tự tính UTC233,354818/233,4025036giây, tái hiện lỗi chuyển kiểu−25200,5902549giây; giữ candidate01/intent/snapshot01/draft.19local links tồn tại,2HEAD khớp. Không còn finding |

Cả hai reviewer chỉ đọc plan/metadata/source anchors, không network/test/CI/DB/mutation; không chứng minh reporter, runtime bounds hoặc actual pilot. Approval không cấp quyền implementation/install/push/CI/DB/deploy/xóa. Coordinator kiểm44hash-size checks khớp và6source anchors cũ không đổi: [check](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/coordinator-check.json). Bản draft manifest02 có aggregate null do Measure-Object trên OrderedDictionary được giữ riêng; final tổng371839 đã sửa trước dispatch, mọi snapshot/entry không đổi.
