# Đối chiếu review độc lập — redesign-permission-model và PERM-T01

> Báo cáo này lưu findings tại snapshot trước sửa; file:line trong các nhận xét là vị trí lúc đối chiếu. Chủ dự án sau đó đã yêu cầu xử lý phần chuẩn bị. Kết quả áp sửa và trạng thái mới ở [bàn giao08](08-ban-giao-chuan-bi-sau-review-2026-09-15.md); không coi các câu “chưa áp” phía dưới là trạng thái bản mới.

Ngày **2026-09-15**. Nguồn đầu vào: [báo cáo AI độc lập do chủ dự án gửi](C:/Users/nguye/.codex/attachments/503e1854-ef83-4f87-bdc4-8280736e6cad/pasted-text.txt). Đối chiếu với working tree hiện tại, không chỉ bản HEAD. Báo cáo này ghi kết quả kiểm chứng và đề xuất sửa; **chưa áp các sửa đổi nghiệp vụ/kỹ thuật vào bộ spec**.

**Kết luận: 10 finding đúng, 5 finding đúng một phần.** “Đúng” nghĩa là xác nhận vấn đề cốt lõi, không mặc nhiên chấp nhận mọi lập luận hoặc cách sửa của reviewer. Các finding vẫn cần xử lý. R07 cho thấy người biên tập đã tự chọn một quy tắc nghiệp vụ; R01 cho thấy lần sửa cổng trước chưa khép hết vấn đề. Vì vậy kết luận “READY FOR APPROVAL, không còn quyết định nghiệp vụ mở” ở [bàn giao 06](06-ban-giao-spec-2026-09-15.md) cần được rút lại. Trạng thái đánh giá hiện tại: **NEEDS REVISION; Q15 đã được chủ dự án trả lời trong lượt này, chưa áp vào bộ artifact**. Không bắt đầu PERM-T01 trong lượt kiểm chứng này.

Mô hình 15 quyền và các quyết định Q1–Q14 vẫn là đầu vào đã chốt. Không có căn cứ từ review này để làm lại toàn bộ mô hình hoặc hỏi lại các quyết định đó.

## 1. Phán định từng finding

