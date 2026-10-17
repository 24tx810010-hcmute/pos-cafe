# CI-1 reporter local — 15/10/2026

Phạm vi nhỏ thuộc [CI-1 tối thiểu D11](permission-linux-ci1-minimal-2026-10-15.md). Owner đã giao triển khai hai file và kiểm thuần Node, trả lời nguyên văn **“cho phép nhưng để ở trong D/workspace”** cho câu hỏi duyệt scope hai file. Ghi nhận PLAN-D12 ngày15/10/2026; chỉ source/test/hồ sơ dưới `D:/Workspace`, dùng Node hiện có `D:/tools/nodejs/node.exe`. Không mở thêm quyền install/push/CI/runtime/DB online/deploy/xóa.

## Mục tiêu và thiết kế trong phạm vi đã giao

Thêm đúng [module](D:/Workspace/pos-cafe/scripts/permission-ci1-evidence.mjs) và [test](D:/Workspace/pos-cafe/scripts/permission-ci1-evidence.test.mjs). API `renderCi1Evidence(input)` là phép biến đổi thuần, trả `{json, markdown}`; không IO, network, subprocess, environment hoặc publish. Không sửa internal attestation hay dependency. Không thay nghiệp vụ/quyền/UI.

| Input | Ràng buộc |
| --- | --- |
| repository |Chỉ `nguyentronglinh045/pos-cafe-ci-preflight` |
| runId / attempt |Chuỗi số dương1–20ký tự / số nguyên1–1000 |
| workflowSHA / sourceSHA |40ký tự hex lowercase; sourceSHA là baseline commit, không thay fingerprint |
| sourceFingerprint / lockSHA |64ký tự hex lowercase; caller phải tính/bind đúng source chưa commit và lock |
| versions |Đúng3key node/npm/supabase; mỗi version3thành phần số0–9999, không suffix/free text |
| startedAt / finishedAt |UTC canonical `YYYY-MM-DDTHH:mm:ss.sssZ`, ngày thực tồn tại, finished≥started |
| checks |Đúng5key bootstrap/auth/apiBinding/sourcePreservation/cleanup; PASS/FAIL/ERROR/NOT_RUN |
| suites |Đúng2entry có thứ tự T09/T10; object chỉ id/status/exitCode/counts |
| exitCode / counts |Exit null hoặc nguyên0–255; required cố định T09=1/T10=3; run=pass+fail, run+skip≤required; số nguyên không âm |

Không chấp nhận key khác ở các record hoặc mảng suites, accessor record/index, prototype record tùy ý, symbol key, newline/free text trong trường chuỗi. Sai input ném đúng `CI1_EVIDENCE_INVALID`, không phản chiếu key/value/cause đầu vào. Không chuyển raw stdout/stderr vào module.

Suite PASS chỉ khi exit0, đủ số ca và tất cả PASS, không skip/fail; FAIL có counts đã biết nhưng không thỏa điều kiện trên. ERROR/NOT_RUN có counts=null, không dựng0; NOT_RUN còn cần exit=null. Nếu bootstrap/Auth/API binding chưa PASS thì suites phải NOT_RUN. Overall được tính theo ERROR→FAIL→NOT_RUN→PASS, không nhận input overallStatus. Tổng required luôn4; các tổng khác UNKNOWN nếu bất kỳ suite chưa có counts. Source preservation/cleanup chưa PASS cũng chặn overallPASS.

Output chỉ dựng lại các field cho phép và URL từ repo/run/attempt hợp lệ; command IDs cố định `T09_STORAGE_EDGE`/`T10_REALTIME`, không nhận argv/free text. IDs chưa chứng minh lệnh thực được chạy: cần caller/harness tương lai bind với invocation thật. Tổng hai output bị chặn ở1MiB. Đây là serializer, không phải chứng thư đã kiểm backend hoặc chống giả dữ liệu bởi caller. Format hex/số không thể phát hiện một bí mật cố tình được mã hóa đúng format; không đưa secret vào field hợp lệ và không nhận output này là quyền public source/log khác.

## Kiểm chứng và truy vết

| Tiêu chí D11/D12 | Kiểm thuần Node |
| --- | --- |
| Source/run/counts đúng, không làm đổi input |Valid unit data, JSON/Markdown/totals/identity, output ổn định |
| FAIL/ERROR/NOT_RUN không thành PASS |Check lỗi, suite lỗi/skip/thiếu ca, unknown counts, prerequisite chưa đạt |
| Khóa schema và tính nhất quán |Hash/time/count/exit/suite order/required/status không hợp lệ bị từ chối |
| Không public thông tin quan trọng tùy ý |Fake secret/free-text ở nhiều cấp, JWT giả/version, newline, oversized, symbol/prototype/accessor/proxy đều lỗi cố định |

Lệnh: `D:/tools/nodejs/node.exe --test --test-reporter=tap scripts/permission-ci1-evidence.test.mjs` tại `D:/Workspace/pos-cafe`. Không dùng npm/node_modules, không tải/cài; toàn bộ fixture chỉ trong memory. Dữ liệu có4casePASS là ví dụ unit của serializer, không lưu thành receipt actual CI/T09/T10. Không mở giao diện nên không chạy UI audit.

Trạng thái: hai file đã viết; kiểm thuần Node nguồn cuối **6PASS/0FAIL/0SKIP**, exit0. Chưa hoàn tất review; chưa actualCI1/T09/T10/backend. [Biên bản](../../implementation-log/permission-ci1-reporter-local-2026-10-15.md), [review](../../reviews/2026-10-15-permission-ci1-reporter-local.md). Scope sensitive vì output public; cần SEC/EVC APPROVE đúng candidate. Walkthrough code sẽ được đưa trong bàn giao, chưa có xác nhận owner đã đọc/hiểu.

Cập nhật metadata sau freeze: **SEC/EVC đều APPROVE candidate02** SHA256 `3bfe93403a693654919f165867027db79cba45f6a3c585528ba292db7e6cf43e`; scope triển khai/kiểm/review local D12 hoàn thành, chưa owner nghiệm thu hoặc phát hành. Trạng thái chờ review phía trên là mốc trước verdict. Hướng dẫn đọc code đã gửi, chưa có phản hồi owner xác nhận đã xem. Bước tiếp theo còn là fresh Linux recipe/caller binding/resource bounds và harness thực; chưa mở quyền thực hiện những phần đó.

Dung lượng dự kiến source/test/evidence/docs/snapshot<10MiB trên D; không tạo runtime nặng. Baseline C207212412928B trống, D103658426368B trống, đều vượt reserve30GiB; [receipt](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/baseline.json). Source/record trong `D:/Workspace`, không tạo file task trên C. Không xóa artifact/raw cũ.
