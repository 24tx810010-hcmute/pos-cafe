# Inventory Edge Functions / Storage — 07/10/2026

## Đề bài, ủy quyền và tiêu chí

Sau [scope fresh Codex MCP](supabase-fresh-host-2026-10-07.md), AI đề xuất scope nhỏ inventory Edge Functions/Storage chỉ đọc rồi đến Vercel; chủ dự án trả lời **“ok”**. Đây là bước phân tích của task phát hành hiện hành, không tạo change nghiệp vụ mới hoặc áp dụng candidate. Đích đã duyệt: `kfqjdfwxhkdwihjobpny`, project `pos-cafe-demo`, Dashboard branch `main / Production`.

Code worktree `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479`; docs worktree `D:/Workspace/pos-cafe-docs`, `docs@e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Có dirty work sẵn; không switch/reset/stash/commit/push. Source liên quan được snapshot/hash cho lần khảo sát, HEAD không đại diện toàn candidate chưa commit.

Tiêu chí: đọc được danh sách function/bucket/policy ở đúng đích qua phiên đã xác thực, ghi chênh lệch với candidate và trường chưa quan sát được; lưu evidence có nguồn/thời điểm/giới hạn; hai reviewer độc lập APPROVE exact candidate cuối. Không lấy thành công đọc metadata làm quyền deploy hoặc gate hành vi Storage. PAT hiện có vẫn DB Read; scope này không dùng/nạp PAT đó.

## Phương pháp và kết quả quan sát

Dùng tab1 của Codex in-app browser đã đăng nhập Supabase, không login/consent/cài connector mới. Đọc AX/DOM và screenshot của các trang Functions, Storage buckets, bucket details và policy dialogs. **Không có raw Management/Storage API response, HTTP status hay provider timestamp được capture.** `recordedUtc` là lúc tạo receipt; `savedUtc` là giờ lưu file evidence, không phải thời gian cập nhật provider. [Receipt UI](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/ui-inventory-receipt.json) ghi provenance và giới hạn này.

| Mục | Hosted Dashboard quan sát | Candidate mong đợi / khoảng còn thiếu |
| --- | --- | --- |
| Edge Functions | Empty state `DEPLOY YOUR FIRST EDGE FUNCTION`; không có function trong danh sách | `menu-image-gateway` và `menu-image-public` **ABSENT_IN_DASHBOARD_LIST**; version/status/runtime/JWT không quan sát được vì chưa có function trong list |
| Bucket legacy | Một row `menu-item-images`, PUBLIC,4 policies; limit hiển thị `5 MB`; JPEG/PNG/WebP | Khớp các nhãn của legacy [migration005:9](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:9). Không suy exact hosted bytes từ nhãn5 MB |
| Bucket candidate | Không có `menu-item-image-staging` trong bucket list không lọc | Candidate [DDL:4](D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:4) cần private bucket,5.242.880 bytes, JPEG/PNG/WebP |
| Root bucket legacy | Ba folder hiển thị và cảnh báo broad SELECT | Chưa mở folder/đọc payload hoặc kiểm kê hết object; **không nhận là3 objects**, không thay allowlist cleanup/backup |
| Policy list không lọc | Bốn legacy policies dưới bucket; sections other `storage.objects`/`storage.buckets` hiển thị chưa có policy | Chỉ là inventory UI; chưa đối chiếu catalog toàn bộ bằng kênh khác |

Không tạo function/bucket hoặc đọc secret để biến inventory thành deployment-ready. Không suy hai URL function đã trả404 từ empty state; chưa gọi endpoint đó. Names secret do local source dùng không chứng minh hosted secret đã có.

## Policies thực đọc

Đọc tên/command/role từ [table DOM](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/storage-policies-table.txt); mở từng policy để đọc predicate rồi đóng, không nhập editor hoặc bấm Review/Apply.

| Policy | Command / role | Predicate quan sát |
| --- | --- | --- |
| `menu_item_images_public_read` | SELECT / public | USING chỉ kiểm `bucket_id = 'menu-item-images'` |
| `menu_item_images_store_insert` | INSERT / authenticated | WITH CHECK kiểm bucket và folder đầu bằng `auth.uid()::text` |
| `menu_item_images_store_update` | UPDATE / authenticated | USING và WITH CHECK đều kiểm bucket + folder đầu bằng `auth.uid()::text` |
| `menu_item_images_store_delete` | DELETE / authenticated | USING kiểm bucket + folder đầu bằng `auth.uid()::text` |

Các predicate có cast/ngoặc theo PostgreSQL được ghi trong receipt và dialog evidence; tương ứng semantic của [legacy migration:21](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:21). Đây chưa phải test client anonymous/store JWT trực tiếp. Dashboard cảnh báo client có thể list toàn bucket; broad SELECT hiện không có điều kiện folder hoặc operation. Tài liệu [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) cũng phân biệt SELECT để list với đọc object; [public bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals) cho phép phục vụ file công khai, còn các thao tác ghi vẫn chịu access control. Không kết luận mọi người ghi được chỉ vì bucket PUBLIC.

## Chênh lệch kỹ thuật và cách xử lý tiếp

1. **Hosted đang có cấu hình ảnh legacy trong inventory này.** Candidate [permission-images.sql:8](D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:8) bỏ bốn policies legacy đã biết và đóng direct staging access; chỉ xóa những tên đã biết không chứng minh không còn policy khác. Cần recheck catalog/policies và bypass tests trong release gate, giữ legacy public GET theo thiết kế. Không bấm Remove policy ở Dashboard: siết riêng trước rollout phối hợp có thể làm hỏng client cũ.
2. **Hai Edge Functions và staging bucket chưa xuất hiện.** Thiết kế [design:195](../../openspec/changes/redesign-permission-model/design.md:195) yêu cầu gateway `verify_jwt=true`, public image function `verify_jwt=false` riêng function đó. Handler [gateway:20](D:/Workspace/pos-cafe/supabase/functions/menu-image-gateway/index.ts:20) kiểm bearer/employee và [public:7](D:/Workspace/pos-cafe/supabase/functions/menu-image-public/index.ts:7) chỉ phục vụ GET, OPTIONS trả metadata. Root `supabase/config.toml` vẫn absent tại lúc kiểm; phải chuẩn bị/review pin JWT settings cho rollout, không tắt JWT toàn functions. [Supabase deployment](https://supabase.com/docs/guides/functions/deploy) là nguồn runbook, không phải lệnh đã thực chạy ở scope này.
3. **Metadata read không thay capability/gate.** Quyền deploy, API auth/status, anonymous published GET, direct write/copy/delete denial, revoke/finalize/cache và cleanup bytes đều chưa kiểm ở đây; các yêu cầu [T09:148](../../openspec/changes/redesign-permission-model/tasks.md:148) giữ nguyên. [Controller:649](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:649) sau DB commit còn ghi `PENDING_STORAGE_API`; inventory không đóng checkpoint đó.
4. **Editor có trạng thái tạm ngoài dự kiến.** Khi đóng INSERT dialog, UI hiện Unsaved changes dù agent không nhập editor; thao tác kế tiếp tìm UPDATE không thấy vì modal này chặn. Đọc trạng thái rồi Discard changes, trở về bảng và tiếp tục đọc UPDATE/DELETE. Không bấm Review/Apply hoặc đổi policy hosted; nguyên nhân dirty state chưa được điều tra, không gán lỗi cho provider. Cuối survey đã đóng mọi editor; bucket list vẫn có bốn policies.

## Evidence và kiểm tra phù hợp

Artifact root `D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007`:

- [Edge empty state](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/edge-functions-empty.jpg), [bucket list](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/storage-buckets.jpg) và [table text](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/storage-buckets-table.txt).
- [Broad SELECT warning](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/storage-legacy-warning.jpg), [policy list](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/storage-policies.jpg), [SELECT dialog](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/policy-select.jpg).
- Dialog text [INSERT](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/policy-insert-dialog.txt), [UPDATE](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/policy-update-dialog.txt), [DELETE](D:/Workspace/pos-cafe/artifacts/supabase-edge-storage-inventory-20261007/policy-delete-dialog.txt), kèm ảnh từng dialog trong artifact root.

Một số screenshot bị clipping do viewport/preview banner; DOM/AX bổ sung đầy đủ MIME/name/command/role/predicate. Ảnh có project/account labels và folder UUID fragments; giữ làm evidence nội bộ, không chép tài khoản/identifier vào báo cáo chính. Không có token/key page, private config/auth/backup hoặc object payload trong gói này.

Phép kiểm là đối chiếu nguồn, UI evidence, receipt, hash/snapshot và local links; không chạy application build/test/UI audit hoặc test integration trên dữ liệu thật vì không sửa ứng dụng/UI. Investigator chỉ đọc nguồn local, không thay review cuối. Review/manifest/snapshot ở [biên bản](../reviews/2026-10-07-supabase-edge-storage-inventory.md); không kế thừa approval của scope MCP trước.

## Bàn giao và nguyên liệu rubric

Survey có đầu ra kiểm kê và chênh lệch rõ; **không là nghiệm thu/phát hành tính năng ảnh hoặc mô hình quyền**. Nguồn kỹ thuật cho đồ án: khác biệt identity của kênh Dashboard và DB-only PAT; metadata so với kiểm hành vi; public object serving so với SELECT/list và mutation RLS; pin JWT riêng từng function; phối hợp client/DB/Storage/Edge thay vì áp một phần độc lập. Đây là lập luận từ nguồn/evidence đã đọc, không phải số integration tests đã chạy mới.

Đường đọc: [legacy policy:21](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:21) → [candidate private bucket/revoke:4](D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:4) → [hai JWT settings:195](../../openspec/changes/redesign-permission-model/design.md:195) → [T09 gate:148](../../openspec/changes/redesign-permission-model/tasks.md:148). Walkthrough đã cung cấp, chưa có xác nhận chủ dự án đã đọc/hiểu. Docs chưa commit/publish. Không bảo đảm email/visibility/log sạch với tài khoản dùng chung; survey không mở login/connector mới hoặc cố che lịch sử.

Scope nhỏ tiếp theo: **Vercel binding chỉ đọc** (project/team/domain/repo/Production branch/build/environment presence/auto-deploy), sau đó chuẩn bị runbook rollout phối hợp với các gate còn thiếu. Không cần chat mới; browser tab giữ cho lần đọc tiếp theo. Không mở write hoặc tăng PAT trong inventory này.
