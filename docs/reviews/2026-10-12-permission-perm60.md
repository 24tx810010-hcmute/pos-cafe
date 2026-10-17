# Review độc lập PERM60 — 12/10/2026

Candidate được khóa ở [candidate-01](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source20/candidate-01.json): main source-20 fingerprint `00cac9604b03e94b7d20cb34206901c99f30c35ea7ba21119be04c4ef615d412`, docs snapshot và support-01, aggregate/preservation/stop receipts. [Execution](../implementation-log/permission-perm60-2026-10-12.md) và [task](../workflow/tasks/permission-perm60-2026-10-12.md) nêu quyền, kết quả và giới hạn.

Review tuần tự, reviewer chỉ đọc, không sửa candidate/test/expected hoặc deploy. Hai scope bắt buộc:

| Reviewer | Scope | Candidate | Verdict |
| --- | --- | --- | --- |
| SEC — `/root/perm60_security` | Contract/security, delta21, fixture ACL/row restore, actual phase/observer, readiness không thay retry hoặc hạ expected | candidate-01 | APPROVE |
| EVC — `/root/perm60_evidence` | 27 runs/60 TC/726 variants, bytes/profile/source/backend/sequence, snapshots/runtime/dependency locks, preservation/stop và docs limitations | candidate-01 | APPROVE |

Cả hai reviewer dùng ngữ cảnh mới, chỉ đọc; SEC hoàn tất rồi mới dispatch EVC. EVC không được cung cấp kết luận SEC trước đánh giá độc lập. Cả hai explicit APPROVE exact candidate SHA-256 `dbfb3f4fe50a6dd44c85b9c8c7468e27419c2642eb824c842d4e215c40e08e83`. Finding chặn: không có; đề xuất không chặn: không có; không có finding cần xử lý lại. Dưới đây lưu toàn bộ báo cáo cuối, giữ nguyên verdict/candidate/phạm vi và giới hạn của reviewer.

Sau review chỉ bổ sung metadata kết quả review/trạng thái vào chín file docsScope. Docs source-05 được giữ nguyên làm snapshot nội dung đã review; code/expected/evidence/support và các giới hạn không đổi. Bổ sung metadata không yêu cầu review đệ quy theo workflow mục review độc lập bước5. Owner acceptance chưa có; approval này chỉ hoàn tất gate kỹ thuật PERM60 local.

## SEC — báo cáo cuối

**SEC — APPROVE** candidate-01 trong phạm vi contract/security của PERM60 local.

Candidate: [candidate-01.json](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source20/candidate-01.json), SHA-256 `dbfb3f4fe50a6dd44c85b9c8c7468e27419c2642eb824c842d4e215c40e08e83`. Main source-20 fingerprint `00cac9604b03e94b7d20cb34206901c99f30c35ea7ba21119be04c4ef615d412`; docs source-05 và support-01 khớp hash được khóa trong candidate.

Đã kiểm độc lập:

- Đọc diff thực tế cả 21 file từ source-09→20 và 24 support helpers đánh dấu `executedInFinalSet`. Không có delta `src/`/SQL nghiệp vụ; manifest giữ nguyên **60 REQUIRED / 726 mapping / 27 stage**. Không giảm expected hoặc mở skip/retry.
- Restore function ACL financial/read có revoke rồi khôi phục PUBLIC/app grants và grant option. T01 khôi phục timestamp trong transaction có disable/enable trigger; outer snapshot/catalog giữ nguyên. Identity tiếp tục kiểm definition và effective grants sau restore.
- [Observer:28](D:/Workspace/pos-cafe/tests/contracts/permissionStageObservation.ts:28) chạy trên connection fixture sau DDL, gồm clear-demo có DDL chưa commit. Kiểm trực tiếp 10 observation: phase candidate, run/stage/source/time/profile đều khớp; toàn bộ applied SQL hashes khớp source.
- [Signal test:32](D:/Workspace/pos-cafe/tests/contracts/permissionSignals.contract.test.ts:32) chờ readiness trước **một UPDATE nghiệp vụ**, rồi tìm đúng event_id lấy từ DB. Pulse `topic=permission` không thể đáp ứng assertion event nghiệp vụ `topic=menu`; kiểm peer/payload/cross-store vẫn giữ.
- [Role E2E:92](D:/Workspace/pos-cafe/tests/supabase/permissionRoles.spec.ts:92) tạo order qua UI khi thiếu order mở. Setup xác minh candidate activated/strict contract2 và API↔DB; không chuyển lại legacy. Fixture cashier chỉ xóa đúng override synthetic được guard.
- Strict reporters/verifiers từ chối hook failure, expected failure, skip, retry, discovery/result lệch và backend trộn. Sáu phản ví dụ trên bản sao evidence trong RAM đều bị từ chối.
- Kiểm hash snapshot main/docs/support, toàn bộ 27 report/attestation/artifact bytes; **23 service intervals không chồng**, **13 candidate service có một binding**. Installed package manifests Windows/WSL khớp receipt, giữ rõ khác biệt dependency theo host.
- Chạy lại aggregate native WSL: **exit 0, `valid=true`, `mode=full`, `checkedCases=60`, `errors=[]`**.

