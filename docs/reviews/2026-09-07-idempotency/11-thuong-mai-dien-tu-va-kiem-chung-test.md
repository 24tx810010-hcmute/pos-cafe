# 11 — Giá trong thương mại điện tử và kiểm chứng test độc lập

Ngày: **08/09/2026**. Phục vụ quyết định của `add-idempotent-write-operations` và phần lập luận/kiểm thử trong báo cáo. Đây là nghiên cứu bổ sung; không tự thay đổi quyết định giữ giá theo từng lần gọi và chưa chốt thay chủ dự án cách sửa size/topping.

**Cập nhật 09/09/2026:** phần nghiên cứu chỉnh modifier trên món cũ chỉ giữ làm lịch sử; chủ dự án làm rõ luồng sản phẩm chỉ chọn modifier khi thêm món. Không còn câu hỏi sửa modifier cũ chặn spec. Ví dụ chính thức A ×2 giá 30.000đ + A mới 40.000đ với modifier 0đ = 100.000đ, bằng chứng UI và testcase ở [12, mục 7](12-chuan-bi-ra-cuoi-truoc-code.md). Các kết quả test baseline bên dưới không thay đổi.

## 1. Giá linh động cần một thời điểm chốt rõ ràng

Giá linh động có thể thay đổi theo thời gian, cấu hình/biến thể hàng, số lượng hoặc chương trình giá. Cần tách giá đang được tính cho một giỏ còn sửa được với giá đã ghi nhận cho giao dịch. Không đồng nhất “đã lưu một giỏ trên server” với “server đã chấp nhận một đơn theo giá đó”.

Các nguồn chính thức đã đọc:

| Nguồn | Hành vi hoặc hướng dẫn được xác nhận | Điều không suy ra |
| --- | --- | --- |
| [Shopify Storefront — CartCost](https://shopify.dev/docs/api/storefront/latest/objects/CartCost) | Chi phí trên cart là ước tính, có thể thay đổi và được phản ánh tại checkout | Không có bảo đảm giữ giá chỉ vì đã thêm vào giỏ |
| [commercetools — Prices](https://docs.commercetools.com/merchant-center/prices) | Giá theo từng Product Variant; có phạm vi theo tiền tệ, quốc gia, nhóm khách, kênh, thời gian hiệu lực và bậc số lượng | Không khẳng định từng website dùng commercetools đều bật mọi cơ chế này |
| [commercetools — Payment](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/payment) | Hướng dẫn tính lại cart trước tạo order để phát hiện giá/khuyến mãi đổi; đưa ra phương án xem lại/xác nhận hoặc đóng băng cart khi thanh toán | Đây là các cách triển khai để lựa chọn, không phải một chính sách duy nhất được áp cho mọi cửa hàng |
| [commercetools — Order creation](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation) | Khi tạo order, chụp lại giá/giảm giá/thuế/vận chuyển/thanh toán; cart chuyển Ordered. Khi tổng đổi cần hiển thị tổng mới và yêu cầu xác nhận | Không lấy việc đã snapshot làm bằng chứng mọi chỉnh sửa có chủ đích về sau đều bị cấm |
| [commercetools — Freeze prices](https://docs.commercetools.com/tutorials/reserve-stock-on-demand) | Có cơ chế freeze giá trong checkout; HardFreeze giữ cả chi phí vận chuyển và giảm giá. Giữ hàng là cơ chế riêng với thời hạn riêng | Không được lấy hạn giữ hàng hoặc phiên checkout làm hạn xóa đơn, hạn replay hoặc “giữ giá 24 giờ” cho POS |

Không có nguồn về nội bộ Shopee/Lazada/Amazon trong lần khảo sát này; không gán các quy tắc trên cho họ. Hai nền tảng được dùng làm tiền lệ kỹ thuật có tài liệu công khai, không phải bằng chứng mọi trang thương mại điện tử giống nhau.

## 2. Ví dụ và hai cách xử lý trước khi chốt đơn

Ví dụ minh họa, không phải số liệu quan sát trên một cửa hàng thực: lúc 10:00 khách thêm áo size M giá 300.000đ vào giỏ; 11:00 giá hiện tại là 350.000đ.

| Giai đoạn | Cách hiểu |
| --- | --- |
| Chỉ có giỏ, chưa chốt giao dịch | Giá trong giỏ không mặc nhiên là giá đã được giữ; checkout có thể tính lại 350.000đ |
| Giá đổi trước khi server chấp nhận đơn | Hiển thị tổng mới để xác nhận, hoặc thực hiện đúng chính sách giữ giá nếu nền tảng/cửa hàng có chính sách đó |
| Server đã chấp nhận đơn ở 300.000đ | Lưu snapshot 300.000đ cho giao dịch đó; cập nhật catalog về sau không phải lý do âm thầm tính lại lịch sử đơn |
| Người dùng đổi sang size L hoặc mua thêm sau đó | Là một thay đổi có chủ đích cần chính sách sửa đơn/giá riêng; không suy từ snapshot của M ra mọi biến thể khác đều được giữ giá |

Hai lựa chọn kỹ thuật trước khi ghi nhận giao dịch:

- **Tính lại và cho xác nhận khi có chênh lệch:** tránh giữ giá cũ quá lâu, ít trạng thái bảo lưu; đổi lại người dùng có thể phải xác nhận lại khi giá/khuyến mãi vừa đổi.
- **Giữ giá cho một phiên xác nhận:** trải nghiệm ổn định hơn; đổi lại phải thiết kế bắt đầu/kết thúc giữ giá, sửa nội dung, bỏ dở và điều kiện hết hiệu lực. Nếu giữ hàng thì còn phải quản lý tồn kho riêng.

Đây là nhận xét thiết kế dựa trên các nguồn trên. Không đề xuất thêm cổng thanh toán, tồn kho hoặc bộ định giá thương mại điện tử vào đồ án POS tiền mặt.

## 3. Áp dụng cho pos-cafe

Theo quyết định đã có trong [10](10-quyet-dinh-sau-review-va-chinh-sach-gia.md): mốc chốt giá của một phần món là **lần server ghi phần món đó thành công**, có thể xảy ra trước lúc thanh toán. Vì vậy không thể coi toàn bộ đơn bàn chưa paid là một giỏ thương mại điện tử rồi tính lại tất cả giá tại lúc thu tiền.

| Tình huống pos-cafe | Yêu cầu / trạng thái |
| --- | --- |
| Phần món chưa được server ghi nghiệp vụ; mới ở draft hoặc register | Chưa có cam kết giữ giá. Server phải xác minh giá phần mới trước khi áp dụng; nếu khác giá đã trình bày thì cho xem lại/xác nhận |
| Phần cũ đã ghi server 30.000đ | Giữ giá/name/option snapshot; ngày thanh toán, đổi máy hoặc đổi menu không tự tính lại phần này |
| Gọi thêm sau khi giá lên 35.000đ | Phần mới 35.000đ, phần cũ 30.000đ; tổng 65.000đ như đã chốt |
| Đổi size/topping phần cũ | **Đã đóng 09/09:** không thuộc phạm vi sản phẩm hiện tại. Chọn modifier khi thêm món; không cần chọn chính sách giá cho thao tác sửa phần cũ |
| Lệnh pending có hạn 24 giờ | Chỉ là hạn áp dụng lệnh lần đầu; không đồng nghĩa giữ giá 24 giờ hoặc đơn chỉ tồn tại 24 giờ |

Một chi tiết cần đưa vào thiết kế: **version của đơn và phiên bản/giá của menu là hai nguồn thay đổi khác nhau**. Tài liệu Payment của commercetools nêu rõ thay đổi giá/discount ngoài cart chưa làm version cart tăng cho tới lúc tính lại. Bài học áp dụng: kiểm OCC của đơn không thay thế kiểm giá hiện hành của phần gọi mới. Đây là yêu cầu thiết kế, không phải khẳng định đã có kiểm tra tương ứng trong pos-cafe.

Bổ sung biến thể cho PRE-IDEM-24/25/26, chưa tính là test đã hiện thực:

1. Giá món đổi giữa register và execute nhưng version đơn giữ nguyên: không âm thầm áp dụng tổng mới.
2. Chỉ phụ thu option mới đổi, base không đổi: vẫn phát hiện chênh tổng cần xác nhận.
3. Giá giảm, ví dụ 35.000đ xuống 30.000đ trước execute: quy tắc “khác giá đã xác nhận” áp dụng cả hai chiều theo đề xuất hiện tại; không chỉ kiểm tăng giá.
4. Phần đã ghi server giữ snapshot cả khi giá menu tăng hoặc giảm; thanh toán dùng tổng server của phần đã chốt.
5. Sau khi người dùng chấp nhận giá mới, đó là nội dung/lệnh mới; không thay payload đã đăng ký dưới khóa cũ.

## 4. Quy trình tự chạy và kiểm chứng bằng subagent

Trong phiên này có công cụ chạy lệnh và tạo subagent. [Tài liệu OpenAI về subagent](https://learn.chatgpt.com/docs/agent-configuration/subagents) cũng mô tả việc giao test/đọc log thành các công việc độc lập. Khả năng thực tế còn tùy môi trường test, dependency và quyền truy cập; không suy từ khả năng gọi subagent ra việc DB/cloud đã được kiểm chứng.

Quy trình đề xuất khi triển khai đã được chủ dự án duyệt:

1. Chốt requirement, dữ liệu và expected result trước. Agent thực hiện viết code và test theo bộ này, lưu log chạy.
2. Agent kiểm chứng nhận commit, spec và phạm vi kiểm; không nhận kết luận “đã đúng” hoặc cách lý giải của người viết làm giả định. Dùng ngữ cảnh mới khi cần review độc lập.
3. Agent kiểm chứng tự đọc mã/assertion, tự chạy lại nhóm liên quan trên đúng commit và kiểm xem test có thất bại khi bất biến bị phá hay không. Với code đụng tiền, dùng vài lỗi giả lập có mục tiêu trong checkout cô lập nếu cần; không thêm mutation testing toàn dự án chỉ để có thêm công cụ.
4. Agent chuyên DB dùng hai connection cho race, gọi trực tiếp RPC/DML bằng credential ứng dụng và đối chiếu dữ liệu; agent chuyên UI dùng browser context riêng cho nhiều máy/mất local/ACK. Chia theo việc khi có ích, không bắt buộc ba agent cho mọi sửa nhỏ.
5. Findings được sửa rồi chỉ chạy lại ca bị ảnh hưởng cùng regression cần thiết. Nếu code đổi trong lúc review, kết quả commit cũ chưa là nghiệm thu commit mới.
6. Lưu commit, lệnh, môi trường, pass/fail/skip, log/trace và ca chưa chạy. Chỉ báo đúng phạm vi bằng chứng; không gọi “test xanh” là “không thể còn bug”.

**Độc lập ở đây là độc lập về ngữ cảnh và cách kiểm tra.** Các agent có thể dùng cùng họ mô hình và cùng bỏ sót một giả định. Kết luận nghiệm thu phải dựa vào expected result được chốt, dữ liệu DB, assertion và log tái chạy được; không dựa vào số agent đồng ý.

Các ca DB/cloud cần môi trường test và credential phù hợp. Thiếu điều kiện phải ghi rõ chưa chạy, không thay bằng mock rồi báo tương đương. Dự án hiện có 32 ca PRE-IDEM chuẩn bị trong proposal; chúng chưa được triển khai, nên test baseline hiện có không xác nhận giao thức tương lai đã hoạt động.

## 5. Lần kiểm chứng độc lập trong phiên này

**Đã thực hiện.** Subagent `/root/independent_test_verify` dùng ngữ cảnh mới, tự chọn nhóm test hiện có và tự chạy. Agent chính sau đó đọc cả raw log, JSON và các assertion tiêu biểu. Không chạy DB/cloud, không sửa ứng dụng/test, không commit/push trong lượt này.

- Code: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`.
- Cwd: `D:/Workspace/pos-cafe`.
- Môi trường: `VITE_DATA_MODE=mock`, Node có sẵn tại `D:/tools/nodejs/node.exe`, Vitest **4.1.10** theo log của lượt chạy.
- Kết quả: **5 file pass, 63 test pass, 0 fail, 0 skip**, exit code 0; Vitest báo **5,95 giây**. JSON có 15 test suites do các nhóm `describe`; không được báo thành 15 file.
- Trước và sau: main chỉ có `?? pnpm-lock.yaml`, không có thay đổi tracked.

Lệnh do subagent dùng (biến môi trường chỉ đặt trong phiên shell chạy test):

```powershell
$env:VITE_DATA_MODE = 'mock'
& 'D:/tools/nodejs/node.exe' './node_modules/vitest/vitest.mjs' run src/features/pos/orderFlow.test.ts src/features/pos/modifier.test.ts src/adapters/mock/mockRepos.test.ts src/adapters/supabase/repos.test.ts src/app/instantPay.test.tsx --reporter=default --reporter=json "--outputFile.json=$env:TEMP/pos-cafe-independent-baseline-20260908-7183b31.json"
```

Bản sao bằng chứng trong tập tài liệu: [raw log](evidence/2026-09-08-independent-baseline.log), [JSON](evidence/2026-09-08-independent-baseline.json). Người đọc không cần đường dẫn Temp của máy chạy. Không ghi kết quả này thành kết quả của PRE-IDEM.

| File đã chạy | Số test pass | Giới hạn cần nhớ |
| --- | ---: | --- |
| `src/features/pos/orderFlow.test.ts` | 19 | Các ca flow hiện có, không phải giao thức register/execute mới |
| `src/features/pos/modifier.test.ts` | 7 | Có phép tính giá tĩnh; không chứng minh giá qua hai lần gọi khi menu đổi |
| `src/adapters/mock/mockRepos.test.ts` | 20 | Chạy trên state mock; không chứng minh khóa/rollback trong PostgreSQL |
| `src/adapters/supabase/repos.test.ts` | 14 | Mock client RPC; tên thư mục Supabase không biến lượt chạy thành test DB thật |
| `src/app/instantPay.test.tsx` | 3 | Hành vi UI hiện có; không phải ca mất ACK sau commit và đổi máy |

### Bằng chứng đọc assertion, không chỉ đếm test xanh

`src/adapters/supabase/repos.test.ts:43–45` — RPC là hàm giả trả dữ liệu dựng sẵn:

```ts
const createRpcClient = (dataByRpc: Record<string, unknown> = {}) => ({
  rpc: vi.fn(async (name: string) => ({ data: dataByRpc[name] ?? null, error: null })),
});
```

`src/features/pos/modifier.test.ts:59–72` — một phép tính trên catalog cố định:

```ts
  it("multiplies option price delta by its quantity in snapshot total", () => {
    const items = snapshotDraftItems(mockMenuCatalog, [
      {
        id: "draft-1",
        menuItemId: "mi-tra-sua-truyen-thong", // 39000
        quantity: 1,
        note: null,
        options: [{ id: "o1", optionValueId: "ov-tran-chau", quantity: 2 }], // +7000 each
      },
    ]);
    // 39000 + 7000*2 = 53000
    expect(calculateSnapshotTotal(items)).toBe(53000);
    expect(items[0].options[0].quantity).toBe(2);
  });
```

`src/app/instantPay.test.tsx:112–114` — một click, một lần gọi:

```tsx
    await user.click(screen.getByTestId("pay-button-footer"));
    await waitFor(() => expect(payItemsSpy).toHaveBeenCalledTimes(1));
    expect(paySpy).not.toHaveBeenCalled();
```

Subagent còn chỉ ra ba khoảng trống contract đã hiện trong proposal: PRE-IDEM-07 chưa chốt chuẩn hóa mảng/null; PRE-IDEM-26 chưa có mã lỗi/cơ chế xác nhận chênh giá; PRE-IDEM-31 chưa chốt contract split toàn bộ. Đây là việc thiết kế còn phải làm, không phải ba lỗi mới đã tái hiện trên DB. Số dòng proposal có thể dịch khi bổ sung nghiên cứu; truy bằng ID ca.

**Cập nhật sau lượt này:** [12](12-chuan-bi-ra-cuoi-truoc-code.md) và proposal đã ghi lựa chọn kỹ thuật cho PRE-IDEM-07, giữ hành vi mã hiện hành cho PRE-IDEM-31. PRE-IDEM-26 và bộ contract đầy đủ còn phải hoàn tất. Kết quả 63 test baseline phía trên không thay đổi vì cập nhật tài liệu này.

Kết luận có thể dùng trong báo cáo: **đã chứng minh khả năng tự chạy và đối chiếu độc lập một nhóm test baseline**. Chưa chứng minh tính năng idempotency/giữ giá mới; chưa có kết quả DB/cloud của lần này. 32 PRE-IDEM vẫn là các ca chuẩn bị, không có ca nào được chuyển thành “đã pass” nhờ 63 test cũ.
