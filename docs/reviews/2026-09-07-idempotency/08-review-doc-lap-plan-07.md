# 08 — Review độc lập plan 07 so với mã thực tế

Ngày: **08/09/2026**. Đối tượng: [07 — Ưu tiên online và khôi phục trên server](07-uu-tien-online-va-khoi-phuc-tren-server.md). Change liên quan: [add-idempotent-write-operations](../../../openspec/changes/add-idempotent-write-operations/proposal.md).

**Trạng thái:** tổng hợp đánh giá, chưa phải spec được duyệt, không phải báo cáo tính năng đã triển khai. Các lựa chọn cần chủ dự án quyết định được giải thích tại [09](09-giai-thich-cac-lua-chon-con-mo.md).

## Phương pháp và phạm vi kiểm chứng

- Ba reviewer A/B/C được giao **toàn bộ cùng một bài review**, ở ba ngữ cảnh mới không kế thừa hội thoại; không chia nhỏ mỗi người một tầng và không trao đổi kết quả với nhau. Bản tổng hợp này do agent chính viết sau khi đối chiếu bằng chứng.
- Mã ứng dụng: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`, tại `D:/Workspace/pos-cafe`.
- Hướng dẫn dự án và plan: worktree `D:/Workspace/pos-cafe-docs`, nhánh `docs`. Plan 07 là file trong working tree, chưa commit; không gán nhầm nó cho commit HEAD của docs.
- SHA-256 của plan 07 trước và sau review: `603A61ECACBA1A871A34FC5A6DC3476204FFCDD7E840BE62397FC193B26A6B15`. Giữ nguyên file này suốt đợt review.
- Reviewer đọc luồng UI → flow → adapter/port → định nghĩa RPC theo chuỗi migration → schema/quyền → test. Agent chính đọc lại những đoạn được dùng để kết luận trong bản này và chạy lại probe về mutation.
- Không sửa mã ứng dụng, không gọi Supabase cloud, không chạy migration hoặc thí nghiệm tranh chấp trên DB thật. Không dùng các test mock qua để tuyên bố Postgres đã đúng.

| Nội dung | Reviewer A | Reviewer B | Reviewer C |
| --- | --- | --- | --- |
| Online/register/execute/recovery | Có cơ sở, chưa đủ để triển khai | Có cơ sở, chưa đủ để triển khai | Có cơ sở, chưa đủ để triển khai |
| Mutation tự resume | Đọc thư viện + probe xác nhận | Đọc thư viện + probe xác nhận | Đọc thư viện + probe xác nhận |
| Giá/ngày lúc execute | Nêu ca thay đổi giá/ngày, P1 | Nêu ca thay đổi giá/ngày | Nêu ca thay đổi giá/ngày, P2 |
| Đường RPC cũ | Chỉ ra overload 7 tham số và đường ghi | Chỉ ra overload 7 tham số và đường ghi | Chỉ ra cắt chuyển client cũ/đường ghi; không dùng kết quả này để xác nhận riêng overload 7 tham số |
| Phiếu bếp và ranh giới nhân viên | Nêu cả hai | Nêu cả hai | Nêu cả hai |
| Đối chiếu trước khi thu tiếp | Ưu tiên cảnh báo; bước bắt buộc cần quyết định nghiệp vụ | Ưu tiên cảnh báo; bước bắt buộc cần quyết định nghiệp vụ | Nghiêng về chặn/buộc đối chiếu hẹp tại đơn chịu ảnh hưởng |

Ba ngữ cảnh độc lập làm giảm việc truyền kết luận giữa reviewer, nhưng không phải ba nhóm chuyên gia với nền tảng hoàn toàn khác nhau. Sự đồng thuận không thay bằng chứng mã hoặc test. Agent chính nghiêng về đối chiếu hẹp trước lần thu tiếp; đây là khuyến nghị riêng được giải thích cùng ưu/nhược trong 09.

## Kết luận cần mang sang lần sửa spec

Hướng ưu tiên online và khôi phục lệnh đã đăng ký trên server **vẫn có cơ sở**. Bản 07 đã đúng khi không suy timeout thành thất bại, không tự gộp hai đơn giống nhau, và ghi rõ còn quyết định mở. Không coi mọi chức năng chưa triển khai là bug của plan.

Tuy nhiên, 07 chưa đủ làm hợp đồng triển khai. Có **bốn phát hiện cụ thể cần bổ sung**: mutation tự chạy sau offline, giá/ngày kinh doanh tại lần execute đầu, chữ ký RPC cũ và các đường ghi không qua giao thức, dữ liệu phiếu bếp không nằm đầy đủ trong kết quả RPC. Quyền nhân viên, `NULL`, định danh đơn tách và callback thành công cũng phải được giải thích chính xác trước khi chốt.

| Mã | Mức độ | Kết luận | Ảnh hưởng tới spec |
| --- | --- | --- | --- |
| F1 | P1 | Mutation có thể bị pause rồi tự gửi khi online | Yêu cầu “thử lại thủ công” phải bao gồm cả lần gửi đầu bị trì hoãn; không chỉ đặt `retry: false` |
| F2 | P1 | Payload bất biến không đồng nghĩa giá/ngày kinh doanh bất biến | Chốt điều kiện thực hiện lần đầu sau đăng ký; không âm thầm đổi nội dung kinh tế đã xác nhận |
| F3 | P2; P1 nếu hứa bắt buộc mọi ghi đi qua giao thức | Còn chữ ký `pay_order_items` cũ theo chuỗi migration; RLS không yêu cầu đăng ký lệnh | Inventory theo tên + kiểu đối số; đóng đường cũ và quyền ghi liên quan theo phạm vi bảo đảm |
| F4 | P2 | Ticket RPC là toàn đơn; phiếu bếp của lần sửa là delta ở client | Chọn lưu delta bền vững hoặc công bố chưa phục hồi phiếu bếp đó |
| F5 | Ranh giới bảo mật, đã nằm trong câu hỏi quyền | `employeeId` chưa là danh tính nhân viên được server xác thực | Không hứa “chỉ quản lý” chống được giả mạo API nếu vẫn giữ nền tảng xác thực hiện tại |
| F6 | P1 hiện có, 07 đã nhắc | `NULL` lọt kiểm tra version trong SQL; mock khác SQL | Sửa guard và test SQL trực tiếp; phân biệt tạo mới với đơn có sẵn |

P1/P2 là mức ưu tiên khắc phục khoảng trống trong thiết kế và mã liên quan, **không phải bằng chứng đã có sự cố ngoài thực tế**. Không đo độ trễ, tải hoặc xác suất xảy ra tại quán.

<a id="e1--mutation-co-the-tu-chay-khi-mang-tro-lai"></a>

## E1 — Mutation có thể tự chạy khi mạng trở lại

`src/app/AppProviders.tsx:30` chỉ cấu hình retry cho query. Bốn hook mutation ở `src/features/pos/useOrderPaymentFlow.ts:19,33,46,60` không có cấu hình mạng riêng. Ví dụ nguyên văn:

[src/app/AppProviders.tsx:28–40](D:/Workspace/pos-cafe/src/app/AppProviders.tsx:28)

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

[src/features/pos/useOrderPaymentFlow.ts:19–30](D:/Workspace/pos-cafe/src/features/pos/useOrderPaymentFlow.ts:19)

```ts
  return useMutation({
    mutationFn: (input: SubmitOrderFlowInput) => submitOrderAndPrint(ports, input),
    // Fire-and-forget: cập nhật UI ngay (đóng drawer, mở popup gửi bếp), đồng bộ
    // các query nền song song; máy khác nhận trễ tối đa ~5s (poll/realtime).
    onSuccess: (result, input) => {
      void invalidateAfterOrderMutation(queryClient, result.orderId ?? input.context.orderId).catch(() => {});
    },
  });
};

