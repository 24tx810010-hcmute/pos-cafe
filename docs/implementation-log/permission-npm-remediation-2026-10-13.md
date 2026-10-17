# Inventory và dependency npm — 13/10/2026

Đã hoàn tất execution local theo [brief và quyết định owner](../workflow/tasks/permission-npm-remediation-2026-10-13.md); đang chờ review độc lập SEC rồi EVC. Đây là mục1 local, không phải release approval. Artifact lịch sử A=`D:/Workspace/pos-cafe/artifacts/permission-npm-remediation-20261013`; candidate cuối B=`D:/Workspace/pos-cafe/artifacts/permission-npm-final-20261013`, source34. Các kết quả source32/33 dưới đây là lịch sử, không cộng vào gate source34.

## Kết quả cuối trên source34

| Gate | Kết quả thực | Bằng chứng trong B |
| --- | --- | --- |
| Cài/build | Fresh npm ci và configured build exit0; Node24.16.0/npm11.13.0 | source-34/{prepare,install,build}.json |
| Unit/tooling/typecheck | 1173 unit,306 expanded,7 inventory,110 focused PIN;2tsc PASS | source-34 receipts;pin-*.json |
| UI | selftest23;16states×3viewports;6 false positives baseline,0new/0setup | ui/report.md;ui-classification.json |
| PIN19 execution | 55browser =48+7TC18;41SQL;1canary;2operator;0skip/retry | pin-summary.json;verify-pin.json |
| PERM60 execution | Full aggregate valid;60cases,726required variants,27stages tuần tự | aggregate-result.json;verify-perm.json |
| Dependency audit | Exit1:7findings (5high,2moderate),2root advisories còn mở | source-34/audit.json và audit.log;audit-disposition.json |
| Phát hành | BLOCKED theo quyết định giữ Tailwind3; cloud build NOT_RUN, next-cloud env/runtime UNKNOWN | binding.json;quyết định owner bên dưới |

Mọi stage candidate chạy bằng npm graph cuối trong một source34 đã lưu archive; client legacy dùng trong đúng bài transition là fixture từ commit cũ với graph riêng, được ghi rõ ở phần môi trường dưới đây. Không dùng pnpm PASS cũ làm bằng chứng npm. Các thất bại và điều chỉnh harness không bị xóa hoặc đổi nhãn.

## Thay đổi và lý do

`tests/contracts/permissionInventory.tool.test.ts` sửa expectation stale theo PERM-T10/TC-PERM-29: subscription của realtimePort chỉ là `public.store_change_signals`; exact-set guard cấm mọi business-row/join-only subscription tại adapter. Không sửa expected theo ý thích: contract đã duyệt metadata-only + refetch projections là căn cứ. Focused7/7 và expanded306/306 trên source32 npm fresh chứng minh slice này; source31 expanded305/306 FAIL được giữ.

Targeted npm update từ lock source32, cutoff `--before=2026-10-12T11:43:00Z`, không đổi package.json, không major upgrade/audit-force/override parser API.11 package entries thay phiên bản: baseline-browser-mapping2.11.28,browserslist4.29.3,caniuse-lite1.0.30001815,electron-to-chromium1.5.452,form-data4.0.6,nanoid3.3.20,node-releases2.0.58,postcss8.5.29,postcss-selector-parser6.1.4,source-map-js1.2.2,update-browserslist-db1.3.4. Registry/advisory snapshots có timestamps trong A.

Đồng bộ pnpm-lock bằng pnpm11.6.0 import từ npm lock, theo recipe Vercel dùng npm ci. Đây là chọn npm graph làm chuẩn deploy: so với pnpm lock cũ,11 direct version thay đổi, trong đó nhiều bản hạ về phiên bản npm đã khóa (Supabase2.112.3→2.108.1,React Query5.101.4→5.101.0,Playwright1.62.1→1.60.0,jest-dom6.10.0→6.9.1,user-event14.6.4→14.6.1,@types/node25.9.5→25.9.3,plugin-react6.0.5→6.0.2,autoprefixer10.5.4→10.5.0,Vite8.2.1→8.0.16);PostCSS8.5.26→8.5.29,Vitest4.1.10→4.1.11. Peer suffix của coverage-v8 thay theo Vitest nhưng own version4.1.11 không đổi. Không âm thầm coi graph pnpm cũ là bằng chứng cho npm; full gates mới đang chạy. A/pnpm-lock-delta.json ghi cả tập transitive thêm/bớt; A/final-lock-comparison.json xác minh30direct và toàn bộ package/version set giữa hai lock cuối khớp. Không cài lại shared node_modules.

## Binding và kiểm chứng source33 — lịch sử trước sửa oracle TC02

