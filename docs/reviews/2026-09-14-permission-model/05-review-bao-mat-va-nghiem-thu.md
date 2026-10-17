# Review độc lập 2 — bảo mật, transaction và nghiệm thu

Ngày 2026-09-15. Reviewer: `finalreview_security`. Đây là một trong đúng hai reviewer cuối của task spec. Reviewer đọc độc lập toàn bộ 13 file Markdown thuộc bảy loại artifact của `redesign-permission-model`, đối chiếu nguồn code sau phase 27; không dùng kết luận khảo sát trước làm bằng chứng thay code.

**Kết luận sau recheck: SR01, SR02 và SR03 đã được xử lý trong tài liệu; không còn blocker thuộc review này. Bộ spec đủ điều kiện trình chủ dự án duyệt.** Review chỉ kết luận về tài liệu và các cổng dự kiến. Không chạy application test, SQL, migration, Storage, Realtime hoặc thao tác cửa hàng thật; không có runtime PASS mới. Vòng đầu có một finding P1 và hai finding P2; chi tiết giữ dưới đây để truy vết.

## Baseline và phạm vi

- Code main: `ef2c372aec60d8362549e47b7aedb27126129479`; docs HEAD `f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` cùng working tree tài liệu đang được hoàn thiện.
- Đọc proposal, bảy delta, design, 15 use case, 60 test case, traceability và 18 task. Kiểm các quyết định Q1–Q14 trong proposal, đặc biệt floor nền, reprint độc lập, audit cho owner hoặc employee.permission.edit và retention toàn bộ.
- Đối chiếu `014`–`016`, helper phiên, grants/các overload, FK ledger, giao thức K và test concurrency hiện có; đọc adapter báo cáo/Storage/Realtime, đường in preview và bootstrap.
- Reviewer chỉ tạo/sửa báo cáo này; root chịu trách nhiệm sửa bộ artifact. Không tạo subagent hoặc sửa code.

## SR01 — P1: chưa khóa hết employee FK trước checkpoint quyền và TTL

**Vị trí vòng đầu:** [design.md:114](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:114), [design.md:127](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:127), [design.md:129](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:129). Các số dòng ghi nhận tại vòng đầu, có thể dịch sau sửa.

**Nguồn hiện trạng:** [016:87](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:87) insert `order_events` sau phần authority/expiry. [014:365](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:365) có FK `initiated_by` và `executed_by` đến employees. Takeover làm initiator khác executor.

**Scenario:** F thực thi K do C khởi tạo dưới phiên M, đã giữ actor/session và permission-catalog SHARE. W xếp hàng catalog EXCLUSIVE. A là admin single-target, khóa C UPDATE rồi chờ catalog SHARE sau W. F tới insert event cần FK KEY SHARE trên C: F chờ A, A chờ W, W chờ F. Tài liệu chỉ dùng pos-write để xử lý bulk; single-target admin vẫn tạo được lịch này. PostgreSQL có thể phát hiện hoặc sắp lại hàng đợi; review này không tuyên bố đã tái hiện runtime deadlock. Điều thiếu chắc chắn hơn là một FK wait mới có thể xuất hiện **sau** checkpoint cuối, trong khi TTL/session deadline vẫn tiếp tục trôi.

**Mong đợi:** mọi employee row mà financial effects/FK sẽ chạm phải được khóa trước checkpoint; không thêm vòng chờ employee sau catalog hoặc kiểm TTL xong mới chờ FK. Vẫn cho phép revoke commit khi execute chờ business lock như [TC-IDEM-007:107](D:/Workspace/pos-cafe/tests/contracts/writeConcurrency.contract.test.ts:107).

**Hướng xử lý:** xác định tập actor và các employee FK từ frozen K/plan, đặc biệt initiator; sau K/business locks lấy tập SHARE theo UUID tăng trước session/catalog; không lấy actor lock sớm riêng rồi mới mở rộng tập. Kiểm lại actor/session/catalog/clock/TTL sau toàn bộ waits. Initiator inactive vẫn được dùng làm tham chiếu lịch sử; chỉ executor cần quyền thực thi hiện hành. Không thêm outer store-authority SHARE hoặc pos-write cho single-target revoke. Bổ sung oracle race gồm financial takeover, single-target admin và catalog writer xếp hàng, cùng biến thể vượt deadline trong lúc chờ FK; chứng minh không có wait mới sau final checkpoint.

