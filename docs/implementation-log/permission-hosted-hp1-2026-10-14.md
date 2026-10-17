# HP1 — biên bản triển khai LOCAL successor, 14/10/2026

Trạng thái hiện tại: SEC candidate01 CHANGES_REQUESTED; preliminary57 còn blocker exporter log identity, đang sửa/kiểm nguồn58. Execution56/57 giữ lịch sử, không là final acceptance. Owner chưa nghiệm thu; hosted certification/release BLOCKED. [Đề bài/quyền](../workflow/tasks/permission-hosted-hp1-2026-10-14.md).

## Matrix khóa trước triển khai / kiểm thử

Expected theo contract successor §§39–69 và TC53-V2-HP; không thay bộ 60TC/19PIN.

| Nhóm | Phép kiểm bắt buộc | Expected |
| --- | --- | --- |
| HP-SCHEMA | all-level closed JSON, duplicate/UTF8/16MiB, bounds, UUID/SHA/UTC/int64, bad ref size/hash/path/realpath | INVALID có code sanitized; không connect |
| HP-BIND | source/method/adapter/environment/bundle/project/origin/database/actor/session/scope; no credential fallback; transaction pooler6543 | Sai binding/route từ chối trước query nghiệp vụ |
| HP-TRUST | absent/wrong external manifest pin; issuer/key/config/nonce ngoài envelope; synthetic provenance | Thiếu → BLOCKED_TRUST, sai hash → INVALID; synthetic không certify hosted |
| HP-SNAPSHOT | actual RR READ ONLY exporter liên tục, backend/import ACK/snapshot hash cho inventory+schema+dump; lost exporter | same snapshot có proof; thiếu/đóng exporter không PASS |
| HP-BI | dynamic inventory/ONLY full rows/partitions/extensions/LO/catalog; actual archive TOC/SEQUENCE SET; complete schema/globals roles toàn văn | exact independently derived required IDs; không thiếu/extra/dup/skips/timeouts/nonzero/truncated PASS |
| HP-RESTORE | fresh guarded pristine + separate allocation clone; recheck pristine | actual restore không lọc DDL/ACL cho equality; preserve pristine |
| HP-NEG-BI | same-count row/LO/ACL/role expiration/comment/schema/catalog/TOC corruptions, forged proposed report | độc lập phát hiện FAIL/INVALID; old74/75 không hồi sinh |
| HP-ALLOC | BigInt cache1/noCYCLE/single explicit consumer; archive value/called/type/range/extrema/cast/explicitIDs; complete provenance control | LOCAL explicit contract kiểm được; provider unknown/shared/dynamic/cache blocked; no live nextval/setval repair |
| HP-C | full-row locked equality giữ nguyên; toàn FK namespaces/partitions/triggers/functions chưa phân loại | missing actual actor/catalogrolesDDL/drain/control → BLOCKED; không suy từ local superuser |
| HP-STORAGE | validator S1 all ingress+admitted/background drain, generation/expiry; races/false immutable claims | unsupported version/retention/IfMatch, gateway/RLS-only và thiếu real S1 → BLOCKED |
| HP-LIFECYCLE | authorization exact action/window; invalid journal, lost ACK, unknown state | UNKNOWN/BLOCKED, không blind retry/auto restore/reopen/HP7 action |
| HP-DISPATCH | schema3 production loader/rehearsal/cutover path và oldv2 regression | uncertified/forged/missing proof từ chối trước DB connect, tất cả eligibility false |
| HP-GATES | fresh source, native Linux isolated deps/config, full unit/tooling/build/2tsc/PIN19/PERM60/UI required order | one source fingerprint; no required skip/retry/xfail; mọi FAIL giữ lịch sử |
| HP-PACKAGE | source tar/new files/deletion markers/spec refs, private raw bytes+pins/recipe, ACL/privacy/link/teardown/preservation | recoverable cùng candidate; không public credentials/rows, không restart old targets |
| HP-REVIEW | sequential SEC security/trust/source và EVC requirements/evidence/replay | hai non-author APPROVE cùng exact final candidate SHA |

## Quyết định kỹ thuật trong phạm vi HP1

HP1-D01: implementation registry và certified hosted registry tách riêng; registry certified hiện rỗng. Local rehearsal chạy đúng schema/comparator/loader production với transport chỉ Docker network-none, provenance `LOCAL_SYNTHETIC`. Không cung cấp command kết nối hosted khi capability/action authorization chưa có. Lựa chọn của tác giả theo ủy quyền HP1, không là owner chọn trust anchor release.

## Checkpoint trước full gate

Precheck xác nhận source40 823 entries/0 drift, candidate hosted-path02 1303 snapshots/0 drift; HEAD khớp bàn giao. Windows slice ban đầu 120 tests gồm hồi quy v2 PASS; slice v3 mở rộng85 PASS. Đây là kiểm slice, chưa native full gate/source cuối.

Native Linux nguồn41–48 đều có tar riêng và fresh npmci configured empty-config exit0, lock không đổi. 41/42 dừng tại globals GRANTED BY (42501); 43 lexer từ chối dollar body trước replay; 44 tái hiện grantor privilege; 45/46 đã tới pristine/allocation, phát hiện import `same` thiếu; 47 catalog roles so đầy đủ bắt sai representation rolconfig. Diagnostics/receipts/raw giữ riêng; mọi target tạo ở các attempt này đã stop exact-owned, volume/archive giữ. Không sửa source snapshot hoặc kết quả FAIL cũ.

