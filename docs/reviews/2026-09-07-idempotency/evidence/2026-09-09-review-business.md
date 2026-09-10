# Rà độc lập thiết kế test — nghiệp vụ, giá và khôi phục

Ngày: **09/09/2026**. Người rà: agent độc lập, chỉ đọc code và tài liệu; không trao đổi với agent review khác.

## Kết luận

**Chưa đủ để giao viết automation mà không phải tự thiết kế thêm.** Đây là một danh sách ca chuẩn bị có hướng nghiệp vụ khá rõ, chưa phải testplan hoàn chỉnh. Các phép tính hiện hành **100.000đ, 107.000đ, 65.000đ, 80.000đ → 40.000đ đều đúng**. Không có lý do mở lại câu hỏi sửa modifier món cũ: thao tác đó đã bị loại khỏi phạm vi.

Các thiếu sót chính là expected của chênh giá chưa thành hợp đồng trạng thái/lỗi, thiếu phép kiểm nguồn gốc dòng trong nhận diện thay đổi, và expected hóa đơn còn quá chung để phân biệt ba đường dựng giá đang khác nhau. Cần hoàn thiện các điểm dưới đây trước khi chuyển các PRE-IDEM thành TC. Đây là công việc analyst; không cần chủ dự án chọn lại quy tắc giá hoặc tự thiết kế endpoint.

**Không có bug nào được chạy tái hiện trong lượt này.** Những nhận định về code là kết luận từ đọc mã ở commit dưới đây, không phải kết quả E2E/DB. Không chạy lại baseline, không đọc secret, không gọi cloud, không sửa ứng dụng/test/input. File này là đầu ra duy nhất.

## Phạm vi và nguồn đối chiếu

- Code: `D:/Workspace/pos-cafe`, HEAD được kiểm bằng `git rev-parse HEAD`: **7183b31a4ca27ed2be3ca7097f391fd2c07f806c**.
- Hướng dẫn đã đọc: `D:/Workspace/pos-cafe-docs/AGENTS.md`, `CLAUDE.md`, `openspec/SPEC-STANDARD.md`.
- Đã đọc toàn bộ 32 dòng PRE-IDEM và các biến thể giá/TTL trong [proposal working tree](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:1); dùng [12, mục 7](D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md:210) làm chốt mới nhất. Đối chiếu phần liên quan của 10 và 11; không dùng ví dụ lịch sử 67.000đ/72.000đ làm yêu cầu.
- Kiểm filesystem change hiện chỉ có `proposal.md` và `.openspec.yaml`; không có testplan/UC/design/traceability chính thức. Không ghi thiếu artifact thành một phát hiện mới về bug ứng dụng.
- Các hằng số tiền bên dưới tính tay từ yêu cầu và fixture; **không gọi `calculateSnapshotTotal`, `buildPayableLines`, `makeTicket` hoặc hàm implementation nào để sinh expected**.

Trong bảng kiểm cuối, `P:n` là dòng n của proposal ở đường dẫn trên; `SQL:n` là dòng n của `D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql`.

## Những điểm đã tốt

1. Phân biệt register với ghi đơn, ghi đơn với payment, lệnh 24 giờ với tuổi đơn và thời gian giữ kết quả. Các TTL-01…06 không tự thay chính sách ngày báo cáo.
2. Hai tình huống mất ACK quan trọng đã có riêng: L1 vẫn còn sau split (PRE-10) và L1 biến mất khiến lựa chọn quay về toàn bộ phần còn lại (PRE-11). Code có đúng hai đường này tại [PaymentDrawer.tsx:51](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:51), [orderFlow.ts:395](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:395).
3. Ca 24 đã thêm cùng modifier 0đ, tránh một fixture chỉ vô tình tách dòng vì cấu hình khác. Đã có cả chạm menu và nút cộng, split phần cũ/phần mới, giá quay lại mức cũ và retry sau đổi menu.
4. Đã yêu cầu commit trước khi bỏ ACK, barrier cho race, đồng hồ server sau chờ khóa, fixture độc lập và kiểm DB thật cho transaction/quyền. Không đánh đồng 63 baseline pass với 32 ca tương lai.
5. Không tự resume khi reconnect/focus, không tự in do replay, tiếp quản theo quyền và không thêm đối chiếu tiền mặt bắt buộc đều được giữ đúng phạm vi.

