# Chuẩn bị harness CI-1 Linux local — 15/10/2026

[Scope D13](../workflow/tasks/permission-ci1-linux-harness-local-2026-10-15.md), [recipe](permission-ci1-linux-recipe-2026-10-15.md), [review](../reviews/2026-10-15-permission-ci1-linux-harness-local.md). Owner giao chuẩn bị local trong D:/Workspace và nhắc giới hạn phần cứng, chưa push/CI/DB/deploy. Source6files mới, docs/evidence ở D:/Workspace; không install/WSL/Docker/cấp loop hoặc DB. [Baseline](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/baseline.json) giữ nguyên lời yêu cầu,14anchors, Node24.16.0, HEADs và disk.

MainHEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docsHEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, dirty state giữ nguyên, không stage/commit/switch. Không sửa14anchors gồm reporterD12/runtime helper/config/lock/business tests. Numeric protective policy do AI chọn: CPU3time/RAM10GiB/swap0/PIDs2048/30min, mutable loop18GiB/taskbudget20GiB/free30GiB; không nhận thành owner cung cấp numeric quota hoặc actual enforcement.

## Khảo sát và ranh giới

Runtime scout chỉ đọc chỉ ra helper t04 đã hỗ trợ Linux, có thể giữ nguyên bằng fixed compatibility mount riêng; không phải port t02/PIN hoặc giảm12service. Scout ban đầu lặp kết luận cũ về imageIDs; sau đọc registry-combined đã correction:12/12historical values khớp index, khác platform/config,2receipt hash khớp. Curated ci1-images.json lấy đúng metadata mới; chưa có pull/start proof.

Thiết kế tránh thêm dependency: Node built-ins cho policy/orchestrator/reporter/tests; pg/SDK chỉ dùng runtime fixture sau future offline exact-lock install trong envelope. D12 serializer không sửa, actual result phải có command/source/lock/config/run binding + fixture observation. Private reporter tự projection counts/hook errors, không subclass fullgate reporter hoặc xuất raw names/errors. Fixture dùng logic Storage/prewarm trước đây, global preservation theo semantic catalog/financial6tables/3buckets6payloads; giữ test assertions.

Đã tự rà và bổ sung DelegateSubgroup=supervisor (systemd≥254) để tránh internal-process constraint; đọc limits ở unitroot và yêu cầu main tại supervisor. Kiểm preallocation actual blocks để không gọi image sparse là đã reserve; recipe yêu cầu mkfs/mount nodiscard. Những phần này mới được kiểm logic/primarysource, chưa kernel test. Recipe còn thiếu complete setup worker/intake/cache automation; không ngụy tạo readiness khi actual Linux bị cấm chạy.

## Kiểm local

Attempt01:14PASS/0FAIL/0SKIP cho8harness+6D12 tests, trước hardening subgroup/host/preallocation. Giữ log/receipt lịch sử, không dùng làm evidence source cuối sau sửa.

Attempt02:14PASS/0FAIL/0SKIP, exit0, fixture `node --check` exit0 và plan-only sample exit0. Sau đó bổ sung allocated-block check nên source thay đổi; phải chạy lại phần bị ảnh hưởng trước freeze. [Receipt02](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/test-attempt-02.json). Tests fake toàn bộ hardware/adapters; không DB/network hoặc actual4cases. Source/test hash trước/sau giữ; Node có sẵn không dùng npm/node_modules ở local.

Attempt03 cho candidate01: **14PASS/0FAIL/0SKIP**, exit0; fixture parse-only exit0 và plan-only sample exit0. [Receipt03](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/test-attempt-03.json), [TAP03](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/node-test-attempt-03.tap). Bổ sung allocated-block check và hook array/method/missing API fail-closed;14tests gồm8harness và6D12, không cộng lại thành42test cases hoặc4backend cases. Thời lượng test96,8026ms, source hashes trước/sau khớp. Không có runtime resource proof từ các fake tests.

## Review candidate01 và sửa trong scope D13

Candidate01 SHA256 `434fa7a11d2c9b2c6d5a4b064f5bf70677b12d72dfc2d8f1207599159e16d3cd`,38files/463791B, giữ nguyên snapshot01. SEC/EVC đều CHANGES_REQUESTED, dù tự reproduce14NodePASS. SEC-HAR-01/EVC-HAR-02: tên directory trên loop chưa chứng minh HOME/TMPDIR thực, compatibility mount và dockerd exec-root. SEC-HAR-02: recipe stdout/stderr=null chưa được đọc lại. EVC-HAR-01: stage observer configId chưa đối chiếu configSHA.

