# Kiểm G2c và sửa blocker UI — 09/10/2026

## Yêu cầu và phạm vi

Người dùng yêu cầu kiểm G2c, đóng task phân quyền trước chia việc nhóm; sau triage, đã giao rõ sửa tối thiểu employees/payment UI, giữ nghiệp vụ/quyền/thanh toán, kiểm auto/UI ba viewport. [Handoff CLOSE-1→3](../workflow/tasks/permission-closeout-execution-2026-10-09.md) ghi quyết định, điều kiện đóng và gói nhóm. Không coi sửa UI là hoàn tất toàn permission/PIN hoặc đã deploy.

Parent đối chiếu G2c candidate-03:754 source entries, snapshots, attestation và final SEC/COV khớp, không drift trước sửa UI. [Receipt](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/g2c-parent-verification.json), [G2c log](permission-pin-expiry-wait-2026-10-09.md). Một expiry-during-wait case hoàn tất; source-04 giữ lịch sử sau khi UI đổi.

## Chẩn đoán và lựa chọn

**Employees:** audit bắt tâm hàng Thu ngân nằm ngoài vùng scroll. Mobile scroller kết thúc y332.5, hàng3 y321.69–394.69; cuộn chuột105px chuyển hàng sang y216.69–289.69, hit đúng hàng và click tọa độ chọn được. Chọn đủ6 hàng/mở form mới đạt ba viewport. Hai `hit-blocked`/`overlapping-controls` là dương tính giả cho descendant bị clip. [Receipt/script](D:/Workspace/pos-cafe/artifacts/employee-ui-diagnostic-20261009/stable-result.json). Không sửa employee source/detector/baseline. Investigator dùng dependency Windows cũ; regression cuối chạy lại đúng lockfile.

**Payment:** panel mobile cao≈321px, header/footer các track auto chiếm hết chỗ; track giữa `minmax(0,1fr)` về0, danh sách chỉ còn padding12px. Regression trước sửa FAIL tại vùng danh sách phải dùng được. Attempt01 chuyển track thành auto và cho aside cuộn vẫn để middle section0, nên FAIL được giữ riêng.

Bản cuối giữ summary grid/scroll nội bộ. Ở chiều cao viewport≤600px, grid hai pane trong [PaymentDrawer](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx) có min-height560px; outer body đã `overflow-auto`, nên cuộn toàn panel đến footer. Hình học sau sửa: panel560px, middle234px, list198.25px. Màn cao giữ layout hiện hành; màn thấp cần cuộn dọc, header drawer vẫn ngoài vùng cuộn. Không đổi số tiền/callback/quyền/write attempt. Chọn cuộn panel thay việc ép controls vào track0 hoặc thiết kế lại thanh toán.

[PaymentSummaryPane](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentSummaryPane.tsx) thêm tên checkbox **“Chọn thanh toán {tên món}”** và label24×24 bao input16×16, giữ checked/disabled/onChange. Vùng bấm mở rộng; detector vẫn đo input nhỏ nên cần kiểm label hiệu dụng. Không đổi quantity/selection handlers, màu/chữ hoặc baseline.

## Kiểm chứng cùng nguồn

- Source-before manifest SHA `57f1a49056eba533113201c96d9a9fb9acb02652b1c7b73e18c6e8283a14b8da`.
- [Source-after manifest](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/source-after.json) SHA `1529bb74a6dddd1ed116bb22b500a31b5814df41eb38c18562b95baa197232f5`, [tar](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/source-after.tar) SHA `06055a5a55c52d5d3156d1cbacb91a3acea873d1028e69ebf6d4918949290e59`. Mỗi bản756 entries:754 file và2 deletion markers. Hai application files payment đổi so với source-before; config/test mới đã có trong source-before. Giữ dirty changes cũ.
- Runner Windows riêng trong source-after, `npm ci --ignore-scripts --no-audit --no-fund`: Node24.16.0, PW1.60.0, Vite8.0.16, Vitest4.1.11, TS5.9.3 đúng lockfile. Không thay node_modules checkout chính (PW1.62.1/Vite8.2.1/Vitest4.1.10); thăm dò trên dependency cũ không là gate cuối. Mock/synthetic only, không SQL/hosted/fixture reset.

| Kiểm | Kết quả |
| --- | --- |
| npm test | **1.140/1.140**,106 files,exit0 |
| npm run build | PASS exit0; warning bundle lớn còn |
| Targeted strict/noEmit config+UI spec+helpers | PASS exit0; repo tsc-b không tự kiểm toàn test ngoài project |
| Chromium config riêng workers1/retries0/forbidOnly | **6/6 PASS**, desktop1440×900/tablet1024×768/mobile844×390; zero skip/flaky/expected-failure/hook error |
| Smoke nghiệp vụ có sẵn,workers2/retries0/forbidOnly/traceoff | **35 PASS/31 viewport skip**,zero unexpected/flaky/hook error; không biến skip thành full coverage |
| Audit selftest→audit16states×3viewport | Selftest23 OK,setup0; **FAIL62 nhóm,26 ngoài baseline:3error/23warn**; phân loại bên dưới, không update baseline |

