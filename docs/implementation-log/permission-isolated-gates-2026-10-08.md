# Full-stack readiness và incident cleanup ảnh — 08/10/2026

## Phạm vi và trạng thái

Chủ dự án trả lời **“ok tiếp tục đi”** sau slice [runbook/readiness mock](permission-runbook-readiness-2026-10-08.md), tiếp tục yêu cầu chia scope nhỏ, auto test, UI test và subagent chọn model theo độ khó. Lượt này xác minh fixture full Supabase cách ly, rồi chạy các gate identity/ảnh/PIN/TC44 theo source hiện hành. Khi image cleanup không hoàn tất và mất baseline TEMP, chủ dự án chọn **“Cho phép phục hồi fixture và sửa cleanup (khuyên dùng)”** cho scope diagnostic an toàn, reset đúng2 cửa hàng/Auth giả, giữ Storage, sửa nguyên nhân nếu tái hiện và kiểm lại. Quyền trực tiếp trong chat; không có quyền rollout hosted từ handoff.

Main `D:/Workspace/pos-cafe`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs `D:/Workspace/pos-cafe-docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Giữ dirty work có trước. Chỉ sửa reporter/fixture diagnostic và thêm5 regression tests; không đổi SQL nghiệp vụ hoặc UI. Fingerprint đầu `5f78d8692604e0a38d0b3be477a980d895cf268a4c6888d58cdb4fe6e9ed1bf2` (706paths), cuối **`d1a0e9ac8e6f941738e3325522e4f686bb606921e8ae162a0ce6a75b1bc1541e`** (707paths/705files/2deletions). Source có snapshot phục hồi gồm mọi file mới/test/locks; native frozen khớp Windows source.

**Kết quả source cuối:** identity42, images1+1variant, PINserver31, PINsurface44, TC44four variants, tooling34 và UI PIN9 đều PASS,0 required skip/retry/expected failure. Fixture được phục hồi và cleanup ảnh đạt trên baseline sạch cùng variant remnant được kiểm soát. **Nguyên nhân cụ thể của lần cleanup FAIL đầu vẫn chưa xác định**, không nhận thêm diagnostic là sửa được nguyên nhân lịch sử. Không đóng full T15/T16/PIN-T06/T17/T18 hoặc phát hành. Hai review độc lập theo [biên bản](../reviews/2026-10-08-permission-isolated-gates.md); approval slice không xóa FAIL lịch sử. [Bàn giao](../workflow/tasks/permission-isolated-gates-2026-10-08.md).

## Runtime và provenance

| Thành phần | Bằng chứng hiện hành |
| --- | --- |
| Distro/runtime | Ubuntu24.04 trong WSL; Node24.16.0 native Linux, Docker29.1.3; CLI Supabase2.117.0 pin đúng config fixture |
| Project | `pos-cafe-perm-t04-20260916`, API `http://127.0.0.1:59421`, PostgreSQL59422/database `postgres`; tất cả port publish thực tế ở loopback |
| Full stack | Proof12 required containers running/healthy; đúng label/project/config hash, volume DB dedicated, container IDs/image IDs được ghi. Health không thay test Realtime/Storage/Edge |
| Binding fixture | Marker/control khớp; engine `supabase-identity-v1`; đủ16 migration checksums; đúng2 store IDs và2 Auth IDs synthetic. Observer DB và REST identity binding đạt |
| Dependencies | Native Vitest4.1.11; tất cả direct dependency versions khớp `package-lock.json` hiện hành. Hash cả npm/pnpm locks trong report. Lượt Windows trước dùng Vitest4.1.10, không gộp thành cùng runtime profile |
| Source và env | Source cuối frozen `/var/tmp/pos-cafe-perm-t08-20260922/isolated-gates-20261008/source-diagnostics-01` (tên folder diagnostic nhưng bytes/fingerprint chính là candidate cuối); explicit fixture `IDEM_ENV_FILE`, không `.env*` app. Ba Edge mounted files không đổi và khớp current source; mounted source read-only |
| Lease | Root giữ execution tuần tự và cooperative `flock`; lease này không chặn mọi writer/API khác. Thời điểm ghi lease metadata không thay timestamp bắt đầu process thực tế |

Artifact Windows: [thư mục evidence](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/evidence). Native evidence trong `/var/tmp/pos-cafe-perm-t08-20260922/isolated-gates-20261008/evidence`. Raw output, fixture env/control, backup có credential hoặc dữ liệu nguyên trạng giữ trong private runtime, không copy vào docs/chat. Không dùng PAT hoặc login hosted cho test synthetic.

### Các vấn đề môi trường đã xử lý

