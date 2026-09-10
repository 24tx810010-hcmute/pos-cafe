# Rà bộ spec cuối — nghiệp vụ, giá và khôi phục

Ngày **09/09/2026**. Phạm vi: bộ bảy artifact của `add-idempotent-write-operations`, đối chiếu code `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`. Đây là review tài liệu, **không chạy ứng dụng, test hoặc DB**. Không đọc báo cáo reviewer khác, không sửa input; đầu ra riêng là file này.

## Kết luận tại lượt đọc

Bộ mới đã cụ thể hóa được các vấn đề nghiệp vụ chính của vòng chuẩn bị. Giá **100.000đ**, tăng lượng có option quantity=2 cho tổng **129.000đ**, giá thay đổi phải xác nhận lại, ghi chú theo source ID, hóa đơn có phụ thu đầy đủ và phục hồi K1/K2 đều có contract cùng expected có thể đối chiếu.

Phát hiện **3 điểm P2**, không có P1 mới trong phạm vi đã đọc. Cả ba đã gửi sớm cho người tổng hợp sửa đồng thời. Sau đọc lại, **FIN-BUS-02/03 đã đóng; FIN-BUS-01 chỉ còn đồng bộ expected cho positive control multi** (chi tiết cuối báo cáo). Chúng là lỗi/thiếu của bản spec được đọc, không phải tuyên bố bug runtime đã tái hiện. Không có câu hỏi nghiệp vụ modifier phải hỏi lại chủ dự án.

## FIN-BUS-01 — P2: Test “multi vượt limit” chưa có giới hạn nghiệp vụ tương ứng

**Vị trí bản lúc phát hiện:** [design.md §3.1, Options](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:98); [TC-IDEM-036](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:475), dữ liệu tại dòng 479 và expected tại dòng 483.

Design nói nhóm multi theo constraints hiện hành; TC-036 có biến thể “multiple vượt limit” và đòi `OPTION_VALUE_UNAVAILABLE`, K rejected. Mô hình hiện hành chỉ có `selectType`, `isRequired`, không có số lượng lựa chọn tối đa riêng của nhóm multi:

```ts
// D:/Workspace/pos-cafe/src/domain/models.ts:70–75
export type OptionGroup = {
  id: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  sortOrder: number;
};
```

[orderDraft.ts:76](D:/Workspace/pos-cafe/src/core/orderDraft.ts:76) cũng chỉ kiểm quantity dương, single không quá một lựa chọn, required phải có lựa chọn. Không có limit multi để người viết automation dựng fixture vượt ngưỡng.

**Sửa cụ thể:** bỏ biến thể limit multi chưa tồn tại. Dùng nhóm multi optional với hai value hợp lệ làm positive control; nhóm required multi không chọn value là negative control. Giới hạn payload options 20/21 đã thuộc schema v1 và TC-078: 21 option phải `INVALID_WRITE_REQUEST` trước ledger, không được dùng làm `OPTION_VALUE_UNAVAILABLE` ở execute. Không thêm tính năng cấu hình max lựa chọn cho nhóm trong change này.

## FIN-BUS-02 — P2: Bản test ban đầu thêm payment 0đ nhưng chưa thống nhất với luồng hiện hành

**Vị trí bản lúc phát hiện:** [design.md, Money](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:94); [TC-IDEM-092](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:1091), dòng 1094–1099.

Bản TC-092 được đọc yêu cầu một đơn giá 0đ được cash payment 0đ thành công, chỉ kiểm DB. Luồng hiện tại không cho người dùng thanh toán selection có tổng bằng 0:

- [orderFlow.ts:399](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:399): `amount <= 0 || Object.keys(selection).length === 0` → `INVALID_ORDER_ITEMS`.
- [PaymentDrawer.tsx:77](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:77), `:85`: `amountDue <= 0` được coi không có phần hợp lệ để thanh toán và disable nút.

Do đó DB có thể pass expected mới trong khi UI vẫn chặn; nếu người triển khai tự bỏ guard UI để làm case này xanh thì đã chọn thêm hành vi mà chốt modifier 0đ không yêu cầu. **Modifier 0đ của món base 40.000đ vẫn là phần phải trả 40.000đ**, không đồng nghĩa cả đơn có thể thu 0đ.

**Cách sửa thống nhất đã trao đổi với người tổng hợp:** giữ phạm vi UI hiện hành: `pay_order` và phần chọn của `pay_order_items` phải có tổng **>0**; selection rỗng hoặc tổng 0 → `INVALID_ORDER_ITEMS`, không ghi payment. Giá dòng và option vẫn được phép bằng 0 khi đi cùng các phần làm tổng phải thu dương. Mở rộng TC-092 thành core/DB/E2E để cùng kiểm quyết định này; không dùng test chỉ DB.

**Fixture cần khóa expected:**

