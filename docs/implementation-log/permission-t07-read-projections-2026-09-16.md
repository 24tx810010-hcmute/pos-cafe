# PERM-T07 — Projection đọc theo mục đích

Ngày 2026-09-16. **Hoàn tất T07 local; T08–T18 chưa thực hiện.** Người dùng đã cho phép code và push nếu cần. Kiểm thử local không cần push; chưa commit/push, chưa áp candidate lên Supabase thật. AppPorts/UI vẫn legacy.

## Kết quả và phạm vi

- Code HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, main; source cuối `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. T01–T07 và các diff có sẵn được giữ local; docs ở worktree riêng.
- [SQL candidate](D:/Workspace/pos-cafe/supabase/candidate/permission-read.sql:1) bổ sung12 read RPC và thay protected get_payment_receipt: tổng13 contract. T07 stage sau T04–T06 trong fixture, chưa là activation launcher. [Port](D:/Workspace/pos-cafe/src/ports/permissions.ts:1), [adapter](D:/Workspace/pos-cafe/src/adapters/supabase/permissionReadRepo.ts:1), [mock](D:/Workspace/pos-cafe/src/adapters/mock/permissionRepos.ts:1) có cùng projection.
- Floor chỉ layout+open summary; POS menu chỉ catalog đang dùng/available; open detail và paid-void lookup có predicate riêng. History chỉ closed orders, targeted cashier/voider names; không cần đọc toàn roster. Settings admin khác store display; display có currency/timezone để render.
- Mọi entry kiểm tenant/session/role/effective permission; target order SHARE trước actor/session/catalog khi cần. Projection SQL STABLE nằm trong statement mới sau checkpoint; kiểm phiên lần cuối. Admin revoke/catalog/session/state đã commit trong lúc chờ phải được thấy.
- Raw SELECT ở bảng/cột nhạy cảm bị revoke cả anon/authenticated/service_role; private helpers không callable. View history_entries đã bị migration010 bỏ: fixture chỉ dựng lại synthetic security_invoker view khi vắng để kiểm ACL legacy, rồi xóa khi cleanup. Không coi view đó còn tồn tại ở baseline phase27.
- Receipt read giữ paid/notvoid và history OR payment.take. Whitelist root/lines/options trước REST; giữ giá trị snapshot v1, không UPDATE snapshot hoặc R1. Legacy receipt dùng metadata hiện hành có legacyMetadata=true; không tự thành quyền in.
- History filter strict: page safe integer từ1, pageSize1–100; ngày Gregorian YYYY-MM-DD có thứ tự; paid/void; dine_in/takeaway; UUID tables. Date/status/type AND, search và tableIds OR; bỏ các ký tự grammar %,(), dấu phẩy, trim; #bill exact, literal ID/tableID contains. Thứ tự ngày/số đơn/id DESC, total trước paging.
- Adapter whitelist cả DTO lồng nhau, chặn input giả mạo trước RPC, chuẩn hóa lỗi hạ tầng để không lộ chi tiết thô, giữ credential generation tới sau decode; response của phiên cũ không tới consumer. T11 vẫn cần guard generation ở consumer trước áp cache/UI.

## Quyết định nghiệp vụ mới

Chủ dự án chọn giờ cửa hàng, mặc định UTC+7 (Asia/Ho_Chi_Minh; alias Asia/Saigon cũ giữ khi đọc), chỉ owner đổi timezone. T07 report dùng paid_at hoặc created_at trong timezone cửa hàng; ngày lọc vẫn business_date đã lưu. T08 phải chặn thay timezone ở non-owner dưới khóa, rollback cả request nếu trái quyền; T13 có control owner-only. Chưa tuyên bố rào chắn ghi/điều khiển UI này đã triển khai.

Chủ dự án giữ bảng tối đa20 đơn paid mới nhất trong toàn khoảng ngày dưới report.view, không yêu cầu orderHistory.view. RPC riêng listReportOrders trả đúng7 trường id/số đơn/ngày/loại/tổng tiền/trạng thái/tên bàn; không món/nhân viên/payment/receipt/lockVersion. Bảng không tự mở quyền lịch sử. Consumer report ở T13 phải chuyển khỏi query history cũ sang port mới.

## Bằng chứng kiểm thử

| Gate | Kết quả | Bằng chứng và SHA-256 |
| --- | --- | --- |
| T07 | 919 unit/component,120 SQL/Auth/REST; typecheck/build PASS | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t07/fa0df603-ec45-4db7-9d81-80bc4406315a/verification.json); `ca471eaac66edbec2324c7d7ddce8cdba8fafadfaaf5a34e47a66eef3e336ff8` |
| T06 | 44 SQL/Auth/REST; reuse unit/build T07 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t06/1f04054c-3072-4dc5-a822-8aac39b0b584/verification.json); `f785a85d63abf182fd94d21c80a8dcfbcd32f7a032bbe6ced5bd09681ab6e049` |
| T05 | 55 SQL/Auth/REST; reuse unit/build T07 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t05/d015a898-d754-4513-9219-caab01d4a368/verification.json); `230613887127493c699ccc1b8fc5b0de06946a6827979c02e46b7bec44ef2c4b` |
| T04 | 42 SQL/Auth/REST; reuse unit/build T07 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/1dc45051-35b4-468d-9c98-219fea1090cd/verification.json); `14ec4dd31ee965fea658b3f9aa602bb76a992f4dae599133a5423531b7d37267` |
| T03 | 4 SQL,1.280 profiles +9 lỗi; reuse unit/build T07 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t03/c07ae22b-96eb-49e4-8e61-f28760d42d3c/verification.json); `e2f2b86aad7807a67eb1d5afe83c3a7e60cf07cba5f9221993b6bd740faf3026` |
| T02 | 52 test,6.144 comparison, protocol và revert thật | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/94da8b4a-6e04-416b-b83b-f93b1e53c439/verification.json); `4be3121c6abb3c21794b04c8e1d84fa502c378fc0ee07eac4004111b12e29e7b` |
| T01 | 152 tooling +30 PostgreSQL; preflight READY | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/67f155d4-50d2-436c-ba54-ac4a1b60d4c2/verification.json); `fad7c63c66d525c7847caf0286d66863e315653cd3fa583c9d749a99442f2e06` |

[Runner T07](D:/Workspace/pos-cafe/scripts/permission-read-verify.mjs:1) kiểm Node24.16.0, dependencies đúng package-lock, [manifest bắt buộc](D:/Workspace/pos-cafe/tests/permissions/permissionReadCases.json:1), discovery/results/options, source trước/sau. Không skip/retry/expected-failure. 120 là execution variants, không phải số TC đã đóng toàn bộ.

[Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1) có13 endpoint × allowed/missing-or-invalid-baseline/expired/cross-store/forged, actual raw SELECT/private helper calls, positive REST controls, strict date/page/search, no-write fingerprint, immutable receipt/R1, report timezone/rounding và global20 summaries. PostgreSQL barriers chứng minh auth/catalog/session/order state sau wait; negative control bỏ post-lock guard phải làm detector phát hiện rò projection.

Review đã sửa chia bigint bị cắt trước round, JSON20.0 hợp lệ nhưng cast text→int lỗi, raw receipt JSON chưa whitelist và credential race giữa các microtask. Fixture dùng TEMP tables native để giữ timestamp/numeric; riêng employees và catalog revision phải restore chính xác trước hash so sánh. Gate kiến trúc còn phát hiện import core→ports ở parser mới; đã bỏ phụ thuộc và chạy lại toàn gate trên source cuối. Không nới oracle để làm test xanh.

T01/T04–T07 chạy từ Windows tới runtime loopback cách ly. Windows Hyper-V dành trước dải58421/58422 khiến T02/T03 không truy cập qua Windows localhost; hai gate đó chạy LinuxNode24.16.0 cùng byte source và HEAD, cùng phiên bản dependencies trong package-lock trong bản sao task, có source fingerprint equality. Shim chỉ exec lệnh Linux thật cho runtimeProof; Auth/DB marker và profile không đổi. Canonical Linux artifacts giữ nguyên byte, được copy về artifact folder Windows kèm mapping đường dẫn; không sửa report để giả runtime Windows. Không thay cổng/profile, excluded ranges hoặc cấu hình toàn máy.

## Giới hạn và tiếp theo

- TC13/38 mới receipt read; initial/reprint grants, callbacks/browser printing và UI thuộc T14.
- T07 SELECT closure không thay Storage/Realtime service gate T09/T10. Không claim chặn đủ mọi đường đọc ngoài RPC khi chưa activate bundle/service.
- Menu/floor/settings write, seed/clear và timezone owner-only write còn T08. UI/AppPorts/lifecycle T11–T14 chưa nối candidate; màn hình đang chạy chưa đổi.
- Không commit/push/deploy/live DB. Giữ15 quyền, không khôi phục role kế toán.

Chạy `npm run test:permission:t07` với IDEM_ENV_FILE của synthetic T04 loopback59421/59422 đúng marker/profile. Dừng riêng runtime T01/T02/T04 và helper task sau nghiệm thu, giữ volumes; không shutdown Docker/WSL toàn máy.

**Tiếp theo PERM-T08:** ghi menu/floor/settings và clear demo; giữ atomic/retention/owner boundary, thêm quyền thay timezone chỉ owner.
