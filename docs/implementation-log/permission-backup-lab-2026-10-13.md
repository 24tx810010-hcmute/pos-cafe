# Diễn tập local backup H1/H2/H3 — 13/10/2026

**Gói bằng chứng local, chưa đủ đóng toàn bộ bước2.** H1 chứng minh tính khả thi của online logical capture trong profile đã thử; H2 và H3 có phản ví dụ thật và còn BLOCKED. Matrix toàn bộ nghĩa vụ giữ `coverageComplete=false`, `eligibility=false`. Không owner acceptance cho tiêu chí mới, không hosted execution/window, không thay strict backup cũ **74/75 FAIL**. Release vẫn BLOCKED, gồm 7 vấn đề upstream chưa được nhận rủi ro.

## Phạm vi và đầu vào

Nguồn giao việc/handoff: [task](../workflow/tasks/permission-backup-lab-2026-10-13.md). [Proposal A–F](../runbooks/permission-backup-step2-proposal-2026-10-13.md) được đọc trước thực hiện. Mỗi harness có assertions trước khi chạy nhóm đó; consolidated matrix được tạo **sau** kết quả, không phải whole-matrix đã khóa trước run như brief đề nghị. Đây là thiếu sót quy trình được giữ công khai, không coi index hồi tố là pre-run manifest.

Public root `D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261013/`; private root `C:/Users/nguye/AppData/Local/pos-cafe-release/backup-lab-20261013/`, ACL current-user+SYSTEM. `inputs.json` khóa audit candidate02 SHA `05d906c8157b5f914017f94b5b55a62aec0043a2d805f79503131adb78e526c2`, source34, schema/dump/roles và scope79 approval. Old private inputs không đổi.

Không nạp table data của archive hosted. `pg_restore --schema-only` dựng đầy đủ schema archive: **64 relations, 63 dumpable TABLE DATA**, đúng partition root `realtime.messages`, 5 extensions đúng version, nguyên roles/memberships/ACL. Synthetic seed: **79 stores, 145 Auth, 66 outside, 3 Storage metadata, 1 payment+K/R1 trước snapshot**, thêm payment+K/R1 sau snapshot. UUID `71000000…` và nội dung `synthetic` không phải approved live IDs. Original77+approved2 chỉ được hash-bind, không ánh xạ giả sang synthetic IDs.

Fixture K/R1/receipt có payload/amount/receipt cụ thể và qua schema constraints; được nạp bằng transaction SQL local, **không chạy production payment RPC**, không nhận là proof nghiệp vụ ứng dụng. Tránh nói đây là tập dữ liệu hosted 79/145 thật.

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, shared dirty. Source34 có 2 drift ở hai file `useRealtimeInvalidation` lúc bắt đầu và final-checks; không sửa chúng. Không chạy lại unit/tooling/browser của source34 để gán cho harness mới. Không sửa app/test/config/locks/canonical verifier/normative spec/proof cũ; không stage/commit/push/deploy.

## Runtime và provenance

DB image ID `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`, PG/tools 17.6, binary hashes trong `final-checks.json`. Mỗi DB target mới có instance UUID, exact container ID/volume label, network none, không publish port/bind host, socket `/lab`, không preload workers. Restore/bootstrap dùng `lab_restore` superuser **chỉ local**. Operator `postgres` NOSUPERUSER/BYPASSRLS; flags và privileges/owners của cả64 match observation đã khóa. Thêm actor local không chứng minh hosted restore privilege.

Windows Node v24.16.0 SHA `b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3`. Không install dependencies hoặc đụng shared node_modules. Storage image ID `sha256:105a2584129c9600aebed6f5ac49ca4371c92b996ecd1af7179750333e9e2120` có tag local v1.72.1, nhưng `/app/package.json` khai version **1.11.2**, Node bên trong **v24.20.0**, AWS SDK **3.1023.0**. Báo cả discrepancy, dùng image hash/lock hash để định danh, không tự đồng nhất package version với tag hoặc hosted binary.

Storage API/file backend/DB là target mới riêng: API share namespace network-none của DB, HTTP `127.0.0.1:5000` chỉ gọi qua docker exec; không port host và không egress. Synthetic JWT/S3 keys mới ở private root, không ingress hosted credentials. DB Storage chỉ là bootstrap standalone của API, không match toàn provider profile. Metadata/API replica ở target khác với H1 DB restore: **không có atomic snapshot DB+Storage**.

