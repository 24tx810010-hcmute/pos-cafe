# Lộ Trình Phát Triển

Thứ tự thực hiện và tiến độ của dự án. Tài liệu này trả lời câu hỏi **làm gì trước, làm gì sau, và đang ở đâu**.

Nó không chép lại quan hệ phụ thuộc giữa các change — phần đó nằm ở mục "Thứ tự phụ thuộc" trong `openspec/README.md` và ở section `## Phụ thuộc` của từng proposal. Ở đây chỉ có trình tự thực hiện, mốc thời gian và trạng thái.

| | |
| --- | --- |
| Bắt đầu | 2026-08-28 |
| Hạn cuối | 2026-12-21 |
| Ngân sách thời gian | 16 tuần tròn, kết thúc 2026-12-17, còn 4 ngày đệm |
| Ngân sách tiền | Không có. Mọi dịch vụ phải dùng được ở gói miễn phí |
| Yêu cầu đầu ra | Code chạy thật dùng được, không phải chỉ phân tích thiết kế |
| Cập nhật lần cuối | 2026-09-10, chuẩn hóa trình bày và bổ sung mô hình ảnh hưởng lịch; chưa duyệt thay đổi các mốc |

Dự án đi từ tiểu luận cuối kỳ lên đồ án tốt nghiệp. Hai việc bắt buộc đến từ nhận xét của giảng viên phản biện: kiểm soát việc tạo cửa hàng, và tổ chức lại phân quyền cho đúng một hệ POS vận hành thật.

## Quy Ước Trạng Thái

| Ký hiệu | Nghĩa |
| --- | --- |
| `[ ]` | Chưa bắt đầu |
| `[~]` | Đang làm |
| `[x]` | Đã xong, ghi ngày hoàn thành |

Cập nhật cột trạng thái ngay khi đóng một mục, và sửa dòng "Cập nhật lần cuối" ở trên.

**Quy ước ngày:** tài liệu điều hướng này dùng YYYY-MM-DD, kể cả ngày khi kể lại lịch sử. Lần chuẩn hóa 2026-09-10 chỉ đổi cách ghi, không đổi ngày thực tế hay phân bổ lại lịch. Bản báo cáo/evidence đã đóng băng ở file khác giữ nguyên hình thức gốc.

## Giai Đoạn 1 — Đồ Án Tốt Nghiệp

Mười mục, làm tuần tự. Thứ tự dưới đây được xếp lại ngày 2026-08-28 sau khi đo chi phí thực tế trên kho mã; lý do ở mục "Vì sao thứ tự này" bên dưới.

**Cập nhật 2026-09-08:** chủ dự án chọn ưu tiên online; mục 7–8 được giữ số để truy vết nhưng đã hoãn, không còn là cam kết tuần 11–13. Chưa phân bổ lại khoảng này hoặc tự kéo tính năng khác lên. Mục 2 tiếp tục ưu tiên và hướng tới đăng ký/khôi phục lệnh trên server; lịch thực hiện cần được rà lại khi chốt spec. Xem [quyết định phạm vi](reviews/2026-09-07-idempotency/07-uu-tien-online-va-khoi-phuc-tren-server.md).

