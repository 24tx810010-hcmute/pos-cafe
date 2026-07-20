# Phase 09 - Menu Image Upload

## Mục Tiêu Phase

Redesign Menu Editor để màn quản lý menu rõ hơn cho demo, đồng thời đưa upload ảnh món từ deferred scope vào feature hiện tại. Tính năng vẫn giữ contract cũ của Menu Editor: category, item, option group/value, dirty state, validation, xóa mềm/khôi phục và save bằng changeset.

## Branch/Commit Liên Quan

- Branch code: `feature/menu-editor-image-upload`.
- Code commit: `522b5f3` (`feat(menu): add item image upload`), merge vào `main` tại `fe91e1d`.
- Docs commit: `d5d26d6`.
- Ngày ghi nhận: 2026-06-22.

## Feature Đã Implement

- Menu Editor dùng category text tabs và item card ngang có ảnh bên trái, tên/giá/option count bên phải; trạng thái hết hàng thể hiện bằng sold-out overlay thay vì pill trong card.
- Detail editor của món có upload preview, đổi ảnh và xóa ảnh.
- Ảnh món hỗ trợ JPG, PNG, WebP, tối đa 5MB.
- Màn chọn món trong Order Drawer hiển thị ảnh món nếu có; nếu chưa có ảnh thì fallback bằng icon.
- `image_asset_key` được lưu qua `MenuChanges` thay vì gọi hạ tầng trực tiếp từ UI.
- Card món trong Menu Editor và Order Drawer dùng ảnh `object-cover` để lấp đầy khung; detail preview vẫn giữ ảnh không crop để kiểm tra file đã chọn.
- Card món không hiển thị pill `Đang bán`/`Tạm hết`; món hết hàng dùng overlay `Đã bán hết`.
- Detail món dùng select `Danh mục`; khi đổi danh mục, item được đưa sang danh mục mới và sort order đặt cuối danh mục đó.
- Đổi thứ tự món bằng switch `Đổi vị trí`: bật switch trên món đang chọn, bấm món khác trong cùng danh mục để swap sort order, sau một lần swap thì switch tự tắt.
- `Thêm món` nằm ở panel phải và tạo món hợp lệ dạng `Món mới N`, giá `0`.

## Quyết Định Kỹ Thuật

- Thêm `IMenuImagePort` vào `AppPorts` để giữ UI/feature không phụ thuộc trực tiếp Supabase.
- Migration `005_menu_item_images_storage.sql` tạo/cập nhật bucket public `menu-item-images`, giới hạn 5MB + JPG/PNG/WebP và các Storage RLS policy; Supabase adapter dùng object path `{store_id}/menu-items/{menu_item_id}/{uuid}.{ext}`.
- Storage RLS cho upload/update/delete giới hạn theo folder đầu tiên bằng `auth.uid()`.
- Migration `006_menu_item_image_asset_key.sql` bổ sung `menu_items.image_asset_key` bằng `add column if not exists` cho database đã tạo trước khi feature ảnh được thêm.
- Save flow upload ảnh trước, sau đó lưu changeset; nếu save DB lỗi thì cleanup ảnh mới best-effort.
- Client validate MIME/size trước khi tạo preview; Supabase adapter validate lại trước khi upload.
- Card ảnh dùng `object-cover` để giao diện catalog gọn hơn; đây là trade-off chấp nhận crop nhẹ trong card, còn preview chi tiết vẫn hiển thị ảnh nguyên vẹn.

## Test/Build/Smoke Đã Chạy

- Test targeted cho menu changeset, Menu Editor upload flow, chặn ảnh quá 5MB, swap sort order, Order Menu image rendering và sold-out overlay.
- Đã chạy: `npm run test`, `npm run build`, `git diff --check`; smoke test đã chạy ở vòng Menu Editor trước đó.

## Gap Còn Lại

- Chưa có crop/resize/compress ảnh trong UI; user tự chọn ảnh phù hợp.
- Card ảnh có thể crop nhẹ vì dùng `object-cover`; đây là quyết định UI để card catalog nhìn đầy khung.
- Upload ảnh decor vẫn là mở rộng sau phase này.
- Nếu cần production hardening sâu hơn, có thể thêm cleanup job cho asset mồ côi khi lỗi mạng xảy ra giữa upload và save.

## Link Liên Quan

- [../features.md](../features.md)
- [../phase-scope.md](../phase-scope.md)
- [../data-model.md](../data-model.md)