Source48 manifest SHA `adf7ba9a65582857c9c498fbb7e82248c23ecce7d6c6b0d4e55b1d2962ec03c7`: [receipt](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/hp1-local48.json) exit0, [37 checks LOCAL](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/source-48-local/result.json) PASS; B/I95 comparisons,63 tables/35 nonempty,3 sequence allocation trên clone riêng `LOCAL_PASS`; controller/rehearsal missing trust bị chặn trước connect; full-row/LO/ACL/role/schema faults/exporter EOF đều bắt đúng. Flags coverage/cleanup/execution false. Đây là lịch sử trước hardening source tar/provenance cuối, không ghép vào full aggregate source mới. Các hồ sơ source41–48 nằm cùng artifact root, raw riêng tư Linux0700/0600.

Sau source48, tác giả bổ sung kiểm USTAR/fingerprint/spec bytes, independent external-pin positive/negative, source/clone identity binding, allocation baseline raw inventory và journal chronological guard. Slice journal cũ dùng timestamp lùi nên2 tests FAIL đúng theo guard mới; sửa fixture thành thứ tự thời gian tăng và thêm negative chống timestamp lùi, không hạ acceptance. Chưa full PIN19/PERM60 mới hoặc review final candidate.

Source49 manifest SHA `dc93859fa7b6eaa9faab264f0e12b6fa5ac2a7a0b9538694cc3b08bf0100064b`: chain B/I95 và LOCAL allocation đã qua cả USTAR/source fingerprint recompute, nhưng test tiếp theo dừng đúng `HOSTED_INPUT_INVALID`: `fs.cpSync` tạo clone directory0755 dù ancestor private0700; loader đòi package root0700. Target đã stop, volume giữ. Điều tra này cũng chỉ ra 21 graph-forgery rejections của source48 chưa chứng minh riêng từng mutation: clone không có positive control nên có thể bị ACL guard chặn trước. Không dùng21 cases đó làm acceptance coverage. Tác giả sửa fixture clone0700/0600 toàn cây và bắt buộc load unmodified clone thành công trước từng mutation; source cuối phải chạy lại toàn harness. Kết quả SQL actual faults và chain nguồn48 giữ đúng phạm vi riêng.

Full mandatory gate sẽ dùng namespace mount/net/PID và Docker daemon LOCAL riêng, các target/volumes mới; bind roots mới trong namespace để giữ nguyên guards/profile/ports hardcoded của test, không sửa main helpers hoặc khởi động lại5 stacks/T01 cũ. Network namespace chỉ loopback/local service bridges, không hosted endpoints. Đây là lựa chọn tái hiện trong HP1; không matching-provider certification/HP2. Raw configs/service keys nằm private0700/0600, image/dependency inputs chỉ lấy local đã pin.

Source51 (`bf7a57111c309876b90572298894152c15b655f8fef737f6935d77c98b0956fe`, fingerprint `a1960e70f70147507856a016da1c0c9def78cd59a520b6f488fe012b4560598c`) đã đạt harness48/48 với positive control clone, B/I95,63tables/35nonempty/3allocationLOCAL; native core1173unit/437tooling/build/2tsc/selftest23/UI16×3 PASS. Đã đọc report và mở ảnh chú thích floor mobile:0real/6sidebarfalsepositives; không baseline update. Fresh audit vẫn7findings, releaseBLOCKED. Chưa PIN19/PERM60 mới.

Các attempt namespace01–05 dừng trong chuẩn bị hạ tầng, chưa đạt runtime gate: socket path dài; sharedcontainerd; systemd cgroup/PID namespace; image-rootfs bị umask077. Bản sửa dùng socket ngắn, containerd riêng/cgroupfs và umask022 chỉ cho engine/image filesystem; raw outputs/root private giữ0700/0600. Namespace05 bị gián đoạn cùng WSL reboot: không completion receipt, status `UNKNOWN_TERMINATED_OUTSIDE_RUNNER`, container process không còn; offline archive volume/metadata giữ trong private, không khởi động lại hoặc nhận PASS. Namespace06 chỉ là môi trường mới chuẩn bị, không provider certification. Không gọi WSLshutdown/broadkill; chỉ signal đúng helper sở hữu khi0containersrunning.

Tự rà tiếp trước runtime gate phát hiện unknown version/kind có thể fallthrough nhánh legacy. Tác giả khóa dispatcher chỉ nhận legacy unversioned, exactv2 pair, exactv3 pair; thêm13 tests qua production loader/recognizer, không đổi acceptance hoặc app/SQL. Source52 sẽ là source mới cho gate cuối; không ghép source51core vào aggregate52. Các kết quả/FAIL/UNKNOWN cũ giữ nguyên.

Source52 manifest `869f645aec887ed7e472bd3bbf8cb29f3df46efb833ec551f32fe1e737c16c0a`: Windows slice133/133 (106hosted+27controller/rehearsal) và native harness48/48 PASS; core đang chạy khi tác giả rà thêm HP-BI-ONLY. Phát hiện schema B/I đang bắt buộc allocationContract và producer đòi consumer approval, trái nhánh B/I độc lập đã chốt. Đã sửa nullable contract/zero-probe route, thêm actual second capture không consumer contract; đồng thời pin scopeapproval bytes trong graph, đóng receipt trước trust disposition và tách implementation LOCAL khỏi certified registry rỗng. Source53 phải chạy harness/core/mandatory gates mới; source52 giữ lịch sử, không được ghép thành aggregate53.

