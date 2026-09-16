# Chuẩn viết spec cho pos-cafe

Tài liệu này quy định **cách làm việc** và **bộ tài liệu bắt buộc** cho mỗi tính năng của dự án. Nó là luật, không phải gợi ý.

Chốt ngày 2026-09-07 theo yêu cầu của chủ dự án. Áp cho mọi tính năng làm từ thời điểm này trở đi.

Cập nhật quy trình ngày **2026-09-16** theo yêu cầu đóng gói để dùng cho task mới. [Quy trình task](../docs/workflow/README.md) quy định cách khảo sát, hỏi, thực hiện, kiểm chứng và bàn giao; tài liệu này quy định nội dung đặc tả. [Mẫu dùng ngay](../docs/workflow/templates.md). Bộ bảy phần của change chính thức vẫn giữ nguyên.

## Vì sao có tài liệu này

Ba mục tiêu, xếp theo thứ tự ưu tiên:

1. **Một AI khác đọc spec không phải đoán các yêu cầu đã biết.** Phạm vi được giao phải đủ rõ để bắt đầu; người thực hiện vẫn được hỏi khi có thông tin mới hoặc phát hiện mâu thuẫn. Ghi và giải quyết câu hỏi trước khi tiếp tục phần bị ảnh hưởng.
2. **Tính năng làm ra phải đúng và ổn định.** Mọi requirement phải có ít nhất một test case chứng minh nó đúng, và có ma trận truy vết để thấy chỗ nào chưa được phủ.
3. **Spec là nguyên liệu của khóa luận tốt nghiệp.** Viết đủ kỹ để trích thẳng vào báo cáo mà không phải viết lại từ đầu.

## Vai trò

Người viết spec đóng vai **phân tích viên**, không phải người lập trình.

- **Không viết code trực tiếp** trừ khi chủ dự án yêu cầu rõ ràng.
- Quy trình: đọc đề bài/bàn giao → **đọc kho mã liên quan để nắm hiện trạng thật** → chốt câu hỏi quan trọng của phạm vi được giao → viết spec → chủ dự án duyệt → thực hiện khi được yêu cầu. Phần độc lập vẫn tiếp tục khi một phần khác đang chờ quyết định.
- **Không suy đoán nghiệp vụ thay chủ dự án.** Chỗ chưa rõ hoặc mâu thuẫn có thể đổi hành vi, dữ liệu, quyền, chi phí, phạm vi hay nghiệm thu phải hỏi trước khi làm phần phụ thuộc. Chi tiết thực thi đã nằm trong quy ước và phạm vi được giao không cần hỏi lại.
- Phát hiện mâu thuẫn hoặc rủi ro ảnh hưởng quyết định thì **nêu bằng chứng, phương án và khuyến nghị** để chủ dự án chốt. Sửa lỗi thông thường trong phạm vi triển khai đã được giao không cần xin lại quyền cho từng thao tác.

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

## Độ sâu theo tác động và phạm vi