Final source33 manifest `d99d47827e5591ccb10d733806f6f7ba4334ac6064cd300f5d81bdc66c19b353`,tar `bd30f806f4e56727507532f7aa3d55e14126f0b4b13417898cf11c414467802f`,permission fingerprint `fe95c4179cf8fe106db1f54fb69ebd9161485199cb6a8d2115b0a17d2801d8c4`.3file delta so source31; source/archive gồm810files và2deleted entries. Final npm lock `85969c1c161f74e9f68563182d99d1b0ac6fb5f17f5074444f329675ffd34e18`; pnpm `228530b75d9446ffec6e315a32d293b238b1dd51a8b2797e00c6ee8a05a75f7e`.

Isolated `/var/tmp/pos-cafe-npm-remediation-20261013-source-33/source`: Node24.16.0/npm11.13.0,Ubuntu24.04.4, fresh npm cache/config/home, actual npm ci exit0. Build,focused7,expanded306,unit1173,2tsc đều exit0. npm ls exit0 với30direct installed=locked. Config explicit gồm3VITE vars từ private current compiled tuple; read-only Auth settings GET200 và compiled composition match. Bundle154files byte-identical với recipe source31/npm graph trước vá. Không chứng minh nextcloud Secret equality hoặc exact cloud runtime.

UI detector selftest23 + selftest OK. Full attempt01 exit2: menu-editor/mobile không thấy landing trong20s;6baseline findings,0new. Giữ report/log/ảnh A/ui-attempt-01. Focused diagnostic đúng state/viewport exit0,0findings/0setup failure. Full attempt02 exit0:16states×3viewports,6baseline/0new/0setup failure. Đã đọc report và mở4ảnh annotated/PIN; sáu false positives là label sidebar thu gọn có chủ đích: VẬN HÀNH57→1px ngang,16→0px tên owner,15→0px vai trò,15→1px heading,16→1px nhãn Bàn,16→1px nhãn Khoá. Selector đầy đủ + phép đo: A/ui-classification.json. Không baseline update, không sửa app; nguyên nhân timeout attempt01 chưa xác định.

## Rủi ro còn lại và quyết định

