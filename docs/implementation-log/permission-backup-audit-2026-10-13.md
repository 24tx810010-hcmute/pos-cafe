# Audit backup, sequence và quiescence — 13/10/2026

**Kết luận bước1: cần kiểm chứng một phương án logical backup không bắt freeze toàn provider; chưa đủ điều kiện chạy phương án đó hoặc đổi gate.** Giữ nguyên strict74/75 FAIL, preservation-only/cleanupEligible=false của backup cũ và phase2 BLOCKED. [Quyền](../workflow/tasks/permission-backup-audit-2026-10-13.md), [matrix](permission-backup-audit-matrix-2026-10-13.md), [proposal bước2](../runbooks/permission-backup-step2-proposal-2026-10-13.md).

## 1. Phân biệt năm điều cần chứng minh

1. **Backup snapshot:** đủ nội dung logical DB và catalog theo exported snapshot; sequence/roles có giới hạn riêng. Không bỏ provider tables chỉ vì không có SHARE.
2. **Isolated restore:** khôi phục đúng archive, metadata/roles/ACL và payload; sequence có semantics cấp ID phù hợp dữ liệu đã khôi phục. Clone superuser không chứng minh quyền cutover postgres hosted.
3. **Live restore:** phải dừng ghi và không mất giao dịch sau backup, hoặc đối soát/khôi phục đầy đủ. Clone khớp archive không thỏa điều này.
4. **Cleanup+activation:** same connection/READ COMMITTED transaction, khóa closure thực, full-row/catalog/FK/scope recheck, empty tenant và postflight; rollback phải được diễn tập.
5. **Preservation:** giữ 66 Auth ngoài scope và object thứ3; DB metadata và Storage bytes không cùng một MVCC snapshot. Không xóa thêm bằng count/date/prefix.

Design8.2.1:270 quy định lock set cho mục4 và loại việc mặc định khóa mọi migration/provider table ngoài scope. Runbook phase2 mở rộng full64/stop mọi Auth-Realtime-Storage writer **cho mục1** để đáp ứng ổn định sequence/full window. Hai câu không cùng pha nên không tự mâu thuẫn logic; vấn đề là phần mở rộng chưa được chứng minh là điều kiện cần của yêu cầu backup gốc. T17/T18, TC53 và force-default-pin-change yêu cầu verified backup/preservation/recheck; không nêu blanket freeze provider khi pg_dump. Gate strict75/75 về sau đã được ghi trong tasks/phase2; cần quyết định thay đổi có căn cứ, không âm thầm bỏ.

## 2. Sequence 327/328: đọc lại chính xác

Nguồn private backup `C:/Users/nguye/AppData/Local/pos-cafe-release/backups/database-20261013T073030255Z-0c33f5ee/`; bản audit sanitized [input-audit.json](D:/Workspace/pos-cafe/artifacts/permission-backup-audit-20261013/input-audit.json). Không SELECT mới hoặc nextval live.

| Quan sát | Thời điểm UTC / ý nghĩa |
| --- | --- |
| Exported snapshot | Receipt bắt đầu07:30:36.638, kết thúc07:39:53.039; `0000003B-00001653-1`. Đây là thời gian receipt sau export, không log thời điểm commit của từng transaction |
| Probe before Auth | Batch bắt đầu07:32:00.628: lastValue327, isCalledtrue. **Không phải giá trị sequence tại instant exported snapshot**; helper gọi SELECT live riêng |
| Archive | setval(Auth,328,true), public166,true, Realtime3017,true; SQL đã trích SHA `8eefdeefe6a255a3862f6a6d84e2e912c5ad97e076324fd184b0aea7d678f818`. Không có exact wallclock của từng archive sequence read |
| Probe after | Batch bắt đầu07:39:46.155: Auth328,true; public166,true; Realtime3017,true |
| Clone | Restore execution07:41:43.571; scope SELECT receipt07:48:20.439 ghi ba sequence khớp archive. Auth max(id)=327 trong clone chứa rows từ snapshot |
| Strict verifier | Duyệt `metadata.sequences.after` (Auth expected328,true), rồi bắt `!changedDuringBackup`. Vì cờ drift true nên FAIL dù giá trị clone khớp328. Không phải lỗi clone327≠archive328 |

