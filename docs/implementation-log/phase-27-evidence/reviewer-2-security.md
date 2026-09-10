> Bản sao báo cáo độc lập, giữ nội dung/kết luận; thay tiền tố đường dẫn máy bằng nhãn worktree để đọc ngoài máy tác giả. SHA-256 file gốc: `c7852e861d3e0fb37547d56013712f1ccd790d874b8f51f9deb23f2097947edd`. Lệnh và artifact được ghi như bằng chứng lịch sử; summary không thay full manifest tại [verification](verification.md).

# Review bảo mật độc lập — reviewer 2

Ngày hoàn tất: 2026-09-10, 11:43 ICT. **Không có finding bảo mật được xác nhận trong phạm vi review.** Các kiểm tra thực thi cuối đều đạt; kết luận không thay thế nghiệm thu full manifest hoặc browser E2E.

Source được review là working tree `D:/Workspace/pos-cafe`, baseline `7183b31a4ca27ed2be3ca7097f391fd2c07f806c`, với spec tại docs commit `0ecf84deef9477b6c13716cc3aa972973a0c8e0b`. Đã đọc AGENTS.md, CLAUDE.md, design và các ca security/concurrency trong testplan trên worktree docs. Bản chụp 35 file không thay đổi so với review trước và không thay đổi giữa lúc chụp source, chạy test, chốt evidence.

## Kết quả thực thi

| Nhóm | Expected | Actual và bằng chứng |
| --- | --- | --- |
| Source/backend binding | DB test áp dụng đúng migration đang review; marker và local DSN rõ ràng | PostgreSQL **16.15 thật**, DB riêng `pos_cafe_idem_test_32e063404185` ở `127.0.0.1:55439`. Marker khớp. SHA-256 của **16/16 migration** trong marker khớp từng file hiện tại. `source-sha256-final.json`; `verify-final.mjs`. |
| Oracle độc lập SQL | Auth/quyền hiện hành, ledger immutable, replay, rollback và TTL theo contract | **23/23 ca PASS**, **9 barrier `pg_blocking_pids`** quan sát được giữa connection khác PID. Chạy lại bởi lượt review này. `native/oracle-final-results.json`, `native/oracle-final.log`; mã oracle `oracle-final.mjs`. |
| Permission matrix | 6 action × 5 endpoint × 3 actor; cả pending/terminal, deny thắng grant; denied không đổi K/counter | **180/180 ô PASS**: pending và rejected; A admin all, B kitchen được grant payment.take, C kitchen vừa grant vừa deny payment.take. Endpoint bị cấm trả FORBIDDEN; list bỏ lệnh; snapshot ledger trước/sau bằng nhau. Fixture cố ý dùng order/menu chưa tồn tại: ô execute được phép kết thúc rejected theo nghiệp vụ, không đánh đồng với successful business operation. `native/security-extra-results.json`. |
| Nguồn danh tính | Store JWT trần / actor thiếu quyền không sửa role, grants, active, PIN, không tạo/seed admin | **3/3 nhóm PASS**. Kiểm role/permission_overrides/is_active bằng DML và create/reset/seed qua RPC; raw employees không đổi. Cùng file extra. |
| Legacy RPC | Mọi chữ ký cũ bị thu hồi cho anon/authenticated | Inventory thấy **7 overload**. Gọi trực tiếp từng chữ ký bằng cả anon/authenticated trả SQLSTATE **42501**. Tham số NULL có cast được dùng để chọn đúng chữ ký; permission check xảy ra trước function body. Inventory ACL còn xác nhận anon/authenticated không EXECUTE. `native/functions-acl-final.json`, extra results. |
| Shadow/helper | Không có đường giả helper/table để giả employee | CREATE function trong public bằng authenticated bị 42501; temporary tables `employees`/`employee_sessions` không giúp token giả qua capabilities. Private SECURITY DEFINER functions đều có `search_path=pg_catalog`. **2/2 nhóm PASS**. |
| Supabase adapter | Không leak employee token sang Auth/Storage/origin khác; lock/signout/đổi store xoá credential; ACK cũ không khôi phục token; không retry RPC cũ | **21/21 test PASS, 0 skip**: 4 oracle độc lập + 17 test trong source `src/adapters/supabase/writeOperationRepo.test.ts`. Toàn bộ network thay bằng fake; không gọi Supabase qua HTTP. `adapter-final-results.json`, `adapter-oracle.test.ts`. |

