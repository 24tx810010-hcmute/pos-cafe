# Phase 25 - Gỡ dependency không sử dụng

## Mục Tiêu

- Loại bỏ dependency không tham gia vào code ứng dụng, test, config hoặc script.
- Giữ package manifest/lockfile phản ánh đúng công nghệ thực sự đang dùng.
- Ngăn báo cáo tiểu luận liệt kê nhầm thư viện chỉ từng được cài nhưng chưa áp dụng.

## Trạng Thái

- Code commit: `main@b7b7262`.
- Thực hiện và kiểm tra ngày 2026-07-30.
- Không thay đổi hành vi ứng dụng, schema database hoặc giao diện.

## Nội Dung Thực Hiện

- Gỡ `react-hook-form`, `@hookform/resolvers` và `zod` khỏi dependency và lockfile.
- Form hiện hành tiếp tục dùng controlled state và validation thủ công.
- Giữ Emotion vì là peer/runtime dependency của MUI.
- Giữ PostCSS, TypeScript type packages và các build/test package không có import trực tiếp vì chúng thuộc toolchain hoặc được config/CLI sử dụng.

## Verification 2026-07-30

- `npm test`: **49/49 files, 257/257 tests pass**.
- `npm run build`: pass; còn chunk-size warning đã biết.
- `npm run smoke`: **34 passed, 31 skipped, 0 failed**.
- `npm audit --omit=dev`: **0 runtime vulnerability**.
- Không chạy lại cloud E2E; bằng chứng cloud gần nhất vẫn được tách riêng trong [../testing.md](../testing.md).

## Quyết Định Cho Báo Cáo

- Không liệt kê React Hook Form, Hookform Resolvers hoặc Zod trong tech stack hiện trạng.
- Chỉ mô tả form bằng controlled state và validation thủ công.
- Nếu tương lai số lượng form/validation tăng đáng kể, đánh giá lại nhu cầu schema validation hoặc form library trước khi thêm dependency.

## Giới Hạn

- Full `npm audit` còn hai cảnh báo high trong dev toolchain (`form-data`, `postcss`); không tự động chạy `npm audit fix` trong phase này để tránh nâng dependency ngoài phạm vi.
- Phase này không tối ưu chunk JavaScript và không thay đổi cloud deployment.
