# Phase 13 - Receipt Print Popup (UI-only)

## Mục tiêu

- Giả lập in đơn bằng popup trong app (PortalPopup) thay cho `window.open`.
- Hỗ trợ 2 loại chứng từ khổ giấy thông dụng 80mm: phiếu tạm tính và hoá đơn thanh toán, dùng chung một template chỉ cần đưa dữ liệu order vào.
- In lại hoá đơn ở màn Lịch sử đơn.
- Phase này in chỉ là hiển thị UI (giới hạn phần cứng) — giữ seam cho adapter máy in thật về sau.

## Branch/Commit

- Branch code: `main`
- Commit: `de0906b` (`feat(print): in-app receipt preview popups for ticket & bill`).

## Đã implement

- `ReceiptDocument` (`src/app/components/ReceiptPreview.tsx`): template hoá đơn 80mm tự chứa inline-style (Roboto Mono, gạch đứt), 2 biến thể `ticket` (PHIẾU TẠM TÍNH, có dòng "chưa thanh toán") / `receipt` (HOÁ ĐƠN THANH TOÁN, thêm Tiền khách đưa / Tiền thối). Header/địa chỉ/footer lấy từ `StoreSettings` (`displayName`, `address`, `billFooter`).
- Dòng món kiểu Bách Hoá Xanh: tên món + (option/ghi chú) + dòng `SL × đơn giá` (trái) / thành tiền (phải). Đơn giá gập sẵn `priceDelta` của option để tổng dòng khớp `order.total`.
- Builders thuần `ticketFromOrderDetail` / `receiptFromOrderDetail` (domain `OrderDetail` → `PrintTicket`/`PrintReceipt`); `receiptFromOrderDetail` trả `null` khi đơn chưa có payment.
- State `receiptPreview` + `openReceiptPreview` / `closeReceiptPreview` trong `useAppStore`; `ReceiptPreviewPopup` mount toàn cục ở `AppShell`, đọc settings và render template trong PortalPopup (nút Đóng + In).
- In = clone `outerHTML` của receipt (inline-style nên tự chứa) vào iframe ẩn rồi `print()` — cô lập, không in cả app; đúng tinh thần "browser print preview only".
- Triggers: nút `In tạm tính` ở PaymentDrawer (mở phiếu tạm từ đơn hiện tại); sau khi thanh toán mở popup hoá đơn nếu checkbox in bật; nút `In lại hóa đơn` ở OrderHistoryDrawer dựng bill từ order detail đã lưu.
- `IPrintPort` (`renderOrderTicket`/`renderReceipt`) giữ nguyên làm seam thiết bị; popup là lớp preview UI độc lập, không thay đổi orderFlow.

## Quyết định kỹ thuật

- Template dùng inline-style thay vì Tailwind để `outerHTML` tự chứa style, in iframe sạch mà không phải nhúng lại stylesheet, và không đụng guard "không thêm CSS class/file legacy".
- Popup điều khiển bằng state Zustand riêng (`receiptPreview`) nên độc lập với `drawer`: thanh toán xong đóng drawer nhưng popup hoá đơn vẫn nổi lên.
- In lại tái dựng `PrintReceipt` từ `OrderDetail` (đã có items + payment snapshot) thay vì lưu sẵn bản in — không cần thêm bảng/cột.

## Verification

- `npx tsc -b`: passed.
- `npm test`: 179/179 passed (lần chạy song song đầu bị "no tests" do nghẽn tài nguyên khi dev server + Playwright cùng chạy; chạy lại sau khi tắt dev server thì xanh).
- Kiểm chứng trực tiếp qua Playwright trên dev server (mock, 24/06/2026): nút `In tạm tính` → popup phiếu tạm đúng (tên quán/địa chỉ/footer từ seed, option + ghi chú, dấu "chưa thanh toán"); thanh toán → popup hoá đơn đúng (Tiền khách đưa / Tiền thối). Format dòng Bách Hoá Xanh kiểm chứng qua mockup `.design-previews`.

## Known Gaps/Risks

- `In lại hóa đơn` ở Lịch sử: đã nối + typecheck + test pass nhưng chưa chụp ảnh live (môi trường reset nhiều lần); dùng đúng popup + builder đã verify nên rủi ro thấp.
- Chưa có QR/logo/đường cắt trên bill (đã khảo sát 4 phong cách, chốt bản A classic mono); QR thật cần thư viện sinh QR nếu thêm sau.
- Vẫn là preview UI: chưa nối ESC/POS; `IPrintPort` adapter thật để dành phase sau.

## Liên quan

- [../features.md](../features.md) — Payment, Order History.
- [../phase-scope.md](../phase-scope.md) — ràng buộc "browser print preview only".
