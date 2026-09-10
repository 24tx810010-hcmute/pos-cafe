# 13 — Rà độc lập kịch bản tự động kiểm thử

Ngày **09/09/2026**. Change: `add-idempotent-write-operations`.

**Kết quả: đã hoàn tất ba review độc lập; cả ba kết luận chưa đủ để giao viết automation mà không phải tự thiết kế thêm.** Các số tiền đã chốt đúng; có thiếu sót cụ thể khiến test có thể xanh dù chưa chứng minh đúng hành vi. Đây là review thiết kế test và khả năng kiểm chứng, không phải kết quả chạy tính năng mới hoặc duyệt triển khai.

## 1. Đầu vào và cách review

- Code: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`.
- Tài liệu: working tree `docs`, không gán nội dung chưa commit cho HEAD `251780f`.
- Ba agent được mở bằng ngữ cảnh mới, đọc cùng proposal và quyết định mới nhất ở [12, mục 7](12-chuan-bi-ra-cuoi-truoc-code.md). Mỗi agent tự đọc code và tự viết báo cáo; không đọc báo cáo hoặc trao đổi nhận xét với hai agent còn lại.
- Góc rà: nghiệp vụ/giá; DB/quyền/đồng thời; công cụ chạy test và cách xác định kết quả đúng. Agent chính đối chiếu lại kết luận và bằng chứng trước khi tổng hợp.
- Không sửa app/test, không chạy DB/cloud, không chạy lại baseline không đổi. Chỉ đọc log/JSON baseline đã có. Review độc lập về ngữ cảnh và cách kiểm, không phải ba mô hình độc lập về thống kê.

Hash SHA-256 của đầu vào trong lượt review; giữ các file này nguyên trong khi agent đọc:

| Tài liệu | SHA-256 |
| --- | --- |
| `proposal.md` | `1C6AD6EE2651540540DBBF74AE01E2F52DF49CA075BCB699851C2084EF3D75C5` |
| `10-quyet-dinh-sau-review-va-chinh-sach-gia.md` | `CF1845E0CF7EA00E58A755BB4D481906889AC3ADBA689D68E11216F9CE13E91B` |
| `11-thuong-mai-dien-tu-va-kiem-chung-test.md` | `96BEAA5BDF7EC2EF28FB7AFE817D30927CCB2CA841A09061E210BD817FD1D18D` |
| `12-chuan-bi-ra-cuoi-truoc-code.md` | `1E899453B55553457D45A751B7E1EB07571132EFF7C67D333A57779D860BF6F9` |

## 2. Những gì đã có và chưa có

| Hạng mục | Bằng chứng | Kết luận đúng mức |
| --- | --- | --- |
| Kịch bản dự kiến | Proposal có đủ 32 ID PRE-IDEM-01…32, không trùng/thiếu ID; từng hàng có dữ liệu, bước và kết quả, kèm nhiều biến thể | Đã có thiết kế kịch bản, không phải 32 bài test chạy được |
| Expected số tiền | Tính độc lập từ fixture và quy tắc đã chốt, xem mục 3 | Kiểm được tính đúng của các con số; chưa chứng minh code trả đúng số đó |
| Test baseline cũ | [Raw log](evidence/2026-09-08-independent-baseline.log), [JSON](evidence/2026-09-08-independent-baseline.json): 5 file, 63 test pass, 0 fail, 0 pending/skip | Kết quả lượt chạy 08/09, không phải chạy mới ngày 09/09 và không phải PRE-IDEM; 63 entry `assertionResults` không phải số câu lệnh `expect` |
| File automation mới | Cả sáu đường dẫn test dự kiến trong proposal chưa tồn tại trên main | Chưa có automation cho giao thức mới |
| Bộ tài liệu chuẩn | Change mới có proposal và metadata `.openspec.yaml`; chưa có spec/usecases/design/testplan/traceability/tasks | Chưa đủ để giao triển khai không cần đoán contract |
| Test DB/đồng thời/mất ACK mới | Không có kết quả chạy trong lượt này | Không tuyên bố đã kiểm chứng transaction hoặc an toàn nhiều máy |

## 3. Expected phải được tính từ yêu cầu, không lấy từ code đang kiểm

Agent chính tính lại các phép tính sau bằng hằng số trong fixture, không gọi hàm tính tổng của ứng dụng. Đây là kiểm toán dữ liệu test, không đếm thành test ứng dụng đã pass.

| Ca | Phép tính độc lập | Expected |
| --- | --- | ---: |
| A cũ ×2, gọi thêm A mới với modifier 0đ | `2×30.000 + (40.000 + 0)` | 100.000đ |
| A cũ ×2, gọi thêm A mới với modifier 7.000đ | `2×30.000 + (40.000 + 7.000)` | 107.000đ |
| Tách thanh toán một A cũ khỏi đơn 100.000đ | Thanh toán `30.000`; nguồn còn `100.000−30.000` | 30.000đ / 70.000đ |
| Tách thanh toán A mới khỏi đơn 100.000đ | Thanh toán `40.000`; nguồn còn `100.000−40.000` | 40.000đ / 60.000đ |
| Hai ly, mỗi ly base 30.000đ và hai topping 5.000đ | `2×(30.000 + 2×5.000)` | 80.000đ |
| Giảm còn một ly trong fixture trên | `1×(30.000 + 2×5.000)` | 40.000đ |

Không đưa các ca thêm modifier lên món đã ghi vào phạm vi; các ví dụ 67.000đ/72.000đ trong lịch sử đã bị rút. Không coi giá đúng là đủ: phải kiểm cả số lượng, nguồn gốc giá, ID, modifier 0đ, bản ghi thanh toán và phần đơn còn lại.

## 4. Nhận xét độc lập và đối chiếu

Ba báo cáo gốc được giữ nguyên, không gộp số finding thành số lỗi độc lập vì có phần trùng nhau:

| Reviewer | Báo cáo | Nhận xét chính |
| --- | --- | --- |
| Nghiệp vụ/giá | [Báo cáo nghiệp vụ](evidence/2026-09-09-review-business.md), BUS-01…05 | Số tiền đã chốt đúng. Cần expected đầy đủ cho xác nhận lại giá, nguồn gốc ghi chú, từng dòng hóa đơn, option quantity/tên và chọn đúng lệnh khi khôi phục |
| DB/quyền/đồng thời | [Báo cáo database](evidence/2026-09-09-review-database.md), DB-01…09 | Cần oracle quyền và chống giả nguồn snapshot, điểm kiểm TTL sau khóa nghiệp vụ, race phải tiến triển, rollback cả hai chiều và terminal-state rõ |
| Công cụ chạy test/oracle | [Báo cáo khả năng kiểm chứng](evidence/2026-09-09-review-oracles.md), ORA-01…08 | Có đường test không được runner tìm, nguy cơ chạy mock dưới tên Supabase và fixture/expected cho phép xanh sai |

Agent chính đọc cả ba báo cáo, đối chiếu các điểm chính với config, hook/UI, RPC, fixture và log. Các nhóm cần xử lý sau review:

| Nhóm | Nhận xét được tiếp nhận | Dữ liệu/expected cần bổ sung |
| --- | --- | --- |
| Fixture phải đi tới đúng nhánh | ORA-03/04; DB-02/08; rà từng ca của business | Void-NULL phải dùng đơn **paid**, caller đủ quyền, reason/UUID hợp lệ, version đúng ở positive control. Đảo mảng phải có ít nhất hai phần tử khác nhau, cả hai payload hợp lệ |
| Chứng minh lần đầu đúng và có tiến triển | ORA-05/08; DB-04/05; BUS-03 | Race hợp lệ không inject fault phải có **đúng một applied và hiệu ứng**, không chỉ tối đa một. Xác minh R1 bằng fixture/DB độc lập trước khi so replay |
| Test phải thực sự được chạy trên đúng backend | ORA-01/02/07 | Chốt runner cho `tests/contracts`; đối chiếu manifest TC với kết quả thực chạy. DB suite phải fail khi mode/DB/migration sai hoặc ca bắt buộc bị skip. Mất local/đổi máy cần server chung, không seed lại mock để giả phục hồi |
| Không tự gửi khác với không ghi thành công | ORA-06; BUS bảng ca 09/12/32 | Sau response muộn/reconnect/focus: 0 execute/register mới tự phát, 0 tự mở preview/gọi in, đồng thời kiểm DB. Read/list được phép; register retry chủ động cùng K có thể thêm HTTP attempt nhưng không thêm hàng đăng ký |
| Giữ đúng dòng và đúng snapshot | BUS-02/04; DB-06 | Đổi chỗ ghi chú giữa dòng 30k/35k vẫn phải được nhận ra là thay đổi dù tổng/đa tập ghi chú giống nhau. Caller không được giả retained ID, tăng lượng ở giá cũ, sửa modifier phần cũ hoặc dùng ID đã move sang đơn khác |
| Hóa đơn và khôi phục phải kiểm từng phần | BUS-03/05; DB-07; ORA-08 | Base30k + topping2×5k phải biểu diễn đủ 40k trên dòng/phụ thu và tổng, cả receipt lần đầu, replay và in lại. Danh sách có K1 applied/K2 pending phải chọn đúng lệnh, tách R1 lịch sử với đơn hiện tại |
| Chênh giá và lỗi cần contract cuối | BUS-01; DB-05/08 | O cũ60k + món mới trình bày40k: menu đổi45k trước execute thì chưa ghi, O vẫn60k/version5; xem tổng105k, xác nhận mới K2 rồi O=105k/version6/0 payment. Phải khai báo mã lỗi, trạng thái K1 và thông báo cụ thể |
| Quyền, khóa và rollback phải có checkpoint | DB-01…05 | Quyền read/list/cancel theo loại lệnh; chống tự cấp quyền qua nguồn employees; xác định checkpoint TTL/quyền sau các khóa có thể chờ. Fault sau đổi số/tombstone/items/payment/result phải kiểm toàn bộ rollback và trạng thái K |
| Requirement nhỏ cũng cần ca | DB-09; các báo cáo về traceability | Quyết định đếm replay còn hiệu lực nhưng chưa có TC: chốt đếm loại request nào, tăng đồng thời ra sao, tách counter khỏi R1 bất biến. Mỗi biến thể/schema/error cần ID và kết quả thực thi riêng |

Các nhận xét trên không phải một yêu cầu làm thêm hệ thống quản trị hoặc offline. Riêng bảo vệ bảng nguồn quyền và trạng thái bàn: analyst phải xác định đường truy cập thực sự đe dọa các bảo đảm trong change, phối hợp phần tối thiểu của change quyền. Policy SQL không tự chứng minh grants hiện có trên cloud; báo cáo DB đã nêu giới hạn này. Không mở lại chức năng sửa modifier món cũ, không đổi chính sách ngày báo cáo hoặc bắt đối chiếu tiền mặt.

### 4.1. Bằng chứng ngắn cho những ca có thể xanh sai

**Void dùng sai fixture:** `supabase/migrations/011_void_paid_order.sql:157–162`:

```sql
  if v_order.status <> 'paid'::public.order_status
    or v_order.lock_version <> p_expected_lock_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using errcode = 'P0001',
            hint = 'Only a paid order at the expected lock_version can be voided.';
  end if;
