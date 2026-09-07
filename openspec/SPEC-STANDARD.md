# Chuẩn viết spec cho pos-cafe

Tài liệu này quy định **cách làm việc** và **bộ tài liệu bắt buộc** cho mỗi tính năng của dự án. Nó là luật, không phải gợi ý.

Chốt ngày 2026-09-07 theo yêu cầu của chủ dự án. Áp cho mọi tính năng làm từ thời điểm này trở đi.

## Vì sao có tài liệu này

Ba mục tiêu, xếp theo thứ tự ưu tiên:

1. **Một AI khác đọc spec là làm được, không phải đoán.** Spec phải đủ chi tiết để người thực hiện không cần hỏi lại, và không có chỗ nào để hiểu thành hai nghĩa.
2. **Tính năng làm ra phải đúng và ổn định.** Mọi requirement phải có ít nhất một test case chứng minh nó đúng, và có ma trận truy vết để thấy chỗ nào chưa được phủ.
3. **Spec là nguyên liệu của khóa luận tốt nghiệp.** Viết đủ kỹ để trích thẳng vào báo cáo mà không phải viết lại từ đầu.

## Vai trò

Người viết spec đóng vai **phân tích viên**, không phải người lập trình.

- **Không viết code trực tiếp** trừ khi chủ dự án yêu cầu rõ ràng.
- Quy trình: nhận yêu cầu → **đọc kho mã để nắm hiện trạng thật** → hỏi lại chủ dự án cho tới khi mọi yêu cầu đều rõ → viết spec → chủ dự án duyệt → sau đó mới tới bước thực hiện.
- **Không suy đoán thay chủ dự án.** Chỗ nào yêu cầu chưa rõ, có thể hiểu thành hai nghĩa, hoặc mâu thuẫn với tài liệu đang có, thì dừng lại và hỏi.
- Phát hiện sai sót, mâu thuẫn hoặc rủi ro thì **nêu ra để chủ dự án xác nhận**, không tự quyết và không lặng lẽ bỏ qua.

Mọi khẳng định về hiện trạng hệ thống phải **đọc từ kho mã**, không viết theo trí nhớ. Dẫn nguồn bằng đường dẫn file và số dòng khi khẳng định một điều gì đó về code hiện tại.

## Bộ tài liệu bắt buộc

Mỗi change trong `openspec/changes/<tên-change>/` phải có đủ bảy phần. Ba phần đầu là chuẩn OpenSpec, bốn phần sau là bổ sung của dự án này.

| # | File | Trả lời câu hỏi |
| --- | --- | --- |
| 1 | `proposal.md` | Vì sao làm, làm gì, ảnh hưởng tới đâu, còn câu hỏi nào chưa chốt |
| 2 | `specs/<capability>/spec.md` | Hệ thống **phải** làm được gì, phát biểu kiểm chứng được |
| 3 | `design.md` | Làm bằng cách nào, lược đồ dữ liệu, hợp đồng kỹ thuật, rủi ro |
| 4 | `usecases.md` | Người dùng thao tác ra sao, đầu vào gì, đầu ra gì, tiêu chí chấp nhận |
| 5 | `testplan.md` | Kiểm chứng bằng cách nào, từng bước cụ thể |
| 6 | `traceability.md` | Requirement nào ứng với use case nào, test case nào; chỗ nào chưa phủ |
| 7 | `tasks.md` | Thứ tự thực hiện, cổng chặn |

Change thuộc nhóm công cụ hoặc quy trình, không sinh hành vi người dùng nhìn thấy, được phép bỏ `usecases.md` — nhưng vẫn phải có `testplan.md` và `traceability.md`. Ghi rõ lý do bỏ ngay đầu `proposal.md`.

## 4. `usecases.md` — quy cách

Mỗi use case là một mục, đánh mã `UC-<tên-change-viết-tắt>-<số>`, ví dụ `UC-OWNER-01`.

Mỗi use case bắt buộc có đủ mười phần sau. Thiếu phần nào thì use case đó chưa xong.

| Phần | Nội dung |
| --- | --- |
| Mã và tên | `UC-OWNER-01 — Chủ đăng nhập bằng mã một lần` |
| Tác nhân | Ai thực hiện, và ai bị ảnh hưởng |
| Mục tiêu | Một câu, nói theo góc nhìn người dùng chứ không theo góc nhìn hệ thống |
| Tiền điều kiện | Trạng thái hệ thống phải có trước khi bắt đầu |
| **Đầu vào** | Bảng: tên trường, kiểu, bắt buộc hay không, ràng buộc hợp lệ, ví dụ giá trị |
| Luồng chính | Các bước đánh số, mỗi bước một hành động, xen kẽ người dùng và hệ thống |
| Luồng thay thế | Các nhánh vẫn dẫn tới thành công nhưng đi đường khác |
| Luồng ngoại lệ | Các nhánh thất bại, mỗi nhánh ghi rõ **mã lỗi** và **thông báo hiển thị** |
| **Đầu ra** | Bảng: dữ liệu trả về, thay đổi trạng thái hệ thống, thông báo, tác dụng phụ như gửi email hay ghi nhật ký |
| **Tiêu chí chấp nhận** | Danh sách điều kiện kiểm chứng được. Đạt hết mới coi là xong |
| Truy vết | Requirement nào trong `specs/` mà use case này hiện thực |

Quy tắc bắt buộc cho phần đầu vào và đầu ra:

- **Mọi trường phải có kiểu và ràng buộc cụ thể.** Không viết "chuỗi hợp lệ"; viết "chuỗi, 6 chữ số, chỉ nhận `0-9`".
- **Mọi luồng ngoại lệ phải có mã lỗi**, và mã đó phải tồn tại trong `AppErrorCode` hoặc được khai báo là mã mới trong `design.md`.
- **Thông báo hiển thị viết bằng tiếng Việt, đúng câu chữ sẽ dùng trên giao diện.** Không viết mô tả chung chung.