## Findings cần xử lý

### BUS-01 — P1: PRE-IDEM-26 chưa có expected đủ để tự động hóa bước từ chênh giá sang xác nhận mới

**Loại:** thiết kế chưa đủ; chính tài liệu đã công nhận phần contract còn thiếu. **Nguồn:** [P:239](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:239), P:200, [12:110](D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md:110).

Ca chỉ kết thúc bằng “người dùng xem giá mới”; chưa chỉ rõ K1 trả trạng thái cuối nào, mã lỗi nào, trường nào chứa chênh giá, và hành động nào tạo K2. Một test chỉ thấy thông báo rồi dừng vẫn có thể bỏ lọt việc server đã ghi món bằng giá khác, hoặc UI sửa payload K1 khi chấp nhận lại. Input hiện hành chỉ có ID/số lượng/option/ghi chú và version, chưa có chứng cứ giá đã được trình bày cho người xác nhận: [inputs.ts:40](D:/Workspace/pos-cafe/src/domain/inputs.ts:40), [orderFlow.ts:281](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:281). Các mã lỗi giá/lệnh mới cũng chưa có trong [appError.ts:1](D:/Workspace/pos-cafe/src/core/appError.ts:1).

**Fixture và chuỗi cần ghi vào testplan:**

1. Đơn O mở, version 5, L_old có A ×2, base snapshot 30.000đ, không phụ thu; tổng **60.000đ**, bàn occupied, 0 payment. Menu hiện A=40.000đ; option M có `priceDelta=0`, quantity=1.
2. Người dùng thêm A ×1 chọn M, nhìn tổng **100.000đ**, xác nhận và register K1. Chưa execute: O vẫn **60.000đ**, version 5, 0 payment.
3. Đổi giá base server thành 45.000đ, giữ version O=5; execute K1. **Không ghi thêm món, không đổi tổng/version O, không payment**. K1 giữ nguyên nội dung/hạn ban đầu; UI trình bày giá phần mới 45.000đ và tổng dự kiến **105.000đ**.
4. Người dùng chủ động chấp nhận giá mới tạo K2; K2 thành công đúng một lần: old **60.000đ**, new **45.000đ**, tổng **105.000đ**, O còn open, version 6, bàn occupied, payment vẫn 0. Replay không thêm phần thứ ba.

Tách fixture chỉ thay option `0 → 5.000đ`, giữ base 40.000đ và version O=5: số tiền sau xác nhận mới cũng là **105.000đ**, nhưng snapshot new phải là base **40.000đ**, M **5.000đ**, không phải base 45.000đ. Đây là biến thể đã được yêu cầu ở P:200 nhưng chưa có dữ liệu trong dòng PRE-26. Thêm nhánh giá giảm `40.000 → 35.000đ`, tổng mới **95.000đ**, theo cùng quy tắc cho xem lại khi giá khác; không chỉ kiểm tăng giá.

**Analyst phải chốt:** schema nhận diện giá đã xác nhận, tên/mã lỗi và thông báo chính xác, trạng thái/lưu kết quả K1, endpoint read để lấy giá mới, quy tắc K2. Các số tiền và yêu cầu không âm thầm ghi giá khác đã có; không cần hỏi lại chủ dự án. Automation chỉ nên viết sau khi các expected về trạng thái/lỗi này được ghi chính thức.

### BUS-02 — P2: Ca giá chưa kiểm việc giữ nguồn gốc trong nhận diện “đơn đã thay đổi”

**Loại:** ca bị thiếu; có đường sai cụ thể suy từ mã, chưa chạy tái hiện. **Nguồn yêu cầu:** P:33–36, PRE-24/25 tại P:237–238. Các ca hiện có kiểm tổng và snapshot sau gửi, nhưng không có thao tác làm tổng/đa tập nội dung không đổi trong khi dòng bị sửa khác nhau.

Mã hiện bỏ định danh và giá khỏi phép so sánh draft, sau đó sắp thứ tự theo nội dung:

```ts
// src/features/pos/orderFlow.ts:244–251
.map((item) => ({
  menuItemId: item.menuItemId,
  quantity: item.quantity,
  note: item.note ?? null,
  options: item.options.map((option) => `${option.optionValueId}:${option.quantity}`).sort(),
}))
.map((item) => JSON.stringify(item))
.sort((a, b) => a.localeCompare(b));
```

