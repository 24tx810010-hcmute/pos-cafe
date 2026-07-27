# Phase 23 - Catalog nền bàn cho Floor Plan

## Mục tiêu

- Tận dụng 11 ảnh nền bàn từ thư viện nội bộ `evo-edit-room`.
- Cho admin chọn nền từng bàn nhưng giữ màu trắng là mặc định an toàn.
- Render cùng một lựa chọn trong Floor Editor và POS mà không làm thay đổi trạng thái/nghiệp vụ bàn.

## Trạng thái

- Code commit: `3d9b64a` (`feat(floor): add table backgrounds`).
- Migration 013 đã được người dùng apply và được xác minh ngày 2026-07-27.
- Không thay đổi enum; chỉ thêm cột nullable.

## Đã implement

- Copy 11 PNG vào `public/floor-assets/tables` với tên ổn định `table-bg-01.png` đến `table-bg-11.png`; hash 11/11 khớp file nguồn, tổng dung lượng khoảng 0,70 MB.
- Catalog TypeScript cung cấp option `Trắng mặc định`, 11 asset và resolver dùng chung.
- Inspector bàn mở popup responsive với 12 lựa chọn; preview mẫu hiện tại và áp dụng vào draft.
- Bàn mới khởi tạo `backgroundAssetKey=null`; bàn cũ đọc `null` cũng render trắng.
- Floor Editor và POS render ảnh bằng cover/center, clip theo shape; border xanh/cam vẫn thể hiện empty/occupied.
- Canvas Floor Editor chỉ hiển thị tên bàn trực tiếp trên ảnh, không còn số chỗ và không có pill nền trắng quanh tên. Inspector vẫn giữ trường số chỗ; POS vẫn giữ tổng tiền của order.

## Dữ liệu và persistence

- `FloorTable`/`DraftTable`/`TableCreate` thêm `backgroundAssetKey: string | null`.
- Changeset chỉ gửi `backgroundAssetKey` khi lựa chọn thay đổi và không ghi đè `table.status`.
- Supabase mapper/repository/seed bundle map sang `tables.background_asset_key`.
- Migration `013_table_background_asset_key.sql` thêm cột `text` nullable bằng `add column if not exists`; schema tạo mới trong migration 001 cũng có cột này.
- Mock showcase phân bố 11 mẫu trên hai khu để kiểm tra trực quan; demo seed Supabase vẫn dùng nền trắng mặc định.

## Quyết định kỹ thuật

- Chọn static public path nullable thay vì enum hoặc upload Storage: catalog có thể thay đổi mà không sửa constraint, còn `null` tương thích dữ liệu cũ và thể hiện rõ default trắng.
- Không dùng ảnh nền để biểu diễn trạng thái bàn; status border là lớp riêng để giữ khả năng đọc trên mọi texture.
- Key lạ/không còn trong catalog fallback trắng thay vì cố tải URL không tin cậy.

## Verification 2026-07-27

- Catalog test xác nhận 11 file tồn tại, path không trùng và resolver trả đúng asset.
- Unit/integration: **49 files, 257/257 tests pass**.
- `npm run build`: pass; còn Vite chunk-size warning đã biết.
- `npm run smoke`: **34 passed, 31 skipped**.
- Playwright desktop chọn nền 11, lưu Floor Editor, đóng drawer và xác nhận POS render lại đúng ảnh: pass.
- PostgREST read-only check cho `background_asset_key` và full select shape đều trả HTTP 200 sau khi apply migration 013.

## Giới hạn và hướng tiếp

- Chưa hỗ trợ upload/custom background, tìm kiếm, favorite hoặc xoá asset catalog.
- 11 PNG thêm khoảng 0,70 MB static deployment; chưa có bước chuyển WebP/tối ưu riêng.
- Nhãn trên texture rất sáng/tối hiện không tự đổi màu theo độ tương phản; có thể bổ sung text shadow/contrast metadata nếu catalog mở rộng.

## Liên quan

- [../features.md](../features.md) - POS Floor và Floor Editor.
- [../screens.md](../screens.md) - POS Floor View và Floor Editor Drawer.
- [../data-model.md](../data-model.md) - `tables.background_asset_key`.
