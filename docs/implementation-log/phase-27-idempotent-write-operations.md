# Phase 27 — Ghi POS chống trùng và khôi phục từ server

Ngày cập nhật: 2026-09-10. Change: `add-idempotent-write-operations`.

## Trạng thái và phạm vi bằng chứng

Chủ dự án đã duyệt spec và cho phép triển khai, push docs trước, chỉ push code sau khi các cổng kiểm thử và đánh giá độc lập đạt. Bộ docs được push tại `docs@0ecf84d`. Mã triển khai đã commit và push tại `main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9`, phát triển từ `7183b31`. Các cổng tự động và ba review độc lập đã đạt; chưa triển khai migration lên môi trường thật.

Tài liệu này ghi hiện trạng bản triển khai để làm nguyên liệu báo cáo. Kết quả nghiệm thu bên dưới có fingerprint và metadata của cùng bản mã; không suy rộng sang cloud hoặc triển khai thật. Báo cáo các phase trước được giữ như biên bản lịch sử; các mô tả cũ về replace-submit, PIN chỉ ở client và RPC ghi trực tiếp được thay thế bởi thiết kế của phase này khi bản triển khai được phát hành.

## Mục tiêu và hành vi

Một đơn được hệ thống công nhận khi server đã ghi nhận. Bản nháp chưa gửi chỉ ở bộ nhớ giao diện; mất bản nháp không được diễn giải là mất đơn đã lưu. Khi một lần ghi bị mất phản hồi, thu ngân tra cứu mã thao tác trên server, xem kết quả cũ và trạng thái đơn hiện tại riêng biệt. Người có quyền hiện hành có thể tiếp quản bằng phiên của chính mình; không cần biết dữ liệu local hoặc PIN của người tạo lệnh.

Giao thức có hai bước: `register_write_operation` giữ mã thao tác K và payload bất biến; `execute_write_operation` thực hiện chính payload ấy. Cùng K khác payload bị từ chối. K đã hoàn tất trả lại kết quả R1 được lưu, không thực hiện thêm nghiệp vụ. Bấm thử lại không tạo payment ID mới, không lấy version mới từ polling và không biến một thanh toán tách thành thanh toán toàn bộ.

Phần mềm chỉ ghi giao dịch tiền mặt và trạng thái server. Việc đếm, nhận hoặc hoàn tiền mặt là trách nhiệm con người; không có xác nhận tiền vật lý từ phần cứng hay nhà cung cấp thanh toán. Dấu vết người khởi tạo, người thực hiện, thời điểm và kết quả được giữ để tra cứu.

## Quyết định và lý do

| Quyết định | Lý do và hệ quả |
| --- | --- |
| Chỉ ưu tiên online | Không xây outbox hay đồng bộ xung đột đa thiết bị. Kết nối lại không tự gửi lệnh cũ; người dùng chủ động tra cứu và tiếp tục. |
| Server là nguồn tin cậy | Mất local hoặc đổi máy vẫn lấy lại được đơn và lệnh đã đăng ký trên server. Chưa đăng ký trên server thì không hứa khôi phục. |
| Pending có hiệu lực 24 giờ | Giới hạn thời gian còn được thực hiện một xác nhận cũ. Đây không phải hạn dùng của đơn: bàn quên thanh toán 1–2 ngày vẫn mở, có thể tạo xác nhận mới để thanh toán. |
| Không xóa ledger/R1/audit trong bản này | Lệnh hết hạn vẫn cần tra cứu. Không đặt việc chống ghi trùng phụ thuộc lịch dọn dẹp hay `pg_cron`. |
| Phiên nhân viên 12 giờ, chỉ giữ token trong bộ nhớ | Token xác minh quyền nhân viên ở server; tải lại/khóa máy cần nhập PIN. Store session và employee session là hai lớp khác nhau. |
| Giữ giá theo từng phần đã gọi | Hai ly A giá 30.000 đồng giữ 60.000 đồng; thêm một ly sau khi menu tăng 40.000 đồng tạo dòng mới, tổng 100.000 đồng. Modifier có giá riêng và nhân đúng số lượng của option. |
| Không sửa modifier của phần đã lưu | Đúng luồng sản phẩm hiện tại: chọn modifier khi thêm phần mới. Giảm số lượng/đổi ghi chú phần cũ giữ ID và snapshot cũ; nút cộng tạo phần mới theo cấu hình và giá hiện hành. |
| Phiếu bếp chỉ giữ seam hiện có | Chưa có bếp vận hành; không hứa khôi phục đúng phiếu bếp của một lần gửi bị mất phản hồi. Không tự in lại khi replay hoặc phục hồi. |

