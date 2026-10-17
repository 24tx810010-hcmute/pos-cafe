# Khảo sát cập nhật quyền và nháp — 2026-09-15

**Cập nhật cuối 15/09:** các quyết định dưới đây đã được đưa vào bộ spec; hai reviewer đã recheck và không còn blocker tài liệu. [Bàn giao READY FOR APPROVAL](06-ban-giao-spec-2026-09-15.md). Các đoạn mô tả giai đoạn đang hỏi/biên tập và số kiểm tra bên dưới là lịch sử của mốc đối chiếu, không phải trạng thái cuối.

Trạng thái: **Q9–Q14 đã chốt; toàn bộ cổng câu hỏi đã đóng ngày 2026-09-15, chuyển sang biên tập bộ spec**. Q12 thêm `receipt.reprint`, tăng catalog lên 15 quyền. Các con số Q9 là mục tiêu thiết kế đã chọn, không phải kết quả đo đạc hiện trạng; nội dung bộ spec chưa được duyệt. Baseline và phạm vi docs-only theo [báo cáo khảo sát](01-khao-sat-va-cau-hoi.md); Q1–Q8 đã được ghi nhận, trong đó Q8 cho owner tự đổi PIN sau khi xác minh PIN hiện tại.

## Q9 — thời gian hội tụ trên thiết bị đang mở

Quyết định ngày 2026-09-15: chọn phương án 1 và các điều kiện do chủ dự án bổ sung:

- Giao diện cập nhật trong 5 giây khi nhận thông báo thay đổi quyền. Mốc này đo từ lúc client nhận signal; không tuyên bố thời gian giao mạng từ commit tới signal luôn được bảo đảm.
- Một poll chung đọc revision mỗi 30 giây khi tab hiển thị; không mỗi feature một poll, không sao chép polling background hiện có. Chỉ tải snapshot quyền/catalog khi revision thay đổi hoặc cần xác minh lại dữ liệu chưa có. Khoảng cách giữa thời điểm bắt đầu kiểm tra không quá 30 giây, không phải chờ request trước xong rồi mới đếm tiếp 30 giây.
- Trần dự phòng 35 giây có điều kiện: foreground, online, scheduler chạy đúng nhịp và việc xác minh/tải quyền hoàn tất trong ngân sách 5 giây. Nếu poll revision rồi tải snapshot là hai request nối tiếp thì ngân sách này phải bao gồm **cả chuỗi**, cùng áp dụng lên UI; mỗi request riêng mất tối đa 5 giây không đủ chứng minh trần 35 giây. Đây là đính chính phép tính đã giải thích cho chủ dự án, không tuyên bố hệ thống hiện tại đạt ngân sách. Mất mạng hoặc backend không đáp ứng điều kiện thì không có trần thời gian tuyệt đối.
- Chi phí cơ sở khoảng 2 lần đọc revision/phút/thiết bị foreground, chưa tính tải snapshot khi thay đổi, event/focus/reconnect. Chủ dự án không chọn phương án 10 giây vì lợi ích trải nghiệm không tương xứng việc tăng tần suất; giữ cách xử lý đối xứng cho cấp và thu hồi quyền. Chưa xác nhận ngân sách hoặc giới hạn tải của môi trường thật.
- Focus/reconnect phải xác minh quyền trước khi mở lại phần được bảo vệ; giữ phiên, không ép đăng nhập lại chỉ vì role/override thay đổi.
- Server kiểm quyền hiện hành độc lập tốc độ cập nhật giao diện. Không biến độ trễ UI thành khoảng ân hạn cho quyền ghi đã thu hồi hoặc cho đường đọc mới chưa được cấp phép.
- Dữ liệu đã hiển thị/cache cần xử lý riêng khi mất quyền theo Q10 và phạm vi đọc Q1; không suy server từ chối request mới đã tự xóa được dữ liệu client nhận từ trước.
- Tab/focus/reconnect được đặc tả tường minh, không dựa vào mặc định thư viện. Nhịp dự phòng kiểm bằng timer xác định; nhánh signal cần gate với Realtime thật trong môi trường cách ly. Gate Realtime này **NOT RUN**, không dùng fake adapter để tuyên bố đạt độ trễ thật.

