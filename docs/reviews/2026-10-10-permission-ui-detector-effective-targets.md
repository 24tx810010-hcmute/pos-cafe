# Review độc lập — UI audit effective target (10/10/2026)

- Reviewer: `pin_identity_review`, không tham gia sửa detector.
- Scope: `ui-audit/audit.js`, `run.mjs`, `effective-targets.html`, README/AGENTS; đối chiếu report 09/10 với full audit mới khi có. Không review `src/` hay baseline update.
- Candidate đang kiểm: SHA-256 `audit.js` `4ac10e0d6b1520dd3e8f27796d17bb83db34a2e99340ea94a38f4a3af0ad7fa9`, `run.mjs` `98ad0eb6dc17469ca38f6d71aa11c7b647639e8d34bba2ff70ed8fd314a80618`, `effective-targets.html` `0cc095a4c494b029abec1370cdb521f38844a7cc04bd75f3bd03872cacefb56a`; baseline SHA-256 `79fe315c36c21db23a66724939b085e5ac4065d16780e2a0d26e1f9da5c87080` bằng snapshot cũ.
- Nguồn: code hiện tại, bản trước trong `artifacts/permission-pin-identity-close1/source-01/ui-audit/`, `ui-audit/AGENTS.md`, `ui-audit/README.md`, archived report `artifacts/permission-ui-warning-closeout-20261009/report.json`.
- Kiểm độc lập: `npm run ui-audit:selftest` exit 0: 23 seeded findings, 14 required rule classes, sáu effective-target controls OK. Diff chỉ bổ sung `exposedRect`, `tapTargetRect` và controls; config/baseline hash giữ nguyên. Một probe Playwright HTML trong bộ nhớ, không sửa file, kiểm phần label bị lớp phủ một phần.

| Finding | Phân loại | Bằng chứng và tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- |
| UI-DET-01 | **Chặn** | `audit.js:210–218` lấy toàn bộ bounding rect của label cho checkbox/radio nếu label hiển thị và pointerEvents khác none; `:285–303` dùng diện tích label cho tiny-target nhưng hit test vẫn chỉ thử tâm của input. Probe: checkbox `13×13` trong label `160×40`, overlay che phần text/bên phải label nhưng chừa ô input và dải trái `<24px`. `elementFromPoint` tại ô input trả input, tại tâm vùng nhãn trả overlay, còn `__uiAudit()` cho input **không có finding**. Vùng bấm thực tế còn lại quá nhỏ, nhưng tiny-target bị che mất; sáu controls hiện có chưa kiểm trường hợp label bị phủ một phần. | Thêm negative control tương ứng và dùng hình học/điểm hit có xét vùng label thực sự chạm được trước khi dùng label thay kích thước input; chạy lại selftest và audit. | Mở. |

Full audit mới đang chờ hoàn thành tại thời điểm review này; file `ui-audit/report.json` hiện là kết quả target đơn 1×1 nên không dùng làm đối chiếu toàn app. Không chạy `ui-audit:update` hoặc sửa baseline.

**Verdict tạm: CHANGES_REQUESTED cho candidate hash trên** vì detector có false negative về vùng chạm thật. Verdict cuối sẽ ghi tiếp sau khi tác giả sửa và có full audit cùng source.

## Re-review bản sample grid (trước full audit)

Hash mới: `audit.js` `716cd0ee9c154bfa670013c51c452a8e3ff46a832c1ffa032236d610a66757b4`, `run.mjs` `4d3ce3a04b6db7146b0bbf3ef61c0be3845735d110f6c40d1bb64cadbebde398`, `effective-targets.html` `6d5413e50a03c0611804186e7b497f4ed75da9143b8647aa29a6435c6bae5cf6`. Selftest độc lập vẫn 23 findings và bảy controls OK. Negative control mới bắt được UI-DET-01 nên finding đó đã được xử lý ở mức oracle cụ thể.

| Finding | Phân loại | Bằng chứng và tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- |
| UI-DET-02 | **Chặn** | `audit.js:228–247` chọn hình chữ nhật sampled có **diện tích lớn nhất**, trong khi rule `tiny-target` đòi cả chiều rộng và cao ≥24px. Probe HTML trong bộ nhớ: label `200×40`; overlay che trái `170×24` ở dưới, chừa dải trên `200×16` và góc phải `30×40` thực sự bấm được. `elementFromPoint` trong góc phải trả label, nhưng detector báo `tiny-target 200x20px <24px` vì chọn dải trên có diện tích lớn hơn. Đây là dương tính giả trên control có vùng chạm hợp lệ. | Nếu tồn tại hình chữ nhật sampled có cả hai chiều ≥ngưỡng, dùng nó; chỉ báo tiny khi không có hình hợp lệ. Bổ sung positive control góc phải còn bấm được và chạy lại selftest/audit. | Mở. |

