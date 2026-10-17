# Bàn giao spec redesign-permission-model

> Lịch sử trước review ngoài. Trạng thái và quy tắc initial print dưới đây đã được mở lại bởi R01–R15/Q15; xem [bàn giao chuẩn bị hiện hành08](08-ban-giao-chuan-bi-sau-review-2026-09-15.md). Giữ phần còn lại làm bằng chứng của lần bàn giao trước, không phải quyết định hiện hành.

Ngày **2026-09-15**. **READY FOR APPROVAL**: đủ bảy loại artifact, hai reviewer độc lập đã recheck và đóng findings, không còn quyết định nghiệp vụ mở. Đây là trạng thái tài liệu để chủ dự án duyệt, **chưa triển khai feature và chưa được phép tự chuyển sang task code**.

## 1. Baseline và phạm vi đã giữ

| Thành phần | Baseline xác minh | Trạng thái cuối task |
| --- | --- | --- |
| Code | main `ef2c372aec60d8362549e47b7aedb27126129479`; application commit trước `8ed7418573fe88e27796d3b09807a3c55db4d0d6` | Không sửa application code, migration hoặc test implementation; không có tracked/staged diff |
| Docs | docs `f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` cộng working tree có sẵn | Chỉnh đúng spec, điều hướng, limitation và dependency liên quan; không commit/push |
| Lockfile code có sẵn | SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996` | Giữ nguyên, vẫn untracked |
| Phase 27 | [Release](../../implementation-log/phase-27-release-check-2026-09-14.md), [follow-up](../../implementation-log/phase-27-timeout-followup-2026-09-14.md) | Không sửa các biên bản; không chạy lại để lặp số test cũ. Business smoke cửa hàng thật vẫn chưa chạy |

Baseline diff/status và manifest SHA256 của **436 file docs** được lưu trước khi chỉnh tại thư mục tạm `C:/Users/nguye/AppData/Local/Temp/pos-cafe-permission-spec-20260914`. So lại cuối task: 14 file baseline thay đổi đúng danh sách mục4, 422 file còn lại giữ nguyên byte, không mất file baseline. Các thay đổi có sẵn như UI redesign context, measure-runtime-load, references và những proposal ngoài scope được giữ nguyên; không reset/clean/stash/đổi nhánh.

Ba subagent khảo sát requirements/client/server được dùng trước khi viết; agent requirements được gọi lại để biên tập testplan. Hai agent cuối **finalreview_business** và **finalreview_security** đọc độc lập bộ hoàn chỉnh, không cùng sửa artifact; người biên tập xử lý finding rồi chính hai reviewer đó kiểm lại. Tổng năm subagent, không vượt giới hạn sáu của chủ dự án.

## 2. Quyết định nghiệp vụ đã chốt

Nguồn đầy đủ: [proposal](../../../openspec/changes/redesign-permission-model/proposal.md), [Q1–Q8](02-doi-chieu-q2-q5-2026-09-15.md), [Q9–Q14](03-cap-nhat-quyen-va-nhap-2026-09-15.md). Những điểm thay hoặc làm rõ spec cũ:

- **Q1:** server bảo vệ cả đọc và ghi cho catalog; inventory gồm SELECT/DML/RPC/Storage/Realtime. Phần ngoài inventory mới để change enforce-permissions-at-database xử lý sau.
- **Q2/Q4:** kiểm tập quyền target trước và sau nằm trong quyền actor, kể cả target inactive; reset PIN/unlock cùng trần. Cấm self role/override. Owner có thể ủy quyền employee.permission.edit/settings.manage, nhưng không bỏ trần cho người được ủy quyền.
- **Q3:** data.clearDemo chỉ owner, đúng chức năng xóa mẫu; không có full wipe, giữ custom/finance/K/R1/audit.
- **Q5/Q6/Q8:** rollout được trước email recovery. Owner biết PIN cũ được tự đổi; quên PIN dùng operator và hồ sơ ngoài app đã xác minh, đổi PIN/revoke/audit nguyên tử. Không recovery_contact hoặc app bypass reset owner.
- **Q7/Q13/Q14:** ghi cả audit quản trị bị từ chối sau khi xác minh actor/target; owner hoặc employee.permission.edit đọc toàn bộ chi tiết cùng store; giữ toàn bộ, không GC và clear demo không xóa. Denied audit phải commit được, không mất theo rollback lỗi nghiệp vụ đã biết.
- **Q9/Q10:** signal→UI mục tiêu 5 giây; một poll revision 30 giây ở tab hiển thị, trần 35 giây chỉ khi cả chuỗi đọc/apply≤5 giây và online. Resume/reconnect gate tường minh. Đóng phần mất quyền, bỏ nháp chưa gửi của phần đó, giữ nháp khác và K server; không tự replay.
- **Q11:** floor.view là quyền nền không tắt cho năm role đang dùng, kể cả accountant; floor.manage riêng. Không vì nhìn sơ đồ mà nhận history/payment detail.
- **Q12/Q12a:** thêm receipt.reprint, catalog thành **15 quyền**; mặc định owner/manager/cashier, accountant cần grant, waiter/kitchen không có. In ban đầu vẫn payment.take; in lại không tự cho history/K access.

Defaults owner/manager/cashier/waiter/accountant/kitchen là **15/12/7/3/3/0**; kitchen chưa bật. Không custom role hoặc seed quyền tương lai. Quyền in kiểm soát chức năng POS, không ngăn sao chép/in bên ngoài dữ liệu đã được phép đọc.

Các hệ quả kỹ thuật được chốt bằng design, không mở thêm câu hỏi nghiệp vụ: prelock mọi employee FK trước final authority/TTL; audit retry không lưu PIN/MAC trong audit; Storage private staging với DB finalization; initial print một logical attempt, retry authorize mất ACK dùng cùng ID trước dispatch, sau gửi lệnh in đóng preview và in thêm đi qua reprint.

## 3. Bộ artifact hoàn chỉnh

| Artifact | Nội dung bàn giao |
| --- | --- |
| [proposal.md](../../../openspec/changes/redesign-permission-model/proposal.md) | Baseline, phạm vi/dependency, Q1–Q14, lựa chọn và đánh đổi, điểm dừng |
| [specs/access-control](../../../openspec/changes/redesign-permission-model/specs/access-control/spec.md) | PERM01–12: catalog/guard/audit/overrides/migration/kiến trúc |
| [specs/employee-management](../../../openspec/changes/redesign-permission-model/specs/employee-management/spec.md) | PERM13–19: owner/ceiling/field permissions/quản trị |
| [specs/employee-session](../../../openspec/changes/redesign-permission-model/specs/employee-session/spec.md) | PERM20–22: phiên, self PIN và operator recovery |
| [specs/store-onboarding](../../../openspec/changes/redesign-permission-model/specs/store-onboarding/spec.md) | PERM23: bootstrap owner, giữ flow/PIN hiện tại, seed/retry |
| [specs/multi-device-sync](../../../openspec/changes/redesign-permission-model/specs/multi-device-sync/spec.md) | PERM24–26: revision/timing/lifetime/cache/Realtime |
| [specs/receipt-printing](../../../openspec/changes/redesign-permission-model/specs/receipt-printing/spec.md) | PERM27–28: view/reprint/initial và snapshot lịch sử |
| [specs/write-idempotency](../../../openspec/changes/redesign-permission-model/specs/write-idempotency/spec.md) | PERM29–30: current authority, FK locks, bridge và K v1 |
| [usecases.md](../../../openspec/changes/redesign-permission-model/usecases.md) | 15 UC có input/output typed, luồng/ngoại lệ/message/AC |
| [design.md](../../../openspec/changes/redesign-permission-model/design.md) | Schema/DTO, inventory15, khóa, projection, audit, Storage, print, cache và migration |
| [testplan.md](../../../openspec/changes/redesign-permission-model/testplan.md) | 60 TC có fixture/oracle/bước/expected, negative controls, manifest và runtime gates |
| [traceability.md](../../../openspec/changes/redesign-permission-model/traceability.md) | 30 requirement→15 UC→60 TC; 0 requirement và 0 UC thiếu TC; PERM-07 không UC có giải trình và test |
| [tasks.md](../../../openspec/changes/redesign-permission-model/tasks.md) | 18 task nhỏ có dependency/input/output/phạm vi/AC; tất cả chưa thực hiện |

Tổng **bảy loại artifact / 13 file Markdown**. Delta MODIFIED giữ scenario của baseline và phase27, điều chỉnh tiền điều kiện theo quyết định mới; khi đồng bộ baseline sau này phải áp delta phase27 trước change này. Không archive hoặc sửa delta/evidence phase27 trong task hiện tại.

## 4. Các docs khác đã cập nhật

14 file baseline được chỉnh gồm tám file có sẵn trong change (proposal/design/usecases/testplan/traceability/tasks và hai delta access-control/employee-management) cùng sáu file sau:

- [docs README](../../README.md): đường vào spec/bàn giao.
- [roadmap](../../roadmap.md): trạng thái phase27 và spec hiện hành, dependency và cổng bridge; không đổi lịch/ngày cam kết.
- [limitations](../../limitations.md): recovery thủ công có operator/case/audit, retention, giới hạn print, private orphan, timing có điều kiện.
- [report-source-map](../../report-source-map.md): dùng bộ mới làm nguồn phân tích/thiết kế, không claim kết quả triển khai hoặc TC đã chạy.
- [openspec README](../../../openspec/README.md): thay trạng thái khung/ready cũ bằng trạng thái chờ duyệt bản sau phase27.
- [dependency enforce-permissions](../../../openspec/changes/enforce-permissions-at-database/proposal.md): chỉ ghi ranh giới được chuyển vào catalog 15, không hoàn thiện thay change đó.

File mới: năm delta capability còn lại và sáu báo cáo khảo sát/review/bàn giao trong thư mục này. Những phần dirty trước task được giữ bằng so hash baseline; nội dung thay đổi có mục tiêu không lấy lại bản HEAD để ghi đè.

## 5. Findings của đúng hai reviewer và xử lý

| ID / mức vòng đầu | Vấn đề | Sửa và kết quả recheck |
| --- | --- | --- |
| BR01 / P2 | Input UC thiếu catalog revision và requestId | UC03/10, TC20/12 đã bổ sung field, lỗi, retry; **FIXED** |
| BR02 / P2 | T15 yêu cầu activation trước T16 cung cấp script | T01 chỉ preflight; T15 55 TC candidate; T16 năm TC chuyển đổi còn lại + full 60 cùng fingerprint; **FIXED** |
| BR03 / P2 | UI sau initial authorization chưa rõ khi hủy browser print | Một logical attempt, PR1 retry trước dispatch, đóng preview sau dispatch và thông báo; TC37/60; **FIXED** |
| SR01 / P1 | FK initiator có thể chờ sau final catalog/session/TTL | Prelock toàn bộ employee references UUID tăng trước session/catalog; TC41 lịch ba bên/expiry và negative control, giữ TC40 revoke lúc chờ order; **FIXED ở tài liệu** |
| SR02 / P2 | UC03/10/11/14 thiếu DTO; bootstrap PIN có thể hiểu thành chức năng mới | Input có điều kiện, bootstrap không nhận PIN, unknown field lỗi, giữ chính sách hiện có; TC12/20/52/60; **FIXED** |
| SR03 / P2 | Cổng task/TC migration không thể làm đúng thứ tự | TC49 chỉ preflight, activation blocked ở TC51; T15/T16 tách và tổng đếm đúng; **FIXED** |

Hai report lưu scenario, nguồn file:dòng, expected/khoảng thiếu, khuyến nghị, lịch sử recheck và kết luận riêng: [review nghiệp vụ](04-review-nghiep-vu.md), [review bảo mật/nghiệm thu](05-review-bao-mat-va-nghiem-thu.md). Các finding trùng chủ đề vẫn giữ ID từng reviewer, không dùng tổng sáu để khẳng định sáu vấn đề độc lập.

Root còn sửa kết quả OpenSpec strict: MODIFIED thiếu scenario baseline; đã giữ cả scenario phase27 và kiểm lại. Đây là kiểm cấu trúc của người biên tập, không tính thành finding của reviewer.

## 6. Kiểm tra thực sự đã chạy

| Cách kiểm | Kết quả | Giới hạn |
| --- | --- | --- |
| Git HEAD/branch/status/worktree và remote refs chỉ đọc | Baseline code/docs khớp; không commit mới để phân tích ngoài các dirty docs đã ghi | Không reset/fetch rồi đổi branch hoặc áp migration |
| `openspec validate redesign-permission-model --strict --no-interactive` | **PASS** sau sửa scenario kế thừa | Chỉ kiểm change này, không sửa các proposal khung khác |
| Script Node kiểm tài liệu trong TEMP | **PASS:** 30R/15UC/60 TC/18task, ID không trùng/mồ côi; trace khớp actual; UC/TC đủ phần; defaults15/12/7/3/3 | Script kiểm cấu trúc, không dùng làm test feature |
| Kiểm mã lỗi UC→design/source→TC map | **PASS**, 68 cặp UC/mã lỗi có khai báo và xuất hiện ở TC map UC đó | Reviewer kiểm oracle cụ thể; xuất hiện text tự nó không chứng minh test đã chạy |
| So scenario của MODIFIED với baseline+phase27 | **PASS**, 27 đối chiếu scenario kế thừa | REMOVED có reason/migration và test; không tự archive |
| Kiểm Markdown links local và line bounds trong change/báo cáo/điều hướng được sửa | **PASS**, 649 liên kết local được kiểm, không đường dẫn hỏng hoặc dòng vượt file | Không xem kiểm tồn tại path là xác nhận nội dung của mọi câu trích |
| `git diff --check` và kiểm whitespace file mới | **PASS** | Có cảnh báo chuẩn hóa LF/CRLF từ Git, không lỗi whitespace |
| So manifest 436 file và hash lockfile, Git diff code | **PASS**, chỉ 14 file baseline đúng scope đổi, không missing; lockfile nguyên hash | Artifact/helper kiểm docs nằm ngoài worktree code |

**NOT RUN:** application build/test mới, 60 TC triển khai, DB/Auth/REST gate, Storage/gateway, Realtime thật, E2E, migration/recovery rehearsal và business smoke thật. Không dựng runtime hoặc dùng .env.local; không dùng số test lịch sử phase27 làm số đạt cho catalog 15. Tất cả task implementation còn unchecked.

## 7. Task kế tiếp và điểm dừng

**PERM-T01 — Khóa baseline và dựng preflight/đối chiếu tương thích.** Mục tiêu: inventory bề mặt quyền và công cụ chỉ đọc đưa ra READY/NEEDS_REVIEW, mapping có bằng chứng, oracle bridge ba role/năm quyền cũ; chưa đổi schema/defaults hoặc activate.

- **Dependency:** bộ spec này được chủ dự án duyệt và có yêu cầu bắt đầu triển khai T01; hiện chưa thực hiện hai bước đó.
- **Code/DB/test dự kiến:** công cụ preflight, fixtures/contract đối chiếu, đọc schema/grants/role/overrides trong môi trường có marker; không mutation, không migration activation.
- **Docs/output:** baseline mới nếu HEAD đã thay, inventory, preflight/mapping report không secret, expected fixtures độc lập và manifest runtime.
- **Nghiệm thu:** chỉ phần preflight của TC48/49 và expected fixture TC50; không tự đánh các TC có bước activation/helper chưa có là PASS. Các ca tie/noadmin/inactive primary/provenance/overrides không rõ phải được báo; so DB trước/sau không đổi; thiếu marker phải từ chối.
- **Dừng sau T01:** bàn giao diff/report và ca mapping cần xử lý, không tự thực hiện T02.

Không còn câu hỏi nghiệp vụ chờ trả lời trong bộ spec. Phê duyệt spec là bước kế tiếp của chủ dự án; không phải quyền commit/push/deploy/live DB hoặc thực hiện liên tiếp T01–T18. Task hiện tại dừng ở biên bản này.
