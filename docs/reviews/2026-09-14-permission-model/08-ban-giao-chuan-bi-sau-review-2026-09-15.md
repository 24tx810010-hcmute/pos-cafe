# Chuẩn bị sau review độc lập — redesign-permission-model

Ngày **2026-09-15**. Đã áp các sửa đổi R01–R15 được xác nhận ở [báo cáo07](07-doi-chieu-review-doc-lap-2026-09-15.md) và quyết định Q15 vào bộ spec. **READY FOR APPROVAL — phần chuẩn bị đã qua kiểm tra tài liệu và hai review độc lập; chưa triển khai T01 hoặc feature.** Báo cáo này thay trạng thái bàn giao trước ở [06](06-ban-giao-spec-2026-09-15.md), giữ các báo cáo cũ làm lịch sử.

## 1. Quyết định và phạm vi

Q1–Q14 giữ nguyên. Q15 chốt vẫn cho in trong preview còn mở, nút ẩn/hiện theo quyền; mất quyền in không đóng preview còn quyền đọc. Initial dùng payment.take, reprint dùng receipt.reprint; mỗi click kiểm server. Cấp lại quyền hoặc reconnect không tự in; mất quyền đọc/phiên mới đóng/purge. Initial grant gắn K/order/actor/session không tiêu hao khi authorize; PR chỉ là correlation cho client chống dispatch trùng, không phải số bản in giấy hoặc ledger mới.

Chuẩn bị kỹ thuật chọn bucket private cho ảnh mới và tách hai function: write/staging có xác thực, GET ảnh đã published công khai theo baseline. URL ổn định/cache60s, lỗi no-store; công bố phụ thuộc Edge/DB và chưa có số đo chi phí/độ trễ. Full local Supabase là runtime mục tiêu cho gate service, chưa cài/khởi động. T01 chỉ dùng DB legacy cách ly cho phần chỉ đọc; không chặn bởi Realtime chưa có. Bound tên nhân viên/store giữ120 và inactive login giữ INVALID_PIN theo code hiện hành.

Không thay main, migration, test implementation; không commit/push/deploy/live DB. Tất cả task triển khai còn unchecked. Bản spec trình duyệt bao gồm đánh đổi kiến trúc, không suy phê duyệt triển khai từ yêu cầu chuẩn bị này.

## 2. Xử lý R01–R15

| Finding | Sửa trong tài liệu | Bằng chứng để review lại |
| --- | --- | --- |
| R01 | Tách sourceFingerprint/executionProfile; TC49 legacy, TC50 bridge; giao DDL/ACL candidate cho T05/T07–T09; phân vai biến thể theo task, gate tổng T15/T16 | [design11](../../../openspec/changes/redesign-permission-model/design.md), [tasks](../../../openspec/changes/redesign-permission-model/tasks.md), [testplan3](../../../openspec/changes/redesign-permission-model/testplan.md) |
| R02 | T16 đóng gói và kiểm launcher chỉ đọc trên fixture trước gate nguồn; T17 dùng bundle đó cung cấp preflight toàn store đích thật và mapping được duyệt trước T18, chỉ chạy khi được yêu cầu riêng; recheck drift dưới khóa activation | tasks T16–T18; PERM-06; TC53 |
| R03 | Start session inactive dùng INVALID_PIN; request dùng phiên revoked/expired giữ lỗi phiên | PERM-20, design9, TC02 |
| R04 | Tên nhân viên và displayName trim1–120 code points; legacy ngoài bound được báo, không tự cắt | PERM-17/23, UC02/03/14, design2/8, TC19/49/52/59 |
| R05 | Dẫn module harness hiện có; tách preflight có ghi session khỏi công cụ chỉ đọc; report whitelist, không dựa redactor cũ để lọc mọi PIN/hash/MAC | design11.2, tasksT01/T15, testplan3 |
| R06 | T01 có runtime/input/output paths/schema, fixture-vs-live, từng phần TC48/49 và oracle6144TC50, điểm dừng | [T01](../../../openspec/changes/redesign-permission-model/tasks.md) |
| R07 | Bỏ giới hạn initial một lần dispatch; áp Q15 và giữ preview còn quyền đọc | [receipt delta](../../../openspec/changes/redesign-permission-model/specs/receipt-printing/spec.md), UC11, design5/7, TC36/37/60 |
| R08 | Công bố đánh đổi private bucket/gateway, cache/lỗi/placeholder/cách đo và lý do chưa chọn copy public; sau review PS01 tách public GET published khỏi write/staging có xác thực | proposal, design6.1, PERM-09, UC09/T09, TC45/47, limitations |
| R09 | Giao chuẩn bị full local runtime ở T02, gateway/Storage T09, Realtime T10; proof cách ly riêng, giữ gate service thật | design11.2, tasks, testplan3 |
| R10 | Sửa các chỗ14→15 và trạng thái, không nhận thiết kế là feature đã chứng minh; giữ quyết định không thêm Store Key rotation | roadmap, owner-account dependency, docs navigation |
| R11 | Gộp hai cặp scenario trùng; giữ scenario kế thừa | employee-management và receipt-printing delta |
| R12 | T13 cleanup candidate consumers/guard cũ, T15 gateTC57; T16 teardown bridge/enum sau dependency checks, giữ migration/fixture lịch sử | design8, tasksT03/T13/T15/T16, TC57 |
| R13 | Giữ signal/invalidation baseline và giới hạn join-subscription ở change riêng; không claim publication là đồng bộ đầu cuối; không bỏ bảo vệ raw routes | proposal dependency, PERM-26, design6.2, T10/TC29 |
| R14 | Quy định rõ initial mất payment.take và reprint mất receipt.reprint: ẩn nút/hủy pending, chỉ đóng khi mất read/session theo Q15 | PERM-25/27/28, UC11/12, design5/7, TC36/60 |
| R15 | Dẫn adminFlow:55 và guards:26 đúng chỗ kiểm quyền hiện có | proposal Why |