**Verdict sample-grid revision: CHANGES_REQUESTED** vì UI-DET-02. Chưa xét full audit mới cho revision này.

## Re-review bản ưu tiên vùng đạt ngưỡng (trước full audit)

`clickableLabelRect` đã ưu tiên hình chữ nhật sampled có cả hai chiều ≥24px; probe góc `30×40` của UI-DET-02 nay không còn finding. Selftest độc lập 23 findings và tám controls OK. UI-DET-02 đóng trong phạm vi đã kiểm.

| Finding | Phân loại | Bằng chứng và tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- |
| UI-DET-03 | **Chặn** | `audit.js:255–263` duyệt `input.labels` nhưng trả ngay nhãn đầu tiên có kích thước ≥ input, dù nhãn đó vẫn nhỏ hơn 24px. Probe HTML trong bộ nhớ: input `13×13`, nhãn liên kết thứ nhất `20×20`, nhãn thứ hai `160×40`, tâm nhãn lớn hit chính nhãn; detector vẫn báo `tiny-target 20x20px`. HTML cho phép nhiều nhãn liên kết một input, và người dùng có vùng bấm hợp lệ thứ hai. | Chọn vùng đạt cả hai chiều ≥ngưỡng từ **mọi** nhãn liên kết trước khi kết luận tiny; thêm control multi-label, rồi chạy lại selftest/audit. | Mở. |

**Verdict revision này: CHANGES_REQUESTED** do UI-DET-03. Full audit mới chưa đủ điều kiện đối chiếu khi detector còn đang đổi.

## Vòng adversarial bổ sung trước freeze

UI-DET-03 đã sửa bằng cách xét toàn bộ associated labels và ưu tiên vùng đạt ngưỡng. Selftest độc lập 23 findings, chín controls OK. Tìm thêm hai phản ví dụ có thể tái hiện, không sửa source.

| Finding | Phân loại | Bằng chứng và tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- |
| UI-DET-04 | **Chặn** | `audit.js:222–225` coi mọi descendant của label nhận hit là vùng kích hoạt checkbox. Probe: checkbox `13×13` liên kết label `180×40` bị child `<a>` phủ; `__uiAudit()` không báo `tiny-target`, nhưng click tâm anchor để checkbox **unchecked** và đổi URL hash `#linked`. Interactive descendant có hành vi riêng, nên vùng nhãn này không phải vùng bấm checkbox. | Loại những hit qua interactive descendant không kích hoạt input; thêm negative control và xác minh bằng click thật. | Mở. |
| UI-DET-05 | **Chặn** | `audit.js:188–204`, `:292–314` (ở revision đầu; line mới có thể dịch) trả `null` nếu child nằm hẳn ngoài ancestor `overflow:clip`, rồi bỏ cả hit và overlap. Probe: vùng `clip` cao 80px, child button sau spacer 100px, footer nằm trên toạ độ layout của child. Detector cũ trong source-01 báo `hit-blocked` và `overlapping-controls`; detector mới không báo gì. Với `overflow:clip`, set `scrollTop=100` vẫn là 0: user không thể cuộn để lộ button. | Phân biệt auto/scroll có thể cuộn với clip/hide không thể lộ; có oracle riêng cho control bị clip hoàn toàn hoặc giữ phát hiện tương đương. Thêm negative control `overflow:clip`. | Mở. |

**Verdict trước freeze: CHANGES_REQUESTED** cho revision hiện tại do UI-DET-04/05. Bốn finding trước lần freeze đều có probe Playwright xác định; không mở rộng thành đánh giá mọi trường hợp DOM/CSS có thể có. Full audit chỉ nên chạy sau khi detector source ổn định.

## Re-review bản clip/anchor/disabled

Code đã loại interactive descendant khỏi vùng label, thêm `clipped-interactive` cho control ngoài `overflow:clip/hidden` và bỏ `tiny-target` của native disabled. Selftest độc lập 23 findings, 12 controls OK; các probe UI-DET-04/05 được bắt theo ý định. Kiểm thêm trường hợp nested scroll thông dụng:

| Finding | Phân loại | Bằng chứng và tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- |
| UI-DET-06 | **Chặn** | `audit.js:209–223` xét box hiện tại với ancestor `overflow:hidden/clip` nhưng không xét scroller `auto/scroll` nằm ở giữa. Probe Playwright: outer wrapper `overflow:hidden` cao 80px, inner scroller `overflow:auto` cao 80px, button sau spacer 100px. Trước cuộn detector báo `clipped-interactive`; sau `inner.scrollTop=100` button lộ và finding biến mất. Đây là dương tính giả trên control có thể cuộn tới. | Chỉ coi clip là vĩnh viễn nếu không có ancestor cuộn trung gian có thể đưa control vào vùng clip; thêm đối chứng nested scroll rồi chạy selftest/audit. | Mở. |

**Verdict revision này: CHANGES_REQUESTED** do UI-DET-06; full audit của revision cũ không dùng làm kết luận final.

## Kiểm trước full audit

Revision tiếp theo xét overflow `auto/scroll` có scroll range nằm trước ancestor `hidden/clip` theo trục. Đối chứng nested scroll không còn `clipped-interactive`, còn `overflow:clip` độc lập vẫn báo lỗi. Các oracle UI-DET-01–06 đã có fixture riêng; selftest độc lập: 23 seeded findings và 13 effective-target controls PASS, exit0. Một lượt đọc source sau sửa không thấy blocker mới trong các tình huống đối chứng đã tái hiện; đã báo tác giả có thể freeze và chạy full audit.

Giới hạn còn lại của heuristic: có scroll range không tự chứng minh một positioned child sẽ dịch chuyển theo scroll trong mọi CSS layout. Chưa có bằng chứng trường hợp đó trong app nên ghi là hạn chế, không mở finding chặn mới ở vòng này. Verdict cuối vẫn chờ manifest/hash của detector và full report trên đúng source.

## Full audit vòng đầu sau freeze

Manifest `D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/source.json` ghim `audit.js` SHA-256 `fe44791c6547f6fb8a61b7335daacbe2f5fa56605749afc3692188df4c99d6da` và `run.mjs` `7b5fb8d128bd613d324b71a4cc5e53e917d3ef2ea84066fe7103a7903c5775e2`; file live lúc đọc khớp. Baseline/config hash không đổi. Full audit 16 targets × 3 viewports, setup failures0, 26 findings/4 ngoài baseline, exit1. So với archived 09/10 report 51 findings: 27 khóa finding cũ biến mất, hai khóa mới `clipped-interactive` xuất hiện; hai `tiny-target` payment/mobile còn ngoài baseline. Đã xem ảnh annotated `menu_editor__mobile.png`, `payment__mobile.png` cùng source UI.

- `menu-editor/mobile` `Danh mục` là lỗi UI thật: trình duyệt sau transition cho button x476–583; category strip `overflow-x:auto` x18–583 nhưng `clientWidth=scrollWidth=565`, không có scroll range; section `overflow:hidden` kết thúc x465. Cuộn ngang bằng wheel không đổi `scrollLeft` hoặc finding. Chỉ scroll programmatic của hidden section mới lộ control. Source `MenuCatalogPane.tsx:87–123`, `MenuEditorDrawer.tsx:309–323`. `Xóa` ở card bên phải x495 cũng bị bố cục hai pane cắt; cần kiểm trực tiếp độc lập trước kết luận cuối.
- `payment/mobile` hai `tiny-target` là input 16×16 dưới phần đang nhìn của drawer, trong vùng có thể cuộn; label bao quanh lớn hơn khi được đưa vào viewport. Rule hiện dùng own input khi `clickableLabelRect` trả null cho label đang ngoài viewport, nên đây là dương tính giả do phép đo tại vị trí cuộn hiện tại. Cần source mới tự kiểm khả năng lộ ra qua cuộn auto/scroll và khôi phục scroll state.

**Trạng thái review:** giữ CHANGES_REQUESTED cho detector cho tới khi hai payment false positives được xử lý, selftest/full audit chạy lại cùng source. Không tự chấp nhận findings mới vào baseline. Lỗi UI menu cần owner quyết định scope sửa riêng; review detector không biến lỗi đó thành dương tính giả.

## Kiểm sửa menu và vùng nhãn sau cuộn

Sửa UI ở `MenuCatalogPane.tsx` thêm grid track hữu hạn theo chiều ngang. Chromium độc lập trên dev server mock (đã tắt sau kiểm):