| Fixture / thao tác | Expected |
| --- | --- |
| Đơn chỉ A ×1 base0, không option, chọn toàn bộ, nhận0 | UI chặn xác nhận; gọi trực tiếp register/execute với schema hợp lệ nhận rejected `INVALID_ORDER_ITEMS`; 0 payment, đơn còn open |
| Đơn có A0 và T20.000đ; chỉ chọn A, nhận0 | Không split/payment0; nguồn giữ đủ A/T và tổng20.000đ |
| Cùng đơn A0 + T20.000đ, chọn cả hai, nhận20.000đ | Pay toàn bộ đúng20.000đ, thừa0; dòng A0 vẫn được lưu/hiển thị |
| Món A40.000đ + modifier Z0 | Thanh toán40.000đ hợp lệ; option Z0 không bị bỏ khỏi snapshot |

Người rà xác nhận cách giữ tổng phần thanh toán dương không mâu thuẫn quyết định giá/modifier đã chốt. Đây là sửa bất nhất nội bộ của spec, không phải đề nghị chủ dự án mở tính năng bán cả đơn miễn phí.

## FIN-BUS-03 — P2: Output chưa xác định rõ xử lý dòng removed trong tổng tiền

**Vị trí bản lúc phát hiện:** [design.md §4.2](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:161), dòng 161–174; [TC-IDEM-028](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:387) và [TC-IDEM-037](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:486).

`OrderSnapshot.items` được khai báo là `ItemSnapshot[]`, mỗi item có `status active/removed`; phần giải thích chỉ nói “snapshot liên quan”. Công thức `total=ΣlineTotal` không nêu có lọc removed. TC-028 ghi “old removed qty snapshot giữ theo schema” nhưng schema chưa quyết định giữ quantity nào sau xóa. Hai implementation đều có thể tự cho mình tuân thiết kế nhưng trả danh sách khác nhau hoặc cộng cả dòng đã bỏ.

**Fixture phân biệt:** F5 có old L1 quantity2 ×30.000đ; gửi giữ L1 quantity0 và thêm new L2 ×40.000đ. Kết quả phải thu **40.000đ**. Nếu output chứa L1 removed quantity2 và renderer cộng mọi lineTotal theo công thức literal thì thành **100.000đ**. Với void_open, lỗi tương tự giữ tổng cũ dù yêu cầu total0.

**Sửa cụ thể đề nghị:** raw DB item khi tombstone giữ quantity/base/options trước xóa; chỉ status chuyển removed. `OrderSnapshot.items` cho business result/read domain chỉ chứa active, `void_open` trả `items=[]`. Receipt chỉ gồm phần thực sự đã thanh toán. Công thức tổng áp trên active items/receipt lines. Nếu muốn trả removed trong output thay vì phương án này thì phải quy định tên trường lịch sử riêng và bộ lọc tính tiền rõ ràng; không để cùng một mảng mang hai nghĩa.

**Expected cần thêm:** TC-028 raw L1 vẫn quantity2/base30.000đ/statusremoved/options cũ; result chỉ L2 active40.000đ. TC-037 raw L1 quantity5 vẫn tồn tại cùng options nhưng result.items=[]/total0. Cách này phù hợp cách đọc order hiện hành bỏ removed tại [orderRepo.ts:51](D:/Workspace/pos-cafe/src/adapters/supabase/orderRepo.ts:51) và SQL void_open chỉ đổi status item tại [012_action_permission_guardrails.sql:675](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:675).

## Phần đã đủ trong phạm vi review

- **Giữ giá và modifier:** IDEM-15/16/26/27, NewLine/RetainedLine và TC-025…030 phân biệt nguồn cũ/mới, modifier 0đ, giá/tên option cũ, quantity phụ thu và nút cộng. Không có luồng sửa modifier phần đã ghi.
- **Chênh giá:** IDEM-17, design §5.2/§6, UC-11 và TC-034/035 quy định terminal `PRICE_CHANGED`, không ghi business, K1 bất biến, K2 chỉ sau xác nhận; cả tăng, giảm và đổi riêng option đều có expected. Các phép tính 105.000đ/95.000đ/129.000đ đúng với fixture đã ghi.
- **Draft:** TC-027 kiểm đổi chỗ note giữa hai source khác giá, dirty=true, không đi payment trước gửi; đã giải quyết lỗ hổng so đa tập nội dung của bản cũ.
- **Receipt:** schema có base/option quantity/delta/unitTotal/lineTotal; TC-050 kiểm literal trước khi so replay, receipt full80.000đ và split40.000đ, thay tên/giá menu, DOM và browser print. TC-051/083 phân biệt R1 lịch sử với quyền in lại khi current order void.
- **Khôi phục:** TC-044/045 phân biệt hai nhánh clamp; TC-055 có K1 applied và K2 pending cùng nguồn, expected nguồn120.000đ lịch sử và90.000đ hiện tại; TC-052/053 kiểm ACK muộn không tự execute/in; TC-054 chống reconnect tự ghi.

## Kiểm lại thay đổi trong lúc review

