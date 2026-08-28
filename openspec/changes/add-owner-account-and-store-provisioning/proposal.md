# Tài khoản chủ cửa hàng và kiểm soát việc tạo cửa hàng

## Why

Hiện tại bất kỳ ai mở ứng dụng cũng tạo được cửa hàng mới: chỉ cần nhập tên hiển thị và Admin PIN rồi bấm xác nhận. Không có bước xác minh danh tính nào ở trước.

Nguyên nhân nằm ở mô hình xác thực. Mỗi cửa hàng là một tài khoản Supabase Auth với email tổng hợp dạng `store{N}@store.pos.local`, mật khẩu chính là phần bí mật trong Store Key, và dự án bắt buộc phải tắt xác nhận email thì luồng tạo cửa hàng mới chạy được. Vì email là email giả nên không có gì để xác minh, và cũng không có kênh nào liên hệ được chủ cửa hàng.

Ba khoảng trống cùng một gốc:

1. **Không có danh tính thật của chủ cửa hàng.** Không kiểm soát được ai đang dùng hệ thống, không giới hạn được số cửa hàng, không chống được việc tạo hàng loạt.
2. **Tạo cửa hàng không nguyên tử.** Luồng hiện tại là một lời gọi đăng ký tài khoản cộng ba lần ghi bảng rời nhau ở phía client. Hỏng giữa chừng sẽ để lại tài khoản xác thực mồ côi không gắn với cửa hàng nào, và người dùng không có cách tự khắc phục.
3. **Mất Store Key là mất cửa hàng.** Phần bí mật đóng vai trò mật khẩu và không được lưu ở bảng nghiệp vụ nào, nên không có đường khôi phục. Với một quán thật thì đây là rủi ro mất toàn bộ dữ liệu kinh doanh.

Baseline spec `store-onboarding` đang mô tả đúng hành vi hiện tại, nên spec đó cũng phải đổi theo. Change này sửa `docs/requirements.md` ở FR-01 và FR-02, và mở rộng phạm vi bảo đảm của NFR-02.

Change này không lật một quyết định đã chốt: mô hình Store Key ghép thiết bị vẫn giữ nguyên. Nó bổ sung một tầng danh tính nằm trên, không thay thế tầng hiện có.

## What Changes

- Thêm khái niệm **tài khoản chủ cửa hàng** dùng email thật, bắt buộc xác thực email trước khi được phép tạo cửa hàng.
- **Tách hai loại danh tính.** Service account của cửa hàng giữ nguyên vai trò cho Store Key và cho thiết bị POS tại quán. Tài khoản chủ là một danh tính riêng, dùng trên web hoặc điện thoại để tạo và quản trị cửa hàng. Thiết bị thu ngân không cầm credential của chủ.
- Gắn cửa hàng với chủ qua trường định danh chủ sở hữu trên bản ghi cửa hàng. Chính sách bảo mật mức dòng **bổ sung** nhánh cho chủ, giữ nguyên nhánh hiện có cho thiết bị, nên thiết bị đã ghép không bị ảnh hưởng và không cần chuyển đổi dữ liệu định danh cửa hàng.
- Chuyển việc tạo cửa hàng sang một lời gọi phía server chạy trọn vẹn trong một lần, thay cho chuỗi thao tác rời phía client. Lời gọi này kiểm tra chủ đã xác thực email, kiểm tra hạn mức, tạo service account, ghi bản ghi cửa hàng, cấu hình cửa hàng và tài khoản admin, rồi trả Store Key về đúng một lần.
- Giới hạn số cửa hàng trên mỗi tài khoản chủ và giới hạn tần suất tạo cửa hàng, enforce ở phía server.
- Thêm trạng thái vòng đời cho cửa hàng. Không có trạng thái chờ xác thực, vì cửa hàng chỉ được tạo bởi một phiên chủ đã xác thực xong; xem quyết định số 10.
- **Lưu phần bí mật của Store Key ở dạng mã hóa**, với khóa giải mã giữ trong môi trường của hàm chạy phía server chứ không nằm trong database. Nhờ vậy Store Key khôi phục lại được thay vì chỉ cấp mới.
- Thêm **hai chức năng khôi phục tách biệt**, phục vụ hai nhu cầu khác nhau:
  - **Quên Store Key**: chủ không nhớ key, không nghi ngờ bị lộ. Hệ thống giải mã và gửi lại **đúng key hiện tại** về email đã xác thực, kèm tên và địa chỉ cửa hàng. Store Key không đổi, các thiết bị đã ghép không bị ảnh hưởng.
  - **Cấp lại Store Key**: chủ nghi key đã lộ, ví dụ nhân viên nghỉ việc, mất thiết bị, key bị chụp ảnh. Hệ thống sinh phần bí mật mới, đổi mật khẩu service account rồi gửi Store Key mới. Key cũ hết hiệu lực ngay và mọi thiết bị đã ghép phải ghép lại. Đây là thao tác có chủ ý, kèm cảnh báo rõ hậu quả.
