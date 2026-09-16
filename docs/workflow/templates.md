# Mẫu cho task POS-cafe

Theo [quy trình](README.md), hiệu lực 2026-09-16. Các mục dưới đây được điền vào change/biên bản/bàn giao tương ứng; không bắt mỗi mẫu thành một file mới. Trường chưa biết ghi **chưa xác định**, kèm cách làm rõ; không điền giá trị giả. Nội dung mẫu không phải bằng chứng đã thực hiện hay sự ủy quyền.

<a id="de-bai"></a>
## 1. Đề bài và đầu vào AI

```markdown
# Task: <mã và tên>

- Yêu cầu gốc và nguồn/ngày: <trích ngắn hoặc liên kết>
- Kết quả chủ dự án muốn thấy: <quan sát/đo được>
- Loại công việc được giao: <khảo sát / spec / triển khai / kiểm chứng / phát hành>
- Change/spec liên quan: <đường dẫn + phiên bản/dirty state>
- Code: <worktree, branch, HEAD, thay đổi chưa commit liên quan>
- Phạm vi làm / ngoài phạm vi: <...>
- Mức tác động và lý do: <nhẹ / thông thường / nhạy cảm>
- Ràng buộc: <thời gian, chi phí, môi trường, quyết định phải giữ>
- Hiện trạng đã kiểm tra: <file:dòng hoặc bằng chứng; tách điều chưa xác minh>
- Dependency: <đã đáp ứng / còn thiếu / cách kiểm tra>
- Tiêu chí hoàn thành dự kiến: <kết quả + phép kiểm; chưa duyệt thì ghi rõ>
- Quyền đã có: <hành động, môi trường, giới hạn, nguồn xác nhận>
- Câu hỏi chặn: <Q-ID → phần phụ thuộc>
```

Người dùng chỉ cần mô tả vấn đề/kết quả mong muốn và ràng buộc họ biết. AI tự khảo sát để điền hiện trạng, dependency và kiểm chứng; hỏi phần thuộc ý định của người dùng.

<a id="cau-hoi"></a>
## 2. Một câu hỏi có hỗ trợ quyết định

```markdown
### Q-<task>-01 — <điểm cần chốt>
- Tình huống cụ thể: <ai làm gì, ở trạng thái nào>
- Đã biết / chưa rõ: <nguồn, chỗ thiếu hoặc mâu thuẫn>
- Phương án A: <hành vi + lợi ích + chi phí/hạn chế>
- Phương án B: <hành vi + lợi ích + chi phí/hạn chế>
- Khuyến nghị: <chọn gì, tại sao, căn cứ hay giả thuyết>
- Tác động: <requirement/design/test/phạm vi nào thay đổi>
- Phần phải chờ / phần độc lập có thể tiếp tục: <...>
- Trả lời và nguồn/ngày: <chưa trả lời nếu đang chờ>
- Quyết định liên quan: <DEC-ID sau khi có lựa chọn>
```

Không buộc mọi câu có hai phương án nếu câu hỏi chỉ cần một dữ kiện. Không lặp câu đã chốt còn hiệu lực. "Chưa biết" dẫn đến hỗ trợ phân tích, không biến thành đồng ý với khuyến nghị.

<a id="quyet-dinh"></a>
## 3. Hồ sơ quyết định

```markdown
### DEC-<change/task>-01 — <tên quyết định>
- Trạng thái: <đề xuất / đã chấp nhận / đã bị thay thế / hoãn>
- Ngày đề xuất/chốt: <ngày thật>
- Người đề xuất / người chốt: <ghi đúng người; AI tự chọn trong quyền được giao thì nói rõ>
- Nguồn xác nhận hoặc căn cứ ủy quyền: <lời yêu cầu, liên kết, mốc cuộc trao đổi>
- Bối cảnh và yêu cầu liên quan: <vấn đề cần giải quyết>
- Phương án đã cân nhắc: <A, B... và đánh đổi thực tế>
- Chọn: <phương án hoặc chưa chốt>
- Lý do chọn / lý do loại phương án khác: <...>
- Căn cứ: <code, nguồn gốc, số đo; tách giả thuyết/chưa kiểm chứng>
- Hệ quả và giới hạn chấp nhận: <...>
- Cách kiểm chứng / điều kiện cần xem xét lại: <...>
- Liên kết: <REQ, UC nếu có, TC, task, biên bản>
- Thay thế / bị thay thế bởi: <DEC-ID hoặc không>
```

