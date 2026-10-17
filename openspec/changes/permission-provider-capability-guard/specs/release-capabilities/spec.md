# Release capability guard

## PGCG-01 — Actor invariant

Hệ thống SHALL giữ actor đúng `executionRole`, NOSUPERUSER, BYPASSRLS và CREATEROLE trước mọi mutation prepare/cutover. Sai actor/attribute trả các mã hiện có `PRODUCTION_EQUIVALENT_ROLE_REQUIRED`, `ALTER_ROLE_PRIVILEGE_REQUIRED`.

## PGCG-02 — Hai đường capability

Hệ thống SHALL nhận đủ hai capability qua predicate native hiện hành hoặc qua profile supautils được nhận diện đầy đủ theo PGCG-03. Native đủ quyền vẫn được nhận. Không đủ quyền hook trả `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`; không đủ policy capability trả `STORAGE_OBJECTS_OWNERSHIP_REQUIRED`. Không dùng DML privilege thay policy capability. Guard chỉ là preflight bảo thủ; không bảo đảm mọi DDL/rollout sẽ thành công.

## PGCG-03 — Profile provider được hỗ trợ

Fallback SHALL chỉ được dùng khi nạp token library `supautils` ở shared/session preload; bốn GUC `supautils.privileged_role`, `supautils.privileged_role_allowed_configs`, `supautils.reserved_roles`, `supautils.policy_grants` thực sự có trong `pg_settings`, context `sighup`, nguồn `configuration file` hoặc `command line`, không pending restart. Role cấu hình SHALL là `supabase_privileged_role` và actor có effective inherited USAGE. Whitelist SHALL có token chính xác `pgrst.db_pre_request` hoặc `pgrst.*`; reserved roles có `authenticator*`; JSON policy grants là object có array tại key actor, chứa string chính xác `storage.objects`.

Thiếu/sai kiểu/sai token/chưa nạp/không kế thừa SHALL không mở fallback. Không xét tên gần giống, wildcard tùy ý hoặc key role khác. Placeholder `current_setting` đơn thuần không đủ chứng minh GUC đã đăng ký. Fallback là profile hẹp phù hợp quan sát live, không hỗ trợ mọi cấu hình hợp lệ của supautils.

## PGCG-04 — Guard chỉ đọc

Guard SHALL chỉ đọc catalog trên connection hiện tại; không cấp quyền, SET ROLE, thử DDL, thay owner, cập nhật GUC hoặc tạo đối tượng trong preflight. SQL lookup SHALL không nội suy role/config thành SQL. Các nơi gọi shared guard và thứ tự trước prepare/cutover giữ nguyên.

## PGCG-05 — Rehearsal thật và hoàn tác

Trước bàn giao implementation, SHALL kiểm trên clone cách ly từ restore đã pin: actor native flags false, provider profile tương ứng; gọi guard thật; chạy exact compatibility prepare và fixed restore, chạy exact image fragment trong transaction rollback; catalog/data/role settings và table owner trở về baseline. SHALL kiểm negative guard khi thiếu preload, role membership, whitelist, reserved-role khả dụng hoặc policy grant. Không cấp native SET hoặc membership owner để làm positive provider test pass.

## PGCG-06 — Evidence và giới hạn

SHALL pin source/test/runner snapshot, DB image và binary supautils/profile, nguồn clone/volume isolation, runtime và kết quả từng case. Container mới network none, không published ports; bản nguồn/volume gốc chỉ mount read-only lúc copy và không chạy/sửa. Tắt dịch vụ của slice sau khi xong, giữ proof/volume khi cần truy vết. Kết quả mới không gán cho fingerprint cũ; không nhận clone proof thành hosted DDL hoặc release approval.

## I/O công cụ

| Input/output | Kiểu/ràng buộc |
| --- | --- |
| Guard input | Connection PostgreSQL đang mở; `executionRole`: tên actor đã được config release pin; không có SQL tùy ý |
| Catalog input | Bool attributes/native capabilities; preload string; bốn rows GUC typed như PGCG-03; effective role USAGE bool |
| Guard output | Resolve không mutation hoặc throw một trong bốn mã PGCG-01/02 |
| Runtime input | Restore container stopped đúng tên/volume/image đã pin, clone mới sở hữu bởi slice; source artifact/profile pinned; không DSN live |
| Runtime output | JSON từng case status/pass/failure, hashes/source/env/isolation; lỗi không serialize credential, không tự suy PASS khi thiếu case |
