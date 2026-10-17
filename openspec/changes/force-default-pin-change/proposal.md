# Bắt buộc owner đổi PIN tạm

Đề bài ngày **2026-09-22**. Chủ dự án giao change này **trước khi phát hành** `redesign-permission-model`, giới hạn **owner khi tạo quán và operator khôi phục PIN**. **Cập nhật08/10:** spec đã có review candidate02; code/test hiện thực liên quan đã có nhưng19TC còn variants/oracle/evidence thiếu, chưa đóng PIN-T06. [Matrix executable/evidence hiện hành](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) phân biệt focused PASS d1 lịch sử với current66 và các gap. Chưa nhận owner nghiệm thu, phát hành hoặc cleanup live.

## Why

PIN khởi tạo dùng chung `123456` chỉ nên cho owner bắt đầu đặt PIN riêng. Bản khảo sát trong spec22/09 ghi candidate lúc đó mở normal owner để seed sau bootstrap; đây là nhận định lịch sử, không mô tả current source đã có restricted session/workflow. Yêu cầu của change là server chặn quyền vận hành tới khi owner đặt PIN mới. [Matrix ngày08/10](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) dẫn code/test hiện hành và phần chưa chứng minh; [design](design.md) giữ bất biến/giải pháp đã chốt. Không dùng source line của checkpoint cũ làm bằng chứng hành vi hôm nay.

## What Changes

- Server quản lý `pinChangeRequired`; đúng PIN tạm chỉ mở phiên hạn chế 5 phút để đổi PIN, kiểm tra hiệu lực tối thiểu hoặc đăng xuất.
- PIN mới đúng 6 chữ số ASCII và khác PIN tạm hiện tại. Đổi nguyên tử với revision, thu hồi mọi phiên, audit; owner đăng nhập lại bằng PIN mới.
- Mỗi recovery mới đặt trạng thái tạm và thu hồi phiên, kể cả PIN không đổi. Replay recovery không ép đổi lần nữa.
- Tạo quán giữ Store Key qua unmount/compatibility gate; bổ sung retry cùng ngữ cảnh tạo quán sau mất ACK trong vòng đời ứng dụng. Hard reload vẫn mất bí mật chưa được người dùng lưu.
- Seed ban đầu dùng workflow server với ba receipt bền vững, chỉ chạy sau normal owner login, không chạy lại bước đã commit.
- Bổ sung activation đích rỗng và kiểm tra dưới khóa; không tạo owner/mapping giả để vượt công cụ.

## Capabilities và quan hệ với spec khác

Delta `employee-session`, `store-onboarding`, `employee-management` tại [spec](specs/employee-session/spec.md). Với owner có cờ tạm, change này thay hai phát biểu cũ tại [PERM-20/PERM-21](../redesign-permission-model/specs/employee-session/spec.md): đúng PIN luôn nhận phiên 12 giờ/authority; không làm forced-default-change. Normal session, self-PIN no-op thông thường, non-owner reset, email recovery và 15 quyền giữ nghĩa đã chốt. PERM-22 áp dụng thêm transition PIN-04.

## Ngoài phạm vi

Chống dò PIN, blacklist PIN yếu, ép đổi non-owner, email owner/provisioning, mở quyền reset owner cho app, khôi phục Store Key sau mất bộ nhớ và backfill quán cũ ở môi trường khác. Không dùng phần hoãn để trì hoãn bất biến chặn quyền của scope đã chọn.

## Phụ thuộc và tác động

Triển khai trên candidate permission identity/guards, không cài riêng trước permission model. Phải đồng bộ schema, DTO, mock/Supabase, onboarding, seed, compatibility, tests và activation trong cùng candidate. Đây là dependency phát hành permission model. [Owner account tương lai](../add-owner-account-and-store-provisioning/proposal.md) có thể bỏ cấp PIN tạm lúc tạo quán nhưng phải giữ cờ khi recovery còn cấp credential tạm.

## Câu hỏi phải chốt trước khi làm

**Không còn câu hỏi nghiệp vụ chặn scope này ngày 22/09.** Lựa chọn kỹ thuật của AI dưới đây vẫn phải review/kiểm chứng; phát hiện đổi nghiệp vụ hoặc quyền thì mở lại đúng phần.