[orderFlow.ts:261](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:261) dùng kết quả này để quyết định changed; `:272` chọn payment nếu không đổi. UI gắn nhánh này thành “Thanh toán” hoặc “In/Gửi đơn” tại [OrderDrawer.tsx:78](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:78), `:99–107`, và mở payment trực tiếp tại `:176–178`.

**Ca phân biệt được lỗi:** dựng hai dòng đã ghi cùng `menuItemId`, cùng option M=0đ, mỗi dòng quantity=1. L30 giá 30.000đ, note=`ít đá`; L35 giá 35.000đ, note=null. Tổng **65.000đ**. Trên UI đổi ghi chú L30 thành trống, L35 thành `ít đá`, rồi xác nhận.

**Expected độc lập:** có thay đổi cần gửi; L30 vẫn 30.000đ và note=null; L35 vẫn 35.000đ và note=`ít đá`; tổng **65.000đ**; 0 payment; mỗi snapshot vẫn gắn đúng nguồn/dòng. Sau mất ACK và phục hồi cùng K, nội dung này vẫn đúng và không tăng version lần nữa. Chỉ so tổng hoặc tập hai ghi chú sẽ không phát hiện ghi sai dòng. Không có thao tác sửa modifier cũ nào trong ca này.

Đây là lý do contract phải giữ tham chiếu phần đã ghi xuyên suốt draft/so sánh/submit, không chỉ sửa phép tính tiền. Luồng cũ còn sinh ID draft mới tại [orderFlow.ts:66](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:66), và SQL bắt ID mới rồi thay toàn bộ tại [SQL:655](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:655); test nên xác minh nguồn gốc theo contract mới, không lấy ID draft hiện hành làm bằng chứng đã giữ ID nghiệp vụ.

### BUS-03 — P1: PRE-IDEM-32 phải kiểm thành tiền từng dòng ở cả receipt trả về và receipt dựng lại

**Loại:** expected/fixture chưa đủ phân biệt lỗi; dấu hiệu sai đã thấy trong code, chưa chạy. **Nguồn:** [P:245](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:245). Dòng PRE-32 nêu “receipt có 2 topping ×5.000đ” nhưng không chốt base, số ly, tiền nhận, đối tượng bị split hay đường in lại. Fixture O1 mặc định ở P:207 lại không có option. Không được lẳng lặng biến O1 thành fixture có topping sau khi thanh toán.

Ba đường giá hiện không tương đương:

| Đường đọc mã | Bằng chứng | Suy ra với 1 ly base 30.000đ, 2 phần topping ×5.000đ |
| --- | --- | --- |
| Receipt từ full/split SQL | [SQL:1134–1140](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:1134), [SQL:407–413](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:407): `unitPrice = oi.unit_price`, option chỉ thành chuỗi | Dòng có unitPrice **30.000đ**, chuỗi topping ×2, dù total thanh toán là **40.000đ** |
| Receipt từ mock | [mockRepoShared.ts:36](D:/Workspace/pos-cafe/src/adapters/mock/mockRepoShared.ts:36): `unitPrice: item.unitPrice`; tên option có ×quantity | Cũng có unitPrice **30.000đ**, total **40.000đ** |
| Dựng từ OrderDetail khi xem tạm tính/in lại lịch sử | [ReceiptPreview.tsx:12](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:12): `sum + option.priceDelta`, không nhân quantity; tên option cũng không có quantity | Dòng có unitPrice **35.000đ**, mất ×2, total **40.000đ** |

UI in thành tiền bằng `line.unitPrice * line.quantity` tại [ReceiptPreview.tsx:201](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:201). Full/split success dùng `result.receipt` tại [PaymentDrawer.tsx:185](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:185); xem tạm tính dùng builder tại `:136–138`; in lại lịch sử dùng builder khác từ dữ liệu tải lại tại [OrderHistoryDrawer.tsx:181](D:/Workspace/pos-cafe/src/app/drawers/admin/OrderHistoryDrawer.tsx:181).

