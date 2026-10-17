# Backup v2 — contract đã chấp nhận, 14/10/2026

Nguồn quyết định [BACKUP-AB-14](../workflow/tasks/permission-backup-v2-2026-10-14.md). Tài liệu này là phần chi tiết normative được PERM-06/30, design8.2.1 và TC53 tham chiếu. Không đổi forced-PIN,60TC/19PIN. Các options13/14Oct trước quyết định vẫn là PROPOSED lịch sử; contract này là successor đã chấp nhận.

## Đầu vào và đầu ra

| Trường | Kiểu/ràng buộc |
| --- | --- |
| schemaVersion/kind | integer2 / `permission-logical-backup`; version khác không được ép thành2 |
| target | LOCAL Docker ID64hex, exact image digest, owned instance UUID/volume/label; network none, no ports, socket only; trước mọi mutation kiểm lại identity |
| roots | output mới không tồn tại, private ACL current Windows user+SYSTEM hoặc Linux0700/0600; raw rows/Auth/roles/DSN chỉ ở đây |
| scope | approved79 UUID = original77+approved2 qua private approval SHA362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8; fixture có contract synthetic riêng, không đại diện hosted UUID |
| source/method/environment | SHA25664lowerhex của source snapshot, helper+SQL recipe, runtime/config/fixture/image, archive/TOC/extraction; đầy đủ references pin trước nhận report |
| consumer contract | `closed-world-local-v1`, source/catalog/fixture/client-method hashes; explicit one consumer per sequence, all ingress/functions/triggers declared controlled; caller catalog scan không đủ chứng minh exhaustive |
| archiveFidelity | PASS/FAIL/BLOCKED tính từ exact mandatory check identities và raw input digests, không tin status caller |
| allocationSafety | PASS/FAIL/BLOCKED riêng, contract unknown/shared/cache>1/cycle/uncertified provider trả BLOCKED |
| concurrencyObservations | per-query before/after bounds, archive interval, values/is_called; diagnostic, không gán quiescence từ equality endpoints |
| catalogProvenance | snapshot identity + separate role/catalog capture window; stable before/after chỉ là detection, không tự cấp maintenance |
| storageCaptureBoundary/status | metadata DB và bytes/API clone tách;3objects exact identity/version/hash/size/MIME; không supported global control thì BLOCKED |
| coverageComplete/cleanupEligible/executionReady | boolean, false nếu bất kỳ required allocation/Storage/C/provider proof thiếu; B/I PASS riêng không đổi chúng |

## B/I — fidelity

SHALL export một snapshot RR READ ONLY và giữ exporter sống tới mọi importer/dump hoàn tất. Custom pg_dump và mọi table/catalog/LO digest SHALL import đúng token, canonical full rows bằng ONLY, UTF8/UTC/ISO/C ordering, không counts-only. Inventory động gồm partition roots/leaves, extconfig+condition, sequence definitions/dependencies/defaults/identity, triggers/functions, constraints, roles/memberships/ACL, database/extensions/LO. Foreign/unsupported content và extension-owned table ngoài extconfig không có archive data SHALL bị từ chối, không tự bỏ khỏi coverage.

TOC từ đúng archive, whitelist SEQUENCE SET, extract text bằng pg_restore list rồi parse mà không execute SQL. Exact sequence identity set, duplicate/missing/extra/unknown statement/is_called và integer ngoài signed64 SHALL bị từ chối; BigInt giữ >2^53. Sequence trước/sau nằm ngoài snapshot chỉ diagnostic; không setval để tạo PASS. Restore archive trên target mới/trống guarded, giữ clone pristine; so toàn table/catalog/LO/roles/ACL và archive value/is_called. Một failure/required skip/nonzero restore chặn fidelity.

## Allocation và C/L

