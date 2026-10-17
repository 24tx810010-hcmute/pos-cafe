# Điều chỉnh bàn giao phân quyền — 2026-09-17

## Phạm vi và kết quả

Theo DELIVERY-01/02 trong [proposal](../../openspec/changes/redesign-permission-model/proposal.md), sửa cách ghi trạng thái và kế hoạch để đầu ra là tính năng đã nối UI, được kiểm chứng và triển khai lên đích chủ dự án xác nhận, giữ dữ liệu hiện có. T01–T07 vẫn giữ bằng chứng kỹ thuật cách ly; không được dùng để gọi sản phẩm đã hoàn tất. [Bàn giao hiện hành](../workflow/tasks/redesign-permission-model.md) ghi việc tiếp tục.

Trong lượt này chỉ sửa 10 file tài liệu kế hoạch/chỉ mục/bàn giao, sau đó bổ sung biên bản này và metadata verdict. Không sửa code ứng dụng, không chạy lại tests ứng dụng, không commit/push/deploy hoặc mutate DB đích. `tasks.md` còn được sửa lỗi “bốn role tạo được” thành ba role manager/cashier/waiter đúng spec/UC02.

## Kiểm chứng và nguồn

- Snapshot trước sửa 9 file đã tồn tại: `C:/Users/nguye/AppData/Local/Temp/pos-cafe-permission-delivery-20260917/docs-before.json`; bảo toàn các thay đổi chưa commit có sẵn. Handoff là file mới thứ10.
- Validator `verify-docs.cjs` cùng thư mục: 10 file, **815 liên kết local, 0 lỗi**, exit0. Kiểm đường dẫn và số dòng nằm trong file; không khẳng định đã kiểm tất cả nội dung tại mỗi dòng hoặc dịch vụ ngoài.
- `git diff --check` trên docs: exit0. Không lấy toàn bộ diff với HEAD làm phần mới của lượt này vì đã có dirty baseline.
- `gh api` chỉ đọc ngày17/09: remote main `ef2c372aec60d8362549e47b7aedb27126129479`; Production deployment gần nhất ID `6430580267`, cùng SHA, tạo ngày14/09. Không suy từ metadata thành UI/business smoke đã chạy lại.
- Supabase `get_project` với `kfqjdfwxhkdwihjobpny`: lỗi `USER_NOT_LOGGED_IN` / “is not connected”. Công cụ có trong inventory nhưng chưa truy cập được project qua kết nối; không có kết quả đọc DB/live preflight.
- Bằng chứng T07 vẫn là [biên bản ngày16/09](permission-t07-read-projections-2026-09-16.md), không phải test mới của lượt này.

## Review độc lập

Hai reviewer không tạo hoặc sửa candidate tài liệu, chỉ đọc/diff/đối chiếu và kiểm liên kết. Cùng review 10 file trước khi ghi metadata verdict; handoff khi review có SHA256 `a8a40ff5ceb4afb1c10cace90939b43634cdf6e16d6f42244937a42494aea181`.

| Reviewer | Phạm vi | Verdict và finding |
| --- | --- | --- |
| `delivery_dependencies` | An toàn activation, quyền triển khai, mapping/backup, dữ liệu/K/R1 và tính trung thực trạng thái | **APPROVE — candidate docs-only.** Giữ đủ preflight/mapping được xác minh/duyệt/backup/gate; không mở quyền reset hoặc activate riêng T07. Finding trạng thái công cụ Supabase đã được sửa theo lần gọi thực tế `USER_NOT_LOGGED_IN`; không còn finding chặn. Chưa kiểm ứng dụng hoặc deployment. |
| `ui_integration_map` | Trình tự UI/composition/lifecycle/mock, role selectable, bằng chứng và bảo toàn requirement | **APPROVE — docs-only candidate.** Một nguồn authority/một phiên mock, đúng purpose projection và giữ K/R1; không coi UI thay server enforcement. Sửa ba role selectable đúng yêu cầu; không bỏ TC, service gate hoặc bảo toàn dữ liệu. Không chạy lại app tests/live deployment; kết quả connector/GitHub dựa trên bằng chứng root, được ghi đúng giới hạn. |

Reviewer thứ nhất dùng SHA256 của các dòng `relativePath<TAB>fileSHA256<LF>` sắp xếp đường dẫn: `421187a4524cdce12e251d7a507dc50a976997c1f5dd52e97b71a8c5673b978e`. Reviewer thứ hai dùng dấu NUL thay TAB: `6d84d06a8705b442bc348ec58ee5a128d2b06c3041b23f2f01a7f1978afed664`. Hai digest khác cách mã hóa, cùng các file/hash. Metadata ghi verdict sau review không thay nội dung quyết định hoặc kế hoạch.

## Giới hạn bàn giao

Hồ sơ chuẩn bị đã qua review; **tính năng vẫn chưa hoàn tất/chưa triển khai**. Chưa có candidate UI tích hợp để nghiệm thu hoặc giải thích code hoàn chỉnh cho chủ dự án. Tiếp tục theo handoff, giữ các gate và quyết định còn chờ đã nêu; không dùng biên bản này thay nghiệm thu phần mềm.