```

Nếu fixture là open, vế trạng thái đã đúng nên lỗi vẫn xảy ra dù expected version là NULL. Vì vậy expected “bị từ chối” một mình không phát hiện thiếu guard NULL. Fixture sửa: V1 paid/version5/payment150k, caller đúng quyền; ca version5 thành công → void/version6, version4 lỗi, NULL lỗi theo code contract. Mỗi ca dùng fixture mới. Những code lỗi mới chưa được đặt tên trong design vẫn là phần phải hoàn thiện.

**Test ngoài phạm vi runner:** `vitest.config.ts:6–10`:

```ts
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
```

File dự kiến `tests/contracts/writeOperations.contract.test.ts` không khớp include này. Hai Playwright testDir hiện tại là `tests/smoke` và `tests/supabase`; không có runner riêng trong package.json. Đây là thiếu thiết kế discovery, không phải lỗi test đã chạy.

**Tên suite không chứng minh backend:** `src/app/runtimePorts.ts:15–21`:

```ts
export const resolveAppDataMode = (env: RuntimePortEnv): AppDataMode => {
  if (env.mode === "mock" || env.mode === "supabase") {
    return env.mode;
  }

  return hasSupabaseEnv(env) ? "supabase" : "mock";
};
```

`playwright.supabase.config.ts:25–40` không ép mode hay preflight URL/key; test realtime hai context tại `tests/supabase/pos-cafe-supabase.spec.ts:254` còn opt-in skip. Không khẳng định mọi test của suite sẽ pass khi thiếu env; kết luận là tên lệnh/exit code không đủ chứng minh đã kiểm DB. Cần preflight backend và observer đọc marker fixture thật.

**Chỉ so tổng có thể bỏ lọt dòng hóa đơn sai:** `src/app/components/ReceiptPreview.tsx:12–24`:

```ts
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

