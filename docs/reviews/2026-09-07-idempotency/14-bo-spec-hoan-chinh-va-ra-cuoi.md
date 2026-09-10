# Bộ spec hoàn chỉnh và kết quả rà cuối

> **Đính chính 2026-09-09:** review ngoài phát hiện lỗi trình bày trên toàn bộ spec và phần khối lượng/lịch chưa được nêu đủ. Cụm “đã hoàn thiện tài liệu” dưới đây là kết luận ở mốc review contract, đã đánh giá quá cao mức sẵn sàng để dùng trong báo cáo. Đọc [tài liệu 15](15-doi-chieu-review-ngoai-va-bien-tap.md) và proposal hiện hành: nghiệp vụ đã có câu trả lời, nhưng lịch/phạm vi triển khai còn phải chốt. Báo cáo và hash cũ bên dưới được giữ làm lịch sử, không đại diện cho lần biên tập mới.

Ngày **09/09/2026**. Change: **add-idempotent-write-operations**. Kết luận: **đã hoàn thiện tài liệu để duyệt triển khai; không còn câu hỏi nghiệp vụ đang chờ trong phạm vi đã chốt**. Chưa viết ứng dụng hoặc chạy test tính năng mới.

## Bộ bàn giao

| Artifact | Nội dung |
| --- | --- |
| [Proposal](../../../openspec/changes/add-idempotent-write-operations/proposal.md) | Lý do, quyết định của chủ dự án và lựa chọn analyst, phạm vi, phụ thuộc |
| [Specs](../../../openspec/changes/add-idempotent-write-operations/specs/write-idempotency/spec.md) | 33requirement,7capability; delta giữ các scenario gốc còn áp dụng |
| [Use case](../../../openspec/changes/add-idempotent-write-operations/usecases.md) | 12luồng, input/output có kiểu, thông báo lỗi chính xác |
| [Design](../../../openspec/changes/add-idempotent-write-operations/design.md) | Schema, API/error, phiên/quyền, locks, price/source, TTL/cancel, audit/receipt, migration |
| [Testplan](../../../openspec/changes/add-idempotent-write-operations/testplan.md) | 93TCgốc + biến thể, fixture/expected trước code, runner/observer/barrier/fault/clock |
| [Traceability](../../../openspec/changes/add-idempotent-write-operations/traceability.md) | Không requirement hoặc UC nào thiếu TC ở mức thiết kế |
| [Tasks](../../../openspec/changes/add-idempotent-write-operations/tasks.md) | 43bước có đầu ra/kiểm chứng, khoảng≤2h mỗi bước, cổng duyệt và test độc lập |

Tổng13file Markdown cho bảy loại artifact. Mỗi ma trận tham số phải materialize thành test riêng có IDsuffix; **93 không phải số execution cuối**. Chỉ implementationmanifest và log thực chạy mới xác định số execution.

Mốc ứng dụng đối chiếu: main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c. [Proposal trước khi thay bằng bộ này](evidence/2026-09-09-proposal-truoc-bo-spec.md) giữ SHA-256 **1C6AD6EE2651540540DBBF74AE01E2F52DF49CA075BCB699851C2084EF3D75C5**, khớp đầu vào vòng review32PRE-IDEM. Các tài liệu07/10/11/12/13 được giữ làm lịch sử; quyết định hiện hành đọc theo proposal mới.

## Những điều đã cụ thể hóa để không phải đoán lúc code

- K gắn đúng xác nhận bất biến; retry không lấy version/lựa chọn sau polling, không chuyển split thành pay.
- Token nhân viên server, quyền hiện hành theo từng endpoint/action; đóng nguồn tự nâng quyền, RPC cũ và DML vượt giao thức.
- Đăng ký pending chưa phải đơn; effect+applied+R1 cùng commit; rejection bền nhưng business rollback.
- TTL24h cho lần bắt đầu áp dụng, kiểm sau khóa/validation; phiên12h là chính sách khác. Đơn48h còn nguyên và dùng K mới; applied cũ vẫn trả R1.
- Retained ID xác minh từ server; không tăng lượng giá cũ, không sửa modifier cũ, không gộp hai phần khác giá. Cũ2×30k+mới40k+option0=100k.
- Receipt và tổng chỉ active items; raw removed giữ snapshot để kiểm toán. Option quantity phải nằm trong tiền và hiển thị.
- Giữ giới hạn thanh toán tổng dương của flow/UI hiện hành, không mở rộng tính năng thanh toán0đ; modifier0đ và dòng0 trong tổng dương vẫn hợp lệ.
- Expected không lấy từ helper đang được kiểm; test DB không được chạy nhầm mock, thiếu môi trường/skip/không khám phá TC không được xem là pass.

