# Thiết kế lại mô hình phân quyền người dùng

Ngày 2026-09-22. **UI đã tích hợp vào candidate; tính năng chưa qua gate tổng và chưa phát hành.** T01–T07 và các slice UI/service có bằng chứng cách ly riêng; chưa chứng minh bản đang triển khai. Chủ dự án yêu cầu làm trọn luồng trên `https://pos-cafe-azure.vercel.app`, Supabase `kfqjdfwxhkdwihjobpny`. Yêu cầu giữ dữ liệu ngày17/09 được thay trong phạm vi77 quán test hiện có bằng DELIVERY-03 ngày22/09 bên dưới. Xem [bàn giao triển khai trọn luồng](../../../docs/workflow/tasks/redesign-permission-model.md) và [checkpoint kiểm chứng](../../../docs/implementation-log/permission-completion-2026-09-22.md).

## Why

Code hiện có ba role và năm quyền hành động tại [models.ts:1](D:/Workspace/pos-cafe/src/domain/models.ts:1), cùng hai bảng quyền module/action tại [guards.ts:26](D:/Workspace/pos-cafe/src/core/guards.ts:26). Quản trị còn kiểm role admin tại [adminFlow.ts:55](D:/Workspace/pos-cafe/src/features/admin/adminFlow.ts:55). Cách này không biểu diễn được nhân viên chỉ quản lý thực đơn hoặc chỉ xem báo cáo mà không nhận thêm quyền khác.

Sau phase 27, không còn đúng nếu nói toàn bộ quyền chỉ là snapshot đăng nhập: [014:179](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:179) xác minh phiên nhân viên, [016:56](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:56) kiểm quyền hiện hành sau chờ khóa, và financial DML/RPC cũ đã bị thu hồi tại [016:258](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:258). Tuy nhiên đường đọc báo cáo vẫn SELECT orders/items tại [reportRepo.ts:11](D:/Workspace/pos-cafe/src/adapters/supabase/reportRepo.ts:11), quản trị và Storage chưa theo catalog nhân viên mới. Change này hoàn tất ranh giới đọc/ghi cho **15 quyền**, không chỉ ẩn UI.

## Baseline và bằng chứng

| Thành phần | Mốc đã đối chiếu | Giới hạn kết luận |
| --- | --- | --- |
| Code main | `ef2c372aec60d8362549e47b7aedb27126129479`; application commit trước đó `8ed7418573fe88e27796d3b09807a3c55db4d0d6` | Không reset về mốc cũ, không sửa code trong task spec |
| Docs | HEAD `f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` cộng working tree có sẵn | [Khảo sát/baseline](../../../docs/reviews/2026-09-14-permission-model/01-khao-sat-va-cau-hoi.md) ghi diff/hash đã bảo toàn |
| Phase 27 | [Release check 14/09](../../../docs/implementation-log/phase-27-release-check-2026-09-14.md), [timeout follow-up](../../../docs/implementation-log/phase-27-timeout-followup-2026-09-14.md) | Frontend đã xác minh triển khai; business smoke cửa hàng thật chưa chạy; change chưa archive |
| Runtime kiểm thử | [Runtime WSL](../../../docs/implementation-log/phase-27-test-runtime-wsl.md) | Không có Storage API/Realtime thật trong runtime đó. Không dùng kết quả lịch sử làm test vừa chạy |

Khảo sát nguồn và phân loại đã có/thay đổi/giữ nguyên/ngoài phạm vi nằm trong báo cáo trên. Bộ spec áp trên code sau 014–016; khi đồng bộ baseline OpenSpec, phải áp các delta phase 27 trước rồi delta này, không sửa các biên bản phase 27 đã đóng.

## What Changes

- Catalog dữ liệu chung cho role, permission, mặc định và module; năm role dữ liệu, bốn role đang dùng. Không thêm custom role.
- Catalog 15 quyền trong [access-control delta](specs/access-control/spec.md); `floor.view` là quyền nền của mọi role đang dùng; `receipt.reprint` độc lập quyền lịch sử.
- Một owner active duy nhất/store; chống tăng quyền theo tập quyền actor/target trước và sau; quyền quản trị nhân viên và chỉnh overrides tách biệt.
- Server bảo vệ các projection đọc, RPC, DML, upload/delete ảnh thực đơn và dữ liệu Realtime liên quan. Store isolation không thay kiểm quyền nhân viên.
- Snapshot/revision quyền được làm mới bằng signal, focus/reconnect và một poll revision 30 giây ở tab hiển thị. Giữ session; xử lý nháp/cache/response muộn theo quyền bị thu hồi.
- Audit applied/denied/no-op và recovery có actor thật, append-only qua ứng dụng; quyền đọc và retention đã chốt.
- Migration có preflight/bridge/activation/rollback rõ; task code được chia theo cổng nghiệm thu.

