# Sửa 11 cảnh báo UI thật trước phát hành — 09/10/2026

## Quyết định và phạm vi

Chủ dự án chọn trực tiếp **“Sửa cả 11 cảnh báo trước release”** sau khi xem danh sách gồm ba vùng bấm “Chọn tất cả” dưới 24px, hai nhãn “Mã quán” 9,5px và sáu dòng tương phản 4,42–4,46:1. Đây là mở scope UI nhỏ tiếp theo [bản closeout UI](permission-ui-closeout-2026-10-09.md); không đổi hợp đồng phân quyền, thanh toán, PIN, baseline audit hoặc expected. Các thay đổi chỉ ở `PaymentSummaryPane.tsx`, `GeneralSettingsDrawer.tsx`, `ClearDemoDialog.tsx` trên `main`; hồ sơ này ở `docs`.

## Thay đổi và lý do

| Cảnh báo đã đo | Sửa ở ứng dụng | Giới hạn tác động |
| --- | --- | --- |
| “Chọn tất cả” có checkbox16×16 và nhãn cao18,75–21,25px | Checkbox thành24×24, nhãn theo chiều cao đó | Giữ `checked`, `disabled`, `onChange` và giá trị chọn/số tiền. Trong mobile chiều cao tăng nhưng payment list vẫn cuộn được. |
| “Mã quán”9,5px ở tablet/desktop | Chữ11px | Chỉ đổi chữ của nhãn; Store Key/tên quán và hợp đồng settings giữ nguyên. |
| “KHÁCH HÀNG”4,42:1 trên nền `#eef4ff`; câu chặn clear-demo4,46:1 trên `#fef2f2` | Hai dòng dùng màu `#586477`, tỷ lệ tính lần lượt5,43:1 và5,48:1 | Override cục bộ, không đổi token `--muted` toàn ứng dụng hoặc văn bản lỗi. |

## Kiểm tại checkpoint đang phát triển

- Chromium mock theo `playwright.permission-ui-closeout.config.ts`: **6/6 PASS** ở desktop1440×900, tablet1024×768, mobile844×390; click/keyboard bình thường, không thanh toán/in ngầm. Chạy với Playwright1.62.1 và Vite8.2.1 đang cài ở checkout, khác lockfile final; sẽ chạy lại sau freeze.
- `npm run ui-audit:selftest`: **23 finding, selftest OK**. `npm run ui-audit`: **exit1**, 51 nhóm tổng, 15 ngoài baseline =3error+12warn; setup0. Trước sửa là62 nhóm/26 ngoài baseline, nên đúng11 nhóm thật biến mất. Không cập nhật baseline. [Report hiện hành](D:/Workspace/pos-cafe/artifacts/permission-ui-warning-closeout-20261009/report.md) và [ảnh mobile annotated](D:/Workspace/pos-cafe/artifacts/permission-ui-warning-closeout-20261009/payment-mobile-annotated.png) được lưu riêng, không ghi đè snapshot UI trước.
- Đối chiếu hai `report.json` theo `(target, viewport, rule, label)`: **11 nhóm biến mất, 0 nhóm được thêm**. Từng nhóm mất khớp đúng ba `tiny-target` chọn tất cả, hai `tiny-font` Mã quán và sáu `low-contrast` đã giao; không chỉ suy từ phép trừ tổng.
- 15 nhóm mới còn lại trùng ba error clipping employees/payment và 12 tiny-target input nằm trong label đã đo/click ở closeout trước. 36 nhóm baseline vẫn còn; không nhận audit raw PASS hoặc zero defects. Ảnh `settings__desktop`/`clear_demo_dialog__mobile` trong `ui-audit/out` có timestamp08/10, vì tool không xuất ảnh mới khi state đã zero finding; không dùng các ảnh cũ đó làm bằng chứng sau sửa. Ảnh payment/employees mobile được tạo09/10 và đã đọc.
- `npm run build`: **PASS** sau khi sửa type lỗi của test onboarding mới; `npm test -- --maxWorkers=2`: **109 files/1.159 PASS**. Đây là lượt trên source còn được ba nhóm CLOSE-1 cập nhật và dependencies checkout hiện tại Vitest4.1.10/Vite8.2.1/PW1.62.1; không nhận là CLOSE-2 cùng source/lockfile. Lượt build đầu FAIL đúng bảy lỗi type của test onboarding mới, đã giữ trong tiến trình và được sửa trước lượt PASS.

## Trạng thái

11 cảnh báo UI thật đã hết theo detector hiện hành và hình học/độ tương phản có căn cứ. **Chưa freeze/review độc lập source cuối hoặc nghiệm thu release.** CLOSE-1 identity/onboarding/canary còn đang chạy; sau khi dừng sửa phải freeze source, chạy lại các phép UI/unit/build cần thiết trên dependency đúng lockfile và gắn với candidate chung. Thay đổi nhãn “Mã quán” đã được làm ở đây theo quyết định mới; packet typography dự kiến cho thành viên2 trong [handoff nhóm](../workflow/tasks/permission-closeout-execution-2026-10-09.md) cần đổi thành phần việc thật khác sau baseline, không tạo công trạng giả.
