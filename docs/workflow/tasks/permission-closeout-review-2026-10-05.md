# Rà điều kiện đóng task phân quyền — 05/10/2026

## Yêu cầu và phạm vi

- Chủ dự án yêu cầu đọc chat **“Hoàn thiện và triển khai phân quyền POS Cafe”** (`01a0ad45-789c-7913-94af-e301eaae3fe1`), xác định phần cần xử lý để đóng task rồi chuyển sang cách làm trong chat **“Đọc yêu cầu đồ án”** (`01a1051b-7d10-7f92-9bfa-910c1161b020`).
- Đã đọc thêm chat được task cũ tạo: **“Hoàn thiện công cụ phát hành an toàn”** (`01a0f038-130e-7330-a717-1aec0f776762`), gồm kết quả cuối ngày 01/10. Kết quả này mới hơn nhận định “phần 1 chưa hoàn tất” trong chat điều phối.
- Lượt này là khảo sát, đối chiếu source/evidence đã lưu và lập kế hoạch đóng task. Không phải yêu cầu tiếp tục toàn bộ triển khai. Giữ yêu cầu làm từng phần trong [checkpoint 28/09](../../implementation-log/permission-release-stop-2026-09-28.md).
- Không sửa application, chạy lại suite, kết nối live, dọn dữ liệu, cấp quyền, commit/push/deploy hoặc gửi lệnh sang chat khác trong lượt này. Hồ sơ này không tạo quyền cho bước kế tiếp.
- Rà điều kiện đóng task nhạy cảm: phân quyền, phiên nhân viên, tiền và migration dữ liệu. Hai reviewer độc lập kiểm source/evidence và phạm vi/quy trình trước bàn giao kết quả khảo sát.

## Nguồn được đối chiếu

- Main: `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479` cộng working tree chưa commit; giữ toàn bộ thay đổi và `pnpm-lock.yaml`.
- Docs: `D:/Workspace/pos-cafe-docs`, `docs@e47862b1dfed68d783dc07a2a1fd51ecdabc1b19` cộng thay đổi có sẵn. Không chuyển nhánh hoặc nhập code vào docs.
- [Bàn giao task](redesign-permission-model.md), [controller 01/10](../../implementation-log/permission-release-controller-2026-09-30.md), [review controller](../../reviews/2026-09-30-permission-release-controller.md), [checkpoint 28/09](../../implementation-log/permission-release-stop-2026-09-28.md).
- [Tasks phân quyền T15–T18](../../../openspec/changes/redesign-permission-model/tasks.md), [tasks forced-PIN](../../../openspec/changes/force-default-pin-change/tasks.md), [đối chiếu rubric](thesis-rubric-gap-review-2026-10-04.md).
- [Kết quả kiểm source/evidence ngày 05/10](D:/Workspace/pos-cafe/artifacts/permission-closeout-review-20261005/local-source-evidence-check.json). Đây là kiểm file/hash và đọc báo cáo đã lưu, không phải kết quả chạy lại test.

## Kết luận hiện trạng

**Checkpoint đóng task09/10:** [kế hoạch CLOSE-1→3](permission-closeout-execution-2026-10-09.md) ghi G2c đã đối chiếu exact candidate, scope sửa UI mới được user giao và gói nhóm chuẩn bị. Chốt coverage/blocker → nghiệm thu cùng nguồn → phát hành/postflight/bàn giao, có điểm kết thúc cụ thể. Task sản phẩm chưa đóng; các checkpoint bên dưới giữ lịch sử, không thay gate tổng hiện hành.

**Checkpoint readiness 08/10:** [runbook và kiểm local](permission-runbook-readiness-2026-10-08.md) đã phát hiện/sửa mock getter ảnh theo quyết định user, unit1.140/tooling70/build và mock smoke35PASS/31viewport skip đạt; UI audit FAIL33 ngoài baseline và mobile obstruction được lưu. Runbook nháp giữ gate/service/release mở; evidence controller/provider lịch sử không được nâng thành gate source mới. Nội dung05/10 phía dưới giữ vai trò lịch sử.

**Checkpoint Vercel 07/10:** [inventory chỉ đọc](../../implementation-log/vercel-binding-inventory-2026-10-07.md) qua Dashboard đã login xác minh đúng repo/project/domain/Production `main@ef2c372...`, auto-assign bật, build overrides phù hợp source. Ba env Secret có tên/phạm vi nhưng giá trị và backend binding chưa kiểm. Đã có kênh đọc UI, chưa chứng minh quyền deploy/capability hay gate tổng; [handoff](vercel-binding-inventory-2026-10-07.md) giữ việc tiếp theo là runbook/gate mapping, thứ tự backend trước frontend và auto deploy. Các kết quả05/10 bên dưới giữ checkpoint lịch sử.

**Task sản phẩm chưa đủ điều kiện đóng; phần công cụ đã được bàn giao local có điều kiện.** Không cần viết lại controller hoặc lặp công việc backup/restore đã có bằng chứng chỉ để bắt đầu phiên mới.