Với base30k, topping2×5k, builder này cho dòng35k dù tổng đơn có thể đúng40k; đường receipt RPC lại dùng base30k làm unitPrice. Renderer ở cùng file dòng203–205 nhân line.unitPrice với số ly. Đây là suy luận đã đối chiếu mã, chưa phải kết quả tái hiện. Expected phải kiểm cả dòng tiền, phụ thu/số phần topping và tổng trên từng đường dựng hóa đơn, không chỉ `total=40000`.

### 4.2. Bổ sung dữ liệu đủ cụ thể để chuyển thành TC

| Biến thể | Expected độc lập |
| --- | --- |
| Đảo mảng thật sự | Đơn có L1=2×30k, L2=2×20k; chọn mỗi dòng1, nhận50k. Register `[L1,L2]`, cùng K gửi `[L2,L1]`: mismatch theo schema hợp lệ, payload/hạn đầu nguyên, 0 payment. Chỉ đảo key object thì cùng đăng ký |
| Swap note giữa hai giá | L30 giá30k note “ít đá”, L35 giá35k note trống, cùng món/options. Đổi note cho nhau: phải gửi thay đổi; đúng note trên đúng nguồn, tổng65k, 0 payment; retry không tăng version lần nữa |
| Đổi tên/giá rồi gọi thêm bằng cộng | Cũ2×(base30k+topping2×5k)=80k; menu mới base35k/topping7k và tên mới. Cộng1 ly mới → 49k; tổng129k; tên/giá cũ chỉ ở phần cũ. Split ly mới49k/còn80k; split ly cũ40k/còn89k |
| Receipt có topping quantity2 | Hai ly mỗi ly40k, tổng80k. Split1 nhận50k → paid40k, thừa10k, nguồn40k, topping ×2. Lần đầu/replay/in lại đều thể hiện đủ40k; menu đổi sau đó không làm đổi receipt |
| Nhiều thao tác tương tự | O1 ban đầu150k/version5. K1 applied split30k → nguồn120k/version6; K2 pending cùng số tiền, ID khác. Phục hồi K1 không chạy K2. Chủ động K2 thành công → tổng2 payment60k, nguồn90k/version7. Replay K1 vẫn lịch sử120k/version6, UI hiện tại tải90k/version7 riêng |