| ID | Phán định | Bằng chứng và hướng xử lý |
| --- | --- | --- |
| R01 / P2 | **Đúng** | [tasks:9](../../../openspec/changes/redesign-permission-model/tasks.md:9) đã cho kiểm candidate cách ly trước T16, nên diễn giải “activation chỉ T16/T18” của reviewer chưa đủ chính xác. Tuy nhiên T05/T07–T09 vẫn chưa chỉ rõ ai tạo và áp phần ACL cần cho fixture nghiệm thu. [T15](../../../openspec/changes/redesign-permission-model/tasks.md:145) gom TC49/50 vào cùng fingerprint chứa trạng thái catalog là không nhất quán: TC49 preflight legacy, TC50 bridge, các ca còn lại candidate. Sửa mô hình bằng chứng và giao rõ DDL/fixture; không chỉ chuyển riêng TC50. |
| R02 / P2 | **Đúng** | [T01](../../../openspec/changes/redesign-permission-model/tasks.md:19) và T16 chỉ cung cấp fixture; [T18](../../../openspec/changes/redesign-permission-model/tasks.md:175) cần mapping thực đã xác minh. Bổ sung bước preflight chỉ đọc trên môi trường phát hành và duyệt mapping trước cửa sổ mutation, thuộc T17 hoặc bước chuẩn bị phát hành có yêu cầu riêng. Chưa cần cấp quyền chạm môi trường thật để làm T01. |
| R03 / P2 | **Đúng** | [014:218](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:218), [mock:15](D:/Workspace/pos-cafe/src/adapters/mock/employeeRepo.ts:15) và [TC-IDEM-002](../../../openspec/changes/add-idempotent-write-operations/testplan.md:115) dùng `INVALID_PIN` khi bắt đầu phiên cho employee inactive. [TC-PERM-02](../../../openspec/changes/redesign-permission-model/testplan.md:189) lại chờ `EMPLOYEE_SESSION_REQUIRED`. Sửa expected về `INVALID_PIN`; giữ lỗi phiên cho request sử dụng phiên không còn hợp lệ. Code chứng minh hành vi đồng nhất, không đủ chứng minh động cơ tác giả “cố tình chống liệt kê trạng thái”. |
| R04 / P2 | **Đúng** | [014:253](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:253) và [014:272](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:272) cho tên 1–120; spec mới tự siết 1–100 trong khi PERM-23 nói giữ hiện có. Đề xuất trả về 1–120, thống nhất cách đếm ký tự với DB. Đây là sửa sai lệch chưa được duyệt, không cần buộc chủ dự án chọn lại 100/120. Không được tự cắt tên legacy. |
| R05 / P2 | **Đúng một phần** | Thiếu chỉ dẫn tái sử dụng harness là thật; chưa có căn cứ nói tác giả bắt buộc dựng lại từ đầu. Có thể tái sử dụng module kiểm môi trường, hash nguồn, manifest/discovery và redaction. Nhưng không tái sử dụng nguyên `preflight()` vì nó ghi session; redactor hiện có cũng chưa bảo đảm lọc mọi PIN/hash/MAC. Chi tiết mục 3. |
| R06 / P2 | **Đúng** | T01 thiếu prerequisite runtime, phân biệt fixture với store thật, đường dẫn/schema output và diễn đạt đúng TC48/49. TC48 là ca xác định được owner; TC49 mới là ca mơ hồ. Có thể giữ một task với ba đầu ra và các bước rõ ràng, chưa cần tăng số task hoặc đổi toàn bộ kế hoạch. Đề xuất hợp đồng T01 ở mục 4. |
| R07 / P2 | **Đúng; Q15 đã được trả lời** | [design:157](../../../openspec/changes/redesign-permission-model/design.md:157) đóng preview sau dispatch kể cả Cancel; [ReceiptPreview.tsx:333](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:333) hiện không đóng preview sau lệnh In. Q12/Q12a chỉ chốt in ban đầu theo `payment.take`, chưa chốt mất lượt khi Cancel. Người biên tập đã coi đây là kỹ thuật và quyết định quá phạm vi. Chủ dự án nay chọn vẫn cho in, ẩn/hiện nút theo quyền; cần thay quy tắc một lượt và hành vi đóng preview không cần thiết trong artifact. |
| R08 / P2 | **Đúng một phần** | [design:169](../../../openspec/changes/redesign-permission-model/design.md:169) thực sự đổi đường đọc ảnh mới sang Edge/DB, thiếu đánh đổi trong proposal. Nhưng render không đồng nghĩa request mạng, private Storage không đồng nghĩa mất mọi cache/CDN. “Copy public sau commit” cần protocol xuất bản, retry và xử lý xung đột, không phải sửa một dòng tương đương. Chi tiết mục 5. |
| R09 / P2 | **Đúng một phần** | Thiếu kế hoạch cung cấp Storage/Realtime/gateway thật là đúng. Runtime phase27 không đủ, nhưng [preflight.ts:12](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:12) đã nhận engine `supabase`. Chưa provision không đồng nghĩa mọi task tương lai mặc định BLOCKED. Ghi prerequisite full local stack; gate vẫn NOT RUN, chỉ BLOCKED khi đến bước thực hiện mà thiếu điều kiện. Không giảm nghiệm thu để biến thiếu service thành PASS. |
| R10 / P3 | **Đúng** | [roadmap:54](../../roadmap.md:54), [roadmap:157](../../roadmap.md:157), [owner proposal:282](../../../openspec/changes/add-owner-account-and-store-provisioning/proposal.md:282) còn 14 quyền/trạng thái cũ. Đính chính thành 15 theo Q12a, giữ nội dung quyết định loại Store Key rotation. Dòng 157 còn nói “đã chứng minh” trong khi feature chưa triển khai: cần chuyển thành luận điểm thiết kế dự kiến. Trạng thái mới phải phản ánh review được mở lại, không tiếp tục chép READY cũ. |
| R11 / P3 | **Đúng** | Cặp [employee:98](../../../openspec/changes/redesign-permission-model/specs/employee-management/spec.md:98)/[115](../../../openspec/changes/redesign-permission-model/specs/employee-management/spec.md:115) và [receipt:69](../../../openspec/changes/redesign-permission-model/specs/receipt-printing/spec.md:69)/[79](../../../openspec/changes/redesign-permission-model/specs/receipt-printing/spec.md:79) trùng nghĩa. Gộp, giữ scenario kế thừa baseline/phase27. Đây chưa phải bằng chứng 60 TC hiện tại bị đếm trùng. |
| R12 / P3 | **Đúng** | [design:205](../../../openspec/changes/redesign-permission-model/design.md:205) có ý định xóa cơ chế legacy, nhưng task chưa giao việc rõ. Giao dọn guard/module map đang được candidate sử dụng trước gate tổng T15, và dọn bridge/enum DB trong activation T16 theo dependency. Không xóa migration lịch sử hoặc fixture bridge chỉ để tìm kiếm không còn chữ legacy. Không để toàn bộ cleanup sang T17/T18 rồi yêu cầu TC57 PASS từ trước. |
| R13 / P3 | **Đúng một phần** | [baseline sync:20](../../../openspec/specs/multi-device-sync/spec.md:20) đòi signal và invalidate, không bắt payload raw row; đổi sang metadata signal chưa tự tạo mâu thuẫn cần MODIFIED. [008:54](D:/Workspace/pos-cafe/supabase/migrations/008_modifier_rework.sql:54) có publication, nhưng [realtimePort.ts:24](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:24) chưa subscribe join table: giới hạn chưa có đồng bộ đầu cuối vẫn đúng. Vấn đề thực là design/T10 đòi giữ invalidation join “đã có”, trong khi proposal để cải thiện đó ở change riêng. Phải làm rõ dependency/phạm vi; nếu change này thực sự bỏ giới hạn thì khai delta tương ứng. |
| R14 / P3 | **Đúng một phần** | Không đúng khi nói không requirement nào làm căn cứ cho TC60: [PERM-25](../../../openspec/changes/redesign-permission-model/specs/multi-device-sync/spec.md:30) đã yêu cầu đóng preview/hủy timer bị ảnh hưởng; [PERM-28](../../../openspec/changes/redesign-permission-model/specs/receipt-printing/spec.md:50) kiểm `payment.take` cho in ban đầu. Dù vậy nên bổ sung trường hợp initial vào danh sách cụ thể ở [design:185](../../../openspec/changes/redesign-permission-model/design.md:185), rồi đồng bộ theo Q15. Không cần mở quyết định nghiệp vụ riêng cho việc thu hồi quyền. |
| R15 / P3 | **Đúng** | [proposal:7](../../../openspec/changes/redesign-permission-model/proposal.md:7) dẫn chưa đúng chỗ: `requireAdminActor` ở [adminFlow.ts:55](D:/Workspace/pos-cafe/src/features/admin/adminFlow.ts:55); bảng guards bắt đầu [guards.ts:26](D:/Workspace/pos-cafe/src/core/guards.ts:26). Sửa vị trí dẫn. Kiểm file tồn tại/dòng trong giới hạn không tự chứng minh câu dẫn đúng nội dung. |