## Cấu trúc mã và dữ liệu

| Thành phần | Hiện thực và vai trò |
| --- | --- |
| Hợp đồng | `src/domain/writeOperations.ts`, `src/ports/index.ts`: payload có phiên bản, operation/result/session và port ghi riêng. |
| Validation | `src/core/writePayload.ts`: UUID không nil, kiểm required/null/unknown field, giới hạn tiền/số lượng/Unicode/JSONB 262.144 byte; `writeErrors.ts` chứa mã và thông báo tiếng Việt. |
| Danh tính và ledger | Migration 014: `private.employee_sessions`, hash token, RPC PIN/admin/bootstrap, `write_operations`, `order_events`, trường creator/last modifier, receipt snapshot. |
| Nghiệp vụ | Migration 015: kiểm source item, giữ giá từng phần, split copy/move, số đơn, payment/receipt. Helpers private không được gọi trực tiếp bằng client role. |
| Điều phối và activation | Migration 016: khóa theo thứ tự, kiểm quyền/đồng hồ sau khi chờ, transaction nghiệp vụ + event + trạng thái lệnh; thu hồi mọi overload RPC ghi cũ và quyền DML tài chính. |
| Supabase adapter | `employeeCredential.ts`, `client.ts`, `employeeRepo.ts`, `writeOperationRepo.ts`: credential trong bộ nhớ, header chỉ gửi tới REST đúng origin, chuẩn hóa Employee DTO và lỗi. |
| UI | `writeOperationFlow.ts`, `WriteLifecycle.tsx`, `WriteRecoveryDrawer.tsx`: đóng băng xác nhận, timeout 15 giây, vô hiệu phản hồi đến muộn, tra cứu/tiếp quản/hủy pending. |
| Điều hướng và hóa đơn | `drawerNavigation.ts`, `useViewLifetime.ts`, `ReceiptPreview.tsx`: xác nhận bỏ nháp, ngăn đọc muộn mở lại thao tác, giữ metadata/giá/số lượng từ receipt snapshot. |

Điểm kiểm nguồn: `014_write_identity_and_ledger.sql:162` định nghĩa bảng phiên; `:247` bootstrap; `:322` bổ sung metadata đơn; `:330` ledger; `:355` event. `016_activate_write_protocol.sql:237` giữ `clear_demo_data` ngoài bảng tài chính; `:258` thu hồi DML; `:264` duyệt toàn bộ overload cũ. Số dòng áp dụng cho bản đang nghiệm thu và sẽ đối chiếu lại khi chốt SHA code.

## Kiểm thử và lỗi đã tìm được

Spec có 33 requirement, 12 use case và 93 TC gốc. Manifest hiện mở rộng thành 669 lượt bắt buộc; sáu biến thể TC088 đều được yêu cầu riêng để không thể chạy một mutant rồi báo cả nhóm đạt.

Các tầng bằng chứng được tách rõ:

- Unit/component và mock xác minh flow, lựa chọn, giá, thông báo và số lần gọi; không thay thế DB.
- DB contracts gửi request HTTP qua PostgREST với Store JWT và employee token; observer PostgreSQL riêng đọc dữ liệu thật, khóa, PID và rollback.
- E2E chạy browser với GoTrue/PostgREST/PostgreSQL thật tại loopback. Môi trường này không có Storage API và Realtime service; không dùng kết quả ấy để tuyên bố đã kiểm cloud hay hai dịch vụ này.
- Native SQL supplement và reviewer SQL dùng PostgreSQL thật nhưng dựng request GUC/Auth shim; báo riêng với HTTP/JWT/E2E.
- Mutation tests sao chép source vào thư mục cách ly. Mỗi bản gốc phải đạt oracle; mỗi bản lỗi phải thất bại bằng assertion được chọn. Lỗi biên dịch, không tìm thấy test hoặc timeout không được tính là đã bắt được mutant.

Trong lúc nghiệm thu đã tìm và sửa: phản hồi tải đơn muộn có thể dẫn tới hủy sau khi đóng màn; nút cộng chưa kiểm group modifier đã gỡ hoặc required/single mới; mock trả sai mã lỗi modifier; DTO quyền `{}` làm giao diện lỗi; cổng kết quả có thể nhận expected-failure/retry là pass; thiếu đối chiếu một số dữ liệu raw DB; thiếu lưu bằng chứng PID/transaction. Các sửa đổi phải có kiểm tra hồi quy trước khi đóng change.

Kết quả cuối ngày 2026-09-10: **548 unit/component + 415 DB contracts + 37 tooling + 34 E2E = 1.034 test PASS**. Đủ **669/669 execution bắt buộc**, không thiếu/trùng/sai backend/skip/flaky. Bốn report cùng fingerprint `f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915`; verifier chạy lại sau commit vẫn valid. Những lượt đạt trước khi source đổi được giữ như tiến độ, không ghép thành kết quả cuối.

Build TypeScript/Vite PASS; coverage phần logic nghiệp vụ **92,53% dòng (744/804)**, vượt ngưỡng 90%. Mock smoke **35 pass, 31 tổ hợp viewport loại theo thiết kế nền, 0 fail/flaky**; các skip này không nằm trong manifest chống trùng. Build vẫn cảnh báo chunk lớn hơn 500 KB. Không có đo tải sản xuất.

Ba reviewer độc lập chốt không còn finding mở trong scope; reviewer nghiệp vụ kiểm lại 11/11 hash code trùng bản đã review. Reviewer bảo mật tự chạy PostgreSQL thật với Auth shim, reviewer harness tự kiểm runner thật và sáu mutant; full E2E dùng GoTrue thật được báo riêng. Gói [bằng chứng tự chứa](phase-27-evidence/verification.md) có đủ 669 dòng actual/expected, provenance, hash và [ba báo cáo](phase-27-evidence/reviewer-1-business.md). Runtime tái dựng ở [tài liệu riêng](phase-27-test-runtime.md).

Triển khai và nghiệm thu code hoàn tất. Change được giữ tại đường dẫn hiện hành để tra cứu bộ spec đã duyệt; chưa archive/apply delta vào baseline specs trong lượt này. Trạng thái code đã push không đồng nghĩa migration đã chạy trên môi trường thật.

## Giới hạn còn giữ

Chưa có offline, kiểm két, hoàn tiền điện tử, price history của toàn bộ menu, kitchen queue, in native hoặc telemetry sản xuất. Receipt cũ chưa lưu metadata đầy đủ được đánh dấu legacy; creator cũ không biết thì để null, không gán giả. UI quyền có thể chậm cập nhật đến lần khóa/đăng nhập lại, còn server kiểm quyền hiện hành khi xử lý.

Kế hoạch rollout ở [phase-27-idempotency-rollout.md](phase-27-idempotency-rollout.md). Chạy migration trên môi trường thật là bước phát hành riêng; yêu cầu push code không tự đồng nghĩa cho phép sửa dữ liệu cửa hàng thật.