`commands-*.jsonl` private ghi UTC start/end, argv, input hash, stdout/stderr/exit; `sessions-*.jsonl` ghi SQL session. Public receipts ghi hash/count/status, không đưa Auth/PIN/token thật ra báo cáo. Pg_dump/import dùng token thật, public chỉ token hash. Raw archive sequence extraction không được execute để parse.

## H1 — đã quan sát gì

`h1-run-1791906919936.json`: 15 assertions đạt trong run cơ chế chính. `capture.json` ghi snapshot/data baseline, dump interval **15:54:26.601–15:54:27.043 UTC**, archive SHA `e851e7f36a9b8f6a467ac28093f19dc200ec070ebf38dede5f229a6eeb4af18f`, 657664 bytes.

Auth sequence **before327 / archive334 / after389**. Default INSERT, aborted INSERT và standalone nextval thực thi trong khoảng snapshot→capture; exporter RR READ ONLY giữ mở, pg_dump và mọi canonical row/catalog importer dùng cùng token. Query lại với token vẫn cùng rows; sequence là diagnostic ngoài MVCC. Không suy sequence archive bằng after hoặc biết chính xác thời điểm đọc nó trong interval.

Actual pg_restore trên target proof mới khớp **63 full-row tables + 7 metadata digests + 8 catalog groups = 78 identity checks**, cùng archive `last_value,is_called` của3sequence. Catalog bổ sung constraints, columns/defaults, partition, roles/membership, DB và extension inventories. Large-object inventory của fixture trống, không chứng minh case LO có payload. Không loại provider migration/vector tables cho qua gate.

Allocation: BigInt, range/type/increment/min/max/cache/cycle, known consumers Auth ID/realtime ID/public store_no integer. Actual nextval trên **clone probe riêng** khớp oracle; proof clone không bị consume, kiểm lại cuối phiên vẫn khớp. **Giới hạn:** consumer mapping được viết rõ cho schema này; chưa có thuật toán chứng minh mọi dynamic-SQL/function/unknown consumer. Reject shared/unknown/cache profile trong oracle chỉ là fail-closed unit semantics, không phải exhaustive catalog discovery hoặc hosted cached-session drain.

`additional-1791908046036.json` có nhánh ổn định: dump/restore mới đầy đủ, before=after và rows/catalog khớp; sau đó clone stable mới bị cố ý đổi sequence phục vụ negative. Không dùng clone đã fault làm proof pristine. Source/proof gốc vẫn nguyên evidence trước fault.

`negatives-1791907120805.json`: 36 assertions đạt, gồm EOF/timeout/import missing; TOC provider-table omission; corrupt/truncated decode; same count nhưng K/payload/R1/receipt đổi; duplicate/missing/invalid sequence SQL; reset/is_called false collision, overflow, cycle, explicit IDs, shared/unknown consumer, integer cast, cached sessions; BigInt >2^53 và decreasing profile. Các oracle-only cases được phân biệt với actual PG collision/overflow/cache/decreasing witnesses. ABA nextval+setval ở **probe fixture** cho endpoints bằng nhau dù đã có activity; không sửa capture/proof sequence cho PASS.

`restore-fault.json` là TOC-read rejection (`pg_restore -l`), không phải data restore. `restore-data-fault.json` giữ TOC và cắt cuối archive: actual `pg_restore --use-list=/lab/remainder.list ... -d postgres` đã chạy và exit1 EOF; target partial vĩnh viễn ineligible. Mismatched input/container và shadow exact mandatory-set guard bị chặn. Shadow guard là support thử nghiệm, không adapter canonical hay proof authority từ JSON.

K/Q: source sau snapshot có2 payment/K, proof có1; full rows khác bị phát hiện. `assessor-results.json`: 5 assertions bằng **nguyên thân hàm canonical source34** `captureSnapshot/snapshotsEqual/assessPermissionRestore`, trích đoạn hash-bound với adapter SQL vào PG thật. Stale state, writesQuiesced=false, forged serialized observer và hidden R1 thay đổi đều BLOCKED; equal actual observations chỉ `OPERATOR_REVIEW_REQUIRED`. Không chạy full canonical loader/controller, không actual live restore/reconcile hoặc nhãn “safe to restore”. Canonical nguồn: `scripts/permission-restore-assessment.mjs:6–9`, `scripts/permission-preflight-core.mjs:56–80`.

