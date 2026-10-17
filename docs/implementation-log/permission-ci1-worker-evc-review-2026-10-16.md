# CI-1 worker — review độc lập EVC, 16/10/2026

Reviewer không tham gia viết candidate; phạm vi: đối chiếu implementation với luồng đã giao, metadata/cache, source binding, D12, tính xác thực và giới hạn bằng chứng. Không sửa candidate, không tải/cài binary/package/image, không chạy Linux/WSL/Docker/DB/CI/push/deploy hoặc xóa dữ liệu.

## Candidate 01 — CHANGES_REQUESTED

Manifest [candidate-01/manifest.json](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-01/manifest.json), SHA256 **81fe834d7f3acc0ea297adb8b82532cd60936c3bc7f53dcacc4857744fdf9eef**. Kiểm độc lập: 41 tệp snapshot, 1.250.465 bytes; hash/kích thước snapshot và source tương ứng đều khớp manifest trước/sau chạy tests. [Receipt riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate01-checks.json).

### Finding chặn EVC-01 — cache proof bỏ qua peer-copy và entry lạ

Vị trí: [permission-ci1-worker.mjs:240](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:240), liên quan traversal tại dòng249–261.

Trigger: package folder có `2.45.0_1/` — shape cache peer-copy hợp lệ của Deno — bên cạnh `2.45.0/`. Filter chỉ nhận `major.minor.patch`, nên toàn bộ peer-copy không được kiểm pin, type, `.deno_sync_lock`, giới hạn bytes hoặc hash. Prerelease/entry lạ cũng bị bỏ qua; version directory được duyệt trực tiếp mà chưa `lstat` để chặn symlink.

Bằng chứng từ source đã lưu: `deno_cache_dir`0.14.0 `npm.rs:83–98` trong [pinned source receipt](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/scout/pinned-cli-edge-cache-source.json) xây đường dẫn `${version}_${copy_index}` khi copy_index khác0. Body SHA256316be99ec8406a8bca81d650c7d531754674a70e2f8892a91307c97b0de3c96c khớp sourceSHA256 của receipt.

[Reproduction riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/cache-copy-repro.mjs) dùng cache hoàn toàn trong bộ nhớ. Sửa bytes `2.45.0_1/index.js`; proof trước/sau vẫn hash850372c59ba9c3787963ed2da70ef2fd14ae7fa71cb6c3539975021b2c8a10f8, files1 và cùng observed root. [Kết quả](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate01-cache-copy-repro.json).

Tác động: so hash trước/sau offline bundle có thể báo không drift dù bytes thuộc cache resolver có thể dùng đã đổi. Chặn vì invariant về toàn bộ bytes cache chưa đúng, không phải vì đã chứng minh actual closure18 có peer-copy. Cách sửa phù hợp phạm vi: duyệt và kiểm loại mọi entry, chỉ cho metadata/file và exact pinned version directories đã định nghĩa; từ chối peer-copy/prerelease/unknown/symlink nếu chưa hỗ trợ đầy đủ, không âm thầm bỏ qua. Thêm negative tests cho các đường này và kiểm lại candidate mới.

### Đã kiểm

- Đọc luồng effectful worker `launch` → task control/systemd → loop → source/tools → npm/images → Edge warm → stop-prefetch → namespace/offline → stack → harness → export/close, cùng intake/source helper và các anchor D12/D13. Không chỉ đọc state machine giả.
- Tự chạy lại 5 file Node test bằng Node24.16.0 có sẵn, `--max-old-space-size=512 --test --test-concurrency=8 --test-reporter=tap`: **29 PASS, 0 FAIL, 0 SKIP, exit0**. [TAP](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate01-tests.tap). Các tests dùng fake adapter/cache; không là runtime certification.
- Metadata intake bao phủ378 tarball npm mọi platform, exact tool URLs/versions/checksum/size;18 Edge pins được ghi đúng là candidate. Đọc pinned serde/cache/tarball verification source và kiểm hash body được dùng cho finding. Không nhận registry.json đơn lẻ là xác thực extracted bytes.
- Source inventory phân biệt POS baseSHA/fingerprint với actual publication commit; manifest giữ bytes source mới/test/pins và anchors. Inventory851 entry là danh sách/hash hiện tại, không là full publication payload đã duyệt.
- D12 serializer được giữ nguyên; worker regenerate JSON/Markdown, từ chối extra/forged fields; FAIL/ERROR receipt đã có có đường cứu export trong close, early failure không tạo counts. Worker COMPLETE và actual D12 PASS được tách trong hồ sơ; không thêm business PASS từ test giả.
- Hồ sơ ghi đúng actual Linux/cache/DB/CI bằng0 và các việc còn cần quyền riêng. Kết quả29unit chỉ xác minh source/pure guards trong phạm vi này.

### Chưa kiểm

