# Ma trận truy vết

## Cách đọc bảng này ở một change đặt `skip_specs`

Chuẩn ở `openspec/SPEC-STANDARD.md` mục 6 quy định cột trái là **requirement** trong `specs/`. Change này đặt `skip_specs: true` vì nó không đổi hành vi quan sát được của hệ thống, nên không có requirement nào để trỏ tới.

Thay vào đó cột trái dùng **quyết định đã chốt** trong `proposal.md`. Đây là nguồn ràng buộc tương đương: chúng là thứ mọi change sau phải tuân theo, và chúng là thứ báo cáo sẽ trích.

Change tính năng thì dùng đúng cột requirement như chuẩn quy định.

## Bảng truy vết

| # | Quyết định | Use case | Test case |
| --- | --- | --- | --- |
| 1 | Chiến lược phục vụ cả bảo vệ code lẫn làm bằng chứng báo cáo | — (quy tắc viết, áp cho mọi use case) | TC-TEST-13 |
| 2 | Ngưỡng 90% dòng trên `core` và phần không phải hook của `features` | UC-TEST-01 | TC-TEST-01, 02, 06, 07, 08, 10, 11 |
| 3 | Cổng chất lượng gồm bốn kiểm chạy được cục bộ | UC-TEST-01, UC-TEST-05 | TC-TEST-04 |
| 4 | Cloud E2E bắt buộc theo mốc, không theo mỗi lần merge | UC-TEST-02, UC-TEST-05 | TC-TEST-04 (khẳng định nó **không** nằm trong cổng), TC-TEST-12 |
| 5 | Thêm dependency phát triển khi cần, mặc định `@vitest/coverage-v8` | UC-TEST-01 | TC-TEST-01 |
| 6 | Thủ công giữ tối thiểu, ghi thành checklist có ngày | UC-TEST-06 | TC-TEST-05 |
| 7 | Tách `docs/test-strategy.md` khỏi `docs/testing.md` | UC-TEST-05 | TC-TEST-05 |
| 8 | Ba tình huống biên bắt buộc trên cloud E2E | UC-TEST-02, UC-TEST-03 | TC-TEST-12 |
| 9 | Script hóa kịch bản demo, làm ngay | UC-TEST-04 | TC-TEST-03, TC-TEST-09 |

## Chiều ngược lại: use case nào được test nào phủ

| Use case | Test case |
| --- | --- |
| UC-TEST-01 — Thêm hoặc sửa hàm thuần | TC-TEST-01, 02, 04, 06, 07, 08, 10, 11 |
| UC-TEST-02 — Sửa migration hoặc RPC | TC-TEST-12 |
| UC-TEST-03 — Đổi quyền hoặc chính sách bảo mật | TC-TEST-12 |
| UC-TEST-04 — Đổi hành trình chính | TC-TEST-03, 09 |
| UC-TEST-05 — Đóng một mục roadmap | TC-TEST-04, 05 |
| UC-TEST-06 — Chạy phần thủ công còn lại | TC-TEST-05 |

## Ba dòng tổng kết bắt buộc

| Chỉ số | Số | Đạt |
| --- | --- | --- |
| Quyết định chưa có use case nào | **1** | Xem giải trình bên dưới |
| Quyết định chưa có test case nào | **0** | Đạt |
| Use case chưa có test case nào | **0** | Đạt |

**Giải trình dòng thứ nhất.** Quyết định 1 không gắn với một use case cụ thể vì nó là **quy tắc viết áp lên toàn bộ tài liệu**, không phải một thao tác mà tác nhân nào đó thực hiện. Nó vẫn được kiểm chứng bằng TC-TEST-13, nên nó **không** phải một quyết định bị bỏ sót.

Đây là một tình huống mà chuẩn ở `SPEC-STANDARD.md` chưa lường tới: chuẩn giả định mọi requirement đều mô tả hành vi, nên đều dẫn ra được use case. Với change quy trình thì có loại ràng buộc chỉ kiểm được bằng rà soát chứ không diễn thành thao tác.

**Đề xuất sửa chuẩn:** cho phép một quyết định hoặc requirement không có use case **với điều kiện** nó vẫn có ít nhất một test case và có giải trình viết ra. Điều kiện "không có test case nào" thì tuyệt đối không được nới. Cần chủ dự án xác nhận trước khi sửa `SPEC-STANDARD.md`.

## Khoảng trống đã biết, bàn giao cho change sau

Ba tình huống này là **yêu cầu** của change hiện tại nhưng **việc viết** thuộc `expand-e2e-coverage`, theo đúng mục "Ngoài phạm vi" của `proposal.md`:

| Tình huống | Ai viết | Trạng thái hôm nay |
| --- | --- | --- |
| Cô lập chéo cửa hàng ở tầng database | `expand-e2e-coverage` | **Chưa có test nào.** Đây là khoảng trống nghiêm trọng nhất vì nó là luận điểm NFR-02 |
| Xung đột khóa lạc quan trả `ORDER_VERSION_CONFLICT` | `expand-e2e-coverage` | Chưa có ở tầng cloud |
| Không trùng số bill khi thanh toán đồng thời | `expand-e2e-coverage` | Chưa có |

Bảng này được nhắc lại trong `docs/test-strategy.md` để nó không bị chôn trong thư mục change.
