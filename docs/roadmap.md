# Lộ Trình Phát Triển

Thứ tự thực hiện và tiến độ của dự án. Tài liệu này trả lời câu hỏi **làm gì trước, làm gì sau, và đang ở đâu**.

Nó không chép lại quan hệ phụ thuộc giữa các change — phần đó nằm ở mục "Thứ tự phụ thuộc" trong `openspec/README.md` và ở section `## Phụ thuộc` của từng proposal. Ở đây chỉ có trình tự thực hiện, mốc thời gian và trạng thái.

| | |
| --- | --- |
| Bắt đầu | 28/08/2026 |
| Hạn cuối | 21/12/2026 |
| Ngân sách | 16 tuần tròn, kết thúc 17/12, còn 4 ngày đệm |
| Yêu cầu đầu ra | Code chạy thật dùng được, không phải chỉ phân tích thiết kế |
| Cập nhật lần cuối | 28/08/2026 |

Dự án đi từ tiểu luận cuối kỳ lên đồ án tốt nghiệp. Hai việc bắt buộc đến từ nhận xét của giảng viên phản biện: kiểm soát việc tạo cửa hàng, và tổ chức lại phân quyền cho đúng một hệ POS vận hành thật.

## Quy Ước Trạng Thái

| Ký hiệu | Nghĩa |
| --- | --- |
| `[ ]` | Chưa bắt đầu |
| `[~]` | Đang làm |
| `[x]` | Đã xong, ghi ngày hoàn thành |

Cập nhật cột trạng thái ngay khi đóng một mục, và sửa dòng "Cập nhật lần cuối" ở trên.

## Giai Đoạn 1 — Đồ Án Tốt Nghiệp

Chín mục, làm tuần tự. Phần bảo mật đi trước phần tính năng, vì phần phản biện yêu cầu là bắt buộc còn phần tính năng thì co giãn được.

| # | Tuần | Khoảng | Việc | Kết quả kiểm chứng được | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 28/08 – 03/09 | Lưới an toàn kiểm thử và môi trường thử nghiệm | Bộ kiểm thử chạy xanh trên baseline hiện tại | `[ ]` |
| 2 | 2–4 | 04/09 – 24/09 | Tổ chức lại phân quyền | Sáu vai trò, mười bốn quyền, điều hướng suy ra từ quyền, đổi quyền có hiệu lực ngay | `[ ]` |
| 3 | 5–7 | 25/09 – 15/10 | Tài khoản chủ và kiểm soát tạo quán, giai đoạn 1 | Không có email đã xác thực thì không tạo được cửa hàng | `[ ]` |
| 4 | 8 | 16/10 – 22/10 | Khôi phục và vòng đời quyền sở hữu, giai đoạn 2 | Mất Store Key vẫn lấy lại được cửa hàng | `[ ]` |
| 5 | 9 | 23/10 – 29/10 | Siết quyền xuống tầng dữ liệu, bản thu hẹp | Gọi thẳng vào cơ sở dữ liệu khi thiếu quyền bị từ chối | `[ ]` |
| 6 | 10–11 | 30/10 – 12/11 | Chấm công vào ca và ra ca | Nhân viên vào ca và ra ca, dữ liệu công lên được báo cáo | `[ ]` |
| 7 | 12–13 | 13/11 – 26/11 | Quản lý ca làm việc và bảng công | Mở ca, chốt ca, kiểm két đầu và cuối ca | `[ ]` |
| 8 | 14 | 27/11 – 03/12 | Triển khai thật, làm cứng, sao lưu | Bản chạy thật có địa chỉ truy cập được và có sao lưu định kỳ | `[ ]` |
| 9 | 15–16 | 04/12 – 17/12 | Viết báo cáo, chụp lại ảnh màn hình, đồng bộ tài liệu | Bản thảo báo cáo đầy đủ | `[ ]` |

Bốn ngày từ 18/12 tới 21/12 để nguyên làm đệm và tập demo. Không xếp việc vào đó.

### Ánh xạ sang change