Contract LOCAL hẹp là lựa chọn kỹ thuật trong scope được giao. Catalog pin không chứng minh arbitrary client/dynamic SQL consumers. Unknown provenance hoặc profile provider chưa chứng nhận SHALL BLOCKED. Supported contract phải bind catalog/source/fixture/control method, exact consumers+column/cast, explicit-ID extrema, sequence type/start/min/max/increment/cache/cycle/is_called. Dùng BigInt kiểm next trong sequence và consumer ranges, direction extrema và collision; không nhận lý luận “giá trị lớn hơn an toàn”. Actual nextval chỉ trên disposable clone khác pristine, kết quả phải bằng oracle; nguyên trạng clone fidelity được recheck sau probe.

C vẫn khóa đúng dependency closure và storage.objects, kiểm full rows including Auth ngoài66, catalog/roles/DDL và trạng thái sau backup, không đòi full64/provider-sequence freeze chỉ để B/I. Knonempty làm empty-target cleanup không hợp lệ; FK23503 rollback là bảo vệ, không xóa ledger/tắt trigger/bypass/rewrite K. Quyền thật của execution actor trên authenticator và storage.objects policies bắt buộc; local superuser không chứng minh hosted capability. L giữ assessor hiện hành: writesQuiesced và complete fresh state equality, có Q sau backup thì forward-fix/reconcile, không tự live restore.

## Storage và adapter

Runtime pin14Oct không có effective immutable version read/retention/IfMatch delete. SHALL từ chối các control claims này bằng code `BACKUP_V2_STORAGE_UNSUPPORTED`, kể cả HTTP200. Control hợp lệ tương lai phải phủ standard/TUS/S3/direct API, admitted upload và background workers, giữ ổn định từ capture tới delete/reconcile. Gateway-only không đủ. DB metadata restore khác API payload clone; không claim atomicDB+Storage/PITR. Chưa có provider receipt thì planner/controller luôn BLOCKED.

Loader SHALL dispatch v2 tường minh, đọc lại pinned inputs và recompute verdict/mandatory set; reject schema/hash/source/environment mismatch, status forgery, missing/extra/duplicate/truncated checks. Raw input provenance và exact external manifest SHA là trust anchor, không coi arbitrary self-hashed JSON là chứng thực provider. Old helper/manifest/reports giữ version cũ và kết quả74/75FAIL; không có all-format shim hoặc retroPASS.

## TC53-V2 — matrix khóa trước implementation

Mọi nhóm là subcase TC53, UC14, PERM06/30; không tăng số TC.

| ID / nhóm | Các bước / expected |
| --- | --- |
| V2-MAIN / chính | Fresh35/63 fixture → snapshot → writer commit/default/abort/nextval → dump/restore → full rows/catalog/LO/archive seq PASS; live sequence có thể đổi; probe clone riêng |
| V2-PROOF / security | Sửa status, cắt/thêm/trùng check, sai schema/hash/method/source/target hoặc ghép input khác → `BACKUP_V2_PROOF_INVALID` trước DB/controller mutation |
| V2-SNAP / lỗi | Exporter đóng/missing importer, schema/inventory drift, archive truncated/corrupt → `BACKUP_V2_SESSION_EOF`, `BACKUP_V2_SNAPSHOT_DRIFT`, `BACKUP_V2_CATALOG_WINDOW_DRIFT`, `BACKUP_V2_COMMAND_FAILED` hoặc `BACKUP_V2_COVERAGE` tùy bước; luôn không PASS |
| V2-TOC / biên | Missing/extra/duplicate sequence, malformed SQL/is_called, ±signed64 bounds và9007199254740993 → đúng BigInt hoặc `BACKUP_V2_SEQUENCE_PARSE`; không execute SQL |
| V2-ROW / lỗi | Đổi1value giữ count, partition/LO bytes/ACL/catalog/role/default/extension → fidelity FAIL hoặc từ chối coverage (`BACKUP_V2_EXTENSION_CONTENT_UNSUPPORTED` cho extension-owned nonconfig), preserve attempt; empty new target mới được restore |
| V2-ALLOC / biên/quyền | is_called true/false, increment+/−, explicit IDs/collision/extrema/cast/overflow; unknown/shared/cache/cycle → FAIL/BLOCKED; không setval chữa; clone pristine unchanged |
| V2-STORAGE / security | version/retention/IfMatch/gateway-only claims → unsupported/BLOCKED;3 payload local useful không suy globalcontrol |
| V2-C-L / security | B/I PASS nhưng thiếu C/Storage/provider/allocation → loader blocked; full-row checker và live assessor không yếu; Knonempty giữ rollback protection |
| V2-REG / hồi quy | Source snapshot mới gồm code/tests/specrefs/deletion markers; configured npm tools/unit/build; full PIN19/PERM60 theo gate source cuối, không tổng hợp mixedsource PASS |