Code: [backup:497](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/backup-preservation.mjs:497), [before/dump:757](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/backup-preservation.mjs:757), [after:818](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/backup-preservation.mjs:818), [verifier:75](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/verify-restored-db.mjs:75). Điều kiện no-drift đã có trong helper private `verify-local-restore.mjs:75–80`, không phát sinh lần đầu ở phase2. Backup helper chỉ ghi drift, vẫn tạo VALIDATED_LOGICAL_BACKUP; strict restore helper mới làm drift thành FAIL. Phase2 planner biến strict75/75 thành điều kiện chuẩn bị và suy ra quiescence rộng, nhưng không có logic executable chứng minh necessity đó.

DDL archive `schema.sql:7487,7512,7526,8655`: Auth id bigint, sequence mặc định bigint, start1/increment1/cache1/no cycle (không có CYCLE), min mặc định1/max9223372036854775807, owner supabase_auth_admin, OWNED BY auth.refresh_tokens.id, default nextval đúng sequence. Recipe [backup:724](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/backup-preservation.mjs:724) hash name/schema/owner/type/start/increment/min/max/cache/cycle; comparison metadata `sequences` có3 rows, SHA `114b8ed2a6bf0f86fc80899ba6512d699b83675147fc644880d7129a182db6d5`, matchedtrue. Dependency/default/identity cần archive DDL review riêng vì không nằm trong recipe này.

Với profile Auth cụ thể đó, clone chưa có session cấp số và `(328,true)` cho lần cấp kế tiếp329, lớn hơn max327 và nằm trong bigint range. Đây là **suy luận allocation cho dữ liệu clone**, không lời khẳng định toàn dump an toàn. Không kiểm bằng gọi nextval trong audit. Public.store_no_seq được hàm `public.get_next_store_no()` cast integer (`schema.sql:2120,2124`), nên checker tương lai phải xét consumer range, không chỉ range bigint của sequence. Realtime dùng GENERATED ALWAYS AS IDENTITY (`schema.sql:8415`). Receipt hiện tại chưa có per-sequence consumer extrema cho public/Realtime; chưa coi chúng qua allocation proof tổng quát.

