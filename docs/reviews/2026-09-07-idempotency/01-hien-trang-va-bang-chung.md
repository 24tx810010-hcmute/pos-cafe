# 01 — Hiện trạng và bằng chứng mã nguồn

Mọi trích đoạn dưới đây lấy từ `main@7183b31` ngày 07/09/2026. Người đánh giá kiểm được trực tiếp từ tài liệu này mà không cần truy cập kho mã.

## 1. Vấn đề gốc

Thu ngân bấm **Gửi đơn**. Mạng ở quán chập chờn. Màn hình quay khoảng 10 giây rồi báo lỗi.

Có hai khả năng, và phía client **không có cách nào phân biệt**:

- **A** — Yêu cầu chưa tới máy chủ. Chưa có gì được tạo.
- **B** — Yêu cầu đã tới, máy chủ **đã tạo đơn xong**, nhưng gói tin trả về bị rớt.

Cả hai đều biểu hiện là timeout. Đây là ràng buộc cơ bản của giao tiếp qua mạng, không sửa được bằng cách chờ lâu hơn hay báo lỗi rõ hơn.

Thu ngân bấm lại. Nếu là ca A thì đúng. Nếu là ca B thì vừa tạo bản ghi thứ hai.

**Khóa chống trùng** là một chuỗi sinh **đúng một lần** khi người dùng bấm xác nhận, và **giữ nguyên qua mọi lần gửi lại**. Máy chủ ghi nhận khóa nào đã xử lý; gặp khóa cũ thì không thực hiện lại.

## 2. Kiến trúc liên quan

Ứng dụng là trang đơn React chạy trên tablet đặt cố định tại quán. Backend là Supabase, tức PostgreSQL cộng PostgREST cộng chính sách bảo mật mức dòng. Các thao tác ghi nghiệp vụ đi qua **hàm RPC viết bằng PL/pgSQL**, không phải qua truy vấn bảng trực tiếp.

Có **bốn lời gọi ghi nghiệp vụ**:

| Lời gọi | Việc |
| --- | --- |
| `submit_order_changes` | Tạo đơn mới, hoặc sửa món trong đơn đang mở |
| `pay_order` | Thanh toán toàn bộ một đơn |
| `pay_order_items` | Tách một phần món ra đơn mới rồi thanh toán ngay |
| `void_order` | Hủy một đơn đã thanh toán |

Mọi đơn mang cột `lock_version` phục vụ **khóa lạc quan**: client gửi kèm phiên bản nó đang thấy, máy chủ đối chiếu, khác thì từ chối.

Mọi RPC ghi đều lấy một **khóa tư vấn theo cửa hàng** ngay đầu hàm, nên ghi trong cùng một cửa hàng bị xếp hàng tuần tự:

```sql
perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':pos-write'));
```

*(`supabase/migrations/012_action_permission_guardrails.sql`, xuất hiện trong cả bốn hàm)*

## 3. Bằng chứng: adapter sinh định danh dự phòng

`src/adapters/supabase/paymentRepo.ts`, dòng 11–21:

```ts
async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
  const { data, error } = await this.client.rpc("pay_order", {
    p_payment_id: input.paymentId || crypto.randomUUID(),
    p_order_id: input.orderId,
    p_employee_id: input.employeeId,
    p_method: input.method,
    p_expected_lock_version: input.expectedVersion,
    p_received_amount: input.receivedAmount,
  });
  return mapPayOrderResult(requireData<Row>(data as Row | null, error));
}
```

`src/adapters/supabase/orderRepo.ts`, dòng 89–101:

```ts
async submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult> {
  const activeItemCount = input.items.filter((item) => item.quantity > 0).length;
  const orderId = input.orderId ?? (activeItemCount > 0 ? crypto.randomUUID() : null);
  const { data, error } = await this.client.rpc("submit_order_changes", {
    p_order_id: orderId,
    p_table_id: input.tableId,
    p_order_type: input.orderType,
    p_employee_id: input.employeeId,
    p_expected_lock_version: input.expectedVersion,
    p_items: input.items,
  });
  return mapSubmitOrderChangesResult(requireData<Row>(data as Row | null, error));
}
```