## Planner phase2 kế tiếp

1. B/I có thể chạy logical capture khi snapshot/coverage/privilege đáp ứng; capture failure giữ immutable diagnostics.
2. C cần actual closure drain, full Auth preservation, catalog/roles/DDL control và actor capability; không mặc định freeze global64 hay Auth/Realtime sequence chỉ vì dump.
3. Storage cần supported global mutation control+drain hoặc immutable version retention đã chứng minh. Hiện thiếu.
4. L độc lập, không backup PASS nào cấp live restore.

`executionReady=false`, `cleanupEligible=false` cho phase2 hiện tại; không đặt duration/window hay hosted command. Owner đã giao hoàn thiện LOCAL rồi báo/dừng.7 dependency issues và release review vẫn chặn độc lập.

## Hợp đồng lỗi CLI và cách chạy LOCAL

Các mã sau là lỗi công cụ (không thêm AppError/UI): BACKUP_V2_EXPLICIT_CONFIG_REQUIRED, BACKUP_V2_CONFIG_INVALID, BACKUP_V2_INPUT_HASH, BACKUP_V2_PRIVATE_ROOT, BACKUP_V2_TARGET_GUARD, BACKUP_V2_IDENTIFIER_UNSUPPORTED, BACKUP_V2_PATH, BACKUP_V2_OUTPUT_EXISTS_OR_UNSAFE, BACKUP_V2_COMMAND_FAILED, BACKUP_V2_SESSION_STATE, BACKUP_V2_SESSION_EOF, BACKUP_V2_SESSION_TIMEOUT, BACKUP_V2_SNAPSHOT_INVALID, BACKUP_V2_SNAPSHOT_DRIFT, BACKUP_V2_CATALOG_WINDOW_DRIFT, BACKUP_V2_CONTENT_UNSUPPORTED, BACKUP_V2_EXTENSION_CONTENT_UNSUPPORTED, BACKUP_V2_NONEMPTY_TARGET, BACKUP_V2_PROBE_BASELINE_DRIFT, BACKUP_V2_CONSUMER_CONTRACT_REQUIRED, BACKUP_V2_CONSUMER_CATALOG_DRIFT, BACKUP_V2_SCOPE_INVALID, BACKUP_V2_SEQUENCE_PARSE, BACKUP_V2_COVERAGE, BACKUP_V2_PROOF_INVALID, BACKUP_V2_STORAGE_UNSUPPORTED, BACKUP_V2_STORAGE_SCOPE, BACKUP_V2_STORAGE_PAYLOAD, BACKUP_V2_STORAGE_DRIFT, BACKUP_V2_STORAGE_CLONE, BACKUP_V2_ARCHIVE_FAILED, BACKUP_V2_CUTOVER_BLOCKED và BACKUP_V2_CUTOVER_ADAPTER_UNSUPPORTED. CLI chỉ in mã; raw exception/SQL/credential nằm private. Unknown failure ghi BACKUP_V2_CAPTURE_FAILED và exit1, không retry tới PASS.

`node scripts/permission-backup-v2.mjs --config <private-config.json>` chỉ nhận LOCAL synthetic profile; config có source ID/image/volume/namespace, privateRoot/output mới, sourceSnapshot/path+SHA, fixture/diversity/path+SHA, scopeApproval/path+SHA cố định, consumerApproval/path+SHA được lập trước capture, consumers exact sequence/table/column/cast, tùy chọn storageCapture/path+SHA. Consumer approval bind source ID, source fingerprint, method SHA, fixture+diversity SHA, catalog SHA và explicit closed-world contract; provider contract chưa hỗ trợ. sourceFingerprint của envelope v2 LOCAL là SHA manifest source, ghi tách với permissionFingerprint của aggregate tests. CLI không dựng hosted connector hoặc tạo quyền window.