Quyết định riêng đặt trong proposal, design tham chiếu. Quyết định xuyên feature có hồ sơ chung được liên kết. Không ghi "đã chấp nhận" chỉ vì AI khuyên chọn. Nếu bổ sung lý do sau sự kiện, ghi rõ hồi cứu và nguồn có thể xác minh.

<a id="task-thuc-hien"></a>
## 4. Một phần thực hiện trong tasks.md

```markdown
## <TASK-ID> — <kết quả cần tạo>
- Trạng thái: <chưa làm / đang làm / chờ quyết định / đã kiểm chứng / đã bàn giao>
- Input: <REQ/UC/DEC, source/spec, dữ liệu và dependency>
- Output: <hành vi/code/tài liệu có thể kiểm tra>
- Phạm vi và quyền: <được sửa/chạy ở đâu; nguồn ủy quyền>
- Không thuộc phần này: <...>
- Điều kiện bắt đầu: <dependency và câu hỏi đã chốt>
- Cách kiểm: <TC, lệnh/môi trường, kết quả mong đợi>
- Bằng chứng thực tế: <liên kết hoặc chưa chạy>
- Tài liệu cần cập nhật: <đường dẫn>
- Câu hỏi/điểm cần quyết định nếu phát sinh: <...>
```

<a id="nghiem-thu"></a>
## 5. Biên bản kiểm chứng và nghiệm thu

```markdown
# <Task/change> — Kết quả tại <thời điểm>

## Phạm vi và phiên bản
- Kết quả yêu cầu: <...>
- Code: <branch + commit sạch; hoặc baseline + fingerprint + snapshot/patch gồm file mới>
- Spec/decisions: <phiên bản và phần chưa commit nếu có>
- Môi trường: <runtime, lockfile, backend, migration/schema, fixture, cấu hình liên quan>
- Cách dựng và chạy lại: <điều kiện, lệnh, thư mục chạy; không chứa secret>

## Kết quả
| Tiêu chí/TC | Lệnh hoặc phép kiểm | Môi trường | Thời điểm/exit code | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| <ID> | <...> | <...> | <...> | <đạt/chưa đạt/chưa chạy/không áp dụng + lý do> | <file/report/hash nếu cần> |

- Số ca bắt buộc / chạy / fail / skip: <đếm theo runner, tách TC với execution>
- Tái dùng bằng chứng: <phần nào, căn cứ phạm vi/source, gate cho phép>
- Lần thất bại trước và cách xử lý: <giữ bằng chứng; không xóa lịch sử>
- Review expected result / trường hợp phản ví dụ: <ai kiểm, phương pháp, kết quả, giới hạn độc lập>
- Cổng subagent: <reviewer bắt buộc/phạm vi/candidate cuối/verdict/link báo cáo; hợp phạm vi phủ tiêu chí>
- Findings: <ID, chặn/không chặn + lý do, xử lý, bằng chứng và reviewer xác nhận đóng>
- Chưa kiểm / giới hạn / rủi ro còn lại: <...>

## Giải thích code và phản hồi chủ dự án
- Đường đọc code: <điểm vào → xử lý → lưu dữ liệu; file:dòng>
- Điểm giữ tính đúng và test chứng minh: <...>
- Quyết định/đánh đổi cần giải thích: <DEC-ID>
- Trạng thái lượt giải thích: <đã chuẩn bị / đã thực hiện / chờ phản hồi / không áp dụng + lý do>
- Phản hồi thực tế: <nguồn/ngày; chưa có thì ghi chưa có>

## Kết luận đúng phạm vi
- Hiện thực: <...>
- Kiểm chứng kỹ thuật: <...>
- Nghiệm thu của chủ dự án: <chưa yêu cầu / chờ / đã chấp nhận + nguồn>
- Phát hành: <ngoài phạm vi / chưa / đã + môi trường + phiên bản + bằng chứng>
- Docs đã cập nhật: <...>
- Việc tiếp theo: <...>
```

