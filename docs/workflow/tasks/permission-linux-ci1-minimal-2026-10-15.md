# CI-1 tối thiểu cho đồ án — 15/10/2026

**Phạm vi bằng chứng đã được owner thu gọn; gói local đang review, chưa triển khai/chạy CI-1.** [Chuẩn bị và metadata mới](../../implementation-log/permission-linux-ci1-minimal-preparation-2026-10-15.md). Bản [đề xuất mã hóa trước đây](permission-linux-ci1-local-proposal-2026-10-15.md) là lịch sử, không còn là thiết kế áp dụng cho slice này.

Cập nhật metadata sau freeze: SEC/EVC đã APPROVE candidate02 cho khảo sát/kế hoạch local; xem [verdict và phạm vi](../../reviews/2026-10-15-permission-linux-ci1-minimal.md). Dòng trạng thái trước verdict được giữ làm mốc lịch sử; chưa triển khai/chạy CI-1.

PLAN-D12: owner đã cho phép bước hai file reporter/test pure Node và yêu cầu đặt trong D/Workspace; [scope triển khai riêng](permission-ci1-reporter-local-2026-10-15.md). Phần cần scope bên dưới là đề xuất lịch sử trước D12; chỉ hai file đó đã được giao, các phần harness/CI/runtime còn lại chưa được giao.

PLAN-D13 sau D12: owner giao chuẩn bị recipe Linux/harness local trong D:/Workspace, phải có hardware limits; [scope mới](permission-ci1-linux-harness-local-2026-10-15.md). Quyền push/runCI/install/runtime/DB/deploy vẫn chưa cấp; các dòng giới hạn implementation ở mốc D11/D12 phía dưới không phủ nhận scope local mới này.

## Quyết định mới — PLAN-D11

Owner yêu cầu “làm nhưng tối thiểu”, mục đích chứng minh đã làm cho đồ án, repo public, không push thông tin quan trọng. Sau câu hỏi owner chọn phương án chỉ lưu SHA nguồn, lệnh chạy, số test, trạng thái và ảnh cần thiết. Trước khi owner trả lời, AI đã làm rõ lựa chọn đầu: không giữ bộ raw để replay sâu. [Receipt chứa nguyên lời yêu cầu/lựa chọn/phần làm rõ](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/owner-decision.json).

D11 thay D10 và yêu cầu CI1-specific về age/DPAPI/ciphertext/private raw archive/replay sâu. Không xin lại thiết kế mã hóa; không cần sinh khóa, chọn recovery hoặc cài age. Bằng chứng/raw cũ vẫn giữ nguyên. Đây là thay đổi acceptance **của pilot và gói bằng chứng CI-1**, không nhận thành full PIN/PERM/HP1 PASS hoặc tự thay gate phát hành chung. Chưa mở quyền push/chạy CI/sửa DB online/deploy hoặc xóa dữ liệu.

## Gói tối thiểu

| Giữ | Bỏ khỏi CI-1 tối thiểu |
| --- | --- |
| Một profile synthetic t04,12service theo guard có sẵn |Năm stack lịch sử, Browser/UI audit bổ sung không liên quan pilot API |
| Auth thật và API-observer/marker binding của bootstrap |Dữ liệu thật, backup/schema dump hosted làm payload |
| Toàn bộ T09 Storage/Edge:1case; toàn bộ T10 Realtime:3cases |Full PIN19/PERM60/HP1/27stagegate trong lượt pilot này |
| Exitcode/thời gian/counts/SHA nguồn/lock/runtime/runURL chính xác |Crypto/DPAPI/keygen/ciphertext/recovery/restore rehearsal sâu |
| Kiểm nguồn không đổi và kết quả cleanup/preservation mà suite hiện có yêu cầu |Archive DB+Storage/raw riêng tư lớn, mandatory raw replay package |
| Budget≤20GiB/free≥30GiB; một store/active runtime |Upload artifact/cache/Packages/Release hoặc paid runner |

T09/T10 là test API/contract, không cần tải Chromium hoặc chạy UI chỉ để có ảnh. Ảnh chỉ khi có trạng thái cần chứng minh; GitHub run summary screenshot có thể dùng sau run. Chưa thay assertions hoặc giảm12service để test xanh. [RuntimeProof:25](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:25), [T09:47](D:/Workspace/pos-cafe/tests/contracts/permissionImagesRuntime.contract.test.ts:47), [T10:10](D:/Workspace/pos-cafe/tests/contracts/permissionSignals.contract.test.ts:10).

## Bằng chứng gọn và thông tin quan trọng