Hiện trạng: [usePosData.ts:6](D:/Workspace/pos-cafe/src/features/pos/usePosData.ts:6) có polling dữ liệu vận hành 5 giây kể cả background; đó không phải polling quyền. 12 lượt/phút là mức cơ sở **mỗi query** dùng nhịp này khi hoạt động, chưa phải tổng của thiết bị; vì có nhiều query, chưa đủ căn cứ khẳng định tăng tổng tải chính xác 17% hoặc 50%. [realtimePort.ts:13](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:13) làm mới các nhóm dữ liệu nghiệp vụ và [realtimePort.ts:50](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:50) resync khi subscribed/reconnect, chưa có hợp đồng hội tụ quyền nói trên. Rà source `refetchOnWindowFocus`/`refetchOnReconnect` chỉ thấy cấu hình reconnect trong [writeHistoryLifetime.test.tsx:26](D:/Workspace/pos-cafe/src/app/writeHistoryLifetime.test.tsx:26); không dùng mặc định thư viện làm requirement. Không lấy các nhịp đang có làm bằng chứng SLA quyền đã đạt.

## Q10 — phần nhập dở khi mất quyền

**Đã chốt ngày 2026-09-15:** đóng phần vừa mất quyền, bỏ phần nháp chưa gửi thuộc thao tác đó và báo rõ lý do. Giữ phần không liên quan, đơn đã lưu và thao tác đã được server tiếp nhận. Không tự gửi lại. Phương án giữ nháp tạm nhưng khóa tới khi quyền được cấp lại không được chọn.

“Bỏ nháp” không đồng nghĩa xóa đơn đã lưu, hủy thanh toán đã commit, hủy K hoặc tạo K khác. Trường hợp mất ACK đăng ký/thực thi phải giữ nguyên định danh và payload của thao tác để tra cứu theo giao thức phase 27; không suy việc client ngắt chờ là server chưa thực hiện.

## Ràng buộc kỹ thuật đã đối chiếu độc lập

Một subagent khảo sát client được gọi lại để kiểm các ràng buộc sau; đây không phải một trong hai lượt review bộ spec hoàn chỉnh. Không sửa application code hoặc chạy test triển khai.

| Điểm | Bằng chứng hiện trạng | Ràng buộc khi viết design |
| --- | --- | --- |
| Làm mới quyền khác đổi phiên | [useAppStore.ts:54](D:/Workspace/pos-cafe/src/app/useAppStore.ts:54) tăng `employeeSessionVersion` khi set employee; [WriteLifecycle.tsx:15](D:/Workspace/pos-cafe/src/app/WriteLifecycle.tsx:15) theo dõi cả employee identity và session version, rồi bỏ cache/leave coordinator | Có đường cập nhật snapshot/revision quyền riêng. Signal trùng/no-op không làm đổi phiên hoặc ngắt thao tác không bị ảnh hưởng. Bỏ response sai store/employee/session hoặc revision cũ |
| Thu hồi quyền trong cùng phiên vẫn cần chặn response muộn | [WriteRecoveryDrawer.tsx:33](D:/Workspace/pos-cafe/src/app/drawers/pos/WriteRecoveryDrawer.tsx:33) có key theo store/employee/session và kiểm access ở dòng 35–55; [queryKeys.ts:18](D:/Workspace/pos-cafe/src/features/shared/queryKeys.ts:18) chưa scope report/history theo employee | Giữ cách ly phiên phase 27; bổ sung kiểm authority revision cho read/reprint. Ngừng render, hủy read và xóa cache tương ứng khi mất quyền; chỉ invalidate chưa đủ |
| Dự phòng không được bị signal trùng trì hoãn mãi | [usePosData.ts:6](D:/Workspace/pos-cafe/src/features/pos/usePosData.ts:6) chỉ là nhịp vận hành hiện có | Một scheduler quyền foreground, gộp tín hiệu để tránh request thừa nhưng không liên tục dời hạn dự phòng. Timeout/lỗi không được giả thành snapshot quyền đã xác minh. Không sửa nhịp polling vận hành chỉ để thêm refresh quyền |
| Cổng xác minh phải đứng trước render/query dữ liệu được bảo vệ | [realtimePort.ts:50](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:50) resync ngay; [AppShell.tsx:44](D:/Workspace/pos-cafe/src/app/shell/AppShell.tsx:44) luôn mount floor | Không chạy refresh quyền song song rồi vẫn mở cache cũ trước khi xác minh. Chưa xác minh thì chưa mở phần bảo vệ; không dùng trạng thái này để tự logout hoặc tự gửi mutation |
| Bỏ nháp theo thao tác, không reset toàn ứng dụng | [OrderDrawer.tsx:45](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:45), [PaymentDrawer.tsx:49](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:49); [drawerNavigation.ts:10](D:/Workspace/pos-cafe/src/app/drawerNavigation.ts:10) có dirty-exit | Áp kết quả Q10 theo quyền/thao tác bị thu hồi. Dirty confirmation không được giữ phần vừa mất quyền mở vô hạn. [writeOperationFlow.ts:40](D:/Workspace/pos-cafe/src/features/pos/writeOperationFlow.ts:40) leave chỉ vô hiệu phản hồi client; không đổi trạng thái K server |