- Thêm luồng đăng nhập và đăng xuất cho tài khoản chủ, dùng mã một lần gửi qua email và **không có mật khẩu**. Đăng ký lần đầu và đăng nhập các lần sau là cùng một luồng: nhập email, nhận mã, nhập mã.
- Thêm luồng **đổi email của tài khoản chủ** và luồng **chuyển quyền sở hữu cửa hàng** cho một chủ khác. Xem quyết định số 17.
- Thêm luồng **đặt lại PIN của nhân viên vai trò chủ quán** từ tài khoản chủ, qua email đã xác thực. Đây là đường duy nhất đặt lại PIN đó, vì quyền quản lý nhân viên của vai trò quản lý không tác động lên bản ghi chủ quán. Xem quyết định số 5 và mục câu 11 trong `redesign-permission-model`.
- Ghi nhật ký các thao tác quản trị cửa hàng: tạo cửa hàng, cấp lại Store Key, đổi trạng thái cửa hàng.

## Capabilities

### New Capabilities

- `owner-account`: đăng ký và đăng nhập tài khoản chủ bằng email thật với mã một lần và không có mật khẩu; quan hệ giữa chủ và các cửa hàng cùng hạn mức số cửa hàng; luồng quên Store Key và luồng cấp lại Store Key; luồng đặt lại PIN của vai trò chủ quán; luồng đổi email chủ và luồng chuyển quyền sở hữu cửa hàng; nhật ký thao tác quản trị cửa hàng.

### Modified Capabilities

- `store-onboarding`: việc tạo cửa hàng yêu cầu một phiên chủ đã xác thực email, thực hiện trong một lời gọi phía server thay vì chuỗi thao tác phía client, và Store Key trở thành thứ khôi phục lại được cũng như cấp lại được, thay vì cấp một lần duy nhất. Đồng thời sửa requirement về bảo mật Store Key: spec hiện quy định không lưu Store Key hoặc phần bí mật ở dạng thô sau khi hoàn tất, với ý định là không khôi phục được. Hướng mới lưu ở dạng mã hóa và khôi phục được, nên phải phát biểu lại requirement kèm lý do thay vì lách bằng câu chữ "dạng thô".
- `store-isolation`: chính sách bảo mật mức dòng có thêm nhánh cho phép chủ truy cập cửa hàng của mình, bên cạnh nhánh hiện có cho thiết bị đã ghép. Đồng thời sửa requirement khóa cửa hàng: trạng thái tạm ngưng được enforce ở tầng database chứ không dừng ở tầng ứng dụng, trong khi spec hiện ghi rõ hệ thống không được tuyên bố có enforce ở tầng đó. Xem quyết định số 11.
- `employee-session`: không đổi bước chọn nhân viên và nhập PIN, nhưng phải ghi rõ ranh giới giữa ba tầng danh tính là chủ cửa hàng, thiết bị đã ghép và nhân viên đang vận hành.

## Impact

- Thêm một thành phần hàm chạy phía server vào kiến trúc triển khai. Kho mã hiện chưa có thành phần loại này, nên phát sinh bước triển khai và biến môi trường mới.
- Khóa quyền quản trị của nền tảng backend chỉ tồn tại phía server, không bao giờ xuống trình duyệt.
- Thêm một khóa mã hóa dùng cho phần bí mật của Store Key, giữ trong biến môi trường của hàm chạy phía server. Cần quy trình xoay khóa và phương án khi mất khóa, vì mất khóa nghĩa là không khôi phục được Store Key của mọi cửa hàng, chỉ còn đường cấp lại.
- Bảng cửa hàng thêm trường lưu phần bí mật đã mã hóa.
- Cần một nhà cung cấp gửi email riêng, gửi từ tên miền riêng đã xác minh, phục vụ toàn bộ các luồng dùng email. Xem quyết định số 15.
- Bảng cửa hàng thêm trường định danh chủ sở hữu và trường trạng thái; thêm bảng nhật ký thao tác quản trị. Kéo theo migration.
- Chính sách bảo mật mức dòng trên bảng cửa hàng và các bảng liên quan phải bổ sung nhánh chủ sở hữu.
- Màn tạo cửa hàng và màn ghép thiết bị hiện tại phải thiết kế lại. Thêm mặt web tối thiểu cho tài khoản chủ gồm nhập email và mã, danh sách cửa hàng, quên Store Key, cấp lại Store Key, đặt lại PIN chủ quán, đổi email chủ và chuyển quyền sở hữu.
- Luồng tạo cửa hàng hiện tại chắc chắn vỡ và phải viết lại, không phải sửa nhỏ: nó đang dựa vào việc đăng ký tài khoản trả phiên ngay lập tức, trong khi mô hình mới đòi một phiên chủ đã xác thực có trước rồi mới tạo cửa hàng.
- Cập nhật `docs/requirements.md` (FR-01, FR-02, NFR-02), `docs/features.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/screens.md`, `docs/limitations.md`, `pos-cafe-context.md`.

## Ngoài phạm vi