| Câu hỏi lịch sử 12/09 | Kết luận hiện hành 22/09 |
| --- | --- |
| Áp cho ai? | Owner tạo quán và recovery, không mở rộng nhân viên thường |
| Cấp phiên khi nào? | AI chọn phiên hạn chế; normal login sau đổi PIN |
| Quy tắc PIN? | Đúng 6 chữ số ASCII, khác PIN tạm, không blacklist |
| Reset hộ có ép đổi? | Có cho owner recovery; non-owner giữ nguyên |
| Dữ liệu cũ? | Đã duyệt dọn 77 quán TEST tại đích; activation đòi rỗng; môi trường khác chưa có backfill |
| Chống thử sai? | Ngoài change |

## Quyết định đã chốt

| Mã / ngày / nguồn | Quyết định và lý do | Phương án khác, hệ quả |
| --- | --- | --- |
| PIN-D00, 12/09, chủ dự án sau phản biện giảng viên | Bắt buộc quản trị đổi PIN trước vận hành; giữ lịch sử định hướng | Lời nhắc tự đổi không bảo đảm chặn quyền |
| PIN-D01, 22/09, chủ dự án: “Làm bắt buộc đổi PIN trước khi phát hành” | Hoàn tất trước release permission model | Không phát hành rồi bổ sung; chưa phải bằng chứng hoàn tất |
| PIN-D02, 22/09, chủ dự án chọn “Owner khi tạo quán và khôi phục PIN” | Chỉ owner, PIN 6 số và khác PIN tạm | Không mở rộng mọi nhân viên; người đặt PIN hộ non-owner vẫn biết PIN đó |
| PIN-D03, 22/09, AI chọn kỹ thuật, chờ review | Purpose riêng TTL 5 phút, proof-only check, đổi nguyên tử rồi login lại | Đường chưa có phiên cần xác thực khác; tự chuyển normal dễ giữ authority cũ |
| PIN-D04, 22/09, AI chọn kỹ thuật, chờ review | Workflow seed bền vững, receipts/IDs từng stage; auto một lần, explicit retry sau gián đoạn | Chạy lại RPC hiện có có thể reset cashier/ghi đè chỉnh sửa; transaction seed lớn tăng phạm vi khóa |
| PIN-D05, 22/09, AI chọn kỹ thuật, chờ review | Context memory-only trước allocation/Auth/bootstrap; stable retry; cảnh báo hard reload trước tạo và ACK đã lưu Key | Persist bí mật trái quy ước; chưa hứa recovery Key sau hard reload |
| PIN-D06, 22/09, DELIVERY-03 do chủ dự án duyệt | Được xóa 77 quán TEST và dữ liệu liên quan tại đích đã xác minh; activation sau backup/cleanup và locked recheck | Không xóa project/schema/config hoặc 66 Auth/1 Storage không liên quan đã kiểm kê; đối tượng phát sinh ngoài allowlist phải dừng |
| PIN-D07, 11/10, chủ dự án trong TC18 | Thêm UI recovery **công cụ operator riêng, local-only**, backend giữ credential PostgreSQL; POS/app role vẫn không gọi được recovery. Chủ dự án lần lượt cho sửa đúng các câu `ENTITY_ID_CONFLICT`, `ADMIN_REQUEST_REUSED` và `INVALID_EMPLOYEE_REQUEST / payload khác` theo bảng design. | Không thêm màn POS hoặc grant cho app; thêm bề mặt vận hành cục bộ và kiểm xác thực/CSRF/secret. Cần chứng minh bằng test trước khi dùng trên đích thật; quyết định không cấp quyền deploy. |
| PIN-D08, 12/10, chủ dự án: “ok làm đi” sau báo cáo SEC-01/02 source-20 | Sửa oracle TC18 trên candidate mới: quét PIN thực đã gửi, đọc artifact thực và output sau runner; thêm đối chứng rồi kiểm/review tuần tự. AI chọn ledger control tạm ngoài output, xóa sau kiểm; đọc bytes và JSON đã decode; hai subscription TC18 dùng replication readiness giống adapter hiện có. | Quét chuỗi tự dựng không chứng minh output thực. Giữ source-20 FAIL lịch sử, không ghép fingerprint thành full PASS. Sửa harness và chạy local, không đổi nghiệp vụ, tiêu chí hoặc cấp quyền phát hành. |

## Hồ sơ và trạng thái

[Use cases](usecases.md) · [Design](design.md) · [Test plan](testplan.md) · [Truy vết](traceability.md) · [Tasks](tasks.md) · [Bàn giao chung](../../../docs/workflow/tasks/redesign-permission-model.md). Hai reviewer bắt buộc kiểm server/security và onboarding/testability; tất cả phải APPROVE candidate cuối. Hồ sơ chung ghi verdict; đủ bảy file không có nghĩa đã triển khai/kiểm thử.