## 2. Cách sửa R01 để không tạo cổng bất khả thi khác

Không dùng một fingerprint chứa cả nguồn lẫn trạng thái DB đang thay đổi để bắt mọi pha có cùng giá trị. Đề xuất tách:

1. **Candidate/source identity:** hash mã, test và bộ script/migration dự kiến. Cùng một release candidate phải dùng cùng bộ nguồn đã khóa; sửa nguồn làm bằng chứng cũ hết giá trị với candidate mới.
2. **Execution profile:** mỗi lượt ghi rõ baseline/bridge/candidate/transition; backend và cấu hình dịch vụ, phiên bản runtime, fixture, các migration đã áp và catalog thực tế. Manifest TC → execution chỉ rõ profile hợp lệ cho từng biến thể.

TC49 chạy trạng thái preflight legacy; TC50 chạy bridge. Các negative test raw SELECT/DML/Storage phải chạy trên candidate có đúng ACL đã đóng. T16 diễn tập A→E tất nhiên có thay đổi trạng thái; ghi lại từng pha thuộc cùng bundle, không coi khác pha là nguồn khác hoặc trộn tùy ý report cũ. Bộ 60 TC vẫn có thể là một gate tổng nếu manifest chứng minh đúng nguồn và profile của từng ca.

T05/T07/T08/T09 phải giao rõ phần DDL thu hồi quyền mà chúng tạo và áp cho fixture cách ly trước nghiệm thu. T16 chịu trách nhiệm chuyển đổi dữ liệu legacy bằng bundle hoàn chỉnh; T18 mới là môi trường phát hành được yêu cầu riêng. Các task chưa thể chạy toàn bộ một TC vì dependency chưa xong chỉ ghi phần/biến thể đã kiểm, không đánh toàn TC PASS. Cách sửa này cũng cần áp cho TC57 và cleanup legacy.

