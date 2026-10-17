# Phase2 — khảo sát quiescence và cửa sổ đề xuất, 13/10/2026

**Chưa có phương án hosted đủ điều kiện thực thi. Không chạy block lệnh này trên hosted.** Runbook này là hồ sơ chẩn đoán/chuẩn bị của [phase2](../workflow/tasks/permission-close3-phase2-2026-10-13.md), không cấp quyền mới. Không sửa sequence, grant, owner, Auth settings, provider/domain/env hoặc deploy maintenance page để ép gate đạt.

## Kết quả loại trừ phương án

| Phương án | Chứng cứ và kết luận |
| --- | --- |
| Banner frontend / đóng tab | Không chặn client cũ, direct API, token refresh hoặc background workers; không dùng làm quiescence |
| Supabase network restrictions | Tài liệu provider nêu chỉ áp DB/pooler, không áp HTTPS Auth/Storage/PostgREST; còn có thể chặn chính backup reader. Không thay setting |
| SHARE trên mọi bảng | Actor postgres thiếu quyền MAINTAIN/UPDATE/DELETE/TRUNCATE ở `auth.schema_migrations`, `realtime.schema_migrations`, `storage.buckets_vectors`, `storage.migrations`, `storage.vector_indexes`; lab trả42501. Có59/64 bảng cho SHARE. Không bỏ năm bảng khỏi full-backup gate |
| SHARE trên59 bảng được phép | Chặn INSERT Auth trước cấp sequence default, UPDATE business/Storage metadata; pg_dump đọc được. Nhưng standalone nextval vẫn chạy; không bảo đảm toàn sequence hoặc payload/background Storage |
| LOCK TABLE sequence | PostgreSQL trả42809 trong lab; không phải cách khóa sequence |
| ALTER SEQUENCE CACHE1 trong transaction | Có thể chặn nextval khi actor là owner; postgres không owner/cannot SET ROLE đối với Auth/Realtime, lab trả42501. Owner chỉ dùng trong synthetic counterexample, không đổi quyền provider |
| ACCESS EXCLUSIVE toàn bảng | Chặn cả pg_dump ở connection khác; lab backup timeout. Không giải bài toán backup đọc được |
| Đặt default_transaction_read_only | Chỉ là default có thể bị session thay; không chứng minh drain/inflight hoặc external Storage. Không chạy ALTER ROLE/DATABASE/SYSTEM |

