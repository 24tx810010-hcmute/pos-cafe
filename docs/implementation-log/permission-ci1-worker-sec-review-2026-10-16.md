# SEC review độc lập — CI-1 worker local, 16/10/2026

Reviewer: `ci1_worker_sec`, không tham gia viết candidate. Phạm vi: effects/ownership, cgroup và namespace, ghi/giải nén/download, daemon/cache, public output và cleanup khi lỗi. Không sửa candidate/production, không cài hoặc tải package/binary/image, không chạy Linux/WSL/Docker/DB/CI, không push/deploy/delete.

## Candidate và verdict

**CHANGES_REQUESTED — candidate01**, manifest SHA256 `81fe834d7f3acc0ea297adb8b82532cd60936c3bc7f53dcacc4857744fdf9eef` tại [manifest](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-01/manifest.json). Đã tự tính hash: đúng 41 file, 1.250.465 bytes; mọi file snapshot và nguồn hiện hành khớp manifest tại thời điểm kiểm. Verdict chỉ áp dụng gói mã nguồn local này; không chứng nhận Linux enforcement, resolver/cache/extraction thực hoặc quyền thực thi/phát hành tương lai.

## Finding chặn

### SEC-WKR-01 — P2, cleanup không giữ được daemon mới acquire và dừng sớm khi một daemon lỗi

Vị trí: [worker:181](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:181), [worker:196](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:196), [worker:214](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:214), callers [worker:336](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:336) và [worker:430](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:430), cleanup [worker:469](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:469).

Trigger thứ nhất: `containerd` đã spawn và còn sống nhưng `ready()` bị timeout hoặc supervisor guard từ chối; hoặc việc spawn dockerd ném sau khi containerd đã sẵn sàng. `daemonPair()` chỉ trả cặp handle ở cuối hàm, nên phép gán `pair = await daemonPair(...)` chưa hoàn tất. `finally` nhìn thấy `pair === undefined` và bỏ dừng daemon đã acquire. Phép thử reviewer trích đúng hàm từ snapshot, thay spawn/write/ready bằng mock không effect, cho kết quả `spawned=1`, `pairReturned=false`, `cleanupKills=0`, `untrackedLiveChildren=1`.

Trigger thứ hai: dockerd không thoát trong timeout 10 giây, hoặc ownership proof/kill của nó lỗi. `stopDaemons()` ném ngay trong vòng lặp, nên không thử dừng containerd. Mock thứ hai trên chính hàm trong snapshot trả `rejected=true`, chỉ có `dockerd SIGTERM`, `containerdKillAttempted=false`.

Tác động: daemon có thể giữ file/mount trong loop; `umount` có thể EBUSY và nhánh detach sau đó bị bỏ vì cùng khối try. KillMode của systemd là lớp chặn cuối cho process; code không có lần unmount/detach lại sau khi unit dừng. Ngoài ra child process còn sống có thể giữ Node chờ đến RuntimeMaxSec. Không ghi nhận false PASS, nhưng chưa đáp ứng owned shutdown/unmount/detach khi startup hoặc quota guard thất bại. Đây là lỗi nguồn nên chặn gói local, không yêu cầu chạy Linux chưa được phép để xác nhận.

Hướng sửa: đăng ký từng child ngay khi spawn thành công và làm acquisition exception-safe; khi lỗi phải dừng mọi child đã acquire bằng ownership proof, không phụ thuộc resource guard đang thất bại. Cleanup phải tiếp tục xử lý child còn lại khi một stop lỗi, tổng hợp trạng thái lỗi, có TERM/KILL có giới hạn phù hợp và chỉ unmount sau khi xác nhận không còn process giữ dữ liệu. Bổ sung test tại seam của helper effect cho partial acquisition, timeout/guard failure, một daemon stop lỗi và lỗi không được biến thành COMPLETE. Không signal process ngoài ownership/cgroup đã xác minh, không dùng prune/delete dữ liệu để giải quyết finding.