Ba finding đã được gửi cho người tổng hợp trước khi viết báo cáo. Người rà đã đọc lại các thay đổi được lưu trong cùng lượt, không đánh dấu đóng chỉ từ lời hứa sửa:

| Finding | Trạng thái kiểm lại | Bằng chứng mới |
| --- | --- | --- |
| FIN-BUS-01 | **Còn một phần nhỏ** | Design §3.1 đã nói rõ multi không có max riêng; TC-036 đã bỏ “multi vượt limit” và thêm required multi thiếu chọn/positive multi chọn hai value. Tuy nhiên expected TC-036 tại dòng 485 của lần đọc lại vẫn gom thành `0order/0event/Krejected`. Cần tách positive: A base30.000đ + Q5.000đ + Z0, hai value gắn cùng nhóm multi hợp lệ → applied một đơn35.000đ, hai option snapshot, 0payment, một event. Negative variants vẫn rejected như đã viết. Đã gửi lại phần này cho người tổng hợp. |
| FIN-BUS-02 | **Đã đóng về contract/test** | Design §3.3/§6 và specs/payment yêu cầu tổng phần thanh toán >0; UC-04/05 đã nhận ràng buộc. TC-092, dòng 1093–1102 lần đọc lại, có core/DB/E2E, tách rỗng/tổng0/mixed0+20.000đ và expected đúng: không payment0; chọn cả hai được pay20.000đ. TC-076 giữ Money0 cho ghi đơn, không đánh đồng với được thu riêng phần0. |
| FIN-BUS-03 | **Đã đóng về contract/test** | Design §4.2 chốt OrderSnapshot.items chỉ active, void_open=[]; raw removed giữ quantity/base/options trước tombstone; tổng không gồm removed. TC-028 tại dòng 397 lần đọc lại assert raw old quantity2 và result chỉ new40.000đ; TC-037 tại dòng 496 assert raw quantity5 và result.items=[]/total0. |

Với phần còn lại của FIN-BUS-01 được sửa như trên, không còn điểm chặn về nghiệp vụ/giá trong phạm vi review này đối với việc chuyển sang implementation. Kết luận đó có giới hạn theo các artifact đã đọc, không có nghĩa mọi case đã chạy hoặc toàn bộ review database/quyền đã đạt.

Kết luận không bao gồm kiểm matrix/format/OpenSpec scenario mà người tổng hợp đang tự xử lý, và không thay thế review database/quyền. Đủ spec để triển khai và nghiệm thu code là hai mốc khác nhau; chưa có kết quả thực thi 93 TC mới.

## Xác nhận cuối sau khi kiểm lại đúng ba finding — 09/09/2026

**Cả FIN-BUS-01, FIN-BUS-02 và FIN-BUS-03 đều đã đóng ở mức thiết kế contract/test.** Xác nhận này thay thế trạng thái “còn một phần nhỏ” của lần kiểm trước ở trên. Lượt này chỉ đọc lại đúng ba phần được yêu cầu, không mở rộng phạm vi hoặc quét finding mới.

| Finding | Nội dung đã đọc lại trên filesystem | Kết luận |
| --- | --- | --- |
| FIN-BUS-01 | [Design:98](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:98) phân biệt max20 của payload với nhóm multi không có max riêng. [TC-036:485](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:485) đã tách negative rejected khỏi positive A30.000đ + Q5.000đ + Z0 cùng nhóm multi: applied, một đơn35.000đ, hai option snapshots, 0 payment, một event. | **Đóng.** Không còn expected rejection áp nhầm lên positive control. |
| FIN-BUS-02 | [Design:139](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:139), `:233` và [payment spec:7](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/specs/payment/spec.md:7), `:35` giữ tổng phần thanh toán dương. [TC-092:1096](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:1096) có DB/đơn vị/E2E; expected tại `:1101` chặn đơn tổng0 và chỉ chọn dòng0, giữ payment=0; chọn cả A0 và T20.000đ được paid20.000đ với một payment. | **Đóng.** Core/UI/DB cùng contract; không thêm nghiệp vụ thanh toán0đ, vẫn giữ dòng/option0 trong tổng dương. |
| FIN-BUS-03 | [Design:161](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:161), `:162`, `:174` quy định result.items chỉ active, void_open=[]; raw removed giữ quantity/base/options trước xóa và không tham gia tổng. [TC-028:397](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:397) giữ raw quantity2, result chỉ món mới40.000đ. [TC-037:496](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:496) giữ raw quantity5, result.items=[] và total0. | **Đóng.** Output hiện tại và snapshot raw lịch sử đã có nghĩa riêng, không cộng removed vào tổng. |

Trong phạm vi ba finding nghiệp vụ đã nêu, không còn điểm phải sửa trước khi bàn giao thiết kế cho implementation. **Không chạy ứng dụng, automation hoặc DB trong lượt kiểm lại; “đã đóng” xác nhận nội dung tài liệu đã được sửa, không xác nhận hành vi runtime đã được kiểm thử.**
