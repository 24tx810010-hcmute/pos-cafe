# Recipe Linux và harness CI-1 local — 15/10/2026

PLAN-D13: owner yêu cầu tiếp tục chuẩn bị recipe/harness CI1 tối thiểu ở local trong D:/Workspace, ưu tiên miễn phí và phải có giới hạn phần cứng; có quyết định cần owner thì hỏi/chờ. Phạm vi giao là source/recipe/kiểm thuần Node/docs/review. Không push, chạy CI, cài runtime/image, dựng DB/Docker, sửa database hoặc deploy. Đây là slice tiếp nối [D11](permission-linux-ci1-minimal-2026-10-15.md) và [reporter D12](permission-ci1-reporter-local-2026-10-15.md), không tạo feature/change spec mới hoặc đổi4business assertions.

## Giới hạn và phạm vi bảo vệ

AI chọn các số dưới đây trong phạm vi yêu cầu bảo vệ phần cứng; không ghi thành numeric quota do owner cung cấp. Không tự tăng khi thiếu tài nguyên.

| Tài nguyên | Trần / cách kiểm |
| --- | --- |
| CPU cả cây |CPUQuota300%, period100ms: tương đương tối đa3CPU về CPU time, không phải affinity3core |
| RAM cả cây |MemoryMax10737418240bytes =10GiB; đọc lại memory.max |
| Swap |MemorySwapMax0; đọc memory.swap.max=0 |
| PID/threads |TasksMax2048; pids.max=2048, event chạm trần hoặc OOM làm guard từ chối |
| Thời gian |RuntimeMaxSec1800s cho toàn unit kể cả chuẩn bị; grace dừng30s, KillModecontrol-group; child suite timeout300s rồi TERM→KILL |
| Mutable disk |Một ext4 loop image18GiB cấp phát thật, sizelimit18GiB; nguồn/node_modules/cache/DB/Storage/logs/containerd/Docker trong volume đó; ít nhất1GiB trống nội bộ |
| Ngân sách tổng |Giữ20GiB/task; phần ngoài volume phải là source intake đã duyệt và receipt/export nhỏ, không dùng khoảng2GiB còn lại làm cache phụ.20GiB là ngân sách vận hành, không quota toàn host do kernel áp |
| Reserve host |Trước image cần≥50GiB trống; sau đó giữ≥30GiB tại checkpoint/monitor.Đây là stop guard quan sát, không đặt reserve partition hoặc bảo đảm chống ghi từ process ngoài task |
| Evidence |Output serializer tổng≤1MiB; không upload raw/cache/artifact |

Hạn mức kernel nằm trên unit root `/system.slice/pos-cafe-ci1-r<RUN_ID>-a<ATTEMPT>.service`, main process ở `supervisor` nhờ DelegateSubgroup để tránh internal-process rule. Containerd/dockerd và12containers đều phải thuộc cây này; không chỉ giới hạn Node hoặc từng container độc lập. [Policy](D:/Workspace/pos-cafe/scripts/permission-ci1-policy.mjs), [kernel readback](D:/Workspace/pos-cafe/scripts/permission-ci1-harness.mjs).

**Trong lượt này chưa áp hoặc chứng minh giới hạn kernel.** Local chỉ kiểm logic bằng proof/adapters giả và parse source; guard thực từ chối mọi platform ngoài Linux/x64, WSL, job không manual/public/GitHub-hosted hoặc host khác4CPU/~16GB. Dừng nếu controller/cgroup/loop/namespace/daemon sai; không fallback daemon chung, không giảm12service/4case hoặc nới quota.

## Recipe candidate và chuẩn bị host tương lai

[Recipe chi tiết](../../implementation-log/permission-ci1-linux-recipe-2026-10-15.md). Lệnh local `D:/tools/nodejs/node.exe scripts/permission-ci1-harness.mjs plan 12345 1` chỉ tạo plan, không chạy Linux/install; [sample có nhãn LOCAL_PREPARATION_ONLY](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/recipe-plan.sample.json), runID mẫu không phải actual CI.

Recipe là trình tự provisioning có điều kiện, **chưa có provisioner/workflow tự động hoàn chỉnh hoặc Linux execution proof**. Harness chạy từ một envelope đã được dựng đúng; nó không tự dựng WSL, Docker Desktop, install online hoặc mở quyền CI. Intake CLI/Node/npm-cache/Edge-cache và exact publication source scope vẫn cần khép trước khi xin chạy. Không coi list systemd arguments là enforcement đã thực hiện.

