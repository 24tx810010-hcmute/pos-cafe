# Demo Runbook

Runbook này dùng để chuẩn bị demo/bảo vệ phase tiểu luận.

## Flow Demo Chính

1. Mở app ở landscape.
2. Nếu chưa paired, tạo store mới hoặc ghép Store Key.
3. Vào passcode, chọn admin/cashier và nhập PIN.
4. Ở floor view, chọn khu/tầng, mở một bàn trống.
5. Tạo order dine-in: chọn món, option/topping, chỉnh số lượng/ghi chú, gửi đơn.
6. Quay lại floor, thấy bàn chuyển sang đang phục vụ.
7. Mở lại order, chuyển sang payment.
8. Nhập tiền khách đưa, kiểm tra trạng thái thiếu/đủ tiền, hoàn tất thanh toán.
9. Xem receipt preview, quay lại floor thấy bàn trống.
10. Mở report/history để thấy order đã thanh toán.
11. Demo admin: employees, menu editor, floor editor, settings.
12. Demo clear dữ liệu mẫu khi không còn order mở; nếu còn order mở thì giải thích trạng thái blocked.

## Checklist Trước Demo

- Supabase project còn active, không bị pause.
- App build/deploy mới nhất mở được.
- Store demo có dữ liệu seed đủ: nhân viên, menu, option, floor areas, bàn, decor.
- Có ít nhất một order thanh toán thành công để report/history không trống nếu cần.
- Màn hình trình chiếu ở landscape, đủ rộng.
- Chuẩn bị 4G/hotspot vì phase này online-only.
- Không mở các màn optional/future như kitchen/QR nếu chưa muốn giải thích scope.

## Luận Điểm Nên Nói Khi Bảo Vệ

- Scope tiểu luận tập trung vào POS cafe nhỏ, không cố làm ERP/chuỗi/quản lý kho.
- Backend dùng Supabase/Postgres để có dữ liệu quan hệ, RPC transaction và realtime nhanh.
- Order/payment dùng RPC để đảm bảo consistency giữa order, payment và table status.
- Realtime được dùng để invalidate/refetch, giảm rủi ro patch cache thủ công.
- Ports/adapters giúp app không khóa cứng vào Supabase và dễ test/mock.
- Offline-first, native printer, QR payment thật và kitchen queue thật là mở rộng sau, đã có seam trong schema/architecture.

## Rủi Ro Demo & Cách Xử Lý

- **Report trống:** tạo một order live rồi thanh toán trước khi mở report.
- **Mất mạng:** dùng hotspot; nói rõ online-only là tradeoff phase này.
- **Supabase pause:** wake project trước demo.
- **Clear demo bị blocked:** đây là behavior đúng vì còn order mở; đóng/thanh toán order trước.
- **UI overlay/drawer:** drawer đã có portal overlay, click outside để đóng và slide-in khi mở; exit animation là polish optional/backlog.