1. Windows không có Docker/Supabase/psql trong PATH đã kiểm; dùng runtime WSL hiện hữu. WSL tự dừng giữa các call, khiến services quay lại trạng thái `starting`; Edge riêng đã exited. Root giữ WSL bằng process có lease, chỉ start đúng Edge của fixture; sau đó fresh full-runtime proof PASS. Không nâng CLI theo update notice.
2. `HostConfig.PortBindings` có HostIp rỗng, nhưng `NetworkSettings.Ports` thực tế là127.0.0.1. Guard hiện hành kiểm publish thực tế ([runtime:31](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:31)); report cấu trúc trước start được giữ riêng. Không sửa Docker daemon/global config. Không suy JWT deployment từ env metadata thiếu `VERIFY_JWT`; test ảnh kiểm HTTP thực tế.
3. Fixture JWT cũ được refresh bằng existing refresh token/control đúng marker, không chạy password fallback hay bootstrap/reset. [Refresh helper:131](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:131) được gọi sau readonly identity/checksum/tenant preflight. Test dùng fixture đã pin, không lấy env hosted.
4. Native Node chưa có trong default PATH; runner prepend đúng native bin. Native deps có sẵn, version từng direct package được đối chiếu lock thay vì dựa vào tên thư mục cũ. Frozen local clone thêm exclude riêng cho symlink `node_modules` để fingerprint không coi symlink là source file; không thay main hoặc global exclude.

## Ma trận kiểm thử source cuối `d1a0e9ac…`

| Lượt | Đã chạy / kết quả | Giới hạn |
| --- | --- | --- |
| Readiness | PASS12 services; marker/control,16checksums, API↔DB và legacy baseline | Health/config proof, chưa chứng minh mọi API/service behavior |
| Identity | **42/42 PASS**,0 fail/skip; no only/retry/expected failure, source trước/sau khớp, `reverted=true`, postflight legacy PASS | Focused identity contracts, không thay toàn identity-verify hoặc aggregate gate |
| Images clean | **1/1 PASS**, body và hook đạt; run reason passed/success true; fresh postflight legacy PASS | Real Storage/Edge lifecycle; không chứng minh profile hosted |
| Images remnant | **1/1 PASS**, gate/hàm compatibility tồn tại, strictfalse/hookABSENT trước test; sau cleanup legacy PASS | Variant kiểm soát để khảo sát lỗi với baseline tồn tại gate; không phục dựng exact baseline đầu đã mất TEMP |
| PIN server | **31/31 PASS** gồm22 behavioral SQL và9 static SQL;0 fail/skip, cleanup legacy PASS | Không nhận9 static thành9 SQL executions |
| PIN surface | **44/44 PASS** gồm42 RPC restricted authority, inventory và raw ACL; cleanup legacy PASS | Chỉ đúng profile fixture đã pin |
| TC44 | **4/4 PASS**, seed/clear × financial_first/bulk_first; cleanup legacy PASS | Không thay toàn financial/concurrency gate |
| Reporter/evidence tooling | **34/34 PASS** ở3 files, gồm5 regression mới;0 fail/skip/errors | Offline tooling; không phải service behavior |
| Owner PIN browser | **9/9 PASS**, exit0/no skip/retry, actual Chromium1366×768 trên Supabase fixture | Lost ACK/create/Key retention/reload/forced-PIN/initial-seed; không screenshot/trace/video secret. Hậu kiểm candidate riêng PASS; không thay full UI audit/all browsers |

Command/UTC/options trong `evidence-diagnostics-01/*-execution.json`, `*-discovery/results/options.json` và `dependencies.json`; remnant riêng `evidence-remnant-01`. Vitest dùng `run --config <config> --allowOnly=false --retry=0 --passWithNoTests=false --reporter=./scripts/permission-vitest-reporter.mjs`. Playwright dùng `test --config playwright.owner-pin-onboarding.config.ts --workers=1 --retries=0 --forbid-only`, custom safe reporter và actual-options reporter. Runner artifact nằm ngoài fingerprint ứng dụng nhưng được pin/snapshot riêng trong candidate review. Native lock versions khớp cả gate cuối.

Lịch sử source5f: readiness/identity42 và PINstatic9 PASS; images body1passed/runfailed/wrapperexit1/phase mismatch. Giữ trong `evidence/`, không ghép các số đó với source cuối để tạo full PASS.

**Lỗ hổng receipt của lượt ảnh đầu:** artifact runner gọi postflight rồi mới ghi receipt; khi postflight throw, không giữ child status/signal/start/end. Incident ghi discovery/test-process exit/times **unknown/null**, wrapperexit1 lấy từ tool output. Discovery/result JSON giữ nguyên. Root sửa artifact helper để ghi receipt cả khi postflight lỗi; gate sau có measured receipts. Không nhận file helper đã sửa là exact snapshot của helper trước sửa.

