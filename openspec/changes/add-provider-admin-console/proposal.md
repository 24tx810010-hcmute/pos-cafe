# Màn quản trị hệ thống cho nhà cung cấp dịch vụ

## Why

Sau khi `add-owner-account-and-store-provisioning` đưa vào tài khoản chủ và trạng thái vòng đời cửa hàng, hệ thống có trạng thái tạm ngưng nhưng **không có ai vận hành được nó**. Nhà cung cấp muốn tạm ngưng một cửa hàng lạm dụng, hoặc dọn các cửa hàng bỏ hoang, thì phải thao tác trực tiếp trên database. Cách đó không kiểm soát được, không để lại dấu vết có cấu trúc, và không giao cho người không chuyên kỹ thuật làm được.

Với một sản phẩm vận hành thật, người cung cấp dịch vụ cần trả lời được ba câu tối thiểu: hệ thống đang có bao nhiêu cửa hàng, cửa hàng nào đang có vấn đề, và làm sao chặn một cửa hàng vi phạm. Không có màn nào trả lời được các câu này.

Change này **lật lại một quyết định đã chốt**. Baseline spec `store-isolation` quy định dữ liệu của mỗi cửa hàng chỉ truy cập được bởi chính cửa hàng đó, và `docs/requirements.md` phát biểu NFR-02 theo hướng cô lập tuyệt đối giữa các cửa hàng. Một tài khoản nhà cung cấp nhìn xuyên nhiều cửa hàng là ngoại lệ đầu tiên của nguyên tắc đó, nên phải được phát biểu lại chính xác thay vì lặng lẽ mở.

## What Changes

- Thêm **tầng danh tính thứ tư** là tài khoản nhà cung cấp dịch vụ, bên cạnh ba tầng đang có: chủ cửa hàng, thiết bị đã ghép, nhân viên đang vận hành.
- Thêm màn quản trị hệ thống, tách khỏi ứng dụng POS, gồm danh sách cửa hàng và các thao tác quản lý vòng đời.
- Cho phép nhà cung cấp tạm ngưng và mở lại một cửa hàng, và xóa cửa hàng.
- Cho phép nhà cung cấp **nới hạn mức số cửa hàng** cho từng tài khoản chủ. Hạn mức mặc định được chốt ở quyết định số 14 của `add-owner-account-and-store-provisioning`, và giao diện tạo cửa hàng hướng dẫn chủ liên hệ nhà cung cấp khi chạm trần, nên phải có nơi thực hiện việc nới đó.
- Giới hạn rõ **phạm vi nhìn thấy**: nhà cung cấp thấy dữ liệu định danh và vận hành của cửa hàng, không thấy dữ liệu kinh doanh.
- Ghi nhật ký mọi thao tác của nhà cung cấp, gồm người thực hiện, thời điểm, cửa hàng bị tác động và lý do.
- Phát biểu lại nguyên tắc cô lập dữ liệu cho đúng: cô lập giữa các cửa hàng vẫn tuyệt đối ở tầng người dùng cuối, và có đúng một ngoại lệ được kiểm soát ở tầng vận hành hệ thống.

## Capabilities

### New Capabilities

- `provider-admin`: danh tính nhà cung cấp dịch vụ, phạm vi dữ liệu nhà cung cấp được nhìn thấy, các thao tác quản lý vòng đời cửa hàng, việc nới hạn mức số cửa hàng theo từng tài khoản chủ, và nhật ký thao tác quản trị hệ thống.

### Modified Capabilities

- `store-isolation`: mở một ngoại lệ được kiểm soát cho tài khoản nhà cung cấp, vì spec hiện quy định dữ liệu cửa hàng chỉ truy cập được bởi chính cửa hàng đó. Đồng thời hoàn tất requirement khóa cửa hàng, vốn đã được `add-owner-account-and-store-provisioning` đưa xuống tầng database nhưng chưa có người vận hành.

## Impact

- Chính sách bảo mật mức dòng trên các bảng liên quan phải thêm nhánh nhà cung cấp. Đây là nhánh có quyền rộng nhất hệ thống nên rủi ro cao nhất nếu viết sai.
- Tài khoản nhà cung cấp là mục tiêu tấn công giá trị cao: chiếm được nó là chạm tới mọi cửa hàng. Cần cân nhắc yêu cầu bảo vệ cao hơn tài khoản thường.
- Thêm một mặt giao diện mới, tách khỏi luồng POS, kéo theo điều hướng và triển khai riêng.
- Thêm bảng danh sách tài khoản nhà cung cấp và bảng nhật ký thao tác quản trị hệ thống, kéo theo migration.
- Việc xóa cửa hàng là thao tác không hoàn tác được ở quy mô lớn nhất trong hệ thống, nên phải có rào chắn tương xứng.
- Cập nhật `docs/requirements.md` (NFR-02), `docs/architecture.md`, `docs/data-model.md`, `docs/screens.md`, `docs/limitations.md`, `pos-cafe-context.md`.

