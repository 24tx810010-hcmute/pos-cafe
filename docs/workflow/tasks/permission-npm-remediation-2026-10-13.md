# Mục1 tiếp tục — sửa inventory và dependency npm (13/10/2026)

**Execution local source34 đã đạt; chờ SEC→EVC review exact candidate. Phát hành BLOCKED.** Owner chọn giữ Tailwind3 và chờ upstream, không chấp nhận residual risk. Kế thừa [recipe local](permission-npm-recipe-2026-10-13.md), giữ toàn bộ FAIL/source31/candidate01/review lịch sử. Các checkpoint bên dưới được giữ theo thời điểm; kết quả hiện tại nằm ở mục cuối và [biên bản](../../implementation-log/permission-npm-remediation-2026-10-13.md).

## Quyền và mục tiêu mới

User trong chat nguồn `01a11fff-6130-7de2-aa08-8b42afd1a543` yêu cầu “check đi, cần thì lam tiếp luôn (không push)”; brief chuyển tiếp giao session này xử lý test inventory, vá dependency tương thích, chốt một final source/npm graph/config rồi chạy đầy đủ PIN19/PERM60 tuần tự và SEC→EVC. Không push main/docs, commit/stage/reset/stash/switch, deploy/upload/promote/provider settings/cleanup/activation/Storage delete. Dừng trước mục2 backup/quiescence. Routine fix được giao; major Tailwind/API/UI hoặc chấp nhận rủi ro chưa được tự quyết.

## Mốc inventory đã thực hiện

Theo PERM-T10/TC-PERM-29: metadata-only signals, refetch projection, không raw business payload. `tests/contracts/permissionInventory.tool.test.ts` đổi hai expectation cũ orders/floor_decor_items thành store_change_signals, bổ sung exact set publication được tham chiếu từ chính realtimePort.ts bằng `[public,store_change_signals]`; giữ các static inventory expectations khác và NOT_RUN runtime labels. Không đổi adapter, không skip/exclude hoặc giảm contract. Một assertion exact-set bao gồm cấm stream join-only cũ.

Source32 chỉ khác source31 đúng file test, manifest SHA `5f2cd20f6929c8515e600d96fbbf34a4c3336e122c5ccac250a8154b92d70979`, tar SHA `3cfe76dae46e1ea5b530fbba0d7153859aac45401b909ffd7561e414ea5fdb92`. Bản sao mới `/var/tmp/pos-cafe-npm-remediation-20261013-source-32/source`, npm ci thực từ cache rỗng: exit0, lock source31 giữ nguyên. Focused7/7 và expanded306/306,exit0,source812 drift0. Các lần291/306 và305/306 còn nguyên ở artifact recipe cũ.

Artifact mới A=`D:/Workspace/pos-cafe/artifacts/permission-npm-remediation-20261013`; scripts `snapshot.mjs`, `pipeline.py`; receipts A/source-32/{prepare,install,inventory,tooling}.json. Không install trong shared checkout.

## Lịch sử khảo sát dependency trước quyết định owner

Registry/advisory chính thức đã kiểm ngày13/10; snapshot metadata A/registry-*.json, chains A/dependency-chains.json. Thử nghiệm tương thích trong `/var/tmp/pos-cafe-npm-dependency-lab-20261013/source`: targeted `npm update postcss baseline-browser-mapping browserslist form-data nanoid postcss-selector-parser source-map-js --package-lock-only`; package.json không đổi.11 package entries đổi phiên bản (7 đích và4 browser-data transitive), không major upgrade/broad update/audit suppression. Lock proposal SHA `0014db88a22f14b9c9c9951b83b19685ac8a19e323131f550009da5a90d3feca`; chưa copy về canonical, chưa đồng bộ pnpm vì hướng cuối còn chờ. npm ci proposal exit0; verification còn đang làm. Không gọi proposal là final candidate.

Audit proposal còn7 findings (5 high/2 moderate), từ2 root advisory:

- `braces<=3.0.3`: latest registry3.0.3, chưa patched version. Tailwind3.4.19→chokidar3.6.0→braces và Tailwind→fast-glob3.3.3→micromatch4.0.8→braces; npm report lan truyền severity tới5 nodes gồmTailwind. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `postcss-selector-parser<7.1.6`: compatible6.1.4 sửa recursion trước nhưng còn flat-selector quadratic DoS; Tailwind3/postcss-nested6 giữ dependency6. Hai moderate nodes parser+postcss-nested. [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

Input dự án: tailwind.config.ts content là index.html và src/**/*.{ts,tsx}, plugin posCafeStyles từ code local; postcss.config.js dùng Tailwind/autoprefixer; tìm source app không có import trực tiếp các build packages. Không suy dev=true là miễn rủi ro: untrusted checkout/config/CSS trong môi trường build vẫn là bề mặt cần xét. Chưa có acceptance rủi ro từ owner.

Câu hỏi async đã gửi: (1) cho phép migration Tailwind4, giữ UI và kiểm đầy đủ nếu thiết bị đáp ứng Safari16.4+/Chrome111+/Firefox128+ (khuyến nghị trong điều kiện đó); (2) giữTailwind3, vá compatible và giữ release blocked chờ upstream; (3) giữTailwind3, yêu cầu phân tích controls để owner quyết định acceptance sau. Không chọn thay owner. [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide) nêu breaking changes/plugin/browser floor; đây là material scope theo AGENTS, không hỏi lại quyền routine work. Trong lúc chờ chỉ tiếp tục kiểm compatible proposal/chuẩn bị bằng chứng, không chạy full gates trước graph cuối.

## Gate và STOP

### Quyết định owner và final graph — cập nhật 13/10

User trả lời trực tiếp câu hỏi async: “Giữ Tailwind 3; áp dụng phần vá tương thích, giữ chặn phát hành và chờ bản vá upstream.” Chọn phương án2, không chấp nhận rủi ro tồn dư, không migration Tailwind4, không ủy quyền phát hành hay monitoring định kỳ. Tiếp tục các gate local đã giao.

Hai lockfile canonical đã được copy từ lab có guard hash nguồn; package.json không đổi. Nhập npm lock bằng pnpm11.6.0; so sánh toàn bộ tập package/version không có phần khác nhau, cả30 direct versions trùng. Proposal đầu postcss8.5.30/electron1.5.453 không khớp pnpm được giữ lịch sử; đã tái tạo từ npm lock source32 với cutoff `--before=2026-10-12T11:43:00Z`, không tắt freshness safeguard. Final dùng postcss8.5.29/electron1.5.452, vẫn11 version entries thay đổi. Không gọi hai lockfile tương đương byte hoặc graph Windows/Linux có cùng optional native packages.

Final source33 khác source31 đúng3files: inventory test và2lockfiles. Manifest SHA `d99d47827e5591ccb10d733806f6f7ba4334ac6064cd300f5d81bdc66c19b353`; tar SHA `bd30f806f4e56727507532f7aa3d55e14126f0b4b13417898cf11c414467802f`. npm lock `85969c1c161f74e9f68563182d99d1b0ac6fb5f17f5074444f329675ffd34e18`; pnpm lock `228530b75d9446ffec6e315a32d293b238b1dd51a8b2797e00c6ee8a05a75f7e`. Receipt A/final-lock-comparison.json. Fresh isolated npm ci source33 exit0; build, focused7 vàtooling306 exit0. Các gate còn lại đang chạy tuần tự. Shared node_modules không cài lại.

PIN19/PERM60 final graph NOT_RUN; SEC/EVC final candidate chưa chạy. Cloud Secret nextenv equality và exact runtime UNKNOWN; public tuple local đã pin không cấp quyền đổi provider. Backup13/10 strict74/75,cleanupEligible=false; scope79/bảo toàn66Auth/object3 không đổi. Chỉ chạy fixture cô lập đã có sau khi bảo toàn dữ liệu hiện có; tuyệt đối không hosted. Dừng trước mục2.

### Checkpoint source34 — thay source33 làm final candidate

Core source33 đạt sau UI attempt02 (attempt01 setupFAIL giữ lại). PIN source33 chưa đạt:2attempt runtime preflight fail doWSL/Dockerrestart;attempt03 có3pass/1fail/44notrun doTC02observer đếm normal floorRPC trướcrecoverycommit. Diagnostic12RPC HTTP200 ởnormal/recoverytransaction,0restricted;đã sửaobserver theoTC02restrictedprecondition,không đổiapp/expected0/skip/retry. Chi tiết [biên bản](../../implementation-log/permission-npm-remediation-2026-10-13.md).

Final đang kiểm B=`D:/Workspace/pos-cafe/artifacts/permission-npm-final-20261013`,source34 manifest `3053eb5a9bade4b1ee9dca090e473a6c6c82415eab02471874ba910ff5be92c3`,tar `15f349e3414ea9d76884acdd5518559a285233a9a4fcbe27365a85659e1591d7`,fingerprint `a711636bf2f9f357d37129603befb6ef388c64b9011156c87705f9c1fe9a2b43`.4file delta từ31,gồmTC02test;locks/confignhư33. Freshnpmci vàfocusedTC02 1/1exit0. Đang chạy lại core→fullPIN→PERM60 cùngsource34. SEC→EVCchưa chạy. WSLkeeper chỉ trongphiên, sẽtắt saustopcontainersgiữvolumes;khôngsửaWSLsettings.

## Handoff execution cuối source34 — 13/10/2026

Core npm ci/build, inventory7, expanded306, unit1173, focused PIN110, hai tsc và UI16×3 đều đạt. UI6findings là false positives baseline,0new/0setup; đã xem4ảnh. PIN19:55browser (48+7TC18),41SQL,1canary,2operator, không skip/retry; PERM60:full verifier valid60case/726required variants/27stage tuần tự. Nguồn/lock/config giữ nguyên source34, không ghép PASS từ source khác.

Hai adaptation môi trường phải được review cùng hồ sơ: T02 dùng shim allowlist cho lệnh đọc `wsl` để thực thi thật trên Linux; transition dùng client legacy commit cố định với npm graph gốc riêng làm fixture, candidate vẫn dùng graph đã vá. Config overlay giữ test/assertion và discovery hoàn toàn; attestation ghi đúng configId. Mọi lỗi setup/attempt và kiểm không drift được giữ; [biên bản](../../implementation-log/permission-npm-remediation-2026-10-13.md) mô tả đầy đủ.

Đã bảo toàn và tắt60containers của5stack, PostgreSQL T01, browser/dev servers và WSL keeper; volumes và dữ liệu Storage fixture giữ theo hash. Shared node_modules không đổi. Archive/source/evidence/config binding có hash trong B; raw credentials chỉ private. SEC rồi EVC phải APPROVE cùng candidate SHA trước hoàn tất bàn giao local; metadata review được bổ sung sau freeze, không dùng verdict recipe cũ.

Audit vẫn exit1 với7findings/2root advisories. Owner chọn chờ upstream; không migration Tailwind4, không acceptance rủi ro, không monitor định kỳ. Cloud runtime/env equality UNKNOWN và cloud build NOT_RUN. Không push/commit/deploy, không hosted mutation. Scope79 và backup strict74/75 trước đó không đổi; STOP trước mục2 live backup/quiescence/rehearsal/cutover. Walkthrough đã cung cấp, chưa có owner xác nhận đã đọc/hiểu.


**Metadata review cuối 13/10/2026:** SEC rồi EVC cùng APPROVE candidate-01 SHA256 `7d3aa43aa600ba98d1422fe80d4f9661a6a043905890b7df26bee96b5681b03c`; [verdict và giới hạn](D:/Workspace/pos-cafe-docs/docs/reviews/2026-10-13-permission-npm-remediation.md). Gate bàn giao bản vá và kiểm chứng local đã đạt. Các câu chờ review trong nội dung phía trên phản ánh thời điểm freeze; chỉ metadata này được bổ sung sau review, snapshot nội dung giữ nguyên. Release vẫn BLOCKED vì audit7findings và các gate cloud/live chưa thực hiện; không acceptance residual risk, không push/deploy/hosted mutation/mục2.