Audit cuối exit1,7findings (5high/2moderate), không được ghi PASS. Hai root advisories còn lại: [braces chưa patch](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) và [selector-parser cần7.1.6](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Tailwind3 chain giữ braces3.0.3/parser6.1.4. Build input từ repository/config/CSS; dev dependency không tự chứng minh an toàn với input không tin cậy.

User chọn giữ Tailwind3, áp dụng compatible, release BLOCKED chờ upstream. Không chấp nhận residual risk, không tự mở scope Tailwind4, không lên lịch monitoring. PIN19/PERM60 execution đã đạt; SEC→EVC còn chờ tại thời điểm khóa nội dung, verdict được bổ sung riêng dưới dạng metadata review.

## Hiệu chỉnh TC02 và source34

Source33 PIN browser attempt01/02 đều fail preflight SERVICE_REFUSED: WSL/Docker restart giữa các lần gọi khiến Edge không tự chạy lại. Giữ nguyên reports. Journal Docker,bootId/containerStartedAt chứng minh runtime restart; task giữ một WSL foreground process đến hết kiểm thử, không sửa cấu hình máy. Sau khi đủ12services healthy,attempt03 chạy3PASS/1FAIL/44NOT_RUN. FAIL ở cached normal→recovery,assert RPC list rỗng tại test:1277. Diagnostic copy chỉ thêm timestamp/phase/HTTPstatus,không đổi assertion:1FAIL;12floorRPC đều HTTP200 trong recovery transaction trướcCOMMIT,0ở restricted phase. Logs A/pin-cached-diagnostic.log và source33 private JSON report giữ lại.

TC02 spec tiền điều kiện là restricted. Sửa [observer:1258](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1258) bắt đầu sau recovery→passcode và xác minh floor/AppShell đã unmount,trước restricted login. Giữ positive normal read/cache,0RPC protected ở pha restricted và mọi cache/focus/history/DB cờ assertions. Không app code,expected list,skip/retry hoặc quyền thay đổi. [usePosData.ts:13](D:/Workspace/pos-cafe/src/features/pos/usePosData.ts:13) có normal polling5s; [PermissionLifecycle.tsx:86](D:/Workspace/pos-cafe/src/app/PermissionLifecycle.tsx:86) invalidate khi signal. Không gán normal reads hợp lệ thành lộ dữ liệu restricted. Đây là sửa oracle theo tiền điều kiện đã duyệt,không requirement mới;review cuối phải kiểm riêng.

Source34 có4file delta từ31:2lockfile,inventorytest,TC02browsertest. Manifest `3053eb5a9bade4b1ee9dca090e473a6c6c82415eab02471874ba910ff5be92c3`;tar `15f349e3414ea9d76884acdd5518559a285233a9a4fcbe27365a85659e1591d7`;permissionFingerprint `a711636bf2f9f357d37129603befb6ef388c64b9011156c87705f9c1fe9a2b43`. Npm graph/config không đổi so33. Fresh copy `/var/tmp/pos-cafe-npm-remediation-20261013-source-34/source`,actual npmci exit0;focused TC02 1/1 exit0. Core gates rồi PIN19/PERM60 chạy lại tuần tự,không ghép33PASS. SEC/EVC chưa chạy.

## Lịch sử kiểm chứng source34

Actual npm ci, build, inventory7, expanded tooling306, unit1173 và hai cấu hình TypeScript đều exit0, source812 drift0. UI selftest23 + `selftest OK`; full audit exit0,16states×3viewports,6baseline/0new/0setup failures. Đã đọc report và mở cả4ảnh của source34. Sáu finding đều là nhãn thanh bên thu gọn có chủ đích như phân loại lịch sử phía trên; selector và phép đo source34 trong B/ui-classification.json. Không sửa baseline. Binding compiled tuple match, read-only Auth settings GET200; npm ls exit0 với30direct và673installed manifests. Không suy ra cloud equality.

PIN browser source34 attempt01:6PASS/1FAIL/41NOT_RUN. TC03 ghi file `artifacts/permission-close2-20261011/tc03-transport-observed.json` nhưng thư mục đầu ra chưa có trong snapshot sạch. B/pin-browser-attempt-01-disposition.json ghi nguyên nhân và đường dẫn bảo toàn report/log. Đã tạo thư mục rỗng ngoài source rồi chạy lại đủ48, không đổi test/assertion. Mọi attempt được giữ riêng; lần thất bại không được đổi thành PASS.

Kiểm shared checkout:812entries khớp source34,39329node_modules entries có treeSHA `9a0127e4fce587a6ed771b69f472e6d750b10fc41774101788359c025711097c` như trước task; HEAD main/docs giữ nguyên. B/shared-after.json ghi thời điểm đối chiếu.

PIN19 source34 đã qua kiểm chứng execution: discovery55 khớp48browser +7TC18,41SQL,1canary,2operator,110focused tooling; bắt buộc0skip/retry/expected-failure/hook error. TC18 có20kịch bản,scan48files vàcontrol deleted. B/verify-pin.json exit0 và B/verify-pin.log chứa summary; review cuối vẫn chờ. Canary local có backup trước reset và sau test; CLI reset tạo lại đúng DB container cùng project/image/volume. Stop guard ban đầu từ chối ID mới; đã kiểm creation timestamp nằm trong cửa sổ reset thành công rồi cho phép đúng một ID transition khi stop canary, ghi B/stop-canary.json. Không đổi test/source hay chạm hosted; ba stack PIN đã stop, volumes giữ nguyên. PERM60 còn đang chạy tuần tự.

Build source34 có154files byte-identical với npm build source31; B/dist-comparison.json và binding manifestSHA `18fff8fe3fe163fcc28353e65e625f1737d6f04e0a9f7d5995e77cbbe30e15e2` ghi phép đối chiếu. Điều này không thay kiểm hành vi hoặc chứng minh Vercel/cloud đã build.

## Môi trường, điều chỉnh runner và bảo toàn fixture

PERM60 có27stage, toàn bộ trên native Linux và npm candidate graph cuối; không trộn8stage Windows/pnpm từ run cũ. T01 có offline archive cluster trước khi tạo DB synthetic mới. Năm stack Supabase có offline DB/Storage archive trước mutation; T04 còn có dump/archive ngay trước chuỗi test, kiểm cuối giữ nguyên3buckets,6objects và6payloads theo hash. Edge3files khớp source34. Các marker, tenant, schema, grant, API/observer binding và candidate-phase observation vẫn được kiểm thật.

T02 preparation attempt01 dừng vì helper `permission-bridge-runtime.mjs:16` gọi `wsl` ngay cả trên Linux. `t02-wsl-shim.py` chỉ chấp nhận nguyên tuple `-d Ubuntu-24.04 --` và đúng5nhóm lệnh đọc đã liệt kê cho project T02; chuyển tới cat/docker/CLI native, giữ stdout/exit code thật. Shim chỉ có trong PATH của T02, không sửa source/expected và không giả health/binding. Attempt02 và ba stage T02 đạt. B/t02-transport-disposition.json cùng script ghi rõ adaptation.

Transition browser attempt01 dừng trước test: [legacy helper:74](D:/Workspace/pos-cafe/scripts/permission-legacy-head.mjs:74) từ chối lock candidate đã vá khác lock commit legacy. Đã tái hiện đúng `LEGACY_DEPENDENCY_LOCK_MISMATCH`. Client đối chiếu được dựng riêng từ commit `ef2c372aec60d8362549e47b7aedb27126129479`: fresh npm ci từ package/lock của commit đó, helper gốc vẫn kiểm lock/source/archive/dist/env binding. Vite của chính graph legacy serve artifact; candidate và Playwright tiếp tục dùng graph npm source34. Graph cũ chỉ là fixture, không phải dependency đã vá hay bằng chứng candidate. B/legacy-comparator-{install,provenance,artifact,after}.json ghi nguồn, hash và kiểm không drift.

Overlay `legacy-comparator.config.ts` giữ nguyên test/assertions/project/timeout/retry/candidate server, chỉ đổi lệnh serve fixture legacy và đặt cwd hai server về source root như config gốc. Attempt02 còn dừng trước test do cwd mặc định của config chuyển vào thư mục artifact; đã sửa cwd, attempt03 đạt1/1. Discovery suites của config gốc và overlay bằng nhau hoàn toàn; mọi trường config được reporter xuất giống nhau trừ configFile. Attestation ghi đúng overlay configId, không gắn nhãn config gốc. B/transition-config-parity.json và các disposition giữ lịch sử. Summary legacy ban đầu trùng tên với execution receipt: giữ receipt, tái dựng summary từ hai manifest lưu trên đĩa đã đối chiếu byte; ghi rõ trong legacy-comparator-artifact.json.

Cuối run: full aggregate verifier đối chiếu discovery/results/options/attestations và candidate-phase evidence, đủ60cases/726variants/27stage không chồng thời gian. Cả60containers thuộc5stack đã stop, network không còn attachment, volumes còn nguyên; PostgreSQL T01 và các test listeners đã tắt. B/cleanup-check.json ghi kiểm tra. B/dependency-after.json xác nhận673installed manifests và installed lock không drift; shared node_modules vẫn39329entries như trước. Private archive phục hồi source/evidence/dist có hash và quyền truy cập trong B/private-output-archive.json. Không hosted mutation, không commit/push/deploy, không tiến sang mục2.

## Cách chạy lại và phạm vi bằng chứng

Nguồn phục hồi là B/source-34.tar + source-34.json (810files,2deleted entries). Dùng thư mục và output mới, kiểm toàn bộ hash trước khi chạy; Node/npm và config3VITE vars theo prepare/binding, không lấy key từ docs. `pipeline.py source-34 <stage>` ghi lệnh thực cho install/build/inventory/tooling/unit/2tsc/selftest/ui/audit; các receipt ghi cwd, UTC, exit và log hash. Khi chạy lại cần đổi nhãn/output để không ghi đè bằng chứng cũ.

Các lệnh PIN/PERM thực nằm trong runtime receipts và các runner đã đóng gói: `full-gates.py`, `remaining-gates.py`, các continuation cho lỗi môi trường, `verify-pin.mjs`, `collect-perm.mjs`. Chuỗi fixture phải được kiểm và bảo toàn lại trước run mới; không gọi reset với control/marker cũ mà bỏ guard. B/private-evidence-index.json và archive chứa runner đã dùng, report/discovery/options/profile attestations, fixture controls và legacy artifact; raw credential chỉ ở vùng private. Máy chưa có fixture phải dựng đúng local runtime theo hướng dẫn T02/T04; hồ sơ này không cho phép dùng hosted để thay thế.

## Đường đọc code cho owner

Đọc [inventory expectation:178](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:178) → [metadata subscription:32](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:32) → [exact-set guard:193](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:193) → [TC02 observer:1258](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1258) →11npm version deltas → regenerated pnpm delta → source34 receipts. Walkthrough đã cung cấp trong hồ sơ, chưa có phản hồi owner xác nhận đã đọc/hiểu. Release giữBLOCKED; dừng trước mục2 livebackup/quiescence/rehearsal/cutover.


**Metadata review cuối 13/10/2026:** SEC rồi EVC cùng APPROVE candidate-01 SHA256 `7d3aa43aa600ba98d1422fe80d4f9661a6a043905890b7df26bee96b5681b03c`; [verdict và giới hạn](D:/Workspace/pos-cafe-docs/docs/reviews/2026-10-13-permission-npm-remediation.md). Gate bàn giao bản vá và kiểm chứng local đã đạt. Các câu chờ review trong nội dung phía trên phản ánh thời điểm freeze; chỉ metadata này được bổ sung sau review, snapshot nội dung giữ nguyên. Release vẫn BLOCKED vì audit7findings và các gate cloud/live chưa thực hiện; không acceptance residual risk, không push/deploy/hosted mutation/mục2.