Các ràng buộc trên giải quyết cách giữ những bảo đảm đã chốt, nay áp theo Q10 đã trả lời. Spec và testplan sau này phải có trường hợp signal mất/trùng/sai thứ tự, đổi session khi refresh còn chờ, role catalog đổi toàn cục, revocation khi mất ACK và refresh lỗi.

## Q11 — sơ đồ luôn xem được, đã chốt và thay quyết định cũ

Nguồn câu hỏi ban đầu: subagent khảo sát yêu cầu đối chiếu tổ hợp thiếu `floor.view` nhưng còn quyền tạo/sửa/thu tiền. [Delta access-control:92](../../../openspec/changes/redesign-permission-model/specs/access-control/spec.md:92) yêu cầu ẩn sơ đồ khi thiếu quyền xem, trong khi [PaymentDrawer.tsx:43](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:43) hiện tải floor để thao tác thanh toán. Hai phương án đã hỏi đều dựa trên tiền đề có thể thu hồi quyền xem sơ đồ.

**Trả lời ngày 2026-09-15:** chủ dự án xác định `floor.view` luôn là quyền có sẵn, mọi người đều thấy sơ đồ; quyền xem không phải quyền điều chỉnh sơ đồ. Quyết định này thay tiền đề của câu hỏi, không phải chọn một trong hai phương án cũ.

Hệ quả cần áp khi biên tập bộ spec:

- Các vai trò đang dùng `owner`, `manager`, `cashier`, `waiter`, `accountant` đều được xem sơ đồ. Thay scenario accountant không thấy sơ đồ và hàng mặc định `floor.view` tại [delta:20](../../../openspec/changes/redesign-permission-model/specs/access-control/spec.md:20); kế toán vẫn không được tạo/sửa đơn hoặc thu tiền nếu thiếu các quyền đó.
- Giữ `floor.view` trong catalog, biểu diễn là quyền nền luôn có của các vai trò đang dùng; Q12 sau đó thêm quyền in lại và tăng tổng catalog từ 14 lên 15. Không cho bật/tắt quyền nền trên UI quản trị; request cố deny quyền nền phải bị từ chối, không âm thầm lưu deny rồi bỏ qua nó. Công thức Q2 vẫn áp cho overrides hợp lệ. Thuộc tính quyền nền phải được đặc tả từ catalog, không thêm bảng role/module hard-code riêng.
- `floor.manage` tiếp tục là quyền riêng để tạo/sửa bố trí bàn, khu vực và trang trí. Xem sơ đồ không cấp quyền chỉnh sơ đồ, ghi đơn, thu tiền, lịch sử hoặc báo cáo.
- Luôn có quyền xem không đồng nghĩa truy cập công khai: vẫn cần phiên nhân viên hợp lệ, active và cùng store. Không mở dữ liệu cửa hàng cho phiên hết hạn, nhân viên bị khóa hoặc người chưa xác thực.
- `kitchen` vẫn là vai trò dự phòng chưa bật theo quyết định trước; Q11 không được dùng làm lý do tự triển khai màn bếp hoặc mở vai trò đó cho sử dụng.
- Tình huống “đã đăng nhập hợp lệ nhưng không còn module nào do thu hồi mọi quyền” không còn là trạng thái bình thường của năm vai trò đang dùng: tối thiểu vẫn có sơ đồ. Có thể dùng floor làm fallback chung khi mất module khác. Trạng thái chưa xác minh phiên/catalog vẫn cần màn trung tính theo Q9; không tự logout vì role/override đổi.