Sequence advance concurrent là lời giải thích phù hợp semantics PostgreSQL, không chứng minh writer nào/commit nào tạo328. Abort, standalone nextval, setval/reset/cycle/cache và explicit IDs đều phải xét. Higher number không đủ chứng minh safety; equal before/after cũng không loại ABA/reset hoặc writes xen giữa. Không hạ expected xuống327, không setval clone/live, không chỉnh archive/metadata. [PostgreSQL17 sequence functions](https://www.postgresql.org/docs/17/functions-sequence.html) nêu nextval/setval không rollback như rows; [CREATE SEQUENCE](https://www.postgresql.org/docs/17/sql-createsequence.html) mô tả type/range/cycle/cache và default.

## 3. 74/75 gồm gì và chưa chứng minh gì

Audit file đọc actual comparison:63 table count/full-row digest +6 metadata groups (extensions/schemas/functions/RLS/grants/sequences) +large objects +database owner/ACL/settings +exact extension inventory +3 sequence checks =75. Final74 matched, chỉ Auth sequence stability FAIL. Initial72/75 còn schemas/grants; clone được supplement ACL, không sửa original dump. TOC1051 entries,63 TABLE DATA,3 SEQUENCE SET; các partition trong restore execution phủ1051 không overlap/unassigned. Toàn file được manifest hash đều khớp trong audit này; dump869498byte SHA `72d8ddc864056817b9a2623386575cf78401b83a7004923418b25ebf1863917c`.

Không coi75 là số cố định của mọi schema: future coverage phải derive exact object/check identity từ catalog/TOC; bằng nhau về count không đủ. Full64 là inventory relation r/p của phase2;63 là TABLE DATA của archive cũ, partition parent không có dữ liệu trực tiếp. Không dùng59 có quyền SHARE làm giới hạn backup, cũng không đồng nhất64 relations với64 TABLE DATA.

Restore code [restore-preservation:103](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-preservation.mjs:103) kiểm hashes/input/isolation, thực thi roles/TOC/pg_restore theo log ở private restore directory. Audit chỉ đọc/hashing logs và receipts, không rerun commands. Post-archive bootstrap supplement lúc07:41:06.234 là separate snapshot. Roles không password; DB+Storage không physical/PITR, Vault root key chưa có proof. Original DB metadata và API-upload vào private bucket mới là **hai target**, không full hosted recovery đồng thời. K table0 không chứng minh K recovery bằng dữ liệu thật.

## 4. Căn cứ công nghệ và giới hạn

- [pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html): backup consistent khi có concurrent use; `--snapshot` dùng snapshot chỉ định. Không suy bảo đảm Storage/roles/sequence transactional từ câu này. Helper đã dùng full custom/create, không filter bỏ5 bảng thiếu SHARE.
- [Snapshot synchronization](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION): importer dùng view chung khi exporter còn mở. Mất exporter/DDL race/capture khác snapshot phải được phát hiện trong rehearsal.
- [LOCK17](https://www.postgresql.org/docs/17/sql-lock.html): SELECT cho ACCESS SHARE; SHARE cần quyền mạnh hơn; SHARE chặn DML nhưng cho dump reader. Lock trước SELECT nếu cần latest state trong RR. Quyền dump/read và quyền freeze writer không đồng nhất.
- [Supabase backups](https://supabase.com/docs/guides/platform/backups): DB backup không chứa Storage object bytes. [Storage schema](https://supabase.com/docs/guides/storage/schema/design): metadata và object storage tách nhau, mutations đi API. [Network restrictions](https://supabase.com/docs/guides/platform/network-restrictions): không áp HTTPS Auth/Storage/PostgREST.

Đã đọc nguồn chính thức13/10/2026. Chúng giải thích semantics, không chứng minh capability project thực hoặc version/binary Auth/Storage hosted. Lab29/29 lịch sử chỉ synthetic PG17.6/privilege owners, realtime.messages parent topology không matching; không có Storage HTTP. Không dùng upstream master làm hosted binary.

## 5. Phương pháp và giới hạn phiên này

Chỉ đọc docs/code/private metadata/schema/TOC/sequence extraction/restore logs và website chính thức. [Script](D:/Workspace/pos-cafe/artifacts/permission-backup-audit-20261013/inspect-inputs.mjs) Node24.16.0 chỉ đọc file/hash và ghi receipt mới, không import executable verifier. Hai lần gọi ban đầu fail INPUT_AUDIT_MISMATCH vì hai Realtime source files drift; lần thứ hai thêm output diagnostic whitelist để xác định nguyên nhân, giữ bản đó là v1. Shell batch lần đầu trả exit0 do lệnh git cuối thành công, không phải script PASS; lần diagnostic riêng trả exit1. V2 ghi drift thay vì coi unrelated source change là lý do cấm audit lịch sử; không đổi restore expectation. Lần gọi tiếp theo exit0 chỉ xác nhận file audit hoàn thành, **không phải backup/restore PASS mới**. Không live DB/LOCK/ALTER, không container start/lab mới, không browser/Playwright. Hai git HEAD như handoff; dirty trees bảo toàn.

Candidate khóa nguồn relevant/docs/support và input hashes, copy nội dung public có thể phục hồi; raw private giữ nguyên nơi ACL private, chỉ hash/path trong manifest. Review SEC→EVC bắt buộc. Chỉ review metadata được bổ sung sau khóa; mọi thay kết luận/criteria/evidence cần candidate mới và review lại. Không tự nhận source34 được phát hành hoặc Tailwind3 risk accepted.

## Metadata kết quả review

SEC→EVC đã **APPROVE cùng candidate02** SHA `05d906c8157b5f914017f94b5b55a62aec0043a2d805f79503131adb78e526c2`; [review](../reviews/2026-10-13-permission-backup-audit.md). SEC-01 tên hàm đã sửa trước freeze02; không còn blocker. EVC-N1 ghi source drift2 là observation15:18, reviewer15:35 thấy drift0/812; không promote runtime proof. Bước1 analysis hoàn tất; proposal bước2 chưa chạy, mọi gate live/criteria hiện hành và74/75FAIL giữ nguyên.