Source53 manifest `96a4dcdfa38b1558e5f254998d3f57b9a1d25f408df0cd2ceb5f0304b7a6fc01`: Windows slice135/135 và native harness50/50 PASS, gồm actual B/I-only95 comparisons không probe;6 targets stop/volumes giữ. Tự rà binary metadata phát hiện đường dẫn ghi cứng `/usr/lib/postgresql/17/bin` không tồn tại trong pinned image (PATH thực có Nix và `/usr/lib/postgresql/bin`), dù hash/version đã lấy đúng executable thực chạy. Tác giả thay bằng resolve real executable, ghi/hash/version và execute chính đường dẫn đó; native harness mới copy binary từ target guarded để đối chiếu actual path+hash. Slice137/137 PASS. Source54 mới là ứng viên gate tiếp theo; không ghép source53 vào aggregate54.

Source54 dừng trước capture tại binary resolver: image dùng BusyBox `readlink` không hỗ trợ option `-e` (command exit1); target stop/volume giữ. Sửa adapter dùng supported `readlink -f` rồi kiểm `test -x`; giữ actual-path/hash native check. Đây là lỗi portability implementation, không thay yêu cầu hoặc nhận PASS cho attempt54. Source55 sẽ chạy lại từ fixture mới.

Source55 manifest `77b04e5c412f4df501372461d3c36f839e37790f279a7e6ebbba471979e879a9`, fingerprint `5a80fc98e129533399e70596d88cc45bfe17ed36aea0d76edcc0540e65493e02`: native fresh npmci, actual HP1 harness52/52 (B/I95,63tables/35nonempty,3LOCAL allocations và actual B/I-only không probe), build,1173unit,454tooling,2tsc,selftest23 PASS; offline loader replay hai raw graph exit0, không connect. Six owned targets đã stop, volumes giữ. Fresh npm audit vẫn7 findings (5high/2moderate), không đổi deps/Tailwind, releaseBLOCKED. UI/PIN19/PERM60/review còn đang thực hiện, không suy từ source51/52/53.

Fresh application setup source55 attempt01 tạo được onboard+identity rồi stop/archive; canary pristine đếm0/0/0 nhưng17 migration do copy cả017. Mandatory canary test đọc guard yêu cầu16; chưa test nào chạy. Dừng toàn36containers và archive6volumes trước thay môi trường, giữ receipts/setup failure. Attempt02 namespace mới giữ017 bytes ngoài CLI migration directory, chỉ001–016 được áp vào pristine canary; không sửa main SQL, snapshot source55 hoặc test/expected. Các preflight support adaptation filename/count/path lỗi cũng được giữ tại thư mục support-attempt01, không gọi là required test retry hoặc PASS.

UI source55 đã thực hiện đúng thứ tự selftest23 → audit16×3 → đọc report.md → mở ảnh chú thích floor mobile → phân loại:0real/6falsepositive/0new/0setup failures/0PIN-screen findings, không update baseline. [Bảng từng selector và measurement](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source55-20261014/ui-classification.json), [report](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source55-20261014/ui-audit/report.md). Các nhãn sidebar thu gọn có chủ đích: VẬN HÀNH57→1px (horizontal), Chủ quán16→0px, CHỦ QUÁN15→0px, VẬN HÀNH15→1px, Bàn16→1px, Khoá16→1px (vertical).

Setup attempt02 gặp output `PIN_ONBOARD_ALREADY_PREPARED` kế thừa từ attempt01; đã đọc helper xác nhận guard nằm trước tạo DB client/connect, kiểm current new target chưa có public.stores rồi di chuyển output cũ vào private/onboard-output-bootstrap-ns01. Tiếp tục đúng target owned đang chạy sau preflight xác định, không tạo lại DB state hoặc retry unknown mutation. Lượt prepare continued exit0 có receipt riêng; lỗi cũ giữ nguyên. Sau đó cả5 stacks mới/60containers đã bootstrap, archive10volumes và stop, IDs/image/loopback/namespace/daemon pin trong [fixture preservation](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source55-20261014/fixture-preservation.json). PIN19/PERM60 bắt đầu tuần tự sau toàn core/UI source55, chưa claim aggregate PASS khi chưa thu đủ report.

PIN SQL attempt01 source55: discovery41, assertions41PASS, afterAll `IDENTITY_CATALOG_DRIFT` nên toàn suite FAIL; bản tóm tắt ban đầu của tác giả diễn giải nhầm chưa chạy assertions đã được đính chính. Sau stop/archive, tạo các clone physical network-none mới để đọc baseline và hậu kiểm, không restart target lỗi. Diagnostic01 lỗi cwd trước inventory; diagnostic02 phát hiện đúng2surfaces employees(DML/SELECT) khác relation.aclHash; diagnostic03 phép thử khôi phục ACL bằng standard information_schema phát hiện full ACL set không bằng nên rollback; không nhận các lượt chưa đủ đó làm PASS.