## 5. `testplan.md` — quy cách

Mỗi test case là một mục, đánh mã `TC-<tên-change-viết-tắt>-<số>`.

| Phần | Nội dung |
| --- | --- |
| Mã và tên | `TC-OWNER-07 — Mã một lần hết hạn sau 10 phút` |
| Truy vết | Use case và requirement mà test case này kiểm chứng |
| Mức | `đơn vị`, `tích hợp`, `giao diện`, hoặc `E2E` |
| Tiền điều kiện | Dữ liệu và trạng thái phải dựng trước |
| Dữ liệu thử | Giá trị cụ thể, không phải mô tả |
| Các bước | Đánh số, mỗi bước một thao tác |
| Kết quả mong đợi | Cụ thể và quan sát được. Không viết "hệ thống xử lý đúng" |
| Nơi hiện thực | Đường dẫn file kiểm thử, điền sau khi viết xong test |

Bộ test của một change bắt buộc phủ đủ bốn nhóm:

1. **Luồng chính** — đường đi đúng của từng use case.
2. **Luồng ngoại lệ** — mỗi mã lỗi ít nhất một test case.
3. **Biên** — giá trị nhỏ nhất, lớn nhất, rỗng, vượt ngưỡng, đúng ngay tại ngưỡng.
4. **Bảo mật và quyền** — thao tác bị từ chối khi thiếu quyền, và bị từ chối cả khi gọi thẳng vào tầng dữ liệu chứ không chỉ ở giao diện.

Nhóm 4 là bắt buộc với mọi change đụng tới quyền, tiền hoặc dữ liệu cửa hàng. Không có nhóm 4 thì change đó chưa được coi là xong.

## 6. `traceability.md` — quy cách

Một bảng duy nhất, ba cột: requirement, use case, test case.

| Requirement | Use case | Test case |
| --- | --- | --- |
| Tài khoản chủ dùng email thật... | UC-OWNER-01, UC-OWNER-02 | TC-OWNER-01 … TC-OWNER-06 |

Kèm ba dòng tổng kết ở cuối:

- Số requirement chưa có use case nào — **phải bằng 0**.
- Số requirement chưa có test case nào — **phải bằng 0**.
- Số use case chưa có test case nào — **phải bằng 0**.

Bảng này phục vụ hai việc: chặn sót lúc làm, và đưa thẳng vào chương kiểm thử của khóa luận làm bằng chứng đã phủ hết yêu cầu.

## Áp ngược cho change đã viết theo chuẩn cũ

Change nào đã có đủ bốn file theo chuẩn cũ trước ngày 2026-09-07 thì **tạo khung ba file mới và để trống**, ghi rõ trong file là chưa viết. Nội dung bổ sung **khi bắt đầu thực hiện change đó**, không viết trước.

Lý do hoãn thay vì viết ngay: use case và test case viết trước lúc vào việc thì dễ lệch với các quyết định phát sinh trong lúc làm, và phải sửa lại hai lần. Để khung trống thì vẫn thấy được chỗ còn thiếu khi rà soát, mà không tốn công viết hai lần.

Hai change đang ở trạng thái này: `redesign-permission-model` và `add-owner-account-and-store-provisioning`.

## Khuôn mẫu

`define-test-strategy` là change đầu tiên viết trọn theo chuẩn bảy file. Nó **là khuôn mẫu** cho mọi change sau: cần biết một file nên trông như thế nào thì mở change đó ra xem, đừng suy diễn từ mô tả trong tài liệu này.

## Quy tắc viết, áp cho cả bảy file

- **Tiếng Việt** cho nội dung. Giữ nguyên tiếng Anh cho: từ khóa OpenSpec (`ADDED`, `MODIFIED`, `Requirement`, `Scenario`), từ khóa RFC 2119 (`SHALL`, `MUST`, `MUST NOT`), tên file, tên hàm, tên cột, tên biến, mã lỗi, tên thư mục change.
- **Không viết chung chung.** Mọi ngưỡng phải có số, mọi trường phải có kiểu, mọi lỗi phải có mã.
- **Nêu lý do cho mọi lựa chọn có đánh đổi.** Khóa luận cần phần lập luận, không chỉ cần kết quả. Ghi cả phương án đã cân nhắc và loại bỏ, kèm lý do loại.
- **Không nói quá về hiện trạng.** Phân biệt rõ đã làm, đang làm, sẽ làm và cố ý không làm.
- **Dẫn nguồn khi khẳng định về code hiện tại**, bằng đường dẫn file và số dòng.
- **Ghi ngày** cho mọi quyết định và mọi lần sửa quyết định.

## Cổng chặn trước khi viết spec

Giữ nguyên quy tắc đã có: mỗi `proposal.md` có mục `## Câu hỏi phải chốt trước khi làm`. Phải hỏi hết câu chưa trả lời và ghi câu trả lời vào `## Quyết định đã chốt` **trước khi** viết bất kỳ file nào trong bộ bảy file trên.

Thứ tự viết sau khi đã chốt hết câu hỏi: `specs/` → `usecases.md` → `design.md` → `testplan.md` → `traceability.md` → `tasks.md`.

Lý do thứ tự này: requirement định ra cái phải đúng; use case làm rõ hình dạng thao tác nên nó phát hiện được requirement còn thiếu; design chỉ chọn cách làm sau khi đã biết đủ hai thứ trên; test plan bám vào cả ba; traceability là bước kiểm lại; tasks là bước cuối vì nó phụ thuộc mọi thứ trước đó.
