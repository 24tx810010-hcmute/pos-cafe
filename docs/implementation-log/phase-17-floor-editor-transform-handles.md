# Phase 17 - Floor Editor Transform Handles

## Mục tiêu

- Tăng tốc thao tác chỉnh sơ đồ bằng cách cho admin resize/xoay trực tiếp object trên canvas, thay vì chỉ nhập thủ công trong phần Nâng cao.
- Áp dụng cho cả bàn và decor trên Floor Editor.

## Branch/Commit

- Branch code: `main` (chưa commit tại thời điểm ghi log - cập nhật hash sau khi commit).

## Đã implement

- Object đang được chọn trong Floor Editor hiển thị 2 handle:
  - Dưới trái: kéo để xoay.
  - Dưới phải: kéo để resize.
- Handle luôn nằm ngang bên dưới bounds chưa xoay của object và không xoay theo object.
- Handle chỉ hiện khi object được chọn, chưa bị xoá và không bị khoá thao tác trên canvas.
- Resize giữ tâm object cố định:
  - Bàn tròn/vuông giữ tỉ lệ vuông.
  - Bàn chữ nhật và decor resize rộng/cao độc lập.
  - Có min size cho bàn/decor và snap theo lưới 20px khi bật Bắt lưới.
- Rotate tính góc từ tâm object tới pointer, snap 15 độ khi bật Bắt lưới.
- Không đổi schema hoặc changeset contract; vẫn lưu qua `width`, `height`, `rotation` của `tables` và `decorItems`.

## Quyết định kỹ thuật

- Tách pointer action trong `FloorEditorDrawer` thành 3 mode: move, resize, rotate.
- Render handle ở overlay layer cùng cấp với object, dùng tọa độ logical canvas theo bounds chưa xoay; handle không còn là child của node đang rotate.
- Decor `isLocked` không cho move/resize/rotate trực tiếp trên canvas; inspector nâng cao vẫn giữ như trước.

## Verification

- `npm test -- src/app/floorEditorDrawer.test.tsx src/app/tailwindMigration.test.ts`: passed (40 tests).
- `npm test`: passed (197 tests).
- `npm run build`: passed; còn Vite chunk-size warning đã biết.

## Gap còn lại

- Chưa chạy ma trận Playwright đầy đủ trên mọi viewport; behavior handle được khóa bằng component test.

## Liên quan

- [../features.md](../features.md) - Floor Editor.