| # | Tuần | Khoảng | Việc | Kết quả kiểm chứng được | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 2026-08-28 – 2026-09-03 | Chiến lược kiểm thử, lưới an toàn và môi trường thử nghiệm | Chiến lược kiểm thử viết trọn theo chuẩn bảy artifact và dùng được làm khuôn mẫu; bộ kiểm thử chạy xanh trên baseline hiện tại | `[x]` xong 2026-09-07 |
| 2 | 2, lịch gốc | 2026-09-04 – 2026-09-10, cần rà lại | Chống trùng và khôi phục bốn luồng ghi online, hướng đăng ký lệnh trên server | Cùng khóa chỉ áp dụng một lần; tìm lại được lệnh đã đăng ký sau mất phản hồi/đổi máy | `[~]` đã có bộ spec để duyệt; lịch/phạm vi chờ chốt, chưa implement |
| 3 | 3–5 | 2026-09-11 – 2026-10-01 | Tổ chức lại phân quyền | Sáu vai trò, mười bốn quyền, điều hướng suy ra từ quyền, đổi quyền có hiệu lực ngay | `[ ]` |
| 4 | 6 | 2026-10-02 – 2026-10-08 | Siết quyền xuống tầng dữ liệu, bản thu hẹp | Gọi thẳng vào cơ sở dữ liệu khi thiếu quyền bị từ chối | `[ ]` |
| 5 | 7–9 | 2026-10-09 – 2026-10-29 | Tài khoản chủ và kiểm soát tạo quán, giai đoạn 1 | Không có email đã xác thực thì không tạo được cửa hàng | `[ ]` |
| 6 | 10 | 2026-10-30 – 2026-11-05 | Khôi phục và vòng đời quyền sở hữu, giai đoạn 2 | Mất Store Key vẫn lấy lại được cửa hàng | `[ ]` |
| 7 | 11–12, lịch cũ | 2026-11-06 – 2026-11-19, đã bỏ cam kết | Kho cục bộ và hàng đợi ý định | Giữ proposal cho hướng phát triển sau | **Hoãn 2026-09-08** |
| 8 | 13, lịch cũ | 2026-11-20 – 2026-11-26, đã bỏ cam kết | Hòa giải và trạng thái đồng bộ offline | Hoãn phần offline; UX kết quả chưa rõ của bốn luồng ghi nằm trong mục 2 | **Hoãn 2026-09-08** |
| 9 | 14 | 2026-11-27 – 2026-12-03 | Triển khai thật, làm cứng, sao lưu, **và đo tải lúc chạy** | Bản chạy thật có địa chỉ truy cập được, có sao lưu định kỳ, và có số đo tải thật thay cho ước lượng | `[ ]` |
| 10 | 15–16 | 2026-12-04 – 2026-12-17 | Viết báo cáo, chụp lại ảnh màn hình, đồng bộ tài liệu | Bản thảo báo cáo đầy đủ | `[ ]` |

Bốn ngày từ 2026-12-18 tới 2026-12-21 để nguyên làm đệm và tập demo. Không xếp việc vào đó.

### Cảnh báo lệch lịch, chưa xử lý

**Cập nhật 2026-09-09:** [bộ task mục 2](../openspec/changes/add-idempotent-write-operations/tasks.md) có 43 đầu mục, ước lượng **76,5 + 2n giờ công**, với n là số task sửa lỗi phát sinh. Phần cố định đã gồm 6 giờ cho ba reviewer; 78,5 giờ ứng với n = 1. Đây chưa phải lịch được duyệt. Task 09–14 (12 giờ, đã nằm trong tổng) đưa phần phiên/quyền/đóng đường vượt giao thức vào mục 2, sớm hơn mục 4 theo lịch gốc; phần rộng hơn của mục 4 vẫn giữ riêng. Xem [phân tích và phương án cần chốt](../openspec/changes/add-idempotent-write-operations/proposal.md).

**Ghi chú lịch sử trước khi mục 1 hoàn tất ngày 2026-09-07:** lúc lập cảnh báo, mục 1 chưa bắt đầu dù khoảng thời gian của nó đã trôi qua, và hạn chốt câu hỏi của mục 2 đã quá 3 ngày. Ước lượng trễ khoảng một tuần khi đó không thay thế cho việc tính lại toàn lịch sau khi có bộ spec hiện hành.

**Phân tích 2026-09-10, chưa duyệt đổi lịch:** chủ dự án làm hằng ngày nhưng không có quỹ giờ cố định. Bảng kịch bản tại [proposal mục 2](../openspec/changes/add-idempotent-write-operations/proposal.md) tính dây chuyền tới mục 10, với mốc bắt đầu thử 2026-09-11, một task sửa lỗi và tạm giữ tám tuần cho mục 3–6. Kịch bản 40 giờ/tuần dùng hai trong ba tuần hoãn offline, giữ lịch báo cáo; kịch bản 20 giờ/tuần cần thu hồi một tuần trước báo cáo, nếu không thì viết đủ hai tuần sẽ kết thúc 2026-12-24. Không tự dùng bốn ngày đệm hoặc coi 20/40 giờ là cam kết của chủ dự án. Cần ước lượng lại các mục còn lại và cập nhật dự báo từ giờ thực làm/đầu ra đã kiểm chứng; chưa kết luận phải cắt riêng mục 2.

**Duyệt bắt đầu 2026-09-10:** chủ dự án duyệt bộ spec hiện hành, cho phép push docs rồi triển khai code; chỉ push code sau khi các kiểm tra bắt buộc đạt. Phạm vi mục 2 giữ nguyên, lịch dự báo cập nhật theo thực tế. Việc chưa ấn định quỹ giờ không còn chặn bắt đầu triển khai.