`security-extra.mjs` có tổng cộng **192/192 nhóm/ô PASS** = 180 ô matrix + 3 nhóm identity + 7 legacy signatures + 2 nhóm shadow/path. Đây là coverage bổ sung của reviewer, không phải 192 test ID từ manifest dự án.

## Điểm đã kiểm bằng source và oracle

- **Danh tính và thu hồi:** token ngẫu nhiên 32 byte, trả chuỗi base64url 43 ký tự, DB chỉ giữ SHA-256 và hạn 12 giờ; output employee không có hash. Start-session giữ employee FOR SHARE, cùng thứ tự employee → sessions với reset/revoke. Hai race start/reset đều được quan sát bằng barrier thật; reset thắng thì PIN cũ không cấp token, start thắng thì reset thu hồi cả token vừa cấp. Inactive vô hiệu token và không cho start mới. `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:179` (014:179), `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:211` (014:211), `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:237` (014:237).
- **Quyền sau chờ khóa:** execute khóa business input trước khi khóa/đọc lại actor, rồi kiểm quyền mới. Oracle giữ order row, cho execute chờ, commit deny của cashier, thả order: FORBIDDEN, raw finance/table/event và pending ledger không đổi. Admin takeover sau đó chỉ tạo một payment 80.000, change 20.000, giữ initiator cashier và executor admin. `main-worktree/supabase/migrations/015_write_business_helpers.sql:66` (015:66), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:35` (016:35).
- **Đóng bypass:** INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES finance và ledger/audit không được grant; DML trực tiếp thực tế bị chặn. Employees SELECT chỉ whitelist, SELECT */passcode_hash bị 42501; config mutation cần verified admin, table status/identity ngoài whitelist; FK chặn parent cross-store. Toàn bộ tên RPC cũ được inventory qua pg_catalog, không chỉ latest signature. `main-worktree/supabase/migrations/016_activate_write_protocol.sql:196` (016:196), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:227` (016:227), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:257` (016:257).
- **Atomicity:** fault được đặt sau ghi business + audit + applied ledger cho create/pay/split/void. XX000 làm rollback toàn transaction, K vẫn pending; lỗi P0400 làm rollback subtransaction và chỉ ghi rejected ngoài subtransaction. Observer so toàn bộ JSON raw orders/items/options/payments/tables/events trước/sau, không chỉ đếm payments. Retry sau infrastructure fault applied; retry rejected vẫn rejected và chỉ tăng replay count. `main-worktree/supabase/migrations/016_activate_write_protocol.sql:82` (016:82), `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:47` (014:47).
- **Clock/TTL:** oracle cuối giữ nguyên implementation `clock_timestamp()`. Chỉ dịch registered_at/expires_at của fixture trong DB test, giữ chênh đúng 24 giờ; cho request chờ store advisory lock qua hạn. execute/cancel/get/list đều expired với raw business không đổi. Session hết hạn khi chờ cũng bị từ chối và giữ K pending. Thời gian quyết định lấy sau prepare/lock. `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:9` (014:9), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:65` (016:65), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:139` (016:139).
- **Replay/immutable:** register không ghi business, same-K/same-JSONB không đổi ledger; absent note và null là payload khác, mismatch bị chặn; result/actor/decidedAt giữ nguyên khi replay. Hai replay concurrent tăng chính xác 0→1→2; không thêm business/audit event. Cancel K chưa tồn tại không reserve key. `main-worktree/supabase/migrations/014_write_identity_and_ledger.sql:372` (014:372), `main-worktree/supabase/migrations/016_activate_write_protocol.sql:12` (016:12).
- **Adapter:** credential nằm trong WeakMap theo client, không persist; header được gắn cho cùng origin và `/rest/v1/`; generation ngăn PIN response cũ ghi đè phiên mới hoặc khôi phục sau lock. Các phương thức repo cũ còn trong source nhưng grants DB đã chặn; write adapter không fallback sang các RPC đó. `main-worktree/src/adapters/supabase/client.ts:18` (client.ts:18), `main-worktree/src/adapters/supabase/employeeCredential.ts:3` (employeeCredential.ts:3), `main-worktree/src/adapters/supabase/employeeRepo.ts:13` (employeeRepo.ts:13), `main-worktree/src/adapters/supabase/writeOperationRepo.ts:23` (writeOperationRepo.ts:23).

## Bằng chứng trước đó đã đối chiếu

`native/security.log`, `native/business.log`, `native/atomicity.log` được giữ từ lượt reviewer2 trước. Đã đọc runner tương ứng và đối chiếu checksum source; chúng báo PASS cho bootstrap/duplicate bootstrap, business create/retained/split/pay/void, TTL −1/equal/+1 ms, old order 48h/new K, terminal 48h replay, same-K concurrent, execute/cancel cả hai winner, create crossing midnight.

Không cộng các log trước vào số test được tự chạy lại ở bảng trên. Runner atomicity trước thay `write_clock` bằng clock điều khiển và tạm chèn hook vào prepare để thử midnight; vì vậy đó là PostgreSQL thật với thời gian/fault **được điều khiển**, không phải diễn biến thời gian thực. `seal-final.mjs` kiểm lại write_clock là `clock_timestamp()` và các helper production không còn hook sql_check/review. Fault trigger của oracle reviewer đã gỡ trong DB riêng sau test. Các file `oracle-*-harness-failure.log` là lỗi syntax/setup của harness cũ, được giữ để truy vết; không dùng làm bằng chứng PASS.

## Giới hạn kết luận

- DB engine, row locks, advisory locks, transaction/subtransaction, roles, ACL, RLS và pgcrypto là PostgreSQL thật. **Auth schema/users/auth.uid() là shim cục bộ**, claims/header được set trong SQL transaction; tests này không chứng minh xác minh chữ ký JWT, GoTrue, gateway, HTTP/CORS hoặc PostgREST transport thực tế.
- Adapter test thay mạng bằng fake. Chưa chứng nhận UI storage/telemetry thực tế, browser refresh/multiple contexts, delivery/ACK-loss qua gateway; phần đó cần bằng chứng E2E riêng.
- Permission matrix bổ sung dùng pending/rejected; applied replay/permission có oracle riêng, nhưng không tự nhận đã chạy mọi tổ hợp cancelled/expired/applied trong testplan. Review này cũng không chạy toàn bộ suffix của 93 test case/manifest dự án.
- Native migration fixture dùng schema legacy tạo từ migrations 001–013, không phải bản sao dữ liệu production. Không khẳng định mọi dữ liệu legacy thực tế vượt preflight 014 hoặc không cần xử lý riêng.
- Giữ đúng scope thiết kế: SELECT tài chính vẫn store-scoped; nhân viên nào có Store Key không đồng nghĩa đã có quyền ghi. Brute-force PIN, provisioning chủ thật và policy đọc theo role ngoài scope change này.
- Không đọc `.env.local`, không chạy remote `smoke:supabase`, không reset fixture Auth `55442`/proxy `55444` dùng chung; không sửa source ứng dụng/docs, không commit/push/deploy.

## Chốt source và tái hiện

`source-sha256-final.json` có snapshot 35 file đã review và SHA của 16 migration đối chiếu DB. `reviewed-source-final/` chứa bytes đã review. `final-evidence-sha256.json` chốt hash các script, logs, result JSON và kiểm source không đổi sau test. `findings.md` là kết luận findings ngắn.

Lệnh đã dùng (PowerShell, Node `D:/tools/nodejs/node.exe`):

```powershell
& 'D:/tools/nodejs/node.exe' 'reviewer-workspace/verify-final.mjs'
& 'D:/tools/nodejs/node.exe' 'reviewer-workspace/oracle-final.mjs'
& 'D:/tools/nodejs/node.exe' 'reviewer-workspace/security-extra.mjs'
& 'D:/tools/nodejs/node.exe' 'main-worktree/node_modules/vitest/vitest.mjs' run --config 'reviewer-workspace/vitest.review.config.mts' --reporter=json --outputFile='reviewer-workspace/adapter-final-results.json'
& 'D:/tools/nodejs/node.exe' 'reviewer-workspace/seal-final.mjs'
```

Các SQL runner chỉ chạy khi exact DSN và marker DB test riêng khớp. Không in token, PIN/hash hoặc JWT của fixture vào report.