Tái hiện fixture có guard: `node tests/contracts/backup-v2/local-run.mjs <private-run-config.json>`; Storage: `node tests/contracts/backup-v2/storage-run.mjs <private-run-config.json>`. Luôn roots/namespace mới, private ACL hoặc0700, pinned fixture/schema/roles/image và source/dependency snapshot. Runner tự tạo target mới và stop exact-owned, giữ volume. Lượt Storage trả report có payload base64 chỉ private, descriptor id/bucket/path/version/hash/size/MIME và clone readback checks; database original metadata nằm trong B/I archive riêng. Dù clone PASS, control=null và eligibilityfalse. Không dùng lại script trong artifact cũ để ghi đè receipt.

So sánh schema SQL toàn phần bổ sung các digest catalog có cấu trúc: source schema-only dump dùng cùng exported snapshot, so clone schema-only dump trên cùng image. Dùng cùng binary/flags và cùng restrict key ngẫu nhiên32bytes cho hai schema dumps trong một lượt, so nguyên SQL text (kể cả framing), không lọc dòng SQL. Giữ DDL/options/COMMENT ON/ACL và nội dung multiline literal. Thiếu check này hoặc giả PASS trong khi SQL khác phải bị loader từ chối.

## Lượt đọc code đề nghị cho owner

1. [runLogicalBackupV2](D:/Workspace/pos-cafe/scripts/permission-backup-v2.mjs:12): theo exporter → inventory/dump cùng snapshot → pristine restore → allocation clone riêng. Điểm cần giải thích: vì sao sequence trước/sau đổi vẫn có thể B/I PASS.
2. [deriveBackupV2Report](D:/Workspace/pos-cafe/scripts/permission-backup-v2-core.mjs:124) và [readBackupV2](D:/Workspace/pos-cafe/scripts/permission-backup-v2-core.mjs:204): report được tính lại từ graph pin; status sửa tay không tạo quyền. [requireBackupV2Cutover](D:/Workspace/pos-cafe/scripts/permission-backup-v2-core.mjs:221) giữ C chặn dù fidelity PASS.
3. [planBackupV2](D:/Workspace/pos-cafe/scripts/permission-backup-v2-plan.mjs:5), [captureStorageV2](D:/Workspace/pos-cafe/scripts/permission-backup-v2-storage.mjs:4) và các test TC53-V2: EXACT79/66/2+1 khác synthetic fixture, payload clone khác global control; L giữ assessor độc lập.

Trạng thái walkthrough: đã chuẩn bị/cung cấp đường đọc, chờ owner; chưa có xác nhận đã đọc hoặc hiểu. Không có bước hosted tiếp theo trong task này.




### SEC-01 — oracle globals đã kiểm LOCAL (14/10/2026, chờ review)

Candidate01/source39 bị SEC yêu cầu sửa: projection roles thiếu expiration/comment/security labels. Source40 đã bổ sung `rolvaliduntil`, shared comment/security-label catalog, cùng bốn bản `pg_dumpall --roles-only --no-role-passwords` từ source trước capture, source cuối cửa sổ, pristine và allocation clone. Cùng binary/flags/restrict-key ngẫu nhiên cho một run; so toàn văn, không bỏ dòng. Mọi artifact/command được pin và loader tự recompute ba check bắt buộc `catalog:complete-roles`, `catalog:probe-roles`, `catalog:roles-window`. Cửa sổ source lệch phải refuse `BACKUP_V2_CATALOG_WINDOW_DRIFT`. Password vẫn ngoài profile đã ghi; không suy ra hosted global actor control. Positive fixture có expiration/comment; negative sửa riêng từng thuộc tính trên clone mới và trong source window, cộng forged PASS proof. Đây là sửa completeness trong phạm vi backup được ủy quyền, không đổi nghiệp vụ hoặc mở phase2. Source39 và candidate01 giữ nguyên, không tái gán PASS.
