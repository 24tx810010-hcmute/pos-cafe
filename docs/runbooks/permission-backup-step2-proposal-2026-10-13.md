# PROPOSED — diễn tập local bước2 sau audit, 13/10/2026

**Chưa chạy. Chưa được nhận executable-ready. Không là hosted command recipe.** Phiên bước1 dừng sau audit/review. Proposal này mô tả phép kiểm cho phiên kế tiếp; không sửa verifier/spec/proof, không mở lại phase2 hoặc cấp maintenance window.

## A. Giả thuyết cần kiểm và phương án so sánh

**H1:** full logical pg_dump với exported snapshot + archive-sequence fidelity + allocation validation có thể đạt backup/isolated-restore integrity dù sequence tăng concurrent. Giữ toàn dumpable tables/catalog/Auth/roles/ACL và3 payload. Không yêu cầu full64 SHARE chỉ để dump. **H2:** tiêu chí cutover hiện hành full-row equality có thể vẫn cần ổn định closure từ capture đến locked recheck; H1 không giải H2. **H3:** Storage exact-version capture+retention hoặc drain có thể bảo vệ3objects; equality metadata endpoints riêng không đủ.

| Option | Nội dung cần đo | Đánh đổi / điều kiện |
| --- | --- | --- |
| A — online logical capture, semantic split | DML/nextval chạy trong lab, dump và digests cùng exported snapshot; restore archive sequence nguyên trạng; validate allocation; Storage separate version-bound capture | Ưu tiên kiểm đầu tiên; không hứa giải cutover. No-drift gate chỉ đổi nếu owner duyệt sau evidence. Có thể phải abort vì closure rows đổi trước C |
| B — control hẹp khi cần C/Storage | Giữ đúng closure+Storage objects ổn định từ baseline capture đến recheck, drain các writer thật sự tác động; DDL/roles window riêng. Không đòi freeze Realtime seq/migration row nếu không có dependency đã chứng minh | Có thể vẫn chạm Auth của66 ngoài scope vì full-table equality. Phải lượng hóa downtime/permission và hỏi window sau khi cơ chế đã concrete |
| C — giữ strict global stability hiện hành | Chỉ xem xét nếu owner muốn giữ no-drift invariant hoặc H1 thất bại thật | Cần control provider cho sequence writers/Storage; hiện chưa có. Không tìm workaround grant/owner/default-readonly. Giữ BLOCKED nếu không có capability |

Không đề xuất giảm full coverage, bỏ outside preservation, sửa dump setval/expected, tăng timeout mù hoặc retry tới khi ngẫu nhiên PASS. Không tạo project mới/mua addon/contact provider trong bước2 từ proposal này.

## B. Môi trường và actors được phép trong rehearsal đề xuất

1. Dựng target local mới có identity/image digest/volume pin, network none cho DB; HTTP Storage loopback riêng, egress bị chặn và không hosted credential. Trước mutation verify target identity/empty/marker. Không restart retained backup target. PG17.6 là baseline lịch sử; so exact extension versions, ownership/privilege, partition topology và sequence definitions. Hosted binary unknown phải ghi rõ, không gọi matching provider chỉ vì cùng PG.
2. Bootstrap actor chỉ tạo synthetic fixture/roles. Operator rehearsal là `postgres` NOSUPERUSER/BYPASSRLS/memberships giống observed. Dedicated fixture writers đóng vai app, auth admin, realtime admin, storage admin; quyền elevated chỉ trong local fixture. Restore operator có quyền restore local riêng, không dùng để chứng minh hosted capability.
3. Synthetic79 approved stores+145 Auth/66outside,3Storage/2delete allowlist; K/payment cases có payload/R1 đầy đủ. Không sao chép token/PIN/Auth raw vào public logs. Nếu cần actual old archive restore thêm, tách new private target và scope explicit của phiên kế tiếp; không là điều kiện để chạy synthetic cases trước.
4. Receipt runtime gồm Node binary/version/hash, pg tools, Docker image, library lock/hash, commands/exit, fixture seed/schema hash, actor, host binding. Không reuse shared node_modules hoặc sửa dependencies. Public output chỉ sanitized counts/digests; private originals giữ ACL.

## C. Pha capture → restore đề xuất

