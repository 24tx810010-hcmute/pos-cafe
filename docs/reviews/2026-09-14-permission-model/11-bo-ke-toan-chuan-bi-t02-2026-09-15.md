# Bỏ vai trò Kế toán và bàn giao chuẩn bị PERM-T02

**Ghi chú sau triển khai:** đây là mốc chuẩn bị trước code. T02 đã hoàn tất local theo [biên bản T02](../../implementation-log/permission-t02-catalog-bridge-2026-09-15.md); quyết định bỏ Kế toán dưới đây vẫn hiệu lực.

Ngày 2026-09-15, sau nghiệm thu PERM-T01. Chủ dự án đồng ý bỏ Kế toán, yêu cầu cập nhật docs và chuẩn bị phần code. Lượt này chỉ sửa tài liệu; chưa viết migration hoặc application code T02, chưa commit/push, chưa áp lên Supabase thật. Không còn câu hỏi nghiệp vụ phải chốt cho quyết định bỏ role này.

## 1. Quyết định hiện hành

Giữ 15 quyền hành động. Catalog candidate chỉ có năm role dưới đây; không seed `accountant`, không giữ làm alias hoặc role disabled. Các nhắc đến sáu role/năm hoạt động hoặc defaults Accountant trong review 01–10 đã được quyết định này thay thế. Những quyết định khác của Q1–Q15 giữ nguyên.

| Vai trò | Mã | Hoạt động | Chọn khi tạo/chuyển role | Số quyền mặc định |
| --- | --- | --- | --- | --- |
| Chủ quán | owner | Có | Không; bootstrap/migration | 15 |
| Quản lý | manager | Có | Có | 12 |
| Thu ngân | cashier | Có | Có | 7 |
| Phục vụ | waiter | Có | Có | 3 |
| Bếp, dự phòng | kitchen | Không | Không | 0 |

Nguồn từng quyền là [ma trận PERM-02](../../../openspec/changes/redesign-permission-model/specs/access-control/spec.md), đối chiếu với D0 trong [testplan](../../../openspec/changes/redesign-permission-model/testplan.md). Bốn role hoạt động đều có `floor.view` không thể deny. `data.clearDemo` vẫn chỉ owner. Quyền xem lịch sử, báo cáo và in lại vẫn độc lập; mặc định in lại thuộc owner/manager/cashier. In trong preview vừa thanh toán vẫn theo `payment.take` và lifetime đã chốt ở Q15.

Lý do bỏ role: chủ quán/quản lý đã xem được số liệu; hiện chưa cần một lựa chọn Kế toán riêng. Nếu cần người chỉ xem, quản trị viên đủ quyền cấu hình overrides trên role có sẵn theo trần quyền trước/sau. Đánh đổi là phải cấu hình riêng; không thêm custom role hoặc preset UI mới trong change này.

## 2. Giữ đầy đủ tình huống kiểm thử

Fixture A — An giữ UUID `20000000-0000-4000-8000-000000000005`, đổi từ Accountant dự kiến thành waiter với cấu hình:

| Thành phần | Giá trị |
| --- | --- |
| Role | waiter |
| Grants | orderHistory.view, report.view |
| Denies | order.create, order.update |
| Quyền hiệu lực | floor.view, orderHistory.view, report.view |

A không có `payment.take` hoặc `receipt.reprint`. Test cấp riêng reprint phải chứng minh chỉ mở in từ nguồn đã được phép đọc, không mở thanh toán, không tự mở thêm nguồn dữ liệu hoặc thao tác K. Các tình huống TC03/07/13/39/56 giữ lại với cấu hình A thay thế; TC60 giữ hành vi lifetime in đã chốt. Không xóa các ca bảo mật cùng role bị bỏ.

TC01 đối chiếu 75 ô của năm role × 15 quyền: D0 ghi 60 ô của bốn role hoạt động, kitchen thêm 15 ô Không. TC19 gửi trực tiếp `accountant` phải bị từ chối `INVALID_EMPLOYEE_REQUEST`, không đổi employee/revision. Toàn change vẫn có 30 requirement, 15 UC, 60 TC và 18 task. Fixture A không phải một role thứ sáu.

## 3. Hiện trạng code và đầu vào T02

