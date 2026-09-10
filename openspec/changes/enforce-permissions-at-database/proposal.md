# Siết ranh giới bảo mật quyền nhân viên xuống tầng database

## Liên quan quyết định chống trùng 08/09/2026

Chủ dự án chọn server là nguồn tin cậy duy nhất và cho mọi người đủ quyền tiếp tục đơn/thao tác, không giới hạn quản lý. Yêu cầu được ghi theo nghĩa server xác minh danh tính và quyền người thực hiện, xem [quyết định 10](../../../docs/reviews/2026-09-07-idempotency/10-quyet-dinh-sau-review-va-chinh-sach-gia.md).

Nền tảng danh tính nhân viên server vì vậy liên quan trực tiếp đến việc nghiệm thu `add-idempotent-write-operations`. Cần xác định phần tối thiểu phục vụ những đường ghi/tra cứu trong phạm vi. **Chưa đồng nghĩa toàn bộ change siết quyền mọi bảng đã được duyệt hoặc triển khai**; các câu hỏi kiến trúc phía dưới chưa tự có câu trả lời.

## Why

Hiện chính sách bảo mật mức dòng chỉ cô lập theo cửa hàng: mọi nhân viên trong cùng một cửa hàng dùng chung một danh tính đã xác thực ở tầng database. Quyền theo từng nhân viên được chốt ở tầng nghiệp vụ, và ba lời gọi order cùng payment chính có kiểm tra lại quyền hiệu lực. Nhưng `docs/requirements.md` ghi rõ NFR-02 không đồng nghĩa bảo mật per-employee, và `pos-cafe-context.md` ghi rõ không claim bảo mật nhân viên ở tầng database, kèm ghi chú cần siết nếu triển khai ngoài môi trường demo tin cậy.

Nghĩa là một người có Store Key và biết cách gọi thẳng vào database vẫn đọc và ghi được dữ liệu vượt quyền của mình. Với một quán thật, và với các tính năng sắp thêm như tồn kho, khuyến mãi, chấm công và loyalty, khoảng trống này trở thành rủi ro thật chứ không còn là giới hạn học thuật.

## What Changes

- Thiết lập danh tính phiên gắn với nhân viên đang đăng nhập, thay vì chỉ gắn với cửa hàng.
- Đưa việc kiểm tra quyền vào chính sách bảo mật mức dòng và các lời gọi phía database, thay vì chỉ ở tầng nghiệp vụ.
- Rà toàn bộ bảng và lời gọi hiện có, xác định thao tác nào phải bị chặn theo quyền nhân viên.
- Bổ sung dấu vết kiểm toán cho các thao tác nhạy cảm, tối thiểu là ai làm và lúc nào.
- Cập nhật tuyên bố NFR-02 trong tài liệu cho khớp mức bảo đảm mới.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `access-control`: nâng mức bảo đảm từ chốt ở tầng nghiệp vụ lên enforce ở tầng database cho quyền theo từng nhân viên.
- `store-isolation`: đổi phạm vi hiện tại của mô hình cô lập, vốn đang ghi rõ không cô lập giữa các nhân viên trong cùng cửa hàng.
- `employee-session`: có thể đổi cách thiết lập phiên nếu danh tính database phải gắn với nhân viên.

## Impact

- Chính sách bảo mật mức dòng trên toàn bộ bảng nghiệp vụ, kéo theo migration lớn.
- Cơ chế xác thực: hiện thiết bị xác thực theo cửa hàng, cần bổ sung lớp danh tính nhân viên.
- Mọi lời gọi phía database hiện có.
- Nguy cơ cao làm hỏng luồng đang chạy nếu thiếu sót một bảng hoặc một lời gọi, nên cần bộ kiểm thử tốt trước khi làm.
- Cập nhật `docs/requirements.md` (NFR-02), `docs/architecture.md`, `docs/limitations.md`, `pos-cafe-context.md`.

## Ngoài phạm vi

- Thiết kế lại mô hình quyền và vai trò. Việc đó thuộc `redesign-permission-model`.
- Nhật ký kiểm toán đầy đủ dạng báo cáo cho người dùng cuối.
- Mã hóa dữ liệu và các yêu cầu tuân thủ khác.