1. Inventory exact tables/partitions/extconfig/sequence consumers/roles/ACL. Derive expected TOC identities, không hardcode75. Freeze fixture identity/schema expected trước run. Explicitly reject unsupported foreign/extension-owned non-config content nếu cần nội dung chưa backup được; không gọi toàn physical DB.
2. Export snapshot RR READ ONLY; dump custom/create và canonical full-row/catalog digests import đúng token, giữ exporter tới hết. Ghi started/completed/command interval, snapshot token hash, importer verification, stderr/exit. Nếu có lock cho mục tiêu latest committed state thì acquire trước SELECT/export; không đọc cũ rồi mới lock.
3. Sequence live before/after chỉ diagnostic riêng, ghi per-query bounds. Extract **SEQUENCE SET từ chính archive** bằng TOC whitelist, hash dump+TOC+extraction. Không execute SQL extraction khi parse. Capture catalog type/start/increment/min/max/cache/cycle/owner/dependencies/defaults/identity và consumer constraints/casts. Parse integers bằng BigInt; reject unknown semantics, duplicate/missing/extra setval, bad is_called. Không sửa archive sequence cho PASS.
4. Actual restore target mới; compare every dumpable table full-row/count (không chỉ count), catalogs/roles/ACL/database/extensions/large objects, all sequence archive value+is_called. Schema/catalog supplement phải provenance và khác snapshot ghi rõ. Coverage check theo exact identities và mandatory subchecks; test truncated reports.
5. Allocation oracle riêng: fresh clone session, candidate next = is_called?last+increment:last cho noncycling supported profile; kiểm type+consumer range, extrema/occupied IDs và mọi consumer. Increasing profile phải next>max, decreasing phải next<min; overflow/cycle/unsupported/shared-consumer không được “higher is safe”. Test actual allocation chỉ trên clone/fixture, ghi changed sequence và không dùng clone đã consume làm before proof. Không setval target để chữa.
6. Storage capture phiên riêng: metadata objectID/bucket/path/version và bytes SHA/size/MIME; ưu tiên provider-supported immutable version read + retention nếu thực sự tồn tại/được kiểm. Nếu GET chỉ key mutable, kiểm concurrent upload/overwrite/delete/cache/background races; nếu không chứng minh bytes đúng version thì BLOCKED cần control. Không coi ETag luôn SHA256/MD5. Readback API vào new private bucket kiểm bytes riêng; DB original metadata phục hồi riêng. Không tuyên bố atomicDB+Storage.

## D. Danh sách ca bắt buộc — tất cả hiện NOT RUN trong bước1

| Nhóm / actor | Positive cần quan sát | Negative/fault cần bị từ chối hoặc phân loại đúng |
| --- | --- | --- |
| SNAP / operator + business writer | Rows trước snapshot khớp clone dù Q commit sau snapshot; digest và dump cùng view | Exporter EOF/timeout trước import; một hash query không import; DDL attach/detach/add table; omitted table/provider migration; same count nhưng đổi1 value; malformed/corrupt/truncated dump; missing role/ACL/catalog/TOC identity |
| SEQ / auth/realtime writers | Concurrent default insert, standalone nextval, aborted insert; clone bằng actual archive, data snapshot nguyên; stable branch vẫn pass semantic criteria | Wrong archive binding; clone last/is_called sai; reset/setval về dưới occupied range; is_calledfalse collision; increment âm; min/max overflow; CYCLE wrap; cache>1 với cached sessions; explicit IDs ngoài sequence range; shared consumer, public integer cast overflow; unknown dependency phải BLOCKED |
| PROBE / fixture operator | Before327→archive328→after328 giải thích bằng interval, không giả point-in-time | Before=after sau setval ABA; no-drift endpoints không được gắn quiescenceReady. Archive đọc giữa hai probe không nhất thiết bằng after; authentic archive fidelity vẫn riêng |
| RESTORE / restore actor | Actual pg_restore + complete row/catalog compare, clean roles derived provenance | Skip/fake JSON proof; wrong input hash/container/source; extra/missing checks dù total75; incompatible extension/bootstrap; post-snapshot supplement bị gán cùng snapshot; schema/ACL error không được bỏ qua |
| Q/K / business writer + operator | Payment Q/K payload/R1/receipt sau backup còn ở source; assessor blocks stale live restore; forward-fix route | Count bằng nhau nhưng sửa payload/amount/R1; no-op timestamps; forged serialized observer hash; writesQuiescedfalse; fresh equal observer không tự cấp live restore. Không mutate live để tạo Q |
| CUT / postgres + Auth/app clients | Scoped locks wait existing DML, latest committed recheck, correct same transaction rollback/commit local; exact79 deletion/66outside retain | Inflight legacy bootstrap đã nhận trước lock; new row/Auth refresh giữa snapshot và cutover; row drift outside66; FK/partition/new table; fragment fault; EOF/deadline/commit ACK loss; standalone public nextval lúc rollback phải được nhận là nontransactional effect, không giả rollback-safe |
| STORAGE / loopback HTTP clients |3bytes restored/readback, version binding proven hoặc explicit drain proved, object3 untouched | Same-size replacement; old cached bytes/new metadata; metadata ABA; object/bucket config drift; upload payload trước metadata commit đang blocked; TUS/S3 nếu runtime hỗ trợ; queued background deletion sau lock; object3 replacement; partial download/hash error; delete ACK loss/resume exact2 journal only after local DB commit |
| CONTROL / local owner fixture | Lock/drain release đúng owned session, reader còn hoạt động, bounded timeout/fault reopen | Role permission denial59/64 không lọc tables khỏi dump; default_transaction_read_only bypass; ACCESS EXCLUSIVE chặn dump; controller lost control invalidates eligibility; unauthorized actor cannot claim provider maintenance |

