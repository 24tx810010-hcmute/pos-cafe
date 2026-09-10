# 12 — Chuẩn bị rà cuối trước khi viết code

Ngày **08/09/2026**. Change: `add-idempotent-write-operations`.

**Cập nhật mới nhất 09/09/2026:** chủ dự án làm rõ modifier chỉ chọn khi thêm món; đã kiểm lại UI và đóng câu hỏi sai phạm vi về sửa modifier phần cũ. Ví dụ chốt là **A ×2 giá 30.000đ + A mới giá 40.000đ, modifier 0đ = 100.000đ**. Xem mục 7. Mục 6 giữ lịch sử một đề xuất đã rút; không dùng ví dụ 67.000đ/72.000đ ở đó làm yêu cầu hiện hành. Đã đủ thông tin nghiệp vụ về điểm này để hoàn thiện bộ spec, chưa đồng nghĩa spec đã xong hoặc được duyệt code.

**Kết quả lượt chuẩn bị: đã ghi xác nhận của chủ dự án và rà lại độ sẵn sàng; chưa đủ bộ spec để duyệt triển khai.** Không viết/sửa ứng dụng, không chạy lại test baseline vốn không đổi. Tài liệu này là đầu vào cho lượt rà cuối, không phải biên bản tuyên bố lượt rà cuối đã đạt.

## 1. Mốc đối chiếu và những gì đã xác nhận