| Mục | Change tương ứng |
| --- | --- |
| 1 | Lát mỏng của `expand-e2e-coverage` và `setup-test-data-environment`, không làm trọn hai change đó |
| 2 | `redesign-permission-model` |
| 3, 4 | `add-owner-account-and-store-provisioning`, chia hai giai đoạn theo quyết định số 18 của proposal |
| 5 | `enforce-permissions-at-database`, bản thu hẹp |
| 6 | `add-employee-time-clock` |
| 7 | `add-shift-management` |

### Cổng chặn không được bỏ qua

Hai điểm dưới đây, nếu vượt qua mà chưa đạt điều kiện, sẽ dẫn tới tình huống chỉ khôi phục được bằng bản sao lưu.

**Cổng 1 — trong mục 2, trước khi đổi kiểu cột vai trò.** Kiểm thử đối chiếu phải chứng minh hàm kiểm tra quyền mới trả về đúng kết quả như bảng cũ cho ba vai trò cũ. Đây là task 2.3 trong danh sách việc của `redesign-permission-model`.

**Cổng 2 — trong mục 3, trước khi xóa dữ liệu cũ.** Phải có bản sao lưu đầy đủ cả cơ sở dữ liệu lẫn kho ảnh, và phải có xác nhận rõ ràng của chủ dự án. Quyết định số 9 của proposal là xóa sạch dữ liệu tạo bằng luồng cũ, không chuyển đổi.

### Việc chạy song song

Các việc dưới đây không chiếm tuần riêng, nhưng phải xong trước hạn ghi kèm, nếu không mục tương ứng sẽ bị chặn.

| Việc | Hạn | Trạng thái |
| --- | --- | --- |
| Mua tên miền, cấu hình nhà cung cấp gửi email, gửi thử và xác nhận không rơi vào thư rác | trước tuần 5 | `[ ]` |
| Viết ba artifact còn thiếu cho `add-owner-account-and-store-provisioning`: đặc tả delta, thiết kế, danh sách việc. Quyết định đã chốt hết nên đây là việc viết, không phải việc quyết | trước tuần 5 | `[ ]` |
| Chốt bảy câu hỏi còn lại của `enforce-permissions-at-database` | trước tuần 9 | `[ ]` |
| Chốt chín câu hỏi của `add-employee-time-clock` | trước tuần 10 | `[ ]` |
| Chốt chín câu hỏi của `add-shift-management` | trước tuần 12 | `[ ]` |

Việc tên miền và email được xếp sớm vì phần lớn là thời gian chờ chứ không phải thời gian làm. Rủi ro cụ thể nếu để trễ: mã một lần rơi vào thư rác thì không đăng nhập được, và mô hình không mật khẩu không có đường vào thay thế.

### Lý do chọn nhóm ca làm việc

Ngân sách 16 tuần chỉ đủ cho đúng một nhóm tính năng mới. Đã cân nhắc bốn ứng viên là ca làm việc, cơ chế giảm giá, khách hàng thân thiết và tồn kho.

Chọn nhóm ca làm việc vì hai lý do:

- Nó chứng minh trực tiếp luận điểm trung tâm của đồ án. Mô hình quyền mới được thiết kế để thêm quyền là thêm dữ liệu chứ không sửa kiểu cứng; thêm trọn một nhóm tính năng cùng nhóm quyền của nó mà không đụng vào cấu trúc quyền là bằng chứng cho điều đó.
- Nó không đụng vào phần tính tiền. Cơ chế giảm giá và đổi điểm đều sửa cách tính tổng đơn, mà chỗ đó đang có tách đơn, đánh số bill và hủy đơn chạy đúng và đã có kiểm thử.

Nhóm kiểm két đầu và cuối ca cũng nối vào mạch kiểm soát nội bộ mà cả đồ án đang xoay quanh.

## Giai Đoạn 2 — Sau Khi Bảo Vệ

Hai mươi hai change còn lại, xếp theo tầng. Không gắn ngày. Trong mỗi tầng, dấu mũi tên là quan hệ bắt buộc trước sau.

**Tầng A — Vận hành và chất lượng.** Làm trước nếu sản phẩm đi vào dùng thật, vì nó quyết định khả năng bảo trì.