## Capabilities

Không tạo module người dùng mới cho quản trị role hoặc audit. Delta gồm các capability hiện hữu:

| Capability | Phần thay đổi |
| --- | --- |
| `access-control` | Catalog, overrides, enforcement đọc/ghi, audit, migration và kiến trúc |
| `employee-management` | Owner, quản trị theo trường, trần quyền, tự quản trị, danh bạ |
| `employee-session` | Bootstrap authority snapshot, self-change PIN owner, revoke và recovery chuyển tiếp |
| `store-onboarding` | Tạo owner cùng store; không thêm owner email account |
| `multi-device-sync` | Revision, signal, fallback, cache, nháp và response muộn |
| `receipt-printing` | In lại cần quyền riêng, giữ in ban đầu và snapshot phase 27 |
| `write-idempotency` | Tác động quyền mới lên K; giữ bất biến và thứ tự kiểm hiện hành |

Thay đổi đọc lịch sử/báo cáo được quy định trong access-control, không sửa nghiệp vụ tính báo cáo, trạng thái đơn hoặc tiền. Mỗi delta chỉ sửa phần liên quan; các requirement khác của baseline giữ nguyên.

## Phạm vi và ngoài phạm vi

**Trong phạm vi:** đủ bảy loại artifact; kế hoạch code/DB/adapter/mock/UI/test cho catalog 15 quyền; đường đọc audit server; owner self-change PIN biết PIN cũ và quy trình recovery hạ tầng chuyển tiếp có audit. Cổng kỹ thuật dùng DB/service cách ly. Ngày17/09 chủ dự án yêu cầu nối UI và triển khai trọn luồng lên đích đã xác nhận, giữ nguyên dữ liệu hiện có; T18 thuộc đầu ra được giao sau khi đạt các gate, không còn chỉ là đề nghị cho một task chưa được phép.

**Ngoài phạm vi:** email owner account/OTP/Store Key rotation; custom role; quyền liên cửa hàng; giảm giá, chuyển/gộp bàn, tồn kho, hoàn tiền, ca làm; thiết kế lại UI toàn diện; giao dịch offline; máy in native hoặc đếm bản in vật lý; màn xem audit; audit toàn bộ hành động nghiệp vụ; cơ chế cấp trên nhập PIN duyệt tại chỗ; chống brute-force toàn hệ thống. Ép đổi PIN owner bootstrap/recovery là change riêng [force-default-pin-change](../force-default-pin-change/proposal.md), đã được giao ngày 22/09 và bắt buộc hoàn tất trước phát hành gói permission; không còn là phần có thể phát hành sau. Không thêm chức năng ứng dụng xóa toàn bộ dữ liệu; cleanup TEST theo DELIVERY-03 là runbook hạ tầng riêng.

Ngày 2026-09-12 đã chốt chuyển/gộp bàn và giảm giá sẽ làm ở các change riêng. Quyết định được giữ: chưa seed quyền của chúng trong catalog hoạt động. Ghi đè giá, hoàn tiền, mở ngăn kéo và quyền ca chưa làm trong khóa luận. `store.key.rotate` không phải quyền nhân viên theo quyết định 19 của [owner-account proposal](../add-owner-account-and-store-provisioning/proposal.md); không được thêm để giải thích con số 15.

## Phụ thuộc và ranh giới