- Quản lý nhiều cửa hàng cho một chủ, gồm màn chuyển đổi cửa hàng đang làm việc và báo cáo tổng hợp. Việc đó thuộc `add-multi-store-ownership` và `add-cross-store-reporting`. Change này chỉ dựng nền dữ liệu để các việc đó không phải viết lại chính sách bảo mật lần hai.
- Thiết kế lại mô hình quyền của nhân viên trong cửa hàng. Việc đó thuộc `redesign-permission-model`.
- Siết ranh giới bảo mật per-employee xuống tầng database. Việc đó thuộc `enforce-permissions-at-database`.
- Luồng nhận cửa hàng cho dữ liệu tạo bằng luồng cũ, và mọi nhánh xử lý cửa hàng không có chủ sở hữu. Xem quyết định số 9: dữ liệu cũ bị xóa thay vì chuyển đổi.
- Xác thực bằng số điện thoại, đăng nhập qua nhà cung cấp bên thứ ba và xác thực hai lớp.
- Thanh toán, gói dịch vụ và tính phí thuê bao.
- Màn quản trị hệ thống dành cho nhà cung cấp dịch vụ. Việc đó tách thành `add-provider-admin-console`; xem quyết định số 12. Change này chỉ chuẩn bị nền là trường trạng thái, việc enforce trạng thái ở tầng database và bảng nhật ký.

## Phụ thuộc

- Không phụ thuộc change nào để bắt đầu.
- `add-multi-store-ownership` nên làm **sau** change này. Change này đã đưa vào khái niệm chủ sở hữu và nhánh chính sách bảo mật tương ứng, nên nếu làm ngược thứ tự thì phần đó sẽ phải viết hai lần.
- `expand-e2e-coverage` nên có trước, vì thay đổi luồng vào ứng dụng chạm vào mọi kịch bản kiểm thử.

## Câu hỏi phải chốt trước khi làm

1. ~~Thiết bị tại quán có bắt buộc phải được chủ kích hoạt không?~~ **Đã trả lời ở quyết định số 13: giữ nguyên, không kích hoạt, không giới hạn số thiết bị.**
2. ~~Mỗi tài khoản chủ được tạo tối đa bao nhiêu cửa hàng?~~ **Đã trả lời ở quyết định số 14: trần 5 kèm giới hạn tần suất, nới được từ màn nhà cung cấp.**
3. ~~Các cửa hàng đã tồn tại chưa có chủ sở hữu xử lý thế nào?~~ **Đã trả lời ở quyết định số 9: xóa sạch, không chuyển đổi.** Câu hỏi gốc: Ba hướng: cho nhận cửa hàng bằng Store Key cộng email rồi xác thực, gán thủ công, hoặc coi là dữ liệu demo cũ và không xử lý.
4. ~~Chức năng cấp lại Store Key cần rào chắn tới mức nào?~~ **Đã trả lời ở quyết định số 16: ba lớp gồm cảnh báo, gõ lại tên cửa hàng, và mã một lần mới.**
5. ~~Dùng dịch vụ gửi email mặc định hay cấu hình nhà cung cấp riêng?~~ **Đã trả lời ở quyết định số 15: nhà cung cấp riêng, tên miền riêng đã xác minh.**
6. ~~Có cần màn quản trị hệ thống cho nhà cung cấp dịch vụ không?~~ **Đã trả lời ở quyết định số 12: có làm, nhưng tách thành change riêng `add-provider-admin-console`.**
7. ~~Trạng thái tạm ngưng của cửa hàng enforce ở tầng nào?~~ **Đã trả lời ở quyết định số 11: enforce ở tầng database, kèm ngoại lệ cho chủ đọc trạng thái.**
8. ~~Có cần luồng đổi email chủ và luồng chuyển quyền sở hữu không?~~ **Đã trả lời ở quyết định số 17: làm cả hai trong change này.**
9. ~~Xác thực email dùng đường dẫn xác nhận hay mã dùng một lần?~~ **Đã trả lời ở quyết định số 10: mã một lần, không mật khẩu.** Câu hỏi gốc: Mã dùng một lần hợp với thiết bị tại quán hơn nhưng cần thêm màn nhập mã.
10. ~~Nếu chủ không hoàn tất xác thực email thì cửa hàng ở trạng thái chờ được giữ bao lâu trước khi dọn?~~ **Không còn áp dụng sau quyết định số 10:** cửa hàng chỉ được tạo bởi phiên chủ đã xác thực xong, nên không tồn tại cửa hàng ở trạng thái chờ xác thực.
11. ~~Store Key được gửi tới chủ bằng cách nào, và đặt nút quên Store Key ở đâu?~~ **Đã trả lời ở quyết định số 8: gửi thẳng trong email, một luồng dùng chung ở hai lối vào.** Câu hỏi gốc: Hai điểm cần chốt: gửi thẳng Store Key trong nội dung email, hay gửi một đường dẫn mà chủ phải bấm mới xem được key trên trang web, để credential không nằm vĩnh viễn trong hộp thư và trong các thư chuyển tiếp. Và nút quên Store Key đặt công khai ngay màn ghép thiết bị chỉ cần nhập email, hay bắt đăng nhập tài khoản chủ trước. Nếu để công khai thì phản hồi phải chung chung, không tiết lộ email có tồn tại trong hệ thống hay không, và phải giới hạn tần suất gửi.
12. Tài khoản chủ có màn quản trị riêng trên web không, hay chủ muốn quản trị cửa hàng thì vẫn phải ghép thiết bị và đăng nhập bằng PIN như mọi nhân viên khác? **Đã trả lời ở quyết định số 7: giữ mặt web ở mức tối thiểu.**

