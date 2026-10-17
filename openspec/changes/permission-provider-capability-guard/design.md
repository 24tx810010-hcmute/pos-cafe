# Thiết kế guard provider capability

## Đường xử lý

Shared guard đọc native actor/capabilities như hiện tại cùng catalog provider. Tính một full supported provider profile boolean từ các row GUC đã đăng ký, preload token, effective inherited role, whitelist/reserved token và exact policy grant. Hai capability cuối nhận `native || supportedProviderProfile`. Bốn error codes và API resolve hiện hành giữ nguyên; không có thông báo UI mới.

Lookup membership dùng role OID trong catalog với `pg_has_role(...,'USAGE')`, tránh lỗi role absent và không chỉ dựa trực tiếp vào một dòng membership. Parser token chỉ nhận token đơn giản, trim whitespace; các cú pháp không được hỗ trợ fail closed. JSON object/array/string được kiểm kiểu, không dùng substring hoặc truthiness để cấp fallback. Không nội suy giá trị catalog vào câu SQL thực thi.

Kiểm `pg_settings` context/source/pending restart giúp không nhận custom placeholders do session tự khai báo. Không xác minh binary version/hash hosted qua SQL khi provider không cung cấp API đó. Pin image/binary của rehearsal; runtime execution mới là bằng chứng hành vi của binary đó. Native path vẫn có thể bị provider khác chặn DDL sau preflight; transaction/prepare recovery xử lý failure như trước, không tuyên bố guard là proof mọi quyền DDL.

## Clone và test profile

Copy offline volume `pos-cafe-restore-1790593558895-4c7ba556-data` sang volume mới, source read-only. Image có sẵn `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb` (PG17.6). Binary supautils trong image có derivation version 3.4.0, SHA-256 `8226c53a3025eb377de2194e93cd36da328f1b678e33a567ffb1fa2c289a737d`; xác minh lại trước chạy. Đây là binary local, chưa chứng minh giống hosted.

Cấu hình trusted startup nạp library `supautils`, bốn GUC lấy từ artifact live 06/10; thiết lập membership privileged role trong clone giống quan sát live nếu restore chưa có. Không thêm native grant SET hoặc membership `supabase_storage_admin`. Capture baseline sau dựng profile để phân biệt config test chủ động với dữ liệu/DDL do test thay đổi. Kết nối actor postgres qua Unix socket cùng volume, không TCP/DSN live. Service account setup local chỉ chuẩn bị profile; guard/DDL assertions chạy bằng actor NOSUPERUSER.

Runner dùng Docker/WSL đang có, image pinned, clone owned labels, không external network/published ports. Node runtime hỗ trợ Unix socket đặt cùng container namespace hoặc dùng container sidecar local đã pin; không reuse services khác. Copy source/test cần chạy vào directory riêng, readonly khi có thể; không thay original backup/proof. DDL prepare/restore kiểm thật, image fragment luôn rollback. Negative profile được đổi bởi setup actor chỉ trong clone; reconnect actor để preload/config mới có hiệu lực, kiểm guard trước effect.

## Đánh đổi và rủi ro

Full-profile fallback hẹp hơn mọi khả năng supautils: có thể từ chối profile khác vẫn làm được DDL; đổi lại phù hợp đích hiện có, ít phép suy quyền. Catalog proof không xác nhận code extension không drift; rehearsal pin binary và current hosted preflight phải đọc lại khi release. Profile mất sau guard có thể làm prepare/activation fail; các transaction, locked recheck và recovery hiện hành giữ nguyên. Không đổi cleanup scope/commit default/unknown outcome.

## Tài liệu gốc

[Supabase configs](https://supabase.com/docs/guides/database/custom-postgres-config), [supautils README](https://github.com/supabase/supautils/blob/master/README.md), [role settings](https://github.com/supabase/supautils/blob/master/src/roles.c), [policy handling](https://github.com/supabase/supautils/blob/master/src/table_grants.c). Master là nguồn giải thích, binary local được pin riêng; không dùng nguồn master thay proof binary hoặc hosted.