**Nhận xét.** Cả hai adapter sinh UUID mới nếu tầng gọi không truyền định danh xuống. Nghĩa là **mỗi lần gọi lại tạo ra một định danh khác**, và máy chủ nhìn thấy một thao tác hoàn toàn mới.

Đã kiểm bằng tìm kiếm toàn kho: **giao diện chưa bao giờ truyền `paymentId` xuống** — không có kết quả nào cho `paymentId` trong `src/features/pos/useOrderPaymentFlow.ts` và trong các thành phần giao diện POS. Nên nhánh `crypto.randomUUID()` là nhánh luôn chạy.

## 4. Bằng chứng: ba trong bốn lời gọi đã được chặn sẵn

### `pay_order`

`supabase/migrations/012_action_permission_guardrails.sql`:

```sql
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;

  if not found
    or v_order.status <> 'open'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Order status or lock_version changed before payment.';
  end if;
```

Sau khi thanh toán thành công, đơn không còn ở trạng thái `open`. Lần gọi thứ hai vì vậy rơi vào nhánh `raise exception`.

### `pay_order_items`

Cùng file, trong hàm `pay_order_items`, dòng 110–112 của thân hàm:

```sql
    or v_source.status <> 'open'::public.order_status
    or v_source.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
```

Guard đặt trên **đơn nguồn**, tức đơn bị tách món ra. Sau lần tách đầu tiên, `lock_version` của đơn nguồn đã đổi.

### `void_order`

`supabase/migrations/011_void_paid_order.sql`, dòng 157–159:

```sql
  if v_order.status <> 'paid'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
```

Đơn đã hủy không còn ở trạng thái `paid`.

### `submit_order_changes` với đơn **đã tồn tại**

Cùng cơ chế: hàm tra đơn theo `p_order_id`, tìm thấy thì đối chiếu `lock_version`.

## 5. Bằng chứng: chỗ thủng thật là tạo đơn mới

Trong `submit_order_changes`, nhánh xử lý khi client **không truyền** `p_order_id`:

```sql
  if p_order_id is null then
    if v_active_count = 0 then
      return jsonb_build_object(
        'orderId', null,
        ...
```

Và kiểu dữ liệu của phiên bản khóa, `src/domain/inputs.ts` dòng 45:

```ts
  expectedVersion: number | null;
```

Đơn mới truyền `null` cho trường này — xác nhận trong `src/features/pos/orderFlow.test.ts` dòng 139, 216, 274.

**Kết luận cần bạn kiểm.** Với một đơn mới:

- Đơn chưa tồn tại, nên **không có `lock_version` nào để đối chiếu**.
- `orderId` do adapter sinh, **mỗi lần gọi một giá trị khác**.

Vì vậy lần bấm thứ hai trông giống hệt một đơn hoàn toàn mới, và máy chủ tạo đơn thứ hai. Đây là ca duy nhất trong bốn ca thực sự sinh dữ liệu trùng.

## 6. Hai cơ chế khác nhau cho hai bài toán khác nhau

Bảng này là một kết luận quan trọng, xin bạn soi kỹ.

| Cơ chế | Chặn tình huống | Vì sao cái kia không chặn được |
| --- | --- | --- |
| Khóa lạc quan (`lock_version`) | **Nhiều máy** cùng sửa một đơn | Hai máy sinh **hai khóa chống trùng khác nhau** vì chúng sinh độc lập, nên máy chủ thấy hai thao tác riêng biệt |
| Khóa chống trùng | **Một máy** gửi lại cùng một thao tác | Lần gửi lại mang **đúng `lock_version` cũ** mà nó vừa đọc, nên nếu thao tác lần đầu chưa kịp ghi thì khóa lạc quan không phân biệt được |

Diễn biến khi hai máy cùng thanh toán một đơn:

| Bước | Máy A | Máy B |
| --- | --- | --- |
| 1 | Đọc đơn, `lock_version = 5` | Đọc đơn, `lock_version = 5` |
| 2 | Gọi `pay_order` với version 5 | |
| 3 | Máy chủ: khớp, ghi thanh toán, `status` thành `paid`, version thành 6 | |
| 4 | | Gọi `pay_order` với version 5 |
| 5 | | Máy chủ: `status` không còn `open` → `ORDER_VERSION_CONFLICT` |

Khóa tư vấn theo cửa hàng bảo đảm bước 3 và bước 5 không xen kẽ nhau giữa chừng.