- Phân mức **nhẹ / thông thường / nhạy cảm** theo [quy trình task](../docs/workflow/README.md#phan-muc), không theo số dòng hoặc nhãn "bug/UI". Chưa rõ tác động thì khảo sát trước khi xếp nhẹ.
- Mỗi change chính thức vẫn có bộ phần bắt buộc ở trên. Sáu bước là vòng đời của **một** bộ tài liệu; mỗi task nhỏ không tạo lại cả bộ. Dùng tham chiếu tới nội dung còn đúng thay vì chép lại.
- Bảo trì nhẹ, không tạo requirement mới hoặc thay đổi ý nghĩa requirement: ghi mục tiêu, phạm vi, kiểm tra và bàn giao ngắn trong hồ sơ task/change đang có; cập nhật tài liệu bị ảnh hưởng. Không bắt tạo change mới cho từng sửa chính tả. Nếu phát hiện đổi hợp đồng, nghiệp vụ, quyền hay dữ liệu, nâng mức và hoàn thiện spec trước phần phụ thuộc.
- Phân mức điều chỉnh độ sâu khảo sát/review và phạm vi kiểm chứng; không cho bỏ kiểm tra bắt buộc của một change đang có. Một sửa nhỏ trong thanh toán không tự trở thành rủi ro thấp.
- Proposal chưa đầy đủ được giữ ở mức khảo sát. Số file hoặc checklist có đủ mục không chứng minh đã sẵn sàng code. Chỉ làm sâu change sắp triển khai.

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

| Chỉ số | Ngưỡng |
| --- | --- |
| Số requirement chưa có **test case** nào | **Phải bằng 0. Tuyệt đối không nới.** |
| Số use case chưa có **test case** nào | **Phải bằng 0. Tuyệt đối không nới.** |
| Số requirement chưa có **use case** nào | Nên bằng 0. Được phép khác 0 **với điều kiện** ở dưới |

**Điều kiện cho dòng thứ ba.** Sửa ngày 2026-09-07. Một requirement hoặc một quyết định được phép **không có use case** nếu thỏa cả hai:

1. Nó **vẫn có ít nhất một test case**.
2. Trong `traceability.md` ghi rõ **"không có use case"** kèm **giải trình** vì sao.

Loại ràng buộc rơi vào diện này là thứ không diễn thành thao tác của một tác nhân được: quy tắc viết tài liệu, quy ước đặt tên, ràng buộc kiến trúc. Chúng vẫn kiểm chứng được bằng rà soát nên vẫn có test case, chỉ là không có ai "thực hiện" chúng theo nghĩa một luồng thao tác.

Lý do nới đúng dòng này mà không nới hai dòng kia: một requirement không có test case nghĩa là **không ai biết nó đúng hay sai** — đó là lỗ hổng thật. Còn một requirement không có use case chỉ nghĩa là nó không phải hành vi người dùng, và ép viết use case giả cho nó sẽ làm bẩn tài liệu chứ không thêm bảo đảm nào.

Bảng này phục vụ hai việc: chặn sót lúc làm, và đưa thẳng vào chương kiểm thử của khóa luận làm bằng chứng đã phủ hết yêu cầu.

## Áp ngược cho change đã viết theo chuẩn cũ

Change nào đã có đủ bốn file theo chuẩn cũ trước ngày 2026-09-07 thì **tạo khung ba file mới và để trống**, ghi rõ trong file là chưa viết. Nội dung bổ sung **khi bắt đầu thực hiện change đó**, không viết trước.

Lý do hoãn thay vì viết ngay: use case và test case viết trước lúc vào việc thì dễ lệch với các quyết định phát sinh trong lúc làm, và phải sửa lại hai lần. Để khung trống thì vẫn thấy được chỗ còn thiếu khi rà soát, mà không tốn công viết hai lần.

Hai change được ghi ở trạng thái này tại mốc 2026-09-07 là `redesign-permission-model` và `add-owner-account-and-store-provisioning`. Đây là mốc lịch sử; đọc proposal/tasks và biên bản hiện hành trước khi kết luận tình trạng hôm nay.

## Khuôn mẫu

[define-test-strategy](changes/archive/2026-09-07-define-test-strategy/proposal.md) là khuôn mẫu ban đầu; đã nằm trong archive. Dùng cùng [mẫu giao việc, quyết định, nghiệm thu và bàn giao](../docs/workflow/templates.md), không sao chép quyết định lịch sử của mẫu thành yêu cầu cho change mới.

## Quy tắc viết, áp cho cả bảy file

- **Tiếng Việt** cho nội dung. Giữ nguyên tiếng Anh cho: từ khóa OpenSpec (`ADDED`, `MODIFIED`, `Requirement`, `Scenario`), từ khóa RFC 2119 (`SHALL`, `MUST`, `MUST NOT`), tên file, tên hàm, tên cột, tên biến, mã lỗi, tên thư mục change.
- **Không viết chung chung.** Mọi ngưỡng phải có số, mọi trường phải có kiểu, mọi lỗi phải có mã.
- **Nêu lý do cho mọi lựa chọn có đánh đổi.** Khóa luận cần phần lập luận, không chỉ cần kết quả. Ghi cả phương án đã cân nhắc và loại bỏ, kèm lý do loại.
- **Không nói quá về hiện trạng.** Phân biệt rõ đã làm, đang làm, sẽ làm và cố ý không làm.
- **Dẫn nguồn khi khẳng định về code hiện tại**, bằng đường dẫn file và số dòng.
- **Ghi ngày** cho mọi quyết định và mọi lần sửa quyết định.

## Cổng chặn trước khi viết spec

Mỗi `proposal.md` có mục `## Câu hỏi phải chốt trước khi làm`. Được tạo/cập nhật proposal khảo sát, đề bài, bảng câu hỏi và quyết định trong lúc làm rõ; phải ghi rõ trạng thái nháp. Chưa chốt câu hỏi quan trọng thì chưa coi spec chi tiết của phần phụ thuộc là sẵn sàng thực hiện.

Trước khi hoàn thiện bộ spec của phạm vi được chọn, giải quyết các câu hỏi ảnh hưởng phạm vi đó và ghi câu trả lời vào `## Quyết định đã chốt`, kèm ngày, nguồn xác nhận và lý do. Câu hỏi chỉ thuộc phần hoãn phải ghi phần hoãn và chứng minh không là dependency của phần sẽ làm. Không được chuyển một lỗi hoặc câu hỏi cần thiết sang "hoãn" chỉ để qua cổng.

Thứ tự viết sau khi chốt phạm vi: `specs/` → `usecases.md` → `design.md` → `testplan.md` → `traceability.md` → `tasks.md`. Quyết định mới trong lúc triển khai mở lại đúng yêu cầu/thiết kế/test bị ảnh hưởng, ghi thay thế quyết định cũ và xác nhận lại khi đổi nghiệp vụ hoặc nghiệm thu.

Lý do thứ tự này: requirement định ra cái phải đúng; use case làm rõ hình dạng thao tác nên nó phát hiện được requirement còn thiếu; design chỉ chọn cách làm sau khi đã biết đủ hai thứ trên; test plan bám vào cả ba; traceability là bước kiểm lại; tasks là bước cuối vì nó phụ thuộc mọi thứ trước đó.

## Sẵn sàng, kiểm chứng và đóng task

- **Sẵn sàng thực hiện:** phạm vi và ngoài phạm vi rõ; input/output, quyền, lỗi và tiêu chí nghiệm thu của phần đó đã chốt; dependency đáp ứng; spec/thiết kế/test nhất quán; chủ dự án đã duyệt và giao thực hiện. Duyệt spec không tự cấp quyền phát hành hoặc thay dữ liệu thật.
- `testplan.md` chỉ là kế hoạch. Kết quả thực chạy nằm trong biên bản nghiệm thu, gắn source thực tế (commit sạch hoặc baseline + fingerprint/snapshot phần chưa commit), môi trường/backend/migration/fixture, lệnh, exit code, báo cáo và phần chưa chạy. Không suy toàn hệ thống PASS từ riêng `npm test`.
- Kiểm thử đi cùng từng phần triển khai; nghiệm thu tổng kiểm lại tích hợp/hồi quy cần thiết. Kết quả mong đợi phải bám requirement đã duyệt. Mọi thay đổi làm yếu tiêu chí/test cần được giải trình và duyệt nếu đổi yêu cầu.
- Dùng [mẫu bàn giao](../docs/workflow/templates.md#ban-giao) khi đổi bước, chốt quyết định, có kết quả kiểm tra hoặc tạm dừng. Ghi nguồn và phạm vi ủy quyền; file không tự tạo quyền mới.
- Phân biệt đã hiện thực, đã kiểm chứng, đã nghiệm thu và đã phát hành; không có phát hành thì ghi ngoài phạm vi. Với thay đổi quan trọng, cung cấp lượt giải thích code/test cho chủ dự án và ghi đúng phản hồi, không tự đánh dấu họ đã hiểu.
- **Cổng review độc lập, bổ sung 2026-09-16:** trước khi bàn giao kết quả task là hoàn tất, phải có ít nhất một subagent không tham gia tạo phần đang review; task nhạy cảm có ít nhất hai reviewer với trọng tâm khác nhau. Áp dụng cả task spec/tài liệu/bảo trì. Tất cả reviewer bắt buộc phải `APPROVE` đúng candidate và phạm vi; sửa finding rồi reviewer liên quan kiểm lại. Thiếu review hoặc bất đồng quan trọng là chưa qua cổng; vẫn báo tiến độ/câu hỏi cho chủ dự án. Chi tiết và mẫu ở [quy trình](../docs/workflow/README.md#review-doc-lap).