**Finding chặn: không có. Đề xuất không chặn: không có.**

Giới hạn review: không chạy lại suite DB/browser, không start/reset backend, không sửa candidate. Đối chiếu preservation/stop theo artifacts và code guard; không thực hiện restore vật lý hoặc đo provider. Docs phân biệt đúng PERM60 manifest với full PIN19, CLOSE-2 tổng thể, T15/T16 tổng thể, CLOSE-3 và phát hành; các gate rộng hơn chưa được APPROVE bằng báo cáo SEC này.

## EVC — báo cáo cuối

**EVC: APPROVE** cho exact candidate SHA-256 `dbfb3f4fe50a6dd44c85b9c8c7468e27419c2642eb824c842d4e215c40e08e83`. Không có finding chặn trong phạm vi evidence/coverage/preservation/docs.

Đã kiểm độc lập:

- Chạy CLI aggregate chính thức tại frozen WSL source: **exit0, valid=true, errors=[], checkedCases=60**.
- Đối chiếu toàn bộ **27 reports/attestations**, discovery/results/options theo byte và content hash; source/profile/run identity khớp. Kiểm thêm 10 observation DB candidate theo byte hash, actual phase và thời điểm. Cơ chế đối chiếu: [permission-execution-evidence.mjs](D:/Workspace/pos-cafe/scripts/permission-execution-evidence.mjs:60), [collector](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source20/support-01/collect-full.mjs:19).
- Manifest đủ **60 REQUIRED TC/726 mappings**; case matrix và stage matrix khớp từng run. Dữ liệu execution gốc đếm **794 lượt PASS**, đúng các tổng profile.
- **23 service intervals không chồng nhau**, theo thứ tự T01→T02→T04; **13 service candidate có đúng một backend/fixture/marker/API binding**.
- Mọi hash khóa khớp; kiểm nội dung tar và working trees: main **808 files+2 deletion markers**, docs **634 files**, support **38 files**. Delta source09→20 đúng **21 file test/config/tooling**, không đổi app/SQL nghiệp vụ.
- Windows pnpm và WSL npm có lock riêng khớp installed manifests/selected versions. Supplementary artifacts khớp hash; full unit JSON **1.173/1.173,0 fail/skip**; build/typecheck receipts exit0.
- T01 preservation đối chiếu outer receipt và code full-row integrity/catalog restoration. Storage metadata **3 buckets/6 objects** đối chiếu receipt/helper; đọc độc lập Storage từ container đã dừng xác nhận **18 file, đúng paths và bytes với backup gốc**. Ba file Edge source/runtime hash khớp.
- Read-only inspection xác nhận T01 stopped; T02/T04 mỗi target **12 container, running0**, volumes/networks còn và attachments0.

Readiness TC29 hữu hạn15s; business UPDATE xuất hiện đúng một lần và assertion lấy đúng business `event_id`, tránh nhận pulse setup làm PASS: [test](D:/Workspace/pos-cafe/tests/contracts/permissionSignals.contract.test.ts:32).

Các checkpoint/giới hạn trong chín file docsScope phản ánh đúng gói PERM60 local. Approval này không đóng full PIN19 same-source, CLOSE-2 tổng, T15/T16 tổng thể, physical restore, provider metrics, hosted/CLOSE-3/release hoặc owner acceptance: [giới hạn](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-perm60-2026-10-12.md:58).

Không chạy lại suite DB/browser có mutation, không sửa candidate hoặc trạng thái dịch vụ. Candidate hash vẫn khớp lúc kết thúc review.