**Fixture đề nghị:** O mở, version 5; L có **2 ly**, mỗi ly base 30.000đ + topping T quantity=2, delta=5.000đ; total **80.000đ**. Tách **1 ly**, nhận **50.000đ**. Expected paid bill: **40.000đ**, tiền thừa **10.000đ**, nguồn còn **40.000đ**. Trước khi khôi phục, đổi menu base=35.000đ, T=7.000đ; không sửa modifier dòng cũ.

**Assertion bắt buộc ở từng đường:** dòng hóa đơn biểu diễn đúng `1 × 40.000 = 40.000`, giữ T ×2; tổng **40.000đ**, nhận **50.000đ**, thừa **10.000đ**, đúng paidAt/paymentId/orderNo. Nếu design chọn tách phụ thu thành dòng giá riêng thì tổng các dòng vẫn phải **40.000đ** và thấy đủ 2 phần; không chấp nhận dòng **30.000đ/35.000đ** trong khi chỉ trường tổng là đúng. Kiểm độc lập receipt trả về lần đầu, receipt R1 phục hồi, và in lại sau tải OrderDetail từ server. Fixture full-payment riêng trả cả 2 ly: tổng **80.000đ**, nhận **100.000đ**, thừa **20.000đ**.

**R1 chỉ là oracle chống ghi lại, không là oracle tính tiền.** Lưu R1 rồi đòi replay bằng R1 có thể hợp thức hóa một receipt sai ngay từ lần đầu. Cần so R1 với hằng số nghiệp vụ trước, rồi mới so replay với R1. Các số tiền trên không suy ra từ builder implementation.

### BUS-04 — P2: PRE-24/25 cần một fixture thay tên và giá option, rồi tăng lượng có option quantity > 1

**Loại:** thiết kế chưa đủ mạnh, không phải nói thiếu toàn bộ test modifier. P:238 có “giá/name/option snapshot giữ nguyên” nhưng bước thử chỉ đổi giá; assertion tên có thể pass ngay cả khi implementation lấy lại tên catalog vì tên chưa hề khác. P:270 có nhắc single/multi/số lượng nhưng chưa ánh xạ ra ca có dữ liệu cụ thể. Các biến thể PRE-24 đã có modifier 0đ và 7.000đ quantity=1, chưa kiểm phối hợp gọi thêm bằng dấu cộng với option quantity=2 khi phụ thu đổi.

Code hiện có đường lấy lại cả giá và tên: [orderFlow.ts:85](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:85), `:94–107`; [orderDraft.ts:42](D:/Workspace/pos-cafe/src/core/orderDraft.ts:42), `:51–58`; SQL insert tại [SQL:844](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:844), `:909–915`. Tăng quantity hiện sửa chính dòng tại [orderFlow.ts:230](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:230). UI cộng gọi hàm này tại [OrderDrawer.tsx:117](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:117).

**Fixture đủ phân biệt:** phần đã ghi L_old có A tên `Cà phê cũ`, quantity=2, base 30.000đ; T tên `Topping cũ`, quantity=2 trên mỗi ly, delta=5.000đ; tổng **80.000đ**. Giữ các ID catalog, đổi tên A thành `Cà phê mới`, base=35.000đ; tên T thành `Topping mới`, delta=7.000đ.

- Mở lại/chuyển máy trước khi sửa: L_old vẫn tên cũ, topping cũ ×2, **80.000đ**. Không chờ đến submit mới kiểm giá hiển thị.
- Fixture riêng chỉ sửa ghi chú rồi giảm L_old xuống 1: sau note vẫn **80.000đ**, sau giảm **40.000đ**, snapshot base/option/tên cũ còn nguyên.
- Fixture riêng nhấn cộng một lần trên L_old, giữ cùng lựa chọn T quantity=2: phần cũ **80.000đ**, phần mới `35.000 + 2×7.000 = 49.000đ`, tổng **129.000đ**. Tên/giá phần mới lấy snapshot mới; phần cũ giữ snapshot cũ. 0 payment sau gửi.
- Từ fixture **129.000đ**, split một ly mới: paid **49.000đ**, nguồn **80.000đ**. Fixture riêng split một ly cũ: paid **40.000đ**, nguồn **89.000đ**. Khi chọn đúng ID phải giữ cả quantity option, không chỉ đúng tổng.

