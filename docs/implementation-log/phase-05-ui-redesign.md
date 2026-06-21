# Phase 05 - UI Redesign

## Mục Tiêu Phase

Rework thẩm mỹ và UX cho POS core trước: floor view, order drawer, payment drawer và takeaway. Phase này ưu tiên tạo visual direction/mockup ảnh trước, sau đó mới update code UI/logic nếu cần.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `main` commit `ef3ecdb`.
- Current screenshot set: `docs/screenshots/current/`.
- UI redesign context mới: `docs/ui-redesign-context.md`.
- Snapshot cũ đã archive: `docs/archive/superpowers/ui-redesign-handoff/2026-06-20-main-flow-snapshot.md`.

## Feature Đã Implement

- Chưa implement UI redesign vào app trong phase này.
- Đã có baseline screenshot 26 màn để đưa vào Stitch/Gemini/agent.
- Đã refactor docs để tách scope, screens, tech tradeoff và UI redesign context.

## Test/Build/Smoke Đã Chạy

- Phase này hiện là documentation/UI planning phase; test code app không chạy trong bước tạo visual direction.
- Khi bắt đầu code UI redesign, cần chạy ít nhất `npm run test`, `npm run build`, và `npm run smoke` sau khi sửa app.

## Quyết Định Kỹ Thuật Phát Sinh

- Làm POS core trước vì tác động UX lớn nhất.
- Không đổi backend/data contract trước khi có visual direction.
- Gemini/Stitch context cần ngắn, tập trung màn và dữ liệu tối thiểu, không nhồi toàn bộ docs.

## Gap Còn Lại

- Chưa có mockup UI cuối cùng.
- Chưa implement code UI mới.
- Cần quyết định visual direction sau khi xem output từ Stitch/Gemini.

## Link Liên Quan

- [../ui-redesign-context.md](../ui-redesign-context.md)
- [../screenshots/README.md](../screenshots/README.md)
- [../screens.md](../screens.md)