**Xử lý: ĐÃ SỬA, recheck 2026-09-15.** [Design:115](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:115) và [design:130](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:130) bổ sung prelock đầy đủ actor/initiator/FK theo UUID trước session/catalog, preliminary không khóa actor riêng, final clock sau waits. PERM-29 ghi thành ràng buộc bắt buộc. [TC41:1143](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1143) thêm lịch ba bên và lịch đảo vượt deadline; oracle kiểm lock trace/no-new-wait, không phụ thuộc một thông báo deadlock cụ thể. TC40 vẫn giữ revoke commit khi execute chờ order. Chưa có kiểm chứng runtime.

## SR02 — P2: bảng đầu vào UC thiếu trường mà design bắt buộc

**Vị trí vòng đầu:** [usecases.md:76](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:76), [usecases.md:310](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:310), [usecases.md:342](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:342), [usecases.md:442](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/usecases.md:442).

**Scenario và khoảng thiếu:**

- UC03 cho đổi role nhưng không liệt kê `expectedCatalogRevision` hoặc lỗi `PERMISSION_CATALOG_STALE`; [design.md:44](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:44) yêu cầu trường này khi đổi role. TC06 đã gửi trường đó, còn TC20 mới kiểm stale catalog ở reset/overrides. Implementer theo UC có thể tạo form bị server từ chối mọi lần đổi role.
- UC10 clear demo không có `requestId`, trong khi khóa audit/registry của cascade trong design phụ thuộc ID client này. Retry và payload mismatch cần một hợp đồng gọi cụ thể.
- UC11 không liệt kê `printGrantId`/`printRequestId` có điều kiện cho initial print mặc dù design cần chúng để chứng minh nguồn initial bên ngoài R1.
- UC14 gộp migration và bootstrap nhưng đầu vào chỉ mô tả migration; không có DTO bootstrap. [014:247](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:247) không nhận PIN tùy chọn, và [014:263](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:263) cấp PIN mặc định. Cụm “bootstrap với PIN khác” trong spec/TC52 cần nói rõ đây là field tự chèn bị chặn, không tự thêm khả năng đặt PIN lúc bootstrap.

**Mong đợi:** UC và design mô tả cùng một contract có kiểu, bắt buộc có điều kiện, lỗi và output. Giữ nghiệp vụ bootstrap/PIN đã chọn; không suy ra scope mới từ ví dụ negative.

**Hướng xử lý:** bổ sung các dòng input có điều kiện và lỗi tương ứng; khai báo request/bootstrap contract cụ thể; thêm biến thể role change catalog stale vào TC20, giữ ID/mapping hiện có. UC có thể dẫn DTO design nhưng phải chỉ rõ phần nào áp dụng cho từng luồng, không yêu cầu người triển khai tự đoán.

**Xử lý: ĐÃ SỬA, recheck 2026-09-15.** UC03 thêm expectedCatalogRevision có điều kiện và lỗi stale; TC20 thêm role-change stale. UC10 có requestId, TC12 kiểm retry/mismatch; UC11 có grant/request IDs và vòng đời authorize/dispatch/retry. UC14 thêm DTO bootstrap, provisioning identity và seed; [design:209](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:209) giữ PIN khởi tạo hiện có, không nhận field PIN, có registry provisioning private. TC52 kiểm input biên, ownerId conflict, field PIN tự chèn, rollback và seed failure. Delta store-onboarding tách ownerId conflict khỏi field PIN không hỗ trợ. Không cần quyết định nghiệp vụ mới để đóng finding này.

## SR03 — P2: cổng task yêu cầu kết quả phụ thuộc task chưa thực hiện

**Vị trí vòng đầu:** [tasks.md:9](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:9), [tasks.md:21](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:21), [tasks.md:142](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:142), [tasks.md:152](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:152).

**Scenario:** bản vòng đầu chỉ cho activation cách ly ở T16; T15 lại yêu cầu đủ TC01–60 trước khi T16 bắt đầu. TC48, TC51–54 có bước activate hoặc dùng script activation/rollback. T16 phụ thuộc T15 và mới tạo/diễn tập các script đó. T01 cũng ghi nghiệm thu TC48/49 nhưng phạm vi chỉ preflight không mutation.

**Mong đợi:** task preflight/candidate có cổng đạt được bằng output đã tồn tại ở đúng giai đoạn. Chạy một phần TC để kiểm preflight không được đánh toàn TC PASS khi bước activation chưa thực hiện.