| Change/mốc | Quan hệ |
| --- | --- |
| Phase 27 / `add-idempotent-write-operations` | Baseline bắt buộc. Giữ K, payload, R1, TTL 24h, current actor, revoke khi PIN/active đổi, khóa và quyền takeover theo action |
| `enforce-permissions-at-database` | Q1 chuyển phần đọc/ghi của catalog change này vào đây. Change kia chỉ còn phần ngoài inventory này; không yêu cầu triển khai trùng |
| `add-owner-account-and-store-provisioning` | Làm sau được; nối employee owner vào chủ email thật khi sẵn sàng. Trước đó recovery theo Q5/Q6, không giả email đã có |
| `force-default-pin-change` | Quyết định ngày 22/09: dependency bắt buộc trước T18, chỉ owner tạo quán/operator recovery; PIN mới 6 chữ số ASCII khác PIN tạm. Delta PERM-20/PERM-21/PERM-22 và onboarding/seed tại bộ bảy artifact riêng; normal self-PIN no-op/non-owner reset giữ nguyên. Chưa hiện thực, chưa kiểm runtime |
| `add-table-transfer-and-merge`, `add-manual-order-discount` | Dùng catalog mở rộng sau này; không seed quyền sớm |
| `redesign-pos-ui` | Dùng guard/projection mới, không chờ đổi toàn bộ layout để thực hiện bảo vệ quyền |
| `add-modifier-link-realtime-subscription` | Giữ cải thiện đồng bộ join table theo change riêng; migration [008:54](D:/Workspace/pos-cafe/supabase/migrations/008_modifier_rework.sql:54) đã có publication nhưng [adapter:24](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:24) chưa subscribe. Change này bảo toàn topic hiện có, giữ manual reload/reconnect cho chỉ gắn/bỏ nhóm; change sau dùng signal tối thiểu, không mở raw protected publication |

## Câu hỏi phải chốt trước khi làm

**Q1–Q15 đã có trả lời ngày 2026-09-15**, gồm Q12a. Q15 thay lựa chọn “một lượt in” từng bị chốt nhầm như chi tiết kỹ thuật. Chủ dự án sau đó đã cho phép code T01, đã hoàn tất và có biên bản riêng. Các lựa chọn ảnh/runtime và gate của task sau vẫn theo spec; không suy nghiệm thu T01 thành quyền activation/rollout.

## Quyết định triển khai ngày17/09

- **DELIVERY-01 — Đã chấp nhận:** nguồn là yêu cầu trực tiếp “chưa nối vào UI và deploy thì nó vẫn chưa xong”. Đầu ra phải là luồng hoạt động trên ứng dụng đã triển khai. T01–T07 chỉ là các gate kỹ thuật có bằng chứng; kế hoạch tiếp theo tích hợp UI sớm, giữ đầy đủ kiểm thử trước activation. Lý do: người dùng cần thao tác được trên sản phẩm; backend cách ly chưa chứng minh kết quả đó.
- **DELIVERY-02 — Đã chấp nhận:** trả lời trực tiếp câu hỏi đích “Đúng, cập nhật bản này; giữ nguyên dữ liệu hiện có”. Đích là `https://pos-cafe-azure.vercel.app` và Supabase `kfqjdfwxhkdwihjobpny` (Vercel gọi môi trường này là Production; chủ dự án dùng để thử sản phẩm). Không tạo một môi trường đích khác thay thế mà coi đã xong. Tiếp tục giữ preflight, mapping owner được xác minh, backup, tương thích client/DB và bằng chứng sau deploy; quyền triển khai không cho phép reset dữ liệu hiện có.
- **DELIVERY-03 — Đã chấp nhận ngày22/09, thay phần giữ dữ liệu của DELIVERY-02:** khảo sát chỉ đọc thấy77 stores/154 employees. Chủ dự án xác nhận dữ liệu quán cũ là test, rồi trả lời **“có thể xóa hết, nhưng kĩ nhé”** cho câu hỏi nêu rõ xóa toàn bộ77 quán cùng dữ liệu liên quan. Cho phép cleanup đúng tập77 quán đã khảo sát; không xóa project/schema/cấu hình hoặc dữ liệu mới ngoài tập này. Lý do: không cần mang dữ liệu test cũ sang phiên bản phân quyền. Đánh đổi: không còn quán/đơn/nhân viên test cũ sau cleanup; cần tạo quán mới qua bootstrap owner. Đề xuất77 admin→owner không được duyệt và không còn dùng cho rollout này. Kiểm kê FK/Auth/Storage, khôi phục, rehearsal/review, locked recheck và kiểm activation khi DB rỗng vẫn bắt buộc; không dùng mapping synthetic làm chứng nhận đích. Chưa thực hiện cleanup live tại mốc ghi nhận.
- **Còn phải kiểm:** quyền truy cập công cụ vào đích, dữ liệu thực tế và release gates theo bàn giao hiện hành. Thứ tự PIN đã được chủ dự án chốt ngày 22/09: phải hoàn tất trước phát hành; đích được duyệt cleanup TEST phải qua empty-target locked recheck, không mapping giả. Chưa có bằng chứng triển khai mới; không suy xác nhận đích thành nghiệm thu chức năng. Xem [bàn giao](../../../docs/workflow/tasks/redesign-permission-model.md).

## Quyết định đã chốt