Ngoài ra, biến thể “tổng bằng nhau nhưng cấu hình khác” tại P:89 phải chọn từng dòng bằng ID ở hai fixture: dòng base30+topping5 và dòng base35 không topping đều trả **35.000đ**, còn **35.000đ**. Cần so cấu hình của bill đã trả và phần còn lại; **tiền bằng nhau không tự chứng minh chọn đúng dòng**.

### BUS-05 — P2: Khôi phục mới được mô tả với một lệnh dễ nhận ra; cần chứng minh chọn đúng khi có nhiều lệnh giống nhau

**Loại:** biến thể còn thiếu của PRE-13/28/32, xuất phát từ yêu cầu không tự gộp lệnh tại P:368, không phải đề nghị đoán hai khóa là cùng ý định. P:226 chỉ có K1, chưa kiểm danh sách có nhiều kết quả gần giống nhau; P:245 chưa đóng dữ liệu lịch sử và trạng thái hiện tại thành hai bộ số cụ thể.

**Chuỗi kiểm đề nghị:** O1 có 5 ly ×30.000đ, total **150.000đ**, version 5, orderNo=7; fixture store/business_date không có orderNo lớn hơn 7. B thực hiện split K1 một ly, nhận 50.000đ; K1 applied tạo bill P1/D1 số **7**, total **30.000đ**, change **20.000đ**; nguồn số **8**, total **120.000đ**, version 6. B chủ động xác nhận một lần thanh toán mới cùng một ly và tiền nhận, đăng ký K2 với version 6 và bộ ID mới nhưng chưa execute. Xóa dữ liệu context thử nghiệm; máy khác có quyền tìm thao tác theo S1/O1.

**Expected:** thấy hai thao tác riêng K1 applied và K2 pending, phân biệt được ID/trạng thái/thời điểm/đối tượng. Chọn phục hồi K1 chỉ trả P1/D1, payment count vẫn **1**, nguồn **120.000đ**. Chủ động tiếp tục K2 cho payment P2/D2, tổng đúng **2 payment = 60.000đ**, nguồn **90.000đ**, version 7, số **9**; D2 giữ số **8**. Replay K1 sau đó vẫn trả R1 ghi nguồn **120.000đ**, sourceVersion 6, bill số **7**, trong khi khu vực trạng thái hiện tại tải riêng nguồn **90.000đ**, version 7, số **9**. Không lấy đơn đầu tiên cùng bàn/số tiền làm thao tác cần phục hồi; không ghi payment thứ ba.

Các số thứ tự minh họa tuân hành vi hiện tại [SQL:238](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:238), `:381–401`, `:443–455`; cần giữ/ghi rõ trong design nếu sửa contract. Bổ sung fixture full-pay rồi bàn có khách mới: R1 thuộc đơn cũ, bàn hiện occupied bởi một ID khác; replay không phát thông báo “Bàn đã trống” như callback hiện tại tại [PaymentDrawer.tsx:190](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:190).

## Kiểm đủ 32 dòng PRE-IDEM

Đây là kiểm chất lượng thiết kế từng dòng, **không phải bảng pass/fail thực thi**. “Đúng hướng” nghĩa expected nghiệp vụ phù hợp, vẫn phải tách biến thể, điền mã lỗi/thông báo/truy vết/schema và fixture hoàn chỉnh theo chuẩn.

