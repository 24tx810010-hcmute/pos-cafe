# Review độc lập 1 — nghiệp vụ và tính nhất quán

Ngày: **2026-09-15**. Reviewer: `finalreview_business`, độc lập với người biên tập và ba agent khảo sát trước đó. Đây là một trong đúng hai lượt review cuối được yêu cầu; không phải kết quả chạy ứng dụng hoặc gate runtime.

**Kết luận sau recheck: READY FOR APPROVAL về nghiệp vụ/tính nhất quán; BR01–BR03 đều FIXED, không còn blocker do reviewer này nêu.** Trạng thái này dành cho chủ dự án duyệt spec, không phải cho phép triển khai hoặc chứng nhận runtime PASS.

## Phạm vi và cách kiểm

Đã đọc AGENTS.md, CLAUDE.md, SPEC-STANDARD.md trên nhánh docs; yêu cầu gốc trong tệp đính kèm; các quyết định Q1–Q14; proposal, bảy delta capability, toàn bộ 15 use case, design, 60 test case, traceability và tasks của `redesign-permission-model`. Đối chiếu thêm delta access-control trước chỉnh sửa và các báo cáo khảo sát/đính chính. Đọc chọn lọc code ở main `ef2c372aec60d8362549e47b7aedb27126129479` để kiểm hành vi in hiện có, guard mặc định và clear demo. Không chạy app, build, kiểm thử triển khai hoặc DB; không sửa bộ spec.

Các số dòng dưới đây ghi vị trí ở bản nhận review, trước khi người biên tập xử lý findings. Trạng thái xử lý và đối chiếu bản sửa được ghi ở cuối, không xóa lịch sử finding.

## Những phần đã khớp quyết định

- Ma trận catalog có đúng 15 mã; số mặc định owner/manager/cashier/waiter/accountant/kitchen lần lượt **15/12/7/3/3/0**. `floor.view` là nền của năm role đang hoạt động, không phải `floor.manage`; kitchen chưa bật.
- `receipt.reprint` mặc định chỉ owner/manager/cashier; accountant phải được grant. Quyền xem lịch sử không tự mở in lại, in lại không mở quyền thanh toán hoặc quyền K; in ban đầu vẫn thuộc payment.take.
- Q2 kiểm cả quyền target trước/sau, kể cả inactive; quyền theo trường và role reset được tách rõ. Không self role/override; owner chỉ được miễn ceiling với non-owner, không miễn invariants.
- Q13 cho owner hoặc employee.permission.edit đọc toàn bộ audit cùng store, kể cả target owner; không dùng ceiling để thu hẹp quyền đọc này. Q14 giữ toàn bộ, không GC và clear demo không xóa audit.
- Phạm vi docs-only, bằng chứng phase 27 và trạng thái NOT RUN của kiểm thử mới được phân biệt rõ. Catalog 15, projection, Storage/Realtime, recovery hạ tầng, draft/cache và task code chưa được mô tả là đã triển khai.

## Findings

### BR01 — P2 — Input use case chưa đủ để thực hiện contract đã chọn

**Vị trí:** [usecases.md:81](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:81), [usecases.md:315](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:315); contract đối chiếu tại [design.md:44](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:44), audit/request key tại [design.md:24](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:24).

**Tình huống:** người triển khai làm form đổi role theo bảng input UC03 sẽ chỉ gửi expectedRevision, trong khi design bắt expectedCatalogRevision khi sửa role và TC06 đã đưa trường này vào fixture. Tương tự, UC10 clear demo chỉ liệt kê confirmation/store context, trong khi audit identity của clear được khóa theo requestId và UUID request phải do client tạo; không có đầu vào để giữ cùng định danh khi mất ACK.

**Mong đợi:** mỗi input bắt buộc có kiểu, điều kiện bắt buộc và ví dụ thống nhất giữa UC/design/test. Bản hiện tại yêu cầu người thực hiện tự bổ sung hai trường ngoài bảng input. UC03 cũng cần ngoại lệ catalog stale ứng với thao tác đổi role.

**Đề nghị:** thêm expectedCatalogRevision vào UC03 khi patch role; thêm requestId UUID vào UC10 và ghi cùng requestId khi tra cứu/retry, không tự tạo ID mới. Làm rõ request shape clear trong design và thêm biến thể retry/no-op clear vào TC12 nếu contract clear dùng registry. Không cần quyết định nghiệp vụ mới.

### BR02 — P2 — Gate T15 phụ thuộc hành vi activation chỉ được làm ở T16

**Vị trí:** [tasks.md:9](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:9), [tasks.md:146](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:146), [tasks.md:155](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:155), [tasks.md:157](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:157).

**Tình huống:** T15 yêu cầu đủ TC01–60 và gate thất bại nếu thiếu test bắt buộc. TC51 thực hiện activation, TC48/49/53/54 cũng cần các nhánh chuyển đổi/rollback. Nhưng quy tắc đầu tasks chỉ cho activation cách ly ở T16; T16 phụ thuộc T15 và mới có phạm vi activation scripts/client update gate.

**Mong đợi:** task cung cấp khả năng diễn tập activation phải đứng trước gate yêu cầu bằng chứng activation. Bản hiện tại không có đường hoàn tất T15 mà vẫn tuân thủ giới hạn của T16.

**Đề nghị:** đặt phần tạo/diễn tập activation trước gate tổng hợp cuối, hoặc tách rõ T15 chỉ kiểm tập TC trước migration, T16 kiểm migration rồi một gate sau đó yêu cầu đủ 60 TC trên cùng fingerprint. Nêu subset chính xác và cập nhật dependency để việc làm tuần tự không tự vượt phạm vi task.