Diagnostic04 đọc thêm archive baseline source40 đã pin SHA `973cc7f67df91f29bd8dabbda36f93929839190edac19970baefff117d2db9d0` trên clone mới. Fresh baseline hash e4425b6978962d6aa486d041d6e0fa5c; source40 baseline và sau cleanup đều cda06175832287e994af244aeb468c97, full ACL rows bằng nhau. Chênh lệch duy nhất: fresh PG17/Supabase default có thêm `service_role MAINTAIN` trên public.employees, trong khi established legacy test profile source40 không có; helper cleanup dùng standard information_schema không khôi phục privilege riêng PG17 này. Không sửa helper/test/SQL app hoặc bỏ assertion catalog. Môi trường identity mới sẽ được khởi tạo đúng established LOCAL profile bằng REVOKE MAINTAIN trên synthetic employees trước baseline/test, đối chiếu đầy đủ grantor/grantee/privilege/grantability với source40, rồi giữ nguyên kiểm afterAll. Đây là lựa chọn setup fixture trong HP1, không đề nghị hoặc thay quyền của hosted/service_role thật. Hạn chế này của generic legacy test helper được ghi rõ, không claim phủ arbitrary fresh PG17 default ACL profiles.

Các suite/profile độc lập có thể dùng owned namespace khác nhau nhưng phải cùng source55 fingerprint và recipe/npm graph; mỗi profile giữ IDs/image/namespace/daemon/marker thực. Identity SQL final sẽ dùng namespace03 mới; browser/onboard và các nhóm còn lại dùng namespace02. Failed namespace02 identity, raw report/41assertions/afterAll FAIL và volume vẫn giữ, không tái khởi động để rerun. Final aggregate chỉ lấy SQL final có đầy đủ41PASS/0hookerrors và no retry; các FAIL giữ lịch sử riêng.

Identity SQL final namespace03 đã khởi tạo baseline đầy đủ ACL đúng reference source40 (chỉ bỏ service_role MAINTAIN khỏi synthetic employees), fresh target IDs riêng;41/41 assertions,0hookerrors, exit0 và stop12containers/volume giữ. Đây là actual final report source55, không dùng FAIL attempt01 để nhận gate.

Canary attempt01 dừng tại `CANARY_CONFIG_REFUSED` trước DDL/mutation: source runtime TOML có418 CRLF nhưng Python universal newline đã tạo config LF. So byte xác nhận chỉ line endings khác; runtime settings không đổi. Đã giữ reportFAIL/configLF/rawlogs, archive DB+Storage riêng, đọc code xác nhận failure xảy ra trước mọi test mutation rồi copy đúng expected source bytes vào config owned LOCAL. Main source/test/SQL không sửa; target còn pristine0/0/0/16. Lượt kiểm mới có receipt riêng, retry setting0; không phải retry outcome chưa biết. Scope/routing namespace02/03 và failed histories được pin riêng. Mọi conclusion còn chờ strict aggregate source55 và SEC→EVC cùng final candidate.

Canary TC19 final source55 đã PASS1/1,0hookerrors/no retry; post-test backup lần đầu lỗi ENOENT vì fixture mới chưa tạo output private directory. Chưa ghi dump. Đã tạo riêng output0700, bật đúng12containers owned đã xác định để chỉ backup read-only (không rerun test), guard/capture/archive exit0, counts67Auth/1store/1object, dump912970bytes và readable TOC, Storage tar10240bytes; stop12 và giữ volumes. Bằng chứng lỗi/thư mục raw riêng, không đổi expected hoặc claim là hosted backup.

Focused PIN tooling110 và PERM static stages source55 exit0. T01 setup dừng trước initdb: curated PATH không chứa /usr/sbin nên không tìm thấy runuser. Sửa support helper gọi absolute /usr/sbin/runuser, giữ guard namespace và kiểm directory/socket rỗng trước initdb; chưa suite T01 nào chạy ở setup lỗi này. Không sửa main helper/tests/SQL. Các bước PERMservice đang tiếp tục tuần tự.

T01 legacy database và ba stageT02 (bridge/candidate-bridge/foundation) source55 exit0 và stop riêng. T04 identity lần đầu42/42 assertions/0hooks/exit0 nhưng wrapper valid=false do storage_objects0 thay vì6 yêu cầu; module không bị sửa để bỏ preservation. Đã archive cả DB/Storage sauFAIL, giữ stage/raw/controls/dump/candidate summaries riêng tại private/t04-attempt01 và public history-t04-attempt01.

T04 final được tạo mới trong namespace03, image/IDs/marker riêng; upload chính xác6 PNG synthetic qua Storage API LOCAL service-role và GET đọc lại từng payload/hash, trước khi archive baseline. Thao tác này chỉ chuẩn bị fixture mới, không sử dụng hoặc sao chép payload hosted. Từng intent/ACK và descriptors ở private. Không thay assertion/expected6 hoặc main runtime helpers. Namespace02 T04 bị lỗi giữ stopped với volume/archive; stage cuối dùng target mới và source55. Lần dựngT04 mới đầu dừng tại guard daemon phải rỗng (namespace03 đã có identity stopped), chưa tạoT04; guard đã đối chiếu exact các IDs identity được ghi và yêu cầu0running, projectT04 vẫn phải chưa tồn tại trước creation.

PIN19 strict aggregate source55 ngày14/10/2026 đã PASS execution: discovery55/browser55 gồm48+TC18seven,0skip/0retry; SQL41/0hooks, canary1, operator2, focused tooling110, core1173/454/build/2tsc/UI đầy đủ cùng fingerprint. Receipt `pin-strict-aggregate.json` exit0; status chờ review đúng giai đoạn, releaseBLOCKED.