| Ca / dòng proposal | Đánh giá nghiệp vụ và phần phải cụ thể hóa |
| --- | --- |
| 01 / P:214 | Đúng hướng, có takeaway và bàn được dùng lại. Chốt số đơn trước fixture; sau submit assert open/30.000đ/payment=0, sau replay lấy đúng ID cũ kể cả hiện trạng đã paid. |
| 02 / P:215 | Note L1 giữ 150.000đ, version 5→6. Nhánh bỏ hết món phải assert O void, total=0, version=6, bàn empty, 0 payment, ticket=null; “một kết quả hủy” riêng lẻ chưa đủ. Hiện trạng nhánh này: SQL:681–708, mock/orderRepo.ts:45–62. Không nhầm với void đơn paid ở ca 05. |
| 03 / P:216 | Đúng: amount 150.000đ, received 200.000đ, change 50.000đ, paid/version6/bàn empty. So snapshot bất biến và payment ID/actor/paidAt cả trước/sau replay. |
| 04 / P:217 | Đúng tiền: paid 30.000đ, change 20.000đ, nguồn 120.000đ. Cần assert nguồn open/version 6/bàn occupied; định danh source/split/payment và số đơn trước/sau phải là số cụ thể. Không hiểu “không cấp thêm số đơn” thành cấm lần split đầu cấp số mới cho nguồn; nó áp cho replay. |
| 05 / P:218 | Đúng: void paid không hoàn tiền; giữ payment150.000đ và số đơn. Nếu fixture là kết quả ca03 thì trước void version6, sau void version7; không tái dùng fixture đã đổi ngầm. |
| 06 / P:219 | Đúng hướng chống trùng cho cả 4 loại; “tối đa một” chưa chứng minh liveness ở fixture hợp lệ. Sau cả request hoàn tất/read phải có đúng một applied và hiệu ứng mong đợi; nhánh timeout có bước read cuối rõ. |
| 07 / P:220 | Quy tắc object-key/array/null đã chốt. Fixture O1 chỉ có 1 dòng: đảo mảng 1 phần tử không thay nội dung. Phải dùng ≥2 phần tử khác nhau hợp lệ cho biến thể đảo mảng, và trường optional/nullable thực sự hợp lệ theo schema để lỗi mismatch không bị thay bằng lỗi input sớm. |
| 08 / P:221 | Đúng tách register/execute; chốt lỗi execute không tìm thấy K và vị trí thông báo. K pending không làm đơn open/bàn occupied/payment xuất hiện. |
| 09 / P:222 | Đúng chống callback muộn. Tách đếm HTTP attempts với số hàng đăng ký: retry cùng K có thể gọi register lần nữa, nhưng không tạo hàng thứ hai/đổi hạn; response muộn không tự execute. |
| 10 / P:223 | Fixture O1 đủ làm lựa chọn 1 ly còn tồn tại, version6. Đúng expected 1 payment30.000đ/nguồn120.000đ; assert cùng paymentId/newOrderId, không chỉ cùng số tiền. |
| 11 / P:224 | Fixture O2 đủ làm cà phê biến mất; payment30.000đ/nguồn trà20.000đ đúng. Assert mode K1 vẫn split; không có payment trà. Full-selection fallback có thật ở PaymentDrawer.tsx:58–59. |
| 12 / P:225 | Đúng không tự resume; tách bấm lúc đã offline với mất mạng sau register. Trường hợp sau cần trạng thái pending/unknown rồi read; “ghi tự phát=0” nên đếm riêng register, execute và hiệu ứng để không che một execute RPC bị gửi tự động nhưng bị từ chối. |
| 13 / P:226 | Đúng phục hồi từ server và tiếp quản; cần ca nhiều lệnh, phân biệt pending/applied theo BUS-05, và create-takeaway pending chưa có đơn để tìm từ danh sách cửa hàng. Không coi đóng browser là bằng chứng đã xóa storage. |
| 14 / P:227 | Đúng ràng buộc OCC; fixture void phải paid, không dùng O1 open để rồi pass nhờ guard trạng thái. Tạo mới expectedVersion=null là nhánh hợp lệ riêng. Chưa có kết quả DB trong lượt này. |
| 15 / P:228 | Đúng yêu cầu nguyên tử/terminal rejection; phải chỉ vị trí fault, trạng thái K sau rollback/rejected và một lỗi nghiệp vụ cụ thể. So order/items/options/payment/version/table với snapshot trước, không chỉ đếm payment. |
| 16 / P:229 | Mốc −1ms/đúng/+1ms và lệch client đúng. Mỗi loại lệnh phải có dữ liệu nghiệp vụ vẫn hợp lệ trước hạn; không lấy version conflict làm bằng chứng kiểm TTL đúng. |
| 17 / P:230 | Đúng xét hạn sau khóa và cho transaction hợp lệ hoàn tất. Cần chỉ rõ khóa nào và barrier ngay trước/sau kiểm hạn; “transaction kết thúc sau hạn” không đồng nghĩa request đến trước hạn đủ hợp lệ. |
| 18 / P:231 | Đúng không gia hạn, không cắt nửa đêm. Đóng `registered_at`, `expires_at` tuyệt đối và offset +07; không đo theo đồng hồ trình duyệt. |
| 19 / P:232 | Đúng: đơn 48 giờ vẫn trả 150.000đ, nhận 200.000đ, thừa 50.000đ. P:162 yêu cầu ghi riêng business_date/paid_at/report nhưng dòng ca chưa chứa assertion đó: fixture tạo 08/09, paid 10/09 thì báo cáo hiện hành ngày 08/09 +150.000đ, ngày 10/09 +0 (không có đơn khác); không đổi chính sách ngày báo cáo. Bằng chứng reportRepo.ts:24–38, SQL:1116–1122. |
| 20 / P:233 | Đúng expired không ảnh hưởng đơn/bàn. Sau xác nhận K2 hợp lệ phải kết thúc bằng đúng1 payment150.000đ, thừa50.000đ, O paid; hiện ca chỉ nói “được xét”. |
| 21 / P:234 | Đúng R1 giữ sau24h, payload mới bị từ chối. Tách read/replay/mismatch thành lần chạy có state rõ; không lấy R1 chưa xác minh tiền làm oracle đúng nghiệp vụ, xem BUS-03. |
| 22 / P:235 | Đúng cancel thắng/execute thắng. Rejected/expired cần fixture terminal riêng; gọi cancel không thể tự tạo ra hai trạng thái đó. Không đổi cancellation của lệnh thành void/refund đơn. |
| 23 / P:236 | Đúng not-found không phải cancelled. Có register đến muộn pending, 0 hiệu ứng; sau tìm lại có hành động cancel rõ và read terminal, không chỉ đóng drawer. |
| 24 / P:237 | Tất cả số tiền chính đúng: 100.000đ, split cũ 30.000đ/còn 70.000đ, split mới 40.000đ/còn 60.000đ, ca nút cộng 65.000đ. Cần K riêng cho submit và split, fixture độc lập cho từng lựa chọn, assert payment=0 ngay sau submit; bổ sung BUS-02/04. |
| 25 / P:238 | Đúng 2×(30.000+2×5.000)=80.000đ; giảm một ly còn 40.000đ. Phải thực hiện note rồi giảm bằng hai xác nhận/command riêng nếu muốn quan sát cả hai mốc đã ghi. Bước xóa hết cần có dòng đối chứng khác để chứng minh không tác động giá phần khác. Bổ sung tên khác và quantity option theo BUS-04. |
| 26 / P:239 | Chưa đủ automation; BUS-01. Không dùng riêng version đơn để kiểm thay đổi catalog. |
| 27 / P:240 | Đúng nguyên tắc actor; phải xác định A register loại payment thì A có quyền register loại đó lúc đăng ký, rồi mới mất quyền. A mặc định chỉ “có quyền tạo/sửa” ở P:206 chưa đủ chứng minh fixture register-pay hợp lệ. Quyền caller replay phải xác định rõ; không suy từ tên A/B/C. |
| 28 / P:241 | Đúng: hai xác nhận độc lập được sinh 2 payment. Chốt mỗi lần amount 30.000đ, received 50.000đ, change 20.000đ; nguồn sau hai lần 90.000đ/version 7; khôi phục K1 không thêm lần thứ ba. Không đưa bước đối chiếu tiền mặt trở lại. |
| 29 / P:242 | Đúng cửa hàng/quyền/không rò dữ liệu. Cần role/permission/phiên cụ thể cho read/list/replay; xác minh caller không có quyền thử trước không biến K thành rejection vĩnh viễn. Không kết luận DB bảo vệ danh tính từ ID client. |
| 30 / P:243 | Đúng yêu cầu đóng bypass, phù hợp chuẩn test tiền/dữ liệu cửa hàng. Đây là test DB thực; đọc code không xác nhận grants/migration đã có hiệu lực. |
| 31 / P:244 | Không được áp “mọi input bị từ chối” lên cả dãy: received 149.999đ bị lỗi/0 hiệu ứng; 150.000đ thành công, change 0đ; 150.001đ thành công, change 1đ. Split q=0/q=6 lỗi; q=1 paid 30.000đ/còn 120.000đ; q=5 qua UI là full payment 150.000đ, gọi thẳng split phải INVALID_ORDER_ITEMS. Mỗi biến thể fixture riêng. Mỗi lỗi có mã/thông báo cụ thể và dữ liệu malformed cụ thể. |
| 32 / P:245 | Đúng nguyên tắc historical/current và không tự in. Chưa đủ fixture/đường in/assertion dòng tiền: BUS-03/05. “Không tự in” phải phân biệt mở preview, gọi print port và gọi browser print; port thực hiện nay là no-op (browser/printPort.ts:12–19), chỉ spy port không chứng minh UX không mở lại preview. |