Các quyết định 28/08 và 12/09 được giữ khi không bị hàng mới dưới đây thay thế: năm role dựng sẵn theo quyết định bỏ Kế toán ngày 2026-09-15, không custom role; kitchen chưa bật; quyền nhị phân; cùng store; module suy từ quyền; thiếu quyền thì ẩn, trạng thái nghiệp vụ không hợp lệ thì disabled; owner duy nhất. Một owner là mô hình sở hữu đã chọn, không mô tả là hạn chế về góp vốn. Hồ sơ góp vốn ở ngoài POS.

| ID/ngày | Quyết định hiện hành | Lý do / thay phần cũ |
| --- | --- | --- |
| Q1, 14/09 | Bảo vệ đọc và ghi ở server cho quyền thuộc change; nay catalog 15 theo Q12 | Thay ngoài phạm vi per-employee DB; UI ẩn không bảo vệ lịch sử/báo cáo |
| Q2, 15/09 | Non-owner: target trước và sau đều là subset actor; cấm self role/override. Reset PIN/unlock cùng trần. Owner chỉ được miễn trần với non-owner | Tránh tăng quyền gián tiếp; không dùng role rank. Cần quyền thao tác, session/tenant, lock, snapshot và OCC ngoài hai phép subset |
| Q3, 14/09 | `data.clearDemo` chỉ owner, thay `data.wipe` | Chức năng thật chỉ xóa mẫu; giữ dữ liệu tự tạo, tài chính, K/R1/audit |
| Q4, 14/09 | Owner được ủy quyền `employee.permission.edit`, `settings.manage`; không mặc định cấp cho người khác | Thay giải thích gọi hai quyền này owner-only. Q2 vẫn chặn người được ủy quyền vượt trần |
| Q5, 15/09 | Cho phép rollout trước email recovery; owner quên PIN dùng runbook hạ tầng có xác minh/audit | Thay phát biểu chỉ có email recovery. Không cho manager reset owner hoặc endpoint app vượt quyền |
| Q6, 15/09 | Hồ sơ hỗ trợ ngoài app, được xác minh độc lập; chưa thêm `recovery_contact` | Tránh người có settings.manage đổi contact để yêu cầu chiếm owner |
| Q7, 15/09 | Audit cả lần quản trị bị từ chối sau khi xác minh actor/target cùng store | Giữ outcome/reason/proposedAfter khác actualAfter; không lưu bí mật; không mất audit theo rollback nghiệp vụ đã biết |
| Q8, 15/09 | Owner tự đổi PIN khi server xác minh PIN hiện tại; quên thì Q5 | Tách self-change khỏi reset owner qua quản trị; vẫn cấm self role/override |
| Q9, 15/09 | Signal → UI ≤5s; poll revision chung 30s foreground; dự phòng ≤35s có điều kiện; gate focus/reconnect; cấp/thu hồi đối xứng | 35s đòi cả chuỗi revision/snapshot/apply ≤5s, không phải mỗi request 5s. Realtime thật chưa chạy; không tăng polling feature/background |
| Q10, 15/09 | Đóng phần mất quyền, bỏ nháp chưa gửi bị ảnh hưởng; giữ nháp khác và dữ liệu/K server; không auto retry | Chấp nhận mất phần nhập dở, tránh lưu nháp khóa phức tạp |
| Q11, 15/09 | `floor.view` là quyền nền không tắt cho bốn role đang dùng sau quyết định bỏ Kế toán | Thay tình huống mất mọi module do overrides; nội dung cũ liên quan accountant được thay bởi quyết định bỏ role ở hàng sau. `floor.manage` vẫn riêng; không tự mở quyền xem chi tiết nhạy cảm |
| Q12/Q12a, 15/09 | Thêm `receipt.reprint`, catalog 15. Mặc định owner/manager/cashier; waiter/kitchen không có; fixture chỉ xem cần grant riêng | Thay tự cho in lại khi có lịch sử. In lại cần quyền mới nơi đã được phép xem; in ban đầu sau payment giữ `payment.take` |
| Q13, 15/09 | Owner hoặc người có `employee.permission.edit` đọc toàn bộ audit chi tiết cùng store | Không chọn đề xuất chỉ owner; trần quản trị Q2 không tự thu hẹp quyền đọc audit |
| Q14, 15/09 | Giữ toàn bộ audit, chưa tự động xóa; clear demo không xóa | Chấp nhận dung lượng tăng; không mặc định nhật ký denied luôn ít |
| Q15, 15/09 | Vẫn cho in tiếp trong preview; nút In ẩn/hiện theo quyền. Initial kiểm payment.take, reprint kiểm receipt.reprint; mỗi click server kiểm hiện hành. Chỉ mất quyền in thì ẩn nút/hủy pending, còn quyền đọc thì giữ preview; mất quyền đọc/phiên mới đóng | Thay initial một lần dispatch rồi đóng kể cả Cancel. Có thể in nhiều bản khi preview còn mở; browser không chứng minh số bản giấy. Không auto print khi cấp lại quyền/reconnect; không mint initial grant từ K cũ |