Với task chỉ sửa tài liệu, phép kiểm có thể là đọc đối chiếu, kiểm liên kết và kịch bản bàn giao. Không cần chạy build/test ứng dụng không liên quan hoặc bịa số test tự động. Mức độc lập của review phải được mô tả đúng.

<a id="ban-giao"></a>
## 6. Bàn giao ngắn cho phiên kế tiếp

Lưu tại `docs/workflow/tasks/<task-id>.md`; thêm đường dẫn vào chỉ mục cùng thư mục. Ưu tiên ngắn, liên kết thay cho sao chép spec/log.

```markdown
# Bàn giao — <task-id>
- Cập nhật: <thời điểm/người hoặc agent>
- Mục tiêu và change: <...>
- Bước hiện tại / trạng thái: <1–6; đang làm/chờ/đã bàn giao>
- Đọc tiếp: <đề bài, proposal/tasks, quyết định và biên bản cần thiết>
- Code/docs: <worktree, branch, HEAD, snapshot/fingerprint và thay đổi chưa commit liên quan>
- Phạm vi được giao: <hành động + môi trường + giới hạn + nguồn xác nhận>
- Quyết định còn hiệu lực: <DEC-ID>; câu hỏi chưa chốt: <Q-ID → phần chặn>
- Đã hoàn tất: <phạm vi + evidence>
- Chưa làm/chưa kiểm chứng: <...>
- Lỗi/thử nghiệm gần nhất: <triệu chứng, bằng chứng, điều đã loại trừ>
- Review độc lập: <candidate, reviewer/phạm vi/verdict, finding chặn còn mở hoặc liên kết bảng xử lý>
- Việc tiếp theo: <bước cụ thể và điều kiện bắt đầu>
- Việc cần người dùng: <quyết định/phản hồi thực sự còn thiếu hoặc không có>
- Trạng thái nghiệm thu/phát hành: <tách riêng>
```

Không biến ghi chú ủy quyền thành quyền mới. Khi bắt đầu lại, kiểm tra nguồn quyết định và diff liên quan; không mặc định file còn mới. Không tự chuyển trạng thái task khác chỉ vì đọc được biên bản cũ.

<a id="review-doc-lap"></a>
## 7. Báo cáo reviewer độc lập

```markdown
# Review <reviewer-id> — <task / vòng review>
- Vai trò: <subagent không tham gia tạo nội dung đang review>
- Phạm vi/tiêu chí được giao: <...>
- Candidate đã kiểm: <commit hoặc manifest hash + snapshot/patch>
- Nguồn tự đọc: <yêu cầu, spec, diff, báo cáo, code; ghi phiên bản>
- Kiểm tra tự thực hiện: <lệnh/phép kiểm + kết quả, hoặc giới hạn>
- Chưa kiểm: <phần ngoài phạm vi hoặc thiếu bằng chứng>

| Finding | Chặn / không chặn và lý do | Vị trí + bằng chứng | Tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| <ID> | <...> | <...> | <...> | <...> | <mở / đã sửa được xác nhận / không phải lỗi có căn cứ> |

- Verdict: <APPROVE / CHANGES_REQUESTED / BLOCKED>
- Lý do verdict và giới hạn: <...>
- Candidate cuối được xác nhận lại: <ID; delta đã kiểm nếu tái dùng review cũ>
```

AI điều phối lưu nguyên nội dung có ý nghĩa của verdict/findings và liên kết nguồn báo cáo; không tự sửa verdict thay reviewer. Dùng bảng xử lý chung để nối finding → thay đổi/giải trình → evidence → xác nhận reviewer. Một bản ghi APPROVE không tự xác nhận chủ dự án đã nghiệm thu.
