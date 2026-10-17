# Delta write-idempotency — áp trên phase 27 đã triển khai

## MODIFIED Requirements

### Requirement: Quyền hiện hành và tiếp quản

Mã: **PERM-29**.

Register/execute/get/list/cancel/terminal replay SHALL giữ mapping action năm quyền POS: create→order.create, update→order.update, void-open→order.voidOpen, pay/split→payment.take, void-paid→order.voidPaid. Quyền đọc lịch sử/in lại không tự cho thao tác K. List lọc quyền trước phân trang và kiểm lại khi đọc từng kết quả; không lộ payload/kết quả K cho actor thiếu quyền.

Server SHALL giữ kiểm session/quyền/expiry/TTL sau mọi khóa có thể chờ và đọc catalog revision hiện hành tại checkpoint cuối. Thu hồi single-target đã commit trong lúc execute chờ business lock SHALL được nhìn thấy; không lấy authority SHARE sớm để chặn revocation tới sau execute. Permission denial không tự cancel/reject/xóa K; giữ chính trạng thái trước, cho người khác đủ quyền tiếp quản đúng K theo baseline. R1/payload/initiator không được viết lại theo role/quyền mới; audit executor/takeover giữ actor thật.

Financial SHALL khóa trước cả employee reference của FK sẽ ghi, gồm initiator khác executor, theo thứ tự UUID trước session/catalog checkpoint. Không để FK lần đầu chờ sau kiểm quyền/TTL khi admin sửa initiator và catalog writer đang xếp hàng; initiator inactive không tự chặn actor đủ quyền tiếp quản.

#### Scenario: Mất quyền sau register

- **GIVEN** K pending đã register, owner revoke action trước execute
- **WHEN** actor execute hoặc tra cứu K không còn quyền
- **THEN** FORBIDDEN/không có kết quả được phép; K/payload/TTL không đổi, không có business effect mới.

#### Scenario: Người khác tiếp quản

- **WHEN** nhân viên B có action permission và phiên hợp lệ chủ động tiếp quản K của A
- **THEN** thực hiện đúng K/payload, ghi executor B, giữ initiator A và R1 bất biến; không tự dùng quyền in lại thay action permission.

#### Scenario: A hết ca; B có payment.take đọc và thực hiện lệnh pay của A

- **WHEN** B có payment.take và phiên hợp lệ đọc/thực hiện K pay do A khởi tạo
- **THEN** payment ghi actor B, initiator vẫn A; C thiếu quyền không đọc/thực hiện/hủy K đó. Cache cách ly cả khi cùng employee đăng nhập lại; FORBIDDEN/AUTH_REQUIRED/EMPLOYEE_SESSION_REQUIRED dọn payload/R1 nguồn bị từ chối, không mở receipt từ response cũ.

### Requirement: Tương thích giao thức và migration

Mã: **PERM-30**.

Triển khai SHALL có bridge giữ tương đương ba role/năm quyền cũ trước activation, rồi activation phối hợp DB/client/catalog 15. Không seed chỉ năm role candidate rồi đổi helper khiến admin cũ mất quyền ở pha gọi là “không đổi hành vi”. Không xóa guard/type cũ trước khi consumer chuyển và gate qua. Client không tương thích phải dừng ở cổng cập nhật trước protected UI/write, không khôi phục legacy RPC hoặc financial DML.

K protocol v1, payload fingerprint, replay, R1, pending TTL 24 giờ khác tuổi đơn, historical prices/options và quyền takeover phase 27 SHALL giữ nguyên. Migration không đổi hash/payload/receipt của K có sẵn. Sau activation không rollback về legacy security grants; rollback chỉ qua artifact tương thích hoặc dừng ghi và khôi phục backup/đối soát theo design. Không restore DB sau khi nhận giao dịch mới mà bỏ mất giao dịch đó.

Client vẫn kiểm writeProtocolVersion=1 cùng permissionContractVersion mới. Thiếu phiên bản/schema phù hợp chặn rõ, không fallback RPC cũ/mock. Backfill field lịch sử chưa biết bằng null có nghĩa; không bịa employee hoặc giá quá khứ.

#### Scenario: Bridge trước activation

- **WHEN** chạy fixture cả admin/cashier/kitchen với mọi tổ hợp năm quyền cũ
- **THEN** helper mới và cũ tương đương theo declared bridge scope; catalog/UI mới chưa được bật.

#### Scenario: Client cũ sau activation

- **WHEN** client không có contract authority/reprint mới cố vào app hoặc gọi legacy write
- **THEN** UI yêu cầu cập nhật và server legacy grants vẫn đóng; không dùng “tương thích” để mở đường bypass.

#### Scenario: Pending K từ trước migration

- **WHEN** K pending hợp lệ từ phase 27 được actor đủ quyền thực hiện sau activation
- **THEN** cùng K/payload, một effect, cùng receipt schema; order không hết hạn do K TTL.

#### Scenario: Client mới gặp DB chưa migration hoặc E2E thiếu Supabase config

- **WHEN** client gặp DB thiếu schema/version hoặc E2E không có Supabase config yêu cầu
- **THEN** WRITE_PROTOCOL_UNSUPPORTED hoặc preflight thất bại; không chạy backend giả rồi báo PASS.


## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.