## Đã kiểm

- Đọc toàn bộ worker/intake/source và đường tích hợp policy/harness/D12 liên quan, cùng docs phạm vi/recipe. Launch có platform/public/manual/source gate; systemd caps có readback; loop có BACK-FILE/offset/sizelimit/allocation checks; network warm tách khỏi namespace offline; subprocess environment được allowlist; public export dựng lại qua D12 và từ chối raw/extra/derived giả. Không phát hiện finding chặn khác trong phạm vi này.
- Chạy độc lập trên snapshot bằng Node có sẵn `D:/tools/nodejs/node.exe`: `--max-old-space-size=512 --test --test-concurrency=8 --test-reporter=tap` với intake/worker/source/harness/evidence tests. Cwd `D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-01/main`; exit 0, 29 PASS, 0 FAIL, 0 SKIP. Không cài dependency. Các test là pure Node/fake adapters; không suy thành 4 backend cases hoặc actual Linux PASS.
- Hai phản ví dụ nêu trên chỉ dùng function body nguyên trạng từ snapshot với mock trong bộ nhớ. Không spawn daemon, không ghi file test, không network và không đợi timeout thực.
- Kiểm dung lượng Windows trước các phép kiểm nhỏ: C còn khoảng 203,34 GB, D còn khoảng 103,49 GB; không tạo môi trường nặng. Chỉ báo cáo review này là đầu ra ghi mới của reviewer.

## Giới hạn và kiểm lại

Actual Linux/kernel, systemd/containerd/Docker compatibility, tar bytes/extraction, fresh npm/Edge cache, offline bundle, stack, DB và T09/T10 đều **NOT_RUN**. Exact workflow/publication allowlist/estimate và quyền owner cho future execution vẫn là gate riêng. Các giới hạn CPU 300%, RAM 10 GiB, swap 0, PIDs 2048, 30 phút, filesystem 18 GiB hiện chỉ được đọc từ source và kiểm bằng facts giả, chưa được áp dụng trên Windows.

Sau sửa SEC-WKR-01, gửi snapshot/manifest mới cùng test partial acquisition/teardown để reviewer đối chiếu delta, chạy lại pure tests và xác nhận verdict mới. Giữ nguyên verdict candidate01 này làm lịch sử.

## Review lại candidate02 — CHANGES_REQUESTED

Manifest SHA256 `90d8d8b307fee6cc7b748c86d6c80725e6fa1a72c485dace4e1597f96599bc4c` tại [candidate02](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-02/manifest.json). Reviewer tự kiểm 41 file/1.257.636 bytes: snapshot và nguồn hiện hành đều khớp; đọc delta worker/test/docs/receipt, không sửa candidate.

SEC-WKR-01 **đã xử lý một phần, còn CHẶN**:

- [worker:213](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-02/main/scripts/permission-ci1-worker.mjs:213) giữ containerd trước PID-write/readiness/second-spawn và catch gọi stop với partial pair. [worker:227](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-02/main/scripts/permission-ci1-worker.mjs:227) thử mọi child dù một stop lỗi. Hai nguyên nhân bỏ sót cleanup của candidate01 đã sửa; retained PID vẫn phải qua argv/cgroup ownership proof, không mở quyền signal tùy ý.
- Nhánh timeout tại [worker:250](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-02/main/scripts/permission-ci1-worker.mjs:250) vẫn chỉ gửi SIGTERM rồi reject sau 10 giây. Nếu daemon không thoát, acquisition catch nuốt lỗi stop rồi từ chối, pair không trả về caller; daemon có thể còn sống và giữ loop. Chưa có bounded ownership-recheck → SIGKILL → wait để khép nhánh này trước unmount. Không lấy KillMode lúc unit kết thúc làm bằng chứng explicit teardown đã thành công.
- Phản ví dụ độc lập dùng exported acquisition/close helper thật và function body stopper nguyên trạng từ candidate02, mock proof/timer/child: `rejected=true`, `signals=["SIGTERM"]`, `liveAfterAcquireRejection=true`. Không process/Linux/network/file effect thực. Cần bổ sung bounded escalation và test TERM timeout/KILL exit, ownership refusal trước KILL, KILL timeout giữ ERROR; vẫn phải attempt-all và không tuyên bố unmount thành công nếu process chưa được xác nhận đã thoát.