## Phụ thuộc

- `redesign-permission-model`: phải chốt mô hình quyền trước, nếu không sẽ phải viết lại chính sách database hai lần.
- `expand-e2e-coverage`: cần bộ kiểm thử luồng nghiệp vụ trước khi đụng vào chính sách bảo mật, vì sai sót ở đây làm hỏng toàn bộ ứng dụng.
- `add-owner-account-and-store-provisioning`: change đó bổ sung một nhánh chủ sở hữu vào chính sách bảo mật mức dòng. Nếu làm sau change này thì phải rà lại toàn bộ chính sách vừa viết, nên nên làm trước.

## Ghi chú về phương án thu hẹp

Trao đổi ngày 2026-08-28 nêu một phương án trung gian đáng cân nhắc khi trả lời câu hỏi số 1 và số 7: **giữ nguyên danh tính cấp cửa hàng, không làm danh tính riêng cho từng nhân viên, nhưng bắt mọi lời gọi nghiệp vụ nhạy cảm đọc lại quyền hiệu lực từ database** thay vì tin tham số client gửi lên, kèm nhật ký đầy đủ. Cách này đã áp dụng cho ba lời gọi order và payment chính, nên chỉ là mở rộng phạm vi chứ không phải đổi mô hình xác thực.

**Đính chính 08/09/2026:** bản trước ghi phương án này chặn được “lời gọi thủ công có tham số giả”. Khẳng định đó quá rộng: server hiện đọc quyền của `p_employee_id` client gửi (`src/adapters/supabase/authRepo.ts:19–25`, `src/adapters/supabase/employeeRepo.ts:30–39`, `supabase/migrations/012_action_permission_guardrails.sql:1024–1045`). Đọc role từ DB chặn việc tự khai role/quyền không có trong DB, nhưng không chứng minh caller chính là nhân viên mang ID đó. Xem trích mã tại [08, E5](../../../docs/reviews/2026-09-07-idempotency/08-review-doc-lap-plan-07.md#e5--danh-tinh-nhan-vien-va-duong-ghi).

Đánh đổi đúng: phương án giữ danh tính cửa hàng có phạm vi nhỏ hơn, nhưng không chống giả mạo ID nhân viên hoặc ghi thẳng bảng qua quyền cửa hàng. Nó không đủ để hoàn thành yêu cầu mới “server xác minh quyền thực tế của người tiếp tục” nếu không bổ sung ràng buộc danh tính server đáng tin cậy.

## Câu hỏi phải chốt trước khi làm

1. Đây có phải việc cần làm thật không, hay chấp nhận giữ nguyên và ghi rõ trong báo cáo là giới hạn đã biết? Phạm vi việc này lớn và rủi ro cao; nếu hệ thống chỉ dùng để demo và bảo vệ đồ án thì có thể không đáng.
2. Nếu làm thì mô hình danh tính nhân viên ở tầng database là gì? Mỗi nhân viên có một tài khoản xác thực riêng, hay dùng token phiên mang theo định danh nhân viên? Hướng thứ nhất đổi hẳn luồng đăng nhập bằng PIN hiện tại.
3. Nếu mỗi nhân viên có tài khoản riêng thì luồng Store Key kèm chọn nhân viên và nhập PIN có còn giữ không? Đây là điểm nhận diện của sản phẩm, đổi đi sẽ ảnh hưởng trải nghiệm thu ngân.
4. Mức bảo đảm cần đạt tới đâu: chặn ghi vượt quyền là đủ, hay phải chặn cả đọc? Chặn đọc chặt hơn nhưng có thể làm hỏng các màn tổng hợp như báo cáo.
5. Có chấp nhận thay đổi phá vỡ tương thích với các thiết bị đã ghép không? Việc đổi mô hình xác thực có thể buộc ghép lại toàn bộ thiết bị.
6. Dấu vết kiểm toán cần lưu những gì và giữ bao lâu?
7. Nếu không làm toàn bộ, có muốn làm một phần không, ví dụ chỉ siết các thao tác đụng tới tiền là thanh toán, hủy đơn và sau này là hoàn tiền cùng giảm giá?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