Chi tiết lập luận và đính chính kỹ thuật: [Q2–Q8](../../../docs/reviews/2026-09-14-permission-model/02-doi-chieu-q2-q5-2026-09-15.md), [Q9–Q14](../../../docs/reviews/2026-09-14-permission-model/03-cap-nhat-quyen-va-nhap-2026-09-15.md).

## Phương án và đánh đổi

- Catalog global thay vì từng store: phù hợp không custom role, tránh nhân bản; mọi phiên phải theo dõi catalog revision, không đọc một lần rồi giữ mãi.
- Snapshot + signal + revision fallback thay gọi mạng mỗi guard: giảm lượt gọi. Poll cơ sở khoảng 2 request/phút/tab foreground; tải snapshot phát sinh khi đổi revision. Không khẳng định tăng đúng 17% tổng tải vì polling POS 5s tính theo từng query đang hoạt động.
- Tập quyền trước/sau thay thứ hạng role: overrides làm rank sai. Manager thiếu report.view có thể không reset được cashier được grant quyền đó; owner xử lý trường hợp vượt trần.
- Tách signal tối thiểu khỏi audit chi tiết: Q7/Q13 làm audit chứa cấu hình quyền nhạy cảm. Không publish employees, stores hoặc audit đầy đủ.
- Thay đổi phá tương thích có bridge và cửa sổ activation: tránh seed chỉ năm role candidate rồi tuyên bố tương đương admin cũ. Không mở lại legacy RPC/financial DML để làm client cũ chạy.
- Recovery thủ công: giảm phụ thuộc email chưa trong scope, nhưng quyền hạ tầng đủ mạnh vẫn có khả năng mạo danh owner. Audit DB không chống người toàn quyền DB; cần bằng chứng vận hành ngoài DB. [Limitation/runbook](../../../docs/limitations.md) nêu điểm kết thúc.
- Receipt reprint kiểm soát chức năng POS, không chống sao chép/in ngoài app dữ liệu đã được phép xem. In trình duyệt không xác nhận số bản in giấy; không thêm queue/printer infrastructure.
- Ảnh mới giữ private staging và gateway kiểm published record ở origin GET. URL ổn định, browser cache tối đa60s trước xác minh lại; không hứa thu hồi byte đã tải. Đổi lại origin GET phụ thuộc Edge/DB, có thêm request/bytes/độ trễ chưa đo; không khẳng định luôn miễn phí hoặc mất mọi CDN. Copy public sau commit cần publication intent/retry/CAS và semantics khác nên không chọn trong change này. Design6.1 và TC45–47 ghi cache, lỗi, placeholder và cách đo.
- Evidence tách source fingerprint khỏi execution profile: cùng nguồn nhưng TC49 legacy, TC50 bridge, candidate và migration có catalog/applied DDL khác nhau. Fixture candidate phải có ACL do từng task cung cấp trước negative test; T16 điều phối chuyển đổi, không hoãn viết ACL đến cuối.
- Runtime mục tiêu full local Supabase, cấu hình/CLI/images khóa lúc chuẩn bị T02; T01 chỉ cần DB legacy cách ly cho phần chỉ đọc. Không dùng runtime phase27 thiếu Storage/Realtime để claim full gate, không hạ nghiệm thu hoặc phát sinh chi phí mặc định.
- Giữ tên nhân viên và displayName 1–120 theo [014:253](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:253)/[272](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:272), giữ INVALID_PIN khi start session cho inactive theo [218](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:218). Sửa các giá trị100/lỗi phiên bị ghi sai, không thêm siết nghiệp vụ mới.

## Impact và điểm dừng

Phạm vi dự kiến: domain/core/ports, mock/Supabase adapters, employee/admin/session/order/history/receipt UI, cache/realtime integration, migrations/grants/projections/storage gateway, test cách ly và tài liệu. Inventory và hợp đồng cụ thể nằm ở [design](design.md); thứ tự và gate ở [tasks](tasks.md).