## Quyết định đã chốt

Ghi ngày 2026-08-28, theo trao đổi với người dùng.

1. **Cơ chế kiểm soát việc tạo cửa hàng: xác thực email của chủ.** Không dùng mã kích hoạt do nhà cung cấp phát, không dùng duyệt thủ công, không dùng mã dùng một lần qua số điện thoại.
2. **Kiến trúc danh tính: tách hai tài khoản.** Service account của cửa hàng giữ nguyên cho việc ghép thiết bị bằng Store Key; tài khoản chủ dùng email thật đã xác thực. Bản ghi cửa hàng giữ nguyên định danh hiện tại và chỉ thêm trường trỏ tới chủ, nên không phải chuyển đổi dữ liệu của cửa hàng đang chạy.
3. **Provisioning chạy phía server bằng hàm chạy ở biên**, không làm phía client. Lý do quyết định là các luồng khôi phục ở mục 4 và mục 6: giải mã phần bí mật của Store Key và đổi mật khẩu của một tài khoản khác đều bắt buộc dùng khóa mà trình duyệt không được phép giữ. Hai phương án phía client vì vậy không đáp ứng được. Lợi ích kèm theo là việc tạo cửa hàng trở thành một lời gọi duy nhất nên nguyên tử, và hạn mức cùng giới hạn tần suất enforce được ở nơi client không lách được.
4. **Email chủ là kênh khôi phục truy cập nâng cao**, trước mắt là các trường hợp quên hoặc mất Store Key, và quên PIN của vai trò chủ quán. Mọi việc khôi phục đi qua đúng kênh này, không mở kênh thứ hai.

5. **Vai trò chủ quán gắn cứng với tài khoản chủ.** Mỗi cửa hàng có đúng một nhân viên vai trò chủ quán, và bản ghi đó phải thuộc về chủ sở hữu tài khoản đã xác thực email. Không cho phép ủy quyền vai trò này cho người khác. Quyết định và lý do đầy đủ ghi ở mục câu 11 trong `redesign-permission-model`; change này chịu trách nhiệm phần ràng buộc gắn kết giữa hai tầng.

   Hệ quả trực tiếp: **câu hỏi số 8 ở trên mất quyền chọn ở vế chuyển quyền sở hữu.** Vì chỉ chủ sở hữu mới giữ được vai trò chủ quán, cửa hàng sẽ kẹt cứng khi chủ nghỉ, bán quán hoặc mất quyền truy cập email. Luồng chuyển quyền sở hữu vì vậy là bắt buộc, không còn là tùy chọn cắt được. Vế đổi email chủ vẫn để mở.

   Mỗi cửa hàng có một chủ sở hữu ở tầng phần mềm. Đây là quyết định thiết kế chứ không phải hạn chế: phần mềm quản lý vận hành cửa hàng, không ghi nhận quan hệ góp vốn và không phân xử tranh chấp giữa các bên. Kể cả quán hùn vốn thì vẫn có một người đứng ra làm chủ và chịu trách nhiệm, phần góp vốn thỏa thuận bên ngoài phần mềm. Lý do đầy đủ ghi ở mục câu 11 trong `redesign-permission-model`.

6. **Store Key lưu ở dạng mã hóa và khôi phục lại được.** Chọn hướng này thay vì chỉ cho cấp key mới, vì Store Key là bí mật dùng chung của cửa hàng chứ không phải mật khẩu cá nhân: nó vốn đã nằm trên nhiều thiết bị và thường được ghi ra giấy tại quầy. Bắt cả quán ghép lại toàn bộ thiết bị chỉ vì chủ quên key là hình phạt không tương xứng với rủi ro.

   Cách lưu: phần bí mật mã hóa trong database, khóa giải mã giữ trong môi trường của hàm chạy phía server. Người lấy được bản dump database vẫn không đọc được key vì thiếu khóa; phải chiếm được cả môi trường chạy của hàm.

   Giữ **hai chức năng tách biệt**, không gộp:

   | Chức năng | Dùng khi | Store Key | Thiết bị đã ghép |
   | --- | --- | --- | --- |
   | Quên Store Key | Chủ không nhớ, không nghi lộ | Giữ nguyên | Không ảnh hưởng |
   | Cấp lại Store Key | Nghi lộ: nhân viên nghỉ việc, mất thiết bị, key bị chụp ảnh | Đổi mới | Phải ghép lại toàn bộ |

   Bỏ hẳn chức năng cấp lại thì cửa hàng bị lộ key không có cách tự cứu, nên phải giữ; chỉ là nó chuyển thành thao tác hiếm và có chủ ý, thay vì là hệ quả bắt buộc của việc quên.

   Nội dung email khôi phục gồm Store Key kèm tên và địa chỉ cửa hàng. Hiện mỗi chủ một cửa hàng nên email liệt kê một dòng; cấu trúc dữ liệu đã cho phép nhiều cửa hàng nên về sau liệt kê nhiều dòng mà không phải sửa.

   Hệ quả với spec: requirement về bảo mật Store Key trong `store-onboarding` phải phát biểu lại, vì ý định gốc của nó là không khôi phục được.

