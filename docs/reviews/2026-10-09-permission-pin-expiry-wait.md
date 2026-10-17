# G2c — Independent review của một expiry completion trong wait

Ngày 09/10/2026. Scope nhạy cảm: session/authority, clock SQL, giao dịch đồng thời và bằng chứng UI. [Yêu cầu/handoff](../workflow/tasks/permission-pin-expiry-wait-2026-10-09.md), [TC-PIN-08](../../openspec/changes/force-default-pin-change/testplan.md), [log thực thi](../implementation-log/permission-pin-expiry-wait-2026-10-09.md).

## Candidate và phạm vi reviewer

Candidate cuối: [candidate-03](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/candidate-03.json), SHA-256 `9492512b2af199b1699e5277863e1e79730e66e1a51d3887b2735d4d85af7d98`. Source browser là `source-04` trong [manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/source-04.json) và [tar](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/source-04.tar), gắn với safe report attempt05; attempt04 FAIL preflight G2c Edge được giữ riêng. Candidate-03 chứa docs snapshot trước verdict; các cập nhật bên dưới chỉ là metadata review/trạng thái sau hai verdict, không sửa code/expected/evidence.

| Reviewer | Phạm vi | Verdict | Finding chặn |
| --- | --- | --- | --- |
| SEC-G2c | Clock catalog/ACL/restore, source-bound transaction/lock/session/authority, target isolation và privacy | **APPROVE candidate-03 exact SHA trên** | Không còn blocker; candidate-02 stack/location leak đã đóng. Review chỉ đọc source/receipt, không tự rerun DB/browser. |
| COV-G2c | TC08 scope/expected, Chromium UI timer/ACK, evidence/provenance/options, docs và quyền | **APPROVE candidate-03 exact SHA trên** | Không còn blocker; candidate-01 code-substring leak đã đóng. Review chỉ đọc source/receipt. |

## Bảng xử lý finding

| Candidate | Reviewer/verdict | Finding | Xử lý và trạng thái |
| --- | --- | --- | --- |
| candidate-01 SHA-256 `cb827b220af7d1eb950843f4ae54d3cf3907b1aded07354b0a35ce1279c6dd5e` | SEC APPROVE | Không có blocker security/clock/authority trên candidate-01 | Lịch sử, không tự chuyển APPROVE sang candidate mới |
| candidate-01 cùng SHA | COV CHANGES_REQUESTED | Reporter lấy substring `PIN_EXPIRY_[A-Z_]+` bất kỳ từ error message, có thể lộ secret trông giống code | Source-03 yêu cầu exact allowlisted code, fallback `TEST_FAILURE_REDACTED`; thêm synthetic secret shaped like code và exact-code unit; reporter7/7, Chromium/Auth/REST 1/1 trên target G2c fresh. COV xác nhận đóng ở candidate-02; candidate mới vẫn cần verdict mới. |
| candidate-02 SHA-256 `cacfb33ed11e840a01e37c4d2c8da2a07ab5524efe0b753377f7d6b3498a6788` | COV APPROVE | Finding code substring của candidate-01 đã đóng; coverage/UI/evidence/docs không có blocker | Verdict chỉ cho candidate-02, không tự chuyển sang candidate-03 |
| candidate-02 cùng SHA | SEC CHANGES_REQUESTED | `sourceLocations` parse untrusted stack; synthetic stack có line số sáu chữ số giống PIN xuất nguyên vào safe report. Phase annotation regex cũng nên khóa bằng allowlist. | Source-04 bỏ `sourceLocations`, exact static phase allowlist, negative controls PIN-shaped stack/phase; reporter9/9 và Chromium/Auth/REST 1/1 PASS sau G2c Edge preflight recovery. SEC xác nhận **CLOSED** và APPROVE candidate-03. |

## Trạng thái cổng

Hai APPROVE trên cùng candidate-03; cổng review cho một lát G2c đạt. Browser PASS và review không tự thay thế owner acceptance hoặc toàn TC-PIN-08. Walkthrough đã chuẩn bị, chưa có phản hồi chủ dự án.