Những dữ liệu bổ sung này được tiếp nhận làm đầu vào sửa testplan. **Chưa thay đổi 32 PRE-IDEM của bản được ba agent review, chưa coi các bổ sung trong báo cáo tổng hợp là bộ testplan đã được review lại và duyệt.** Còn phải đóng schema/error/checkpoint, chuyển từng biến thể thành TC và truy vết requirement/UC trước automation.

## 5. Nguyên tắc hoàn thiện testplan sau review

Các điều kiện dưới đây là đầu vào cần hiện thực trong spec/testplan và bộ chạy test; chưa tuyên bố đã có trong automation:

1. **Expected nghiệp vụ độc lập:** fixture ghi rõ giá/số lượng/ID/trạng thái trước và sau. Không gọi hàm tính tiền hoặc snapshot của app để tính expected của chính hàm đó.
2. **Lần đầu phải đúng rồi mới so replay:** xác minh kết quả đầu với expected độc lập và trạng thái DB. Chỉ so lần hai bằng lần đầu có thể cho cả hai lần cùng sai mà vẫn xanh.
3. **Kiểm đúng lý do từ chối:** mỗi ca lỗi phải có dữ liệu hợp lệ ở mọi phần khác, mã lỗi cụ thể và kiểm không có tác dụng nghiệp vụ. Thử một yêu cầu hợp lệ tương ứng để tránh test pass chỉ vì mọi request đều bị chặn.
4. **Gây lỗi đúng vị trí:** test mất ACK phải chứng minh đã commit rồi mới bỏ response; test rollback phải chứng minh đã tới điểm gây lỗi; test race phải điều khiển được thứ tự khóa. Lỗi đầu vào trước transaction không chứng minh được rollback sau ghi.
5. **Bằng chứng từ nhiều tầng:** so output API, trạng thái DB đọc bằng connection quan sát và UI. Số tiền đúng trên màn hình không thay thế kiểm số payment, order, version, actor và giá snapshot.
6. **Không bỏ sót mà vẫn báo xanh:** mỗi biến thể có ID riêng, đường dẫn test được runner phát hiện và ghi số thực chạy. Môi trường DB chưa sẵn sàng hoặc ca bắt buộc bị skip thì mốc nghiệm thu chưa đạt; không lấy exit code 0 làm bằng chứng đủ.
7. **Kiểm sức bắt lỗi của assertion:** khi hiện thực, dùng một số đối chứng lỗi có chủ đích trong môi trường test, như định giá lại dòng cũ hoặc thực hiện replay lần hai; ca tương ứng phải đỏ. Đối chứng không được để lại trong code sản phẩm, và không cần áp mutation testing toàn repo cho đồ án.

Review này không thay thế việc chạy test sau code. Các thiếu sót kỹ thuật được phát hiện phải chuyển thành contract/fixture/assertion/cổng chạy cụ thể trước khi coi bộ kiểm thử là sẵn sàng.