7. **Mặt web của tài khoản chủ giữ ở mức tối thiểu**, chỉ gánh những việc mà thiết bị POS không làm được: đăng nhập bằng email, xem danh sách cửa hàng của mình, tạo cửa hàng mới, quên Store Key, cấp lại Store Key, đặt lại PIN của vai trò chủ quán. Không đưa quản trị nghiệp vụ lên web.

   Lý do: chủ ghép được điện thoại của mình bằng Store Key rồi đăng nhập bằng PIN chủ quán như một thiết bị bình thường, nên báo cáo, cài đặt cửa hàng và quản lý nhân viên đều thao tác được từ xa qua đường đó. Dựng lại các màn đó trên web là nhân đôi giao diện mà không thêm năng lực. Chính sách bảo mật vì vậy chỉ cần mở nhánh chủ ở phạm vi hẹp thay vì trên nhiều bảng nghiệp vụ.

   Hệ quả cần nói rõ trên giao diện: cấp lại Store Key sẽ đăng xuất luôn thiết bị của chính chủ, chủ phải ghép lại bằng key mới.

8. **Quên Store Key: gửi thẳng key trong email, một luồng dùng chung ở hai lối vào.**

   Nội dung email chứa luôn Store Key kèm tên và địa chỉ cửa hàng, không dùng đường dẫn trung gian. Chọn hướng này vì chủ thường đang đứng tại quán và cần dùng ngay; bắt bấm thêm một đường dẫn là thêm bước cho một việc vốn đã gấp.

   Đánh đổi đã cân nhắc và chấp nhận: Store Key nằm lại trong hộp thư và trong mọi thư chuyển tiếp. Giảm nhẹ bằng ba việc: giới hạn tần suất gửi, không bao giờ ghi Store Key vào nhật ký hệ thống, và trong email nhắc chủ dùng chức năng cấp lại nếu nghi hộp thư đã bị lộ.

   Hai lối vào, **dùng chung một thành phần giao diện**: nút ở màn tạo cửa hàng và ghép thiết bị, và nút ở màn Cài đặt trong ứng dụng. Cả hai mở cùng một hộp thoại: nhập email, gửi, xong. Lối vào ở màn Cài đặt phục vụ đúng tình huống hay gặp là chủ cần ghép thêm một thiết bị mới nhưng không nhớ key.

   Lối vào công khai ở màn ghép thiết bị bắt buộc trả về phản hồi chung chung, không tiết lộ email có tồn tại trong hệ thống hay không. Hệ thống chỉ gửi khi email khớp một tài khoản chủ đã xác thực, và chỉ gửi các cửa hàng thuộc chính chủ đó.

9. **Không chuyển đổi dữ liệu cũ. Xóa sạch và bắt đầu lại.**

   Các cửa hàng tạo bằng luồng cũ không được gắn chủ sở hữu, không có luồng nhận cửa hàng, và không được giữ lại. Khi triển khai change này, dữ liệu hiện có trên môi trường thật bị xóa toàn bộ.

   Chọn xóa thay vì bỏ qua, dù bỏ qua tốn ít công hơn. Lý do: bỏ qua buộc trường chủ sở hữu phải cho phép rỗng, kéo theo quyết định 5 không áp dụng được cho nhóm cửa hàng cũ, và hệ thống tồn tại hai mô hình danh tính song song mà mọi đoạn code lẫn mọi trang tài liệu đều phải xử lý cả hai. Xóa sạch thì trường chủ sở hữu bắt buộc ngay từ đầu, mọi bất biến ở các quyết định trên đứng vững, và không phát sinh nhánh nào cho dữ liệu cũ.

   Phạm vi thu hẹp được nhờ quyết định này: không cần màn nhận cửa hàng, không cần trường chủ sở hữu cho phép rỗng, không cần cửa sổ thời gian nhận cửa hàng, không cần nhánh xử lý cửa hàng không có chủ ở bất kỳ đâu.

   Điều kiện bắt buộc khi thực hiện, vì đây là thao tác không hoàn tác được:

   - Xác nhận rõ ràng từ chủ dự án trước khi chạy, không suy đoán.
   - Sao lưu toàn bộ database và kho ảnh trước khi xóa.
   - Ghi lại thời điểm thực hiện và phạm vi đã xóa.
   - Dựng lại dữ liệu demo theo `docs/demo-runbook.md` sau khi xóa, và chụp lại ảnh màn hình cho báo cáo nếu ảnh cũ không còn khớp.

   Hệ quả cần thông báo: mọi Store Key hiện có mất hiệu lực và mọi thiết bị đã ghép phải ghép lại từ đầu.

