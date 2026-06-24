# Phase 14 - Kitchen Ticket on Submit + Optimistic Local Print

## Mục tiêu

- Khi "Gửi đơn" cho bàn đang có đơn, in (popup) **các món mới thêm** trong lần gửi đó — như phiếu báo bếp/chế biến.
- Bỏ phần in còn mở `window.open` (port cũ) — popup in-app là lớp preview duy nhất ở phase UI-only.
- Hết delay popup hoá đơn: ưu tiên cập nhật UI, đồng bộ DB song song; in từ dữ liệu trên máy lúc thao tác.

## Branch/Commit

- Branch code: `main`
- Commit: `df55079` (`feat(print): kitchen ticket on submit + instant local-data receipt`).

## Đã implement

- `diffAddedPrintLines(menu, order, draftItems)` (pure, `features/pos/orderFlow.ts`): trả về các dòng món **chênh > 0** giữa đơn hiện tại và draft. Khớp theo **chữ ký nội dung** `menuItemId | sorted(optionValueIds) | note` chứ không theo id, vì `snapshotToDraft` sinh id client mới mỗi lần (không giữ id snapshot đơn cũ) → không thể khớp id. Có unit test (no-change → rỗng; thêm món → đúng 1 dòng; tăng số lượng → phần tăng; đơn mới → tất cả là mới).
- Variant `kitchen` cho `ReceiptDocument` (`PHIẾU GỬI BẾP`): chỉ tên món + số lượng + option/ghi chú, **không đơn giá / không tổng / không phần thanh toán**; footer `(Phiếu gửi bếp — báo chế biến)`. `ReceiptPreview` union thêm `{ variant: "kitchen"; doc: PrintTicket }`; popup đặt tiêu đề "Phiếu gửi bếp".
- `OrderDrawer.submitOrder`: chốt `addedLines` từ dữ liệu local **trước** khi mutate; on success (status ≠ void, có dòng mới) mở popup `kitchen` dựng từ `result.orderNo` + tên bàn + `addedLines` (total chỉ để thỏa `PrintTicket`, không hiển thị).
- `BrowserPrintPort.renderOrderTicket` / `renderReceipt` → **no-op** (không `window.open`); seam `IPrintPort` giữ nguyên. `orderFlow` vẫn gọi port (mock lưu `lastTicket/lastReceipt`, test cũ vẫn xanh).
- `PaymentDrawer` on success: dựng `PrintReceipt` từ **đơn + tiền khách đưa + giờ máy** lúc bấm hoàn tất (`ticketFromOrderDetail` + received/change/paidAt), không dùng `result.receipt`.
- `useOrderPaymentFlow`: cả `useSubmitOrderMutation` lẫn `usePayOrderMutation` đổi `invalidateAfterOrderMutation` sang **fire-and-forget** (`void ...catch(()=>{})`) — không `await` nên callback UI (đóng drawer, mở popup) chạy ngay; refetch orders/floor/reports chạy nền.

## Quyết định kỹ thuật

- Khớp delta theo nội dung (không theo id) là bắt buộc do draft tái sinh id; gộp theo chữ ký nên xử lý đúng cả trường hợp tăng số lượng món đã có lẫn thêm tổ hợp option mới.
- Phiếu bếp là loại chứng từ riêng (không giá) → tách `kitchen` khỏi `ticket` (phiếu tạm tính, có giá) thay vì tái dùng nhầm ngữ nghĩa.
- In từ dữ liệu local + invalidate nền: gốc của "delay" là `onSuccess` cũ `await` refetch trước khi mở popup. RPC thanh toán/gửi đơn vẫn chạy bình thường (bắt buộc), nhưng phần hiển thị/in không còn chờ refetch.

## Verification

- `npx tsc -b`: passed.
- `npm test`: 180/180 passed (thêm test `diffAddedPrintLines`).
- Playwright (mock, 24/06/2026): tạo đơn B01 (Cà phê sữa) → Gửi đơn → popup `Phiếu gửi bếp` đúng (Cà phê sữa ×1, không giá). Mở lại đơn, thêm Latte → Gửi đơn → popup **chỉ hiện Latte ×1** (không in lại món cũ). Thanh toán với khách đưa 200k/đơn 103k → popup hoá đơn hiện ngay, Tiền thối 97k (tính local).

## Known Gaps/Risks

- Submit không await invalidate nên sàn bàn ở máy đang thao tác cập nhật sau một nhịp refetch nền (realtime/poll phủ); chấp nhận ở phase này.
- `paidAt` của bill in-ngay là giờ máy, khác giờ server dùng khi in lại từ Lịch sử (có thể lệch vài giây).
- Tối ưu optimistic update sâu hơn (cập nhật cache lạc quan + rollback khi lỗi) để bàn ở phase sau.

## Liên quan

- [../features.md](../features.md) — Order, Payment.
- [phase-13-receipt-print-popup.md](phase-13-receipt-print-popup.md) — nền tảng popup in.
