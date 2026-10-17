# CI-1 — hoàn thiện worker và nguồn CLI/cache local,16/10/2026

Owner giao trong chat: tiếp tục worker Linux/CLI/cache trong D:/Workspace, tận dụng CPU nhưng giữ giới hạn; chưa push/chạyCI/sửaDB/deploy, cần quyết định thì hỏi và chờ; đồng thời tạo session độc lập nếu có việc song song. Đây là implementation tooling tiếp nối D13, không đổi yêu cầu phân quyền,4cases hoặc acceptance. Được sửa/kiểm code worker/intake ở local; không cấp quyền tải/cài binary/package/image, dựng Linux/WSL/Docker hoặc DB. No-delete dữ liệu cũ giữ nguyên.

Main HEAD5156820f7d6679cd6f8051bdc38419737ffa0c7e/docs HEADe47862b1dfed68d783dc07a2a1fd51ecdabc1b19, dirty. Không stage/commit/switch/branch/reset/stash. [Baseline16anchors và lời giao](D:/Workspace/pos-cafe/artifacts/permission-ci1-worker-20261016/baseline.json). Mọi đầu ra mới dưới D:/Workspace; write budget local20MiB. Không tạo lại bảy spec cho slice của change đang có; dùng phạm vi pilot D11 và guards D13, bổ sung test/traceability trong [biên bản](../../implementation-log/permission-ci1-worker-local-2026-10-16.md).

## Kết quả local được triển khai

- `permission-ci1-worker.mjs`: plan-only và launch/setup/isolated gated; systemd trước ghi lớn, loop preallocated18GiB, Git source thực, tool tar checksum/listing guard, npm cache và pinned images, Edge bundle warm→private namespace→offline bundle→stack→harness→safe export/owned teardown.
- `permission-ci1-intake.mjs`: policy/metadata/path/size validators; `permission-ci1-source.mjs`: inventory source để review publication, không upload.
- Ba file Node test, `ci1-tools.json` và `ci1-edge.json`. Node24.16/npm11.13/CLI2.117 pins và Edge18package candidate từ primary metadata; package/binary/image bytes chưa tải. Actual resolver có thể khác candidate, phải dừng nếu không khớp, không tự cập nhật pins.
- Nguồn phân quyền/migrations/Edge/business tests/lock/D12/D13 giữ nguyên. Không nhận worker COMPLETE là đủ release; actual D12 phải PASS, worker shutdown phải đạt và full gates/hosted còn riêng.

## Phần cứng và môi trường

Linux tương lai: CPUQuota300%, RAM10GiB, swap0,PIDs2048,30phút/grace30s, unit/supervisor hierarchy. Một filesystem18GiB, taskbudget20GiB/free30GiB, trước preallocate cần50GiB. `/var/lib/pos-cafe-ci1-r<RUN>-a<ATTEMPT>` nằm ngoài PrivateTmp; compatibility mount riêng vẫn `/var/tmp/pos-cafe-perm-s31-t04-20261013`. Kiểm kernel/loop/daemons thực trước effect phụ thuộc; không tin receipt thay readback.

Windows local: Node có sẵn D:/tools/nodejs; max8test-file workers,512MiB V8heap mỗi test process (không phải quotaRAM/CPU toàn Windows),5testfiles. Không browser/build hoặc full1173tests vì không đổi src/UI. Chưa benchmark hệ thống hoặc áp quota Linux trên Windows.

## Session độc lập

Đã tạo `01a1427e-444f-7c53-a486-23154c9b40ec` cho đối chiếu Supabase/Edge/Vercel local, output riêng `permission-deploy-package-20261016` và [hồ sơ](../../implementation-log/permission-deploy-package-local-2026-10-16.md); không sửa worker/index chung. Session đã hoàn tất86file inventory chọn lọc, SEC/EVC APPROVE theo hồ sơ riêng; không phải full release payload hoặc quyền deploy. Không cộng approval của session này thay review worker.

## Trạng thái và điểm dừng

Đang kiểm/review source worker local. Actual Linux enforcement/archive extraction/npm cache/Edge resolver/offline/harness backend đều chưa chạy; không gọi29unit fake tests là4backend cases. Giữ các lỗi/attempt cũ. Sau gói local cần review exact workflow/publication payload và owner cấp lệnh riêng trước mọi push/CI/install/runtime/DB/deploy. Không dùng quyền tạo session hoặc hạn báo cáo17/10 để mở quyền. Walkthrough được cung cấp trong biên bản; owner chưa xác nhận đã hiểu/nghiệm thu.


## Metadata bàn giao sau review

Hoàn tất source local: SEC/EVC cùng APPROVE candidate03 SHA256 `5280f61e419a84a1a0f16f8b79fac5559e3a32529b64c6d8ce04b2482001b327`; SEC-WKR-01/EVC-01 CLOSED,33NodePASS/0FAIL/0SKIP,16anchors0drift. [Biên bản và closeout](../../implementation-log/permission-ci1-worker-local-2026-10-16.md). Actual Linux/cache/backend/CI/push/DB/deploy vẫn NOT_RUN; chưa owner nghiệm thu. Đây chỉ là metadata ghi verdict cuối, không sửa nội dung candidate đã review.