10. **Xác thực bằng mã một lần sáu chữ số, và tài khoản chủ không có mật khẩu.**

    Không dùng đường dẫn xác nhận. Lý do: chủ thường đăng ký trên tablet hoặc máy tính đặt tại quán nhưng đọc mail trên điện thoại; bấm link ở điện thoại thì phiên xác thực nằm ở điện thoại còn thiết bị đang thao tác không nhận được gì, buộc quay lại đăng nhập lần nữa. Nhập mã giữ toàn bộ thao tác trên đúng một màn hình, và không phải cấu hình đường dẫn quay về cho từng môi trường.

    Bỏ hẳn mật khẩu cho tài khoản chủ. Kéo theo ba đơn giản hóa: không có luồng quên mật khẩu, không có ràng buộc độ mạnh mật khẩu, và **đăng ký lần đầu trùng luôn với đăng nhập các lần sau** — cùng một màn nhập email rồi nhập mã, tài khoản được tạo ở lần nhập mã đúng đầu tiên. Đánh đổi là mỗi lần đăng nhập đều phải mở hộp thư, chấp nhận được vì chủ chỉ dùng mặt web khi tạo cửa hàng hoặc khi khôi phục.

    Rủi ro không đổi so với phương án có mật khẩu: mất quyền truy cập hộp thư là mất tài khoản. Cả hai phương án đều quy về hộp thư.

    Ràng buộc bắt buộc, quan trọng hơn vì cùng một điểm cuối vừa đăng nhập vừa tạo tài khoản: giới hạn tần suất gửi mã theo email và theo địa chỉ mạng, đặt hạn dùng ngắn cho mã, giới hạn số lần nhập sai, và trả phản hồi chung chung không tiết lộ email đã tồn tại hay chưa.

    Hệ quả về vòng đời cửa hàng: vì chủ phải xác thực xong mới có phiên, và phải có phiên mới tạo được cửa hàng, nên **không tồn tại cửa hàng ở trạng thái chờ xác thực**. Trạng thái đó bị loại khỏi thiết kế, và câu hỏi số 10 ở trên không còn áp dụng.

    Lưu ý phạm vi: quyết định này chỉ áp dụng cho tài khoản chủ. Service account của cửa hàng vẫn đăng nhập bằng phần bí mật trong Store Key như cũ, và nhân viên vẫn dùng PIN như cũ.

11. **Trạng thái tạm ngưng cửa hàng được enforce ở tầng database**, không dừng ở tầng ứng dụng như hiện nay.

    Chi phí thấp bất thường ở thời điểm này: change đã phải sửa chính sách bảo mật mức dòng để thêm nhánh chủ sở hữu, nên thêm một điều kiện kiểm tra trạng thái là phần việc nhỏ đi kèm. Đổi lại đóng được đúng khoảng trống mà baseline spec `store-isolation` đang tự khai là chưa làm.

    Ngoại lệ bắt buộc: chính sách vẫn cho chủ **đọc bản ghi cửa hàng và trạng thái** của mình, chỉ chặn dữ liệu nghiệp vụ. Nếu chặn sạch thì giao diện chỉ báo lỗi chung chung và chủ không phân biệt được cửa hàng bị tạm ngưng với hệ thống hỏng.

    Hệ quả với spec: requirement khóa cửa hàng trong `store-isolation` phải sửa, vì nó đang ghi rõ hệ thống không được tuyên bố có enforce trạng thái này ở tầng database.

12. **Màn quản trị cho nhà cung cấp dịch vụ tách thành change riêng**, không làm trong change này.

    Chủ dự án muốn có một màn để nhà cung cấp quản lý các cửa hàng, gồm vô hiệu hóa và xóa cửa hàng. Việc đó là một tầng danh tính thứ tư bên cạnh chủ, thiết bị và nhân viên, và nó phá vỡ nguyên tắc cô lập dữ liệu giữa các cửa hàng, nên cần proposal riêng với phần phân tích riêng. Xem `add-provider-admin-console`.

    Change này chỉ chuẩn bị nền: trường trạng thái cửa hàng, việc enforce trạng thái ở tầng database, và bảng nhật ký thao tác quản trị cửa hàng.