export const usePayOrderMutation = () => {
  const ports = usePorts();
```

Thư viện **đang cài** là `@tanstack/query-core@5.101.0`, theo `node_modules/@tanstack/query-core/package.json:3`. Không coi con số này là phiên bản đã được chốt bởi mọi máy/lockfile. Logic mặc định và nối lại mutation:

[node_modules/@tanstack/query-core/src/retryer.ts:53–57](D:/Workspace/pos-cafe/node_modules/@tanstack/query-core/src/retryer.ts:53)

```ts
export function canFetch(networkMode: NetworkMode | undefined): boolean {
  return (networkMode ?? 'online') === 'online'
    ? onlineManager.isOnline()
    : true
}
```

[node_modules/@tanstack/query-core/src/queryClient.ts:78–95](D:/Workspace/pos-cafe/node_modules/@tanstack/query-core/src/queryClient.ts:78)

```ts
  mount(): void {
    this.#mountCount++
    if (this.#mountCount !== 1) return

    this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
      if (focused) {
        await this.resumePausedMutations()
        this.#queryCache.onFocus()
      }
    })
    this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
      if (online) {
        await this.resumePausedMutations()
        this.#queryCache.onOnline()
      }
    })
  }

```

Agent chính và các reviewer đã thử bằng thư viện cục bộ, không gọi network. Probe của agent chính:

```js
import { QueryClient, onlineManager } from '@tanstack/query-core';
const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
client.mount();
onlineManager.setOnline(false);
let calls = 0;
const mutation = client.getMutationCache().build(client, {
  mutationFn: async () => { calls++; return 'done'; }
});
const firstAttempt = mutation.execute({ orderId: 'demo-read-only-probe' });
await new Promise(resolve => setTimeout(resolve, 20));
console.log(JSON.stringify({ stage: 'offline', calls, paused: mutation.state.isPaused, status: mutation.state.status }));
onlineManager.setOnline(true);
await firstAttempt;
console.log(JSON.stringify({ stage: 'online-without-second-click', calls, paused: mutation.state.isPaused, status: mutation.state.status }));
client.unmount();
client.clear();
```

Kết quả:

```text
{"stage":"offline","calls":0,"paused":true,"status":"pending"}
{"stage":"online-without-second-click","calls":1,"paused":false,"status":"success"}
```

Đây là **tự chạy lần đầu sau khi pause**, không phải bằng chứng RPC đã thất bại rồi thư viện retry. Probe cũng không thay cho kiểm thử toàn luồng trình duyệt đóng drawer/đổi màn hình. Hành vi mặc định được mô tả trong [tài liệu TanStack về network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

**Ca hỏng:** thu ngân có đơn trong cache, mất mạng, bấm thanh toán rồi chuyển việc. Lệnh có thể nằm chờ trong bộ nhớ và chạy khi online. Hướng spec phải cấm tự thực hiện lệnh do reconnect/focus/remount; cấu hình cơ chế không pause lệnh ghi cùng controller phân loại lỗi là phần thiết kế cần làm. Cờ online chỉ hỗ trợ UX, không chứng minh server đã nhận hay chưa nhận.

<a id="e2--gia-va-ngay-kinh-doanh-duoc-doc-luc-execute"></a>

## E2 — Giá và ngày kinh doanh được đọc lúc execute

Input submit hiện không mang báo giá server đã chốt. SQL đọc menu hiện hành và tạo ngày kinh doanh từ thời gian lúc thực hiện:

[src/domain/inputs.ts:40–47](D:/Workspace/pos-cafe/src/domain/inputs.ts:40)

```ts
export type SubmitOrderChangesInput = {
  orderId: string | null;
  tableId: string | null;
  orderType: OrderType;
  employeeId: string;
  expectedVersion: number | null;
  items: SubmitOrderDraftItem[];
};
```

[supabase/migrations/012_action_permission_guardrails.sql:751–757](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:751)

```sql
    select coalesce(ss.timezone, 'Asia/Saigon')
    into v_timezone
    from public.store_settings ss
    where ss.store_id = v_store_id;

    v_timezone := coalesce(v_timezone, 'Asia/Saigon');
    v_business_date := (now() at time zone v_timezone)::date;
```

[supabase/migrations/012_action_permission_guardrails.sql:815–827](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:815)

```sql
    select *
    into v_menu_item
    from public.menu_items mi
    where mi.store_id = v_store_id
      and mi.id = v_item."menuItemId"
      and mi.deleted_at is null
      and mi.is_available = true;

    if not found then
      raise exception 'MENU_ITEM_UNAVAILABLE'
        using errcode = 'P0001',
              hint = 'Menu item is missing, deleted, unavailable, or outside the current store.';
    end if;