## Phần source local được chuẩn bị

| File trên main | Vai trò |
| --- | --- |
| scripts/permission-ci1-policy.mjs |Trần cố định; hardware guard, immutable command mapping, invocation/result/stage binding |
| scripts/permission-ci1-harness.mjs |Plan-only CLI và guarded runtime adapter; offline exact-lock npm ci trong envelope trước import dependency; bootstrap→T09→T10→preservation→stop |
| scripts/permission-ci1-fixture.mjs |Reuse helper gốc;6PNG/3buckets, Realtime infrastructure prewarm; catalog semantics/financial6tables/Storage6payload preservation; closeDB |
| scripts/permission-ci1-vitest-reporter.mjs |Private finite counts, bắt hook/unhandled errors; không serialize error text/names/stacks |
| scripts/permission-ci1-harness.test.mjs |Pure Node fake proofs/adapters, negative guards/binding/state machine |
| tests/permissions/runtime/ci1-images.json |12pinned tag/index/platform/config digests đã xác minh metadata từ D11, không tải layer |

Runtime helper và4business cases giữ nguyên. Fixed layout t04 chỉ được bind trong namespace riêng; bootstrap yêu cầu DB chưa có public.stores, tự áp16migration và tạo Auth thật. Child chạy nguyên config T09/T10 không test filter, allowOnlyfalse/retry0. Kết quả phải khớp command/invocation/source/lock/config + observation trên fixture DB thật; exit0 hoặc4counts tự khai báo không đủ.

Global preservation bổ sung theo ranh giới hiện có: semantic catalog (giữ kiểm effective grants),6financial tables,3bucket/6object metadata và6payloads + source. Không nhận mọi public/auth row bất biến: T10 chủ động sửa category trong synthetic fixture. Không sửa assertion/cleanup hiện có để hợp thức hóa; các hook lỗi vẫn làm FAIL/ERROR. Raw kết quả/credential chỉ nằm private trong ephemeral job tương lai; không copy về public hoặc Windows. Không xóa bằng chứng cũ.

## Kiểm chứng / bàn giao

Tiêu chí: không chạy effect khi guard/metadata fail; đúng đủ1+3cases khi fake adapter hợp lệ; hook/skip/missing/source/binding/limit drift không thể thànhPASS; private error không lọt public; source/lock cũ không đổi. Thêm readback HOME/TMP/cache thực, compatibility mount inode/device, daemon exec-root/socket và stdout/stderr=null; configId observation phải khớp configSHA. Test thật ở local:15Node tests (9harness +6reporterD12), không có backend case hoặc kernel operation. [Biên bản](../../implementation-log/permission-ci1-linux-harness-local-2026-10-15.md), [review](../../reviews/2026-10-15-permission-ci1-linux-harness-local.md). Candidate01 bị SEC/EVC yêu cầu sửa, đang review candidate02; chưa hoàn tất.

Writes local dự trù<20MiB, không cài tool; Node hiện có D:/tools/nodejs. Source/evidence/docs dưới D:/Workspace; [baseline14anchors và disk](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/baseline.json). Full PIN/PERM/HP1/hosted/Vercel không nhậnPASS từ slice này. Walkthrough source sẽ gửi lúc bàn giao, owner chưa nghiệm thu.

## Metadata bàn giao sau review

**Hoàn tất gói chuẩn bị local D13; SEC/EVC cùng APPROVE candidate02** SHA256 `cf2678553403c2b918df36306c11d18c416e1ec00afc51b77a69c8c331e1e504`. Các trạng thái chờ review phía trên là checkpoint trong snapshot.15NodePASS,14anchors giữ nguyên, không có backend case/kernel test. [Verdict và finding đã đóng](../../reviews/2026-10-15-permission-ci1-linux-harness-local.md#metadata-kết-thúc-sau-freeze02).

Bước còn lại trước quyền chạy thật: hoàn thiện setup worker/intake/cache ở local, review exact workflow/publication payload và chứng minh đủ budget; sau đó mới hỏi owner quyền push/run. Không tự thực hiện những bước có effect ngoài scope. Walkthrough được cung cấp qua [biên bản triển khai](../../implementation-log/permission-ci1-linux-harness-local-2026-10-15.md#metadata-bàn-giao-và-hướng-dẫn-đọc-code); chưa có xác nhận owner đã đọc/hiểu hoặc nghiệm thu.