T04 namespace03 sau bổ sung6objects đã identity42/42 validPASS. T09 dừng ở hook `IMAGE_STORAGE_PROOF_COUNT_MISMATCH`, assertion chính skipped vì requirement hiện hành còn đòi exact2 sentinel bytes trong bucket restore-proof-1790591043430; chỉ6objects ở menu bucket chưa đủ. Đã đọc full setup/cleanup sentinel trước run tiếp, archive DB+Storage và giữ history-t04-attempt02/raw/report riêng, không nhận skipped làm PASS. T04 final namespace04 tạo mới chuẩn4menu+2sentinel, actual APIupload6 và GET/hash6, marker/IDs/image riêng; profile giữ tổng6 và full metadata/payload preservation, không đổi test/assertions/expected. Lượt mới hiện chạy tuần tự toànT04 để global pre/post backup bao đúng cùng tập6 ngay từ đầu.

T04 namespace04 đúng4+2 đã qua identity42, Storage/Edge actual1, administration/read/clear-demo. Signals attempt01 có3/3 assertionPASS (actual subscriber/cross-store denial/rollback/catalog signal) nhưng afterAll catalogFAIL. Diagnostic trên clone physical read-only xác định service Realtime tạo thêm `supabase_realtime_messages_publication` lúc tenant đầu tiên kết nối. Source40 reference archive SHA `a3e05e073660dd02701bc17d0dbd8c86d64efee8a5f6b24e79a4e104019e005f` được đọc trên clone mới chứng minh publication đó đã tồn tại ở profile cũ; không claim toàn catalog411surface của reference bằng target274surface hiện tại.

Đã giữ failedstage/target archive/raw reports riêng, ghi rõ cold-tenant initialization là setup dependency. Trạng thái sau cleanup có2stores/2Auth/6objects và publication nội bộ đã khởi tạo, marker/IDs/actual legacy profile recheck; mở lại đúng target owned mới này với state đã xác định, refresh fixture session, cold-restart Realtime và kiểm lại signals theo guard cũ. Final3/3/0hookerrors/validPASS, readiness thực có samePulseDeliveredToBoth và businessMutationRetried=false trong run; không đổi test/expected hoặc tự retry mutation outcome chưa biết. Captured helper artifact chỉ bổ sung raw inventory trước/sau vào private để chẩn đoán được; bản helper trước thay đổi và before/after SHA được giữ, assertions/verifier/main source không sửa.

Financial/print/bulk-concurrency và candidate/roles/Realtime browser, seed-recovery, ba rollback stages tiếp theo đều exit0 source55; còn transition/compatibility và strict PERM aggregate. Đây vẫn LOCAL execution, không matching provider certification hoặc release authorization.

Toàn19 T04 stages đã chạy PASS ở namespace04 sau readiness, nhưng global preservation FAIL đúng: storage.objects6/6/full rows bằng nhau và payload6/6/hash bằng nhau; storage.buckets2→3 do activation tạo bucket staging rỗng. Không đổi helper hoặc sửa baseline dump để nhận PASS. Giữ toàn reports, controls, Auth/env private, DB/Storage archive tại private/t04-attempt03 và history-t04-attempt03.

Đã tạo namespace05/T04 mới với đúng baseline cần cho toàn gate:3buckets (legacy public, sentinel private, staging private5MiB với MIME jpeg/png/webp),4menu objects+2sentinel, actual6uploads+6GET/hash, và Realtime tenant prewarm bằng subscription acknowledged không business DML, kiểm publication nội bộ tồn tại trước archive baseline. Source40 cũng có publication đó; không tự DDL giả lời provider. Seed dùng đúng field mapping của SDK đã cài (file_size_limit/allowed_mime_types). ToànT04 source55 đang được chạy lại với baseline này, các assertion/expected/full metadata+bytes preservation vẫn nguyên. Main source55/fingerprint không đổi; không hosted operations.

Source55 strict PIN19 và PERM60 đều PASS execution:60cases/726variants/27stages, all sequential cùng fingerprint; globalT04 metadata3buckets/6objects và6payloads exact bằng nhau; Edge bindings cũng PASS. Các report cũ/FAIL không được ghép vào aggregate.

Tự rà trước candidate final phát hiện guard producer output dùng startsWith(privateRoot) cho real parent, có thể nhận nhầm sibling cùng tiền tố qua symlink. Tác giả sửa guard thành parent===root hoặc startsWith(root+separator), đòi directory thực và output mới; thêm5 filesystem boundary tests (positive nested, sibling-prefix symlink, outside symlink, existing retained, lexical outside). Windows slice142/142 PASS. Không có dữ liệu rò được quan sát; đây là hardening lỗi containment trong phạm vi HP1. Source56 phải chạy actual harness và full mandatory gates mới; source55 giữ lịch sử, không retag hoặc ghép thành final56. Những fixture prerequisites đã xác minh sẽ dùng ngay trước baseline ở nguồn56.

## Checkpoint source56 — nguồn kiểm cuối hiện tại

Manifest SHA `f5f24d5a4b396ed1fdb2fda036c6ec2e16b7a96db25e30be88dc4d4efdb4a21d`, permission fingerprint `58115a0068838b0ab380f5dcf08230acc0e4eee493bab8a426c941447e3c1976`;835 entries (833files/2deletion markers),14 main delta. Fresh native npmci giữ lock, harness52/52,1173unit,459tooling,build,2tsc,selftest23 đều exit0. UI16×3 được đọc report và mở ảnh chú thích nguồn56:0real/6false positives/0new/0setup failures/0PIN-screen findings, không update baseline. Sáu nhãn sidebar ẩn có chủ đích và measurements giữ như bảng nguồn55; [từng selector của nguồn56](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/ui-classification.json).