## Rà các biến thể ngoài bảng 32 dòng

| Nguồn biến thể | Kết luận / expected cần giữ |
| --- | --- |
| P:87, chạm menu hoặc cộng | Hai fixture: 30.000đ cũ +35.000đ mới =65.000đ. Đọc lại đơn, mở sửa, chọn trả và receipt phải giữ hai mức, không chỉ UI lúc vừa submit. |
| P:88, bỏ phần35.000đ | Còn30.000đ, đúng ID/nguồn, không phải giảm tùy ý một ly giống tên. |
| P:89, hai cấu hình cùng35.000đ | Tổng70.000đ đúng; số tiền split không phân biệt sai dòng, phải assert cấu hình đã trả/còn lại, xem BUS-04. |
| P:90, giá 30→35→30 | Tổng 95.000đ, 3 ly từ 3 xác nhận riêng đúng. Không buộc 3 hàng hiển thị nếu nhóm vẫn giữ ánh xạ nguồn; không nhận lần thứ ba là replay. |
| P:91, retry sau đổi menu | Chỉ ly 30.000đ cũ, 0 ly 35.000đ bổ sung. So đúng ID/giá/tên snapshot và không ghi mới. |
| 12:294–295, mới/cũ cùng modifier0 | Tổng100.000đ đúng. Có bản ghi lựa chọn0đ, source old2×30.000/new1×40.000; không được “pass” nhờ hai option signatures khác nhau. |
| 12:296–298, modifier 7.000đ/split/mất ACK | Tổng 107.000đ đúng; split 30.000đ/còn 70.000đ hoặc 40.000đ/còn 60.000đ từ fixture 100.000đ; replay submit cùng K sau đổi menu vẫn 100.000đ và payment=0 trước khi có lệnh payment. Các mốc này không được trộn vào cùng K. |
| 12:299 và P:270, note/giảm/single/multi | Giữ phạm vi modifier chọn lúc thêm. Ca single/multi/quantity/link phải có ID nhóm/value, isRequired/selectType và giá cụ thể; nhắc tên nhóm kiểm chưa tương đương một ca runnable. Không thêm sửa modifier phần đã ghi. |

