# Phase 12 - Report Master/Detail Redesign

## Mục tiêu

- Thiết kế lại màn Báo cáo doanh thu: bỏ bố cục 1 cột cuộn dọc (banner doanh thu quá lớn đẩy biểu đồ xuống dưới màn), chuyển sang dashboard **vừa một màn, biểu đồ là trung tâm**.
- Giữ nguyên toàn bộ chức năng và thông tin hiển thị; chỉ đổi layout/UX, không đổi nguồn dữ liệu.

## Branch/Commit

- Branch code: `main`
- Commit: `47aa5ae` (`feat(report): redesign revenue report as master/detail dashboard`).

## Đã implement

- `ReportSettingsDrawer` đổi thân drawer thành **hai khung master/detail** (`grid-cols-[260px_minmax(0,1fr)]`, stack 1 cột ở `max-[980px]`):
  - **Rail trái (master):** thẻ tóm tắt doanh thu (nền teal gradient) + sparkline theo giờ; điều hướng "Mục báo cáo" (Tổng quan / Theo giờ / Món bán chạy / Đơn đã thanh toán) thay cho dãy tab ngang cũ, mỗi mục có badge số lượng; chân rail là tóm tắt nhanh luôn hiển thị (giờ cao điểm, thanh toán phổ biến, đơn huỷ).
  - **Pane phải (detail):** nội dung của mục đang chọn. Tab Tổng quan = 3 KPI tile (số đơn TT + pill huỷ, trung bình đơn, món bán chạy) + biểu đồ cột doanh thu theo giờ (cột giờ cao điểm tô `#f59e0b`) + bar-list món bán chạy. Các tab Theo giờ / Món / Đơn giữ nguyên bảng + logic cũ.
- Look mô phỏng Tremor (card viền mảnh, KPI tile, bar-list) nhưng **dựng bằng Tailwind token `pos-*` + Recharts có sẵn — không thêm dependency `@tremor/react`** (cân nhắc thêm về sau nếu mở rộng nhiều màn analytics).
- Bỏ chỉ số "so với hôm qua" của bản phác thảo (app chưa fetch doanh thu hôm qua) để không hiển thị số liệu bịa.
- Sparkline ở rail chỉ render khi có `>= 2` mốc giờ; ít hơn thì ẩn (tránh 1 cột `flex-1` chiếm trọn khung thành khối trắng kín khi chỉ có 1 mốc).

## Quyết định kỹ thuật

- Chọn hướng **master/detail** sau khi dựng 6 bản phác thảo HTML (KPI console, hoá đơn, espresso dark, editorial, master/detail, chart-first) và xem trực tiếp qua Playwright; lý do: màn báo cáo cần tra cứu nhiều mục → nav rõ ràng + nội dung lấp đầy một màn không cuộn hợp UX POS tablet ngang hơn là banner số liệu chiếm chỗ.
- Không kéo `@tremor/react` cho một màn: look Tremor tái hiện được bằng Tailwind, tránh thêm dependency + chỉnh `tailwind.config` (token màu Tremor, content globs) và rủi ro với guard test (CSS legacy + ranh giới layer).
- Tóm tắt nhanh đặt ở rail trái (luôn thấy) nên bỏ card "Tổng quan nhanh" trùng lặp ở pane phải.

## Verification

- `npx tsc -b`: passed.
- `npx vitest run src/app/reportHistoryDrawer.test.tsx`: 6/6 passed.
- Kiểm chứng trực tiếp qua Playwright trên dev server (mock, ngày 2026-06-23): tạo store + seed demo, đăng nhập admin, thanh toán 1 đơn → mở Báo cáo: rail trái + pane phải render đúng, cột giờ cao điểm tô amber, badge mục đúng số lượng; xác nhận sparkline đã ẩn ở mốc đơn lẻ sau khi fix.

## Known Gaps/Risks

- Các tab Theo giờ / Món bán chạy / Đơn đã thanh toán vẫn dùng style bảng cũ, chưa đồng bộ hoàn toàn với look mới của tab Tổng quan.
- Donut "Tại bàn vs Mang đi" (xuất hiện ở bản phác thảo chart-first) chưa được thêm vào bản chính; cần bổ sung phép tính tách dine-in/takeaway trong `reportHelpers` nếu muốn dùng.
- Nút "Xuất" vẫn disabled (chưa hỗ trợ export) như hiện trạng.

## Liên quan

- [../features.md](../features.md) — Report.
- [../screens.md](../screens.md) — Report drawer.
