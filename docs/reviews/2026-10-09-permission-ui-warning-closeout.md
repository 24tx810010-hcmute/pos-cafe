# Review độc lập: 11 cảnh báo UI thật — 09/10/2026

## Candidate và phạm vi

Reviewer `PIN-ONBOARD-UI` không là tác giả ba file UI và không sửa candidate. Scope review: đúng 11 warning được chủ dự án giao, regression UI trên mock, audit diff và giới hạn của [log tác giả](../implementation-log/permission-ui-warning-closeout-2026-10-09.md). Không review hay duyệt PIN/permission toàn hệ thống, SQL, Auth, deploy, waiver audit hoặc nghiệm thu owner.

Pin SHA-256 bytes đã đọc:

| File | SHA-256 |
| --- | --- |
| `src/app/drawers/pos/PaymentSummaryPane.tsx` | `2c14722867c58f2dfac6b1f128f7acbd694059afb7982bdd91ad7a7fafae2913` |
| `src/app/drawers/admin/GeneralSettingsDrawer.tsx` | `b83ddaaeba2ab886fbbc73caf1baf3e67a07ce5408589c9b1c90d453af7e3204` |
| `src/app/drawers/admin/ClearDemoDialog.tsx` | `449fc289070bb2ccb3babb62ca8f9f57d6d2f03be45c473b92f258cad3a73b3ac` |
| Log tác giả `permission-ui-warning-closeout-2026-10-09.md` | `d142c944845aeb8a61b3f4897822136fd42f91dd974b5c8635cd30a53e5353c7` |
| `artifacts/permission-ui-warning-closeout-20261009/report.json` | `9ea81e8a98b2b67e30e32f36a218de84b54035d06d77f58d894ed9e60862f97a` |
| `artifacts/permission-ui-warning-closeout-20261009/report.md` | `9d0caf3b06e5d9b0eba30f7d0490da46b579c6a30d2f626d978e4d253650ab89` |

## Kiểm độc lập

- Diff đúng ba file so với `artifacts/permission-ui-closeout-20261009/source-after`: `PaymentSummaryPane` chỉ đổi `text-pos-muted` của “Khách hàng” thành `#586477` và checkbox “Chọn tất cả” `size-4`→`size-6`; `GeneralSettingsDrawer` chỉ đổi nhãn “Mã quán”9,5→11px; `ClearDemoDialog` chỉ đổi một dòng chặn clear-demo sang `#586477`. Không đổi `checked`, `disabled`, `onChange`, số tiền, hành động thanh toán, thông điệp hoặc quyền. Nhãn checkbox bao cả input và chữ, click target mới tối thiểu24×24px.
- Tự tính WCAG ratio `#586477`/`#eef4ff` = **5,428:1**, `#586477`/`#fef2f2` = **5,478:1**, vượt4,5:1 cho chữ thường. Nhãn “Mã quán”11px vượt ngưỡng detector10px. Đây là kiểm CSS cụ thể, không suy từ màu nhìn bằng mắt.
- Đọc hai report JSON trước/sau theo key `(target, viewport, rule, label)`: **62→51 nhóm; đúng11 removed, 0 added**. Removed là ba `payment`×viewport `tiny-target` “Chọn tất cả”, hai `settings` tablet/desktop `tiny-font` “MÃ QUÁN”, ba `payment`×viewport `low-contrast` “KHÁCH HÀNG” và ba `clear-demo-dialog`×viewport `low-contrast` dòng chặn. Report mới có16 target×3 viewport, setup0; 15 ngoài baseline còn lại và36 baseline không bị nhận nhầm là đã hết.
- Đọc ảnh annotated mobile mới của payment và ảnh fresh browser mock. `pay-select-all` hiện24px; các marker còn ở checkbox dòng/overlay cũ, không thuộc11 warning này. Các ảnh settings/clear-demo cũ không được dùng làm chứng cứ sau sửa khi state đã không có finding mới; kết luận dựa report group diff, CSS và browser regression.
- Tự chạy `npx playwright test --config playwright.permission-ui-closeout.config.ts --workers=1 --retries=0 --forbid-only`: **6/6 PASS**, desktop1440×900/tablet1024×768/mobile844×390, zero skip/retry/expectedfailure/reporter error, exit0. [Report reviewer](D:/Workspace/pos-cafe/artifacts/permission-ui-warning-closeout-20261009/reviewer-ui/review-browser.json) SHA-256 `42adeedeadb0a7fc015b373f50fedf3b3f17f8d4d535745be3dd9bb332b97458`; test file SHA `17e9011ac5deff56786dc77322b951f6a369136b39dff26614e2b91de36947cd`. Vite port5191 đã đóng. Sáu screenshot cũ được backup, screenshot reviewer lưu riêng, rồi sáu file cũ phục hồi đúng hash.
- `current-browser.json` cũ ở artifact UI closeout là **5 PASS/1 FAIL** lịch sử (payment list height, SHA `cc929199edd45fd5651a88aa09b6d2a262e26c53f3bb1d410ba6ded55a8bd655`). Nó được giữ ở `reviewer-ui/prior-current-browser.json` và phục hồi sau run reviewer; không đổi thành nhãn PASS. Report 6/6 reviewer riêng ở đường dẫn trên.

## Finding và verdict

Không có finding chặn trong **scope đúng 11 warning + regression UI** của ba file đã pin. **APPROVE** candidate ba file/log/report theo hash trên cho scope này. Không phải APPROVE toàn source dirty hoặc gate CLOSE-2; source cuối và dependency lock sẽ cần chạy/review lại theo manifest của CLOSE-2.

Audit raw vẫn **FAIL**: 15 nhóm ngoài baseline (3 error clipping, 12 warning input trong label) và36 nhóm baseline còn tồn tại theo report. Review này không phân loại lại/waive chúng, không cập nhật baseline, không chứng minh zero defects. Owner acceptance và release chưa được suy từ verdict.