13. **Giữ nguyên luồng ghép thiết bị: đúng Store Key là ghép được, không có bước duyệt.**

    Không bắt chủ kích hoạt từng thiết bị mới, và không giới hạn số thiết bị ghép đồng thời. Không theo dõi danh sách thiết bị đang ghép.

    Lý do: đây là tầng thấp nhất trong ba tầng danh tính, vốn thiết kế cho thiết bị đặt cố định tại quán và do người trong quán vận hành. Thêm bước duyệt tạo ra điểm nghẽn thật khi phải thay máy giữa giờ cao điểm, để đổi lấy một rủi ro đã có đường xử lý là chức năng cấp lại Store Key. Cái mà phần phản biện đặt vấn đề là gate ở bước tạo cửa hàng, và phần đó đã được trả lời bằng xác thực email ở quyết định số 1.

    Hạn chế đã biết, phải ghi vào tài liệu: Store Key rò rỉ thì bất kỳ ai cũng ghép được thiết bị cho tới khi chủ chủ động cấp lại key. Quyết định số 6 làm Store Key tồn tại lâu hơn và đi qua thêm một kênh là email, nên rủi ro này lớn hơn trước một chút, và chức năng cấp lại là biện pháp bù duy nhất.

    Requirement ghép thiết bị bằng Store Key trong `store-onboarding` giữ nguyên, không sửa.

14. **Hạn mức 5 cửa hàng trên mỗi tài khoản chủ, kèm giới hạn tần suất tạo.**

    Hai lớp bổ trợ nhau: trần chặn tổng số cửa hàng của một tài khoản, giới hạn tần suất chặn việc tạo dồn dập. Cùng với xác thực email ở quyết định số 1, đây là bộ ba biện pháp chống việc tạo cửa hàng hàng loạt.

    Con số 5 là giá trị cấu hình phía server, không phải hằng số nằm rải trong mã, nên nới về sau không kéo theo migration.

    Ghi lại lý do không chọn trần bằng 1, vì đây là điểm dễ hiểu nhầm. Câu hỏi "một chủ được mấy cửa hàng" thoạt nhìn giống câu hỏi "sản phẩm có làm quản lý chuỗi không", nhưng là hai việc khác nhau:

    - Toàn bộ tài liệu nền thống nhất rằng đây **không** phải bài toán quản lý chuỗi đa chi nhánh, gồm `pos-cafe-context.md`, mục ngoài phạm vi của `docs/requirements.md`, `docs/phase-scope.md` và `docs/limitations.md`.
    - Nhưng baseline spec `store-isolation` **đã đặc tả sẵn** kịch bản một chủ sở hữu nhiều quán: hai quán là hai cửa hàng tách biệt với hai Store Key khác nhau, và hệ thống không cung cấp màn hình tổng hợp chung. Tức nhiều cửa hàng cho một chủ vốn nằm trong phạm vi hiện tại.

    Cái ngoài phạm vi là quản lý chuỗi, tức thực đơn dùng chung, giá thống nhất, báo cáo tổng hợp và màn chuyển đổi cửa hàng. Vì vậy đặt trần bằng 1 sẽ mâu thuẫn với một kịch bản đã đặc tả, còn trần lớn hơn 1 đúng ở cả hai hướng phát triển. Quyết định về quản lý chuỗi vẫn để mở ở câu hỏi số 1 của `add-multi-store-ownership` và không chặn change này.

    Khi chạm hạn mức, giao diện thông báo rõ đã đạt số cửa hàng tối đa và hướng dẫn liên hệ nhà cung cấp để nới. Việc nới hạn mức theo từng tài khoản được đưa vào `add-provider-admin-console`.

15. **Cấu hình nhà cung cấp gửi email riêng, gửi từ một tên miền riêng đã xác minh.** Không dùng dịch vụ gửi email mặc định của nền tảng backend.

    Quyết định số 10 làm email trở thành đường vào bắt buộc và lặp lại, chứ không còn là thao tác một lần lúc đăng ký. Email hiện gánh ba luồng: mã đăng nhập của chủ ở mỗi lần đăng nhập, gửi lại Store Key, và đặt lại PIN của vai trò chủ quán. Dịch vụ mặc định giới hạn tần suất ở mức vài email mỗi giờ và nhà cung cấp khuyến cáo không dùng cho môi trường thật, nên trần đó chạm ngay trong lúc phát triển.

    Yêu cầu khi triển khai:

    - Xác minh tên miền và cấu hình bản ghi xác thực người gửi, để email vào hộp thư chính thay vì thư rác.
    - Gửi được tới địa chỉ email bất kỳ, không giới hạn ở địa chỉ đã xác minh của chính tài khoản gửi.
    - Hạn mức đủ cho cả giai đoạn phát triển lẫn buổi demo.
    - Kiểm tra thực tế khả năng vào hộp thư chính với ít nhất một nhà cung cấp hộp thư phổ biến, trước ngày demo.

    Rủi ro cụ thể phải kiểm soát: mã một lần rơi vào thư rác làm hỏng toàn bộ luồng đăng nhập, vì không còn mật khẩu để đăng nhập thay thế.

    Không chốt tên nhà cung cấp cụ thể ở mức proposal; chọn khi triển khai theo bốn yêu cầu trên.

