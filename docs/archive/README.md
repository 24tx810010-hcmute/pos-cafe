# Archive

## Folder Này Chứa Gì

Archive chứa tài liệu cũ, audit, handoff và spec chi tiết theo lịch sử làm việc. Đây là nơi truy vết, không phải entrypoint chính cho người mới. Nhánh `docs` hiện chỉ giữ Markdown, nên ảnh/prototype HTML lịch sử đã được loại khỏi branch.

## Khi Nào Nên Đọc

- Khi cần kiểm chứng vì sao một quyết định kỹ thuật/scope được chọn.
- Khi cần xem audit UI cũ ở dạng ghi chú Markdown.
- Khi cần phục hồi chi tiết handoff cho agent trước đây.
- Khi docs root chưa đủ chi tiết và cần đào về lịch sử.

## Cấu Trúc

- `superpowers/specs/`: spec, decision log, implementation contract, checklist và runbook cũ.
- `superpowers/ui-screens/`: mô tả screen/mock cũ trước khi app đi xa hơn.
- `superpowers/ui-audit/`: audit UI desktop ngày 2026-06-16 ở dạng Markdown.
- `superpowers/ui-prototype/`: ghi chú prototype/reference cũ nếu còn dạng Markdown.
- `superpowers/ui-redesign-handoff/`: handoff/rules cho agent UI trước lần refactor docs.
- `superpowers/assets/`: không còn giữ binary asset trên nhánh docs.

## Quy Tắc Duy Trì

- Không để docs root phụ thuộc bắt buộc vào archive.
- Nếu lấy thông tin từ archive để cập nhật source-of-truth, đưa bản tóm tắt vào root docs.
- Không thêm lại binary/prototype artifact vào nhánh docs; nếu cần ảnh cho báo cáo, lưu ở artefact riêng.
