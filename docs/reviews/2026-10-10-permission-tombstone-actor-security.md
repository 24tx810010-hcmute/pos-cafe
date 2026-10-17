# Review độc lập: actor tombstone của permission RPC — bảo mật/hợp đồng

Ngày: 10/10/2026. Reviewer: subagent `tombstone_security_review`, không tham gia sửa candidate. Verdict hiện tại: **APPROVE** cho lát nguồn ghi trong [source-slice-manifest.json](D:/Workspace/pos-cafe/artifacts/permission-tombstone-actor-close1/source-slice-manifest.json), SHA-256 `b950b40777cccd7097b1feb3b3b53d6be675bc6325f589ce0da3222743e998d0`. Verdict đầu tiên áp dụng cho manifest cũ SHA-256 `cf29bf2ebb8d86844b4f2bdf7f2b256b47ae80ca3618b669eb0d4e76f1a59a90`; sau đó test browser đổi và được kiểm lại dưới đây. Đây không phải APPROVE toàn candidate hay phát hành.

## Phạm vi và cách kiểm

- Kiểm `permissionChangesRepo.ts`, test adapter, parser request, SQL validator/RPC, `permission_current_employee`, các repo mock/direct và đường composition. Đối chiếu tám hash file trong manifest hiện tại với workspace: cả tám khớp. Archive `source-slice.tar` hiện tại có SHA-256 `84ebd8d4c16442af7653d1cfd073e9cd9d0b50eacf90d89c1deffe4d6b54c3f1`, đúng giá trị manifest và chứa đủ tám đường dẫn. Archive của manifest đầu tiên có SHA-256 `44607676ea797086a0b3ad9551cc745c7bc416d06e3de16d6fc065ec48848875`; đường dẫn archive đã được thay bằng snapshot mới. Snapshot chỉ là lát nguồn, không đủ tái tạo toàn ứng dụng dirty.
- Tự chạy `npx vitest run src/adapters/supabase/permissionChangesRepo.test.ts src/core/permissionChangesInputs.test.ts --maxWorkers=2` tại `D:/Workspace/pos-cafe`: 2 file, 12/12 PASS, exit 0. Đọc receipt menu/floor riêng, mỗi ca 1/1 PASS; không tự chạy Docker/browser hoặc đối chiếu raw report của hai ca.

## Kết quả bảo mật/hợp đồng

1. `src/adapters/supabase/permissionChangesRepo.ts:40-55` parse toàn request trước rồi tạo object mới cho đúng năm tập menu và ba tập sơ đồ; chỉ mỗi phần tử `deleted` được chiếu về `{id,deletedByEmployeeId:null}`. `src/core/permissionChangesInputs.ts:10-14,32-40,43-84,87-102` vẫn loại khóa ngoài whitelist, ID không phải UUID và hình dạng thiếu/sai trước khi chiếu. Không có đường gửi `deletedByEmployeeId` do client khẳng định vào RPC này (`permissionChangesRepo.ts:76-77`). Đầu vào không bị mutate vì parser tạo object/array mới rồi `.map` tạo tombstone mới; test xác nhận hai đại diện và so sánh payload đủ tám tập (`permissionChangesRepo.test.ts:37-65`).
2. `supabase/candidate/permission-changes.sql:33-41` vẫn chỉ cho phép actor tombstone vắng mặt hoặc JSON null, từ chối non-null và khóa khác. Menu/floor RPC gọi kiểm phiên rồi checkpoint quyền `menu.manage`/`floor.manage` sau lock (`:122-145`, `:216-230`); `permission_current_employee` kiểm Auth UID, token, trạng thái, hết hạn, mục đích phiên và PIN bắt buộc (`permission-identity.sql:159-181`). SQL ghi `deleted_by_employee_id=actor.id` từ checkpoint, có `store_id=sid` trong mọi update tombstone (`permission-changes.sql:178-186,243-245`). Quyền direct table vẫn bị revoke, grant RPC không đổi (`:373-386`). Không thấy đường vượt qua policy qua thay đổi này.
3. `src/features/admin/draftUtils.ts:24-27` vẫn tạo actor trong shared draft; adapter v2 là nơi bỏ actor trước RPC. Các repo direct vẫn gọi `tombstoneRow` với actor cũ (`menuRepo.ts:154-167`, `floorPlanRepo.ts:122-129`, `repoShared.ts:54-67`); mock không thuộc lát sửa. `newPermissionRuntime.ts:19-28` nối v2 vào `SupabasePermissionChangesRepo`, còn `repos.ts:30-47` tạo compatibility repos riêng. Vì vậy đường legacy không bị thay đổi bởi phép chiếu v2.

## Finding và giới hạn

- **Không có finding chặn** trong phạm vi bảo mật/hợp đồng này.
- Đề xuất không chặn ở vòng đầu: tăng oracle runtime để kiểm `deleted_by_employee_id` trong menu/floor sau commit. Đã được xử lý trong manifest hiện tại; xem mục kiểm lại bên dưới.
- Chưa kiểm toàn TC-PIN-14, TC18, PERM60, hosted binding, source freeze cuối, hay release. Hai receipt runtime là bằng chứng tác giả cung cấp; reviewer chỉ kiểm cấu trúc và đọc test, không tự tái diễn trên DB.

**APPROVE — phạm vi security/contract của source manifest trên.** Nếu bất kỳ file manifest nào đổi, cần đối chiếu delta và xác nhận lại.

## Kiểm lại sau khi thêm oracle actor ở DB

- Delta duy nhất trong tám hash source là `tests/supabase/ownerPinOnboardingCloseout.spec.ts`: cũ `eba6c598aa24e4dce3774f872151bf17194814fb4fe99776bd1b3f1f86c01db2`, mới `a52599bcfe512e24c633c8046c7fb65b217bd95f6000ec15ae905029031a97d3`. Product adapter, test unit, parser, SQL, cấu hình và lockfile giữ nguyên hash. Manifest và tar hiện tại đã xác minh theo hash nêu đầu báo cáo.
- Ca menu kiểm `deleted_at is not null` cùng `deleted_by_employee_id = (select id ... role='owner')` trên đúng item Bạc xỉu của cùng store và yêu cầu `attributed:true` (`ownerPinOnboardingCloseout.spec.ts:382-388`). Ca floor làm tương tự cho bàn B02 (`:408-413`). Trước đó fixture xác nhận đúng một owner (`:233-244`) và luồng dùng PIN mới của owner để đăng nhập (`:247-275,811-812`). Hai scalar subquery trả null nếu thiếu row/actor; `attributed:true` sẽ không đạt, nên assertion không xanh giả khi actor thiếu.
- Receipt mới [menu-actor-safe.json](D:/Workspace/pos-cafe/artifacts/permission-tombstone-actor-close1/menu-actor-safe.json) và [floor-actor-safe.json](D:/Workspace/pos-cafe/artifacts/permission-tombstone-actor-close1/floor-actor-safe.json) đều ghi 1/1 PASS, 0 fail/skip/retry/expected-failure/reporter error. Reviewer đọc receipt nhưng không tự chạy Docker/browser hoặc raw report; giới hạn này vẫn giữ.
- Không thấy thay đổi nới quyền, đổi expected cũ hay làm yếu phép kiểm. Đề xuất oracle runtime ở vòng đầu đã được đóng. **Verdict hiện tại: APPROVE** cho manifest SHA-256 `b950b40777cccd7097b1feb3b3b53d6be675bc6325f589ce0da3222743e998d0` trong phạm vi security/contract và actor runtime của lát này.
