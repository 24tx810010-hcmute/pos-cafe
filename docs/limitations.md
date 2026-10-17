# Limitations & Future Work

**Đính chính 2026-09-14:** các mốc triển khai trong đoạn10/09 dưới đây là lịch sử. Migration014–016 đã áp và được kiểm catalog ngày13/09; frontend Production tại `ef2c372` đã xác minh ngày14/09, nhưng business smoke cửa hàng thật chưa chạy. [Bằng chứng](implementation-log/phase-27-timeout-followup-2026-09-14.md). Bộ spec quyền mới đã sửa sau review ngoài/Q15 ngày15/09 và qua hai review lại. Ngày2026-09-15, chủ dự án đã cho phép bắt đầu PERM-T01 và cập nhật docs; T01 đang thực hiện, chưa nghiệm thu, T02+ chưa bắt đầu và không commit/push. N01–N03 đã đóng ở mức tài liệu; chưa triển khai hoặc khắc phục các giới hạn quyền đọc/cập nhật quyền UI dưới đây. Xem [bàn giao hiện hành](reviews/2026-09-14-permission-model/08-ban-giao-chuan-bi-sau-review-2026-09-15.md).

Cập nhật 2026-09-10 theo `main@3ada48c` đã push và nghiệm thu. Phạm vi/SHA/bằng chứng ở [phase 27](implementation-log/phase-27-idempotent-write-operations.md); chưa triển khai migration lên môi trường thật.

## Bảo Mật Và Phân Quyền

- Phase 27 bổ sung phiên nhân viên được server xác minh và khóa đường ghi tài chính/nguồn quyền trực tiếp. Không còn mô tả spoof employee ID là đường ghi được phép sau activation v1. Nguồn: `014_write_identity_and_ledger.sql:162`, `016_activate_write_protocol.sql:258`.
- Store Auth/RLS vẫn là phạm vi cô lập dữ liệu đọc; chưa xây đầy đủ quyền SELECT theo từng nhân viên, chủ sở hữu thật hoặc chống brute-force PIN.
- **PIN quản trị cấp lúc tạo cửa hàng vẫn là giá trị cố định dùng chung cho mọi cửa hàng mới, và không có bước ép đổi.** Bảng nhân viên không có trường nào ghi nhận PIN đã đổi hay chưa, nên hệ không phân biệt được PIN mặc định với PIN người dùng tự đặt. Giảng viên phản biện nêu đích danh điểm này; đã có proposal xử lý là `force-default-pin-change`, chốt hướng ngày 2026-09-12, chưa triển khai.
- UI giữ snapshot role/quyền tại đăng nhập; server kiểm quyền mới khi ghi, còn giao diện phản ánh đầy đủ sau khóa/đăng nhập lại.
- Token chỉ giữ memory nên mất local cần nhập PIN lại. Đơn và K đã đăng ký khôi phục từ server; nháp chưa đăng ký có thể mất.

**Hướng phát triển:** ép đổi PIN mặc định ở lần đăng nhập đầu (`force-default-pin-change`), provisioning chủ thật, giới hạn thử PIN (chưa có proposal), audit quản trị quyền và policy đọc theo scope được duyệt.

### Khôi phục PIN owner thủ công trong giai đoạn chuyển tiếp

**Cập nhật T04 ngày 2026-09-16:** Q5 cho phép phát hành mô hình quyền trước khi email recovery có sẵn. [Candidate T04](implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md) đã kiểm contract DB cách ly cho owner recovery với audit/rollback; chưa activate trên cửa hàng thật, chưa chạy xác minh con người hoặc bàn giao PIN. Role DB riêng `pos_owner_recovery` không tự được cấp cho operator thật; cấp membership và kênh nhập PIN phải nằm trong runbook phát hành được phép. [Quyết định và đối chiếu Q2/Q5/Q6](reviews/2026-09-14-permission-model/02-doi-chieu-q2-q5-2026-09-15.md).

Quy trình bắt buộc khi triển khai:

1. **Người thực hiện:** người quản trị hạ tầng được chủ dự án chỉ định, có định danh operator và quyền can thiệp DB phù hợp. Không giả danh nhân viên owner; không cung cấp credential hạ tầng cho nhân viên quán.
2. **Xác minh:** mở hồ sơ với mã yêu cầu, store/owner đích, người yêu cầu, thời gian và lý do; đối chiếu hồ sơ hỗ trợ ngoài app đã được xác minh độc lập theo Q6. Không coi Store Key, số cửa hàng hoặc text tự khai là chứng minh sở hữu. Thiếu bằng chứng thì dừng ca khôi phục. Chưa thêm `recovery_contact` vào settings.
3. **Kiểm trước:** xác nhận đúng store/owner đang hoạt động, operator, phiên bản dữ liệu và đường can thiệp được phép. `service_role` bypass RLS không tự thay thế grants hoặc bỏ kiểm tra trong RPC; runbook phải chỉ rõ loại quyền và đường dùng thực tế.
4. **Thực hiện nguyên tử:** khóa đích theo thứ tự khóa chung, chỉ đổi PIN owner đã xác minh, thu hồi phiên cũ và ghi audit trong cùng transaction. Audit lỗi thì không hoàn tất đổi PIN. Giữ role, quyền, tenant, giao dịch, K, receipt và lịch sử. Không mở endpoint reset owner cho role/override trong app.
5. **Bằng chứng và bàn giao:** audit giữ operator, mã hồ sơ, store/target, thời điểm, hành động và kết quả; không lưu PIN, hash PIN hoặc token. Giữ hồ sơ vận hành ngoài DB. Operator tạo PIN riêng từng ca, nhập qua công cụ không ghi log/lịch sử, bàn giao trực tiếp qua kênh riêng đã đối chiếu hồ sơ xác minh độc lập; không dùng contact từ settings làm bằng chứng. Không đưa PIN vào ticket, audit hoặc báo cáo. Người nhận đăng nhập và tự đổi PIN; chưa có cơ chế ép đổi tự động trong change này.
6. **Kiểm sau:** một lần can thiệp đúng đích; PIN/phiên cũ không dùng được; audit khớp hồ sơ. Kiểm những thuộc tính kỹ thuật này trên DB cách ly trước khi dùng quy trình. Xác minh con người và bàn giao bí mật được kiểm bằng quy trình riêng; không thay bằng mock rồi báo đã kiểm thực tế.
7. **Điều kiện kết thúc:** khi email recovery đã triển khai và nghiệm thu, dừng runbook chuyển tiếp cho reset thông thường; rà/gỡ quyền hoặc ngoại lệ tạm dành riêng cho nó. Quyền quản trị hạ tầng không tự biến mất; can thiệp khẩn cấp còn lại phải có chính sách riêng.

**Rủi ro được chấp nhận:** người có quyền hạ tầng đủ mạnh có thể can thiệp/mạo danh owner; audit DB không chống giả mạo được chính người toàn quyền quản trị DB. Đây là ranh giới tin cậy hạ tầng được công bố, không phải quyền ủy quyền cho manager. Quy trình chuyển tiếp kết thúc bằng email recovery; không tuyên bố rủi ro quản trị hạ tầng hoàn toàn biến mất sau mốc đó.

### Giới hạn của thiết kế permission model ngày 2026-09-15

Các điểm sau thuộc [spec dự kiến](../openspec/changes/redesign-permission-model/proposal.md), chưa phải kết quả triển khai:

- `receipt.reprint` kiểm soát chức năng in lại của POS. Người đã được đọc hóa đơn vẫn có thể lưu/chụp/in dữ liệu ngoài ứng dụng; browser print không xác nhận số bản in giấy. Không viết lại R1 để hạn chế sao chép.
- Q15 cho in tiếp trong preview initial còn mở với payment.take; chỉ mất quyền in thì ẩn nút/hủy pending, còn quyền đọc thì vẫn xem. Server authorize chỉ kiểm eligibility hiện hành, không tiêu hao grant hoặc biết popup đã đóng; client không persist/reopen grant từ K. Callback của click cũ không tự in lại, lệnh đã gửi tới browser không hứa thu hồi được.
- Giữ toàn bộ audit applied/denied/no-op; owner và người có `employee.permission.edit` đọc chi tiết cùng store. Chưa có GC hoặc màn audit, dung lượng cần theo dõi khi vận hành; clear demo không xóa audit.
- Storage I/O không cùng transaction với DB; cleanup lỗi có thể để lại private orphan. Runbook đối chiếu handle/object không còn được menu tham chiếu trước khi xóa, lưu kết quả/lỗi, thử lại với cùng object binding; không xóa theo path client tự gửi.
- Ảnh mới qua private gateway: origin GET phụ thuộc Edge/DB, có thêm lượt gọi/bytes/độ trễ chưa đo. URL ổn định với Cache-Control: private, max-age=60, must-revalidate; cache chỉ giảm request khi client đã có bản fresh. Revalidate vẫn tới origin, kể cả304 giảm body bytes. Lỗi no-store; byte đã tải/cached không thu hồi ngay khi unlink. T09/T15 đo tách cache fresh/revalidate/origin, invocation/bytes/latency/lỗi; không suy mỗi render gọi Edge hoặc mất mọi CDN. Gateway lỗi hiện placeholder thay treo luồng bán hàng.
- **N03, 2026-09-15:** chưa có biện pháp hạn chế lưu lượng riêng cho function GET công khai. UUID làm khó đoán assetKey, không chống gọi dồn URL đã biết hoặc request hỏng. Hành vi khi vượt hạn mức do nhà cung cấp quyết định, ngoài kiểm soát ứng dụng; không ghi chính sách provider hoặc hứa miễn phí/ngừng phục vụ như dữ kiện. Chưa mở rate limit trong T01. Public bucket/CDN đã được cân nhắc nhưng không chọn vì cần durable publication intent và xử lý DB/Storage; không coi đó là phương án duy nhất hoặc khẳng định không có biện pháp giảm nhẹ miễn phí.
- **N02, 2026-09-15:** preflight T01 chỉ đọc PostgreSQL cách ly qua observer DSN và profile, không cần/gọi Auth/REST hoặc nhận các keys đó. Giữ marker/engine/store IDs/checksum/schema guards; checksum file khớp marker chỉ xác nhận bản ghi marker, không chứng minh schema/grants hiện hành chưa bị sửa. API/observer binding chỉ thuộc gate sử dụng dịch vụ.
- Mục tiêu hội tụ quyền 35 giây chỉ áp dụng khi tab hiển thị, có mạng và toàn chuỗi revision/snapshot/apply xong trong 5 giây. Resume/reconnect phải xác minh trước protected render/query. Gate Realtime và Storage thật chưa chạy trong task tài liệu.

## Online Và Realtime

- Ứng dụng là online-only; mất kết nối thì không có local queue/database để tiếp tục bán hàng.
- Realtime dùng event làm tín hiệu invalidate/refetch và có polling hồi phục; khoảng polling 5 giây không phải SLA cứng.
- `SupabaseRealtimePort` chưa subscribe `menu_item_option_groups`. **Đính chính 2026-09-14:** migration [008:54](D:/Workspace/pos-cafe/supabase/migrations/008_modifier_rework.sql:54) đã có lệnh thêm bảng vào publication nếu publication tồn tại; chưa kiểm trạng thái publication live trong lượt này. Không đồng nhất thiếu subscription adapter với thiếu migration publication. Truy vấn menu **không** có refetch theo chu kỳ nên không có lưới an toàn bù lại: thao tác chỉ gắn/bỏ modifier group khỏi món không tới máy khác cho tới khi máy đó reload hoặc kênh realtime resubscribe. Proposal bổ sung subscription là hồ sơ độc lập, chưa nằm trong mốc Git phân quyền này.
- Self-heal khi reconnect có unit test, nhưng cần diễn tập cloud hai thiết bị định kỳ để xác nhận hành vi thực tế.