Không xác minh online lại nhà cung cấp, không tải archives để kiểm expanded sizes; không actual npmcache add/offline npmci, Deno resolver/peer closure, binary compatibility, kernel/cgroup/loop/mount/daemon/namespace behavior,12services hoặc4backend cases. Exact workflow/publication, estimates peak thực, quyền chạy và runtime certification vẫn là gate tương lai. Finding EVC-01 là lỗi source có reproduction độc lập, không suy từ thiếu quyền chạy Linux.

**Verdict: CHANGES_REQUESTED đúng candidate01/hash trên; chưa APPROVE.**

## Candidate 02 — EVC-01 đã đóng

Manifest SHA256 **90d8d8b307fee6cc7b748c86d6c80725e6fa1a72c485dace4e1597f96599bc4c**;41tệp/1.257.636bytes. [Kiểm manifest/source và test riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate02-checks.json) không có mismatch/drift. Đọc toàn delta worker/tests/docs;5file tests chạy lại **32PASS/0FAIL/0SKIP,exit0**.

EVC-01 **CLOSED**: [worker:265](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:265) kiểm mọi package entry; dòng281–309 kiểm mọi version entry/type/metadata và duyệt mọi file trong exact pinned directory. Không còn filter âm thầm bỏ peer-copy. [Probe riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate02-cache-probe.json) xác nhận ba entry không hỗ trợ và ba vị trí symlink đều bị từ chối, valid cache được nhận, thay bytes accepted file làm đổi hash. Tất cả dùng dữ liệu trong bộ nhớ. Cách fail-closed có thể chặn actual Deno closure nếu phát sinh peer-copy; docs đã ghi đúng giới hạn, chưa chứng minh actual closure không tạo copy.

[Probe source riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate02-source-probe.json): inventory851entries/13.475.818bytes; fingerprint479ff36bdb0943d8a2d826283611e3f82c78e436c196887754a29d2165563988 khớp phép tính độc lập theo existing harness algorithm và attempt07. Đường clone/sourceSHA/D12 không đổi. Chưa có kiểm Linux/cache/DB/runtime nào mới.

**APPROVE phạm vi EVC về cache/source/evidence trên candidate02/hash trên.** Đây không thay verdict SEC; author đã thông báo đang bổ sung xử lý TERM timeout theo finding SEC và sẽ freeze candidate03. Cần xác nhận lại final candidate sau delta đó trước bàn giao chung.

## Candidate 03 cuối — APPROVE

Manifest [candidate-03/manifest.json](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/candidate-03/manifest.json), SHA256 **5280f61e419a84a1a0f16f8b79fac5559e3a32529b64c6d8ce04b2482001b327**. [Receipt kiểm riêng](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate03-checks.json):41tệp/1.261.136bytes, mọi snapshot/source hash và bytes khớp, không drift trước/sau kiểm. Delta02→03 chỉ worker termination, test tương ứng, hồ sơ và receipts/inventory; đã đọc toàn delta.

- **EVC-01 giữ CLOSED** trên candidate03. Nội dung hàm `ci1EdgeCacheProof` trùng từng byte với candidate02 đã kiểm bằng probe riêng. Source mới tiếp tục reject peer-copy/prerelease/unknown/symlink thay vì bỏ qua; không biến18metadata candidates thành actual resolver proof.
- Đã đọc wiring thực: [worker:237](D:/Workspace/pos-cafe/scripts/permission-ci1-worker.mjs:237) TERM→wait10s→ownership proof mới→KILL→wait5s, lỗi/không exit vẫn refuse. Production stopper tại dòng255 dùng helper này với retained child/live `/proc` proof; `ci1CloseDaemons` vẫn thử child thứ hai dù child đầu lỗi. Test mới kiểm cả TERM success, KILL success, KILL timeout, ownership drift và child đã exit. Đây là kiểm source/pure seam, không thực nghiệm signal Linux.
- Tự chạy lại5file tests: **33PASS/0FAIL/0SKIP,exit0**, cùng Node24.16.0 có sẵn, heap512MiB/process và concurrency8 như receipt. [TAP độc lập](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate03-tests.tap).16anchors vẫn khớp qua manifest, không nới D12/D13 hoặc business assertions.
- [Probe source cuối](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/evc-review/candidate03-source-probe.json) kiểm851inventory entries/13.477.654bytes so source hiện tại, không mismatch; tự tính theo existing fingerprint algorithm được **4fa3d7904291fd21634e8908a3a1b04aa8895b7aca297aa64b6df42afd2b000f**, trùng inventory và attempt08. SourceSHA tương lai vẫn phải là actual publication commit riêng, không POS baseline/fingerprint.

Không còn finding chặn trong phạm vi EVC đã giao. Bằng chứng và giới hạn được ghi đúng; actual Linux enforcement, tool/archive extraction, npmcache/offline install, Deno closure,12services,4backend cases, CI/push/deploy đều **NOT_RUN**, số run/backend cases mới bằng0. Review này không cấp quyền thực thi/publish hoặc nghiệm thu release.

**Verdict: APPROVE candidate03, SHA2565280f61e419a84a1a0f16f8b79fac5559e3a32529b64c6d8ce04b2482001b327, trong phạm vi implementation local và source/evidence EVC nêu trên.**