## 3. Tái sử dụng harness: hai điểm review ngoài chưa nêu

**Hàm preflight hiện tại có ghi.** [preflight.ts:108](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:108) gọi `start_employee_session`, rồi [127](D:/Workspace/pos-cafe/tests/contracts/preflight.ts) gọi `revoke_employee_session`; observer xác minh row session đã tạo và thu hồi. Vì vậy chạy nguyên hàm đó không thể thỏa hợp đồng T01 “snapshot DB trước/sau không đổi”. Đây không phải lỗi của harness phase27; chỉ là không phù hợp để gọi nguyên hàm trong công cụ mới được hứa là chỉ đọc.

Tái sử dụng `loadTestEnvironmentFile`, parser và logic chứng minh môi trường cách ly; tách kiểm tra chỉ đọc khỏi bootstrap/probe có mutation. Fixture setup và service binding có mutation, nếu cần cho test tương lai, phải là bước chuẩn bị riêng được ghi rõ trước mốc so sánh DB. Không đọc `.env.local`, không làm yếu marker hoặc chứng minh API/observer cùng backend.

**Redaction cũ chưa đủ cho output mới.** [idempotency-redact-artifacts.mjs:7](D:/Workspace/pos-cafe/scripts/idempotency-redact-artifacts.mjs:7) lọc một số credential theo biến môi trường, JWT và Store Key. Nó không tự lọc mọi PIN, `passcode_hash` hay MAC trong một row/exception tùy ý. Công cụ mới phải chỉ serialize các field được phép, tránh thu thập bí mật ngay từ đầu; bổ sung test output và kiểm redaction phù hợp.

[candidateFingerprint():6](D:/Workspace/pos-cafe/scripts/idempotency-artifacts.mjs:6) đã hash file nguồn, bao gồm nguồn migrations được Git liệt kê; chưa chứng minh DB đã áp những migration đó hoặc runtime nào đang chạy. Giữ hoặc mở rộng tương thích bộ hash nguồn, thêm execution metadata riêng theo mục 2. Tái dùng cấu trúc [caseManifest](D:/Workspace/pos-cafe/tests/contracts/caseManifest.ts:1), discovery và verify-results; không lấy expected của phase27 thay oracle độc lập cho catalog mới.

## 4. Hợp đồng T01 cần bổ sung trước khi giao code

Đây là đề xuất sửa tài liệu, chưa phải lệnh chạy hoặc các output đã được tạo.

| Thành phần | Hợp đồng đề xuất |
| --- | --- |
| Phạm vi chạy | Chỉ fixture legacy synthetic trong runtime cách ly có marker. Preflight store thật là bước khác trước phát hành, cần yêu cầu riêng. Không schema/defaults/role activation. |
| Runtime | Khóa profile thực sự dùng cho các bước tích hợp. Đọc catalog/preflight cần DB thật; bước kiểm qua REST/Auth phải có đúng dịch vụ. T01 không phụ thuộc Storage/Realtime đầy đủ chỉ để đọc inventory từ nguồn/catalog. Không dùng toàn hàm preflight có ghi ở mục 3. |
| Inventory | Đường đọc/ghi/RPC overload/grants/publication/Storage policy, file nguồn và trạng thái catalog quan sát được; tách dữ kiện tĩnh với dữ kiện DB. Không gọi catalog `storage` giả là Storage API đã kiểm. |
| Preflight | Theo store: READY/NEEDS_REVIEW, candidate owner, provenance, quyền trước/sau dự kiến, blocker và dữ liệu cần xác minh. Không tự chọn owner ở ca mơ hồ, không cập nhật mapping vào DB. |
| Output dự kiến | `artifacts/permissions/t01/<runId>/inventory.json`, `preflight.json`, `bridge-oracle.json`, `manifest.json`. Docs tổng hợp dự kiến tại `docs/implementation-log/permission-t01-preflight-<date>.md`. |
| Field bắt buộc | `schemaVersion`, `runId`, source fingerprint, runtime/profile, fixture/store identity, trạng thái và lý do, nguồn bằng chứng, kết quả kiểm từng biến thể. Schema không nhận PIN/hash/token/DSN/MAC thô; không serialize toàn row hay exception DB. |
| TC48/49 | Chỉ phần preflight của TC48 cho owner xác định được; TC49 cho các ca mơ hồ và lượt đọc lại sau mapping được cung cấp. So DB trước/sau công cụ; thiếu marker phải bị từ chối. Không đánh TC48 toàn phần PASS trước activation rehearsal. |
| TC50 | Sinh expected độc lập cho 3 role × 2 trạng thái active × 4^5 cấu hình override = 6.144 hồ sơ. Chạy helper đối chiếu thuộc T02 khi helper đã tồn tại; không nhận TC50 PASS tại T01 chỉ vì đã sinh dữ liệu. |
| Điểm dừng | Bàn giao diff, evidence, mapping cần xác minh và mức TC đã làm; không tự sang T02. |

