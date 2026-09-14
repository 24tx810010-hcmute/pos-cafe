# Phase 27 — Kiểm tra MCP và catalog database đích

Ngày kiểm tra: 2026-09-13. Chủ dự án yêu cầu kiểm tra MCP Supabase sau khi xác nhận đã áp dụng 014–016. Agent chỉ gọi công cụ đọc metadata/advisors và SELECT trên catalog; không áp migration, gọi RPC nghiệp vụ, tạo phiên nhân viên, ghi giao dịch, reset fixture hoặc chạy `smoke:supabase`.

## Kết quả xác minh

- MCP `supabase` đã có công cụ và trả lời được truy vấn. Project URL là `https://kfqjdfwxhkdwihjobpny.supabase.co`, khớp hostname `VITE_SUPABASE_URL` của app local. Chỉ đọc hostname cấu hình, không ghi credentials vào bằng chứng.
- Database trả về tên `postgres`, phiên bản PostgreSQL `17.6`; truy vấn MCP chạy với role `postgres`. Đây không phải kiểm thử hành vi dưới JWT của app.
- `list_migrations` trả về danh sách rỗng. Vì vậy không dùng lịch sử migration để xác nhận tên file, thứ tự hoặc thời điểm đã chạy; cũng không kết luận schema chưa được áp dụng chỉ từ danh sách rỗng.
- Đối chiếu **45/45 thân hàm** khớp bản local: 23 hàm của 014, 10 hàm của 015, 12 hàm của 016. Phương pháp: trích thân hàm từ file SQL, loại CR, trim khoảng trắng đầu/cuối, so MD5 với `pg_proc.prosrc` đã chuẩn hóa tương ứng. Trong đó `lock_write_input`, `prepare_write`, `apply_write` khớp bản 015 đã sửa F3. Không gọi đây là checksum toàn bộ file migration đã chạy.
- `private.employee_sessions`, `public.write_operations`, `public.order_events` tồn tại. Các cột `orders.created_by_employee_id`, `orders.last_modified_by_employee_id`, `payments.receipt_snapshot`, `order_item_options.snapshot_sort_order` tồn tại.
- Cả 7 chữ ký RPC cũ còn tồn tại thuộc submit/pay/split/void/verify/hash đều không có EXECUTE cho `anon` hoặc `authenticated`, gồm hai overload `pay_order_items`.
- `anon` và `authenticated` không có quyền ghi bảng hay cột trên orders/items/options/payments; không có quyền đọc/ghi ledger, audit và employee_sessions. `tables.status` không cho authenticated INSERT/UPDATE. `employees.passcode_hash` không cho hai role đọc và không cho authenticated sửa.
- RLS đang bật trên bốn bảng tài chính, write_operations và order_events. Các policy tài chính vẫn kiểm `store_id = auth.uid()`; quyền mutation ở tầng grants đã bị thu hồi. employee_sessions ở schema private không bật RLS nhưng hai role không có quyền bảng; anon cũng không có USAGE schema private.
- 33 policy tenant/admin trên 11 bảng cấu hình tồn tại; 17 trigger liên quan đến session, ledger/audit, catalog lock và tenant identity đang bật. Các 45 hàm kiểm tra đều khóa `search_path=pg_catalog`; các endpoint public tương ứng có `TimeZone=UTC`.

Code base local vẫn là `main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9` cộng bản sửa chưa commit. SHA256 file local tại lúc đối chiếu:

| File | SHA256 |
| --- | --- |
| 014 | `148491449485efed645814223adf89026e08d6a263f1365b917bd1d7f92b5747` |
| 015 | `043fbfd50223e5aa056edbce24995efd9a5e52ab6dc15e8213dd7b30df0e5623` |
| 016 | `3267239282a699551d067d38944069a166c476bcbf340c26e89fcbf79344edf9` |

## Security Advisor còn báo gì

Advisor chưa sạch cảnh báo. Hai INFO `RLS Enabled No Policy` ở ledger/audit phù hợp với thiết kế không cho client đọc trực tiếp. Các cảnh báo SECURITY DEFINER callable bao gồm endpoint được cấp quyền có chủ đích; thân hàm mới đã khớp local và có kiểm tra phiên/quyền. Đây chưa phải bằng chứng kiểm thử endpoint với caller thật.

Các mục riêng cần theo dõi: `set_updated_at` và `has_employee_permission` chưa khóa search_path; Auth chưa bật leaked password protection; `get_next_store_no()` cũ vẫn callable bởi anon và gọi `nextval('public.store_no_seq')`. Hàm cuối có từ [003_rpc_functions.sql:1](D:/Workspace/pos-cafe/supabase/migrations/003_rpc_functions.sql:1), không phải thay đổi của 014–016. Lượt này không gọi hàm đó hoặc sửa cấu hình/grants, và không gán mức độ exploit chỉ từ cảnh báo Advisor.

## Giới hạn và bước còn lại

Kết quả xác nhận MCP kết nối đúng project và các đối tượng/quyền đã kiểm phù hợp với bản sửa 014–016. Đây là kiểm catalog, không phải chạy lại gate nghiệp vụ trên môi trường thật; chưa đối chiếu toàn bộ constraint/index/default/schema, kiểm REST/GoTrue với phiên nhân viên, dữ liệu legacy, Realtime/Storage hoặc app đã phát hành. Không cộng các kiểm tra này vào số test cách ly trước đó. Không chạy lại 014–016 chỉ để ghi lịch sử migration.

Bằng chứng cấu trúc, hash so sánh, grants và Advisor: [JSON kiểm tra](phase-27-live-mcp-evidence-2026-09-13.json). Bước vận hành còn lại theo [log rollout](phase-27-idempotency-rollout.md): xác minh app chứa bản sửa F1–F5, tải lại thiết bị/đăng nhập PIN và kiểm tra sau phát hành trong phạm vi được phép.