**Đính chính metadata:** `readiness.json` và before/after của `identity-execution.json` từng đặt project string vào field `storeIds`. Giữ original reports, ghi erratum trong `images-incident.json`; UUID đúng được kiểm độc lập trong `fixture-readonly-preflight.json` và incident. Sửa field helper cho execution sau, không đổi report lịch sử hoặc source ứng dụng.

## Incident lịch sử: cleanup ảnh chưa hoàn tất

[Image test:45](D:/Workspace/pos-cafe/tests/contracts/permissionImagesRuntime.contract.test.ts:45) thực thi Storage/Edge thật: upload/staging bytes, direct-storage deny, public serving/ETag304, quyền trước304, withdrawal/delete, method/unauth/cache và atomic menu changes. Body đạt; afterAll không làm run đạt. Fresh readonly postflight cho thấy role vẫn `text`, `permission_revision` còn, view `history_entries` còn; image registry/functions đã biến mất, gate contract2/strict=false. Không có pending locks, idle-in-transaction hoặc prepared transaction tại incident snapshot; đúng2 stores/2 Auth users vẫn còn.

[Cleanup:260](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:260) chia pha compatibility → owned Storage → database surface → read/identity. Catch gom category và bỏ cause; bốn checksum mismatch ở [282](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:282) dùng bare Error. Có lỗi ở pha trước thì [290](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:290) không gọi read cleanup. Đây là cơ chế giải thích được trạng thái bridge còn sót; **chưa xác định câu SQL hoặc checksum gây lỗi thực tế**.

[Reporter:5](D:/Workspace/pos-cafe/scripts/permission-vitest-reporter.mjs:5) bỏ failure messages/stacks/diffs để bảo vệ secret, đồng thời không ghi module/hook error codes. Raw log chỉ789bytes, bộ lọc code/location cho phép không thu được lỗi cleanup; không mở raw lên model. Vì thế cần thêm diagnostic có whitelist, không bật raw JSON error output hoặc hạ assertion.

Baseline business/ACL/function được giữ trong biến worker và TEMP tables ([read fixture:30](D:/Workspace/pos-cafe/tests/contracts/permissionReadFixture.ts:30)); worker đã thoát nên baseline ấy không phục hồi được bằng gọi helper lần nữa. Comment bounded retry [288](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:288) chỉ đúng khi worker/session gốc còn sống. Không dựng baseline giả rồi nhận cleanup thành công.

Giả thuyết GET sentinel làm đổi `last_accessed_at` được khảo sát vì capture metadata trước GET ([146](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:146)). Timestamps vẫn ở28/09; fresh hai lần đọc bytes cho thấy metadata không đổi. **Không dùng giả thuyết này làm nguyên nhân thực tế**.

## Preservation, phục hồi được duyệt và diagnostic

- Incident readonly proof giữ runtime/control/checksums/marker hash, tenant/Auth IDs, phase, relation counts và current Storage metadata+bytes. Bản đầu có whole-row integrity hashes; trước freeze đã chuyển original vào private và xuất projection counts, có `projectionCorrection`, không silently thay số đo. Future helper chỉ đếm rows. Có6 objects:4 staging có từ28/09 và2 restore sentinel. Current byte proof không thay baseline hash trước test chưa được reporter lưu.
- DB custom dump và roles backup ở private `incident-v2`, mode0600/directory0700; TOC parse bằng `pg_restore` cùng container PASS. Lần backup đầu đã tạo file nhưng dùng host pg_restore khác major không hoàn tất kiểm TOC; giữ riêng `private/incident`, không nhận lượt đầu PASS. Chỉ kiểm TOC, **chưa rehearsal restore**.
- Đã backup đủ6 file Storage,814.861 bytes, mapping tên thật ở private; public receipt chỉ hashed names/content hashes. Fresh bytes khớp incident, metadata không đổi. DB dump riêng không bao gồm Storage object bytes; không gọi nó backup đầy đủ Storage.
- Backup hiện tại giữ **trạng thái thất bại**, không phải baseline legacy trước test. Nó giúp bảo toàn incident, không chứng minh có thể undo cleanup để đạt legacy. Không xóa Storage metadata hoặc object có trước.

**Quyết định IGR-D01 (08/10, user chốt trực tiếp):** phục hồi fixture và thêm diagnostic, giữ Storage, kiểm lại auto/UI. Root kiểm backup hashes/lease/runtime/control/checksums/exact2 store/Auth/khóa trước [reset:27](D:/Workspace/pos-cafe/scripts/permission-reset-fixture.mjs:27); helper có drop public/private cascade và xóa hai Auth fixture ([73](D:/Workspace/pos-cafe/scripts/permission-reset-fixture.mjs:73)). Output mới ở native private `fixture-restored-01`700/env+control600, marker mới/control mới được kiểm. Không gọi lại reset sau đó.

