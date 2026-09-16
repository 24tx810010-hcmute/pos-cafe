# Delta ai-task-workflow

Năng lực quy trình; các mã WF là nội bộ quy trình, không phải chức năng mới của phần mềm POS. Use case người dùng cuối không áp dụng; kiểm qua kịch bản rà soát và công cụ kiểm tài liệu.

## ADDED Requirements

### Requirement: Đầu vào và nguồn hiện trạng

Mã **WF-01**. Mỗi task SHALL xác định mục tiêu, phạm vi được giao, code/spec hiện hành, dependency, điều chưa biết và đầu ra cần kiểm chứng. AI SHALL đọc nguồn liên quan để bổ sung đầu vào và MUST NOT suy trạng thái hiện tại chỉ từ bàn giao cũ.

#### Scenario: Phiên mới tiếp tục một task

- **WHEN** AI đọc bàn giao có source cũ
- **THEN** AI đối chiếu Git và phần thay đổi liên quan trước khi dùng bằng chứng hoặc tiếp tục việc phụ thuộc.

### Requirement: Làm rõ và quyền quyết định

Mã **WF-02**. AI SHALL hỏi các điểm chưa rõ ảnh hưởng nghiệp vụ, dữ liệu, quyền, chi phí, phạm vi hoặc nghiệm thu, kèm phương án/đánh đổi/khuyến nghị khi phù hợp. AI MUST NOT giới hạn tổng quyết định của chủ dự án hoặc coi im lặng là chấp thuận; SHALL tiếp tục phần độc lập đã được giao.

#### Scenario: Phát sinh câu hỏi thứ sáu trong lúc code

- **WHEN** thông tin mới đặt ra lựa chọn nghiệp vụ chưa được chốt
- **THEN** AI hỏi trước phần phụ thuộc, dù năm quyết định trước đã chốt; quyền thực thi cũ còn hiệu lực không bị hỏi lại vô cớ.

### Requirement: Quyết định có căn cứ và lịch sử

Mã **WF-03**. Quyết định quan trọng SHALL được lưu trên `docs` với nguồn/ngày/người chốt, phương án, lý do, căn cứ hay giả thuyết và hệ quả. Quyết định thay thế SHALL liên kết lịch sử; AI MUST NOT giả nguồn đồng ý hoặc viết lý do hồi cứu thành căn cứ có từ đầu.

#### Scenario: Có số đo mới làm thay phương án

- **WHEN** số đo mới bác giả thuyết của DEC cũ
- **THEN** ghi quyết định mới và nguồn chốt, giữ DEC cũ với trạng thái bị thay thế, cập nhật spec/design/test liên quan.

### Requirement: Độ sâu phù hợp tác động

Mã **WF-04**. Task SHALL phân mức theo tác động và độ rõ; change chính thức SHALL giữ bộ phần bắt buộc theo chuẩn. Bảo trì nhẹ không đổi requirement MAY cập nhật hồ sơ sẵn có. Một sửa nhỏ về tiền/quyền/dữ liệu MUST NOT tự được miễn gate vì ít dòng.

#### Scenario: Đổi một điều kiện phân quyền

- **WHEN** diff chỉ có một dòng nhưng đổi quyền truy cập
- **THEN** xếp nhạy cảm, làm rõ và kiểm bảo vệ quyền theo scope; không dùng đường bảo trì nhẹ.

### Requirement: Bằng chứng và phạm vi kiểm chứng

Mã **WF-05**. Kết quả SHALL gắn expected result được duyệt, source thực tế có thể phục hồi, spec và môi trường, lệnh/phép kiểm, báo cáo, kết quả và phần chưa chạy. Test SHALL đi cùng slice. AI MUST NOT đồng nhất mock với backend thật, code chưa commit với riêng HEAD, hoặc ghép report khác source để tạo PASS.

#### Scenario: Test xanh nhưng code vừa đổi

- **WHEN** code hoặc test liên quan thay đổi sau lần kiểm
- **THEN** bằng chứng cũ chỉ chứng minh source cũ; kiểm lại phần ảnh hưởng và gate bắt buộc, ghi rõ phạm vi tái dùng nếu được phép.