**Hướng phát triển:** bổ sung subscription bảng nối, telemetry độ trễ, trạng thái kết nối hiển thị có ý nghĩa và adapter local-first nếu scope cho phép.

## Thanh Toán Và Đối Soát

- Payment thật chỉ hỗ trợ tiền mặt. Thẻ, chuyển khoản và QR chỉ là seam/preview, không có processing hoặc callback đối soát.
- `store_settings.qr_info` chưa được Payment Settings persist qua `settingsRepo`.
- Instant pay giữ hai đơn độc lập; ledger/audit v1 lưu ID nguồn/kết quả của lần tách nhưng chưa có màn tổng hợp cả phiên bàn.
- “Một payment cho mỗi order paid” là invariant của transaction v1 với DML client bị thu hồi; schema chưa thêm unique constraint trên `payments.order_id`.
- Chưa có refund, discount/voucher, price override, mở két, ca làm việc hoặc kiểm két.

**Hướng phát triển:** provider abstraction cho thanh toán điện tử, transaction/refund ledger, constraint hoặc invariant DB phù hợp và liên kết bill tách nếu nghiệp vụ cần truy vết.

## Giá Và Ghi Nhận Doanh Thu

Phase 27 thay replace-submit bằng retained/new. Phần đã lưu giữ source ID, giá và options; giảm số lượng/sửa note không định giá lại. Phần thêm mới kiểm catalog hiện tại, kể cả khi tên và modifier giống phần cũ. Nguồn: `src/features/pos/orderFlow.ts:73`, `:183`, `015_write_business_helpers.sql`.

- Chưa có price history của menu theo thời gian; snapshot order/receipt chỉ cho biết giá đã bán.
- `business_date` vẫn chốt lúc tạo đơn; bàn quên thanh toán qua ngày không tự chuyển ngày doanh thu. Đây là quy tắc hiện hành, không lấy hạn pending 24 giờ để đóng đơn.
- Chưa có discount/voucher/price override; cột discount vẫn là seam.
- Receipt legacy thiếu metadata được đánh dấu; không tự gán creator hoặc tên lịch sử không biết.

**Hướng phát triển:** price history hoặc thay quy tắc ngày kinh doanh chỉ khi có yêu cầu được duyệt và test báo cáo tương ứng.

## In Ấn Và Bếp

- `ReceiptPreview`/browser print đáp ứng demo web; `BrowserPrintPort` hiện no-op và không tích hợp máy in native/USB/ESC/POS.
- Phiếu gửi bếp chỉ là preview từ dòng mới thêm; không có queue backend, trạng thái chế biến hoặc màn bếp vận hành.
- Role `kitchen` và component scaffold còn trong code/schema nhưng đã ẩn khỏi nav, PIN và Employees Drawer.

**Hướng phát triển:** service/adapter in cục bộ, kitchen ticket persistence, item status workflow và kitchen display riêng trước khi mở lại role bếp.

## Phạm Vi Sản Phẩm

