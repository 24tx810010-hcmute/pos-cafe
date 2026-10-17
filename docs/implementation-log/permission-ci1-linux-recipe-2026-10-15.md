# Recipe Linux CI-1 tối thiểu — candidate local 15/10/2026

Cập nhật16/10: owner đã giao [implementation worker/CLI/cache local](permission-ci1-worker-local-2026-10-16.md), SEC/EVC đã cùng APPROVE candidate03 (source local,33NodePASS; chưa actual runtime). Những câu “chưa có worker” phía dưới là checkpoint thiết kế D13 ngày15/10; code mới không cấp quyền thực thi hoặc chứng minh Linux đã chạy. Worker dùng taskroot `/var/lib/...` để không bị systemd PrivateTmp che khuất, còn compatibility alias vẫn `/var/tmp/pos-cafe-perm-s31-t04-20261013`.

**Chưa cho phép thực thi recipe.** [Scope D13](../workflow/tasks/permission-ci1-linux-harness-local-2026-10-15.md). Các command/template dưới đây là thiết kế provisioning cho ephemeral Ubuntu24.04/x64 public standard runner, không đã chạy và không phải worker tự động hoàn chỉnh. Không dùng máy Windows/WSL cũ hoặc database online. Chỉ chuẩn bị local hiện tại; không tự push/dispatch để thử.

## Nguồn và điều kiện miễn phí

