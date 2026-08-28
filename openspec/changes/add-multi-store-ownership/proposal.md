# Mở rộng cho một chủ sở hữu nhiều cửa hàng

## Why

Kiến trúc hiện tại đã cô lập dữ liệu theo cửa hàng bằng chính sách bảo mật mức dòng, nên về mặt dữ liệu thì nhiều cửa hàng đã chạy song song được. Nhưng đó là cô lập giữa các tài khoản độc lập, không phải tính năng quản lý chuỗi. Một người sở hữu hai quán hiện phải giữ hai Store Key riêng, đăng nhập riêng, và không có cách nào nhìn cả hai cùng lúc.

Đây là thay đổi lật lại một quyết định đã chốt. `pos-cafe-context.md` ghi rõ đây không phải bài toán quản lý chuỗi đa chi nhánh, và mục ngoài phạm vi của `docs/requirements.md` liệt kê quản lý chuỗi nhiều chi nhánh là chưa làm. Baseline spec `store-isolation` cũng ghi rõ hệ thống không cung cấp màn hình tổng hợp chung. Nếu làm change này thì các tuyên bố đó phải được cập nhật.

## What Changes

- Thêm khái niệm chủ sở hữu đứng trên cửa hàng, để một chủ gắn được nhiều cửa hàng.
- Thêm luồng chuyển đổi giữa các cửa hàng của cùng một chủ mà không phải ghép lại thiết bị.
- Xử lý quan hệ nhân viên và cửa hàng: một người có thể làm ở nhiều cửa hàng với quyền khác nhau ở từng nơi.
- Xác định dữ liệu nào dùng chung cả chuỗi và dữ liệu nào riêng từng cửa hàng, ví dụ thực đơn và giá.
- Cập nhật mô hình cô lập dữ liệu để chủ sở hữu truy cập được nhiều cửa hàng mà nhân viên thì không.

## Capabilities

### New Capabilities

- `store-group`: khái niệm nhóm cửa hàng thuộc cùng một chủ sở hữu, quan hệ giữa chủ, cửa hàng và nhân viên, và luồng chuyển đổi cửa hàng đang làm việc.

### Modified Capabilities

- `store-isolation`: đổi hẳn phạm vi mô hình cô lập, vì hiện tại spec ghi rõ đây không phải tính năng quản lý chuỗi.
- `store-onboarding`: đổi luồng tạo cửa hàng và ghép thiết bị khi đã có khái niệm chủ sở hữu.
- `employee-session`: đổi luồng đăng nhập nếu một người làm ở nhiều cửa hàng.
- `access-control`: quyền phải xác định theo từng cửa hàng chứ không còn là thuộc tính toàn cục của nhân viên.
- `employee-management`: đổi cách quản lý nhân viên khi một người thuộc nhiều cửa hàng.

## Impact

- Đây là thay đổi kiến trúc lớn nhất trong toàn bộ danh sách mở rộng. Nó chạm vào xác thực, phân quyền, cô lập dữ liệu và mô hình dữ liệu gốc.
- Chính sách bảo mật mức dòng trên toàn bộ bảng nghiệp vụ phải viết lại.
- Có khả năng là thay đổi phá vỡ tương thích với dữ liệu và thiết bị hiện có.
- Cập nhật `pos-cafe-context.md`, `docs/requirements.md` (NFR-02 và mục ngoài phạm vi), `docs/architecture.md`, `docs/data-model.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Báo cáo tổng hợp nhiều cửa hàng. Việc đó thuộc `add-cross-store-reporting`.
- Chuyển hàng hóa giữa các cửa hàng.
- Kho tập trung cho cả chuỗi.
- Quản lý nhượng quyền và phân cấp vùng miền.

## Phụ thuộc

- `add-owner-account-and-store-provisioning`: **bắt buộc làm trước.** Change đó đã đưa vào khái niệm chủ sở hữu, trường định danh chủ trên bản ghi cửa hàng và nhánh chính sách bảo mật cho chủ. Nhờ vậy change này thu hẹp lại còn phần giao diện chuyển đổi cửa hàng và phần quan hệ nhân viên với nhiều cửa hàng, thay vì phải tự dựng lại tầng danh tính từ đầu. Câu hỏi số 5 ở dưới, về cách chủ sở hữu đăng nhập, đã được change đó trả lời.
- `redesign-permission-model`: gần như bắt buộc làm trước, vì quyền theo từng cửa hàng không thể gắn vào mô hình quyền toàn cục hiện tại.
- `enforce-permissions-at-database`: liên quan chặt, vì cả hai đều viết lại chính sách bảo mật mức dòng. Làm tách rời sẽ phải viết lại hai lần.

## Câu hỏi phải chốt trước khi làm

1. Đây là tính năng thật sự cần làm, hay chỉ cần trình bày trong báo cáo như hướng mở rộng có phân tích thiết kế? Với phạm vi một đồ án, hướng thứ hai có thể hợp lý hơn nhiều.
2. Nếu làm thật thì bài toán cụ thể là gì: một chủ có nhiều quán độc lập hoàn toàn, hay một chuỗi có thực đơn và giá thống nhất?
3. Thực đơn dùng chung hay riêng từng cửa hàng? Nếu dùng chung thì mô hình dữ liệu thực đơn phải tách khỏi cửa hàng, đây là thay đổi lớn.
4. Nhân viên thuộc về cửa hàng hay thuộc về chủ sở hữu? Nếu thuộc chủ sở hữu thì một người làm được nhiều nơi, nhưng quyền phải gắn theo từng cửa hàng.
5. Chủ sở hữu đăng nhập bằng cách nào? Mô hình Store Key kèm PIN hiện tại thiết kế cho thiết bị đặt cố định tại quán, không hợp với chủ quán mở trên điện thoại để xem nhiều quán.
6. Thiết bị tại quán có được phép chuyển sang cửa hàng khác không, hay chỉ tài khoản chủ mới chuyển được?
7. Số bill và số đơn đánh riêng theo từng cửa hàng hay chung cả chuỗi?
8. Dữ liệu hiện có của các cửa hàng đang chạy chuyển đổi thế nào sang mô hình mới?
9. Nếu quyết định không làm thật, thì cần viết tới mức nào để đủ dùng cho báo cáo: chỉ phân tích thiết kế, hay có cả sơ đồ dữ liệu đề xuất?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
