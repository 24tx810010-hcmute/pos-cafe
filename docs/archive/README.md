# Archive

## Folder Này Chứa Gì

Archive chứa tài liệu cũ, audit, prototype, handoff và spec chi tiết theo lịch sử làm việc. Đây là nơi truy vết, không phải entrypoint chính cho người mới.

## Khi Nào Nên Đọc

- Khi cần kiểm chứng vì sao một quyết định kỹ thuật/scope được chọn.
- Khi cần xem audit UI cũ hoặc ảnh cũ.
- Khi cần phục hồi chi tiết handoff cho agent trước đây.
- Khi docs root chưa đủ chi tiết và cần đào về lịch sử.

## Cấu Trúc

- `superpowers/specs/`: spec, decision log, implementation contract, checklist và runbook cũ.
- `superpowers/ui-screens/`: mô tả screen/mock cũ trước khi app đi xa hơn.
- `superpowers/ui-audit/`: audit UI desktop ngày 2026-06-16 và screenshot cũ.
- `superpowers/ui-prototype/`: HTML prototype/reference cũ.
- `superpowers/ui-redesign-handoff/`: handoff/rules cho agent UI trước lần refactor docs.
- `superpowers/assets/`: ảnh/tài sản cũ dùng trong prototype/audit.

## Quy Tắc Duy Trì

- Không để docs root phụ thuộc bắt buộc vào archive.
- Nếu lấy thông tin từ archive để cập nhật source-of-truth, đưa bản tóm tắt vào root docs.
- Không xóa archive trong lần refactor đầu; prune sau khi chắc chắn không còn cần truy vết.