### BR03 — P2 — Chưa mô tả trạng thái UI sau một lần authorize in ban đầu

**Vị trí:** [design.md:148](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:148), [usecases.md:342](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:342), [testplan.md:1027](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1027), [testplan.md:1583](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1583).

**Tình huống:** cashier có payment.take nhưng bị deny receipt.reprint hoàn tất thanh toán, mở preview và bấm In. Design tạo PR1, authorize grant một lần; nếu người dùng hủy hộp thoại in trình duyệt rồi bấm In lần nữa, mỗi click sinh PR2 và contract từ chối FORBIDDEN. UC11/PERM28 chưa nói preview/nút chuyển sang trạng thái nào sau lần authorize đầu, còn TC60 chỉ bao double-click khi đang xử lý. UI hiện có không tự đóng preview sau lệnh in tại [ReceiptPreview.tsx:332](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:332), nên cần đặc tả thay đổi chứ không mặc định đã được xử lý.

**Mong đợi:** phân biệt retry cùng logical request khi chưa rõ ACK, một initial authorization đã dùng, và in lại chủ động; phải có trạng thái nút và câu giải thích tương ứng. Không cần biết số tờ giấy hoặc xác nhận người dùng đã in thật.

**Đề nghị:** mô tả rõ sau authorize/lệnh print đầu: chuyển sang reprint nếu có receipt.reprint, hoặc đóng/khóa lối in kèm thông báo nếu không có; retry mất ACK giữ PR1. Thêm ca bấm sau hoàn tất/hủy browser dialog, không chỉ double-click đang chờ. Giữ grant ngoài R1 và giới hạn không kiểm soát in ngoài app. Đây là hệ quả UI cần làm rõ từ lựa chọn kỹ thuật grant, không đề nghị thêm quyền hoặc hạ tầng máy in.

## Kết luận lượt đầu

**Chưa READY FOR APPROVAL tại lượt đọc đầu**, vì BR01–BR03 cần được xử lý để người triển khai không phải đoán input, trình tự gate hoặc trạng thái in. Không phát hiện mâu thuẫn mới trong các quyết định Q1–Q14. Việc sửa ba finding không đòi hỏi thay đổi ma trận quyền hoặc mở scope nghiệp vụ khác.

Người biên tập đang bổ sung các scenario baseline cho những khối MODIFIED sau kiểm tra OpenSpec; việc đó không được tính là kết quả review nghiệp vụ độc lập này. Reviewer sẽ đọc lại bản cuối và ghi xác nhận xử lý tại đây. Mọi TC mới vẫn NOT RUN.

## Đối chiếu sau sửa

Ngày 2026-09-15, reviewer đọc lại những phần đã sửa trong UC03/UC10/UC11/UC14, design, delta receipt/employee/session/onboarding, TC12/20/37/41/49/52/60 và kế hoạch gate. Không chạy ứng dụng hoặc kiểm thử runtime.

| Finding | Trạng thái recheck | Bằng chứng |
| --- | --- | --- |
| BR01 | **FIXED** | UC03 đã có expectedCatalogRevision khi patch role, thông báo PERMISSION_CATALOG_STALE và biến thể đổi role stale ở TC20. UC10 đã có requestId UUID, TC12 giữ ID/body khi retry và kiểm ADMIN_REQUEST_REUSED, không dùng retry để clear dữ liệu mới phát sinh. |
| BR02 | **FIXED sau đối chiếu bổ sung** | [TC49](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1324) nay chỉ kiểm preflight/eligibility không ghi DB; assertion gọi activation khi còn store blocked chuyển sang [TC51](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1372). T15 có đúng 55 TC candidate; TC48/51–54 chờ T16. T16 cung cấp activation rồi yêu cầu gate đủ 60 TC cùng fingerprint, không lấy kết quả T15 khác source để ghép PASS. |
| BR03 | **FIXED** | PERM28/design5/UC11/TC37/60 đã quy định một logical initial attempt, retry authorize mất ACK giữ PR1 trước dispatch; sau browser print đóng preview/bỏ grant kể cả hủy hộp thoại, có hai câu thông báo theo quyền reprint. Callback/ACK lặp không dispatch lần hai. |

Bổ sung scenario baseline/phase 27 không làm thay ma trận quyền đã chốt. UC14 đã có input bootstrap typed và giữ chính sách PIN hiện hữu; scenario Bootstrap lại đã đồng bộ ownerId khác → BOOTSTRAP_CONFLICT, field PIN tự chèn → INVALID_WRITE_REQUEST, retry nguyên request chỉ trả identity an toàn. Điều chỉnh prelock FK initiator của financial không cấp quyền thao tác cho initiator; actor hiện hành vẫn là người cần quyền. Đây là đối chiếu hợp đồng tài liệu, không xác nhận khóa đã được chứng minh bằng runtime.

Trong recheck đầu, BR02 còn một nhánh TC49 phụ thuộc activation script. Người biên tập đã tách nhánh đó sang TC51; reviewer đọc lại trực tiếp TC49/TC51 và tasks trước khi đóng finding. Không thay đổi số 30 requirement, 15 UC, 60 TC hoặc thêm reviewer.

**Kết luận cuối:** bộ spec **READY FOR APPROVAL trong phạm vi review nghiệp vụ và tính nhất quán**. Ba finding đã được khép bằng hợp đồng và oracle tài liệu cụ thể; không còn quyết định nghiệp vụ mới cần hỏi từ kết quả review này. Mọi task code/DB và toàn bộ TC của change vẫn chưa thực hiện; gate Realtime/Storage/DB thật vẫn cần chạy ở giai đoạn triển khai được cho phép.