Chưa dời ngày vì việc điều chỉnh ảnh hưởng các mục phía sau và cần chủ dự án chọn phương án về quỹ giờ, cách tổ chức việc hoặc phạm vi. Không mặc định phải cắt bớt chức năng; cần chốt phương án trước khi sửa bảng lịch chính thức.

### Ánh xạ sang change

| Mục | Change tương ứng |
| --- | --- |
| 1 | `define-test-strategy` làm **trọn** theo chuẩn bảy artifact, đóng vai khuôn mẫu cho mọi change sau; cộng lát mỏng của `expand-e2e-coverage` và `setup-test-data-environment` |
| 2 | `add-idempotent-write-operations` |
| 3 | `redesign-permission-model` |
| 4 | `enforce-permissions-at-database`, bản thu hẹp |
| 5, 6 | `add-owner-account-and-store-provisioning`, chia hai giai đoạn theo quyết định số 18 của proposal |
| 7, hoãn | `add-offline-data-layer` |
| 8, hoãn | `add-offline-sync-conflict-resolution` và phần đồng bộ của `add-offline-status-ux` |
| 9 | `measure-runtime-load` — đo, không sửa |

### Vì sao thứ tự này

Thứ tự cũ xếp theo quan hệ phụ thuộc khái niệm. Thứ tự này xếp theo **chi phí thực tế trên kho mã**, đo ngày 2026-08-28.

**Phát hiện quyết định: ba lời gọi tiền bị khai báo lại toàn bộ mỗi lần đụng tới.** Ba migration lớn nhất kho mã, mỗi cái quanh 1.100 tới 1.180 dòng, đều là cùng ba hàm gửi đơn, thanh toán và tách đơn thanh toán được chép lại nguyên vẹn. Lần gần nhất chép hơn nghìn dòng chỉ để chèn thêm vài dòng kiểm tra quyền.

Bốn việc trong danh sách cùng đụng ba hàm đó: khóa chống trùng, tổ chức lại phân quyền, siết quyền xuống tầng dữ liệu, và sau này là cơ chế giảm giá. Thứ tự cũ rải chúng ra tuần 2, tuần 9 và giai đoạn 2, tức viết lại ba hàm ít nhất ba lần cách nhau hàng tháng. Mỗi lần chép là một cơ hội đánh rơi một nhánh xử lý.

Ba điều chỉnh rút ra:

**Kéo khóa chống trùng lên tuần 2, trước phân quyền.** Nó thêm tham số vào đúng ba hàm mà hai mục sau sẽ viết lại. Làm trước thì các lần viết lại sau đã mang chữ ký cuối cùng; làm sau thì phải sửa chữ ký thêm một lần nữa, kéo theo khoảng 1.150 dòng kiểm thử adapter phải cập nhật lại. Nó cũng là việc nhỏ nhất trong nhóm nên rủi ro thấp, hợp làm việc đầu tiên chạm vào luồng tiền.

**Gộp một bước tái cấu trúc vào mục 2.** Tách phần kiểm tra quyền trong ba hàm ra một chỗ dùng chung, để những lần sửa sau không phải chép lại toàn bộ thân hàm. Đây là thay đổi giữ nguyên hành vi nên bộ kiểm thử hiện có là đủ để kiểm chứng, và nó làm rẻ mọi việc phía sau.

**Đưa siết quyền tầng dữ liệu lên tuần 6, ngay sau phân quyền.** Nó sửa đúng phần kiểm tra quyền trong ba hàm mà mục 3 vừa dựng lại. Làm liền kề thì tái dùng ngay cấu trúc còn nóng; để cách bốn tuần như thứ tự cũ thì phải đọc lại từ đầu và viết lại lần nữa.

Điều chỉnh thứ ba tạo ra một xung đột với ghi chú trong `openspec/README.md`, rằng tài khoản chủ nên làm trước siết quyền vì nó thêm một nhánh chủ sở hữu vào chính sách bảo mật. Cân nhắc: bề mặt chính sách bảo mật chỉ 129 dòng và việc thêm nhánh là cộng thêm chứ không viết lại, trong khi bề mặt ba lời gọi tiền là hơn 1.100 dòng mỗi lần. Chi phí chép lại lớn hơn hẳn nên ưu tiên gom nhóm lời gọi tiền.

Điều này **chỉ đúng với bản thu hẹp** của việc siết quyền, tức mọi lời gọi nhạy cảm đọc lại quyền từ cơ sở dữ liệu. Nếu sau này quyết định làm bản đầy đủ có danh tính riêng cho từng nhân viên ở tầng chính sách bảo mật, thì tài khoản chủ **bắt buộc** phải làm trước.