- `define-test-strategy` → phần còn lại của `expand-e2e-coverage` và `setup-test-data-environment` → `add-ci-pipeline` → `add-cd-deployment`
- `add-provider-admin-console`: màn quản trị cho nhà cung cấp, gồm xem, tạm ngưng và xóa cửa hàng, và nới hạn mức số cửa hàng. Phụ thuộc phần tài khoản chủ đã làm ở giai đoạn 1
- `add-idempotent-write-operations`: khóa chống trùng cho các lời gọi ghi. Độc lập với ngoại tuyến và đáng làm dù không bao giờ làm ngoại tuyến, vì hiện một yêu cầu bị timeout phía client nhưng đã chạy xong phía database có thể sinh bản ghi thứ hai. **Ứng viên kéo về giai đoạn 1** nếu quyết định về phạm vi ngoại tuyến đi theo hướng làm nền trước

**Tầng B — Bán hàng nâng cao.** Nhóm dễ thấy nhất với người dùng cuối.

- `add-discount-engine` → `add-promo-codes-and-vouchers`, `add-happy-hour-pricing`, `add-promotion-management-screen`

**Tầng C — Khách hàng.**

- `add-customer-registry` → `add-loyalty-points` → `add-loyalty-management-screen`

**Tầng D — Tồn kho.**

- `add-inventory-core` → `add-recipe-based-stock-deduction`, `add-inventory-management-screen`

**Tầng E — Nhiều cửa hàng.** Nền dữ liệu đã được dựng sẵn ở giai đoạn 1 nên tầng này thu hẹp lại còn phần giao diện và quan hệ nhân viên với nhiều nơi.

- `add-multi-store-ownership` → `add-cross-store-reporting`

**Tầng F — Ngoại tuyến.** Lật lại quyết định online-only đang ghi trong `requirements.md`, nên nếu làm thì phải cập nhật lại tài liệu.

Ngày 2026-08-28, ba đề xuất của tầng này đã được viết chi tiết lại dựa trên rà soát mã nguồn: năm ràng buộc từ hiện trạng, mô hình hàng đợi ý định một chiều, bảng thao tác nào được phép ngoại tuyến, hai mươi tình huống phải xử lý, và chiến lược kiểm thử. **Phạm vi trong 16 tuần chưa chốt**: ước lượng trung thực cho phần bán hàng ngoại tuyến là năm tới bảy tuần, nhiều hơn bốn tuần của nhóm ca làm việc đang giữ chỗ ở giai đoạn 1.

- `add-offline-data-layer` → `add-offline-status-ux`, `add-offline-sync-conflict-resolution`

## Nguyên Tắc Xếp Thứ Tự

Bốn nguyên tắc đã dùng để dựng trình tự trên, ghi lại để lần sau xếp tiếp không phải suy luận lại.

1. **Phần bắt buộc đi trước phần co giãn được.** Hai vấn đề phản biện là bắt buộc; nhóm tính năng là phần cắt được nếu hụt thời gian.
2. **Cái gì viết lại chính sách bảo mật thì gom lại làm một lượt.** Ba mục 3, 4 và 5 đều đụng chính sách bảo mật mức dòng; làm rời rạc sẽ phải viết lại nhiều lần.
3. **Nền tảng đi trước thứ dựng trên nó.** Mô hình quyền phải xong trước, vì mọi nhóm tính năng phía sau đều sinh quyền mới.
4. **Việc có thời gian chờ thì khởi động sớm nhất có thể.** Tên miền và xác minh người gửi email là thời gian chờ, không phải thời gian làm.

## Ghi Chú Khi Chuyển Sang Báo Cáo

Tài liệu này dùng tên định danh của các change để tra cứu nội bộ. Khi đưa nội dung sang báo cáo, mô tả theo tên chức năng nghiệp vụ chứ không dùng tên định danh, theo đúng quy tắc trong [report-source-map.md](report-source-map.md).

Giai đoạn 1 phục vụ chương kế hoạch và phương pháp thực hiện. Giai đoạn 2 phục vụ chương hướng phát triển; mỗi mục ở đó đã có một proposal viết sẵn kèm phân tích phạm vi, ảnh hưởng và các câu hỏi phải chốt, nên dẫn được ở mức thiết kế chứ không phải liệt kê suông.
