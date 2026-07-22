# Phase 21 - Catalog tường và ảnh trang trí cho Floor Plan

## Mục tiêu

- Thay decor placeholder đơn giản bằng catalog ảnh built-in dùng được trong Floor Editor và POS Floor.
- Cho admin chọn texture tường, chọn ảnh trang trí theo nhóm và đổi mẫu của object đã tạo.
- Giữ tương thích dữ liệu cũ và không đổi schema/changeset contract.

## Trạng thái

- Code commit: `7a00fd0` (`feat(floor): add decor asset catalog`).
- Đã push lên `origin/main` ngày 2026-07-22.
- Không có database migration.

## Đã implement

- Copy đủ asset từ thư viện `evo-edit-room` nội bộ sang public asset của POS Cafe:
  - 9 texture tường.
  - 57 ảnh cây.
  - 29 ảnh ghế.
  - 30 ảnh thiết bị/fixture.
  - 15 ảnh trang trí khác.
- Catalog TypeScript sinh đường dẫn, nhãn, `DecorKind` và kích thước mặc định; có resolver dùng chung cho editor/POS.
- Toolbar Floor Editor rút gọn thành hai entry rõ ràng: `Tường` và `Ảnh trang trí`.
- Popup responsive:
  - Tường hiển thị grid 9 texture.
  - Trang trí có tab Cây/Ghế/Thiết bị/Khác và chỉ tải/render nhóm đang mở.
  - Cho chọn mẫu rồi xác nhận thêm mới hoặc áp dụng khi đổi mẫu.
- Inspector hiển thị preview asset và action đổi mẫu.
- Floor Editor và POS Floor render tường bằng cover, decor bằng contain; giữ transform, z-index, lock, resize/rotate hiện có.
- Asset key legacy không khớp catalog tiếp tục dùng placeholder nhãn/màu, không render ảnh lỗi.
- Changeset vẫn lưu `kind`, `label`, `assetKey`, geometry và lock như trước; Supabase/mock adapter không đổi.

### Dữ liệu mẫu

- Thay toàn bộ decor placeholder trong floor mock bằng 13 asset thật, bố trí trên cả Tầng trệt và Lầu 1: hai texture tường, cây/bụi hoa, ghế đơn/sofa, quầy pha chế/quầy bar, quầy đón khách, bàn bi-a và biển chỉ dẫn.
- Seed demo dùng cho store Supabase có 7 decor asset thật trên khu Tầng trệt, phủ đủ 5 nhóm visual nhưng vẫn giữ bộ seed gọn.
- Giữ các id quan trọng như `decor-counter`, `decor-door`, `decor-plant`, `decor-wall` để không làm gãy test/luồng cũ; `demoSeedIds.decorItems` tự lấy từ floor seed nên clear/re-seed nhận diện đủ decor mới.
- Test data kiểm tra mọi `assetKey` có trong catalog, asset đủ đa dạng và bounds decor không che bàn mẫu.

## Quyết định kỹ thuật

- Lưu trực tiếp public path trong `assetKey` (ví dụ `/floor-assets/decor/deco-seat-29.png`) để client resolve asset tĩnh, không cần storage bucket hoặc API riêng.
- Cây map về `DecorKind=plant`; các nhóm ghế/thiết bị/khác map về `image`; tường giữ `wall`. Union/schema enum cũ vẫn được giữ để đọc dữ liệu trước phase.
- Không thêm upload decor. Catalog built-in là scope hiện tại; upload/custom asset vẫn là mở rộng.
- Tách visual node/picker/catalog thành component/module riêng để Floor Editor Drawer không phình quá giới hạn maintainability test.

## Verification 2026-07-22

- Kiểm tra file vật lý: 9 wall + 131 decor, tổng 140 asset; catalog test xác nhận mọi đường dẫn tồn tại và không trùng.
- `npm test`: **48 files, 250/250 tests pass**.
- `npm run build`: pass; còn Vite chunk-size warning đã biết.
- Playwright desktop flow: chọn wall 04 + fixture 30, lưu, đóng editor và xác nhận cả hai ảnh hiển thị lại trên POS Floor — pass.
- `npm run smoke`: **34 passed, 31 skipped**, không có failure trên desktop/tablet/phone landscape và portrait guard.
- Playwright sample-data flow: chuyển Tầng trệt/Lầu 1 và xác nhận texture tường, cây, ghế, fixture, ảnh khác đều render — pass.

## Giới hạn và hướng tiếp

- Asset đóng gói làm tăng kích thước static deployment khoảng 5,2 MB; ảnh chỉ tải theo URL và popup chỉ render nhóm đang xem, nhưng chưa có pipeline tối ưu thêm/WebP cho 131 PNG.
- Chưa hỗ trợ upload ảnh decor, xoá asset catalog, tìm kiếm hoặc favorite.
- Store đã seed trước phase này không tự đổi decor đang có; bấm khởi tạo dữ liệu mẫu/re-seed sẽ upsert thêm bộ decor built-in mới bằng deterministic id.

## Liên quan

- [../features.md](../features.md) - Floor Editor.
- [../screens.md](../screens.md) - Floor Editor Drawer.
- [../data-model.md](../data-model.md) - `floor_decor_items.asset_key`.
