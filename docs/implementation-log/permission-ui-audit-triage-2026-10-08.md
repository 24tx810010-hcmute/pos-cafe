# Phân loại UI audit — 08/10/2026

**Đính chính09/10:** [kiểm UI thật và sửa payment](permission-ui-closeout-2026-10-09.md) chứng minh hai employees/mobile findings là dương tính giả khi descendant nằm ngoài vùng scroll; normal wheel/click chọn được. Payment list collapse và accessible names đã sửa/kiểm trong scope user giao. Report09/10 còn26nhóm ngoài baseline, phân loại có native diagnostic; audit rawFAIL/baseline giữ nguyên. Nội dung08/10 bên dưới là nhận định và evidence trước phép kiểm bổ sung, không phải trạng thái cuối hoặc waiver release.

Nguồn: [report sau sửa mock](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/report.md), [JSON](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/report.json), [log và giới hạn](permission-runbook-readiness-2026-10-08.md). Detector selftest23 OK; audit16 states ×3 viewport, setup0;69 nhóm dedup gồm28 error/36 warn/5 info, **33 ngoài baseline:10 error/23 warn**. Audit **FAIL**, không cập nhật baseline. Multiplicity `×N` là số phần tử bị gom trong một finding, không là số test mới.

Luna đọc report/ảnh annotated trước sửa mock; root kiểm ảnh và trực tiếp payment mobile. Report/ảnh sau sửa được đối chiếu lại trước freeze. Hai ảnh `diagnostic-*` timestamp17/09 là lịch sử, loại khỏi evidence mới. Mọi ảnh dưới đây là state capture ngày08/10. “Mới” chỉ nghĩa chưa có trong baseline; không quy nguyên nhân cho sửa getter ảnh.

## Error — 10 nhóm ngoài baseline

| State / viewport | Selector rút gọn, đo được | Phân loại và bằng chứng |
| --- | --- | --- |
| employees/mobile —2 nhóm | `section.absolute.grid … button.grid.w-full:nth-of-type(3)`; hit-blocked×1 và overlap footer “Thêm nhân viên”100%×1 | **Lỗi layout thật**: hàng Thu ngân chồng footer trong ảnh annotated. Chưa kiểm mọi đường scroll/click live ở employees |
| payment/mobile —3 nhóm | `label.flex.cursor-pointer > input.size-4` hit-blocked×1; `article … input.size-4`×3; `span.flex.items-center > button.grid.size-7`×2 | **Lỗi bị che có bằng chứng**: ảnh và DOM mobile cho checkbox/nút cộng có center hit ở summary/footer. Checkbox đầu normal click không đổi lựa chọn. Select-all và từng nút cộng chưa được click trực tiếp; không suy mọi click đều thất bại |
| payment/mobile —2 nhóm | `article:nth-of-type(2) … input.size-4` overlap checkbox in44%×2; nút cộng món thứ3 overlap nút footer100%×1 | **Lỗi bố cục thật** qua ảnh/DOM; danh sách bị summary/footer phủ. Có rủi ro bấm nhầm vùng thanh toán, chưa thử click vùng đó |
| payment/tablet,desktop,mobile —3 nhóm | `article … input.size-4`; no-accessible-name×3 mỗi viewport | **Lỗi accessibility thật**: checkbox món không có label/ARIA tên món, [PaymentSummaryPane:117](../../../pos-cafe/src/app/drawers/pos/PaymentSummaryPane.tsx:117). AX trực tiếp cũng có checkbox không tên |

[Ảnh annotated employees mobile](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/employees__mobile.png) · [payment mobile](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/payment__mobile.png) · [payment tablet](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/payment__tablet.png) · [payment desktop](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/payment__desktop.png).

## Warn — 23 nhóm ngoài baseline

| State / viewport | Selector, measurement | Phân loại |
| --- | --- | --- |
| employees/3 viewport —6 nhóm | `label.flex.justify-between > input.relative.h-5`36×20×1; `label.flex.gap-2 > input`13×40×15 | **Có khả năng false positive về vùng bấm**: detector đo input trong label/card rộng; gồm control disabled. Input nhỏ có thật, nhưng chưa đo effective label area/click cho từng phần tử. Không tự waive toàn bộ6 nhóm |
| payment/3 viewport —6 nhóm | Checkbox “Chọn tất cả” và in hóa đơn `input.size-4`16×16×1 mỗi loại | **Có khả năng false positive về kích thước vùng bấm** vì label rộng. Mobile hit-blocked là lỗi riêng có bằng chứng, không bị loại chỉ vì input nằm trong label |
| payment/3 viewport —3 nhóm | Checkbox món `article … input.size-4`16×16×3 | **Target nhỏ thật**: không có label bao ngoài. Đi cùng lỗi tên accessible phía trên |
| settings/tablet,desktop —2 nhóm | Nhãn “MÃ QUÁN”, tiny-font9.5px so với min10px×1 | **Lỗi cỡ chữ mức thấp**, ảnh xác nhận. Chưa tự tăng chữ trong scope này |
| clear-demo-dialog/3 viewport —3 nhóm | Dòng thông báo đơn mở, low-contrast4.46:1 so với4.5:1×1 | **Trượt ngưỡng nhẹ thật**, không coi là false positive chỉ vì vẫn đọc được |
| payment/3 viewport —3 nhóm | Nhãn “KHÁCH HÀNG”, low-contrast4.42:1 so với4.5:1×1 | **Lỗi tương phản nhỏ thật**, nhất quán ở ba viewport |

Ảnh annotated [employees desktop](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/employees__desktop.png), [settings desktop](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/settings__desktop.png), [clear demo mobile](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/out/clear_demo_dialog__mobile.png). Những36 nhóm baseline còn lại vẫn ở report, không thành zero defects hay PASS. Phân loại tập trung33 nhóm chưa có baseline; không thay quyết định baseline lịch sử.

## Ưu tiên cho scope UI đã hoãn

1. Payment và employees mobile: tách vùng scroll/list/summary/footer; acceptance gồm click thực không bị che và không nhầm action.
2. Checkbox món: tên accessible gắn món, vùng bấm đủ lớn; kiểm keyboard và touch.
3. Kiểm effective target area của label trước sửa warning employees/select-all/in; xử lý chữ nhỏ và tương phản sau.

Đây là đề xuất để giao scope tiếp theo, chưa được phép sửa UI. Giữ FAIL và bằng chứng, không gọi `ui-audit:update`. Chưa quyết định waiver phát hành; reviewer slice chỉ đánh giá tính đúng của hồ sơ và bản sửa mock.