Kiểm ngày 05/10 cho thấy fingerprint hiện tại vẫn là `fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef`, đúng candidate controller 01/10. Manifest 704 đường dẫn không có sai khác; snapshot còn tồn tại; hash báo cáo tooling, manifest source và restore comparison đều khớp. 129 file trong manifest runtime evidence còn khớp hash.

| Phần | Bằng chứng đang có | Điều kiện còn thiếu |
| --- | --- | --- |
| Controller cleanup + activation | 34/34 tooling; fault matrix 15/15; legacy bootstrap, hủy harness, COMMIT thật rồi mô phỏng lỗi ACK; hai reviewer APPROVE đúng phạm vi local | Diễn tập dùng hai capability bổ sung trong clone; chưa chứng minh actor/cơ chế DDL của đích hosted |
| Backup và rollback | Restore 74/74; backup logic 62 bảng/3 sequence; ảnh restore/readback có proof riêng; giữ 66 Auth users ngoài scope và Storage metadata theo snapshot | Fresh kiểm đích và binding/scope/digest trước phát hành; số lượng cũ không thay UUID/dữ liệu đối chiếu dưới khóa |
| Candidate sản phẩm và forced owner PIN | Có code/UI cùng kết quả từng slice trong hồ sơ 22–28/09 | Gate tổng trên source cuối, đầy đủ profile; review implementation cuối; không gán 1.139 test lịch sử cho toàn source fdedcfc |
| Images và TC44 | Images teardown đã review source; TC44 bốn ca runtime PASS từng lượt | Images focused service đã dừng vì fixture JWT; TC44 run2 guard/evidence còn thiếu verdict trong checkpoint; cần kiểm lại evidence phù hợp source cuối |
| Kênh phát hành | PostgreSQL từng kết nối TLS bằng credential đã lưu | Catalog tool của phiên rà này không có Supabase/Vercel; chưa chứng minh kênh Edge/Storage deploy hiện hoạt động. Không kết luận project hỏng hoặc OAuth hết hạn chỉ từ tool vắng |
| Bản live | Đích được duyệt trước đó là `pos-cafe-azure.vercel.app` và Supabase `kfqjdfwxhkdwihjobpny` | Chưa có release/postflight của candidate; chưa kiểm lại live trong lượt này |

Actor gốc trong clone bị từ chối khi đặt `pgrst.db_pre_request` và sửa policy `storage.objects`. Hai augmentation diagnostic là SET parameter và membership owner Storage; membership rộng hơn quyền sửa một policy. Logical restore không tái tạo toàn bộ hook/provider configuration. Vì vậy chưa thể kết luận live cần đúng hai grant này. [Guard controller](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:347) kiểm capability và dừng trước prepare khi thiếu; không tự cấp quyền hoặc đổi actor.

## Các gói còn lại để đóng task

Các gói dưới đây là kế hoạch thực hiện riêng; lượt rà không chọn hay chạy thay chủ dự án. Duy trì thứ tự dependency. Gói 2 có thể khảo sát fixture/evidence độc lập khi gói 1 chưa xong; khóa source cuối sau các sửa cần thiết của gói 1.

| Gói | Công việc cụ thể | Đầu ra và điều kiện kết thúc |
| --- | --- | --- |
| **1 — Chốt quyền và kênh triển khai** | Đọc quyền thật của actor đúng project; kiểm parameter ACL/effective Storage owner capability/provider configuration; xác minh kênh triển khai DB, Edge và Storage. Chọn cơ chế DDL được hỗ trợ nếu actor hiện tại không đáp ứng | Báo cáo chỉ đọc đúng đích; cơ chế deployment có thể kiểm chứng và rehearsal tương ứng. Nếu cần thay quyền, actor hoặc atomic transaction, trình quyết định có phạm vi cụ thể và review trước mutation; không copy grant local lên live |
| **2 — Đóng kiểm thử cùng review cuối** | Kiểm marker/lease rồi refresh đúng fixture identity; chạy images/cleanup guard; hoàn tất review TC44 run2. Freeze source, chạy gate T15/T16 và PIN-T06: unit/build, SQL/Auth/REST, Storage/Edge, Realtime, browser, migration/compatibility/rollback, tổng hợp TC và forced-PIN | Báo cáo strict cùng fingerprint/profile phù hợp, không thiếu variant/skip/retry/expected-failure. Hai reviewer khác scope APPROVE toàn candidate cuối. UI audit theo quy trình, giữ các lỗi đã được hoãn và không đổi baseline để che lỗi |
| **3 — Đóng gói và phát hành** | Hoàn thiện runbook/evidence T17; phân loại đúng file, commit code/docs riêng, không gom file ngoài phạm vi; kiểm auto-deploy trước push. Fresh preflight, recheck đúng 77 UUID và full-row digest dưới khóa; backup/proof còn phù hợp. Atomic cleanup + empty activation theo cơ chế đã chốt; xử lý đúng hai ảnh qua Storage API/journal sau DB commit; triển khai Edge/frontend phối hợp | Bản live đúng source/client/DB/contract/catalog. Postflight/smoke có bằng chứng đúng môi trường: tạo quán/ép đổi PIN, các vai trò và deny, gọi món/thanh toán/khôi phục K, đa thiết bị/thu hồi quyền, ảnh/in. Không chạy suite reset/seed lên đích. Drift phải dừng và đối soát, không xóa thêm ngoài allowlist |
| **4 — Bàn giao và đóng hồ sơ** | Đồng bộ tasks/docs/features/testing/limitations theo evidence thật; cung cấp walkthrough các luồng chính; ghi phản hồi/nghiệm thu riêng; lập phần tồn sang task UI. Giữ bản sao proof/credential ngoài Git | Phân biệt đã hiện thực, đã kiểm, sẵn sàng nghiệm thu/đã nghiệm thu và đã phát hành. Không gọi toàn task đã hoàn tất trước gate/release; không tự ghi chủ dự án đã hiểu hoặc chấp nhận code |