Ranh giới đọc vẫn phải xử lý theo Q1: [FloorWorkspace.tsx:227](D:/Workspace/pos-cafe/src/app/shell/FloorWorkspace.tsx:227) hiện hiển thị tổng tiền đơn đang mở, còn [orderRepo.ts:54](D:/Workspace/pos-cafe/src/adapters/supabase/orderRepo.ts:54) có đường đọc chi tiết đơn và payment/receipt rộng hơn. Cho mọi người xem sơ đồ không đồng nghĩa cho gọi đường đọc chi tiết rộng đó chỉ dựa vào `floor.view`; phải tách dữ liệu phục vụ sơ đồ khỏi các dữ liệu cần quyền khác. Không tự mở lịch sử đã thanh toán/hủy, receipt hoặc báo cáo qua query sơ đồ.

## Q12/Q12a — tách quyền in lại, đã chốt

Nguồn câu hỏi: [OrderHistoryDrawer.tsx:191](D:/Workspace/pos-cafe/src/app/drawers/admin/OrderHistoryDrawer.tsx:191) đọc order rồi gọi `getReceipt`; [OrderHistoryDetailPane.tsx:58](D:/Workspace/pos-cafe/src/app/drawers/admin/OrderHistoryDetailPane.tsx:58) hiển thị nút in lại và vô hiệu theo trạng thái. Phía mock [orderRepo.ts:23](D:/Workspace/pos-cafe/src/adapters/mock/orderRepo.ts:23) và RPC cuối [016:166](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:166) kiểm `payment.take`. Accountant trong mô hình mới có lịch sử nhưng không có thanh toán.

**Quyết định ngày 2026-09-15:** tách quyền xem lịch sử đơn và quyền in lại đơn/hóa đơn thành hai quyền. Thêm mã `receipt.reprint`, nâng catalog từ 14 lên **15**; quyết định này thay khuyến nghị tự cho in lại chỉ vì có `orderHistory.view`. Chức năng in lại đã có, quyền mới bảo vệ chức năng đó, không seed một tính năng chưa tồn tại.

Q12a chốt mặc định:

| Vai trò | `receipt.reprint` mặc định |
| --- | --- |
| Owner | Có |
| Manager | Có |
| Cashier | Có |
| Accountant | Không; cần được cấp thêm |
| Waiter | Không |
| Kitchen | Không; vai trò vẫn chưa bật |

Quyền in lại được cấp/thu hồi riêng theo Q2, không dành riêng owner. Tại nơi nhân viên đã được phép xem hóa đơn, chức năng in lại còn đòi `receipt.reprint`; quyền mới không tự mở lịch sử, quyền thu tiền hoặc quyền execute/cancel/tiếp quản K. Giữ điều kiện hóa đơn thuộc đơn đã thanh toán, chưa bị hủy. `report.view` riêng không suy ra quyền xem lịch sử hay in lại.

In ngay sau thanh toán vẫn thuộc luồng `payment.take`, như phạm vi đã nêu trong Q12a. Đây là phân biệt chức năng theo luồng trong ứng dụng; không được suy thành máy chủ đã đo hoặc bảo đảm số bản in giấy. Nguồn hiện tại: [PaymentDrawer.tsx:200](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:200) mở preview khi `printReceipt && result.initialSuccess`; [WriteRecoveryDrawer.tsx:90](D:/Workspace/pos-cafe/src/app/drawers/pos/WriteRecoveryDrawer.tsx:90) có đường in lại riêng, và [ReceiptPreview.tsx:339](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:339) gọi lại `getReceipt` trước khi in. Phải rà cả ba bề mặt, không chỉ thêm guard ở nút lịch sử. Receipt/R1 lịch sử không được viết lại theo giá, tên hay quyền mới; in lại không sinh thanh toán khác.