**Không đổi:** tài khoản chủ giữ nguyên vị trí sau phân quyền, vì nó gắn vai trò chủ quán vào tài khoản chủ. Bù lại nó có bề mặt va chạm thấp nhất trong cả nhóm — chạm vào adapter xác thực, bảng cửa hàng, chính sách bảo mật và một thành phần chạy phía máy chủ, gần như không đụng luồng đơn và thanh toán.

**Lịch sử kế hoạch mục 7 và 8 — đã hoãn 2026-09-08.** Các điều kiện dưới đây thuộc kế hoạch cũ, không còn là yêu cầu phải triển khai hoặc làm nguyên mẫu trong giai đoạn 1:

1. Giữ đúng phạm vi hẹp: chỉ đơn mới, không thanh toán ngoại tuyến. Không nới trong giai đoạn 1.
2. Làm sau một cờ tắt. Hết tuần 13 mà chưa vững thì tắt cờ, demo trực tuyến, trình phần ngoại tuyến ở dạng thiết kế cộng nguyên mẫu. Đây là chốt cứng, không gia hạn sang tuần 14.
3. Chưa có kiểm thử xung đột chạy xanh thì chưa tính là xong.

Phần ngoại tuyến chỉ chạm `submit_order_changes` trong ba lời gọi tiền, và không đổi chữ ký của nó. Nhờ khóa chống trùng ở mục 2, việc phát lại một thao tác đã gửi dở không sinh bản ghi trùng — đây là lý do mục 2 phải xong trước.

### Cổng chặn không được bỏ qua

Hai điểm dưới đây, nếu vượt qua mà chưa đạt điều kiện, sẽ dẫn tới tình huống chỉ khôi phục được bằng bản sao lưu.

**Cổng 1 — trong mục 3, trước khi đổi kiểu cột vai trò.** Kiểm thử đối chiếu phải chứng minh hàm kiểm tra quyền mới trả về đúng kết quả như bảng cũ cho ba vai trò cũ. Đây là task 2.3 trong danh sách việc của `redesign-permission-model`.

**Cổng 2 — trong mục 5, trước khi xóa dữ liệu cũ.** Phải có bản sao lưu đầy đủ cả cơ sở dữ liệu lẫn kho ảnh, và phải có xác nhận rõ ràng của chủ dự án. Quyết định số 9 của proposal là xóa sạch dữ liệu tạo bằng luồng cũ, không chuyển đổi.

### Việc chạy song song

Các việc dưới đây không chiếm tuần riêng, nhưng phải xong trước hạn ghi kèm, nếu không mục tương ứng sẽ bị chặn.

| Việc | Hạn | Trạng thái |
| --- | --- | --- |
| Chốt bảy câu hỏi còn lại của `enforce-permissions-at-database` | **trước tuần 6** | `[ ]` |
| Chốt nghiệp vụ và hoàn thiện bộ spec `add-idempotent-write-operations`; hệ chưa vận hành thật theo chủ dự án, không tuyên bố đã đo/tái hiện sự cố thật | **trước tuần 2** | `[x]` tài liệu 2026-09-09; implementation/test mới chưa làm — xem [rà cuối](reviews/2026-09-07-idempotency/14-bo-spec-hoan-chinh-va-ra-cuoi.md) |
| Dựng đường gửi email ở mức 1: Gmail riêng của dự án, App Password, cấu hình SMTP, gửi thử xác nhận không vào thư rác. Không phải mua gì, không phải chờ duyệt | trước tuần 7 | `[ ]` |
| ~~Viết ba artifact còn thiếu cho `add-owner-account-and-store-provisioning`~~ | trước tuần 7 | `[x]` xong 2026-08-31 |
| Chốt và viết spec cho nhóm offline nếu mở lại trong tương lai | Chưa xếp lịch | **Hoãn 2026-09-08** |

Hai hạn đầu **gấp hơn hẳn thứ tự cũ**: khóa chống trùng chuyển lên tuần 2 nên các câu hỏi của nó phải chốt gần như ngay, và siết quyền tầng dữ liệu chuyển từ tuần 9 lên tuần 6.

Việc tên miền và email tuy hạn muộn hơn trước nhưng vẫn nên khởi động sớm, vì phần lớn là thời gian chờ chứ không phải thời gian làm. Rủi ro cụ thể nếu để trễ: mã một lần rơi vào thư rác thì không đăng nhập được, và mô hình không mật khẩu không có đường vào thay thế.