Delta cache từ chối peer-copy/prerelease/unknown entries và package/version/metadata symlink đã được đọc; không thấy mở rộng quyền hoặc regression SEC khác trong delta. Reviewer chạy lại đúng 5 pure Node test files trên cwd snapshot candidate02 với giới hạn heap/concurrency như candidate01: **32 PASS, 0 FAIL, 0 SKIP, exit 0**. Kết quả này không phủ Linux teardown thực hoặc backend. Các giới hạn NOT_RUN/quyền future execution của báo cáo vẫn giữ nguyên.

## Review cuối candidate03 — APPROVE trong phạm vi source local

**APPROVE — candidate03**, manifest SHA256 `5280f61e419a84a1a0f16f8b79fac5559e3a32529b64c6d8ce04b2482001b327` tại [candidate03](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-03/manifest.json). Reviewer tự tính lại 41 file/1.261.136 bytes; mọi file snapshot và nguồn hiện hành khớp manifest tại lần kiểm. Không còn finding SEC chặn trong phạm vi đã giao. Hai verdict trước giữ nguyên cho các candidate lịch sử.

**SEC-WKR-01 CLOSED:** [termination helper:237](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-03/main/scripts/permission-ci1-worker.mjs:237) gửi TERM, chờ tối đa 10 giây, đọc lại ownership ngay trước KILL và chờ tối đa 5 giây. Không xác nhận exit thì từ chối; ownership drift không cho phép KILL. [Production stopper:255](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-03/main/scripts/permission-ci1-worker.mjs:255) thật sự dùng helper này với retained ChildProcess, argv/cgroup proof và exit event; timeout gỡ listener. Partial acquisition/attempt-all của candidate02 giữ nguyên. Lỗi cuối vẫn ERROR, không được xem là cleanup thành công hoặc worker COMPLETE.

Reviewer đã chạy lại cùng 5 test files trên cwd snapshot candidate03, Node có sẵn, `--max-old-space-size=512 --test --test-concurrency=8 --test-reporter=tap`: **33 PASS, 0 FAIL, 0 SKIP, exit 0**. Test termination kiểm TERM exit, TERM timeout/KILL exit, KILL timeout, ownership đổi ngăn KILL và child đã exit không bị signal; test partial acquisition và attempt-all vẫn PASS.

Phép kiểm bổ sung độc lập kết hợp exported acquisition/close/termination thật với **nguyên function body production stopper** của snapshot và EventEmitter child/proof/timer giả: startup ready từ chối, child không thoát khi TERM; trace `proof → SIGTERM → 10000 → proof → SIGKILL`, `ownershipProofs=2`, `confirmedExited=true`, `exitListeners=0`, acquisition vẫn reject đúng vì startup không hoàn thành. Phép kiểm này không spawn process, không timer chờ thực, không file/network/Linux effect; nó xác nhận wiring và nhánh lỗi đã báo, không phải chứng cứ daemon Linux thật.

Đã đối chiếu delta worker/test/docs/evidence sau candidate02, không thấy regression SEC khác. **Giới hạn approval:** local source/readback contracts và pure mock verification; Linux/kernel/resource enforcement, actual tar/npm/Edge cache, Docker/service teardown, backend/T09/T10, CI và publication/deployment đều NOT_RUN. Exact workflow/payload/estimate và lệnh owner vẫn là gate riêng. Không dùng approval này làm quyền hoặc chứng cứ thực thi thành công.