Trước trả lời Q11, subagent nhận định default/fallback và chuẩn hóa overrides là hợp đồng kỹ thuật, không cần hỏi riêng. Phần fallback sau Q11 áp quyền nền đã chốt ở trên; không còn dùng giả định accountant không có sơ đồ hoặc nhân viên hợp lệ bị mất mọi module. Chuẩn hóa null/thiếu/rỗng/trùng, kiểm kiểu dữ liệu và OCC vẫn cần đặc tả cụ thể, không hỏi lại công thức Q2. Đây là khảo sát bổ sung, không phải lượt review bộ spec hoàn chỉnh.

## Q13/Q14 — audit, đã chốt

**Audit chi tiết và retention:** Q7 đã chốt lưu cả lần quản trị bị từ chối sau khi xác minh actor/target cùng store, nhưng chưa chốt người được đọc và thời gian giữ. [Design hiện tại](../../../openspec/changes/redesign-permission-model/design.md) chỉ giới hạn đọc theo store và mặc định giữ vô thời hạn với giả định ít bản ghi. Q4 cho ủy quyền quyền sửa phân quyền, Q7 tăng loại sự kiện được ghi, nên không suy tất cả nhân viên cùng store được đọc hoặc lượng dữ liệu chắc chắn rất nhỏ. Phải chốt riêng; Realtime chỉ dùng signal tối thiểu theo Q7.

- **Q13, trả lời ngày 15/09:** owner và người có `employee.permission.edit` được đọc audit chi tiết trong cùng cửa hàng. Không chọn khuyến nghị chỉ owner. Trần actor/target Q2 áp thao tác quản trị, không tự thu hẹp quyền đọc audit đã được Q13 cấp. Chưa thêm màn audit trong change, quy tắc áp đường đọc server; không phát chi tiết qua Realtime.
- **Q14, trả lời ngày 15/09:** giữ toàn bộ audit, chưa tự động xóa; clear demo không xóa. Chấp nhận dung lượng tăng, không giả định ít bản ghi sau Q7. Không chọn thời hạn 12 tháng, không triển khai GC trong change.

Khảo sát in bổ sung xác nhận: quyền mới kiểm soát đường in lại chính thức và các điều kiện đọc server, không bảo đảm người đã nhận dữ liệu không thể chụp/lưu/in ngoài ứng dụng. Test đếm lệnh in trình duyệt của app, không đếm bản in giấy. Flag client `initialSuccess` không phải bằng chứng server để vượt quyền đọc; giữ snapshot R1 và các quyền K của phase 27. Đây là ràng buộc kỹ thuật/giới hạn nền tảng, không mở thêm quyết định nghiệp vụ hoặc thêm hạ tầng máy in.

## Kiểm tra tài liệu sau khi ghi Q8/Q9

- `git diff --check` PASS; Git có cảnh báo chuẩn hóa LF/CRLF theo cấu hình, không có lỗi whitespace. Không sửa cấu hình hoặc chuẩn hóa hàng loạt.
- Kiểm 80 liên kết local trong ba báo cáo review: 0 đường dẫn hỏng; không có trailing whitespace.
- So hash 436 file có sẵn với manifest baseline: chỉ bốn trang docs đã được phép chỉnh khác baseline (`docs/README.md`, `docs/limitations.md`, `docs/roadmap.md`, `openspec/README.md`). Nội dung bộ bảy artifact và các thay đổi có sẵn khác vẫn giữ nguyên.
- Code chỉ có `pnpm-lock.yaml` untracked như baseline; hash không đổi: `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`. Không có tracked/staged diff, không chạy application test/build/DB hoặc gate Realtime thật.

Sau khi ghi Q11: `git diff --check` PASS; kiểm lại 85 liên kết local trong ba báo cáo, 0 đường dẫn hỏng và không có trailing whitespace. Code vẫn chỉ có lockfile untracked có sẵn; chưa sửa application code hoặc bộ bảy artifact.