Tác giả sửa policy/adapter và thêm một test boundary với negative controls cho môi trường/cache/device/symlink/runtime inode+mount/daemon flags thiếu hoặc trùng; thêm observation configId thiếu/sai và stdout/stderr không null. Guard dùng lstat/stat/realpath/findmnt thực, fixed child env, owned daemon flags và systemctl readback; không chỉ chấp nhận marker “đã áp giới hạn”. Npm ci chỉ được bắt đầu khi source chưa có node_modules. Bổ sung lifecycle check trước TERM/KILL để tránh signal child đã thoát. Không thay quota,4cases, D12/schema formatter hoặc14anchors.

Attempt04:15PASS/0FAIL/0SKIP, exit0; parse-only/plan-only exit0, source trước/sau khớp. [Receipt04](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/test-attempt-04.json). Sau đó kiểm source intake bằng lstat thay existsSync để từ chối cả dangling node_modules symlink, nên attempt04 là lịch sử; cần attempt05 trước freeze02. Actual Linux/DB/CI vẫn0, không có install/pull.

Nguồn cuối cho freeze02: **attempt05 15PASS/0FAIL/0SKIP**, exit0, fixture parse-only và plan-only exit0, source trước/sau khớp. [Receipt05](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/test-attempt-05.json), [TAP05](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/node-test-attempt-05.tap), [preservation02](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/preservation-check-02.json).14anchors/HEADs giữ nguyên. C206997934080B/D103656488960B trống tại checkpoint, không biến delta toàn ổ thành dung lượng riêng của task.9harness+6D12 là số test logic local duy nhất cho source này;4business cases vẫn chưa chạy. Tất cả attempt cũ giữ nguyên.

Chưa final review hoặc owner nghiệm thu. Hướng dẫn đọc code dự kiến: policy kiểm hardware/write-boundary/invocation; harness readLinuxEnvelope đọc kernel rồi runCi1Pilot quản phase; fixture làm only local actual operations sau guard; reporter giữ counts hook; D12 là public formatter. Không có source/coverage/privacy waiver mới.

## Metadata bàn giao và hướng dẫn đọc code

SEC/EVC cùng **APPROVE candidate02** SHA256 `cf2678553403c2b918df36306c11d18c416e1ec00afc51b77a69c8c331e1e504`,51files/514869B. Mỗi reviewer kiểm lại15NodePASS; toàn bộ finding01 CLOSED, không có finding mới. Source/recipe của snapshot02 giữ nguyên; chỉ cập nhật metadata review/bàn giao. [Review cuối](../reviews/2026-10-15-permission-ci1-linux-harness-local.md#metadata-kết-thúc-sau-freeze02). Không nhận approval local là Linux/CI/DB/Vercel readiness.

Hướng dẫn đọc cho owner: bắt đầu [policy:27](D:/Workspace/pos-cafe/scripts/permission-ci1-policy.mjs:27), nơi actual paths/mount/daemon flags phải nằm trong volume; [policy:76](D:/Workspace/pos-cafe/scripts/permission-ci1-policy.mjs:76) từ chối quota thiếu/sai. [harness:89](D:/Workspace/pos-cafe/scripts/permission-ci1-harness.mjs:89) thu facts từ kernel/daemon rồi [harness:19](D:/Workspace/pos-cafe/scripts/permission-ci1-harness.mjs:19) quản bootstrap→T09→T10→preservation→stop. [policy:115](D:/Workspace/pos-cafe/scripts/permission-ci1-policy.mjs:115) ràng buộc result với source/lock/config và actual stage observation; [reporter:6](D:/Workspace/pos-cafe/scripts/permission-ci1-vitest-reporter.mjs:6) chỉ giữ counts/hook status trước D12 formatter. [Tests](D:/Workspace/pos-cafe/scripts/permission-ci1-harness.test.mjs) dùng fake adapters để chứng minh logic từ chối, không chứng minh actual kernel/backend. Đây là walkthrough tài liệu được cung cấp lúc bàn giao, chưa có phản hồi owner đã đọc/hiểu/nghiệm thu.