- Mobile 844×390 sau drawer ổn định: pane x9–465, category strip x18–456 có `scrollWidth=565`, `clientWidth=438`. Cuộn ngang bằng wheel làm `scrollLeft` 0→127, nút “Danh mục” chuyển x476–583 (bị cắt) sang x349–456 (tâm hit chính nút). “Xóa” đầu tiên x207–238, y221–249 có tâm hit đúng và nằm trong pane. Các “Xóa” sau nằm dưới phần hiển thị của scroller dọc.
- Tablet 1024×768 và desktop 1440×900: nút “Danh mục” và những “Xóa” đại diện đang hiển thị có tâm hit đúng, nằm trong pane; không thấy hồi quy cắt ngang.
- Đây là phép kiểm trên giao diện thật ở mock runtime; không coi là nghiệm thu mọi luồng menu. Sửa thuộc UI candidate của tác giả, không nằm trong source detector manifest trước đó.

Detector mới `clickableLabelRect` thử cuộn chỉ ancestor `overflow:auto/scroll`, sample vùng nhãn sau cuộn và khôi phục offset trong `finally`. Selftest độc lập vẫn 23 seeded findings; fixture nhãn offscreen chứng minh không báo tiny và scroll offset trở về 0. Targeted payment/mobile theo tác giả 0/0; reviewer đang chờ full report và hash mới để đối chiếu. Bằng chứng này đóng vấn đề đo nhãn payment tại vị trí cuộn hiện tại trong phạm vi oracle/fixture, không tự kết luận audit toàn app.

## Final re-review — source-final (10/10/2026)

- Manifest `D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/source-final.json` SHA-256 `85b382f98aad12c97654265fa7b227405c41eb8d5aa8e68e1bd2f8d41b9ef5bd`; 11/11 file hashes khớp live source tại lần review. `audit.js` `cb775fb2b9ff0517d4fd9137870f9192457b1695ba9dda5858af57647ec9d7e6`, `run.mjs` `0f95fd557d314686dcbb2a0d902f900f25ecf01800edfbe9c62ca3eee61172d0`. Baseline `79fe315c36c21db23a66724939b085e5ac4065d16780e2a0d26e1f9da5c87080` và config `7e2e838729578873b937986933c20725b3821846c7e9e1993402820a081dc69a` giữ nguyên từ source cũ.
- Frozen report `D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/report-final.json` SHA-256 `3cd4ad2d927d752419913284c863b3f858f567901bf8021385f1b1816f7ee56b` khớp tệp. `report-final.md`: 16 targets × 3 viewports, setup failure 0, 22 findings, **0 ngoài baseline**; tác giả ghi audit exit0. Reviewer tự lọc JSON: archived report 09/10 có 51/15 ngoài baseline; final 22/0; 29 finding keys cũ bị loại (8 `hit-blocked`, 9 `overlapping-controls`, 12 `tiny-target`), 0 key mới. Không có `clipped-interactive` còn lại sau UI menu fix.
- Reviewer tự chạy lại `npm run ui-audit:selftest` trên 11 file hash final: exit0, 23 seeded findings, 14 required rules, effective-target controls OK (bao gồm overlay label, vùng góc hợp lệ, multi-label, anchor child, clipped thật/nested scroll, disabled và label offscreen được đo sau cuộn với offset khôi phục). Full audit không chạy lại lần thứ hai trong phiên reviewer; đối chiếu report đã lưu/hash và kiểm trực tiếp UI menu ở ba viewport như trên.

| Finding | Kết luận final |
| --- | --- |
| UI-DET-01 | Đã giải quyết: label bị phủ chỉ còn vùng nhỏ vẫn báo `tiny-target`; control tự kiểm pass. |
| UI-DET-02 | Đã giải quyết: vùng góc đủ hai chiều được chọn trước dải diện tích lớn nhưng thấp; control tự kiểm pass. |
| UI-DET-03 | Đã giải quyết: xét mọi associated labels; control tự kiểm pass. |
| UI-DET-04 | Đã giải quyết: interactive child có action riêng không được tính là vùng kích hoạt input; control và click oracle pass. |
| UI-DET-05 | Đã giải quyết: clipped không thể cuộn nhận `clipped-interactive`; control pass. |
| UI-DET-06 | Đã giải quyết: nested scroller có thể đưa control vào vùng clip không bị báo; control pass. |

**Verdict: APPROVE exact source-final manifest `85b382f9…` trong scope UI detector correction, menu reachability đại diện và consistency của frozen audit report.** Các verdict CHANGES_REQUESTED ở các revision trước vẫn là lịch sử. Approval này không sửa baseline, không đánh giá tất cả finding baseline còn lại, không thay gate ứng dụng/permission/PIN/release. Manifest source-final là danh sách hash 11 file, không tự là archive phục hồi toàn candidate; task điều phối vẫn cần snapshot/patch đầy đủ ở final CLOSE-2 gate.
