# Screenshots

## Folder Này Chứa Gì

Folder này chỉ giữ chỉ mục Markdown cho screenshot/UI baseline. Nhánh `docs` hiện là docs-only nên không giữ file ảnh binary.

- `current/`: ghi chú về bộ screenshot gần nhất; ảnh cần refresh nên tạo ngoài nhánh `docs` hoặc lưu ở artefact báo cáo riêng.

## Khi Nào Nên Đọc

- Khi cần biết bộ màn nào nên chụp lại để hiểu UI hiện tại.
- Khi chuẩn bị prompt cho Gemini/Stitch/Figma/agent redesign.
- Khi so sánh trước/sau UI rework.

## Quy Tắc Duy Trì

- Không commit ảnh/prototype vào nhánh `docs`; branch này chỉ giữ `.md`.
- Nếu cần giữ ảnh cũ, lưu ngoài nhánh docs hoặc trong artefact báo cáo riêng.
- Khi UI core thay đổi đáng kể, chụp lại floor, order, payment và takeaway trước.
