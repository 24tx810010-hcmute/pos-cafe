# Triển khai CI-1 reporter local — 15/10/2026

[Scope và contract](../workflow/tasks/permission-ci1-reporter-local-2026-10-15.md), [review độc lập](../reviews/2026-10-15-permission-ci1-reporter-local.md). PLAN-D12 owner cho phép đúng hai file pure Node và test/review, yêu cầu nằm trong D/Workspace. Source ở `D:/Workspace/pos-cafe/scripts`, evidence ở `D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015`, docs ở `D:/Workspace/pos-cafe-docs`. Không cài dependency hay tạo môi trường mới.

Baseline: mainHEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docsHEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, dirty worktrees được giữ; không stage/commit/chuyển nhánh. [Receipt scope/disk/Node/8source anchors](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/baseline.json). Dùng Node24.16.0 hiện có tại D:/tools/nodejs. Chỉ thêm2file executable được giao; không chỉnh src/SQL/config/lock hoặc internal evidence module.

Module đã xuất JSON/Markdown từ schema cụ thể; không đọc log/env/file hoặc tự upload. Lỗi input chỉ mã cố định, overall từ checks và T09x1/T10x3. Command IDs là nhãn cố định, chưa chứng minh invocation. Không có actual pilot hoặc hosted/Vercel certification. Chi tiết caller binding/resource budget/fresh Linux recipe vẫn ngoài slice này.

## Verification

Đã chạy lệnh `D:/tools/nodejs/node.exe --test --test-reporter=tap scripts/permission-ci1-evidence.test.mjs`, cwd `D:/Workspace/pos-cafe`, Nodev24.16.0. [Receipt nguồn cuối attempt02](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/test-attempt-02.json), [TAP](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/node-test-attempt-02.tap): **6tests/6PASS/0FAIL/0SKIP/0cancelled/0todo**, exit0, test duration71,9292ms. Source/test hash trước/sau khớp; toàn bộ test chỉ dùng memory/fake data.

Attempt01 cũng6PASS, giữ receipt/log cũ. Sau tự rà code, siết text sang ASCII printable để chặn cả Unicode line separators ngoài CR/LF; thêm hai boundary inputs và chạy lại phần bị ảnh hưởng thành attempt02. Đây là hai lượt unit khác nguồn, không nhận attempt01 thành bằng chứng nguồn cuối, không phải retry một ca backend/CI lỗi.

Sáu nhóm test: valid summary/identity/immutability; check hoặc case thất bại; skip/thiếu case với exit0; ERROR/NOT_RUN và prerequisite; hash/time/count/shape không nhất quán; raw/fake secret/free-text/accessor/prototype/proxy. Không dùng4casePASS trong fixture mẫu làm actual CI/T09/T10 evidence. Không chạy broad npm/build/UI/DB vì module thuần Node không nối app hoặc runtime. Gói local cần hai reviewer không tham gia viết source/test APPROVE trước khi bàn giao hoàn tất.

Walkthrough để đọc code: `record`/`text` khóa cấu trúc và giá trị; `suite`/`build` kiểm counts và tự tính overall; `markdown` chỉ dùng dữ liệu đã chuẩn hóa; `renderCi1Evidence` chặn output lớn và cố định lỗi. Unit tests đọc độc lập theo expected D11/D12, không phải log pilot. Đã chuẩn bị hướng dẫn đọc, chưa có xác nhận owner đã xem/hiểu source.

## Kết thúc scope local D12

SEC và EVC đều **APPROVE candidate02**, SHA256 `3bfe93403a693654919f165867027db79cba45f6a3c585528ba292db7e6cf43e`,21files/291987bytes; [verdict](../reviews/2026-10-15-permission-ci1-reporter-local.md). EVC chỉ yêu cầu sửa số C trong task khớp baseline receipt; đã đóng, không thay source/test/contract/expected. Mỗi reviewer tự chạy lại cùng6unit tests đạt; EVC thêm10checks in-memory. Re-review docs không chạy lại unit vì source không đổi.

Hoàn tất đúng2file và hồ sơ trong D:/Workspace; Node có sẵn nằm D:/tools. Không install/push/CI/runtime/DB/deploy/xóa; không sửa lock/internal attestation/src/SQL.8source anchors được hash giữ nguyên. Evidence dùng Node thật ở local; chưa có kết quả4ca backend hoặc Linux CI1. Hướng dẫn đọc code đã gửi qua commentary; nghiệm thu của owner chưa có. [Final check](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/final-check.json) sẽ ghi đối chiếu cuối/hash/reserve; đây là metadata sau freeze, không sửa candidate.