[Replay nguồn56](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/offline-replay56.json) đọc lại hai graph thực, mỗi graph95checks B/I PASS, không DB connections. Capture có consumer contract cho allocation LOCAL_PASS; B/I-only allocationBLOCKED. Cả hai vẫn BLOCKED_TRUST khi không có external anchor, coverage/cleanup/execution false. Fresh npm audit vẫn7findings (5high/2moderate), không đổi dependencies/Tailwind hoặc nhận risk acceptance.

[Kiểm chỉ đọc target cũ](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prior-targets-final56.json) xác nhận60 application containers dừng, StartedAt/FinishedAt và mounts không đổi;53v2 targets cũ không chạy. Source56 dùng namespace01 mới, daemon/IDs/volumes riêng. PIN19/PERM60 và package/review vẫn chờ hoàn thành ở checkpoint này; không ghép PASS nguồn55. Recipe package dùng stream trực tiếp các file đã hash vào tar riêng tư với directory0700/file0600, tránh nhân thêm staging tree; mỗi member sẽ được đọc lại đối chiếu SHA/bytes trước handoff.

### Kết quả mandatory gates nguồn56

Ngày14/10/2026, [strict PIN aggregate](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/pin-strict-aggregate.json) và [strict PERM aggregate](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/perm-strict-aggregate.json) exit0 trên đúng manifest/fingerprint nguồn56. PIN19 đủ55browser (48+7TC18),41SQL/0hookerrors,1canary,2operator,110focused checks, core1173unit/459tooling/build/2tsc/UI16×3. PERM60 đủ60cases/726variants/27nonoverlapping actual stages;0requiredskip/retry/xfail. Không dùng receipt nguồn55 thay thế.

[T04 final preservation](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/t04-storage-preservation.log): storage.buckets3→3/full rows equal; storage.objects6→6/full rows equal;6payloads trước/sau exact bytes/hash equal. [Edge binding](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/t04-edge-binding.json) exit0. Toàn5 application stacks/60containers nguồn56 và T01 đã stop sau từng nhóm; archive/namespace teardown và private package được ghi receipt riêng tiếp theo. Không lỗi hoặc rerun required suite trong lượt final56. Đây là LOCAL verification, không provider certification, deployment hoặc owner acceptance.

### Package, bảo toàn và đóng môi trường

[Final owned archive](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/final-owned-targets.json) giữ11DB/Storage/T01 tar archives,60application containers dừng/volumes giữ. Namespace01 đã đóng đúng hostPID/bootId/namespace/daemon với0running containers; [final read-only runtime](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/final-runtime56.json) xác nhận0owned namespace helpers,6actualcapture targets dừng+volumesgiữ,104v2-labelled targets cũ/mới không chạy và T01gốc dừng. Các namespace55 cũng đã đóng, raw/volumes giữ. Keeper đóng đúng identity, không WSLshutdown/service restart/broadkill. Playwright MCP không dùng và không có node/cmd `@playwright/mcp` còn chạy khi kiểm; không đổi cấu hình.

[Private permissions56](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/private-evidence-permissions56.json) vànguồn55 chuẩn hóa chỉ artifact mới thành0700/0600, không đổi engine/PG data modes. [Preservation03](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/preservation-final-03.json):835sourceentries/0drift;769prior paths/bytes/deletion markers,1303frozen candidate snapshots vàsource40 snapshot/0unexpecteddrift;14authorizedmain delta/HEADunchanged. Source/spec capture snapshots không ghi đè; docs hiện tại bổ sung metadata kiểm chứng/giải thích, không sửa acceptance.

[Package01](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/private-package-01.json):5.440files,4.327.352.320bytes,SHA `b3a93b54d2b84cb5d41e234c0785bc6d82f53296a12f9092cea3ab27e820b52f`. Mọi member đã đọc và đối chiếu SHA/bytes, mode directory0700/file0600. Windows root/file ACL chỉ currentuser+SYSTEM; raw không public. Chép trực tiếpquaWSL `/mnt/c` bị FileNotFoundError dù Windows root tồn tại/protected; tar vẫn nguyên, không chép dở đích. Giữ failure receipt và dùng binary stdout→protected FileStream, hash Windows/Linux khớp; không in payload. Không nhận attemptcopyFAIL làmPASS hoặc dựng tar lại để xóa lịch sử.