- Mã được đọc: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`.
- Main trước lượt chuẩn bị chỉ có file chưa theo dõi `pnpm-lock.yaml`; không có diff tracked. File này không thuộc change và không được sửa.
- Tài liệu yêu cầu: working tree nhánh `docs`, [proposal hiện hành](../../../openspec/changes/add-idempotent-write-operations/proposal.md), [quyết định 10](10-quyet-dinh-sau-review-va-chinh-sach-gia.md). Các sửa mới chưa được commit thành một mốc review cố định.
- [07](07-uu-tien-online-va-khoi-phuc-tren-server.md) giữ làm mốc trước review, [08](08-review-doc-lap-plan-07.md) là ba review độc lập đã thực hiện. Không ghi ba review cũ thành review của bản spec cuối chưa có.
- [11](11-thuong-mai-dien-tu-va-kiem-chung-test.md) có log/JSON của lượt kiểm chứng độc lập: 5 file, 63 test baseline pass. Không có kết quả của 32 PRE-IDEM mới và không có kết quả DB/cloud trong lượt đó.

Chủ dự án vừa xác nhận phần giải thích trước, gồm:

| Quyết định đã chốt | Điều phải giữ khi rà/triển khai |
| --- | --- |
| Giá theo từng phần món được server ghi thành công | Không lấy thời điểm thu tiền để tính lại giá toàn bàn; register chưa phải chốt giá nghiệp vụ |
| Cùng món, khác giá là hai dòng bán hàng | Giữ giá/số lượng/ID phần món; không tự nhân đôi sản phẩm catalog |
| 30.000đ + 35.000đ = 65.000đ | Chạm món hoặc bấm cộng đều phải giữ đúng phần cũ và phần gọi thêm |
| Giá không thay thế định danh | Giá bằng nhau không đủ gộp cấu hình khác; giá quay lại mức cũ không biến lần gọi mới thành retry |
| Ghi đơn khác ghi payment | Chốt nội dung/giá không tự đánh dấu paid |
| Online và server là nguồn tin cậy | Không outbox ghi offline; không tự execute khi reconnect/focus; phục hồi theo lệnh đã ghi server |
| Tiếp quản theo quyền thực tế | Không phụ thuộc người tạo còn đăng nhập hoặc đã hết ca; phải có danh tính caller được server xác minh |
| Tiền mặt do con người chịu trách nhiệm | Không thêm bước bắt đối chiếu tiền mặt; vẫn phân biệt server applied/rejected với client chưa biết kết quả |
| Lệnh chưa chạy có hạn 24 giờ, kết quả được giữ | Không gia hạn bởi retry; không xóa đơn qua ngày; replay kết quả cũ không ghi thêm |
| Phục hồi delta phiếu bếp hoãn | Giữ yêu cầu không tự in do replay, không kéo phần bếp vào change này |

Không hỏi lại các quyết định trên. **Cập nhật 09/09:** thao tác sửa size/topping phần món đã ghi không thuộc phạm vi; câu hỏi trước đã đóng theo mục 7.

## 2. Kiểm kê bộ bảy artifact

Kiểm trên filesystem của change, không chỉ trên commit cũ. `.openspec.yaml` là metadata, không phải một trong bảy artifact.

| Artifact bắt buộc | Trạng thái hiện tại | Cần hoàn tất |
| --- | --- | --- |
| `proposal.md` | Có; đã cập nhật quyết định, mã bằng chứng và 32 ca chuẩn bị; phạm vi modifier đã đóng 09/09 | Chuẩn hóa thành đầu vào cho các artifact còn thiếu |
| `specs/write-idempotency/spec.md` và delta năng lực liên quan | Chưa có | Requirement có ID, SHALL/MUST, scenario và ranh giới rõ |
| `usecases.md` | Chưa có | Actor, input/output, main/alternate/error, thông điệp Việt, acceptance criteria |
| `design.md` | Chưa có | Contract, schema, transaction, xác thực, lỗi, migration và ranh giới adapter/UI |
| `testplan.md` | Chưa có | Chuyển PRE-IDEM thành TC có fixture đầy đủ, expected result và nơi hiện thực |
| `traceability.md` | Chưa có | Mỗi requirement và UC có TC; không còn hàng chưa phủ |
| `tasks.md` | Chưa có | Thứ tự triển khai, phụ thuộc, cổng kiểm thử và bằng chứng nghiệm thu |

Vì vậy 32 dòng PRE-IDEM trong proposal **không đồng nghĩa** đã có testplan đạt chuẩn hoặc change đã sẵn sàng code.

## 3. Hai điểm kỹ thuật đã làm rõ trong lượt chuẩn bị

### 3.1. So sánh nội dung register — PRE-IDEM-07

Lựa chọn kỹ thuật của analyst để contract đơn giản và không đoán ý định:

- Payload phải hợp lệ theo schema trước khi so sánh; số không được thay bằng chuỗi chỉ vì cùng cách hiển thị.
- Key của object JSON không có thứ tự; đảo thứ tự key không tạo mismatch.
- Mảng có thứ tự; đảo thứ tự phần tử là nội dung khác. Không tự sắp xếp/gộp các dòng nghiệp vụ vì có thể làm mất thứ tự hoặc nguồn gốc.
- Trường vắng và trường có giá trị null không mặc nhiên tương đương. Không tự điền lại các mặc định mới khi retry một bản cũ.
- Ngữ cảnh xác thực của người đang gọi tách khỏi nội dung nghiệp vụ bất biến. B tiếp quản không bị coi là đổi payload chỉ vì danh tính/token của B khác A.

Đánh đổi: hai payload có cùng tổng tiền vẫn có thể bị từ chối khi dùng chung K nếu cấu trúc khác. Điều này có chủ ý: phục hồi phải dùng bản đã đăng ký, không tái dựng từ màn hình rồi phỏng đoán tương đương. Bảng trường bắt buộc/nullable và các mã lỗi còn phải được viết đầy đủ trong design.

### 3.2. Chọn toàn bộ đi pay_order trước register — PRE-IDEM-31

Giữ hành vi hiện hành đã đọc, không hỏi chủ dự án chọn lại:

`src/features/pos/orderFlow.ts:403–411`:

```ts
  if (isFullSelection(lines, selection)) {
    const result = await payOrderAndPrint(ports, {
      order: input.order,
      actor: input.actor,
      receivedAmount: input.receivedAmount,
      paymentId: input.paymentId,
      printReceipt: input.printReceipt,
    });
    return { mode: "full", ...result };
```

`supabase/migrations/012_action_permission_guardrails.sql:213–227`:

```sql
  -- Chọn đủ 100% đơn thì client phải dùng pay_order (đơn gốc đóng, không tách).
  if not exists (
    select 1
    from public.order_items oi
    left join jsonb_to_recordset(p_items) as line("orderItemId" uuid, quantity integer)
      on line."orderItemId" = oi.id
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status
      and coalesce(line.quantity, 0) < oi.quantity
  ) then
    raise exception 'INVALID_ORDER_ITEMS'
      using errcode = 'P0001',
            hint = 'Full selection must go through pay_order.';
  end if;
```

Contract mới phải chọn loại lệnh **trước register**: toàn bộ → pay_order; một phần → pay_order_items. Gọi trực tiếp split với toàn bộ vẫn bị từ chối. Sau register, polling/clamp không được đổi loại lệnh. Đây chính là điều cần bảo vệ khi dòng được chọn biến mất và UI hiện tại quay về fullSelection (`PaymentDrawer.tsx:51–61`, đã trích trong 08).

## 4. Việc còn phải hoàn tất trước lượt duyệt cuối

| Mục | Người xử lý | Điều kiện đóng |
| --- | --- | --- |
| Phạm vi modifier và giá lần gọi thêm | **Đã đóng 09/09/2026** | Không sửa modifier món cũ; chọn khi thêm món. A ×2 giá 30.000đ + A mới 40.000đ với modifier 0đ = 100.000đ; xem mục 7 |
| Xác minh nhân viên thực sự ở server | Analyst thiết kế phần tối thiểu, phối hợp change quyền | Chỉ rõ caller được xác minh bằng gì, kiểm quyền register/execute/cancel/read ra sao; không tin ID nhân viên client khai |
| Schema input/output và lỗi | Analyst | Đủ trường, kiểu, nullability, giới hạn, mã lỗi mới/cũ và đúng thông điệp UI; đóng PRE-IDEM-26 |
| Nguyên tử và request đến muộn | Analyst | Sơ đồ trạng thái/transaction phân biệt rejected cuối với lỗi hạ tầng rollback; lock order, cancel/execute, hạn sau chờ khóa và lost ACK có expected result |
| Giữ giá và nguồn gốc dòng | Analyst | Contract giữ phần cũ, thêm phần mới, giảm/split đúng ID; xử lý giá menu đổi không phụ thuộc chỉ version đơn |
| Migration và chặn đường ghi cũ | Analyst | Danh sách overload/helper/DML phải đóng; sửa guard NULL; không để client cũ bỏ qua giao thức mới |
| Testplan/traceability | Analyst | Đủ bốn nhóm chính/ngoại lệ/biên/quyền; mỗi requirement/UC có ca, không dùng baseline xanh thay ca tương lai |
| Môi trường kiểm chứng | Người triển khai xác minh trước khi chạy test DB | Xác định DB test và cách reset fixture/gây lỗi; có hai connection, hai browser context; chưa có thì ghi rõ chờ môi trường |

Các mục kỹ thuật là việc analyst cần làm, không đẩy thành nhiều câu hỏi yêu cầu chủ dự án tự thiết kế. Nếu một lựa chọn kỹ thuật buộc đổi luồng đăng nhập hoặc phạm vi sản phẩm đã chốt, phải nêu tác động cụ thể trước khi thực hiện. Ngày báo cáo thu tiền là đề xuất riêng chưa duyệt; không dùng nó để mở rộng change hiện tại.

## 5. Gói đầu vào và tiêu chí cho lượt rà cuối

Khi bộ spec hoàn chỉnh, lượt rà cuối cần một mốc code và một bản tài liệu cố định để các kết luận có thể đối chiếu lại. Nếu tài liệu/code đổi trong lúc review, ghi phần thay đổi và rà lại phần bị ảnh hưởng.

Ba góc kiểm tra độc lập cần có trong checklist, có thể giao subagent khi thực hiện lượt review đó:

1. **Nghiệp vụ/giá:** từ yêu cầu và ví dụ suy expected result; tìm mất nguồn gốc, gộp sai, chốt giá nhầm thời điểm, mâu thuẫn giữa thanh toán và ghi đơn.
2. **Database/quyền:** đối chiếu RPC/migration, danh tính caller, NULL, lock/transaction, replay/expire/cancel, đường bypass và định danh nguồn–đơn tách–payment.
3. **Test/UX:** truy từng requirement sang ca kiểm chứng; kiểm hai nhánh clamp, mất ACK sau commit, không tự resume, mất local/đổi máy và phân biệt result lịch sử với trạng thái hiện tại.

Đây là **kế hoạch review**, chưa tuyên bố ba lượt mới đã chạy. Báo cáo mỗi góc phải nêu finding, bằng chứng và việc cần sửa, không chỉ kết luận “đồng ý”.

Điều kiện duyệt chuyển sang code:

- [x] Điểm nghiệp vụ modifier đã đóng 09/09: thao tác sửa phần cũ không thuộc phạm vi; ca thêm mới có expected result 100.000đ.
- [ ] Đủ bảy artifact theo [SPEC-STANDARD.md](../../../openspec/SPEC-STANDARD.md), không chỉ các file khung.
- [ ] Input/output/lỗi/quyền và trạng thái cuối của từng endpoint đủ rõ để người thực hiện không đoán.
- [ ] Mỗi requirement/UC có test; từng biến thể quan trọng có dữ liệu/bước/expected result cụ thể.
- [ ] Không còn finding nghiêm trọng chưa xử lý trong lượt rà cuối; các giới hạn được ghi đúng phạm vi.
- [ ] Chủ dự án duyệt bộ spec cụ thể và yêu cầu triển khai.

Chuẩn dự án yêu cầu: “Phải hỏi hết câu chưa trả lời và ghi câu trả lời vào `## Quyết định đã chốt` **trước khi** viết bất kỳ file nào trong bộ bảy file trên.” **Cập nhật 09/09:** điểm nghiệp vụ modifier đã đóng và ghi vào proposal. Tiếp tục hoàn thiện bộ spec theo thứ tự chuẩn; không dùng câu hỏi sai phạm vi để tiếp tục trì hoãn hoặc yêu cầu chủ dự án xác nhận lại.

Sau khi code có, mới chạy các TC, test DB/cloud và cổng chất lượng phù hợp. **Duyệt spec trước code** và **nghiệm thu code sau test** là hai mốc khác nhau; cả hai cần bằng chứng riêng.

## 6. Làm rõ modifier và xét lại đề xuất giá — 09/09/2026

**Lịch sử đã bị thay thế bởi mục 7 trong cùng ngày.** Bằng chứng mô hình giá riêng bên dưới vẫn đúng, nhưng đề xuất thêm modifier lên phần món cũ không thuộc luồng sản phẩm. Không lấy ví dụ 67.000đ dưới đây làm quyết định hoặc testcase đang chờ duyệt.

Chủ dự án hỏi lại: modifier dùng nhóm chung và có giá riêng, vì sao thêm modifier lại phải tính lại giá món gốc? Kiểm lại trên `main@7183b31`: nhận định về cấu trúc giá riêng là đúng. Phân biệt mô hình dữ liệu với chính sách chốt giá sau khi sửa đơn.

### Bằng chứng nguyên văn

`src/domain/models.ts:78–92`:

```ts
export type OptionValue = {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

// Liên kết nhiều-nhiều giữa món và nhóm tuỳ chọn dùng chung.
export type MenuItemOptionGroup = {
  id: string;
  menuItemId: string;
  optionGroupId: string;
  sortOrder: number;
};
```

`src/core/orderDraft.ts:4–11`:

```ts
export const calculateSnapshotTotal = (items: OrderItemSnapshot[]): number =>
  items.reduce((sum, item) => {
    const optionsTotal = item.options.reduce(
      (optionSum, option) => optionSum + option.priceDelta * option.quantity,
      0,
    );
    return sum + (item.unitPrice + optionsTotal) * item.quantity;
  }, 0);
```

Mỗi dòng tính `(giá gốc + tổng giá modifier × số phần modifier trên một món) × số món`. Giá nằm ở **lựa chọn trong nhóm**, không ở bản thân group. Nhóm được dùng chung giữa những món có liên kết, không phải mọi món tự động dùng tất cả nhóm. Modifier là lựa chọn/phụ thu gắn với dòng món; cấu trúc trên không biến nó thành một `MenuItem` bán riêng. Size cũng có thể là một lựa chọn có phụ thu, không mặc định là một sản phẩm có giá trọn gói khác.

Giới hạn hiện hành vẫn còn: sửa đơn mở dựng snapshot lại từ menu hiện tại. Ví dụ mock adapter tại `src/adapters/mock/orderRepo.ts:66–68`:

```ts
      existingOrder.items = snapshotDraftItems(this.state.menu, activeItems);
      existingOrder.total = calculateSnapshotTotal(existingOrder.items);
      existingOrder.lockVersion += 1;
```

Hàm `snapshotDraftItems` đọc giá từng option tại `src/core/orderDraft.ts:26–48` và giá base tại `:51–59`. Nhánh SQL tương ứng đã được đọc tại `supabase/migrations/012_action_permission_guardrails.sql:675–679,798–918`: đánh dấu phần cũ removed, tạo lại phần mới từ `menu_items.price` và `option_values.price_delta`. Các đoạn đầy đủ của luồng replace-submit nằm trong [08](08-review-doc-lap-plan-07.md). Do đó **giá được lưu riêng** không đồng nghĩa **luồng sửa đơn đã giữ được giá lịch sử**; đây vẫn là việc phải sửa và kiểm thử trong change.

### Đề xuất đã điều chỉnh, chưa phải quyết định mới của chủ dự án

Analyst rút ưu tiên cho phương án tính lại base chỉ vì thêm/đổi modifier. Việc mô tả phương án đó là đơn giản hơn về triển khai không chứng minh nó phù hợp nghiệp vụ hơn.

- Giữ base đã được server ghi; phần modifier giữ nguyên cũng giữ snapshot đã ghi.
- Phần modifier bổ sung lấy giá hiện hành tại lần server chấp nhận bổ sung; tổng tiền được hiển thị trước xác nhận.
- Ví dụ hai ly base 30.000đ đã ghi, menu tăng base lên 35.000đ, thêm topping 7.000đ cho một ly: `30.000 + (30.000 + 7.000) = 67.000đ`. Ví dụ 72.000đ ở lời giải thích trước chỉ thuộc phương án cũ chưa được duyệt.
- Quy tắc gọi thêm ly mới không đổi: phần base mới vẫn lấy 35.000đ. Sửa modifier của ly cũ và gọi thêm một ly là hai nghiệp vụ khác nhau.

Ưu: giữ cam kết giá của phần không đổi, phù hợp cách tách giá trong mô hình. Đánh đổi: contract/test phải giữ nguồn gốc cả phần modifier cũ và mới, nhất là tăng số lượng cùng modifier sau khi giá đổi; không thể chỉ cộng dồn số lượng rồi lấy một đơn giá.

Cần cụ thể hóa các ca tăng/giảm số phần topping, thay lựa chọn trong nhóm single, bỏ rồi thêm lại, sửa một ly trong nhiều ly, và retry khi giá thay đổi. Câu hỏi kiểm tra mô hình của chủ dự án **không được ghi thành đã duyệt tất cả các ca này**. Không thay code hoặc công bố thêm kết quả test trong lần làm rõ này.

## 7. Chốt đúng luồng thêm món — 09/09/2026

**Chủ dự án đã làm rõ:** món được tạo rồi không có luồng thêm modifier vào chính món đó; cần thêm món mới và chọn modifier cho phần thêm. Đơn đã ghi A ×2 giá 30.000đ; sau khi menu cập nhật A lên 40.000đ, thêm A ×1 với modifier 0đ thì tổng phải là **100.000đ**.

### Bằng chứng UI nguyên văn

Đã tìm mọi nơi dùng `ModifierPickerPopup`, `useOrderModifierPicker`, `picker.requestAdd`, `picker.confirm`, `setModifierItem` trong toàn bộ `src`, sau đó đọc hook và nơi gắn handler. Không chỉ dựa vào một lần tìm không thấy từ khóa.

Toàn bộ `src/features/pos/useOrderModifierPicker.ts:1–33`:

```ts
import { useState } from "react";
import type { MenuCatalog, MenuItem, SubmitOrderDraftItem, SubmitOrderDraftOption } from "@/domain";
import { addDraftMenuItem, getItemModifierGroups } from "./orderFlow";

// Điều phối việc thêm món vào giỏ: món có nhóm tuỳ chọn thì mở popup chọn modifier,
// món không có thì thêm thẳng. Tách khỏi OrderDrawer để giữ component gọn.
export function useOrderModifierPicker(
  menu: MenuCatalog | undefined,
  draftItems: SubmitOrderDraftItem[],
  setDraftItems: (items: SubmitOrderDraftItem[]) => void,
) {
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  const requestAdd = (menuItem: MenuItem) => {
    if (!menuItem.isAvailable) return;
    if (menu && getItemModifierGroups(menu, menuItem.id).length > 0) {
      setModifierItem(menuItem);
      return;
    }
    setDraftItems(addDraftMenuItem(draftItems, menuItem));
  };

  const confirm = (options: SubmitOrderDraftOption[]) => {
    if (modifierItem) {
      setDraftItems(addDraftMenuItem(draftItems, modifierItem, options));
    }
    setModifierItem(null);
  };

  const cancel = () => setModifierItem(null);

  return { modifierItem, requestAdd, confirm, cancel };
}
```

Toàn bộ hợp đồng props của giỏ tại `src/app/drawers/pos/OrderCartPane.tsx:8–21`:

```ts
type OrderCartPaneProps = {
  cartLines: CartLine[];
  draftItems: SubmitOrderDraftItem[];
  noteOpenId: string | null;
  total: number;
  showPaymentHint: boolean;
  primaryDisabled: boolean;
  primaryActionLabel: string;
  primaryActionTitle?: string;
  onAdjustQuantity: (lineId: string, delta: number) => void;
  onToggleNote: (lineId: string) => void;
  onUpdateNote: (lineId: string, note: string) => void;
  onPrimaryAction: () => void;
};
```

`src/app/drawers/pos/OrderDrawer.tsx:290–315` nối `onAddItem={picker.requestAdd}` ở menu và `onConfirm={picker.confirm}` ở popup. Các thao tác giỏ được nối vào tăng/giảm số lượng và ghi chú, không có handler sửa modifier dòng cũ. Đã đọc cả phần render của `OrderCartPane.tsx:46–113`: modifier được hiển thị qua `optionText`, các nút trên dòng là giảm, tăng và ghi chú. Đây là kết luận về **UI**, không phải khẳng định RPC hiện đã cấm một caller tự tạo payload thay cấu hình.

### Quyết định và hệ quả cho spec

1. Giữ luồng hiện hành: thêm món → chọn modifier → gửi lên server. Không tạo thêm chức năng sửa modifier phần đã ghi.
2. Hai A cũ giữ base 30.000đ và option snapshot đã ghi. A gọi mới giữ base 40.000đ và modifier 0đ. Tổng là `2×30.000 + 1×(40.000+0) = 100.000đ`.
3. Khác giá thì giữ riêng phần cũ/mới ngay cả khi cùng món, cùng lựa chọn và modifier đều 0đ. Modifier miễn phí vẫn là dữ liệu lựa chọn, không bị bỏ chỉ vì không tăng tiền.
4. Giảm số lượng hoặc sửa ghi chú không đổi snapshot giá phần còn lại. Tăng số lượng vẫn theo quy tắc gọi thêm đã chốt trước; không sửa modifier của phần cũ.
5. Dữ liệu gửi từ client phải phân biệt phần giữ lại và phần mới; server xác minh giá phần mới, lấy snapshot phần cũ từ dữ liệu server. Bảng contract còn phải cụ thể hóa, không chỉ giữ bất biến bằng cách ẩn nút UI.
6. Rút cả hai đề xuất 67.000đ/72.000đ vì chúng xét một luồng không được yêu cầu. Không hỏi lại chủ dự án về lựa chọn đó. Các nguồn nghiên cứu trước được giữ làm lịch sử tham khảo, không làm yêu cầu cho change.

**Lỗi phân tích của analyst:** đã chuyển từ việc nhận ra giá từng modifier được lưu riêng sang giả định có thao tác sửa modifier của món đã ghi. Cần kiểm cả luồng UI trước khi đặt câu hỏi nghiệp vụ. Việc chậm hoàn thiện spec vì câu hỏi này không phải do chủ dự án thiếu thông tin.

**Giới hạn code chưa thay đổi:** bằng chứng replace-submit ở mục 6 cho thấy các dòng cũ vẫn được dựng lại theo menu hiện hành. Tổng 100.000đ là yêu cầu vừa chốt, không phải kết quả đã chạy chứng minh trên ứng dụng. Không coi xác nhận đúng về luồng modifier là xác nhận luồng giá hiện đã đúng.

### Các biến thể kiểm thử được giữ trong phạm vi

| Ca | Dữ liệu và thao tác | Kết quả mong đợi |
| --- | --- | --- |
| PRE-IDEM-24, ví dụ chủ dự án | Ghi A ×2 giá 30.000đ; đổi menu thành 40.000đ; thêm A ×1 chọn modifier 0đ; gửi | Tổng 100.000đ; giữ phần cũ 60.000đ, phần mới 40.000đ và lựa chọn modifier 0đ |
| PRE-IDEM-24, cùng cấu hình | Cả phần cũ và mới cùng modifier 0đ; các bước giá như trên | Vẫn 100.000đ; không gộp mất hai mức giá dù option signature giống nhau |
| PRE-IDEM-24, modifier có phí | Phần cũ A ×2 giá 30.000đ không topping; phần mới A ×1 base 40.000đ, modifier 7.000đ | Tổng 107.000đ; modifier chỉ gắn vào phần mới |
| PRE-IDEM-24, split | Từ đơn 100.000đ, chọn một A cũ hoặc A mới ở hai fixture độc lập | A cũ thanh toán 30.000đ, còn 70.000đ; A mới thanh toán 40.000đ, còn 60.000đ |
| PRE-IDEM-24, mất ACK | Ghi thành công đơn 100.000đ, mất phản hồi; menu đổi tiếp rồi replay cùng K | Trả kết quả lần trước, không thêm món hoặc đổi giá lần trước |
| PRE-IDEM-25, phần cũ không đổi | Giữ ca ghi chú/giảm số món với modifier snapshot; không thao tác sửa modifier cũ | Giá/option phần còn lại không đổi theo menu |

Đây là dữ liệu cho testplan, chưa là mã test hoặc kết quả test. Đã đóng điểm nghiệp vụ modifier; tiếp theo là hoàn thiện các artifact và rà cuối, không cần mở thêm câu hỏi cho luồng ngoài phạm vi.