Ba đầu ra inventory/preflight/oracle có thể là ba bước trong T01. Chia thành ba task chỉ khi thực hiện cho thấy một lượt review quá lớn, không phải điều kiện nghiệp vụ bắt buộc mới.

## 5. Storage và runtime: vấn đề thật, giới hạn kết luận

### R08 — đường đọc ảnh

Hiện [bucket public](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:11), [adapter](D:/Workspace/pos-cafe/src/adapters/supabase/menuImagePort.ts:43) trả URL Storage, [upload](D:/Workspace/pos-cafe/src/adapters/supabase/menuImagePort.ts:68) đặt `cacheControl: "3600"`. [Menu UI](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderMenuPane.tsx:105) dùng ảnh qua `src`. React render lại không tự đồng nghĩa một origin request mới.

Supabase vẫn có CDN cho private Storage, nhưng cache hit giữa người dùng có thể kém hơn public. Điều đó không chứng minh response của Edge GET tùy ý tự được CDN cache. Ví dụ Edge đọc file từ Storage vẫn thực thi function khi request đến function. Nguồn chính thức đã đối chiếu: [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals), [Edge tích hợp Storage](https://supabase.com/docs/guides/functions/storage-caching).

Vì thế phải ghi đánh đổi **thêm phụ thuộc Edge/DB, request/bytes khi origin GET và độ trễ khi cache miss**, không viết “mọi render gọi Edge”, “mất toàn bộ CDN”, hoặc tự suy ra chắc chắn phải trả phí. Chưa có số đo tải/chi phí cho phương án mới.

Khuyến nghị hiện tại: giữ private staging và gateway đã thiết kế, bổ sung URL ổn định, chính sách cache cho ảnh đã publish và phản hồi lỗi/chưa publish, hành vi khi gateway lỗi, cùng phép đo request/invocation/bytes. Quy tắc kiểm published record áp tại origin request; không hứa thu hồi byte mà trình duyệt đã tải. Trình rõ đánh đổi này trong proposal để chủ dự án review cùng spec.

Phương án đưa ảnh đã duyệt sang public có thể hợp lệ nếu ưu tiên đường đọc hiện tại, nhưng cần thiết kế đầy đủ: publication intent bền vững gắn store/item/version/uploadId; object đích immutable; retry idempotent; kiểm copy thành công nhưng mất ACK; CAS khi item vẫn trỏ đúng intent; xử lý replace/unlink và object dư; UI pending hoặc giữ ảnh cũ. Đây là suy luận từ việc DB và Storage không dùng chung transaction, không phải SDK tự cung cấp protocol đó. Public GET sau xuất bản cũng không còn kiểm published record DB ở mỗi origin request. Không đổi sang phương án này bằng một câu bổ sung.

### R09 — môi trường nghiệm thu

[Runtime phase27](../../implementation-log/phase-27-test-runtime-wsl.md:75) không có Storage API/Realtime thật. Tuy nhiên Supabase CLI hỗ trợ full local stack qua Docker-compatible runtime; đây là phương án mục tiêu hợp lý để bổ sung kế hoạch trước T09/T10. Nên khóa phiên bản CLI/image/config, có fixture/marker, gateway HTTP/Storage roundtrip và positive control Realtime hai client. Nguồn: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

Kiểm chỉ đọc của subagent thấy WSL2 Ubuntu-24.04 đang stopped, RAM khoảng 32GB; Docker/Supabase chưa có trên Windows PATH. Chưa kiểm Docker bên trong WSL, dung lượng trống hoặc khởi động dịch vụ. Vì vậy **khả thi về nguyên tắc, chưa xác minh runtime sẵn sàng**.

Một điểm phải giải quyết: [parser:59](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:59) chỉ nhận DB tên `pos_cafe_idem_test_*`, còn CLI dùng DB `postgres` mặc định trong ví dụ chính thức. Fixture IDs của harness cũng bị ràng buộc tại [65](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:65). Cần profile Supabase với bằng chứng cách ly tương đương và mapping fixture rõ; không bỏ kiểm tra hoặc để API/observer trỏ hai DB khác nhau. Không tái dùng [bootstrap storage shell](D:/Workspace/pos-cafe/scripts/idempotency-local-bootstrap.mjs:36) thay service thật.

Chưa cần buộc chủ dự án chọn “dựng stack hay bỏ test”. Có thể đưa full local stack vào kế hoạch kỹ thuật; chỉ cần quyết định thêm nếu gặp giới hạn tài nguyên/cài đặt chưa khắc phục được, cần tài khoản/chi phí, hoặc chủ dự án muốn thu hẹp tiêu chí nghiệm thu. T01 chỉ đọc không bị chặn bởi việc chưa có Realtime. Các gate service thật vẫn NOT RUN và bắt buộc chứng minh trước khi đóng những task tương ứng.

## 6. Câu hỏi nào thực sự cần trả lời

| Đề nghị hỏi trong review ngoài | Xử lý sau đối chiếu |
| --- | --- |
| In ban đầu | **Q15 đã chốt:** chủ dự án trả lời “vẫn cho in, nhưng khi mất quyền thì ẩn nút in đi (nút in ẩn hoặc hiện dựa vào quyền)”. Cho in tiếp trong preview còn mở, kể cả sau Cancel; không giới hạn một lần dispatch. Nút initial theo `payment.take`, nút reprint theo `receipt.reprint`; mỗi lần bấm server vẫn kiểm quyền/session/trạng thái paid hiện hành. Chỉ mất quyền in thì ẩn nút, hủy authorize/timer chưa dispatch và bỏ phản hồi muộn; không tự đóng preview nếu vẫn được phép đọc. Nếu mất quyền đọc hoặc phiên, vẫn đóng/purge theo Q10. Mở lại từ lịch sử không được biến thành initial để vượt reprint. Không tự retry/in khi quyền được cấp lại. |
| Ảnh public/private | Cần bổ sung đánh đổi và giới hạn vào spec để duyệt. Chưa buộc chọn lại kiến trúc trong lượt kiểm chứng; đề xuất giữ gateway với hợp đồng cache/lỗi rõ, không mặc định chuyển public hoặc phát sinh khoản chi. |
| Runtime Storage/Realtime | Kế hoạch kỹ thuật: ưu tiên full local cách ly. Không xin chủ dự án bỏ test chỉ vì môi trường hiện chưa provision. |
| Tên 100/120 | Khôi phục 120 theo hợp đồng hiện có; chỉ hỏi nếu chủ dự án muốn chủ động siết mới. |
| Ai/khi nào preflight store thật | Giao producer và thời điểm trong kế hoạch ngay; môi trường/operator cụ thể và quyền chạy sẽ chốt trước bước phát hành. Không phải điều kiện để khảo sát fixture T01. |
| Thứ tự force-default-pin-change | [Proposal change đó:60](../../../openspec/changes/force-default-pin-change/proposal.md:60) nói làm trước hoặc sau đều được, khuyên trước; chưa phải dependency bắt buộc. Giữ T01 độc lập, ghi rõ thứ tự phát hành phải được kiểm trước T18. Q5 cho rollout trước email recovery không có nghĩa đã chấp nhận bỏ xử lý PIN mặc định. Không tự gộp change này hoặc tự đổi thứ tự toàn roadmap trong lượt review. |

Q15 thay phần đề xuất trước đây “mất quyền in là luôn đóng preview”: cần phân biệt quyền bấm In với quyền tiếp tục xem dữ liệu. Điều này cũng tác động các câu đóng preview nguồn reprint ở design/PERM-25/TC liên quan; không chỉ sửa TC60. Nút có thể hiện lại khi quyền được cấp lại và preview còn hợp lệ, nhưng không tự gửi lệnh in. Trình duyệt không chứng minh số bản giấy đã in, nên người còn quyền có thể in nhiều bản khi preview mở.

Đề xuất sửa kỹ thuật ở báo cáo này không thay câu trả lời của chủ dự án. Cần áp Q15 và các sửa đổi được xác nhận nhất quán vào proposal, requirement, usecase, design, testplan, traceability và task, rồi mới đánh giá READY lại.

## 7. Findings cũ và mức bằng chứng

- **BR03:** đã mô tả được UI sau authorize, nhưng quy tắc chọn để khép finding chưa được chủ dự án duyệt. R07 đúng; người biên tập nhận trách nhiệm về việc gắn nhãn “chi tiết kỹ thuật” cho quyết định này.
- **BR02/SR03:** đã tách preflight/activation ở một số ca, nhưng còn lỗi profile/fingerprint và ACL fixture theo R01. Trạng thái FIXED cũ không đủ làm bằng chứng đã khép toàn bộ lớp vấn đề.
- **SR01:** design yêu cầu khóa đúng thứ tự và tách helper đang khóa actor sớm. Nên gọi đích danh [private.current_employee](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:179) trong T06 để giao việc rõ. Lượt này không tái chứng minh toàn bộ đồ thị deadlock hoặc chạy lịch đồng thời; không nâng kết luận đọc tài liệu thành bảo đảm runtime.
- **BR01/SR02:** các DTO đã được bổ sung trong spec hiện tại. Review này chưa nêu đường tái hiện mới cho lỗi thiếu DTO đó.

## 8. Kiểm tra thực sự đã chạy trong lượt này

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| Code baseline/status/hash | `main@ef2c372aec60d8362549e47b7aedb27126129479`; chỉ untracked `pnpm-lock.yaml`, SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`. Không chỉnh code/migration/test. |
| Docs baseline/status | `docs@f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` và dirty working tree có sẵn. Đọc actual files; không checkout/reset/stash/commit/push. |
| Đối chiếu R01–R15 | Đọc báo cáo đầu vào, artifact và code/SQL/harness liên quan. Gọi lại subagent server_audit để kiểm riêng R08/R09; không tạo reviewer mới hoặc chạy triển khai. |
| OpenSpec strict, chỉ change này | `openspec validate redesign-permission-model --strict --no-interactive`: **PASS** trên bộ spec chưa sửa theo R01–R15. Không dùng PASS này để đóng lỗi ngữ nghĩa. |
| Script kiểm tài liệu hiện có | **PASS:** 30 requirement, 15 UC, 60 TC, 18 task, 13 file spec; 0 requirement/UC thiếu TC; 68 cặp exception; 27 đối chiếu scenario; 649 link tại thời điểm trước khi thêm báo cáo này. Các con số là kiểm cấu trúc, không phải test triển khai. |
| `git diff --check` | **PASS**; chỉ cảnh báo chuẩn hóa LF/CRLF. |
| Tài liệu Supabase | Đã đọc nguồn chính thức về CDN, Edge/Storage và CLI; không dùng suy đoán chi phí thay số đo. |

**NOT RUN:** app build/test, 60 TC triển khai, migration/activation, DB/Auth/REST integration, Storage/gateway, Realtime, recovery rehearsal, business smoke hoặc preflight cửa hàng thật. Không đọc `.env.local`, không cài/khởi động runtime. Không lấy kết quả runtime lịch sử của phase27 làm kết quả mới.

Thay đổi của lượt kiểm chứng: thêm báo cáo này để lưu kết quả và đề xuất. Các sửa đổi cụ thể R01–R15 vào artifact vẫn chưa thực hiện; không đánh finding FIXED hoặc task implementation hoàn tất.

Ghi chú liên kết sau PERM-T01: dòng 127 nêu trong review là số dòng ở baseline `ef2c372`. Sau khi tách observer gate, liên kết đó mở file hiện hành; nội dung và kết luận review lịch sử được giữ nguyên.