Code ứng dụng vẫn khai ba role legacy `admin/cashier/kitchen` tại [models.ts:1](D:/Workspace/pos-cafe/src/domain/models.ts:1). Planner T01 chỉ cần defaults cho các đích chuyển từ legacy tại [permission-migration-plan.mjs:30](D:/Workspace/pos-cafe/scripts/permission-migration-plan.mjs:30); mapping admin thành owner/manager hoặc giữ cashier/kitchen tại [235](D:/Workspace/pos-cafe/scripts/permission-migration-plan.mjs:235). Chưa có role Accountant trong đường code này, nên lượt bỏ role không cần migration chuyển nhân viên hiện hữu. Bộ default trong planner chỉ là oracle dự báo phục vụ migration, không phải catalog runtime dùng thay PERM-T02.

Đầu vào đã có từ [biên bản T01](../../implementation-log/permission-t01-preflight-2026-09-15.md):

- Inventory 204 surface và preflight/mapping synthetic chỉ đọc, run `27c1c3fd-3a85-4366-8017-8e6a04518996`.
- Oracle độc lập 6.144 hồ sơ legacy: 3 role × 2 trạng thái active × 4^5 trạng thái override. Bỏ Accountant candidate không đổi không gian legacy này.
- Run nghiệm thu `a52cf536-1221-45c1-a66a-fef55d7f43ac`: 152 tool tests + 30 DB tests. TC48/50 tổng thể còn PARTIAL, chưa có actual helper bridge T02.
- Runtime T01 là PostgreSQL cách ly trong WSL; đã dừng cụm riêng sau nghiệm thu. Không có bằng chứng Auth/REST/Storage/Realtime thật từ run đó.

## 4. Phạm vi code T02 đã chuẩn bị

Bám [PERM-T02](../../../openspec/changes/redesign-permission-model/tasks.md), [design 2/8/11.2](../../../openspec/changes/redesign-permission-model/design.md) và [delta bridge](../../../openspec/changes/redesign-permission-model/specs/write-idempotency/spec.md).

| Hạng mục | Công việc dự kiến | Ranh giới nghiệm thu |
| --- | --- | --- |
| Migration additive | Thêm migration sau `016_activate_write_protocol.sql`; catalog role/permission/defaults, state/revision và private registry theo design | Không sửa migrations 001–016, chưa đổi enum `employees.role` hoặc activate mapping 15 quyền |
| Seed candidate | Đúng owner/manager/cashier/waiter/kitchen, bốn enabled, ba selectable; 15 mã và defaults D0 | Không seed accountant; client legacy chưa nhìn thấy defaults candidate |
| Bridge | Helper dùng dữ liệu nhưng giữ nghĩa của ba role/năm quyền legacy, gồm configured effective và active guard | Đối chiếu actual với expected T01 trên đủ 6.144 hồ sơ; không thay expected bằng output helper |
| Harness/fixture | Profile legacy/bridge rõ ràng; full Supabase cách ly cùng marker, API/observer binding khi dùng API; fixture/setup tách công cụ read-only | Không nới preflight phase27, không dùng Storage shell giả để nhận full-stack PASS |
| Rehearsal và báo cáo | Additive → bridge → thử revert trên fixture riêng; manifest khóa source/runtime/config/migration/profile | K/R1/payload/hash, business rows và quyền legacy giữ đúng; báo từng biến thể thực chạy |

Những file có thể cần thêm/sửa khi thực hiện là migration mới trong `supabase/migrations/`, fixture bootstrap/preflight ở `scripts/permission-*` và `tests/contracts/`, cùng config runtime riêng cho môi trường cách ly. Đây là phạm vi dự kiến, chưa tạo file code. Domain/UI thuộc T03 trở đi; gateway, Realtime và activation theo task riêng trong cùng change.

ACL bridge phải giữ baseline đã kiểm ở T01: [016:261](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:261) cấp `authenticated` USAGE schema private và EXECUTE `private.is_verified_admin()` phục vụ RLS. Không dùng blanket-deny authenticated USAGE để tự tạo gate sai. Đồng thời không mở EXECUTE helper/registry mới cho app hoặc expose private qua API. Revoke raw reads của candidate đi theo T05/T07/T08 và bundle T16, không tự đóng một phần trên live trong T02.

## 5. Chuẩn bị môi trường trước khi chạy gate

Chủ dự án đã đính chính công cụ nhớ đã cài là **Supabase MCP**. MCP phục vụ kết nối dự án; sự có mặt của connector không chứng minh đã có local Supabase CLI/container runtime. Trong lượt docs này chưa có công cụ Supabase MCP callable được tìm thấy và không truy cập dự án thật.