### Lịch sử 2026-08-30: đổi nhóm ca làm việc lấy nhóm ngoại tuyến

**Quyết định này đã được thay thế ngày 2026-09-08:** ưu tiên online và hoãn nhóm offline. Phần dưới giữ để giải thích lịch sử; không còn là lập luận cho phạm vi đang cam kết. Nhóm ca làm việc cũng chưa được kéo lại vào giai đoạn 1.

Ngân sách 16 tuần chỉ đủ cho đúng một nhóm tính năng mới. Đến 2026-08-30 chỗ này đổi từ nhóm ca làm việc sang bán hàng khi mất mạng, phạm vi hẹp.

Lý do đổi:

- **Quyết định online-only vốn là hoãn theo thời gian, không phải lựa chọn kiến trúc.** `docs/requirements.md` xếp nó ở mục "Ngoài Phạm Vi Hoặc Hoãn" kèm câu "không được tính là thiếu so với baseline tiểu luận hiện tại". Ngân sách 16 tuần làm ràng buộc sinh ra nó hết hiệu lực, nên đây là gỡ một khoản hoãn.
- **Luận điểm mà nhóm ca làm việc phục vụ đã được chứng minh ở chỗ khác.** `redesign-permission-model` tự nó đã chứng minh việc thêm quyền là thêm dữ liệu: mười bốn quyền lưu ở tầng dữ liệu, điều hướng suy ra từ quyền, không có bảng ánh xạ vai trò sang module. Nhóm ca chỉ là bằng chứng thứ hai cho cùng luận điểm, nên mất nó rẻ hơn nhiều so với mất bằng chứng thứ nhất.
- **Nhóm ngoại tuyến chứng minh một luận điểm khác mà chưa có gì chứng minh:** ranh giới ports và adapters đủ mỏng để cắm một adapter cục bộ mà không sửa `domain`, `core` hay `features`. `src/architectureBoundaries.test.ts` kiểm chứng việc này bằng máy, không phải bằng lời.
- **Giá trị demo cao hơn hẳn.** Rút mạng trước hội đồng, vẫn nhận đơn, nối lại, đơn tự lên. Nhóm ca là CRUD cộng báo cáo.

Rủi ro đã cân nhắc: đây là nhóm dễ bị hỏi sâu nhất, vì phần hòa giải sau khi có mạng là chỗ dễ hở. Cách quản là thu phạm vi cho danh sách tình huống đủ ngắn để liệt kê hết và kiểm thử hết, chứ không né chủ đề. Với phạm vi hẹp thì danh sách còn sáu tình huống, không phải hai mươi.

Nhóm ca làm việc chuyển sang giai đoạn 2, tầng G.

## Giai Đoạn 2 — Sau Khi Bảo Vệ

Các change còn lại, xếp theo tầng. Không gắn ngày. Trong mỗi tầng, dấu mũi tên là quan hệ bắt buộc trước sau.

**Tầng A — Vận hành và chất lượng.** Làm trước nếu sản phẩm đi vào dùng thật, vì nó quyết định khả năng bảo trì.

- `define-test-strategy` → phần còn lại của `expand-e2e-coverage` và `setup-test-data-environment` → `add-ci-pipeline` → `add-cd-deployment`
- `add-provider-admin-console`: màn quản trị cho nhà cung cấp, gồm xem, tạm ngưng và xóa cửa hàng, và nới hạn mức số cửa hàng. Phụ thuộc phần tài khoản chủ đã làm ở giai đoạn 1

**Tầng B — Bán hàng nâng cao.** Nhóm dễ thấy nhất với người dùng cuối.

- `add-discount-engine` → `add-promo-codes-and-vouchers`, `add-happy-hour-pricing`, `add-promotion-management-screen`

**Tầng C — Khách hàng.**

- `add-customer-registry` → `add-loyalty-points` → `add-loyalty-management-screen`

**Tầng D — Tồn kho.**

- `add-inventory-core` → `add-recipe-based-stock-deduction`, `add-inventory-management-screen`

**Tầng E — Nhiều cửa hàng.** Nền dữ liệu đã được dựng sẵn ở giai đoạn 1 nên tầng này thu hẹp lại còn phần giao diện và quan hệ nhân viên với nhiều nơi.

- `add-multi-store-ownership` → `add-cross-store-reporting`