## 7. Bằng chứng: thao tác quản trị đã tự an toàn

`src/domain/changes.ts`:

```ts
export type Changeset<TCreate, TUpdate, TDelete> = {
  created: TCreate[];
  updated: TUpdate[];
  deleted: TDelete[];
};

export type CategoryCreate = { id: string; name: string; sortOrder: number };

export type MenuItemCreate = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageAssetKey?: string | null;
  sortOrder: number;
  isAvailable: boolean;
};

export type OptionGroupCreate = {
  id: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  sortOrder: number;
};
```

Mọi kiểu `*Create` **mang sẵn `id: string`** do client sinh. Gửi lại cùng một changeset là ghi lại cùng khóa chính, nên không sinh bản ghi trùng.

## 8. Bằng chứng: nơi giữ trạng thái phía client

`src/app/useAppStore.ts` — kho trạng thái toàn cục dùng zustand, **không có middleware `persist`**:

```ts
import { create } from "zustand";

type AppState = {
  screen: AppScreen;
  currentEmployee: Employee | null;
  ...
  draftItems: SubmitOrderDraftItem[];
  ...
  setDraftItems: (items: SubmitOrderDraftItem[]) => void;
};
```

Giỏ hàng đang soạn (`draftItems`) nằm ở đây chứ không nằm trong state của thành phần React. Hệ quả: nó **sống sót khi ngăn kéo đóng mở**, nhưng **mất khi tải lại trang**.

Tìm kiếm toàn kho cho `localStorage`, `sessionStorage` và `indexedDB` trong `src/`: **không có kết quả nào**. Ứng dụng hiện không lưu bền gì phía client, ngoài phiên đăng nhập do thư viện Supabase tự quản.

## 9. Bằng chứng: cơ chế làm mới dữ liệu sau khi ghi

`src/features/pos/posInvalidation.ts`, toàn văn phần liên quan:

```ts
export const invalidateAfterOrderMutation = async (
  queryClient: QueryClient,
  orderId?: string | null,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot }),
    orderId ? queryClient.invalidateQueries({ queryKey: posQueryKeys.order(orderId) }) : Promise.resolve(),
  ]);

  await Promise.all([
    queryClient.refetchQueries({ queryKey: posQueryKeys.openOrders, type: "active" }),
    queryClient.refetchQueries({ queryKey: posQueryKeys.floorPlan, type: "active" }),
  ]);
};
```

Được gọi từ `src/features/pos/useOrderPaymentFlow.ts` sau mỗi lần ghi. Nó vô hiệu hóa bộ nhớ đệm **và chủ động tải lại** đơn đang mở cùng sơ đồ bàn.

Đoạn mã này quan trọng cho lập luận ở tài liệu `03` câu B.

## 10. Bằng chứng: hệ không tự thử lại

`src/app/AppProviders.tsx`:

```tsx
const queryClient = useMemo(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: false,
        },
      },
    }),
  [],
);
```

`retry: false` áp cho toàn bộ truy vấn. Hệ hiện **không tự thử lại bất cứ lời gọi nào**.

## 11. Tóm tắt hiện trạng

| Lời gọi | Guard đang có | Gọi lại thì sao |
| --- | --- | --- |
| `pay_order` | `status <> 'open'` + `lock_version` | Lỗi `ORDER_VERSION_CONFLICT` |
| `pay_order_items` | như trên, trên đơn nguồn | Lỗi |
| `void_order` | `status <> 'paid'` + `lock_version` | Lỗi |
| `submit_order_changes`, đơn đã có | `lock_version` | Lỗi |
| **`submit_order_changes`, đơn mới** | **không có** | **Tạo đơn thứ hai** |

Hại thật hiện nay:

- **Sai dữ liệu**: chỉ ở luồng tạo đơn mới.
- **Trải nghiệm tệ**: ở ba luồng còn lại — thu ngân bấm lại, nhận lỗi khó hiểu, và **không biết tiền đã vào hay chưa**.

Bản `proposal.md` gốc của change này viết rằng hậu quả là *"hai bản ghi thanh toán cho một lần thu tiền, kéo theo doanh thu sai"*. Theo phân tích trên thì **phát biểu đó nói quá**, và đã được đính chính trong proposal ngày 07/09/2026.
