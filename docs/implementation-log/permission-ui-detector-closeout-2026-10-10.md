# UI audit: vùng bấm và vùng cuộn thực — 10/10/2026

## Quyết định

Chủ dự án chọn sửa detector cho 15 finding ngoài baseline đã được kiểm là dương tính giả (3 lỗi lớp phủ/vùng cuộn, 12 `tiny-target` input gắn nhãn), giữ nguyên ngưỡng 24px và `baseline.json`. Bản sửa 11 cảnh báo UI thật trước đó vẫn nằm trong ba component riêng; hồ sơ và review của bước đó không bị thay thế.

## Thực hiện

- `ui-audit/audit.js`: phép đo `hit-blocked`/`overlapping-controls` dùng phần control lộ ra trong các ancestor cắt/cuộn và viewport. Control bị cắt hẳn bởi `overflow:clip/hidden` mà không có vùng cuộn bên trong để đưa nó ra nhận `clipped-interactive`.
- `tiny-target` trên checkbox/radio xét vùng nhãn thật sự nhận hit, gồm mọi label liên kết; vùng bị overlay hoặc interactive child như `<a>` che không được tính. Nhãn ngoài viewport trong scroller được đo sau khi cuộn tới, rồi phục hồi các offset. Input native `disabled` không có yêu cầu vùng bấm.
- `ui-audit/effective-targets.html` và `run.mjs` thêm đối chứng cho control ngoài vùng cuộn, control thật bị che, nhãn bị che một phần, góc còn bấm được, nhiều nhãn, anchor phủ nhãn, `overflow:clip`, scroller lồng, input disabled và phục hồi scroll. Selftest trang lỗi mẫu vẫn phát hiện 23 finding.
- Audit trên source trung gian phát hiện thêm lỗi UI thật ở `menu-editor/mobile`: nút “Danh mục” và “Xóa” bị chiều rộng nội dung đẩy ra ngoài pane, không có cuộn ngang đưa tới. `MenuCatalogPane.tsx` thêm grid track `minmax(0,1fr)` để nội dung co về đúng pane. Reviewer tự kiểm trên ba viewport: mobile có horizontal scroll thực tới “Danh mục”; “Xóa” trong viewport nhận click, các nút khác ở dưới thuộc vertical scroller; tablet/desktop không hồi quy.

## Bằng chứng

- [Manifest nguồn UI cuối](D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/source-final.json), SHA-256 `85b382f98aad12c97654265fa7b227405c41eb8d5aa8e68e1bd2f8d41b9ef5bd`.
- `npm run ui-audit:selftest`: **23 finding mẫu, mọi đối chứng effective-target PASS, exit0**. `npm run ui-audit`: **16 trạng thái × 3 viewport, setup0, exit0; 22 finding tổng, 0 ngoài baseline**. [Report JSON](D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/report-final.json) SHA-256 `3cd4ad2d927d752419913284c863b3f858f567901bf8021385f1b1816f7ee56b`; [report đọc được](D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/report-final.md).
- Đối chiếu exact key với [report trước detector](D:/Workspace/pos-cafe/artifacts/permission-ui-warning-closeout-20261009/report.json): **51→22 nhóm, 29 removed, 0 added**. Trong 29 removed có đúng **15 ngoài baseline** và 14 baseline; phân theo luật: 8 `hit-blocked`, 9 `overlapping-controls`, 12 `tiny-target`. `baseline.json` SHA-256 vẫn `79fe315c36c21db23a66724939b085e5ac4065d16780e2a0d26e1f9da5c87080`; ngưỡng/config giữ nguyên.
- Chromium mock UI closeout **6/6 PASS** ở desktop/tablet/mobile; `npm run build` PASS; `npm test -- --maxWorkers=2` **109 files / 1.159 tests PASS**. Test-only PIN/CLOSE-1 tiếp tục được chỉnh sau lượt build/unit này, nên không suy thành gate source cuối toàn dự án.
- [Report attempt01](D:/Workspace/pos-cafe/artifacts/permission-ui-detector-closeout-20261010/report-attempt01.md) giữ lỗi mới lúc đầu (menu responsive thật và hai nhãn payment dưới viewport); không ghi đè hay gọi lượt đó PASS.
- [Review độc lập](../reviews/2026-10-10-permission-ui-detector-effective-targets.md) **APPROVE** đúng manifest/report hash ở trên trong phạm vi detector + sửa menu + tính nhất quán report. Reviewer kiểm lại hash của 11 file, selftest và diff JSON; không kết luận gate release.

## Giới hạn

22 finding còn lại đều thuộc baseline đã có, **không phải zero UI defects**. Audit selftest và run là mock/local; release/hosted gate cần manifest chung, dependency đúng lockfile và các oracle PIN/PERM khác. Docker daemon phục vụ runtime PIN tự restart trong lượt TC10/TC14, nên evidence UI sạch không nâng trạng thái các ca runtime chưa chạy.