**Tầng F — Ngoại tuyến, toàn bộ nhóm đã hoãn lại 2026-09-08.** Gồm kho cục bộ, hàng đợi, hòa giải và UX đồng bộ, cả phạm vi hẹp từng được đưa vào giai đoạn 1. Chưa cam kết thời điểm thực hiện; thanh toán offline, sửa đơn server khi offline và Background Sync vẫn thuộc hướng phát triển sau.

Ba proposal được giữ làm tài liệu phân tích lịch sử. Các ước lượng và quyết định cũ phải được rà lại nếu mở nhóm này; hiện không dùng chúng để phân bổ thời gian đồ án.

- `add-offline-data-layer` → `add-offline-status-ux`, `add-offline-sync-conflict-resolution`

**Tầng F2 — Hiệu năng và phiên chạy dài.** Thêm ngày 2026-09-07 sau khi rà mã: tải của hệ gần như toàn bộ là đọc do polling, không phải ghi.

`measure-runtime-load` **đã được kéo lên giai đoạn 1, mục 9 tuần 14** ngày 2026-09-07. Lý do: nó chỉ đo nên không có rủi ro hồi quy, và tuần 14 là lần đầu tiên có bản chạy thật để đo — đo trên môi trường phát triển sẽ ra số không phản ánh production. Trả lời được câu "hệ chịu tải bao nhiêu" bằng số đo thay vì ước lượng là thứ đáng có trước buổi bảo vệ.

Còn lại ở tầng này:

- `optimize-runtime-load`, **bắt buộc sau** `measure-runtime-load`. Giữ ở giai đoạn 2 vì nó đụng nhịp đồng bộ giữa các máy, tức một năng lực đã đặc tả trong `multi-device-sync`, và đó là loại rủi ro không nên nhận trong 16 tuần đã kín.
- `handle-long-running-session`. Vẫn ở giai đoạn 2. Sau khi hoãn offline ngày 2026-09-08, không còn mâu thuẫn lịch với mục 7–8; quan hệ "nên trước `add-offline-data-layer`" chỉ áp dụng nếu mở lại nhóm offline.

**Tầng G — Ca làm việc.** Chuyển xuống đây ngày 2026-08-30 để nhường ba tuần cho nhóm ngoại tuyến. Vẫn là ứng viên mạnh nhất cho nhóm tính năng kế tiếp.

- `add-employee-time-clock` → `add-shift-management`

## Nguyên Tắc Xếp Thứ Tự

Bốn nguyên tắc đã dùng để dựng trình tự trên, ghi lại để lần sau xếp tiếp không phải suy luận lại.

1. **Phần bắt buộc đi trước phần co giãn được.** Hai vấn đề phản biện là bắt buộc; nhóm tính năng là phần cắt được nếu hụt thời gian.
2. **Cái gì viết lại chính sách bảo mật thì gom lại làm một lượt.** Ba mục 3, 4 và 5 đều đụng chính sách bảo mật mức dòng; làm rời rạc sẽ phải viết lại nhiều lần.
3. **Nền tảng đi trước thứ dựng trên nó.** Mô hình quyền phải xong trước, vì mọi nhóm tính năng phía sau đều sinh quyền mới.
4. **Việc có thời gian chờ thì khởi động sớm nhất có thể.** Tên miền và xác minh người gửi email là thời gian chờ, không phải thời gian làm.
5. **Gom các việc cùng đụng một vùng mã đắt tiền vào một khối liền nhau.** Đo trước xem vùng nào đắt, rồi xếp theo đó. Ở dự án này vùng đắt nhất là ba lời gọi tiền, vì chúng bị khai báo lại toàn bộ mỗi lần sửa.
6. **Trong một khối, làm việc nhỏ nhất trước**, để các việc sau kế thừa chữ ký cuối cùng thay vì phải đổi thêm một lần nữa.

## Ghi Chú Khi Chuyển Sang Báo Cáo

Tài liệu này dùng tên định danh của các change để tra cứu nội bộ. Khi đưa nội dung sang báo cáo, mô tả theo tên chức năng nghiệp vụ chứ không dùng tên định danh, theo đúng quy tắc trong [report-source-map.md](report-source-map.md).

Giai đoạn 1 phục vụ chương kế hoạch và phương pháp thực hiện. Giai đoạn 2 phục vụ chương hướng phát triển; mỗi mục ở đó đã có một proposal viết sẵn kèm phân tích phạm vi, ảnh hưởng và các câu hỏi phải chốt, nên dẫn được ở mức thiết kế chứ không phải liệt kê suông.