### Requirement: Chẩn đoán và giải thích code

Mã **WF-06**. AI SHALL chuyển sang chẩn đoán khi sửa không tạo tiến triển về bằng chứng, không tự nới tiêu chí để xanh. Với thay đổi quan trọng, AI SHALL cung cấp đường đọc code và test; MUST NOT tự xác nhận chủ dự án đã hiểu hoặc nghiệm thu.

#### Scenario: Ba lần sửa chưa rõ nguyên nhân

- **WHEN** chưa phân biệt được lỗi code, test hoặc môi trường
- **THEN** ghi giả thuyết và phép thử tiếp theo, mở lại đúng phần khi có căn cứ; không mặc định thiết kế sai.

### Requirement: Bàn giao và thẩm quyền

Mã **WF-07**. Task SHALL có bàn giao riêng cập nhật tại checkpoint, liên kết quyết định/evidence và ghi nguồn quyền thực hiện. Bàn giao MUST NOT tự cấp quyền phát hành hoặc thay dữ liệu thật. Trạng thái hiện thực, kiểm chứng, nghiệm thu, phát hành SHALL được phân biệt.

#### Scenario: Task chỉ được giao viết spec

- **WHEN** hồ sơ spec đã sẵn sàng
- **THEN** bàn giao để duyệt, không tự code/deploy; nếu đã có quyền triển khai phạm vi được duyệt thì tiếp tục trong quyền đó thay vì hỏi lại.

### Requirement: Tích hợp và giới hạn áp dụng

Mã **WF-08**. Quy trình SHALL có đường vào từ AGENTS, chuẩn spec, OpenSpec và hướng dẫn cho checkout thiếu con trỏ. Hồ sơ SHALL ở `docs`, công cụ chạy ở `main`. Áp dụng MUST NOT ghi đè việc khác, đổi gate feature đang làm hoặc tuyên bố hiệu quả pilot chưa đo.

#### Scenario: Worktree code mới không có AGENTS pointer

- **WHEN** task được mở trong checkout không mang file bị ignore
- **THEN** câu mở đầu chỉ cách xác minh/đọc worktree docs hoặc ref docs; nếu thiếu nguồn thì báo thiếu, không tự dựng quy tắc.

### Requirement: Review độc lập và chấp thuận candidate cuối

Mã **WF-09**. Trước bàn giao một task là hoàn tất, AI SHALL gọi ít nhất một subagent không tham gia tạo phần được review; task nhạy cảm SHALL có ít nhất hai với phạm vi khác nhau, hợp phạm vi phủ tiêu chí nghiệm thu. Reviewer SHALL tự đọc nguồn/kiểm bằng chứng, không sửa candidate. Mọi reviewer bắt buộc SHALL trả `APPROVE` đúng candidate cuối/phạm vi sau khi finding chặn được xử lý và kiểm lại. AI MUST NOT dùng tự review, đa số, im lặng hoặc loại reviewer bất đồng để thay cổng này.

#### Scenario: Một reviewer đồng ý và một reviewer thấy lỗi

- **WHEN** hai reviewer bắt buộc có verdict khác nhau vì một finding đúng-sai chưa giải quyết
- **THEN** chưa bàn giao hoàn tất; tác giả sửa hoặc phản biện bằng chứng và reviewer kiểm lại, không lấy đa số hoặc đổi reviewer để kết thúc.

#### Scenario: Candidate đổi sau khi được chấp thuận

- **WHEN** code, spec hoặc bằng chứng/kết luận quan trọng thay đổi sau review
- **THEN** kiểm lại phần ảnh hưởng và mọi reviewer xác nhận candidate cuối trong phạm vi; chỉ thêm metadata ghi kết quả review được miễn review đệ quy.

#### Scenario: Không thể thực hiện review

- **WHEN** reviewer không truy cập được bằng chứng thiết yếu hoặc subagent không khả dụng
- **THEN** ghi `BLOCKED`, báo tiến độ và nguyên nhân; không tự thay bằng self-review hoặc nhận hoàn tất.