GitHub công bố public standard Ubuntu4CPU/16GB miễn phí; storage table14GB không bảo đảm reserve của task. CI0 từng đo~85GiB trống chỉ là checkpoint lịch sử; job sau phải đủ50GiB trước cấp image và30GiB sau. [Runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [billing/log-summary](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Workflow tương lai phải dùng label tiêu chuẩn ubuntu-24.04, không larger/self-hosted/artifact/cache/paid storage; kiểm env hosted/public không tự chứng minh hóa đơn hoặc runner label, vẫn cần review exact workflow trước publish.

CPU/memory/PIDs dùng cgroupv2 dưới systemd, delegation với main subgroup supervisor; đọc lại kernel thay vì tin config. [Kernel](https://docs.kernel.org/admin-guide/cgroup-v2.html), [systemd source](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.resource-control.xml), [systemd-run](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd-run.xml). Ubuntu cần systemd≥254 cho DelegateSubgroup. Docker phải có riêng data-root/containerd và cgroup-parent; [Docker reference](https://docs.docker.com/reference/cli/dockerd/).

## 1. Đầu vào trước khi cho chạy

- Có quyết định riêng cho exact workflow/source/push/manual1run, miễn phí và owned shutdown. Turn hiện tại không cấp quyền đó.
- Publication manifest gồm source/candidate/test/functions/config/lock cần thiết, loại.env/token/key/backup/private artifacts; source+Git intake ngoài volume đề xuất≤64MiB, export≤1MiB. Chưa lập/duyệt exact publication allowlist nên chưa thực thi intake.
- Node24.16.0, CLI2.117.0 và npm theo lock/Node toolchain có provenance/checksum/size. Chưa tải installer hoặc khẳng định runner sẵn đúng version.
- Images theo `tests/permissions/runtime/ci1-images.json`: pull platform manifest digest đã xác minh, rồi tag về exact CLI ref và kiểm RepoDigests/ID/platform trước start. Không dùng historical c.Image như config digest hoặc tự thay tag.12/12metadata đã có, actual pull/start chưa có.
- Npm-cache Linux và Edge npm:@supabase/supabase-js@2.45.0/cache graph được chuẩn bị trong cùng volume/capped unit. Cần chốt intake/size và offline warmup/readiness trước private phase; thiếu cache thì BLOCKED, không mở network trong test.

**LỚN HƠN1GB nếu thực thi sau này:** tổng compressed image layers đã biết1.997.580.262B≈1,860GiB; historical pure image store~7,898GiB chỉ là cơ sở ước tính. Preallocated image18GiB cố định, mục tiêu tổng task≤20GiB. Download/npm/CLI/Edge intake tổng và expanded/runtime fit chưa chứng minh; chưa được cài/pull khi thiếu upper-bound/setup proof. Trần filesystem là biện pháp giới hạn ghi sau khi apply thật, không chứng minh workload sẽ vừa hoặc đã chạyPASS. Lượt local hiện tại chỉ vài fileKB, không cấp phát18GiB.

## 2. Cấp limits trước thao tác nặng

Lấy prefix systemd từ `node scripts/permission-ci1-harness.mjs plan <runID> <attempt>`; append một setup worker đã review sau này. Prefix có CPUQuota300%, MemoryMax10GiB, swap0, TasksMax2048, RuntimeMax1800s, stop30s/KillModecontrol-group, Delegate=yes/DelegateSubgroup=supervisor, PrivateTmp=yes và stdout/stderr null. Không append command tùy ý từ user input. Worker phải kiểm `/proc/self/cgroup` đúng unit/supervisor, đọc lại cpu.max/memory.max/memory.swap.max/pids.max và timeout trước tiếp tục. Chưa có worker provisioning tự động trong candidate này; không gọi prefix rời rồi nhận là setupPASS.

Trong owned task directory mới của runner, xác minh target không tồn tại, không symlink/mount cũ và hostfree≥50GiB trước tạo file. Cặp đường dẫn cố định được harness kiểm: `<task>/data.img` và `<task>/volume`.

```bash
# Template chỉ áp dụng cho image mới do chính task sở hữu, sau scope/setup review.
fallocate -l 19327352832 "$task/data.img"
loop=$(losetup --find --show --nooverlap --sizelimit 19327352832 "$task/data.img")
# Trước mkfs phải xác minh loop BACK-FILE đúng target mới, offset0/sizelimit18GiB.
mkfs.ext4 -E nodiscard "$loop"
mount -o nodiscard "$loop" "$task/volume"
```

Không tái dùng/làm format device có dữ liệu. Harness kiểm logical image size, allocated blocks và ext4 capacity. `mkfs` mặc định có thể discard preallocation nên phải nodiscard, không fstrim/punch-hole về sau. [e2fsprogs source](https://raw.githubusercontent.com/tytso/e2fsprogs/master/misc/mke2fs.8.in). Đây là Linux loop ephemeral tương lai, không VHD/WSL mới hoặc quota toàn host;2GiB margin ngoài image không phải cache phụ. Chuẩn bị source/private/docker/containerd/run/tmp/home/npm-cache/runtime/home/.cache đều trên volume; root/node_modules/TMPDIR/HOME/cache không được trỏ ổ host ngoài. Guard đọc realpath/lstat/device thực, không chỉ tên thư mục; source intake không có node_modules, kể cả dangling symlink. Sau npm ci, node_modules phải là directory đúng vị trí trên cùng filesystem.

## 3. Prefetch rồi cô lập

Trong cùng capped unit: kiểm source/provenance→stage tools→prefetch image+NPM/Edge cache vào volume. CLI warmup chỉ khởi tạo schema Supabase nội bộ, không copy production migrations/seed vào startup stack: copy exact identity.toml, tạo migrations directory rỗng và seed.sql rỗng; giữ functions code. DB chưa có public.stores để helper bootstrap16migrations được phép chạy.

Prefetch daemon phải riêng, data-root/containerd/root/run/private logs trong volume, không socket chung/host cache. Nếu cần warm Edge dependencies, thực hiện trước baseline khi còn network ở phase intake có scope, chỉ synthetic empty target. Chưa chứng minh cache đầy đủ hoặc automation chuyển phase; đây là blocker thật trước thực thi. Không mở network lại sau chuyển test phase hoặc fallback tải khi cache thiếu.

Dừng sạch prefetch daemon trước chuyển vào mount/net/PID namespace mới; reuse đúng một image store, không tạo store thứ hai/save archive song song. Giữ nguyên cgroup/unit xuyên các phase. Trong namespace: mount propagation private, loopback up, không default route; dùng bind từ volume/runtime tới `/var/tmp/pos-cafe-perm-s31-t04-20261013` trong PrivateTmp của unit, từ chối target/mount đã tồn tại. Guard đòi exact mount target/ext4 và inode/device trùng volume/runtime; chỉ cùng ổ hoặc một directory khác trên volume không đủ. Ghi host namespace IDs trước unshare vào `<task>/host-namespaces.json`; actual harness đòi cả3ID khác. Source cwd cuối `<volume>/source` có Git state đã duyệt.

## 4. Owned daemons và stack

Containerd riêng cần flags chính xác `--root=<volume>/containerd --state=<volume>/run/containerd-state --address=<volume>/run/containerd.sock`, PID ghi vào `<volume>/run/containerd.pid`; cấu hình/plugin version phải phù hợp toolchain runner trước execution. Docker cần flags dưới; PID ghi `<volume>/run/dockerd.pid`.

```text
--host=unix://<volume>/docker.sock
--containerd=<volume>/run/containerd.sock
--data-root=<volume>/docker
--exec-root=<volume>/run/docker
--pidfile=<volume>/run/dockerd.pid
--exec-opt=native.cgroupdriver=cgroupfs
--cgroup-parent=/system.slice/pos-cafe-ci1-r<RUN_ID>-a<ATTEMPT>.service
--default-network-opt=bridge=com.docker.network.bridge.host_binding_ipv4=127.0.0.1
```

Không kế thừa host daemon.json/proxy/credential hoặc containerd global; config/logs riêng và namespace names riêng phải review cùng worker tương lai. Ở test phase khởi động exact CLI stack12services từ cache; kiểm ID/RepoDigests đã pin và loopback trước bootstrap. Cgroup của cả2daemon và12containers phải nằm dưới unit; bind/volume mounts cùng filesystem loop, tmpfs tính vào RAM cap. Guard đọc process cmdline/kernel state, không chỉ file “limits applied”.

## 5. Harness và bằng chứng

Chỉ khi envelope/kernel/images sẵn: đặt DOCKER_HOST=`unix://<volume>/docker.sock`, HOME=`<volume>/home`, TMPDIR=`<volume>/tmp`, XDG_CACHE_HOME=`<volume>/home/.cache`, NPM_CONFIG_CACHE=`<volume>/npm-cache`; bỏ DOCKER_CONTEXT. Nếu TMP/TEMP/npm_config_cache được đặt, chúng phải trùng đường tương ứng; XDG_CONFIG_HOME/DENO_DIR nếu có phải trỏ đúng `<volume>/home/.config`/`<volume>/home/.cache/deno` và directory thực cùng volume. CI1_EXECUTION_AUTHORIZED=yes chỉ do workflow đã duyệt. Chạy `node scripts/permission-ci1-harness.mjs run <volume>` từ `<volume>/source`. Child env được dựng bằng allowlist và gán cứng HOME/TMP/cache vào volume; guard còn đọc actual StandardOutput/StandardError=null từ systemctl trước bootstrap để helper/SDK không đưa raw log ra public. Daemon flags phải đủ, không có cùng option lặp ghi đè ra host, gồm dockerd exec-root và containerd socket.

Harness làm npm ci **offline**, cache riêng/đúnglock, không online fallback; import runtime/pg sau đó, giữ lock nguyên. Bootstrap16migration/Auth2users/2tenant/5employees thật, Storage6readbacks/3buckets, prewarm infrastructure trước baseline. T09/T10 chạy toàn config lần lượt, không filter/retry; kiểm stage observation cùngsource/marker/endpoint và executionProfile.configId khớp invocation configSHA. Kiểm source/catalog semantics/financial/Storage trước-sau; bắt cleanup hooks và stop đúng container IDs đã validate. Không rm/prune/xóa dữ liệu hoặc tạo raw archive/replay sâu.

Raw subprocess log/results/env chỉ ở private trong18GiB volume; public-evidence.json/public-summary.md được dựng bằng D12 allowlist. Chỉ workflow tương lai mới được export file gọn qua log/JobSummary; không tee/cat raw hoặc printstack khi lỗi. Nếu Node bị kernel kill/timeout trước receipt, job tương lai phải ERROR/BLOCKED, không synthesize counts/PASS. Không gọi helper trực tiếp để bỏ qua envelope guard.

## Trạng thái recipe

Đã chuẩn bị contract/provisioning order, systemd prefix và guarded harness local. Chưa automation hóa đầy đủ setup worker/intake và chưa kiểm kernel/Docker/network/cache thực. Actual Linux resource proof, fresh install/image store/cache fit và4cases còn NOT_RUN; chưa đủ xin “chạy ngay” hoặc nhận đủ điều kiện deploy. Cần khép các blocker đầu vào/worker ở local rồi review exact workflow/payload trước khi hỏi quyền push/run1lượt.
