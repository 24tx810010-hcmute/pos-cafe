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
8. **Demo instant pay (điểm nhấn):** bỏ `Chọn tất cả`, tick 1-2 món (chỉnh số lượng bằng nút `+`), hoàn tất → bill riêng in ra (kế thừa số đơn gốc), đơn gốc còn lại trên bàn với số mới; mở report thấy doanh thu vào NGAY.
9. Nhập tiền khách đưa cho phần còn lại, kiểm tra trạng thái thiếu/đủ tiền, hoàn tất thanh toán.
10. Xem receipt preview, quay lại floor thấy bàn trống.
11. Mở report/history: 2 đơn độc lập từ cùng một bàn, số đơn tăng theo thứ tự thanh toán.
12. Demo admin: employees, menu editor, floor editor, settings.
13. Demo clear dữ liệu mẫu khi không còn order mở; nếu còn order mở thì giải thích trạng thái blocked.

## Checklist Trước Demo

- Supabase project còn active, không bị pause.
- App build/deploy mới nhất mở được.
- Store demo có dữ liệu seed đủ: nhân viên, menu, option, floor areas, bàn, decor.
- Có ít nhất một order thanh toán thành công để report/history không trống nếu cần.
- Màn hình trình chiếu ở landscape, đủ rộng.
- Chuẩn bị 4G/hotspot vì phase này online-only.
- Không mở các màn optional/future như kitchen/QR nếu chưa muốn giải thích scope.

## Kiểm Chứng Trên Supabase

- **Realtime cross-device (phase 15): ĐÃ kiểm chứng** qua `npm run smoke:supabase` (phase 18): 2 browser cùng store thật, máy A tạo đơn → máy B thấy bàn đang phục vụ ≤30s; máy B thanh toán → máy A thấy bàn trống. Phần self-heal khi ngắt/nối mạng vẫn chỉ kiểm được thủ công (ngắt mạng máy B rồi nối lại → sau `SUBSCRIBED` phải tự resync ngay). Xem [implementation-log/phase-15-realtime-hardening.md](implementation-log/phase-15-realtime-hardening.md).
- **Instant pay tách đơn (phase 18): ĐÃ kiểm chứng** qua E2E trên cloud đã áp migration 009+010 (tách dòng, số bill theo thứ tự trả, lịch sử 2 đơn độc lập).

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