**Hướng xử lý:** tách candidate từ fixture/schema cách ly khỏi diễn tập chuyển dữ liệu A→E; T01 chỉ nhận bằng chứng phần preflight, T15 nhận bộ TC không phụ thuộc script migration, T16 hoàn tất TC migration và gate tổng cuối đủ 60 TC trên fingerprint đúng. Mỗi biến thể đã chạy/chưa chạy có manifest; không dùng một tổng đếm làm ẩn phần chưa thực hiện.

**Xử lý: ĐÃ SỬA, recheck 2026-09-15.** T01 chỉ nhận phần preflight/expected fixtures, không nhận toàn TC48/50 PASS. T15 nhận 55 TC candidate: 01–47, 49/50, 55–60. TC49 hiện chỉ preflight read-only/eligibility; kiểm activation thật từ chối khi còn store blocked được chuyển sang TC51. TC50 chỉ bridge, không activation. T16 hoàn tất TC48/51–54 cùng diễn tập, rồi gate tổng đủ 60 TC trên cùng fingerprint. [Tasks:146](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/tasks.md:146), [TC49:1336](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1336) và [TC51:1387](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/testplan.md:1387) nhất quán. Chưa có task code nào được thực hiện.

## Những phần đã đối chiếu mà chưa thấy blocker tài liệu khác

- Q2 được áp cho cả target trước/sau, create chỉ after; inactive target giữ configured rights; role no-op không xóa deny; action permission, owner/self constraints và OCC không bị phép subset thay thế.
- Q13/Q14 nhất quán: owner hoặc employee.permission.edit đọc audit toàn store, kể cả owner target; quyền đọc không dùng target ceiling. Audit denied dùng envelope commit, rollback hạ tầng tách biệt; MAC/PIN/hash/token không ở audit; retention không tự GC.
- Inventory đọc/ghi có projection, raw SELECT/DML và overload closure; Storage ghi qua gateway với staging private, finalization DB và hạn chế cross-service atomicity. Realtime kiểm payload trước callback cùng tenant positive/negative controls.
- In lại được chốt ở cả ba bề mặt và server; initial grant ngoài R1 không dựa flag client. Giữ giới hạn đây là chức năng app, không kiểm soát bản sao hoặc số tờ giấy.
- Cache/draft/lifetime có scope store/employee/session, purge quyền mất và loại response cũ; no-op authority refresh không ngắt coordinator. Poll revision chung 30 giây foreground và trần 35 giây có điều kiện không được đánh đồng với gate Realtime thật.
- K giữ action permission hiện hành, terminal R1 lịch sử, pending TTL 24 giờ khác tuổi đơn và không tự replay. Migration có preflight/mapping, bridge, activation đồng bộ, rollback không bỏ giao dịch sau backup hoặc mở lại grants cũ.
- Testplan có oracle D0/P0, bốn nhóm kiểm thử, bypass trực tiếp, fault injection, negative controls và runtime gates tách biệt. Traceability là coverage kế hoạch; không gọi 60 TC chưa thực thi là PASS. Các task triển khai đều chưa hoàn tất và dừng trước rollout chưa được yêu cầu.

## Recheck và giới hạn kết luận

Reviewer đọc trực tiếp lại design, UC03/10/11/14, PERM-29, các delta receipt/bootstrap và TC12/20/41/49/51/52/60 cùng tasks sau root sửa. Kiểm thêm các heading/scenario phase 27 được bảo toàn, không còn heading Requirement trùng ở receipt/write-idempotency. Vòng đời initial một logical attempt đã mô tả retry cùng PR1 trước dispatch và không dispatch lại sau khi app đã gọi browser print; giới hạn không chứng minh giấy đã in vẫn rõ.

| Finding | Mức vòng đầu | Kết quả recheck tài liệu |
| --- | --- | --- |
| SR01 — FK wait sau checkpoint | P1 | Đã sửa design/requirement/test oracle |
| SR02 — Thiếu contract input UC | P2 | Đã sửa UC/design/delta/test cases |
| SR03 — Cổng task phụ thuộc bước tương lai | P2 | Đã tách candidate, preflight và diễn tập activation |

Không còn finding chưa xử lý trong phạm vi review này. Kết luận là **READY FOR USER SPEC APPROVAL**, không phải duyệt code hoặc phát hành. DB/Auth/REST, Storage/gateway, Realtime, E2E và diễn tập migration vẫn **NOT RUN** cho change này cho đến khi implementation được giao và các gate được thực hiện. Không suy runtime an toàn tuyệt đối từ việc tài liệu đã đóng finding.