UI regression chọn đủ hàng employees qua normal scroll/click và mở form; payment có vùng chọn món dùng được, select-all→amount0/pay-disabled, checkbox từng món có accessible name và normal click/plus, quantity đúng trần, Space bỏ chọn→amount0, chọn lại tất cả→original total, không receipt/thanh toán ngầm; footer center hit và ảnh ba viewport. Không force-click hoặc bỏ lớp phủ. [Config](D:/Workspace/pos-cafe/playwright.permission-ui-closeout.config.ts), [test](D:/Workspace/pos-cafe/tests/smoke/permission-ui-closeout.spec.ts).

## Lịch sử, giới hạn và review

- Pre-fix mobile1PASS/1FAIL; source-before phục hồi được. Attempt01 summary-only5PASS/1FAIL, delta source/báo cáo FAIL giữ riêng. Script diagnostic đã ghi đè geometry/ảnh ở lần sau; chuyển tệp đó thành after-geometry/after-mobile, không dùng như nguyên bản attempt01. Kết quả cuối đúng lockfile6PASS.
- Đã đọc audit report và ảnh annotated; diagnostic cuối đúng lockfile xác minh Croissant mobile: wheel100px, inner scrollTop54, checkbox y343.375→289.375, center hit SECTION→INPUT; click tọa độ checked true→false/quantity0, drawer mở/no receipt/no pay. [Result/script](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/target-diagnostic/result.json). Ba error ngoài baseline đều là descendant bị clip (hai employees, một payment), không còn blocker chức năng mới được tái hiện trong scope này. Giữ audit raw FAIL; không tự cấp waiver hoặc claim zero defects.

### Phân loại26 nhóm ngoài baseline

| State/rule/selector rút gọn | Đo và phân loại |
| --- | --- |
| employees/mobile: row3 `hit-blocked` + `overlapping-controls` (2error) | Hàng218×73 y322; nằm ngoài list viewport. Cuộn chuột/click tọa độ chọn được; **dương tính giả clipping**. |
| payment/mobile: Croissant `label.size-6 > input.size-4` hit-blocked (1error) | Input16×16 y343; sau cuộn center hit INPUT và lựa chọn thay đổi, không pay; **dương tính giả clipping**. |
| employees/3viewport: toggle và permission input tiny-target (6warn) | Label toggle cao44px, permission cards58px; owner controls disabled đúng hợp đồng, click không đổi checked. Hai disabled card mobile center bị clip ở vị trí cuộn một phần; không claim tất cả centers unobstructed. Detector đo input thay label; **dương tính giả vùng bấm cho state owner này**. |
| payment/3viewport: món `label.size-6 > input` và print label tiny-target (6warn) | Món label24×24, click đổi9/9; print label cao32/39/40.5px, click đổi3/3. **Dương tính giả input-box**. |
| payment/3viewport: select-all tiny-target (3warn) | Label cao18.75/20/21.25px<24; click được3/3 nhưng **cảnh báo target nhỏ thật**. Chưa mở scope sửa/waive. |
| settings/tablet,desktop: nhãn MÃ QUÁN tiny-font (2warn) |9.5px<10px, ảnh annotated xác nhận; **lỗi chữ nhỏ thật**. |
| payment + clear-demo-dialog/3viewport: low-contrast (6warn) |4.42:1 và4.46:1<4.5:1, ảnh xác nhận; **cảnh báo tương phản thật**. |

Tổng:3error+12warn dương tính giả trong trạng thái đã đo;11warn thật. 36 nhóm baseline còn trong report, không phải đã sửa/đã kiểm sạch. [Report cuối](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/source-after/ui-audit/report.md), ảnh annotated cùng thư mục out; root đã xem employees/payment mobile, đối chiếu các ảnh settings/clear-demo/payment tablet/desktop trước chốt. Native browser/server diagnostic5184 đã đóng. Warnings không tự thành waiver release.
- Không gán evidence mock này cho Supabase/Auth/REST/Storage/Realtime/full19PIN/full60PERM hoặc acceptance chủ dự án. T15–T18/PIN-T06–07 và release/postflight còn bắt buộc.
- Candidate-01 SHA `e0d263c396d8ec415e016577c166f2172d7d015dd323c43c81a42ffb188ec7a5` gồm source/safe receipts/docs snapshot; **SEC-UI-CLOSE và COV-UI-CLOSE đều APPROVE exact candidate**, không còn blocker trong scope. [Biên bản review](../reviews/2026-10-09-permission-ui-closeout.md). Scope UI/closeout hoàn tất kỹ thuật; review G2c không thay review này, không full product/release/owner acceptance.

Walkthrough chuẩn bị: short-height grid→outer scroll→checkbox label/name→handlers giữ nguyên→click/Space/pay-disabled assertions→audit classification→gates trước deploy. Chưa có phản hồi owner đọc/hiểu/nghiệm thu.