```

[supabase/migrations/012_action_permission_guardrails.sql:829–854](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:829)

```sql
    v_sort_order := v_sort_order + 1;
    v_option_total := 0;

    insert into public.order_items (
      id,
      store_id,
      order_id,
      menu_item_id,
      item_name,
      quantity,
      unit_price,
      note,
      status,
      sort_order
    ) values (
      v_item.id,
      v_store_id,
      p_order_id,
      v_menu_item.id,
      v_menu_item.name,
      v_item.quantity,
      v_menu_item.price,
      nullif(v_item.note, ''),
      'waiting'::public.order_item_status,
      v_sort_order
    );
```

Option cũng được đọc từ dữ liệu hiện hành tại `supabase/migrations/012_action_permission_guardrails.sql:875–918`. Với payment, giá lấy từ snapshot của order/item tại cùng file, dòng 204 và 1061–1113; không được suy tất cả RPC đều cần một cơ chế giữ giá mới.

**Ca hỏng:** đăng ký một cà phê lúc giá 30.000đ, chưa execute; sau khi giá thành 35.000đ, máy khác tiếp tục đúng payload cũ nhưng SQL dùng giá mới. Nếu tiếp tục đơn mới qua nửa đêm, ngày kinh doanh được xác định ở ngày sau. Idempotency vẫn có thể đúng về số lần ghi, nhưng “nội dung đã xác nhận” chưa được bảo đảm về giá.

**Bổ sung cần thiết:** tách lần execute đầu tiên khỏi replay kết quả đã commit. Chọn giá lúc execute, giá được giữ từ đăng ký, hoặc từ chối khi điều kiện đã xác nhận thay đổi. Phương án nào cũng phải có UX đúng với lời hứa; việc chốt giá phải dựa vào kiểm chứng của server, không tin giá client tự khai.

<a id="e3--phai-kiem-ke-rpc-theo-chu-ky-va-duong-ghi"></a>

## E3 — Phải kiểm kê RPC theo chữ ký và đường ghi

| Tên + số tham số | Định nghĩa cuối trong repository |
| --- | --- |
| `submit_order_changes`, 6 | `012_action_permission_guardrails.sql:460` |
| `pay_order`, 6 | `012_action_permission_guardrails.sql:995` |
| `pay_order_items`, 8 | `012_action_permission_guardrails.sql:37` |
| `void_order`, 5 | `011_void_paid_order.sql:80` |
| `pay_order_items`, **7** | `009_partial_payment.sql:81`; không tìm thấy migration sau drop chữ ký này |

Hai đoạn tạo hàm khác nhau:

[supabase/migrations/009_partial_payment.sql:81–93](D:/Workspace/pos-cafe/supabase/migrations/009_partial_payment.sql:81)

```sql
create or replace function public.pay_order_items(
  p_payment_id uuid,
  p_order_id uuid,
  p_employee_id uuid,
  p_method public.payment_method,
  p_expected_lock_version integer,
  p_received_amount integer,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
```

[supabase/migrations/010_split_payment.sql:17–42](D:/Workspace/pos-cafe/supabase/migrations/010_split_payment.sql:17)

```sql
drop view if exists public.history_entries;

alter table public.order_items drop constraint if exists order_items_payment_fk;
drop index if exists public.order_items_store_payment_idx;
alter table public.order_items drop column if exists payment_id;
alter table public.orders drop column if exists paid_amount;

-- Giữ payments_store_order_idx (hữu ích cho tra cứu payment theo đơn).
create index if not exists payments_store_order_idx
  on public.payments (store_id, order_id, paid_at);

-- ----- 2. RPC pay_order_items: tách đơn độc lập và thanh toán ngay -----
create or replace function public.pay_order_items(
  p_payment_id uuid,
  p_order_id uuid,
  p_new_order_id uuid,
  p_employee_id uuid,
  p_method public.payment_method,
  p_expected_lock_version integer,
  p_received_amount integer,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
```

PostgreSQL xác định overload theo tên và kiểu đối số đầu vào. Thay danh sách kiểu qua `CREATE OR REPLACE FUNCTION` tạo một hàm khác, không thay thế hàm cũ. Đây là suy luận từ mã migration theo [tài liệu PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).

Đã tìm `drop function` trên toàn bộ `supabase/migrations`: chỉ thấy hai lệnh trong 011 cho `verify_employee_pin(uuid,text)` và `void_order(uuid,uuid)`. Tuy nhiên, **chưa truy vấn catalog DB đã triển khai**. Bản split cũ tham chiếu `oi.payment_id` ở 009:210, trong khi 010:21 đã bỏ cột; không kết luận overload đó hiện có thể thanh toán thành công hoặc đã gây thu trùng.

**Ảnh hưởng:** một wrapper mới không tự loại bỏ hàm keyless, helper public hay DML trực tiếp. Khi thêm tham số operation ID phải chỉ rõ chữ ký public được hỗ trợ, chữ ký cần bỏ/thu hồi và hành vi client cũ. Nếu bảo đảm là “DB chỉ cho ghi qua lệnh đã đăng ký”, cần đóng các đường ghi còn lại; test phải gọi thẳng chúng, không chỉ thử UI.

<a id="e4--phieu-bep-la-phan-tang-them-ket-qua-rpc-la-toan-don"></a>

## E4 — Phiếu bếp là phần tăng thêm; kết quả RPC là toàn đơn

UI tính phần tăng thêm trước submit và dùng nó cho preview:

[src/app/drawers/pos/OrderDrawer.tsx:134–166](D:/Workspace/pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:134)

```tsx
  const submitOrder = () => {
    if (!context || !currentEmployee) return;

    // Chốt các món MỚI THÊM ngay tại thời điểm bấm gửi (dữ liệu trên máy) để in
    // phiếu gửi bếp — không phụ thuộc payload/refetch từ server.
    const addedLines = menu ? diffAddedPrintLines(menu, orderDetail, draftItems) : [];

    submitMutation.mutate(
      {
        context,
        actor: currentEmployee,
        expectedVersion: orderDetail?.lockVersion ?? null,
        items: draftItems,
      },
      {
        onSuccess: (result) => {
          if (result.status !== "void" && addedLines.length > 0) {
            openReceiptPreview({
              variant: "kitchen",
              doc: {
                orderNo: result.orderNo,
                tableName: table?.name ?? null,
                orderType: context.orderType,
                lines: addedLines,
                total: addedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
              },
            });
          }
          toast.success(result.status === "void" ? "Đã huỷ đơn mở." : "Đã in/gửi đơn.");
          closeDrawer();
        },
        onError: handleSubmitError,
      },
```

Kết quả SQL lại tổng hợp toàn bộ món hiện còn trong đơn. Các đoạn nguyên văn của cùng truy vấn và kết quả trả:

[supabase/migrations/012_action_permission_guardrails.sql:945–951](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:945)

```sql
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.item_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'options', coalesce(
```

[supabase/migrations/012_action_permission_guardrails.sql:964–972](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:964)

```sql
      order by oi.sort_order
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.order_items oi
  where oi.store_id = v_store_id
    and oi.order_id = p_order_id
    and oi.status <> 'removed'::public.order_item_status;
```

[supabase/migrations/012_action_permission_guardrails.sql:974–991](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:974)

```sql
  v_ticket := jsonb_build_object(
    'orderNo', v_order_no,
    'tableName', v_table_name,
    'orderType', v_order_type,
    'lines', v_lines,
    'total', v_total
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'status', 'open',
    'tableId', p_table_id,
    'tableStatus', case when p_table_id is null then null else 'occupied' end,
    'orderNo', v_order_no,
    'businessDate', v_business_date::text,
    'lockVersion', v_lock_version,
    'ticket', v_ticket
  );
```

**Ca hỏng:** hai cà phê đã gửi bếp, lần này thêm một bánh. Máy A mất phản hồi/local. Khôi phục bằng full ticket trên máy B có thể làm phiếu lần này thành hai cà phê và một bánh. Không thể tính đúng delta chỉ từ đơn hiện tại sau khi những thao tác khác đã diễn ra.

**Bổ sung cần thiết:** nếu muốn phục hồi phiếu bếp đúng lần gửi, lưu delta như một phần kết quả bền vững của thao tác; nếu hoãn, ghi rõ giới hạn. Việc này là thay đổi hợp đồng dữ liệu, không chỉ thêm nút in. `src/adapters/browser/printPort.ts:12–18` hiện no-op; UI mới mở preview/in, nên không kết luận print port đang in trùng.

Bất nhất phụ cần test nếu nhận phạm vi dựng lại hóa đơn: `ReceiptPreview.tsx:14` cộng giá option nhưng bỏ hệ số quantity; `orderFlow.ts:347` có nhân. Ví dụ món 30.000đ + option 5.000đ ×2: dòng dựng lại có thể hiển thị 35.000đ trong khi tổng tính tiền là 40.000đ. Đây là lỗi hiện có ở helper dựng phiếu, không phải lỗi quyết định online:

[src/app/components/ReceiptPreview.tsx:12–24](D:/Workspace/pos-cafe/src/app/components/ReceiptPreview.tsx:12)

```tsx
const linesFromItems = (items: OrderDetail["items"]): PrintTicket["lines"] =>
  items.map((item) => {
    const optionDelta = item.options.reduce((sum, option) => sum + option.priceDelta, 0);
    return {
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice + optionDelta,
      options: [
        ...item.options.map((option) => option.optionName),
        ...(item.note ? [`Ghi chú: ${item.note}`] : []),
      ],
    };
  });
```

[src/features/pos/orderFlow.ts:347–348](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:347)

```ts
    unitTotal: item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta * option.quantity, 0),
  }));
```

<a id="e5--danh-tinh-nhan-vien-va-duong-ghi"></a>

## E5 — Danh tính nhân viên và đường ghi

Đăng nhập Supabase bằng Store Key; xác minh PIN trả Employee; RPC thanh toán chọn nhân viên theo `p_employee_id` mà client truyền:

[src/adapters/supabase/authRepo.ts:19–25](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:19)

```ts
  async pairStore(storeKey: string): Promise<void> {
    const parsed = parseStoreKey(storeKey);
    const { error } = await this.client.auth.signInWithPassword({
      email: storeEmailForNo(parsed.storeNo),
      password: parsed.secret,
    });
    throwIfError(error, "AUTH_REQUIRED");
```

[src/adapters/supabase/employeeRepo.ts:30–39](D:/Workspace/pos-cafe/src/adapters/supabase/employeeRepo.ts:30)

```ts
  async verifyPin(employeeId: string, pin: string): Promise<Employee> {
    const { data, error } = await this.client.rpc("verify_employee_pin", {
      p_employee_id: employeeId,
      p_pin: pin,
    });
    throwIfError(error, "INVALID_PIN");

    const row = Array.isArray(data) ? data[0] : data;
    return { ...mapEmployee(requireData<Row>(row as Row | null, null)), isActive: true };
  }
```

[supabase/migrations/012_action_permission_guardrails.sql:1024–1045](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:1024)

```sql
  select e.role, coalesce(e.permission_overrides, '{}'::jsonb)
  into v_employee_role, v_overrides
  from public.employees e
  where e.store_id = v_store_id
    and e.id = p_employee_id
    and e.is_active = true;

  if not found then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee must be active and belong to the current store.';
  end if;

  if not public.has_employee_permission(
    v_employee_role,
    v_overrides,
    'payment.take'
  ) then
    raise exception 'FORBIDDEN'
      using errcode = 'P0001',
            hint = 'Employee lacks payment.take permission.';
  end if;
```

Trong split payment, người ghi nhận trên payment cũng được lấy từ cùng đối số. Điều này khiến việc đổi người tiếp tục có ý nghĩa nghiệp vụ, không chỉ là kiểm quyền:

[supabase/migrations/012_action_permission_guardrails.sql:359–379](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:359)

```sql
  insert into public.payments (
    id,
    store_id,
    order_id,
    employee_id,
    method,
    amount,
    received_amount,
    change_amount,
    paid_at
  ) values (
    p_payment_id,
    v_store_id,
    p_new_order_id,
    p_employee_id,
    p_method,
    v_amount,
    p_received_amount,
    v_change_amount,
    v_paid_at
  );
```

Vì chưa gắn phiên server với nhân viên cụ thể, kiểm tra quyền theo ID đó chưa ngăn giả mạo nhân viên trong cùng phiên cửa hàng. Comment tại `supabase/migrations/011_void_paid_order.sql:12–15` cũng công bố giới hạn, nhưng kết luận trên dựa cả vào body auth/adapter/RPC, không chỉ tin comment.

RLS dưới đây chỉ yêu cầu đúng cửa hàng, chưa yêu cầu lệnh đã đăng ký:

[supabase/migrations/002_indexes_rls_triggers.sql:119–129](D:/Workspace/pos-cafe/supabase/migrations/002_indexes_rls_triggers.sql:119)

```sql
create policy orders_store_is_auth_user on public.orders
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy order_items_store_is_auth_user on public.order_items
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy order_item_options_store_is_auth_user on public.order_item_options
for all using (store_id = auth.uid()) with check (store_id = auth.uid());

create policy payments_store_is_auth_user on public.payments
for all using (store_id = auth.uid()) with check (store_id = auth.uid());
```

**Giới hạn kết luận:** chưa kiểm grants cloud thực tế, không khẳng định mọi DML đều đang thực thi được trên môi trường đó. Theo repository, không đủ cơ sở tuyên bố giao thức mới là đường ghi duy nhất nếu chưa xét grants/RLS/helpers.

**Bổ sung cần thiết:** tách bảo đảm chống gửi lại của client hợp lệ, ranh giới cửa hàng và bảo đảm chống giả mạo nhân viên. Quyền xem kết quả đã commit khác quyền execute mới. Không đổi nội dung lệnh chỉ để đổi người tiếp tục; lưu người khởi tạo và người xử lý riêng. Lỗi quyền của một người gọi cũng không được tự biến lệnh thành terminal, làm người có quyền không thể phục hồi sau đó.

<a id="e6--tim-lai-don-tach-can-ca-hai-uuid"></a>

## E6 — Tìm lại đơn tách cần cả hai UUID

Kết quả split trả cả đơn đã trả và đơn nguồn:

[supabase/migrations/012_action_permission_guardrails.sql:443–455](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:443)

```sql
  return jsonb_build_object(
    'orderId', p_new_order_id,
    'orderNo', v_split_order_no,
    'paymentId', p_payment_id,
    'status', 'paid',
    'total', v_amount,
    'receivedAmount', p_received_amount,
    'changeAmount', v_change_amount,
    'receipt', v_receipt,
    'sourceOrderId', p_order_id,
    'sourceOrderNo', v_source_new_no,
    'sourceTotal', v_source_total,
    'sourceLockVersion', v_source_lock_version
```

Tại `012_action_permission_guardrails.sql:238–280`, SQL chuyển số đơn cũ cho bill trả và cấp số mới cho đơn nguồn. Journal cần liên kết cả hai UUID, không dùng số đơn/bàn làm identity. Đơn mới mới đăng ký còn chưa có hàng `orders`, nên tra cứu không thể chỉ dựa trên một FK bắt buộc trỏ tới order đã tồn tại.

[supabase/migrations/012_action_permission_guardrails.sql:238–283](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:238)

```sql
  -- Đánh số: bill (đơn tách) kế thừa số của đơn gốc; đơn gốc nhận số mới.
  v_split_order_no := v_source.order_no;
  perform pg_advisory_xact_lock(hashtext(v_store_id::text || ':' || v_source.business_date::text));
  select coalesce(max(o.order_no), 0) + 1
  into v_source_new_no
  from public.orders o
  where o.store_id = v_store_id
    and o.business_date = v_source.business_date;

  -- Đổi số đơn gốc TRƯỚC để nhả số cũ cho đơn tách (unique store/business_date/order_no).
  update public.orders o
  set order_no = v_source_new_no
  where o.store_id = v_store_id
    and o.id = p_order_id;

  insert into public.orders (
    id,
    store_id,
    table_id,
    order_type,
    order_no,
    business_date,
    status,
    subtotal,
    discount_type,
    discount_value,
    total,
    employee_id,
    paid_at,
    lock_version
  ) values (
    p_new_order_id,
    v_store_id,
    v_source.table_id,
    v_source.order_type,
    v_split_order_no,
    v_source.business_date,
    'paid'::public.order_status,
    v_amount,
    'none'::public.discount_type,
    0,
    v_amount,
    p_employee_id,
    v_paid_at,
    0
  );
```

“Số” trên danh sách lịch sử hiện còn được dựng theo trang/vị trí, không phải UUID hoặc một số tham chiếu bất biến:

[src/features/pos/historyHelpers.ts:107–112](D:/Workspace/pos-cafe/src/features/pos/historyHelpers.ts:107)

```ts
export const historyDisplayNo = (
  total: number,
  page: number,
  pageSize: number,
  index: number,
): number => total - (page - 1) * pageSize - index;
```

`src/app/drawers/admin/OrderHistoryDrawer.tsx:103–107` truyền giá trị này vào `displayNo`. Nó có ích cho hiển thị nhưng không là khóa để máy B tìm duy nhất thao tác của máy A.

**Bổ sung cần thiết:** list/get operation theo store và cả source/result order; hỗ trợ đơn mới chưa execute. Khi mất K và có nhiều đơn mang đi giống nhau, để con người chọn/đối chiếu. Một lần query không thấy hàng chưa chứng minh request đăng ký cũ không còn đang đến muộn.

<a id="e7--void-va-phieu-in-khong-chung-minh-tien-mat-da-duoc-hoan"></a>

## E7 — Void và phiếu in không chứng minh tiền mặt đã được hoàn

`void_order` cập nhật trạng thái/audit/version, không xóa payment hoặc tự hoàn tiền mặt:

[supabase/migrations/011_void_paid_order.sql:164–179](D:/Workspace/pos-cafe/supabase/migrations/011_void_paid_order.sql:164)

```sql
  update public.orders o
  set status = 'void'::public.order_status,
      voided_at = now(),
      voided_by_employee_id = p_employee_id,
      void_reason_code = p_reason_code,
      void_reason_note = nullif(btrim(coalesce(p_reason_note, '')), ''),
      lock_version = o.lock_version + 1
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning o.lock_version, o.voided_at into v_lock_version, v_voided_at;

  return jsonb_build_object(
    'orderId', p_order_id,
    'status', 'void',
    'lockVersion', v_lock_version,
    'voidedAt', v_voided_at::text
```

Hủy lệnh chưa thực hiện phải là một trạng thái của giao thức, khác với void một order đã paid. Execute và cancel phải tranh cùng quyền quyết định trên server; execute thắng thì trả kết quả đã áp dụng. Không được xóa key để hủy, vì request đến muộn có thể làm cùng ý định sống lại.

Tương tự, callback thanh toán hiện dùng kết quả để mở preview và thông báo trạng thái bàn:

[src/app/drawers/pos/PaymentDrawer.tsx:185–201](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:185)

```tsx
        onSuccess: (result) => {
          // In bill từ payload trả về ngay trong mutation (không chờ refetch).
          if (printReceipt) {
            openReceiptPreview({ variant: "receipt", doc: result.receipt });
          }
          if (result.mode === "full") {
            toast.success("Đã thanh toán. Bàn đã trống.");
            closeDrawer();
            return;
          }
          // Tách đơn: các món được chọn thành đơn #N đã thanh toán; đơn gốc còn lại trên bàn.
          toast.success(
            `Đã tách và thanh toán đơn #${result.orderNo} (${formatVnd(result.total)}). Bàn còn ${formatVnd(result.sourceTotal)}.`,
          );
          // Xoá selection để effect đồng bộ đưa về mặc định "Chọn tất cả" phần còn lại.
          setSelection({});
          void orderQuery.refetch();
```

Nếu replay kết quả cũ rồi chạy nguyên callback, UI có thể nói bàn trống dù bàn đã có đơn mới, hoặc đưa `sourceTotal` lịch sử thành số tiền hiện còn. Phục hồi phải hiển thị kết quả lịch sử, refetch hiện trạng riêng và in lại theo thao tác rõ ràng. Không suy từ commit thành “khách đã đưa tiền” hoặc “bếp đã nhận phiếu”.

<a id="e8--null-va-polling-la-cac-dieu-kien-tien-quyet-da-duoc-07-nhac"></a>

## E8 — NULL và polling là các điều kiện tiên quyết đã được 07 nhắc

Bốn guard nguyên văn đối với đơn có sẵn:

[supabase/migrations/012_action_permission_guardrails.sql:145–151](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:145)

```sql
  if not found
    or v_source.status <> 'open'::public.order_status
    or v_source.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Order status or lock_version changed before payment.';
  end if;
```

[supabase/migrations/012_action_permission_guardrails.sql:637–642](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:637)

```sql
    if v_existing_order.status <> 'open'::public.order_status
      or v_existing_order.lock_version <> p_expected_lock_version then
      raise exception 'ORDER_VERSION_CONFLICT'
        using errcode = 'P0001',
              hint = 'Order status or lock_version changed before submit.';
    end if;
```

[supabase/migrations/012_action_permission_guardrails.sql:1068–1074](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:1068)

```sql
  if not found
    or v_order.status <> 'open'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Order status or lock_version changed before payment.';
  end if;
```

[supabase/migrations/011_void_paid_order.sql:157–162](D:/Workspace/pos-cafe/supabase/migrations/011_void_paid_order.sql:157)

```sql
  if v_order.status <> 'paid'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Only a paid order at the expected lock_version can be voided.';
  end if;
```

Khi status đúng nhưng `p_expected_lock_version = NULL`, biểu thức so sánh version cho `NULL`; `IF` không coi đó là true để báo lỗi. Đây là suy luận theo [ngữ nghĩa điều kiện PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-CONDITIONALS), chưa phải thí nghiệm SQL đã chạy trên DB của dự án. Tạo mới là nhánh khác: 012:714 yêu cầu expected version là NULL. Không sửa bằng cách cấm NULL cho mọi RPC bất kể tạo mới.

Mock dùng `!==` tại `src/adapters/mock/orderRepo.ts:41` và `src/adapters/mock/paymentRepo.ts:187`, nên nó từ chối NULL khác SQL. Test mock qua không đóng được lỗ hổng này.

Polling hiện làm thay đổi selection và flow chọn lại loại thanh toán:

[src/app/drawers/pos/PaymentDrawer.tsx:51–61](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:51)

```tsx
  useEffect(() => {
    if (!order || !orderStamp || orderStamp === lastStampRef.current) return;
    const sameOrder = lastStampRef.current?.startsWith(`${order.id}:`) ?? false;
    lastStampRef.current = orderStamp;
    setSelection((previous) => {
      // Đơn đổi phiên bản (máy khác sửa / vừa trả một phần): kẹp selection về dữ
      // liệu mới; nếu không còn gì hợp lệ thì quay về mặc định "Chọn tất cả".
      const next = sameOrder ? clampSelection(payableLines, previous) : fullSelection(payableLines);
      return Object.keys(next).length > 0 ? next : fullSelection(payableLines);
    });
  }, [order, orderStamp, payableLines]);
```

[src/features/pos/orderFlow.ts:355–362](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:355)

```ts
export const clampSelection = (lines: PayableLine[], selection: PaymentSelection): PaymentSelection => {
  const clamped: PaymentSelection = {};
  for (const line of lines) {
    const quantity = Math.min(selection[line.orderItemId] ?? 0, line.quantity);
    if (quantity > 0) clamped[line.orderItemId] = quantity;
  }
  return clamped;
};
```

[src/features/pos/orderFlow.ts:395–411](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:395)

```ts
  const lines = buildPayableLines(input.order);
  const selection = clampSelection(lines, input.selection);
  const amount = selectionAmount(lines, selection);

  if (amount <= 0 || Object.keys(selection).length === 0) {
    throw new AppError("INVALID_ORDER_ITEMS", "Chưa chọn món để thanh toán.");
  }

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

`orderFlow.ts:418–432` còn tạo mới split item/payment/new order UUID; adapter submit tạo order UUID tại `src/adapters/supabase/orderRepo.ts:89–100`. Vì vậy retry phải thực hiện lệnh đã prepare, không gọi lại flow chuẩn bị từ đơn mới nhất. Không cần tắt polling để đạt điều này: dữ liệu hiện tại dùng cho việc mới, command bất biến dùng cho phục hồi.

## Hướng giao thức vừa đủ để tiếp tục đặc tả

Đây là đề xuất kỹ thuật để duyệt cùng lựa chọn nghiệp vụ, chưa phải schema/contract cuối:

1. Prepare một giá trị bất biến: định danh, loại lệnh, phiên bản hợp đồng, nội dung nghiệp vụ và các UUID client phải cung cấp; không lẫn metadata của người tiếp tục vào payload người khởi tạo.
2. Register chỉ ghi bản đăng ký; cùng key/nội dung trả bản cũ, khác nội dung không được thay thế. Không giữ giá/bàn/quyền bằng transaction kéo dài chờ người dùng.
3. Execute đọc lệnh đã lưu, khóa lệnh, quyết định theo trạng thái và quyền; thay đổi nghiệp vụ và kết quả commit cùng nhau. Không cần commit trạng thái “đang chạy” rồi giao cho worker nếu toàn bộ RPC vẫn ngắn và đồng bộ.
4. Lệnh terminal trả kết quả lịch sử sau kiểm tra quyền truy cập thích hợp; không kiểm version hiện tại trước rồi từ chối replay đã thành công. Lần thực hiện nghiệp vụ đầu tiên vẫn phải kiểm version/quyền/điều kiện bán hiện hành theo chính sách đã chọn.
5. Cancel và execute được phân xử trên cùng lệnh. Nếu đã hủy/hết hiệu lực, late execute không chạy. Cần xét cả late register và tình huống client vừa query không thấy bản ghi; không dùng kết quả đọc âm tính để chứng minh yêu cầu khác không còn đang chạy.
6. Lưu kết quả từ chối nghiệp vụ cuối cùng nếu hợp đồng chọn như vậy. Không “ghi rejected rồi ném exception ra ngoài” và kỳ vọng hàng vẫn commit. Tách lỗi caller không có quyền, lỗi payload không khớp và lỗi hạ tầng khỏi từ chối của chính lệnh.
7. Có đường list/get trên server, UI phục hồi thủ công, trạng thái đối chiếu tách khỏi trạng thái áp dụng. Hết thời hạn execute không đồng nghĩa xóa kết quả/key đã dùng.

PostgreSQL rollback thay đổi khi exception không được xử lý; khối xử lý lỗi có thể giữ phần điều phối bên ngoài phần nghiệp vụ đã rollback. Thiết kế cần kiểm thử điều này thực sự, theo [tài liệu xử lý exception](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING). Row lock thuộc transaction, không được giữ để chờ người dùng xem kết quả; xem [tài liệu khóa PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).

Không cần thêm queue, Redis, worker, lease hoặc dịch vụ trả phí chỉ để đạt giao thức RPC đồng bộ này. Khả thi về cấu trúc không đồng nghĩa đã được kiểm thử tải hoặc ước lượng xong chi phí triển khai.

## Testcase ứng viên cần đưa vào bộ spec sau khi chốt

Đây là danh sách bằng chứng cần có, **chưa phải `testplan.md` đã hoàn tất**, chưa có implementation cho giao thức mới. Các mã R07-Txx dùng để trao đổi ở vòng review; khi viết spec phải gắn requirement/use case, input/output/mã lỗi cụ thể theo SPEC-STANDARD.

Dữ liệu mẫu chung: cửa hàng S1, nhân viên A/B, quản lý M, đơn O version 7 gồm 5 cà phê ×30.000đ. K1 là mã thanh toán một ly; các UUID cụ thể sẽ cố định trong fixture. “Số payment” trong bảng là số bản ghi mới phát sinh bởi ca thử, không phải tổng mọi payment của cửa hàng.

| Ca | Mức | Dữ liệu / bước gây tình huống | Kết quả cần quan sát |
| --- | --- | --- | --- |
| R07-T01 | DB tích hợp | Hai phiên register cùng K1, cùng nội dung đồng thời | Một bản đăng ký; cả hai nhận cùng định danh/nội dung; chưa có payment |
| R07-T02 | DB tích hợp | Sau register K1, lần lượt thay loại RPC, version 7→8, số lượng 1→2 hoặc một UUID rồi register cùng K1 | Từ chối nội dung khác; bản gốc không đổi; chưa có hiệu ứng nghiệp vụ |
| R07-T03 | DB tích hợp | Hai máy execute K1 cùng lúc | Một payment 30.000đ, một bill tách, đơn nguồn còn 120.000đ; hai kết quả trỏ cùng thao tác |
| R07-T04 | DB tích hợp | Hai mã K1/K2 cùng expected version 7, thanh toán khác nhau trên O | Tối đa một thay đổi thành công từ version 7; mã còn lại không ghi thêm khi version đã đổi |
| R07-T05 | Tích hợp/UI | K1 commit, cố ý bỏ response; polling về 4 ly/version mới; bấm phục hồi | Trả payment cũ 30.000đ, đơn nguồn vẫn 120.000đ; không tạo K mới hoặc tách thêm ly |
| R07-T06 | UI/tích hợp | O gồm 1 cà phê + 1 bánh; trả hết dòng cà phê rồi mất response; clamp rỗng | Dù UI mới chọn toàn bộ bánh, phục hồi vẫn là split cũ; không chuyển thành full payment cho bánh |
| R07-T07 | UI | Bấm khi offline, đóng drawer/chuyển màn hình, online lại; thử thêm focus/remount | Không có write tự phát sinh bởi nối mạng/lifecycle; chỉ hành động thủ công được chọn mới tiếp tục giao thức |
| R07-T08 | Tích hợp | Register đã commit nhưng response bị bỏ; retry register cùng K1 | Vẫn một bản đăng ký; không execute chỉ vì retry register |
| R07-T09 | Tích hợp/UI | Register K1, xóa dữ liệu trình duyệt; máy B truy cập danh sách theo quyền | Tìm thấy lệnh trên server và nội dung cũ; local không là bản duy nhất |
| R07-T10 | DB tích hợp | Chặn request register trước DB; query K1 không thấy; sau đó cho request cũ tới | UI không coi lần query âm tính là bằng chứng an toàn để thay lệnh; giao thức xử lý late register đúng trạng thái được chốt |
| R07-T11 | DB tích hợp | Ép cancel thắng trước execute; đảo thứ tự để execute thắng; chạy đồng thời | Cancel thắng: 0 payment và late execute bị chặn. Execute thắng: đúng 1 payment, cancel trả “đã áp dụng”, không hoàn tác |
| R07-T12 | DB tích hợp | Gây lỗi sau một thay đổi nghiệp vụ nhưng trước lưu kết quả | Không có nghiệp vụ dở dang; kết quả terminal hoặc trạng thái còn thử lại đúng bảng phân loại lỗi; không báo thành công giả |
| R07-T13 | DB tích hợp | Submit/pay/split/void đơn có sẵn với expected version NULL | Đều từ chối; không thay số tiền/món/audit/version. Tạo mới NULL vẫn được kiểm như ca riêng hợp lệ |
| R07-T14 | DB tích hợp | Dùng phiên S2 list/get/execute/cancel K1 của S1 | Không đọc hoặc sửa lệnh/đơn/payment S1; test qua API/DB trực tiếp |
| R07-T15 | DB/UI | A tạo; B/M tiếp tục; thu hồi quyền hoặc khóa A trước/sau commit | Kết quả theo ma trận quyền được chủ dự án chọn; quyền xem kết quả không đồng nhất với quyền execute mới; không rewrite người tạo |
| R07-T16 | DB tích hợp | Cài toàn bộ migrations, kiểm kê overload/grants; gọi chữ ký cũ/helper/keyless/DML liên quan | Chỉ đường được công bố mới có quyền ghi; mọi lỗ hổng ngoài bảo đảm phải được ghi rõ, không đánh test qua bằng UI guard |
| R07-T17 | DB/tích hợp/UI | Register submit giá 30.000đ; đổi thành 35.000đ hoặc ngừng bán rồi execute đầu | Kết quả phụ thuộc lựa chọn giá; bắt buộc không âm thầm vi phạm số tiền/điều kiện đã được hứa lúc xác nhận |
| R07-T18 | DB tích hợp | Register sát mốc hết hiệu lực/ngày kinh doanh; execute trước, đúng và sau mốc; replay một lệnh đã applied hôm trước | Ca chưa chạy theo mốc được chốt; applied cũ vẫn có kết quả, không phát sinh payment mới |
| R07-T19 | Tích hợp/UI | Hai đơn mang đi giống món/tiền; mất K local; mở danh sách trên B | Hiển thị hai ứng viên; không tự gộp, không tự chọn gần nhất rồi execute |
| R07-T20 | DB/UI | K1 split thành bill P và nguồn O có số mới; tìm theo O rồi theo P | Cả hai truy ra K1; không phụ thuộc số thứ tự đang hiển thị trên trang lịch sử |
| R07-T21 | Tích hợp/UI | Đơn đã có hai cà phê; K thêm một bánh thành công rồi mất local | Nếu nhận phục hồi phiếu bếp: phiếu K chỉ có một bánh. Nếu hoãn: không giả full ticket là phiếu K |
| R07-T22 | UI | Replay full payment cũ sau khi bàn đã có khách mới | Kết quả có nhãn lịch sử; không nói bàn hiện trống; không tự in. Nút in lại là hành động riêng |
| R07-T23 | Đơn vị/UI | Dựng lại receipt món 30.000đ, option 5.000đ ×2 | Đơn giá dòng 40.000đ; nội dung option thể hiện đủ số lượng; tổng không mâu thuẫn |
| R07-T24 | DB/UI | K1 applied chưa đối chiếu; B định tạo K2 trên version mới | Theo lựa chọn mục 1 của tài liệu 09: cảnh báo hoặc yêu cầu đối chiếu hẹp; không tuyên bố idempotency tự chặn mọi K2 |

Các ca cùng mã phải được tham số hóa cho cả bốn loại lệnh phù hợp. Các biên số lượng/số tiền/độ dài payload, từng mã lỗi, đổi phiên cửa hàng, schema version cũ và thao tác với UUID ngoài cửa hàng vẫn cần hoàn thiện khi contract được chốt; bảng này chưa thay cho coverage matrix có số hàng chưa phủ bằng 0.

## Đã kiểm và chưa kiểm

| Người kiểm | Kết quả đã chạy |
| --- | --- |
| Reviewer A | 8 file Vitest, 70 test qua; probe mutation trong bộ nhớ |
| Reviewer B | 7 file Vitest, 50 test qua; probe mutation trong bộ nhớ |
| Reviewer C | 7 file Vitest, 52 test qua; probe mutation trong bộ nhớ |
| Agent chính | Đọc lại trích đoạn dùng trong tổng hợp; chạy lại probe trên query-core 5.101.0; kiểm hash 07 và thay đổi tài liệu |

C chạy các file orderFlow.test.ts, voidOrder.test.ts, instantPay.test.tsx, demoHardening.test.tsx và ba file adapter repos.test.ts, errors.test.ts, migrations.test.ts. Đây là báo cáo từng lượt của reviewer, không phải một lần chạy tổng hợp của agent chính.

Các bộ test trên có phần trùng nhau, **không cộng thành một tổng testcase độc lập**. Chúng xác nhận một phần baseline đang có, không xác nhận giao thức đề xuất đã chạy. Probe mutation chứng minh hành vi thư viện cục bộ; tranh chấp transaction, migration thực thi, quyền cloud, độ trễ và tải còn chưa có bằng chứng chạy thật.

Mọi khuyến nghị nghiệp vụ trong [09](09-giai-thich-cac-lua-chon-con-mo.md) vẫn chờ chủ dự án chọn. Không sửa lén 07 hoặc ghi đề xuất thành “đã chốt”.