Kiểm tra executable trên Windows và Ubuntu WSL chưa tìm được `supabase`, `docker` hoặc `podman` trong PATH. Vì vậy full stack theo design 11.2 vẫn cần được dựng trong T02; cụm PostgreSQL T01 không thay bằng chứng service. Đây là việc kỹ thuật phải làm khi thực hiện T02, không phải câu hỏi nghiệp vụ còn mở. Chưa cài hoặc khởi động service mới trong lượt chỉ chuẩn bị tài liệu này.

Trình tự khi bắt đầu code:

1. Ghi lại Git HEAD, dirty source và dependency baseline theo mục 6; kiểm working trees hiện có, giữ riêng code/docs. Không lấy HEAD làm đại diện cho code T01 còn dirty.
2. Chuẩn bị CLI/container runtime cách ly theo design; ghi phiên bản thực tế, image/config hashes, health và Node vào manifest. Giữ Node harness 24.16.0 theo design hiện hành.
3. Dựng dedicated project/container/volume và fixture riêng, loopback, marker/store IDs/schema checks. Cấp phiên/setup trước snapshot; config chỉ lấy từ `IDEM_ENV_FILE` được chỉ định. Không tự đọc `.env.local` của app hoặc chọn backend thật để chạy test.
4. Viết additive migration/bridge và chạy TC01/04/50 theo phạm vi T02. Gate có API phải chứng minh API/observer cùng deployment/DB; chỉ observer thì không tự đòi Auth keys. Không ghi secret, PIN/hash/token/DSN vào report.
5. Lưu source/runtime/profile/migration evidence cho từng run, kết quả revert và các invariants. Health service không thay kiểm thử gateway/Realtime ở T09/T10; phần chưa chạy ghi NOT RUN/PARTIAL, không toàn TC PASS.

## 6. Baseline bằng chứng cần khóa lại

Code HEAD khi chuẩn bị vẫn là `ef2c372aec60d8362549e47b7aedb27126129479`, có thay đổi T01 chưa commit. Từ đầu lượt docs này, bytes lockfile hiện tại khác bytes của lần nghiệm thu; giữ nguyên, không tự hoàn tác thay đổi ngoài lượt này.

| Mốc | Source fingerprint | SHA-256 pnpm-lock.yaml |
| --- | --- | --- |
| T01 nghiệm thu, 152 + 30 tests | `300af0d6fb5f7b9e6e9767dbddd0123ec692b738d958e06f4fa35213aa0923c6` | `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996` |
| Đầu lượt cập nhật docs bỏ Kế toán | `23faea31d3e365fbf531ec81b3c03c464a08c386627e0c5a3326f106a94d12b7` | `8eea3a22ef3172cd8ef8d260efbd9b0e7c9cd685bcc47f034d775016c1d10143` |

Đối chiếu fingerprint hiện tại bằng hash lock T01 đã lưu tái tạo đúng fingerprint T01 cũ. Đây là kiểm tra nhận diện nguồn, không phải chạy lại tests hoặc khẳng định dependencies hiện tại đã nghiệm thu. Trước gate T02 phải ghi baseline dependency thực dùng và chạy lại kiểm thử phù hợp cùng nguồn mới; không cộng kết quả khác fingerprint để tự nhận PASS. Quyết định bỏ Accountant không làm mất giá trị lịch sử của run T01, cũng không chứng minh runtime candidate đã đạt.

## 7. Điều kiện kết thúc phần chuẩn bị

Spec, use case, design, testplan, traceability và tasks đồng bộ năm role/15 quyền; roadmap/index dẫn về quyết định này. Kiểm tĩnh phải giữ đủ ID/truy vết, ma trận D0 trùng spec, fixture A có đúng ba quyền chỉ xem, không làm mất ca xem/in/K độc lập. Kiểm bytes code trước/sau để xác nhận lượt này chỉ sửa docs. T02 giữ checkbox chưa hoàn tất cho tới khi có code và bằng chứng gate; không chuyển kết quả kiểm docs thành kiểm thử ứng dụng.

Kết quả kiểm tĩnh ngày 2026-09-15: 30 file Markdown trong phạm vi change/review/index, 977 liên kết, 30 requirement, 15 UC, 60 TC, 18 task và 50 dòng thông báo được đối chiếu; không có lỗi hoặc requirement/UC thiếu test. Ma trận defaults khớp 15/12/7/3, kitchen rỗng; fixture A tính ra đúng floor/history/report. Đối chiếu workspace ghi 13 file docs hiện có được sửa và một bàn giao mới; 478 file code giữ nguyên bytes và source fingerprint. Chỉ T01 đang có checkbox hoàn tất. Đây là kết quả kiểm tài liệu, không chạy lại suite runtime 182 tests trong lượt này.