[Replay từ package](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/carried-package-replay56.json) đã giải nén nguồn và66raw members thực từ tar sang private root mới; mỗi graph95B/Ichecks PASS,0network/DBconnections; noexternalanchor→BLOCKED_TRUST vàeligibilityfalse. Tar mang current56 proof đầy đủ/reference inputs, raw cũ41–55 vẫn giữ trênhost. [Runbook](../runbooks/permission-hosted-hp1-2026-10-14.md#package-và-tái-hiện-từ-bytes-được-bàn-giao) ghi prerequisites/pathmapping/replay và giới hạn. Snapshot docs trongtar làcheckpoint trướcpackage; metadata saupackage/review ởcandidate/docsngoài, không circularhash hoặc retag source. Chờ review độc lập SEC→EVC cùng finalSHA; chưa owneracceptance/pháthành.

## Review candidate01 — CHANGES_REQUESTED, sửa nguồn57

[SEC](../reviews/permission-hosted-hp1-sec-2026-10-14.md) tự kiểm513snapshots, private tar5440files,115pure tests vàoffline replay; đồng thời tái hiện blockers SEC-01/02: B/I-only graph có thể bỏ public.stores hoặc public.store_no_seq khỏi descriptor/TOC/coverage (94checks) hoặc đổi increment (95checks) mà giữ canonical catalog gốc, rehash/propose PASS vẫn được loader nhận. Exporter PID string hoặc alias schemaSource importer cũng nhận PASS95. Mọi trạng thái cleanup/execution vẫn false nhưng archiveFidelity PASS sai denominator là lỗi chặn yêu cầu HP1, phải sửa trước bàn giao.

Comparator đã bổ sung correlation exact canonical catalog relations/sequences và field mapping, derive unsupported list, referential occupied descriptors, exact sequence state/probe vectors, zero-probe B/I-only; exporter/backend PID integer1..2147483647, distinct exporter/importers, exact inventoryBefore/After importer backend binding. Windows slice160/160 (133hosted+27controllers) PASS. Thêm12 actual graph forgeries từ capture B/I-only: unmodified clone phải load được trước, refs và proposed PASS94/95 được cập nhật, từ chối phải đúng code của guard thay vì bất kỳ error. Nguồn57 sẽ kiểm64harness/fullcore/mandatorygates mới; chưa claim runtime57 PASS. Candidate01/source56/package56/FAILreport giữ nguyên, EVC chưa bắt đầu; SEC sẽ kiểm candidate mới sau khi đầy đủ evidence.

### Checkpoint thực thi nguồn57

Manifest SHA `1ec6dd8d4281e9e91ea6a4923dc925f9812d8f86bcc02fd7c4d35a061733e471`, fingerprint `0975ed573fa2a9b6731816d8bbad03722b2fc3cce108a05c527aab1a5694b7ea`,835entries/14delta. Fresh native npmci, actual harness64/64 (12 semantic forgeries từ chối đúng guard code),build,1173unit,477tooling,2tsc,selftest23 PASS; UI đang chạy. Hai actual capture B/I95checks PASS, allocation chỉ LOCAL_PASS với explicit contract hoặc BLOCKED B/I-only, eligibilityfalse; sáu targets đóng/volumes giữ. [Offline replay57](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/offline-replay57.json) exit0/noDB, không externalanchor→BLOCKED_TRUST. Audit vẫn7findings (5high/2moderate), không dependency/Tailwind change.

Namespace57 có observed bootId `d03c76c8-e8b5-43db-a111-24c94b753480` khác boot41 của nguồn56 đã đóng; không suy nguyên nhân reboot hoặc dùng live observation56 cho57. Agent không gọi WSLshutdown/service restart; [read-only prior check57](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prior-targets-final57.json) xác nhận60oldapplicationtargets/StartedAt/FinishedAt/mounts vẫn nguyên,53v2cũ không chạy. Namespace/daemon57 mới; fixture prerequisites đã kiểm trước baseline và không sửa assertions. Package lượt57 dùng PAX tar+gzip level1 để giảm dung lượng, source USTAR bên trong và toàn SHA/bytes/mode verification vẫn giữ; binary-copy vào protected Windows root, không lặp đường `/mnt/c` đã biết không nhìn thấy logical root. Package56/candidate01 không xóa hoặc ghi đè.

### Continuation SEC-02 và nguồn58

Nguồn57 sau checkpoint đã qua UI selftest→audit→readmd→openannotatedPNG→classify:0real/6sidebarfalse positives/0new, không baseline update; strict [PIN19](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source57-20261014/pin-summary.json) và [PERM60](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source57-20261014/perm60-aggregate.json) PASS cùng fingerprint (55browser/41SQL/1canary/2operator/110focused,60cases/726variants/27stages/0requiredskipretry). Storage3buckets/6objects fullmetadata và6payloads exactpreserved. [Archive57](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source57-20261014/final-owned-targets.json)11archives/60containers/T01 dừng; [final-runtime57](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/final-runtime57.json)6capture targets/110v2-labelledtargets stopped/0namespacehelper, volumes giữ. Recipe package gzip57 chỉ chuẩn bị, CHƯA chạy vì review còn blocker; không tạo package/candidate final57.

[SEC preliminary57](../reviews/permission-hosted-hp1-sec-source57-preliminary-2026-10-14.md) tự chạy160tests và27mutants với positivebaseline/rehash/proposedPASS, bắt đúng các lỗi cũ; lượt clone đầu thiếu GIT_DIR có14prereqfail, reviewer giữ log riêng rồi dùng đúng isolatedGit recipe, không là retry requiredgate của tác giả. Reviewer tìm positive exporterPID2147483647 không xuất hiện raw log vẫn được nhậnPASS95. Đây là continuation SEC-02 actual identity chặn, tác giả nhận và sửa, chưa EVC.

Source58 bổ sung raw exporter-start/verified JSONrefs và đối chiếu toàn identity/token/visible/readonly/isolation, raw PGlog exact6split psql statements (BEGINRRREADONLY,SETapp,SETtimeout,export,verify,ROLLBACK), mọi importerACK sau export/trướcverify; rejectmissing/renamed/extra/outoforder/positiveghostPID. UTF8log fatal; session close nonzero không PASS. Đã kiểm helper mới correlate được actual source57 log (6statements, exporter218, indexes332<9157<9158), không in raw rows/SQLlogs. Windows172/172 (145hosted+27controllers) PASS.11new actual graph forgeries (gồm metadata+raw-observation cùng giảPID nhưng rawlog giữ nguyên) sẽ kiểm nguồn58; runtime75/fullgates mới chưa claimPASS. Hai ref mới là raw evidence LOCAL, không independent release trust channel hoặc provider certification.

LOCAL trust arguments nguồn57 đã được tái lập từ persisted receipt/manifest và constants recipe, ghi ngoài graph riêng tư; [replay](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/local-external-trust57.json) LOCAL_HARNESS_PINNED/noDB nhưng requireHostedCutover từ chối HOSTED_PROFILE_UNSUPPORTED, ownerAcceptedReleaseChannelfalse. Không gọi việc tái lập này là third-party authentication hoặc owner chọn trust channel. Các bytes/recipe và receipt history được giữ; không dùng để cấp hosted eligibility.

## Sự cố dung lượng WSL và phòng ngừa, 15/10/2026

Phân tích hồi cứu từ session `01a1398d-3932-79c3-bcfd-01147e5990fa`, scripts/receipts trên
Windows và kiểm máy trước khi xóa distro. Nguyên nhân cốt lõi là lifecycle kiểm thử tích lũy
runtime qua từng source/attempt và không có ngân sách/ngưỡng dung lượng thực sự chặn ghi.

- `D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/pipeline.py:4` tạo ROOT
  riêng theo source; dòng15 đặt npm cache riêng, dòng17 tạo root mới, dòng30 chạy npm ci.
  Các source41–58 có 18 receipt install.json với exitCode0. Chúng minh chứng 18 lần chuẩn
  bị/cài độc lập; không phải phép đo dung lượng còn lại của mỗi thư mục sau khi xóa distro.
- `D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/gate-namespace.py:23`
  tạo containerd root riêng theo attempt, dòng30 tạo Docker data-root riêng, dòng40 nạp
  lại images.tar. Dòng46 chỉ dừng daemon/containerd; không xóa data-root, image store hoặc
  volumes. Đây là cơ chế nhân kho dữ liệu khi tạo thêm attempt; không phải chỉ thêm tên namespace.
- `gate-isolation-inputs.json` ghi archive của 12 image là 1.998.099.968 bytes trước khi
  giải nén/nạp. `final-runtime57.json` ghi 110 target v2-labelled, 6 capture targets dừng,
  capture volumes vẫn giữ. Những count lịch sử không đại diện dung lượng của từng target.
- Session có đo dung lượng C nhưng vẫn tiếp tục: 14/10/2026 20:47 +07 còn17,1 GiB;
  20:50 còn14,9 GiB; 21:12 còn14,4 GiB. Một output khác đồng thời ghi Linux còn807,2 GiB
  và Windows C còn19,5 GiB. WSL dùng VHD tăng theo nhu cầu với filesystem tối đa khoảng1 TiB;
  Linux free không phản ánh headroom thật của C. Script prepare/namespace không có guard
  host-disk budget trước thao tác ghi lớn. Đo rồi tiếp tục không thay được guard.
- Session ghi nhận C gần đầy (~165 MiB) rồi WSL I/O/emergency_ro, không thể chạy lệnh mới.
  Phần nhân runtime và thiếu stop threshold là lỗi quản lý tài nguyên trong cách agent
  thực thi task. Không giải thích thành nhu cầu tất yếu phải giữ 174 GiB để chạy test.

Giới hạn kết luận: distro đã bị xóa theo ưu tiên của owner, nên không còn đo du từng thư mục
để phân bổ chính xác 173,924 GiB. WSL đã dùng109 GiB ở checkpoint sớm; chưa chứng minh toàn
bộ dung lượng đó do riêng HP1 tạo. Một quan sát driver source51/ns04 là overlayfs; không có
căn cứ quy sự cố này cho Docker vfs hoặc tự chốt phần trăm dung lượng của một thành phần.
Không đo lượng blocks đã xóa nhưng chưa thu hồi trong VHD trước unregister.

Owner đã ưu tiên thu hồi dung lượng thay giữ dữ liệu sinh ra. Unregister đúng Ubuntu-24.04
exit0, VHD không còn, distro list trống; thu hồi173,924 GiB. Windows package56 được kiểm SHA
khớp receipt; không gọi đó là backup toàn WSL/source58. HP1 và hosted readiness vẫn chưa hoàn tất.

Phòng ngừa đã ghi vào AGENTS toàn cục: không tự dựng lại WSL/Docker cho task cũ; mặc định
ngân sách dữ liệu mới20 GiB/task, reserve30 GiB trên C/backing drive, một môi trường nặng
đang dùng, dọn đúng generated runtime thay thế và kiểm headroom trước mỗi thao tác lớn.
Các ngưỡng số là mặc định thận trọng do agent chọn, không ghi thành owner đã phê duyệt số.
Nếu owner cho phép tạo distro mới thì phải chốt/kiểm trần filesystem (mặc định64 GiB), vị
trí VHD và ngân sách tổng. Không giảm coverage/acceptance/privacy để đáp ứng ngân sách;
nếu xung đột thì dừng phần phụ thuộc và báo. Chưa sửa runner frozen/application code,
chưa áp dụng quota WSL hoặc tự cài distro. Đây là safeguard bằng hướng dẫn, không phải
cam kết tuyệt đối hệ điều hành đã chặn mọi tiến trình chiếm ổ đĩa.

Nguồn kỹ thuật gốc: [Microsoft: disk space](https://learn.microsoft.com/en-us/windows/wsl/disk-space)
và [defaultVhdSize](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#configuration-settings-for-wslconfig).
`defaultVhdSize` là giới hạn filesystem distro, không phải giới hạn tổng của nhiều distro,
swap hoặc writes ra ổ Windows. `sparseVhd` không thay thế quota hoặc lifecycle cleanup.
