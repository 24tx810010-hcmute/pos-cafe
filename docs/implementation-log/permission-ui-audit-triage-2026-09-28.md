# Phân loại các phát hiện UI cần quyết định — 2026-09-28

Nguồn: [report ngày 22/09](D:/Workspace/pos-cafe/ui-audit/report.md), 65 findings / 29 ngoài baseline / một setup failure employees-mobile. Đây là phân loại các nhóm mới liên quan candidate; chưa phải kết quả audit lại trên source 56ee. Không chấp nhận baseline mới hoặc coi setup failure là PASS.

| Nhóm | Bằng chứng đã xem | Kết luận / đề xuất |
| --- | --- | --- |
| Thanh toán màn hẹp | [Ảnh khoanh](D:/Workspace/pos-cafe/ui-audit/out/payment__mobile.png): item checkbox `input.size-4.accent-pos-primary` tại (555,178) bị phần tổng tiền che; nút tăng số lượng (791,172) đè vào số tiền. Toast đăng nhập che một phần nút hoàn tất trong ảnh. | Lỗi bố cục hiện hữu trong trạng thái chụp; cần sửa bố cục rồi kiểm lại khi hết toast, không quy mọi hit-blocked cho toast. |
| Checkbox chọn món thanh toán | Cùng selector trên, tablet/desktop/mobile: 16×16 px, không có accessible name. [Ảnh desktop](D:/Workspace/pos-cafe/ui-audit/out/payment__desktop.png). | Thiếu nhãn là lỗi thật; đề xuất nhãn cho từng món và vùng bấm đủ lớn. “Chọn tất cả”/“In hóa đơn” có label bao ngoài nên không kết luận vùng bấm chỉ 16×16 từ kích thước input. |
| Chữ nhỏ trong cài đặt | [Ảnh](D:/Workspace/pos-cafe/ui-audit/out/settings__desktop.png), `span.text-[9.5px].font-black`, nhãn “MÃ QUÁN”, 9,5 px trên tablet/desktop. | Chữ nhỏ thật; đề xuất tăng kích thước cho dễ đọc. |
| Độ tương phản | “KHÁCH HÀNG” trong thanh toán (`p.m-0.font-black`) 4,42:1; [cảnh báo xóa dữ liệu mẫu](D:/Workspace/pos-cafe/ui-audit/out/clear_demo_dialog__desktop.png) (`span.text-pos-muted`) 4,46:1; ngưỡng bộ đo 4,5:1. | Đề xuất chỉnh màu chữ nhẹ, giữ phong cách hiện tại; cần đo lại sau sửa. |
| Checkbox quyền/switch của owner | [Ảnh](D:/Workspace/pos-cafe/ui-audit/out/employees__desktop.png): owner đang được chọn, checkbox quyền disabled và nằm trong label/card lớn; bộ đo báo input 13×40 px, switch 36×20 px. | Không coi toàn bộ 15 cảnh báo input là 15 lỗi bấm. Cần đo vùng tương tác thực ở nhân viên chỉnh được; không sửa quyền owner hoặc đổi hành vi theo cảnh báo kích thước. |

Phát hiện bằng mắt thêm: đáy hộp xóa dữ liệu mẫu trong ảnh desktop cắt một phần hàng nút. Cần tái hiện trên source hiện tại trước kết luận lỗi còn tồn tại và sửa; không tự ghi audit đã bắt được lỗi này.

Đề xuất phạm vi sửa: các lỗi thật của nhóm thanh toán/cài đặt/hộp xóa dữ liệu; kiểm lại checkbox ở trạng thái tương tác được; chạy selftest → audit → xem ảnh. Không đổi nghiệp vụ phân quyền, không tự chạy `ui-audit:update`, không nhận những nhóm baseline cũ chưa rà lại là đã xử lý.

Trạng thái: **chủ dự án quyết định tách phần sửa UI sang task sau**, ngày 28/09/2026, trả lời câu hỏi trong phiên: “Ghi nhận, tách phần sửa UI sang task sau”. Đợt này giữ nguyên các lỗi đã nêu và không cập nhật baseline để che chúng. Phần backup/restore, kiểm chứng backend và phát hành phân quyền tiếp tục trong phạm vi đã giao. Quyết định hoãn UI không biến báo cáo audit có findings/setup failure thành PASS.