## Ba review độc lập vòng cuối

Mỗi reviewer đọc riêng và đối chiếu code trong phạm vi được giao, không đọc báo cáo của nhau. Sau khi root sửa, từng reviewer đọc lại chính finding của mình và ghi kết quả đóng trong báo cáo. Đây là rà **thiết kế**, không phải chạy ứng dụng/SQL hoặc phê duyệt triển khai thay chủ dự án.

| Reviewer | Báo cáo gốc và recheck | Kết quả |
| --- | --- | --- |
| Nghiệp vụ/giá/receipt/phục hồi | [FIN-BUS](evidence/2026-09-09-final-spec-business.md) | 3finding, đã kiểm lại và đóng |
| DB/quyền/khóa/atomicity | [FIN-DB](evidence/2026-09-09-final-spec-database.md) | 5finding, đã kiểm lại và đóng |
| Fixture/oracle/automation | [FIN-ORA](evidence/2026-09-09-final-spec-oracles.md) | 5finding, đã kiểm lại và đóng |

13finding báo cáo có chủ đề trùng giữa reviewer; không tính thành13lỗi độc lập của ứng dụng. Các report giữ vị trí/hash của bản đã đọc. Sau các mốc recheck có chỉnh trình bày, bổ sung nguồn và hướng dẫn fixture/cổng công cụ; hash cuối của artifact nằm trong bằng chứng validation bên dưới.

### Đóng từng finding vòng cuối

| Finding | Sửa trong contract/test | Kiểm chứng thiết kế |
| --- | --- | --- |
| FIN-BUS-01, FIN-ORA-04 | Bỏ “multi vượt limit” không có trong model; negative required/single và positive multi tách riêng | TC036 positive35k/2options/1event;20/21options ởTC078 |
| FIN-BUS-02 | Đồng bộ tổng thanh toán>0, không đưa khả năng payment0 mới vào scope | TC092 core/DB/E2E; dòng0+tổng20k vẫn được thanh toán |
| FIN-BUS-03, FIN-DB-05 | Result.items chỉ active; raw removed giữ quantity/base/options trước xóa | TC028 oldquantity2/resultnew40k;TC037 rawquantity5/result[]/total0 |
| FIN-DB-01 | Start-session giữ employee lock từ trước PIN tới INSERTsession, cùng thứ tự resetPIN | TC005 hai lịch start/reset; không token PIN cũ sống sau resetcommit |
| FIN-DB-02 | Tách grants INSERT bàn(id/store hợp lệ/defaultstatus) và UPDATE layout | TC011 seedfalse→admin tạo bàn; B/Cdenied, identity/status updateblocked |
| FIN-DB-03 | Range bigint trước dựng PRICE_CHANGED.details | TC076 proposed4294967294 trả INVALID_WRITE_REQUEST, không output Money ngoài miền |
| FIN-DB-04 | Clock checkpoint sau tất cả validation/khóa, kiểm lại cả hạn phiên và hạnK | TC062 gate validation_k_expiry/validation_session_expiry; TC063 bốn blocker |
| FIN-ORA-01 | Bỏ deny payment.take của C trước grant trong positive replay | TC056 actor/creator giữ; grant+deny vẫn negative ởTC006 |
| FIN-ORA-02 | Ca TTL/retention đăng nhập phiên mới tại clock tương ứng, không gia hạnK | TestplanA5 gate token; TC005/062-session là ngoại lệ cố ý hết phiên |
| FIN-ORA-03 | Quantity boundary có actualcatalog0=quote0 | TC077 không bị PRICE_CHANGED che nhánh quantity |
| FIN-ORA-05 | Bắt base/option đổi bù nhau, tổng không đổi | TC035 quote35+2×7=49, actual37+2×6=49 vẫn PRICE_CHANGED |