## Điều kiện bàn giao cho người viết automation

1. Analyst hoàn tất schema/lỗi/quyền/vòng đời của PRE-26 và các endpoint; tách mỗi biến thể thành TC có mã, fixture, từng bước, output quan sát được và requirement/UC theo SPEC-STANDARD.
2. Thêm/siết các ca BUS-02…05; expected phải kiểm dòng/nguồn/giá base/option quantity/tên/payment/version/bàn, không chỉ total hoặc `replay === R1`.
3. Ghi rõ ranh giới tầng kiểm: unit/UI có thể chứng minh lựa chọn/hiển thị; transaction/quyền/lost ACK sau commit cần DB test và hai context. Read-only review này không bảo đảm môi trường đó sẵn sàng.
4. Cố định bản tài liệu trước duyệt. Chủ dự án cần duyệt bộ spec cụ thể trước code theo quy trình dự án; **không có quyết định nghiệp vụ mới nào trong phần giá/modifier cần hỏi lại ở lượt này**. Chỉ khi phương án kỹ thuật thật sự buộc đổi luồng đăng nhập/phạm vi đã chốt mới cần trình tác động cụ thể cho người dùng.

Giới hạn của kết luận: đã kiểm thiết kế cả 32 dòng và biến thể nêu trên, tập trung nghiệp vụ/giá/khôi phục; không thay cho review DB/quyền chuyên sâu, không chứng minh atomicity hay khẳng định đã tái hiện một lỗi ở runtime. Báo cáo chỉ xác định ca nào đủ hướng, ca nào thiếu khả năng phân biệt lỗi, và việc analyst phải làm để automation có oracle độc lập.