Đọc nguồn [LOCK PostgreSQL17](https://www.postgresql.org/docs/17/sql-lock.html), [sequence/owner](https://www.postgresql.org/docs/17/sql-altersequence.html), [sequence ngoài MVCC](https://www.postgresql.org/docs/17/functions-sequence.html), [session timeouts](https://www.postgresql.org/docs/17/runtime-config-client.html), [network restrictions](https://supabase.com/docs/guides/platform/network-restrictions). Upstream [Storage uploader](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts) tách upload backend với metadata completion và queued cleanup; chỉ dùng để chỉ ra lớp cần kiểm, **không gán master source là binary hosted đang chạy**. Local lab không chạy HTTP Storage, không chứng minh replacement an toàn trên hosted.

## Gói control còn thiếu để owner/provider xác nhận

Không chỉ thiếu giờ chạy: hiện thiếu khả năng dừng đúng lớp writer. Cần một cơ chế provider hỗ trợ cho project `kfqjdfwxhkdwihjobpny`, giữ pooler/DB read-only backup và Storage GET hoạt động, đồng thời:

1. Chặn request mutation mới của legacy PostgREST/RPC, Auth bootstrap/signin/refresh và Realtime registration; chặn kết nối DB writer/operator khác và provider migration/DDL trong window.
2. Dừng nhận Storage upload/upsert/replacement/delete cả standard/TUS/S3; drain in-flight và background cleanup. Không chỉ khóa metadata rồi giả payload không đổi.
3. Có receipt xác nhận thời điểm control thực sự có hiệu lực, worker/inflight đã drain, quyền actor sử dụng, cách đọc trạng thái và tự khôi phục khi operator mất kết nối.
4. Có đường đọc DB/sequence/catalog/full rows và Storage payload đủ quyền trong window; không đòi đổi role owner/grants. Pause toàn project không đáp ứng nếu DB cũng ngừng đọc.
5. Có thể diễn tập môi trường tương ứng và kiểm timeout/fault/reopen trước khi dùng hosted. Binary/profile chưa lấy được phải giữ limitation, không gọi cùng PG17.6 là byte-identical.

Đề xuất vận hành để chốt **sau khi có control**: tối đa20 phút dừng writer, mở khi cả maintenance và backup operator xác nhận; acquisition ceiling5s, abort backup trước phút18 để còn2 phút rollback/reopen. Đây là ceiling đề xuất, **chưa owner duyệt và chưa benchmark helper mới**; backup trước mất khoảng9 phút17s nên không hứa sẽ kịp. Ảnh hưởng toàn project: Auth refresh/signin có thể lỗi/timeout với145 Auth, gồm66 ngoài scope; business writes và Storage changes tạm không nhận. Object3/66 Auth giữ nguyên, không mở rộng cleanup. Nếu control yêu cầu settings/cost/permissions khác, trình exact diff/impact để owner chốt trước thực thi.

Nội dung có thể hỏi provider (chưa gửi): “Project này cần một cửa sổ tối đa20 phút dừng Auth/Realtime sequence writers, mọi database mutation và Storage mutation/background deletion, nhưng vẫn cho DB pg_dump/SELECT và Storage GET. Có control nào hỗ trợ, drain chứng minh bằng gì, thời hạn tự rollback và cách reopen là gì? Không đổi ownership/grants hay rotate credentials.” Owner có thể cung cấp tài liệu/control cụ thể để tiếp tục kiểm; không tự tạo/gửi ticket hoặc mua gói.

## Trình tự/session commands đã diễn tập cục bộ

Lệnh ở [test-quiescence-lab.mjs](D:/Workspace/pos-cafe/artifacts/permission-close3-phase2-20261013/test-quiescence-lab.mjs) chỉ nhận container ID/image/volume/instance pin, network none/socket `/lab`. Không có live DSN.

```sql
-- LOCAL DIAGNOSTIC ONLY, không phải hosted maintenance recipe đã duyệt.
BEGIN;
SET LOCAL lock_timeout = '500ms';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL transaction_timeout = '18s';
-- Danh sách59 bảng synthetic có quyền, thứ tự schema/name từ manifest đã pin.
LOCK TABLE <exact_sorted_synthetic_relations> IN SHARE MODE;
-- Separate concurrent test connections: Auth INSERT/business UPDATE/Storage UPDATE.
-- Separate pg_dump connection: READ ONLY, --lock-wait-timeout=1s.
ROLLBACK;
```

Lock order trong lab: schema/name cố định, acquire tất cả trước export snapshot/read. Trong hosted proposal cần provider gate/drain trước, rồi actor quyền phù hợp khóa đầy đủ theo catalog pin; **không dùng danh sách59 local thay danh sách full64**, không tự cấp quyền để mở rộng. REPEATABLE READ snapshot phải được tạo sau acquire/drain, không đọc trước khóa rồi giả bao gồm commit vừa chờ.

READ ONLY vẫn cho SHARE lock trên PG17.6 trong lab; “read-only transaction” không chứng minh không ảnh hưởng writer. Vì vậy hosted read-only inspection phiên này chỉ SELECT, không LOCK. Maintenance receipt phải riêng backup receipt. Lock timeout/idle timeout/transaction_timeout dùng SET LOCAL trên session owned, không ALTER hệ thống. Idle timeout test1s và hard transaction timeout1,2s đã chứng minh session bị hủy, writer chạy lại; EOF/ROLLBACK cũng giải phóng. Timeout production20 phút chưa được thử, không suy từ test ngắn thành duration rehearsal.

## Abort, phục hồi và reopen

Nếu identity/source/exact79/Auth outside/FK/catalog/Storage version drift, capability thiếu hoặc lock hết5s: abort trước backup đủ điều kiện, giữ mọi dữ liệu và receipt. Nếu mất lock/control trong lúc backup: hủy nhãn eligible; lưu partial/private diagnostics, không tự tiếp tục/retry/restore live. Nếu COMMIT hoặc provider-control ACK không rõ: đọc trạng thái đúng actor/control token; không chạy lặp mù.

Kết thúc coordinator: ROLLBACK hoặc close đúng connection; deadline server là lớp dự phòng, không dựa vào frontend timer. Chỉ khi có live control đã được chốt mới cần chạy inverse đã pin và xác nhận trạng thái trở về snapshot setting trước. Phiên hiện tại không đổi hosted setting nên không có inverse hosted nào đã chạy. Không terminate session provider/khách hàng để dọn cho nhanh.

Reopen thực tế còn NOT RUN: kiểm control inactive, owned transaction/lock còn0, provider services healthy, exact roles/settings trở về baseline, read-only Auth/settings/Storage GET phù hợp, sequence/catalog không drift ngoài window đã ghi. Giao dịch lỗi do maintenance phải được người dùng/recovery flow xử lý đúng K/R1; không tự post business write, tạo Auth user hoặc consume sequence trên hosted để “test mở lại”. Khi cần kiểm live mutation phải có quyền cụ thể. Không restore backup cũ lên live hoặc bỏ writes sau snapshot.

## Đầu ra sau khi unblock

Helper mới pin exact77+2 có provenance; fresh snapshot/sequence before-after, all dumpable table full-row hashes, roles/catalog/ACL, Storage metadata+payload3objects trong window; new isolated actual restore strict75/75 và Storage3/3. Nếu K0 thì ghi K0, không tạo K live. Logical backup không phải PITR/physical provider/root-key recovery. Full provider/controller rehearsal thuộc phase3 sau phase2, chưa thực hiện và chưa quyền cutover/release.

## Successor đã chấp nhận — 14/10/2026

[BACKUP-AB-14 và planner v2](permission-backup-v2-2026-10-14.md) thay yêu cầu normative full64/global-sequence no-drift mặc định cho B/I ở runbook này. Nội dung13/10 bên trên là historical diagnostic/proposal; không dùng làm executable recipe hiện hành. B/I shared-snapshot logical fidelity; C theo actual dependency closure/full-row Auth outside+catalog/roles; Storage global ingress/inflight/background control; L riêng. executionReady=false/cleanupEligible=false cho tới actual capabilities. Không có window mới hoặc quyền hosted.