### Đối chiếu các góp ý của vòng32PRE-IDEM

| Finding cũ | Được chuyển thành |
| --- | --- |
| BUS-01 | PRICE_CHANGED terminal/newK: IDEM17,TC034–035/076 |
| BUS-02 | Source ID/dirty note: IDEM16/27,TC027 |
| BUS-03 | Receipt components/quantity/DOM/print: IDEM19/32/33,TC050–051 |
| BUS-04 | Snapshot tên/giá/option khi thêm: IDEM15/26,TC029–030 |
| BUS-05 | K1/K2 và historical/current: IDEM09,TC055/083 |
| DB-01 | Nguồn quyền, grants, bootstrap/parent bypass: IDEM01–03,TC001–011/085 |
| DB-02 | Action×endpoint, revoke trong lúc chờ: IDEM02/24/25,TC006–007/056 |
| DB-03 | TTL sau mọi khóa/validation, realclock: IDEM11,TC062–065 |
| DB-04 | Race có tiến triển và hai bên thắng: IDEM05/08,TC019–024 |
| DB-05 | Terminal/fault/rollback hai chiều: IDEM07/12,TC052/068–072 |
| DB-06 | Retained giả nguồn: IDEM16,TC032–033 |
| DB-07 | Raw DB toàn bộ/audit/numbering/report: testplanG,TC037–041/046/055–056/066 |
| DB-08 | Schema/range/null/error taxonomy: IDEM04,TC047/074–081/092 |
| DB-09 | Counter atomic ngoàiR1: IDEM20,TC073 |
| ORA-01 | Explicit contract config/discovery/manifest: IDEM22,TC086 |
| ORA-02 | Fail-closed Supabase/preflight/no skip: IDEM21/22,TC084/087 |
| ORA-03 | Void NULL với paid fixture/positive control: TC047 |
| ORA-04 | Hai phần tử mảng, absent/null đều valid: TC015–017 |
| ORA-05 | Exactly one applied và mutation sensitivity: TC019/023/088 |
| ORA-06 | Đếm outbound/preview/print, không chỉ DBdelta: TC044–045/051–054 |
| ORA-07 | Recovery dùng server chung/hai context thật: TC055 |
| ORA-08 | Literal expected và R1 đúng trước equality: testplanG,TC030/050/088 |

## Kiểm tra đã chạy và phần chưa chạy

Kết quả cấu trúc/traceability/link/error references và OpenSpec strict được lưu ở [bằng chứng validation](evidence/2026-09-09-spec-validation.md). Công cụ OpenSpec từng phát hiện thiếu scenario gốc trong các MODIFIED block; đã bổ sung lại scenario, giữ thay đổi nghiệp vụ có chủ đích và validate lại.

Đây chỉ là kiểm tra tài liệu. Không lấy63testbaseline cũ để kết luận idempotency đúng. Chưa có code/migration/testcases mới trên main, chưa có testDBriêng được preflight trong lượt này, chưa có kiểm thử runtime hoặc kiểm tra sản phẩm sau triển khai.

Không commit/push trong lượt hoàn thiện này. Tài liệu nằm tại worktree docs để chủ dự án đọc; main vẫn7183b31, chỉ còn pnpm-lock.yaml untracked có sẵn, không bị sửa bởi công việc này.

## Cách dùng cho báo cáo và bước tiếp theo

Có thể dùng proposal/usecases/specs cho chương yêu cầu, design cho kiến trúc/đánh đổi, testplan/traceability cho **thiết kế kiểm thử**. Chương **kết quả kiểm thử** phải đợi log thực chạy trên code đã triển khai, ghi môi trường/SHA/expected/actual và các giới hạn.

Phần còn lại là duyệt bản spec cụ thể, triển khai theo tasks và tự động kiểm chứng với reviewer độc lập. Không còn việc yêu cầu chủ dự án giải lại bài toán modifier, giá hoặc tuổi đơn.