Kênh chính: **safe console log + Job Summary của repo CI public hiện có**, sau run đọc/xuất một bản nhỏ về local. Không có upload-artifact hoặc cache nên không cần chốt quota artifact/ciphertext. GitHub công bố public standard compute miễn phí, log/Job Summary không tính vào artifact storage allowance ([billing reference](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Đây là lý do chọn kênh log/summary trong phạm vi A đã được giao, không đổi repo visibility hoặc dùng dịch vụ khác. Chưa có job hoặc phí actual CI-1.

Public output chỉ cho phép schema nhỏ: repo/runID/attempt/workflowSHA/sourceSHA/lockSHA, phiên bản, phase code, lệnh tĩnh không chứa secret, timestamp, exitcode, required/run/pass/fail/skip counts. Đề xuất trần safe output1MiB và local receipt1MiB/run để giữ gọn; đây là cap thiết kế cho output, không phải quota runtime hoặc số đo đã chạy.

Không public credential, JWT/token kể cả fixture, password/private key, `.env`, DSN, backup hosted, dữ liệu kinh doanh hoặc raw stdout/stderr/stack traces có thể chứa chúng. Bộ xuất bằng chứng phải **allowlist field/value**, không chỉ chạy regex che token trên log tùy ý. Captured runner/test output dùng cục bộ trong job để rút counts; không `tee` raw lên console, không fallback print raw khi lỗi. Error public là code cố định/exitcode. Nếu không parse/count được thì ghi ERROR/NOT_RUN đúng thực tế, không dựng số PASS.

Chỉ cần kiểm local hai nhóm cho reporter trước public: dữ liệu hợp lệ tạo summary đúng; input chứa fake token/free-text/field ngoài schema không được đi qua public output. Không cần framework crypto/recovery/adversarial replay sâu. Chưa có reporter hoặc test này được viết/chạy. Không đưa metadata riêng tư của6input Windows vào safe summary; các input ấy không nằm trong payload pilot.

GitHub log có retention và không phải lưu vĩnh viễn. Bản local nhỏ giữ kết quả/lệnh/SHA/counts, không đủ dựng lại DB/raw từng bước; owner đã chấp nhận giảm độ sâu ở slice này. Metadata hash không chứng minh backend đã PASS; chỉ actual run từ source đã duyệt mới cho counts. Không xóa/chuyển đổi evidence cũ để áp dụng chính sách mới hồi tố.

## Những điểm đã gỡ và còn phải làm

- Đã gỡ: chọn private CI; age/DPAPI/key custody; encrypted archive/recovery; artifact quota/private retention; browser download cho pilot API.
- Đã xác minh thêm: registry metadata12/12tags/index digests và selected Linux/amd64 manifest/config; [kết quả kết hợp](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/registry-combined.json). Đây là metadata, chưa actualpull/start/store identity.
- Còn: recipe Linux fresh/transport, exact source allowlist trước publication, CLI/runtime pin và actual image-store binding, dependency/DB/peak bound trong20GiB, actual owned daemon/isolation và actual4cases.
- Compressed layer sizes không thay unpack/DB/WAL/install peak. Không cài hoặc kéo image layer khi chưa đủ upper bound; không tự đổi version hoặc tạo WSL/Docker Desktop.

## Bước triển khai local dự kiến — cần scope riêng

Gói local tiếp theo đề xuất thêm preflight/bootstrap/pilot/reporter scripts và tests thuần trong `scripts/`/`tests/` của main; source hóa hai helper Storage/prewarm. Path/transport chỉ tham số hóa ở runtime helper cần cho t04, giữ guards. Không thay `src/`, quyền nghiệp vụ, SQL production, Tailwind hoặc lockfile.

Kiểm ở giai đoạn local chỉ được đề nghị là pure Node/tooling với fake inputs/subprocess stub: profile/source/endpoint guard và safe evidence allowlist. Dùng Node/npm đã có, không cài package/browser, không khởi động DB/Docker, không truy cập Supabase. Phạm vi write dự kiến source/fixtures/report nhỏ<20MiB, cần đo C/D và sandbox output thuộc task; chưa thực hiện. Chỉ sau local candidate/review và estimate runtime đủ mới trình exact workflow/source/push/run1lượt cho owner; không xin quyền chạy khi chưa đủ.

Bước nhỏ đầu tiên để trình owner cấp scope implementation: thêm đúng `scripts/permission-ci1-evidence.mjs` và `scripts/permission-ci1-evidence.test.mjs`, dùng built-in Node, không dependency mới. Module là phép biến đổi thuần sang JSON/Markdown allowlist; không network, subprocess, đọc `.env`, file raw hoặc tự ghi/upload output. Không sửa bộ attestation đang có: [permission-execution-evidence.mjs:14](D:/Workspace/pos-cafe/scripts/permission-execution-evidence.mjs:14) chứa backend/fixture/API binding dành cho kiểm nội bộ, không phải public serializer an toàn.

Kiểm có ý nghĩa cho bước này: summary/counts hợp lệ; từ chối field/free-text/fake credential ngoài allowlist và không phản chiếu giá trị vào error; từ chối hash/counts/trạng thái không nhất quán; FAIL/ERROR/NOT_RUN không được thành PASS. Chạy `D:/tools/nodejs/node.exe --test scripts/permission-ci1-evidence.test.mjs` sau khi được giao. Dữ liệu mẫu chỉ kiểm reporter, không tạo receipt giả T09/T10 PASS. Hai file source/test và hồ sơ/review nhỏ dự kiến<10MiB, không cài/tạo runtime hoặc xóa file. Bước này chưa bao gồm preflight/bootstrap/pilot, thay runtime helper hay workflow; các phần đó vẫn cần đủ recipe/budget và scope tiếp theo.

## Acceptance trung thực

Pilot sau này đạt khi bootstrap/Auth/binding và cả4cases đạt trên một source/backend; không fail/retry/skip bắt buộc, safe proof đọc được và source preservation/cleanup hiện có đạt. Thiếu điều kiện thì báo riêng FAIL/BLOCKED/NOT_RUN, không nhận job xanh do chỉ echo là test PASS. Giới hạn cuối phải ghi rõ: CI-1 pilot tối thiểu cho đồ án, không full gates/hosted/Vercel deployment certification.

Đầu ra lượt hiện tại chỉ là gói local/metadata/review. Tiếp tục read-only khảo sát còn được giao; implementation harness, install, CI/push/DB/deploy/cleanup chưa được giao bởi lựa chọn A.