**Kết luận H1:** bác bỏ mệnh đề “sequence tăng luôn làm hỏng logical archive”; khả thi trong profile thực nghiệm. Chưa đủ nhận helper/version/gate tổng quát hoặc toàn bộ H1 obligations PASS.

## H2 — phản ví dụ và giới hạn

`h2-1791907476316.json`: 17 assertions, 16 đạt, 1 kỳ vọng mã lỗi sai được giữ FAIL. Scoped33closure+storage.objects cho reader dump chạy; Auth update của outside66 bị khóa; READ COMMITTED sau chờ thấy commit mới và full-row recheck phát hiện drift. Sequence nextval độc lập vẫn tăng qua rollback. Fragment error/EOF/statement timeout rollback rows+DDL trong shadow TX; transaction deadline tự giải phóng lock. Commit ACK deliberately unobserved → UNKNOWN → query độc lập xác nhận commit; **không giả network packet loss thực**.

Legacy bootstrap được admit bằng authenticated trước revoke, chờ advisory rồi table lock, vẫn tạo store sau shadow cutover commit/revoke. Đây là actual `public.bootstrap_store`, chỉ đọc trường `ok`, không publish PIN. Cần drain inflight; revoke EXECUTE không đủ. 5 provider SHARE denials vẫn xảy ra; không grant workaround. FK mới và partition detach làm catalog drift. Outside66 exact identities được kiểm **trước** ca cố ý bootstrap outside ID145; fixture sau ca đó có80stores/65outside, không nhận final target vẫn79/66.

K nonempty: `h2-cleanup-followup.json` chạy đúng ba DELETE theo canonical `permission-release-cutover.mjs:484–486`; FK **write_operations_store_id_fkey**, SQLSTATE23503, chặn delete store còn ledger. Full-row rollback giữ nguyên. Kỳ vọng ban đầu P0001/immutable trigger là sai; follow-up xác định FK chặn trước trigger. Không vô hiệu hóa constraint/trigger để ép cleanup PASS. Đây là fail-closed trên synthetic K, không khẳng định hosted hiện có K hoặc kết luận phải xóa ledger. Archive hosted cũ K0 vẫn chỉ historical.

Chưa chạy positive exact79 cleanup + **production activation** trên fixture K nonempty. Shadow DDL không thay production fragments/provider controls. Khi cleanup precondition đã thất bại, không có cơ sở thử tiếp bằng cách nới gate. C vẫn BLOCKED; cần cơ chế drain/capture→locked recheck và quyết định xử lý/reconcile dữ liệu mới, không hạ full-table outside Auth equality. H1 không giải C.

## H3 — HTTP thật, control còn thiếu

Seed/readback3objects x16bytes, MIME text/plain, SHA256 từng bytes; API upload/GET vào bucket `restore` tạo metadata mới. H1 DB restore giữ metadata original synthetic riêng. Không dùng ETag làm SHA/MD5 oracle dù backend cấu hình hiện tại ghi MD5.

`h3-1791907779406.json`: 15 assertions đạt sau các lỗi bootstrap/receipt collision bên dưới. Same-size overwrite đổi hash/version; old-version query không trả lại bytes cũ; conditional cache trả bytes mới; metadata ABA bằng local owner không bảo đảm bytes; object3 race bị phát hiện; thay bucket config và truncate client capture sau GET đều bị đánh dấu không hợp lệ. Không gọi ca truncate buffer là lỗi mạng thật.

`h3-deep-1791907926463.json`: 6 assertions đạt. Actual TUS POST201/PATCH204/readback và AWS SigV4 S3 PUT200/GET200 dùng SDK pin trong image. Khi streamed HTTP request đã qua permission check, file backend bắt đầu ghi; khóa `storage.objects` rồi hoàn tất body: **bytes đủ/hash mới tồn tại nhưng metadata row vẫn0**. Release lock cho upload hoàn tất. Worker thực xóa old backend version sau overwrite: chưa có retention.

Delete journal trên bucket `journal` mới riêng: local DB marker commit thật, allowlist đúng `object-1/2`, cố ý bỏ ACK ở client harness, GET+metadata reconcile absent, object3 hash+metadata giữ nguyên. Không có conditional version delete fence với concurrent writer; không áp journal này lên hosted hoặc original DB metadata của H1.