Mỗi ca phải chỉ rõ fixture/actor/source/snapshot/archive/expected/result và negative witness; không aggregate diagnostic29 thành restore75. Unsupported Storage protocol phải ghi NOT EXERCISED và giới hạn khả năng suy hosted, không đánh PASS. Sau run chỉ stop owned new containers sau identity check, giữ proof/volumes theo quyền phiên; không broadkill/WSLshutdown.

## E. Control nhỏ nhất cần hỏi nếu local evidence chỉ ra vẫn cần

Chưa gửi yêu cầu. Không mặc định20 phút hoặc mọi writer:

- **DB closure:** ai có khả năng drain các writes tới33relation+storage.objects và giữ chúng ổn định trong khoảng capture→locked recheck? Current C checker full-table, gồm Auth ngoài66; hỏi Auth refresh/signin/session cleanup có ghi các bảng đó và cơ chế bounded drain nào còn cho SELECT/dump. Nếu không có, giữ C blocked; không hạ scope rows.
- **Storage:** có supported immutable object version read/retention hay mutation fence cho đúng3object/bucket không; receipt nào chứng minh request mới bị chặn và inflight/background đã drain? Nếu không có object scope, minimum supported scope có thể bucket/project, phải đo/đề xuất cụ thể trước xin window. Đường delete2 cần fence/conditional semantics xuyên recheck→delete sau DB commit; object3 không bị xóa.
- **Catalog/roles:** kiểm hoặc phối hợp no-DDL/no-role-change window đối với objects/roles cần reconstruct, với detection/abort. Thiếu SHARE5provider tables không tự là lý do xin stop toàn Realtime/Auth service. Nếu invariant freeze sequence M07 vẫn được owner giữ, cần actor kiểm soát riêng sequence writers; hiện chưa biết capability.

Chỉ sau có mechanism/proof đề xuất duration thực đo, acquisition/abort/reopen, impacts đến66outside và cách undo khi mất ACK. Project pause làm mất reader không tự phù hợp. Network restriction không chặn HTTPS APIs. Không ALTER role/grant/ownership/settings, terminate provider sessions hoặc triển khai maintenance page từ proposal.

## F. Delta cụ thể cần owner/review nếu H1 được chứng minh

Tất cả **PROPOSED**, không implement ở bước1:

1. Bổ sung R/design8.2.1 đoạn backup tách B/I/C/L; giữ nguyên lock C:270, live restore8.3:278 và DELIVERY03 ngoài scope. Update R/TC53 operating-gate + traceability + T17/T18 và F/PIN-T07 reference để ghi tiêu chí sequence mới, không đổi forced-PIN scope hoặc tổng60TC/19PIN.
2. New version helper/config pin scope79+original77/approved2 provenance; full inventory/TOC identity, timestamp boundaries, archive extraction and consumer catalog. Giữ nguyên helper/manifest/receipts cũ. Không thay tất cả77 bằng79 trong lịch sử.
3. New verifier version tách `archiveFidelity`, `allocationSafety`, `concurrencyObservations`, `coverageComplete`, `catalogProvenance`, `storageCaptureBoundary`; no-drift là diagnostic hoặc requirement riêng được owner chọn. Không chỉ xóa `!drifted`, rename status hoặc hợp thức hóa74/75 cũ. Fresh actual run và negative controls mới bắt buộc.
4. Update phase2 planner/runbook full64/global control thành requirements cụ thể theo B/C/P đã kiểm; nếu chưa chứng minh Storage/closure window thì vẫn executionReadyfalse. Controller proof adapter/loader nếu nhận version mới phải require mọi mandatory check/status+exact hashes, không chỉ `checks.length>0/all matched`; full-source gates/review theo phạm vi ảnh hưởng. `verifyBackupDigests` C full rows giữ nguyên, assessor live restore không nới.
5. Chốt với owner thay tiêu chí nghiệm thu nào, dựa trên rehearsal report so A/B/C, giới hạn provider và dữ liệu ngoài scope. Sau duyệt mới cập nhật normative artifacts, implement, review và chạy backup fresh khi có quyền/control cần thiết. Không retroPASS dump cũ, không coi audit/review là window approval.