16. **Cấp lại Store Key đòi ba lớp rào chắn.**

    Đây là thao tác có bán kính ảnh hưởng lớn nhất trong hệ thống: nó đăng xuất toàn bộ thiết bị của cửa hàng cùng lúc, và quán ngừng bán cho tới khi ghép lại từng máy.

    Ba lớp, theo thứ tự người dùng gặp:

    1. Cảnh báo nói rõ hậu quả, với nút xác nhận tách khỏi nút mở hộp thoại.
    2. Gõ lại tên cửa hàng để xác nhận, buộc người dùng dừng lại và đọc.
    3. Nhập một mã một lần mới gửi tới email chủ.

    Lớp thứ ba là lớp quan trọng nhất và không được cắt: nó chặn tình huống mà hai lớp đầu không chạm tới, là **phiên đăng nhập bỏ ngỏ trên máy dùng chung**. Phiên tồn tại lâu, nên nếu chỉ có cảnh báo và gõ xác nhận thì người ngồi vào máy sau vẫn cấp lại key được. Toàn bộ mô hình bảo mật của change này đặt trên việc kiểm soát hộp thư, nên thao tác phá nhiều nhất phải đòi một bằng chứng mới về đúng thứ đó.

    Ma sát chấp nhận được vì đây là thao tác hiếm: trường hợp thường gặp là quên Store Key, và luồng đó đã tách riêng ở quyết định số 6, không đụng tới thiết bị nào.

17. **Làm cả luồng đổi email chủ và luồng chuyển quyền sở hữu, ngay trong change này.**

    Lý do đổi email chủ đáng làm sớm, dù thoạt nhìn là tiện ích nhỏ: **chuyển quyền sở hữu cũng yêu cầu chủ đăng nhập được**, tức vẫn còn truy cập email. Nếu chủ mất hẳn email thì cả hai luồng đều vô dụng và cửa hàng kẹt cứng, chỉ còn đường nhà cung cấp can thiệp tay. Đổi email chủ vì vậy là biện pháp phòng ngừa cho đúng tình huống không tự cứu được: chủ di chuyển sang địa chỉ mới trước khi mất địa chỉ cũ.

    Luồng đổi email: chủ đang đăng nhập nhập địa chỉ mới, hệ thống gửi mã tới **địa chỉ mới**, nhập mã đúng thì đổi, đồng thời gửi thư thông báo về địa chỉ cũ để chủ phát hiện nếu không phải mình thực hiện. Tái dùng nguyên cơ chế mã một lần ở quyết định số 10, không dựng thêm cơ chế nào.

    Luồng chuyển quyền sở hữu: chủ hiện tại chỉ định địa chỉ email của chủ mới, người nhận xác thực để tiếp nhận. Chi tiết luồng và các ràng buộc đi kèm, gồm việc bản ghi nhân viên vai trò chủ quán phải chuyển theo, để lại cho bước thiết kế.

    Vẫn còn một tình huống ngoài tầm với của change này: chủ mất hẳn quyền truy cập email. Lối thoát duy nhất khi đó là nhà cung cấp gán lại chủ sở hữu, và việc đó thuộc `add-provider-admin-console`.

18. **Giữ một change duy nhất, chia giai đoạn ở `tasks.md`.**

    Đã cân nhắc tách change này làm hai vì proposal dài gấp gần bốn lần mức thường của kho, và **quyết định không tách**. Lý do: độ dài không phải tiêu chí tách change. Ranh giới đúng là cái gì duyệt và giao độc lập được, mà toàn bộ quyết định ở đây đã được chốt cùng một lượt nên không có hai vòng phê duyệt riêng. Tách ra còn làm hỏng mạch lý lẽ: quyết định số 3 chọn hàm phía server một phần vì nhu cầu khôi phục, và quyết định số 6 có phần lưu trữ thuộc giai đoạn đầu nhưng phần luồng thuộc giai đoạn sau.

    Việc giao theo giai đoạn không cần tách proposal: `tasks.md` là nơi quy định thứ tự. Hai giai đoạn, với một điểm dừng an toàn ở giữa:

    **Giai đoạn 1, danh tính và gate tạo cửa hàng.** Tài khoản chủ với mã một lần; tạo cửa hàng qua hàm phía server; hạn mức và giới hạn tần suất; trường chủ sở hữu, trường trạng thái và cột bí mật mã hóa; chính sách bảo mật thêm nhánh chủ và điều kiện trạng thái; ràng buộc gắn vai trò chủ quán với tài khoản chủ; bảng nhật ký; cấu hình nhà cung cấp gửi email; xóa dữ liệu cũ.

    Kết thúc giai đoạn 1 thì hệ thống chạy đầy đủ và đã trả lời trọn vấn đề ai cũng tạo được cửa hàng. Phần thiếu duy nhất là khôi phục, mà hiện tại cũng chưa có, nên dừng ở đây không làm hệ thống tệ hơn trước.

    **Giai đoạn 2, khôi phục và vòng đời quyền sở hữu.** Quên Store Key; cấp lại Store Key kèm ba lớp rào chắn; đặt lại PIN của vai trò chủ quán; đổi email chủ; chuyển quyền sở hữu.

    Delta spec chia theo capability cho rõ, không dồn hết vào `owner-account`.