Đề xuất bước kế tiếp là **gói 1**, vì đây là blocker quyết định tính khả thi phát hành, và đầu ra đầu tiên chỉ cần đọc đúng đích. Khôi phục MCP là một vấn đề kênh công cụ; không cần viết lại chức năng để chữa việc tool không được nạp. Nếu có kênh triển khai khác phù hợp, phải xác minh và ghi rõ thay vì giả định MCP là cách duy nhất.

## Phạm vi chuyển sang cách làm của nhóm

Chat **“Đọc yêu cầu đồ án”** biết nhóm có ba người: chủ dự án đọc được code; hai thành viên còn lại chưa biết code nhưng dùng được AI theo lệnh được giao. Khuyến nghị trong chat là gói việc nhỏ, một người chịu trách nhiệm, tự kiểm trước PR, chủ dự án review và kiểm tích hợp. Chưa có danh tính thành viên, assignment cụ thể hoặc quyết định nhận mọi đề xuất rubric.

- Phần quyền/tiền/database và tích hợp còn lại tiếp tục do chủ dự án phụ trách cùng AI. Không giao nguyên khối còn dở cho thành viên chưa đọc được code.
- Sau baseline đã phát hành và ghi rõ, có thể giao thành viên 2 một sửa UI đã được xác định, theo một màn/thành phần; thành viên 3 một gói kiểm thử thủ công/thu minh chứng. Đây là cách phân công đề xuất, chưa phải assignment đã duyệt.
- Mỗi gói cần mục tiêu, phạm vi file, acceptance criteria, điều kiện lỗi, lệnh tự kiểm, evidence, nhật ký AI, PR bằng tài khoản người thực hiện và phần giải thích được. Chủ dự án kiểm tích hợp sau tự kiểm; không tạo lịch sử commit giả cho code đã có.
- Các lỗi UI layout/checkbox/font/contrast đã được chủ dự án hoãn sang task sau. Giữ quyết định này; phát hiện mới làm hỏng chức năng bắt buộc phải xử lý theo tác động thực tế.
- Tài khoản chủ qua email/khôi phục/chuyển chủ, thiết kế lại bốn màn POS, CI/CD đầy đủ, khảo sát người dùng và các mục rubric khác thuộc kế hoạch tiếp theo. Không thêm chúng thành điều kiện đóng task phân quyền hiện tại. Tuy vậy phải đóng gói code hiện tại và giữ evidence thật để kế hoạch mới có baseline có thể chia việc.

## Kiểm chứng và giới hạn lượt rà

- Đã đọc hai chat chỉ định và kết quả chat controller liên quan; chỉ đọc, không gửi tin nhắn cho các chat.
- Đã đối chiếu source manifest, snapshot, 129 runtime evidence hashes, báo cáo tooling và restore comparison; lưu receipt không secret ở artifact được liên kết phía trên.
- Chưa chạy lại test, dựng runtime, kiểm quyền/data live hoặc kiểm byte bản đã deploy. Số 34/15/74 là evidence lịch sử có hash khớp, không phải số test mới chạy ngày 05/10.
- Hồ sơ cũ có checklist chưa đóng và đoạn mô tả cũ, ví dụ “runtime forced-PIN NOT RUN”. Dùng checkpoint mới hơn để xác định evidence từng slice; chỉ cập nhật checklist hoàn tất khi gate tương ứng thực sự đạt.
- Review lượt rà: hai reviewer độc lập **APPROVE** gói khảo sát ngày 05/10; phạm vi, candidate hashes và đề xuất không chặn tại [biên bản review](../../reviews/2026-10-05-permission-closeout-review.md). Approval khảo sát không thay approval phát hành. Sau review chỉ bổ sung metadata verdict/link này.
- Trạng thái sản phẩm: **chưa đủ điều kiện đóng; chưa phát hành candidate**. Trạng thái lượt khảo sát ghi riêng sau review.
- Trạng thái lượt khảo sát: **hoàn tất trong phạm vi đã giao**; kế hoạch gói 1–4 chưa được thực hiện trong lượt này.