Reset wrapper lượt1 refuse trước mutation vì so byte-proof JSON khác thứ tự field; sửa so cùng cấu trúc rồi lượt2 reset/bootstrap thành công nhưng hậu kiểm báo policy drift. Metadata/bytes/constraints Storage vẫn khớp; migration005 tái tạo4 policy legacy. Root recheck marker/legacy/exact policy names trước transaction, drop chỉ4 policy vừa tạo để trở về baseline policy rỗng; hash policy/metadata và6bytes lại khớp. Giữ `fixture-reset-01/02.json` BLOCKED và `storage-policy-restored.json` PASS riêng, không ghi đè để gọi wrapperreset PASS.

**Implementation:** [fixture:260](D:/Workspace/pos-cafe/tests/contracts/permissionImagesFixture.ts:260) giữ nguyên trình tự/điều kiện cleanup và mọi fingerprint assertion, thêm mã phân biệt4 mismatch, phase/substep và SQLSTATE whitelist. [Reporter:5](D:/Workspace/pos-cafe/scripts/permission-vitest-reporter.mjs:5) dùng vocabulary hữu hạn, lấy module/nested-suite hook errors thay vì chỉ unhandled list; không serialize raw message/stack/cause/query/row/unknown fields, hookerror luôn làm successfalse. [Regression:17](D:/Workspace/pos-cafe/tests/contracts/permissionReporter.tool.test.ts:17) kiểm bodyPASS/cleanupFAIL, nestedhook, reason, secret redaction và malformed errors. Builder Windows standalone5/5 PASS; root native3files34/34 gồm kiểm verifier cũ.

Tái hiện sau recovery: clean variant PASS; thêm controlled `prepareCompatibilityHook → restoreCompatibilityPreparation`, để lại gate/functions strictfalse nhưng role settingABSENT, rồi remnant variant PASS. Không tìm được semantic cleanup bug để sửa, không thay SQL/hạ assertion. Known defect đã sửa là reporter/diagnostic không cho biết hook cause; root cause của lần lỗi đầu vẫn unknown. Backup legacy trước remnant probe giữ private; không nhận variant là exact reconstruction hoặc backup restore rehearsal.

Sau phục hồi chạy images clean → identity → PINserver → PINsurface → remnant images → TC44 → owner-PIN browser cuối, tất cả trên cùng frozen d1. Mỗi service suite trước browser đều legacy postflight PASS. Browser global setup activate full candidate; per-test cleanup xóa own Auth/store graph và restore sequence, không đưa schema về legacy. Trạng thái cuối **activated candidate**, stricttrue/contract2, đúng2store/2Auth, không pending/prepared/idle transaction,6bytes Storage khớp.

UI wrapper đầu hậu kiểm bằng `assertBridgeFixture` gọi fixture identity **không marker** nên lỗi `API_OBSERVER_BINDING_MISMATCH` sau9/9 testpass/exit0. Không nới legacy guard. Giữ receipt wrapperexit1; fresh `candidate-postflight.json` kiểm runtime/control/16checksums/IDs/phase và RPC `permission_get_store_session` có marker2→200/storeId đúng/hookstrict, thiếu marker→426. Đây là guard hậu kiểm đúng phase, không rerun9 UI hoặc thay application để xanh. Chỉ dùng kết hợp test/browser-options và fresh postflight này cho PASS scope UI.

UI audit FAIL33 của slice trước giữ nguyên; không sửa UI/baseline hoặc nhận UI sạch. Full source-wide aggregate, Realtime two-client, controller/release/provider/backup rehearsal/live T17/T18 còn scope tiếp theo. Không ghép focused proofs thành gate tổng.

### Nguyên liệu cho rubric/bảo vệ

Bài toán: bộ test bảo mật phải kiểm cả tác dụng chính lẫn hoàn tác dữ liệu, gắn source/dependencies/fixture thật và quản lý secrets trong evidence. Quyết định: tách body pass khỏi gate pass; giữ incident trước recovery; chỉ diagnostic code có whitelist; giữ backup DB và bytes Storage riêng; stop suites phụ thuộc khi fixture lệch. Hệ quả: mất TEMP session làm recovery khó hơn và chi phí kiểm tăng; cần kế hoạch fixture có baseline bền vững để nghiên cứu tiếp. Đây là hạn chế phương pháp/harness đã quan sát, chưa là kết luận lỗi nghiệp vụ sản phẩm hoặc phát hành.

Subagent: Luna/medium inventory runtime; Sol/high recipe gates và Sol/high điều tra cleanup; reviewer không tham gia viết, hai scope runtime/safety và evidence/docs. Walkthrough source đường test → fixture → cleanup/reporter đã cung cấp ở các mục trên; owner chưa xác nhận đã hiểu hoặc nghiệm thu. Chưa commit/push/deploy, không cần session mới chỉ để tiếp tục scope này.