**PERM-T01–T07 đã hoàn tất phạm vi kỹ thuật** nền preflight/catalog/core, identity/admin/financial và read projection candidate. UI và các phần tiếp theo đang tích hợp/kiểm tại checkpoint22/09; chưa có gate tổng hoặc phát hành. [Biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) là bằng chứng lịch sử theo source của T07, không thay kết quả candidate hiện tại.

## Quyết định bổ sung sau T01 — 2026-09-15

Chủ dự án đã chốt **bỏ vai trò Kế toán (`accountant`)**, yêu cầu đồng bộ docs và chuẩn bị code T02. Giữ 15 quyền; catalog còn owner/manager/cashier/waiter/kitchen, bốn role hoạt động và ba lựa chọn tạo/chuyển nhân viên. Kitchen tiếp tục chưa bật. Không thêm role hoặc preset chỉ xem. Khi cần tài khoản chỉ xem, dùng overrides hiện có; fixture A được chuyển thành waiter với grant history/report và deny create/update.

Lý do: chưa cần một vai trò chỉ xem riêng; chủ quán/quản lý đã có quyền báo cáo và lịch sử. Đánh đổi là phải chỉnh quyền riêng nếu có người chuyên xem số liệu. Quyết định này thay các nhắc đến accountant và số sáu role/năm hoạt động trong Q11/Q12a và review trước đó; không thay tách quyền in lại, quyền nền, owner-only hoặc trần quyền. [Bàn giao T02](../../../docs/reviews/2026-09-14-permission-model/11-bo-ke-toan-chuan-bi-t02-2026-09-15.md) ghi mốc chuẩn bị trước code. Sau mốc đó T02 đã triển khai/kiểm SQL local và chạy lại regression T01 cùng fingerprint mới; chưa áp lên Supabase thật hoặc thay UI.

## Quyết định bổ sung trong T05 — 2026-09-16

Chủ dự án chọn **xóa tùy chỉnh cũ, áp tùy chỉnh mới cùng lần lưu** khi request đổi role và gửi overrides rõ ràng. Role-only vẫn reset null, same-role thiếu overrides giữ nguyên. Mixed request đòi cả hai quyền quản trị và ceiling trước/sau; không tự cấp quyền ngoài actor. UC03/design/testplan đã đồng bộ; không phát sinh UI hoặc quyền thứ 16.

**Quyết định T07 ngày 2026-09-16:** chủ dự án chọn báo cáo theo múi giờ cửa hàng, mặc định UTC+7 (`Asia/Ho_Chi_Minh`; alias cũ `Asia/Saigon` vẫn đọc được). Chỉ owner được đổi timezone; `settings.manage` vẫn ủy quyền được cho các trường khác. Lý do: mọi thiết bị thấy cùng nhãn giờ, giữ ngày doanh thu đã lưu và tránh người được ủy quyền thay cách nhóm giờ toàn cửa hàng. Read calculation thuộc T07; rào chắn ghi T08/control T13 chưa triển khai.

**Quyết định T07 về bảng báo cáo, 2026-09-16:** giữ tối đa20 tóm tắt đơn paid trên toàn khoảng ngày, report.view độc lập orderHistory.view. Dùng projection riêng, chỉ số đơn/ngày/loại đơn/tên bàn/tổng tiền/trạng thái và id dòng; không mở chi tiết món/receipt/history bằng quyền báo cáo. Chủ dự án đã chọn giữ bảng tóm tắt; không còn câu hỏi T07 đang chờ.

## DELIVERY-03-NEW79 — bổ sung phạm vi ngày13/10/2026

Người dùng trả lời trực tiếp **“Cả hai là quán test có thể cleanup”** cho câu hỏi về đúng hai quán mới ngoài77. [Quyết định, nguồn user message và phương án](../../../docs/workflow/tasks/permission-close3-scope79-2026-10-13.md). Chấp nhận exact77 gốc + exact2 UUID từ frozen checkpoint, thành79; không chọn quán theo ngày/prefix/live count. DELIVERY-03 ngày22/09 ở trên giữ nguyên như lịch sử. Auth79 cùng ID/store và closure FK đã quan sát thuộc scope dự kiến;66 Auth khác và object Storage thứ ba giữ nguyên; allowlist Storage vẫn đúng2. Manifest79 chỉ scope approval, chưa đủ cutover proof. Xong slice này dừng trước quyền/cấu hình deployment và backup mới; strict74/75FAIL của backup cũ không được đổi. Chưa cleanup/activation/release.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.



## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
