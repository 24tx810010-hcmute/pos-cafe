# Review khảo sát và proposal CI1 local — 15/10/2026

Phạm vi: tính xác thực source/input/budget và thiết kế có điều kiện public CI/encrypted evidence/Windows key custody. Không review implementation hoặc actual CI1; chưa có chúng. [Biên bản](../implementation-log/permission-linux-ci1-survey-2026-10-15.md), [proposal](../workflow/tasks/permission-linux-ci1-local-proposal-2026-10-15.md).

Candidate sẽ khóa bằng manifest+recoverable snapshot tại `D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/candidate-01.json`. Source/test/config và metadata khảo sát được pin; không copy sáu private raw input, chỉ receipt path/bytes/SHA.

| Reviewer | Phạm vi | Trạng thái khi freeze |
| --- | --- | --- |
| SEC |Quyền D10/crypto custody/publication/ACL/storage miễn phí/fail-closed/full-gate boundary |PENDING |
| EVC |Byte/source/input survival/budget labels/traceability/links/status và snapshot |PENDING |

Reviewer phải độc lập với tác giả/scouts của phần mình duyệt; không chỉnh candidate/chạy CI/DB hoặc tạo khóa. Approval là khảo sát/proposal có điều kiện, không biến unknown install bound/storage/crypto roundtrip thành PASS, không thay quyền owner sau review. Các metadata verdict sau freeze được ghi riêng, snapshot không sửa.

## Metadata kết quả sau freeze

Candidate [candidate-01.json](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/candidate-01.json), SHA256 **`85c4d595de332e99dceab176640ac408822018edaa3775f31eec9c34d289f34d`**,37files/568.201bytes; snapshot phục hồi `snapshot-01` cạnh manifest. PENDING phía trên là trạng thái khi freeze; live docs chỉ bổ sung metadata review. Scouts khảo sát source/budget không là hai reviewer dưới đây.

**SEC `/root/review_plan_sec` — APPROVE**, không finding chặn hoặc không chặn. Kiểm37/37live/snapshot hash/bytes; AGENTS/review gate, D10/proposal/correction/receipts/source anchors12service/bootstrap/schema-only/guards. Xác nhận D10 chỉ hướng khảo sát, chưa thiết kế/keygen/install/upload/run; crypto khác sender-auth, Windows DPAPI/recovery phải kiểm trước keygen, `.partial`quarantine/binding/hash/archive validation; ciphertext/TTL không phải privateACL/thu hồi bản sao. Upper bound/quota/hardstop vẫnUNKNOWN, Releaseassets chưa chọn/no fallback/noContentswrite;6rawinput không vào payload/noequivalence/noquyềnmới; pilot/full gates tách rõ, waiverLocofy CI0 không mở CI1. Giới hạn: không network/private raw/keygen/crypto/install/test/CI/DB; chưa chứng minh age/DPAPI/recovery/peak/storage0đồng. Approval chỉ hồ sơ có điều kiện, không thay owner acceptance/implementation/publication/execution.

**EVC `/root/ci0_execution_evc` — APPROVE**, không finding chặn hoặc không chặn. Kiểm37files/74hash+kích thước source/snapshot,HEADs; tự stat+hash6inputWindows954.052B, không hiển thị raw; đúng Windowsreference/override vs WSLstaging khác. Rehash Windows833files+2deletionmarkers/13.328.217B, không lệch/không scan ngoài manifest. Historical archive/store/browser figures khớp, không new upperbound/doublecount/c.ImageOCI suy đoán.12services/16migrations/2Auth/2tenant/5employees; T09=1test/T10=3tests,9expectedgroups không9actualcases; health/SUBSCRIBED không thay behavioralPASS.58local links/line targets tồn tại; chưa duyệt age/transport/keygen/install/publication/run, UNKNOWN giữ là blockerexecution. Giới hạn: không network/registry/billing/rawrestore/cryptoDPAPI/runtime, không test/edits/mutation. Approval chỉ khảo sát/proposal.

Coordinator: hợp hai phạm vi bao phủ đầu ra khảo sát; không finding cần sửa, frozen manifest/snapshot giữ nguyên. Các thay đổi sau freeze chỉ metadata verdict/state/link. Khảo sát local hoàn tất; thiết kế vẫn chờ owner, runtime/project readiness chưa đạt.