## Ngoài phạm vi

- Thanh toán, gói dịch vụ, hạn mức theo gói và tính phí thuê bao.
- Hỗ trợ khách hàng dạng phiếu yêu cầu, trò chuyện trực tiếp hoặc đăng nhập thay mặt chủ để gỡ lỗi.
- Thống kê kinh doanh tổng hợp toàn nền tảng, ví dụ tổng doanh thu mọi cửa hàng.
- Tự động phát hiện cửa hàng lạm dụng. Change này chỉ cung cấp thao tác thủ công.
- Quản lý nhiều cửa hàng cho một chủ. Việc đó thuộc `add-multi-store-ownership`.

## Phụ thuộc

- `add-owner-account-and-store-provisioning`: **bắt buộc làm trước.** Change đó tạo ra tài khoản chủ, trạng thái vòng đời cửa hàng và việc enforce trạng thái ở tầng database. Không có nền đó thì màn quản trị này không có gì để quản trị.
- `redesign-permission-model`: không phụ thuộc trực tiếp, nhưng nếu làm sau thì tái dùng được cách khai báo quyền dạng dữ liệu cho phần phân quyền nội bộ của nhà cung cấp, thay vì dựng cơ chế thứ hai.

## Câu hỏi phải chốt trước khi làm

1. Nhà cung cấp được nhìn thấy những gì? Đề xuất giới hạn ở dữ liệu định danh và vận hành, gồm tên cửa hàng, số cửa hàng, email chủ, ngày tạo, trạng thái, lần hoạt động gần nhất và số nhân viên. **Không** bao gồm đơn hàng, doanh thu, thực đơn và giá. Có đồng ý ranh giới này không, hay cần thêm gì?
2. Xóa cửa hàng là xóa mềm hay xóa cứng? Nếu xóa mềm thì giữ bao lâu trước khi dọn hẳn, và trong thời gian đó chủ có khôi phục được không?
3. Tài khoản nhà cung cấp được tạo bằng cách nào? Không thể tự đăng ký, nên cần một đường cấp thủ công lần đầu.
4. Tài khoản nhà cung cấp có cần bảo vệ mạnh hơn tài khoản chủ không, ví dụ xác thực hai lớp hoặc giới hạn theo địa chỉ mạng? Đây là tài khoản quyền cao nhất hệ thống.
5. Màn quản trị nằm cùng ứng dụng ở một đường dẫn riêng, hay là một bản triển khai tách hẳn? Tách hẳn thì an toàn hơn nhưng thêm hạ tầng.
6. Có cần nhiều tài khoản nhà cung cấp với quyền khác nhau không, ví dụ người chỉ xem và người thao tác được, hay một mức quyền duy nhất là đủ?
7. Tạm ngưng cửa hàng có bắt buộc nhập lý do không, và có gửi thông báo cho chủ qua email không? Không báo thì chủ chỉ thấy cửa hàng ngừng chạy mà không hiểu vì sao.
8. Nhật ký thao tác quản trị hệ thống giữ bao lâu, và ai được xem?
9. Chủ cửa hàng có được biết là hệ thống tồn tại một tài khoản nhìn thấy được cửa hàng của mình không? Đây là câu hỏi về minh bạch, và nó ảnh hưởng tới cách phát biểu lại NFR-02.
10. Có cần thao tác khôi phục ngược lại không, ví dụ mở lại cửa hàng đã tạm ngưng và hoàn tác việc xóa mềm?
11. Hạn mức số cửa hàng nới theo từng tài khoản chủ, hay theo nhóm hạn mức dựng sẵn? Nới theo từng tài khoản linh hoạt hơn nhưng khó theo dõi khi số tài khoản tăng.
12. Nhà cung cấp có được gán lại chủ sở hữu cho một cửa hàng không? Đây là **lối thoát duy nhất** khi chủ mất hẳn quyền truy cập email: `add-owner-account-and-store-provisioning` đã làm luồng đổi email chủ và chuyển quyền sở hữu, nhưng cả hai đều yêu cầu chủ đăng nhập được. Nếu có làm thì cần quy trình xác minh danh tính chủ ngoài phần mềm, vì thao tác này trao toàn bộ một cửa hàng cho một người khác.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