- Không có quản lý kho/nguyên liệu, loyalty, khách hàng, chấm công, ca làm việc hoặc chuỗi chi nhánh.
- Không có gộp/chuyển bàn.
- Order history dùng fallback `Khách lẻ` vì domain chưa có customer entity.
- Custom role và module permission per-employee chưa có; catalog hiện chỉ gồm 5 quyền hành động.
- Một số phần đã có code hoặc schema nhưng **chưa dùng trên UI** vì không có entry point: tìm kiếm và lọc theo bàn trong lịch sử đơn, cột giảm giá trên đơn, `store_settings.qr_info`, `stores.is_active`, xuất báo cáo ra tệp, kitchen queue. Danh sách đầy đủ kèm lý do ở mục seam trong [features.md](features.md#seam-có-code-nhưng-chưa-dùng-trên-ui); không kể chúng như chức năng hiện hành.
- Upload asset runtime chỉ có ảnh món; decor và nền bàn là catalog built-in.

**Lý do hoãn:** các phần này mở rộng đáng kể data model, workflow và testing nhưng không cần để chứng minh core POS cafe nhỏ trong thời gian tiểu luận.

## UX Và Hiệu Năng

- Ứng dụng landscape-first; portrait chỉ đưa hướng dẫn xoay thay vì cung cấp toàn bộ POS workflow.
- Exit animation drawer/popup còn là polish tùy chọn.
- Bundle chính còn vượt ngưỡng cảnh báo 500 KB; build xác minh lại ngày 2026-08-21 cho một chunk JS duy nhất 1.347,25 KB minified / 368,88 KB gzip (CSS 62,61 KB / 12,17 KB gzip). Chưa có code splitting.
- Catalog asset built-in làm tăng static deployment; chưa có pipeline tối ưu/chuyển toàn bộ ảnh phù hợp sang WebP.
- Chưa có tìm kiếm/favorite/quản lý vòng đời cho asset decor và nền bàn.
- **Ghi POS trong một store là tuần tự.** Coordinator v1 của cả bốn nghiệp vụ lấy cùng một advisory lock phạm vi store (`':pos-write'`), nên hai thu ngân gửi đơn cho hai bàn khác nhau vẫn phải xếp hàng chờ nhau. Đây là đánh đổi để đơn giản hóa tính đúng cho quán nhỏ; chưa có số liệu để khẳng định không ảnh hưởng tốc độ. Chưa có đo đạc thời gian giữ khóa hay thử tải đồng thời. Rủi ro tăng nếu thêm việc vào trong cùng transaction (ví dụ trừ tồn kho theo định lượng) hoặc số thiết bị ghi tăng. Chi tiết ở [architecture.md](architecture.md).

**Hướng phát triển:** code splitting theo drawer/module, lazy-load chart/editor, audit bundle và tối ưu asset.

## Kiểm Thử, Triển Khai Và Artefact

- Đã có coverage nghiệp vụ và kiểm thử nhiều tầng; xem số liệu theo ngày ở [testing.md](testing.md). Chưa có load test hoặc performance benchmark sản xuất.
- Cloud E2E gần nhất không cùng ngày với local baseline; xem [testing.md](testing.md).
- Frontend Production tại `ef2c372` đã được xác minh ngày 2026-09-14 bằng metadata và byte JS/CSS; URL và evidence ở [follow-up phase 27](implementation-log/phase-27-timeout-followup-2026-09-14.md). Business smoke trên cửa hàng thật và các tab còn giữ bundle cũ chưa được xác minh; không suy bằng chứng artifact thành nghiệm thu nghiệp vụ live.
- Nhánh `docs` không giữ ảnh binary. Bộ screenshot current cũ từ 2026-06-20 không đại diện đầy đủ UI phase 23.
- Supabase free có thể pause; demo cần kiểm tra project và chuẩn bị hotspot.

**Hướng phát triển:** chụp lại artefact theo baseline hiện tại ở nơi lưu báo cáo, ghi URL/version/date deploy, bổ sung coverage và rehearsal checklist.

## Thứ Tự Ưu Tiên Đề Xuất

1. Bổ sung realtime subscription cho `menu_item_option_groups`.
2. Nghiệm thu và rollout giao thức v1 theo cửa sổ dừng ghi; giữ giá từng phần đã được hiện thực trong phase 27.
3. Chụp screenshot/diagram và xác minh deployment live cho báo cáo.
4. Code splitting và tối ưu asset để xử lý chunk-size warning.
5. Hoàn thiện các phần bảo mật còn hoãn: ép đổi PIN mặc định (`force-default-pin-change`), provisioning chủ thật, chống brute-force PIN (chưa có proposal), audit quản trị và quyền đọc.
6. Chọn một hướng sản phẩm lớn tiếp theo: kitchen, thanh toán điện tử hoặc offline-first; không mở đồng thời cả ba.