## 3. T01 đã được chuẩn bị để giao riêng

**PERM-T01 — Khóa baseline và dựng preflight/đối chiếu tương thích.** Sau khi chủ dự án duyệt spec sửa và yêu cầu bắt đầu, chỉ làm công cụ/inventory/oracle trên fixture synthetic. Không đổi schema/defaults/role, không activation, không chạm store thật và không tự sang T02.

Ba đầu ra: inventory bề mặt hiện có; report READY/NEEDS_REVIEW theo fixture store có provenance/rights diff; oracle độc lập6144hồ sơ cho bridge. Đường dẫn runtime dự kiến là `artifacts/permissions/t01/<runId>/`, gồm inventory/preflight/bridge-oracle/manifest JSON. Hợp đồng fields và mapping input ở tasksT01. Docs kết quả dự kiến tại `docs/implementation-log/permission-t01-preflight-<date>.md`.

Nghiệm thu chỉ phần preflight TC48/49 và expected TC50; không gọi TC48/50 toàn phần PASS khi chưa có helper/activation. Runtime test phải có marker/profile/fixture và chứng minh đúng backend; preflight chỉ đọc không được cấp/revoke session như harness cũ. Có snapshot trước/sau công cụ, whitelist output và kiểm không secret. Fixture setup có ghi là bước riêng trước mốc so sánh, chưa thực hiện trong lượt này.

## 4. Baseline và bảo toàn

- Code main `ef2c372aec60d8362549e47b7aedb27126129479`, chỉ untracked pnpm-lock.yaml có sẵn, SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`.
- Docs HEAD `f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` cộng dirty working tree trước lượt chuẩn bị. Snapshot riêng của lượt này gồm diff/status, hash và nội dung **296 file Markdown** ở `C:/Users/nguye/AppData/Local/Temp/pos-cafe-permission-preparation-20260915`. Đây là tập Markdown của lượt chuẩn bị, khác manifest436file của lượt đầu; không cộng hoặc thay số đó.
- Sửa đúng change, navigation/limitations, chú thích dependency owner-account và báo cáo. Không sửa nội dung evidence phase27, force-default-pin-change hoặc các change ngoài phạm vi; không reset/stash/đổi nhánh.
- Đối chiếu hash với snapshot đầu lượt: **20/296 file Markdown thay đổi có chủ đích, 276 giữ nguyên, không mất file**; thêm ba báo cáo08/09/10. Hai báo cáo06/07 chỉ thêm chú thích lịch sử ở đầu, giữ nội dung cũ. Danh sách từng file nằm trong `preservation-current.json` tại thư mục snapshot trên.

## 5. Kiểm chứng và reviewer

- **PASS kiểm tài liệu:** 13 file của bảy loại artifact; 30 requirement, 15 UC, 60 TC dự kiến, 18 task. Không requirement hoặc UC nào thiếu TC; PERM-07 là ràng buộc kiến trúc không có UC riêng, đã giải trình trong traceability. Kiểm liên kết cục bộ, 68 cặp ngoại lệ/khôi phục, 27 scenario kế thừa, defaults catalog và dependency graph không phát hiện lỗi.
- **PASS OpenSpec:** `openspec validate redesign-permission-model --strict --no-interactive`. `git diff --check` không báo lỗi whitespace; Git chỉ nhắc chính sách chuyển LF sang CRLF.
- **Review nghiệp vụ:** [báo cáo09](09-review-chuan-bi-nghiep-vu-2026-09-15.md), không phát hiện finding PB hoặc blocker nghiệp vụ mới.
- **Review bảo mật/nghiệm thu:** [báo cáo10](10-review-chuan-bi-bao-mat-2026-09-15.md), PS01 về xác thực ảnh đã sửa và được reviewer kiểm lại; không còn P1/P2 mở trong phạm vi review. Đã kiểm lại biến thể launcher T16 ở TC53.
- Q1–Q15 đã đủ để giao bước kế tiếp, không còn câu hỏi nghiệp vụ cần quyết định trước T01. Sau khi chủ dự án duyệt bản sửa và yêu cầu triển khai, chỉ giao PERM-T01 theo mục3; các quyết định đích/mapping live và cửa sổ phát hành thuộc T17/T18, chưa cần quyết định trong lượt chuẩn bị.

**NOT RUN:** application build/test, implementation60TC, DB/Auth/REST/Storage/gateway/Realtime, migration/recovery rehearsal và business smoke thật. Những output/harness/runtime mới trong tasks là kế hoạch, chưa phải file hoặc service đã triển khai.