`boundary-faults.json` bổ sung5ca đạt: partition attach, role/catalog drift, catalog snapshot cũ không thấy DDL mới, **HTTP disconnect thật giữa body** không tạo metadata/readable object, và metadata-lock coordinator hết idle timeout khiến writer mở lại. Ca sau chỉ chứng minh auto-unlock local, không provider ingress fence. Chưa thử race matrix đầy đủ riêng cho TUS/S3. Không immutable-version/retention proof, không provider mutation admission+inflight+background drain proof. H3 **BLOCKED**. Official docs hiện nói S3 bucket versioning không hỗ trợ; riêng query thử không thể chứng minh không tồn tại mọi API versioning. [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility), [Storage metadata/payload separation](https://supabase.com/docs/guides/storage/schema/design). Local evidence dùng image pin, không suy hosted implementation bằng web docs.

## Lỗi harness đã giữ, không viết lại lịch sử

1. WSL không thấy private Windows path qua `/mnt/c`; chuyển sang stdin binary stream có target guard. Prepare sau đó có unused `metadata.roles.find` sai shape; bỏ dòng unused, tạo schema xong từ same new target chưa có data. Command errors giữ private.
2. Negative attempt1 dự đoán EOF SQLSTATE22023 nhưng PG17.6 trả42704; sửa theo thực tế. Fault sửa K bị immutable trigger chặn P0001; deliberate corruption chuyển sang bootstrap trên probe, `session_replication_role=replica` chỉ là negative injection local. Không sửa canonical gate hay actual source/proof.
3. Assessor excerpt lần đầu thiếu dependency `quote`; bổ sung đúng identifier quoting rồi chạy5case. Không đổi thân hàm canonical.
4. H2 P0001 expectation thất bại bởi FK23503; không sửa report cũ, có diagnostic follow-up.
5. Storage bootstrap thiếu role postgres rồi USAGE schema storage; sửa chỉ fixture target mới. Run đầu HTTP denied và run kế tiếp EEXIST vẫn giữ. Resume từ3payload đã thực upload, tên tests “RECAPTURE”, không giả upload lại; failed capture artifacts đổi tên `.failed-attempt1`, không xóa. Không retry nhằm đợi drift tự hết.
6. Final runtime hashing lần đầu giả sai đường dẫn binary; dùng command-v đúng trong image rồi kiểm lại. PowerShell quoting failures xảy ra trước thực thi; không có mutation từ những lệnh parse lỗi.

## Ranh giới còn phải đóng

`matrix.json` có35 obligation groups, mọi prior failure giữ history. Bảng [matrix và giới hạn](permission-backup-lab-matrix-2026-10-13.md) liệt kê OBSERVED/LIMITED/BLOCKED/NOT_EXERCISED/NOT_AUTHORIZED. Không tổng hợp thành PASS toàn bước2; phần chưa chứng minh không biến thành accepted risk. [Proposal quyết định](../runbooks/permission-backup-lab-options-2026-10-13.md) chỉ để owner review.

Cần pre-run full executable matrix đóng băng cho lần tiếp, full consumer discovery/cached-session semantics; full controller/gates trong authorized future scope; C drain và đường nonempty K; Storage provider control/version retention, protocol race coverage còn thiếu. DDL/role/catalog boundary đã có các counterexample ở boundary-faults, không tuyên bố exhaustive mọi interleaving. Chưa đề xuất thời lượng maintenance vì lab không đo được hosted acquisition/drain duration. Dừng trước owner criteria acceptance, normative/helper implementation, fresh hosted backup/cutover.

Walkthrough đề nghị: `capture.json` → 78 restore identity checks → Q/K assessor → inflight bootstrap và Storage payload-before-metadata → options A/B/C. Chưa có phản hồi owner rằng đã xem/hiểu. Review SEC→EVC được ghi riêng, không phải permission release.

## Metadata review sau khóa candidate

SEC rồi EVC độc lập **APPROVE** candidate01 SHA256 `9b6c1705bdd4e85d891bb74201768d8549b45d3ad1b1a0a2c5a40eb5e8307832`, chỉ cho tính chính xác của gói evidence/proposal; [báo cáo và giới hạn review](../reviews/2026-10-13-permission-backup-lab.md). Không finding chặn trong scope này, không whole-step2 approval. Findings không chặn được giữ nguyên: citation DELETE cần chỉnh484–486→485–487 ở lần sửa tiếp; fixture có9/63 bảng nonempty,54 bảng empty; cần traceability các biến thể missing-role/schema-or-ACL restore failure và rerun target mới. Review không thay candidate, không mở gate, không nhận owner acceptance.
