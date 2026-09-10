# Bảo đảm không sinh trùng cho các lời gọi ghi

## Chốt phạm vi modifier ngày 09/09/2026

Chủ dự án làm rõ luồng hiện tại: chọn modifier khi **thêm món**, không thêm/đổi modifier trực tiếp trên món đã tạo. Đối chiếu mọi nơi dùng picker và đọc `useOrderModifierPicker.ts`, `OrderDrawer.tsx`, `OrderCartPane.tsx` xác nhận đúng luồng giao diện này; bằng chứng nguyên văn tại [12, mục 7](../../../docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md).

- Giữ phạm vi hiện hành, không bổ sung màn/luồng sửa modifier món đã ghi vào change này. Modifier của phần cũ được giữ cùng snapshot phần đó; modifier được chọn cho phần món thêm mới.
- Ví dụ chính thức: server đã ghi **A ×2, base 30.000đ**; menu cập nhật A thành **40.000đ**; vào lại bàn, thêm **A ×1 với modifier 0đ**. Kết quả sau ghi phải là **30.000 ×2 + (40.000 + 0) = 100.000đ**. Giữ riêng phần giá cũ/mới, không gộp thành 3×40.000đ hoặc 3×30.000đ.
- Nếu cùng modifier/cấu hình thì chênh giá vẫn phải giữ riêng. Tăng số lượng qua nút cộng vẫn là gọi thêm theo quy tắc đã chốt trước; không tăng lượng cũ bằng giá cũ hoặc định giá lại phần cũ.
- Các ví dụ analyst từng đưa về thêm topping lên ly cũ cho tổng 67.000đ/72.000đ **bị rút khỏi phạm vi**, không phải hai lựa chọn còn chờ chủ dự án. Câu hỏi đó phát sinh do analyst chưa kiểm luồng UI trước khi đề xuất, không phải yêu cầu thiếu của chủ dự án.

Điểm nghiệp vụ modifier đã đóng. Còn việc analyst hoàn thiện contract, bộ bảy artifact và rà cuối; xác nhận này chưa phải duyệt triển khai một bộ spec chưa hoàn chỉnh. Code hiện tại chưa được sửa để bảo đảm tổng 100.000đ khi menu đổi: luồng replace-submit vẫn lấy giá hiện hành cho các dòng cũ lẫn mới.

## Cập nhật phạm vi 08/09/2026

Chủ dự án chọn ưu tiên **online**, hoãn bán hàng và đồng bộ ghi offline. Change này tiếp tục ưu tiên vì cần khôi phục thao tác mất phản hồi ngay trong vận hành online nhiều máy.

Hướng spec: **đăng ký lệnh bất biến trên server trước khi thực hiện**, có tra cứu theo cửa hàng/đơn để tìm lại từ máy khác. Local không là bản duy nhất sau khi đăng ký thành công. Chống trùng cả đăng ký lẫn thực hiện; không dựng lại payload từ màn hình khi thử lại. Hướng này mở lại lựa chọn `localStorage` ở tài liệu vòng hai; không chỉ thêm bảng các khóa đã thành công.

Quyết định mới nhất nằm ở [tài liệu 10](../../../docs/reviews/2026-09-07-idempotency/10-quyet-dinh-sau-review-va-chinh-sach-gia.md): server xác minh; tiếp quản theo quyền, không giới hạn quản lý; không bắt đối chiếu tiền mặt; khôi phục dữ liệu server; giá giữ theo từng lần gọi; phục hồi phiếu bếp hoãn. Analyst được giao chọn vòng đời lệnh: 24 giờ cho lần execute đầu, không tự xóa mã/kết quả trong bản đồ án.

Bộ spec chưa hoàn chỉnh và chưa được duyệt triển khai. [07](../../../docs/reviews/2026-09-07-idempotency/07-uu-tien-online-va-khoi-phuc-tren-server.md) giữ nguyên làm mốc trước review; [08](../../../docs/reviews/2026-09-07-idempotency/08-review-doc-lap-plan-07.md) ghi ba review độc lập và bằng chứng. Các quyết định cũ bên dưới được đọc theo cập nhật mới; lịch offline tuần 11–13 không còn là cam kết hiện hành.

**Xác nhận tiếp theo ngày 08/09/2026:** chủ dự án đồng ý phần giải thích về hai dòng bán hàng cùng món nhưng khác giá, yêu cầu ghi lại và chuẩn bị rà cuối trước code. Mốc giá từng phần, định danh dòng riêng, không gộp mất giá, và phân biệt ghi đơn với ghi payment được giữ làm yêu cầu đã chốt. [12 — chuẩn bị rà cuối](../../../docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md) ghi đầu vào review, các điểm đã kiểm, việc còn thiếu và tiêu chí chuyển sang triển khai. Đây là yêu cầu chuẩn bị, chưa phải xác nhận một bộ spec hoàn chỉnh đã được duyệt.

## Bổ sung ngày 08/09/2026 — lệnh 24 giờ, đơn qua ngày và dữ liệu báo cáo

### Chốt bổ sung với chủ dự án — cùng món, khác giá là hai dòng bán hàng

Ngày 08/09/2026, sau nghiên cứu POS và thương mại điện tử, chủ dự án xác nhận: giá lấy khi tạo đơn/phần món; nếu gọi thêm cùng món sau khi giá đổi thì phần thêm nhận giá mới; cùng tên/cùng loại nhưng khác giá phải được phân biệt. Cụ thể hóa cho spec:

1. **Mốc chốt giá là server ghi nhận thành công từng phần món**, kể cả phần thêm vào một đơn đã có. Không phải lúc bắt đầu gõ giỏ, register lệnh hoặc thời điểm mở bàn lần đầu cho mọi phần gọi về sau.
2. **Hai dòng bán hàng có giá riêng**, vẫn có thể cùng `menuItemId`. Không tự tạo hai sản phẩm catalog chỉ vì menu đổi giá. `orderItemId` là định danh dòng/phần bán; tên và giá không thay thế định danh này.
3. Ví dụ: cùng cà phê, cùng cấu hình, một phần 30.000đ và một phần 35.000đ phải còn riêng giá/số lượng trong đơn, màn sửa, màn chọn thanh toán và hóa đơn. Tổng là **65.000đ**; không đổi thành 2×35.000đ, 2×30.000đ hoặc đơn giá bình quân 32.500đ.
4. Giá khác là điều kiện **không được gộp mất thông tin**. Giá bằng nhau chưa đủ chứng minh hai dòng tương đương: còn món/biến thể, cấu hình option, số lượng option, ghi chú và nguồn gốc. Cùng tổng 35.000đ có thể là base 30.000đ + topping 5.000đ hoặc base 35.000đ không topping.
5. Gọi thêm bằng dấu cộng cũng phải được xử lý như phần bổ sung theo giá hiện tại, không tăng toàn bộ số lượng cũ rồi tính lại bằng một đơn giá. Giảm/tách/thanh toán phải chọn đúng phần theo ID, giữ snapshot phần còn lại.
6. Thống kê vẫn có thể tổng hợp các dòng về cùng món khi cần đếm số lượng; số tiền phải cộng theo snapshot từng dòng. Quy tắc mới không yêu cầu nhân đôi món trong menu hoặc sửa chính sách ngày báo cáo.
7. **Ghi đơn và ghi thanh toán là hai kết quả riêng.** Ghi đơn chốt nội dung/giá phải trả; chỉ nghiệp vụ thanh toán thành công mới ghi payment/chuyển trạng thái paid. Lập luận “tạo đơn là một phần của quá trình thanh toán” không đồng nghĩa server đã nhận giao dịch thanh toán ở lúc tạo đơn.
8. Retry cùng lệnh trả kết quả đã ghi; không dùng việc giá menu đổi để tạo dòng mới trong một lần phục hồi. Phần mới phải đến từ một xác nhận nghiệp vụ mới.

**Lý do chọn:** bảo toàn giá đã ghi nhận, hỗ trợ menu đổi trong ca bán hàng, tổng tiền dễ giải thích và không cần lưu toàn bộ lịch sử bảng giá cho mỗi bàn. **Đánh đổi:** phải giữ nguồn gốc phần món và hiển thị được cùng món nhiều giá; không thể tiếp tục gộp draft chỉ theo món/option rồi replace toàn đơn. Đây là độ phức tạp cần thiết để đạt quy tắc đã chọn, không phải yêu cầu thêm hệ thống định giá linh động.

**Cập nhật giới hạn ngày 09/09/2026:** chỉ chọn modifier khi gọi thêm món; sửa modifier trên phần đã ghi không thuộc phạm vi. Vì vậy không còn câu hỏi giá cho thao tác đó. Ví dụ 100.000đ và quyết định hiện hành nằm ở đầu proposal.

### Bằng chứng bổ sung — thao tác thêm hiện gộp trước khi xét giá

Mã tại `main@7183b31`, `src/features/pos/orderFlow.ts:200–228`:

```ts
export const addDraftMenuItem = (
  draftItems: SubmitOrderDraftItem[],
  menuItem: Pick<MenuItem, "id">,
  options: SubmitOrderDraftOption[] = [],
): SubmitOrderDraftItem[] => {
  // Gộp với dòng cùng món, cùng tổ hợp tuỳ chọn và chưa có ghi chú riêng.
  const signature = optionSignature(options);
  const existing = draftItems.find(
    (item) =>
      item.menuItemId === menuItem.id && !item.note && optionSignature(item.options) === signature,
  );

  if (existing) {
    return draftItems.map((item) =>
      item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
    );
  }

  return [
    ...draftItems,
    {
      id: createClientId(),
      menuItemId: menuItem.id,
      quantity: 1,
      note: null,
      options,
    },
  ];
};
```

Hàm chỉ nhận `menuItem.id`, tìm theo món/option/ghi chú rồi tăng quantity. Đây là bằng chứng cần sửa contract dựng draft/gọi thêm; chỉ sửa phép cộng tổng tiền không đủ. Việc draft hiện không mang giá/source snapshot và replace-submit đọc lại menu đã được trích tại tài liệu 10. Chưa sửa mã trong lần chốt này.

Các biến thể bổ sung cho PRE-IDEM-24/25/32 (vẫn là ca chuẩn bị, không tăng số ca đã chạy):

| Biến thể | Dữ liệu và bước | Expected result |
| --- | --- | --- |
| Khác giá qua hai cách thêm | Server có 1 ly 30.000đ; menu 35.000đ; gọi thêm bằng chạm món hoặc dấu cộng, mỗi cách một fixture | Hai phần giá 30.000đ/35.000đ, tổng 65.000đ; reload/đổi máy/hóa đơn giữ đúng hai giá |
| Giảm đúng phần đã chọn | Có hai phần 30.000đ và 35.000đ; bỏ phần 35.000đ trong đơn chưa paid | Còn 30.000đ; không tự bỏ phần cũ hoặc lấy lại giá 35.000đ cho phần còn lại |
| Tổng bằng nhau nhưng cấu hình khác | Một ly base 30.000đ + topping 5.000đ; một ly base 35.000đ không topping | Tổng 70.000đ; vẫn phân biệt cấu hình và chọn đúng dòng khi split; không gộp chỉ vì đơn giá sau phụ thu đều 35.000đ |
| Giá quay lại mức cũ | Lần lượt gọi 1 ly ở 30.000đ, 35.000đ, rồi 30.000đ; mỗi lần là một xác nhận mới | Tổng 95.000đ, đủ 3 ly; giá bằng lần đầu không biến lần thứ ba thành replay. Có thể nhóm hiển thị nếu vẫn giữ nguồn gốc và ánh xạ chọn phần |
| Retry sau đổi menu | Lần đầu server đã ghi 1 ly 30.000đ nhưng mất ACK; menu lên 35.000đ; phục hồi cùng K | Vẫn chỉ phần 30.000đ đầu tiên; không thêm phần 35.000đ, không repricing |

Mục này đưa trực tiếp các quyết định trong tài liệu 10 vào OpenSpec. Đây là **yêu cầu cho bản sẽ triển khai**, không mô tả tính năng đã có trên `main`. Chủ dự án đã giao analyst chọn thời hạn và cách hủy; 24 giờ là lựa chọn theo ủy quyền, không phải số đo thực tế hay chuẩn bắt buộc của ngành POS.

### Ba vòng đời phải tách riêng

| Đối tượng | Quy tắc đã chọn | Lý do |
| --- | --- | --- |
| Đơn đã ghi trên server | Không có hạn 24 giờ do giao thức chống trùng; đơn mở có thể được thanh toán sau 1–2 ngày nếu còn hợp lệ và người thực hiện có quyền | Bỏ quên thanh toán không làm dữ liệu hoặc nghĩa vụ xử lý đơn biến mất |
| Lệnh đã đăng ký nhưng chưa áp dụng | `expires_at = registered_at + 24 giờ`; hai mốc do server đặt, không gia hạn bởi retry | Giới hạn khả năng chạy một xác nhận cũ, vẫn cho phép tiếp quản qua ca và qua nửa đêm |
| Mã lệnh và kết quả cuối | Không tự xóa trong bản đồ án; applied/rejected/cancelled/expired không trở lại thành lệnh mới | Còn tra được kết quả khi đổi máy và không tái chạy request cũ sau dọn dữ liệu |

**Quy tắc phân xử tại server:** sau xác thực/quyền và sau khi lấy khóa quyết định lệnh, xét kết quả cuối trước. Nếu đã applied thì trả kết quả lần đầu, dù đã qua 24 giờ. Chỉ với lệnh chưa chạy mới kiểm đồng hồ server tại điểm này: thời điểm kiểm `>= expires_at` thì hết hạn, không áp dụng nghiệp vụ. Không dùng thời điểm bắt đầu HTTP hoặc đồng hồ client để vượt qua thời gian chờ khóa. Transaction đã bắt đầu hiệu ứng hợp lệ trước hạn được kết thúc bình thường; không cắt ngang khi đồng hồ chạm hạn.

Hết hạn hoặc hủy **lệnh** không tự thanh toán/hủy **đơn**, không xóa payment, không trả bàn và không tạo một lệnh thay thế. Khi cần thực hiện việc mới, người dùng tải dữ liệu server và chủ động xác nhận lệnh mới. Không coi timeout, HTTP abort, đóng màn hình hoặc kết quả tra cứu rỗng là bằng chứng lệnh cũ thất bại/đã hủy.

### Các tình huống phải được nghiệm thu

Mốc ví dụ dùng múi giờ cửa hàng `Asia/Ho_Chi_Minh` (UTC+07:00); server lưu thời điểm tuyệt đối.

| Mã | Tình huống | Kết quả bắt buộc |
| --- | --- | --- |
| TTL-01 | Tạo đơn 08/09 lúc 10:00, chưa đăng ký thanh toán; 10/09 lúc 10:00 mới thanh toán | Đọc đơn hiện tại, đăng ký lệnh mới ngày 10/09; hạn lệnh mới là 11/09 lúc 10:00. Không từ chối vì đơn đã 48 giờ |
| TTL-02 | Lệnh thanh toán đăng ký 08/09 lúc 10:00, chưa áp dụng; tiếp tục 10/09 lúc 10:00 | Trả expired cho lệnh cũ; đơn, bàn và số tiền không đổi. Chỉ sau xác nhận mới mới có lệnh khác |
| TTL-03 | Thanh toán thành công 08/09 nhưng mất phản hồi; tra lại 10/09 | Trả applied và payment/result cũ; số payment không tăng, không hết hạn kết quả |
| TTL-04 | Kiểm hạn ngay 09/09 lúc 09:59:59.999 và 10:00:00.000, trên hai fixture độc lập | Trước hạn được xét tiếp điều kiện nghiệp vụ; đúng hạn bị expired, không ghi nghiệp vụ |
| TTL-05 | Request tới trước hạn nhưng chờ khóa tới đúng/sau hạn | Kiểm giờ sau khi có khóa; không được áp dụng chỉ vì request đến sớm |
| TTL-06 | Đăng ký lúc 08/09 23:59 | Không hết hiệu lực vào 00:00; hạn là 09/09 23:59. Ngày kinh doanh không thay thời hạn lệnh |

Thông điệp UX dự kiến: **“Lệnh đã hết hiệu lực. Đơn vẫn được lưu. Hãy tải lại đơn và xác nhận thao tác mới.”** Với mất phản hồi: **“Chưa xác định kết quả. Kiểm tra thao tác trên server trước khi tiếp tục.”** Các mã lỗi và ánh xạ thông điệp sẽ được chốt trong `design.md`; hiện chưa thêm mã vào ứng dụng.

**Đánh đổi:** 15–30 phút dễ làm lệnh hết hạn giữa lúc đổi máy/đổi ca; hết ngày kinh doanh khiến lệnh lúc 23:59 chỉ còn một phút; không hết hạn để lại khả năng chạy ý định rất cũ. Chọn 24 giờ để có một quy tắc đơn giản cho bốn RPC. Giữ toàn bộ bản ghi giúp khôi phục và giải trình cho đồ án nhưng làm bảng tăng theo thời gian. Chưa có số đo dung lượng; nếu cần dọn dữ liệu sau này phải thiết kế riêng marker chống tái dùng khóa và kiểm thử request đến muộn. Không phụ thuộc `pg_cron` trong phiên bản này.

### Ngày tạo đơn và ngày thanh toán trong báo cáo — hiện trạng, chưa đổi yêu cầu

Mã được đọc: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`. Trích đúng các đoạn đang quyết định hành vi:

`supabase/migrations/012_action_permission_guardrails.sql:751–757` — ngày kinh doanh của đơn mới:

```sql
    select coalesce(ss.timezone, 'Asia/Saigon')
    into v_timezone
    from public.store_settings ss
    where ss.store_id = v_store_id;

    v_timezone := coalesce(v_timezone, 'Asia/Saigon');
    v_business_date := (now() at time zone v_timezone)::date;
```

`supabase/migrations/012_action_permission_guardrails.sql:1116–1122` — thanh toán toàn bộ cập nhật trạng thái/thời điểm, không gán lại ngày kinh doanh:

```sql
  update public.orders o
  set status = 'paid'::public.order_status,
      paid_at = v_paid_at,
      lock_version = o.lock_version + 1
  where o.store_id = v_store_id
    and o.id = p_order_id
  returning * into v_order;
```

`src/adapters/supabase/reportRepo.ts:24–28` — báo cáo lọc ngày theo đơn:

```ts
    const { data: orderRows, error } = await this.client
      .from("orders")
      .select("id,total,business_date,paid_at,created_at")
      .eq("status", "paid")
      .eq("business_date", filter.businessDate);
```

**Suy luận từ mã, chưa tái hiện trên DB:** đơn tạo 08/09 và thanh toán toàn bộ 10/09 được cộng vào báo cáo ngày 08/09 hiện tại. Chính sách 24 giờ không tự sửa cách tổng hợp này. Đề xuất cần xét riêng: giữ ngày tạo cho lịch sử/số đơn, nhóm tiền ghi thanh toán theo ngày thanh toán tại múi giờ cửa hàng. **Chưa được chủ dự án chốt; không dùng đề xuất đó làm expected result của change này.** Ca qua ngày vẫn phải ghi riêng `business_date`, `paid_at` và kết quả báo cáo để thấy giới hạn hiện hành.

### Trạng thái thiết kế kiểm thử, ngày 08/09/2026

Trước lần cập nhật này, change chỉ có `proposal.md`; 08 có 24 ca ứng viên và 10 có 17 ca ứng viên, có phần trùng nhau. **Không cộng thành 41 testcase độc lập, không gọi chúng là test đã chạy.** Kế hoạch chuẩn bị dưới đây có 32 ca có dữ liệu/bước/kết quả để chuyển sang `testplan.md` sau khi chốt contract và yêu cầu còn mở. Đây chưa phải bộ bảy artifact hoàn chỉnh.

**Đã đóng ngày 09/09/2026:** câu hỏi đổi size/topping phần món đã ghi bị loại khỏi phạm vi sau khi chủ dự án chỉ ra luồng UI thực tế. Không cần chủ dự án chọn chính sách cho thao tác không được yêu cầu. Cơ chế xác minh danh tính nhân viên và contract lỗi là việc thiết kế còn phải hoàn tất, phối hợp `enforce-permissions-at-database`; không đẩy các chi tiết kỹ thuật này thành câu hỏi về con số TTL cho chủ dự án.

### Nghiên cứu bổ sung về sửa giá/size/topping — 08/09/2026

**Lịch sử, đã bị thay thế bởi chốt phạm vi 09/09/2026 ở đầu proposal.** Nguồn nghiên cứu được giữ làm tài liệu tham khảo, nhưng hai phương án chỉnh modifier của phần cũ dưới đây không còn là yêu cầu hoặc điểm chặn của change. Cả đề xuất 42.000đ lẫn đề xuất 37.000đ cho ly cũ đều dựa vào một thao tác không thuộc luồng hiện hành.

Chủ dự án hỏi phương án nào dễ hơn và yêu cầu đối chiếu phần mềm thực tế. Câu trả lời mới tiếp tục ủng hộ giữ giá lúc ghi phần cũ, phần gọi sau nhận giá mới; **chưa chốt riêng trường hợp sửa cấu hình của phần cũ**. Nguồn chính thức được tra ngày 08/09/2026:

| Sản phẩm / nguồn | Điều kiểm chứng được | Giới hạn suy luận |
| --- | --- | --- |
| [Square — Retrieve Catalog Objects](https://developer.squareup.com/docs/catalog-api/retrieve-catalog-objects) | Order giữ phiên bản catalog của dòng hàng, có thể đọc lại dữ liệu/giá lịch sử | Chứng minh khả năng giữ snapshot, không chứng minh mọi lần chỉnh món tại POS tự chọn giá nào |
| [Square — Update Orders](https://developer.squareup.com/docs/orders-api/manage-orders/update-orders) | API sửa các trường được chỉ định và có ví dụ thêm modifier vào cà phê; yêu cầu version hiện hành | Chính tài liệu giới hạn endpoint này không sửa đơn được tạo bằng ứng dụng Square POS. Không lấy ví dụ API làm bằng chứng hành vi UI POS |
| [Lightspeed Restaurant O-Series — Editing an order in the POS](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329446518299-Edit-an-order-with-Lightspeed-POS-Basics) | Trước khi hoàn tất giao dịch, có thể sửa quantity, unit price, note và modifier của từng dòng rồi áp dụng thay đổi | Không nói rõ giá cơ bản có tự cập nhật khi modifier đổi sau một lần tăng giá menu; không khẳng định họ dùng giá cũ hoặc giá mới cho ca đó |
| [Shopify — Editing products in an order](https://help.shopify.com/en/manual/fulfillment/managing-orders/editing-orders/products) | Muốn đổi sản phẩm thì bỏ món không muốn và thêm món mới; xem lại tổng trước cập nhật | Đây là quy trình quản trị đơn Shopify, không phải bằng chứng cho topping trong POS nhà hàng; trang này không chốt giá của mọi biến thể thêm/tăng số lượng |

**Khuyến nghị cũ ngày 08/09/2026, chưa được duyệt; đã xét lại ngày 09/09/2026:** giữ nguyên snapshot của phần món không thay đổi; nếu sửa size/topping của một phần chưa thanh toán, xử lý phần bị sửa thành phần gọi mới theo bảng giá hiện hành, giữ dấu vết thay thế. Chỉ sửa ghi chú hoặc giảm số lượng thì giữ đơn giá cũ. Khi thay một ly trong dòng ba ly, hai ly không sửa vẫn giữ snapshot cũ. Không tự tính lại toàn đơn.

**Làm rõ ngày 09/09/2026 sau câu hỏi của chủ dự án:** mô hình hiện hành đã tách giá món gốc và giá từng modifier; nhóm modifier dùng chung qua liên kết món–nhóm. Vì vậy thêm topping không bắt buộc phải đổi giá gốc. Analyst rút khuyến nghị ưu tiên tính lại cả cấu hình chỉ vì sửa modifier, và nghiêng về giữ base đã ghi, phần modifier bổ sung lấy giá hiện hành. Hai ly đã ghi 30.000đ/ly, sau đó thêm topping 7.000đ cho một ly sẽ là **67.000đ** theo hướng này, kể cả menu đã tăng base lên 35.000đ. Đây là đề xuất đã điều chỉnh, chưa coi câu hỏi xác minh mô hình là xác nhận chính sách sửa modifier. Bằng chứng nguyên văn, giới hạn code hiện tại và các ca còn phải cụ thể hóa nằm ở [12, mục 6](../../../docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md).

Ví dụ: ly cũ không topping giá 30.000đ; menu mới base=35.000đ, topping mới=7.000đ. Nếu đổi cấu hình bằng cách thêm topping: phương án phần gọi mới tính 42.000đ; phương án giữ base cũ tính 37.000đ. Cả hai đều cần hiển thị số tiền mới trước xác nhận. Nếu chỉ gọi thêm một ly không topping thì vẫn là 30.000đ + 35.000đ = 65.000đ như đã chốt.

| Phương án | Thuận lợi | Đánh đổi |
| --- | --- | --- |
| Phần sửa cấu hình trở thành phần mới theo giá hiện tại | Hai quy tắc rõ: giữ snapshot cũ hoặc tạo snapshot mới; dễ đối chiếu, ít nhánh theo nguồn gốc từng option | Khách chỉ thêm topping nhưng giá cơ bản có thể tăng theo; phải cho xem giá mới và lưu dấu vết phần bị thay |
| Giữ base cũ, chỉ phần phụ thu mới nhận giá mới | Giữ được giá cơ bản khách đã gọi; phù hợp kỳ vọng “chỉ trả thêm topping” | Phải giữ danh tính từng option cũ/mới và quy tắc sửa số lượng, đổi size, bỏ/thêm lại option; khó hơn khi split/retry |

Nhận định “dễ hơn” dựa vào cấu trúc mã hiện tại: `src/features/pos/orderFlow.ts:66–79` chỉ còn menu/option ID, số lượng, ghi chú khi chuyển snapshot về draft; `:84–107` đọc base/option từ menu; SQL `012:798–918` cũng dựng giá từ menu khi insert. Cả hai phương án đều phải bổ sung nguồn gốc dòng để giữ giá đã chốt; phương án trộn base cũ/phụ thu mới còn phải phân biệt từng thành phần của cấu hình. Đây là đánh giá độ phức tạp, **không phải số ngày công đã đo**.

Chưa tìm được bằng chứng chính thức đủ sát để nói “các POS đều xử lý giống phương án khuyến nghị”. Lập luận chọn cho pos-cafe phải dựa vào phạm vi đồ án và quy tắc khách được xem/xác nhận, không dựa vào một tiền lệ bị diễn giải quá mức. Sau khi chốt, bổ sung ít nhất các ca đổi 1 trong 3 ly, bỏ/thêm lại topping, đổi số lượng topping, giá đổi giữa register–execute và mất ACK khi thay phần món.

### Cách thiết kế và chạy kiểm thử sau khi triển khai

Bổ sung nghiên cứu ngày 08/09/2026: [thương mại điện tử và kiểm chứng test độc lập](../../../docs/reviews/2026-09-07-idempotency/11-thuong-mai-dien-tu-va-kiem-chung-test.md). Shopify mô tả chi phí cart có thể đổi tại checkout; commercetools có bước tính lại/đóng băng cart và snapshot khi tạo order. Áp dụng cho POS: **mốc giữ giá là mỗi phần món đã ghi nghiệp vụ**, không đợi đến thanh toán để tính lại toàn bàn, và hạn lệnh 24 giờ không phải hạn giữ giá. PRE-IDEM-26 phải có biến thể menu/option đổi giá dù version đơn chưa đổi; xem thêm quy trình review bằng ngữ cảnh mới và bằng chứng chạy thực tại tài liệu 11.

Chọn tầng thấp nhất chứng minh được từng điều kiện, theo [chiến lược kiểm thử](../../../docs/test-strategy.md). Test mock chỉ chứng minh flow/UI; tính nguyên tử, khóa đồng thời, SQL `NULL`, quyền RPC và RLS phải chạy trên PostgreSQL/Supabase thật dành riêng cho test. Không dùng test đọc chuỗi migration làm bằng chứng transaction đã an toàn.

Fixture độc lập cho mỗi ca, trừ khi ca mô tả rõ chuỗi thao tác:

- `S1`, `S2`: hai cửa hàng khác nhau. A có quyền tạo/sửa đơn; B có quyền thanh toán; C có quyền hủy đơn đã paid; D thiếu quyền thanh toán. Các danh tính phải được server xác minh, không chỉ truyền ID nhân viên vào RPC.
- `O1`: đơn tại bàn B01, `open`, version 5; dòng L1 có 5 cà phê, đơn giá snapshot 30.000đ, không option; tổng 150.000đ. Không payment trước test. `O2`: một cà phê 30.000đ và một trà 20.000đ, mỗi dòng số lượng 1, tổng 50.000đ.
- `K1 = 00000000-0000-4000-8000-000000000301`, `K2 = 00000000-0000-4000-8000-000000000302`. Mỗi fixture có UUID thực riêng cho cửa hàng, đơn, dòng, payment và đơn tách; các alias chỉ để đọc ca dễ hơn. Kết quả đầu được lưu thành `R1` để đối chiếu replay.
- `T0 = 2026-09-08T03:00:00.000Z` (08/09 10:00 tại cửa hàng). Tiền mặt là số nguyên đồng. Với O1: nhận 200.000đ khi trả toàn bộ; nhận 50.000đ khi trả một ly.
- Ký hiệu mức: **ĐV** = đơn vị; **TH** = tích hợp; **GD** = giao diện; **E2E** = đầu cuối. Mỗi biến thể tham số phải là một lần chạy riêng, không tái dùng fixture đã bị biến đổi.

| Ca chuẩn bị | Mức / nhóm | Dữ liệu, tiền điều kiện và các bước | Kết quả quan sát bắt buộc |
| --- | --- | --- | --- |
| PRE-IDEM-01 | TH / chính | Hai biến thể tạo đơn: B01 trống và mang đi. (1) Xác nhận 1 cà phê 30.000đ bằng K1; (2) register/execute; (3) gửi lại K1. Biến thể bàn: máy khác thanh toán đơn rồi mới replay K1 | Chỉ 1 đơn do K1 tạo; cùng ID/số đơn/result ban đầu. Replay không tạo đơn khác dù bàn đã trống |
| PRE-IDEM-02 | TH / chính | O1. (1) Sửa ghi chú L1 thành “ít đá”, expectedVersion=5; (2) thực hiện K1; (3) gửi lại. Fixture khác: bỏ toàn bộ món theo nhánh hủy đơn mở của submit | Sửa đúng 1 lần, không tăng version thêm vì replay, giá vẫn 30.000đ. Nhánh hủy mở chỉ có 1 kết quả hủy, không phát sinh payment |
| PRE-IDEM-03 | TH / chính | O1. (1) Thanh toán toàn bộ bằng K1, tiền nhận 200.000đ; (2) lưu R1; (3) execute K1 lần hai | Đúng 1 payment 150.000đ, tiền thừa 50.000đ, đơn paid, version=6, bàn trống; kết quả nghiệp vụ bằng R1 |
| PRE-IDEM-04 | TH / chính | O1. (1) Chọn L1 quantity=1, tiền nhận 50.000đ, K1; (2) split; (3) replay | Đúng 1 đơn tách/1 payment 30.000đ, tiền thừa 20.000đ; nguồn còn 4 ly/120.000đ; không cấp thêm số đơn; truy được liên kết nguồn–đơn tách–payment |
| PRE-IDEM-05 | TH / chính | O1 đã paid với 1 payment 150.000đ. (1) C void bằng K1, lý do `duplicate`; (2) replay | Đơn void một lần; tổng, payment và số đơn còn nguyên; người/thời điểm hủy không bị ghi đè; không tự ghi hoàn tiền |
| PRE-IDEM-06 | TH DB / biên | Mỗi loại trong 4 RPC dùng fixture hợp lệ. (1) Hai connection cùng register K1/payload giống nhau; (2) cùng execute K1 bằng barrier | Chỉ 1 bản đăng ký, tối đa 1 lần áp dụng; caller còn lại nhận kết quả cuối hoặc trạng thái phải tra lại nếu transport timeout, không hiệu ứng thứ hai |
| PRE-IDEM-07 | TH / ngoại lệ | (1) Register K1 cho split L1=1, version=5; (2) register lại K1 với L1=2, hoặc version=6, hoặc đổi loại sang pay toàn bộ, hoặc đổi tiền nhận; (3) fixture riêng đảo key JSON, đảo thứ tự mảng, đổi trường vắng thành null | Từ chối mọi biến thể đổi payload; nội dung K1 gốc không bị thay. Quyết định kỹ thuật 08/09: bỏ qua thứ tự key object; giữ thứ tự phần tử mảng; không đồng nhất trường vắng với null. Chỉ đảo key object thì được coi cùng nội dung; đảo mảng hoặc vắng→null bị mismatch. Không dựng lại payload từ màn hình để retry |
| PRE-IDEM-08 | TH / ngoại lệ | (1) Execute K1 khi chưa có đăng ký; (2) register K1 nhưng không execute; (3) đọc đơn và payment | Bước 1 không tạo dữ liệu nghiệp vụ. Bước 2 chỉ có lệnh pending, chưa có đơn/payment mới; UI không báo “đã tạo đơn” chỉ từ register |
| PRE-IDEM-09 | E2E / ngoại lệ | (1) Server commit register K1 rồi test giữ/bỏ response; (2) client kết thúc lần thử với kết quả chưa rõ; (3) trả response muộn; (4) người dùng tra/retry cùng K1 | Không có register thứ hai hoặc execute ngầm từ response muộn của lần thử đã kết thúc. Khi chủ động tiếp tục, dùng đúng bản đăng ký đầu và hạn đầu |
| PRE-IDEM-10 | E2E / ngoại lệ | O1. (1) Split 1 ly K1 đã commit, bỏ response; (2) polling đưa nguồn lên version=6/còn 4 ly; (3) lựa chọn vẫn là 1 ly; (4) bấm phục hồi | Không dựng K2/version6 để thanh toán thêm. Tra/execute K1 trả R1; chỉ 1 payment 30.000đ, nguồn vẫn 120.000đ |
| PRE-IDEM-11 | E2E / ngoại lệ | O2. (1) Trả hết dòng cà phê bằng split K1, bỏ response; (2) polling khiến dòng đã chọn biến mất, clamp thành rỗng; (3) bấm phục hồi | Không biến retry thành `pay_order` trả toàn bộ trà còn lại. Chỉ có payment 30.000đ đầu; trà 20.000đ còn mở |
| PRE-IDEM-12 | GD + E2E / ngoại lệ | (1) Đặt offline trước khi xác nhận; (2) bấm gửi/thanh toán; (3) online trở lại; (4) phát focus. Fixture khác: ngắt mạng giữa register và execute | Không lưu hàng đợi để tự execute khi online/focus; số lần ghi nghiệp vụ tự phát=0. Lần thất lạc hiển thị chưa xác định, chỉ read để kiểm kết quả; gửi mới cần hành động chủ động |
| PRE-IDEM-13 | E2E / chính | (1) A đăng ký K1 trên máy 1; (2) xóa toàn bộ dữ liệu trình duyệt/đóng máy 1; (3) B đăng nhập máy 2 và tìm lệnh theo cửa hàng/đơn; (4) tiếp tục. Chạy thêm biến thể K1 đã applied và đơn mang đi | Tìm được payload/trạng thái/result đã lưu; B đủ quyền được tiếp tục; không dựa vào local cũ. Nếu chưa từng tới server thì không dựng giả một bản phục hồi |
| PRE-IDEM-14 | TH DB / bảo mật, biên | O1. (1) Hai lệnh K1/K2 cùng version=5 thực hiện cạnh tranh; (2) fixture mới gửi version cũ 4 và SQL NULL trực tiếp cho update/pay/split/void; (3) tạo đơn mới với expectedVersion=null | Cạnh tranh chỉ một thay đổi thắng; ca còn lại xung đột. Version cũ/NULL của đơn đã có bị từ chối với 0 hiệu ứng. NULL cho tạo đơn mới vẫn được xét theo contract tạo mới |
| PRE-IDEM-15 | TH DB / ngoại lệ | Mỗi loại RPC. (1) Đã register; (2) gây lỗi sau ghi nghiệp vụ nhưng trước lưu result; (3) đọc DB từ connection khác; (4) chủ động retry. Biến thể: lỗi nghiệp vụ xác định như version conflict | Không thấy đơn/payment đã đổi mà lệnh lại không có kết quả applied. Lỗi hạ tầng rollback để có thể thử cùng K; lỗi nghiệp vụ cuối đã lưu không được tự chạy lại cùng K khi dữ liệu về sau đổi. Phải thiết kế ranh giới transaction/ngoại lệ để giữ được cả hai tính chất |
| PRE-IDEM-16 | ĐV + TH DB / biên | K1 đăng ký T0. Với fixture riêng, kiểm lần execute đầu tại T0+24h−1ms, đúng T0+24h và T0+24h+1ms; lặp khi đồng hồ client lệch ±48h | Trước hạn được xét nghiệp vụ; đúng/sau hạn expired, 0 hiệu ứng; lệch giờ client không đổi kết quả. Truy vết TTL-04 |
| PRE-IDEM-17 | TH DB / biên | (1) Connection A giữ khóa lệnh; (2) B yêu cầu execute trước hạn; (3) giải phóng khóa sau hạn. Biến thể: B đã qua kiểm hạn hợp lệ rồi transaction kết thúc sau hạn | Chờ khóa quá hạn thì expired; transaction đã hợp lệ trước hạn được kết thúc một lần. Không dùng timestamp cố định đầu transaction cho việc kiểm sau chờ. Truy vết TTL-05 |
| PRE-IDEM-18 | TH DB / biên | (1) Register T0; (2) register lại ở T0+23h; (3) đọc expires_at. Fixture khác đăng ký 08/09 23:59 và tiếp tục 09/09 00:01 | Hạn đầu không gia hạn; lệnh qua nửa đêm vẫn còn hiệu lực tới 09/09 23:59. Truy vết TTL-06 |
| PRE-IDEM-19 | E2E / chính, biên | O1 tạo T0, chưa có lệnh payment. (1) Đến T0+48h tải lại từ server; (2) đăng ký K1 mới; (3) thanh toán 200.000đ | Được thanh toán 150.000đ; expires_at của K1 tính từ đăng ký mới. Đơn 48 giờ không tự đóng/xóa/trả bàn trước thanh toán. Truy vết TTL-01 |
| PRE-IDEM-20 | E2E / biên | O1 có K1 payment pending từ T0. (1) Đến T0+48h tiếp tục K1; (2) tra expired; (3) tải lại; (4) chủ động xác nhận K2 | Trước bước 4: 0 payment, đơn/bàn/số tiền nguyên. K2 mới được xét theo trạng thái hiện hành; không tự sinh K2 do K1 hết hạn. Truy vết TTL-02 |
| PRE-IDEM-21 | TH + E2E / biên | K1 đã applied T0. (1) Tra/replay tại T0+25h và T0+48h, trên máy khác; (2) thử dùng lại K1 với payload khác; (3) đọc bản ghi | Trả R1 kể cả quá hạn; payment/số đơn không tăng; payload khác bị từ chối; mã/result còn nguyên, không có cơ chế tự xóa theo 24 giờ. Truy vết TTL-03 |
| PRE-IDEM-22 | TH DB / biên | K1 pending. (1) A execute, B cancel trên hai connection; (2) điều khiển lần lượt cancel thắng và execute thắng; (3) gọi lại cả hai endpoint | Cancel thắng: terminal cancelled, 0 hiệu ứng. Execute thắng: applied, cancel trả trạng thái đã áp dụng, không báo “đã hủy”. Rejected/expired không bị mở lại do cancel |
| PRE-IDEM-23 | TH + GD / ngoại lệ | (1) Giữ request register K1; (2) cancel/read K1 thấy chưa có; (3) cho register đến muộn; (4) đóng/mở drawer và reconnect | Không báo đã hủy hoặc thất bại chắc chắn từ not-found. Register muộn chỉ thành pending, không tự execute; có thể tra rồi hủy/hết hạn. HTTP abort không thay thế cancel server |
| PRE-IDEM-24 | TH + GD / chính | Fixture A: (1) Server ghi A ×2 giá 30.000đ; (2) menu thành 40.000đ; (3) thêm A ×1 từ menu, chọn modifier 0đ; (4) gửi; (5) split một A cũ hoặc A mới ở hai fixture; (6) replay. Fixture B giữ ca cũ: 1 ly 30.000đ, menu thành 35.000đ, gọi thêm bằng nút cộng | A: tổng 100.000đ; phần cũ 2×30.000đ và phần mới 1×40.000đ còn riêng; modifier 0đ vẫn được lưu, không mất do giá bằng 0. Split một A cũ=30.000đ, phần còn lại=70.000đ; split A mới=40.000đ, phần còn lại=60.000đ. B: tổng 65.000đ. Replay không đổi giá/số lượng/payment; không gom về một đơn giá |
| PRE-IDEM-25 | TH / chính, biên | Server có 2 ly ×30.000đ, mỗi ly 2 phần topping ×5.000đ. (1) Menu đổi base=35.000đ, topping=7.000đ; (2) chỉ sửa ghi chú; (3) giảm còn 1 ly | Sau bước 2 tổng vẫn 80.000đ; sau bước 3 còn 40.000đ; giá/name/option snapshot giữ nguyên. Xóa hết phần này không tác động giá phần khác. Đây không phải ca đổi cấu hình topping |
| PRE-IDEM-26 | TH + GD / ngoại lệ | (1) Người dùng xác nhận gọi thêm ly giá hiển thị 30.000đ và register K1; (2) giá server đổi 35.000đ trước execute; (3) execute K1; (4) người dùng xem giá mới | Không âm thầm ghi đơn theo số tiền chưa được xác nhận, không coi giá client là giá chính thức. Hiển thị chênh giá; chấp nhận giá mới là nội dung mới, không sửa payload K1. Mã lỗi và cơ chế xác nhận phải chốt trong contract |
| PRE-IDEM-27 | TH DB / chính, bảo mật | (1) A tạo đơn; (2) người khác sửa; (3) B thanh toán. Fixture khác: A register rồi bị khóa/nghỉ, B có đúng quyền execute; sau applied C chỉ replay | Giữ người tạo A; lưu người sửa/khởi tạo/thực hiện đúng danh tính server; B được tiếp quản mà không cần quyền tạo đơn hay vai trò quản lý. C replay không thay B trên payment |
| PRE-IDEM-28 | E2E / chính | (1) Split K1 1 ly trên O1; (2) không đánh dấu đối chiếu tiền mặt; (3) người đủ quyền chủ động tạo K2 trả thêm 1 ly với version mới | Cho phép giao dịch mới; tổng 2 payment cho 2 xác nhận độc lập. Không yêu cầu xác nhận ngăn kéo/đã cầm tiền. Nút phục hồi K1 vẫn chỉ trả giao dịch đầu |
| PRE-IDEM-29 | TH DB / bảo mật | Các endpoint register/execute/cancel/read/list. (1) S2 dùng ID của S1; (2) D giả ID B; (3) thiếu phiên nhân viên đã xác minh; (4) thu hồi quyền của caller giữa register và execute; (5) thử đọc result bằng caller không được đọc | Không vượt cửa hàng/quyền, không rò payload/result, không ghi nghiệp vụ trái phép. Thu hồi quyền kiểm lại tại thực hiện; lệnh không mắc kẹt vĩnh viễn chỉ vì một caller không có quyền thử trước người đủ quyền |
| PRE-IDEM-30 | TH DB / bảo mật | (1) Áp migration lên DB test; (2) kiểm catalog hàm và grants thực; (3) dùng credential ứng dụng gọi mọi overload RPC cũ không có K; (4) gọi helper và INSERT/UPDATE/DELETE trực tiếp orders/items/options/payments/lệnh | Không có đường ghi trong phạm vi bỏ qua giao thức/quyền. Bị từ chối ở DB, không chỉ ẩn nút. Không kết luận chỉ từ grep migration hoặc test mock |
| PRE-IDEM-31 | TH / ngoại lệ, biên | Fixture riêng: K rỗng/không phải UUID; paymentId/orderId sai; tiền nhận 149.999/150.000/150.001 cho O1; split quantity=0/1/5/6; IDs dòng trùng; dòng ngoài đơn/cửa hàng; món/option mới không còn bán; thiếu lý do void | Input không hợp lệ bị từ chối và không có hiệu ứng. Tiền đủ/tiền thừa được tính chính xác. Giữ hành vi hiện hành đã đọc: lựa chọn toàn bộ ở UI tạo lệnh pay_order trước register; gọi thẳng pay_order_items với toàn bộ trả INVALID_ORDER_ITEMS. Sau register không đổi loại lệnh do polling/clamp. Bao phủ các lỗi hiện có liên quan và mọi mã mới trong design trước nghiệm thu |
| PRE-IDEM-32 | GD + E2E / chính | (1) K1 split/paid thành công; (2) máy khác đổi tiếp đơn nguồn hoặc có khách mới ngồi bàn; (3) phục hồi R1; (4) người dùng chủ động xem/in lại receipt có 2 topping ×5.000đ | R1 hiển thị là kết quả lịch sử; trạng thái đơn/bàn hiện tại tải riêng. Không tự báo bàn hiện đang trống hoặc tự in do replay/reconnect. Tổng/option quantity của receipt khớp snapshot server |

**Nơi dự kiến hiện thực, chưa tạo các file này:**

| Nhóm test | Đường dẫn dự kiến trên `main` | Phần chịu trách nhiệm |
| --- | --- | --- |
| Đơn vị | `src/features/pos/writeOperationFlow.test.ts` | Định danh ổn định, payload bất biến, các nhánh trạng thái; giá phần cũ/phần mới |
| Hợp đồng adapter | `tests/contracts/writeOperations.contract.test.ts` | Cùng tập contract chạy mock và adapter Supabase thật; không giả HTTP rồi gọi đó là test DB |
| Database | `tests/supabase/write-operations.spec.ts` | RPC, transaction, quyền, overload, SQL NULL và hai connection cạnh tranh |
| Giao diện | `src/app/writeOperationRecovery.test.tsx` | Thông báo, lựa chọn thanh toán, không đổi loại lệnh khi polling/clamp, không tự in |
| E2E mock | `tests/smoke/write-operation-recovery.spec.ts` | Đổi màn, mất local, khôi phục/tiếp quản và reconnect trong hành trình UI |
| E2E server | `tests/supabase/write-operation-recovery.spec.ts` | Server commit nhưng mất response, hai browser context, truy DB đối chiếu kết quả cuối |

Các đường dẫn trên là **đích thiết kế**, không phải bằng chứng đã có test. Khi viết `testplan.md`, từng PRE-IDEM được tách thành TC có requirement/UC, mã lỗi/thông điệp, fixture hợp lệ hoàn chỉnh và file hiện thực; có thể tăng số ca vì một dòng hiện chứa nhiều biến thể.

**Cách gây lỗi có thể tái hiện:**

1. Mất ACK phải cho server commit trước, xác nhận commit bằng connection quan sát rồi mới bỏ response ở proxy/test transport. Chặn request trước khi tới server không chứng minh được ca này.
2. Race dùng hai connection và barrier có thứ tự xác định cho từng bên thắng; không chỉ `Promise.all` với một sleep ngẫu nhiên. Đếm bản ghi, so tổng tiền, version, trạng thái bàn và ID kết quả sau cả hai lần gọi.
3. Test 24/48 giờ dùng đồng hồ điều khiển trong test đơn vị và fixture thời gian ở DB test. Với test chờ khóa, harness có đặc quyền điều khiển fixture; không mở tham số “giờ hiện tại” cho client nghiệp vụ. Có kiểm định wiring dùng đồng hồ DB thực. Không cần chờ hai ngày hoặc đổi đồng hồ máy người dùng.
4. Test lỗi giữa transaction chỉ dùng hook/fault injection dành cho môi trường test. Credential đặc quyền để dựng/đọc fixture tách khỏi credential caller thực sự đang bị kiểm quyền.
5. Hai thiết bị dùng hai browser context và hai phiên nhân viên riêng. Xóa local phải xóa storage của context thử nghiệm, không đụng dữ liệu trình duyệt người dùng.

**Điều kiện để được nói “đã kiểm chứng”:** tất cả requirement và use case trong bộ spec cuối có TC; mỗi lỗi có nhánh từ chối được chạy; các ca DB/race/ACK/qua ngày có kết quả thực, không skip rồi báo pass. Chạy cổng dự án tương ứng (`npm run build`, `npm test`, `npm run test:coverage`, `npm run smoke`) và `npm run smoke:supabase` khi nghiệm thu mốc. Coverage 90% phần logic theo chiến lược hiện hành không thay thế các ca bắt buộc trên DB. Lưu ngày, commit code, phiên bản migration, môi trường, số ca thực chạy/pass/fail/skip và trace; không ghi secret vào bằng chứng báo cáo.

**Cập nhật ca giá ngày 09/09/2026:** PRE-IDEM-24 phải chạy thêm biến thể phần cũ và mới có đúng cùng modifier 0đ để phát hiện gộp sai theo option signature; biến thể gọi món mới với modifier có giá 7.000đ cho tổng 107.000đ; và kiểm mất ACK sau commit rồi menu đổi tiếp vẫn replay đúng kết quả 100.000đ. PRE-IDEM-25 giữ việc bảo toàn option snapshot khi sửa ghi chú/giảm số món; không thêm testcase thao tác sửa modifier phần cũ. Chọn modifier trong popup lúc thêm món vẫn có kiểm single/multi, số lượng và quyền/liên kết hợp lệ theo các ca tương ứng.

**Trạng thái hiện tại:** chỉ bổ sung tài liệu; 32 ca trên và các biến thể chưa viết thành mã, chưa chạy. Còn thiếu bộ input/output/error hoàn chỉnh, UC và ma trận truy vết chính thức, nên chưa tuyên bố đủ điều kiện triển khai/nghiệm thu. Điểm nghiệp vụ modifier đã đóng ngày 09/09/2026; các nhiệm vụ thiết kế còn lại do analyst thực hiện.

## Why

Khi người dùng bấm lại sau một lần mất phản hồi, ứng dụng hiện **dựng lại lệnh từ màn hình đang hiển thị** thay vì gửi lại chính lệnh đã xác nhận: `src/features/pos/orderFlow.ts` sinh định danh mới ở mỗi lần gọi (`orderFlow.ts:308`, `:418-428`), lấy `lock_version` mới nhất mà polling vừa kéo về, và kẹp lại lựa chọn theo dữ liệu mới. Nghĩa là một yêu cầu **đã chạy xong phía database nhưng bị timeout phía client**, rồi được gọi lại, có thể được máy chủ nhìn thành một thao tác hoàn toàn khác.

Hệ hiện có sẵn vài lớp chặn, và chúng **có tác dụng khi lần gửi lại giữ nguyên định danh cũ**: khóa chính của `order_items`, chỉ mục duy nhất một-đơn-mở-trên-một-bàn, và guard trạng thái cộng `lock_version` trong từng RPC. Nhưng không lớp nào trong số đó nhận diện được **cùng một ý định nghiệp vụ** khi định danh và ngữ cảnh đã đổi. Hai ca đã xác minh bằng đọc mã: bấm lại `pay_order_items` sau khi phiên bản đã tiến hợp lệ thì **ghi nhận thanh toán thêm lần nữa**; và tạo lại một đơn tại bàn sau khi máy khác đã thanh toán đơn đầu thì **qua được cả guard lẫn chỉ mục**, vì cả hai chỉ xét `status = 'open'`.

Định danh do client sinh vốn là điểm mạnh của thiết kế hiện tại: đơn, dòng món và thanh toán đều mang khóa chính dạng UUID do client tạo, nên về nguyên tắc chống trùng được bằng chính khóa chính. Nhưng hiện việc đó **phụ thuộc vào việc tầng gọi có nhớ truyền định danh ổn định xuống hay không**, chứ không phải một bảo đảm của hệ thống. Một chỗ quên là mất bảo đảm.

Môi trường vận hành làm chuyện này dễ xảy ra hơn bình thường: mạng ở quán chập chờn, thiết bị đặt cố định chạy liên tục nhiều giờ, và nhân viên có thói quen bấm lại khi màn hình có vẻ treo. Hậu quả không phải lỗi hiển thị mà là **hai bản ghi thanh toán cho một lần thu tiền**, kéo theo doanh thu sai.

Change này **không phụ thuộc chế độ ngoại tuyến** và đáng làm ngay cả khi không bao giờ làm ngoại tuyến. Nhưng nó cũng là nền bắt buộc cho toàn bộ nhóm ngoại tuyến, vì gửi lại hàng đợi chính là gửi trùng có chủ ý: nếu máy chủ không phân biệt được "lần gửi lại của cùng một việc" với "một việc mới", thì mọi cơ chế hàng đợi đều không an toàn.

## What Changes

- Mọi lời gọi ghi nghiệp vụ nhận một **khóa chống trùng** do client sinh đúng một lần cho mỗi ý định của người dùng, và giữ nguyên qua mọi lần gửi lại.
- Phía server lưu lệnh đã đăng ký, thực hiện nghiệp vụ và ghi kết quả nguyên tử; khi lệnh đã áp dụng thì **trả kết quả lần đầu** thay vì thực hiện lại. Vẫn kiểm quyền và từ chối dùng cùng khóa với nội dung khác.
- Tầng nghiệp vụ sinh khóa tại thời điểm người dùng xác nhận thao tác, không sinh lại khi thử lại. Khả năng phục hồi còn phụ thuộc tìm đúng lệnh đã đăng ký; không hứa nhận diện hai khóa mới là cùng ý định bằng cách đoán nội dung.
- Thêm tra cứu thao tác và kết quả theo cửa hàng/đơn để khôi phục khi mất dữ liệu client hoặc đổi máy; ghi rõ liên kết đơn nguồn, đơn tách và payment.
- Người có quyền được tiếp tục lệnh của người khác; server xác minh người thực hiện và quyền hiện hành. Lưu riêng người tạo đơn, người khởi tạo lệnh và người thực hiện; replay không đổi người đã ghi payment.
- Không thêm bước xác nhận tiền mặt hoặc chặn thanh toán tiếp vì chưa đối chiếu. Mất phản hồi vẫn là chưa xác định kết quả; thử lại lệnh cũ khác với chủ động tạo một lần thanh toán mới.
- Giữ giá snapshot phần món đã được server ghi nhận; món/số lượng gọi thêm lấy giá mới. Đơn có một ly 30.000đ rồi gọi thêm một ly giá 35.000đ có tổng 65.000đ. Replace-submit hiện dựng lại toàn bộ giá từ menu, nên cần thay đổi contract/UI/SQL tương ứng, không chỉ lưu thêm key.
- Rà lại các adapter hiện có để bỏ hẳn mẫu sinh định danh dự phòng ngay tại chỗ gọi.
- Kiểm chứng các kịch bản lỗi trên môi trường test; hệ chưa vận hành thật nên không coi việc truy tìm giao dịch production là cổng chặn.
- Bổ sung kiểm thử khẳng định gọi hai lần với cùng khóa cho kết quả giống hệt gọi một lần, ở cả tầng adapter lẫn tầng database.

## Capabilities

### New Capabilities

- `write-idempotency`: quy tắc khóa chống trùng cho các lời gọi ghi nghiệp vụ, cách máy chủ nhận biết và xử lý lần gửi lặp, và phạm vi áp dụng.

### Modified Capabilities

- `order-management`: luồng gửi đơn nhận thêm khóa chống trùng, và lần gửi lặp không tạo thêm đơn hay dòng món.
- `payment`: luồng thanh toán toàn bộ và luồng tách đơn thanh toán nhận thêm khóa chống trùng; lần gửi lặp không tạo thêm bản ghi thanh toán và không cấp thêm số đơn.
- `order-void`: luồng hủy đơn đã thanh toán nhận thêm khóa chống trùng.

## Impact

- Thêm nơi lưu lệnh đăng ký, trạng thái và kết quả, kéo theo migration và hợp đồng đăng ký/thực hiện/tra cứu.
- Đổi chữ ký các lời gọi ghi chính, nên chạm vào cả ports, adapter và tầng nghiệp vụ.
- Cần hợp đồng về thời hạn, kết quả từ chối và request đến muộn; chưa làm job dọn trong đợt này.
- Phạm vi có đổi quy trình khôi phục và phối hợp nhiều máy; không còn coi đây chỉ là một lớp kiểm tra có rủi ro thấp. Phải đặc tả và kiểm thử các cửa sổ lỗi trước khi triển khai.
- Cập nhật `docs/architecture.md`, `docs/data-model.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Hàng đợi thao tác khi ngoại tuyến. `add-offline-data-layer` và nhóm đồng bộ offline đã hoãn ngày 08/09/2026.
- Tự động thử lại khi lỗi mạng. Change này chỉ bảo đảm thử lại là an toàn, không quyết định khi nào thử lại.
- Kiểm đếm/xác nhận đã nhận tiền mặt, điều khiển ngăn kéo tiền và bước đối chiếu tiền mặt bắt buộc.
- Phục hồi delta phiếu bếp theo từng lần gửi; ghi lại cho phần bếp tương lai. Replay không tự in vẫn thuộc UX của change này.
- Thêm/sửa modifier trực tiếp trên món đã được ghi. Giữ luồng chọn modifier khi gọi thêm món; không mở rộng tính năng chỉnh món trong change này.
- Chống trùng cho các thao tác quản trị như sửa thực đơn hay sửa sơ đồ, trừ khi được chốt ở câu hỏi số 4.

## Phụ thuộc

- **Cập nhật 08/09/2026:** không còn tuyên bố không có phụ thuộc. Để đạt yêu cầu server xác minh quyền người thực hiện, cần nền tảng danh tính nhân viên phía server liên quan `enforce-permissions-at-database`. Phải xác định phần tối thiểu cho register/execute/cancel/read trước khi duyệt contract; không tự kéo toàn bộ việc siết quyền mọi module vào change này.
- Lỗ hổng version `NULL` phải được sửa trước khi nghiệm thu bảo đảm OCC; có thể là thay đổi riêng nhưng là điều kiện tiên quyết, không phải ghi chú tùy chọn.
- Nên làm **trước** `add-offline-data-layer`. Hàng đợi ngoại tuyến gửi lại thao tác theo đúng nghĩa đen, nên nếu chưa có bảo đảm này thì mọi lần gửi lại đều có nguy cơ sinh trùng.
- Phối hợp chữ ký RPC, quyền DML/helper và danh tính server với `enforce-permissions-at-database`; không giữ thứ tự cũ “chống trùng luôn làm trước xác thực” nếu thứ tự đó khiến bảo đảm quyền không thực hiện được.

## Câu hỏi phải chốt trước khi làm

Các câu 1–7 bên dưới là danh sách gốc. Cập nhật 09/09/2026: nguyên tắc server, tiếp quản, tiền mặt, giá, khôi phục và phạm vi bếp đã có câu trả lời; thời hạn/hủy do analyst quyết định theo ủy quyền tại tài liệu 10. Modifier chỉ chọn khi thêm món; không còn điểm chặn nghiệp vụ chỉnh modifier phần cũ. Những phần cần cụ thể hóa khi chuẩn bị bộ spec là hợp đồng định danh nhân viên server, giữ nguồn gốc giá từng phần thêm và bảng input/output/lỗi/test tương ứng. Không coi các thông số kỹ thuật hoặc gợi ý UX chưa duyệt là quyết định mới của chủ dự án.

1. Khóa chống trùng sinh ở tầng nào? Sinh ở tầng nghiệp vụ khi người dùng xác nhận là đúng nhất về mặt ngữ nghĩa, nhưng phải bảo đảm nó sống sót qua việc thành phần giao diện bị dựng lại.
2. Khi gặp khóa đã áp dụng, máy chủ trả về nguyên văn kết quả lần đầu, hay chỉ báo đã áp dụng và để client tự tải lại? Trả nguyên văn thì client không phải xử lý thêm nhánh nào, nhưng phải lưu kết quả.
3. Giữ khóa đã áp dụng bao lâu? Đủ dài để phủ mọi lần thử lại hợp lý, đủ ngắn để bảng không phình. Nếu sau này làm ngoại tuyến thì thời hạn này phải dài hơn thời gian một thiết bị có thể ngoại tuyến.
4. Áp cho những lời gọi nào? Tối thiểu là ba lời gọi đụng tiền là gửi đơn, thanh toán và hủy đơn. Có mở rộng sang các thao tác quản trị không?
5. Đã từng phát sinh bản ghi trùng trên dữ liệu thật chưa? Cần một truy vấn kiểm tra trước khi làm, vì kết quả đổi mức ưu tiên của change này.
6. Sau khi có bảo đảm này, có bật tự động thử lại cho các lời gọi ghi không, hay vẫn để người dùng chủ động bấm lại?
7. Lần gửi lặp có ghi vào nhật ký không? Ghi thì phát hiện được vấn đề mạng, nhưng thêm ghi cho một việc vốn không có tác dụng gì.

## Quyết định đã chốt

### Chốt ngày 09/09/2026 — modifier chọn lúc thêm món

- Giữ luồng thêm món rồi chọn modifier, không bổ sung chỉnh modifier phần đã ghi. Chủ dự án đã làm rõ, code UI đã được kiểm để đối chiếu; bằng chứng tại 12, mục 7.
- Server đã ghi A ×2 giá 30.000đ; menu thành 40.000đ; thêm một A với modifier 0đ cho tổng 100.000đ. Giữ giá/cấu hình phần cũ và ghi phần gọi mới theo giá mới.
- Đóng câu hỏi giá khi sửa modifier cũ bằng cách loại thao tác ngoài phạm vi, không chọn một trong hai đề xuất sai phạm vi. Không còn yêu cầu người dùng trả lời câu này trước khi hoàn thiện bộ spec.

### Chuẩn bị rà cuối ngày 08/09/2026

- Chủ dự án xác nhận quy tắc giá/phân biệt dòng tại phần đầu proposal. Không mở lại câu 30.000đ + 35.000đ = 65.000đ hoặc việc tiếp quản theo quyền/online/tiền mặt/24 giờ đã chốt.
- Analyst chọn so sánh nội dung register theo cấu trúc JSON sau kiểm kiểu: key object không có thứ tự, mảng có thứ tự, trường vắng khác null. Không cần suy đoán hai payload khác nhau là cùng ý định. Actor/credential của người đang gọi thuộc ngữ cảnh xác thực, không nằm trong nội dung nghiệp vụ dùng so sánh để cản người khác tiếp quản. Bảng schema chính thức vẫn phải xác định rõ các trường bắt buộc và nullable.
- Giữ nhánh full/split hiện hành: UI chọn toàn bộ thì lập pay_order trước register; RPC split nhận toàn bộ thì từ chối INVALID_ORDER_ITEMS. Trích mã ở tài liệu 12. Replay lệnh split không bao giờ tự rẽ sang pay_order theo dữ liệu mới.
- Lịch sử ngày 08/09: ca sửa size/topping phần cũ từng được đánh dấu còn mở. **Đã đóng ngày 09/09 bằng chốt phạm vi ở trên**, không còn cản việc viết bộ spec.

### Cập nhật 08/09/2026 sau ba review độc lập

1. Server là nguồn tin cậy duy nhất. Chỉ công bố tạo đơn thành công sau khi server ghi nhận; register chưa execute chưa tạo thành đơn. Timeout không chứng minh thất bại; UI vẫn có trạng thái kỹ thuật chưa xác định để tra server.
2. Ai đủ quyền nghiệp vụ hiện hành đều được tiếp tục việc người khác. Không thêm điều kiện chỉ quản lý, người tạo còn đăng nhập hoặc người tạo đã hết ca. Server phải xác minh danh tính người thực hiện, không chỉ đọc role theo ID client gửi.
3. Bỏ đề xuất bắt đối chiếu tiền mặt. Phần mềm ghi giao dịch và lịch sử; con người chịu trách nhiệm tiền thực tế. Người tạo đơn và người ghi payment được lưu riêng; replay không thay người đã ghi thành công.
4. Giữ giá theo từng lần gọi: phần cũ giữ giá đã ghi, phần mới lấy giá mới; ví dụ 30.000đ + 35.000đ = 65.000đ. Cần giữ nguồn gốc phần món, không replace toàn đơn rồi tính lại giá cũ bằng menu hiện tại.
5. Khôi phục từ đơn/lệnh/kết quả đã lưu trên server. Không tự gộp hai lệnh giống nhau hoặc cam kết phục hồi nội dung chưa tới server.
6. Phục hồi phiếu bếp theo lần gửi không thuộc phạm vi hiện tại; ghi lại cho phần bếp. Không tự in do replay/reconnect.
7. **Theo ủy quyền:** lệnh chưa execute có hiệu lực 24 giờ kể từ đăng ký server đầu tiên; retry không gia hạn; kết quả applied cũ vẫn được tra/replay sau hạn. Không tự xóa mã/nội dung/kết quả trong bản đồ án.
8. **Theo ủy quyền:** hủy lệnh đã đăng ký và chưa thực hiện bằng trạng thái bền vững; server phân xử cancel/execute. Không tìm thấy lệnh không đồng nghĩa đã hủy. Hết hạn/hủy lệnh không tự void đơn hoặc hoàn tiền.

Lý do, lựa chọn bị loại, nguồn tham khảo giá và testcase cập nhật nằm trong [tài liệu 10](../../../docs/reviews/2026-09-07-idempotency/10-quyet-dinh-sau-review-va-chinh-sach-gia.md).

### Lịch sử quyết định ngày 07/09/2026

Ghi ngày 2026-09-07. Đánh số theo câu hỏi ở mục trên. Câu 1, 2, 3 còn đang trao đổi thêm.

**Phần Why giữ nguyên. Một đính chính ghi ngày 2026-09-07 đã bị rút lại cùng ngày.**

Ngày 2026-09-07, sau khi rà mã, mục này từng ghi rằng phần Why "nói quá" vì đường dẫn tới bản ghi thanh toán trùng đã bị khóa lạc quan chặn. **Đính chính đó sai và đã được rút.**

Một AI độc lập rà lại cùng ngày và chỉ ra ca sau, đã kiểm chứng lại bằng mã:

1. Đơn có 5 ly, `lock_version = 5`. Thu ngân chọn trả 1 ly qua `pay_order_items`.
2. Máy chủ tách và ghi thanh toán. Đơn nguồn còn 4 ly, version thành 6. **Phản hồi bị mất.**
3. Polling 5 giây kéo về version 6.
4. Giao diện **giữ lại lựa chọn**: `src/app/drawers/pos/PaymentDrawer.tsx:51-60` kẹp lựa chọn về dữ liệu mới chứ không xóa.
5. Thu ngân bấm lại. `src/features/pos/orderFlow.ts:418-428` sinh **định danh mới** cho `paymentId`, `newOrderId` và `splitItemId`, gửi kèm **version 6 hiện tại**.
6. Version khớp, guard cho qua. Một ly nữa bị tách và thu tiền.

Kết quả: **hai bản ghi thanh toán trên hai đơn tách, cho một ý định thu tiền duy nhất.** Khóa lạc quan không hề bị vi phạm vì version đã tiến hợp lệ — đó chính là lý do nó không cứu được ca này.

Phát biểu gốc của phần Why vì vậy **đúng về bản chất**, chỉ mô tả sai đường dẫn tới hậu quả.

Phân tích đầy đủ, gồm tám lỗi khác đã xác nhận trong bản rà đầu tiên, nằm ở `docs/reviews/2026-09-07-idempotency/04-dinh-chinh-sau-danh-gia.md`.

**Hiện trạng đúng sau khi rà lại hai vòng:**

| Ca | Bị chặn chưa | Bằng chứng |
| --- | --- | --- |
| Gửi lại **nguyên yêu cầu cũ** | **Có** | `items[].id` giữ nguyên, vướng khóa chính `order_items` (`001_schema_enums.sql`) |
| Tạo đơn **tại bàn** | **Có, hai lớp** | Guard "bàn đã có đơn mở" trong `submit_order_changes` (012), cộng chỉ mục duy nhất `orders_store_table_open_idx` (`002_indexes_rls_triggers.sql:70`) |
| `pay_order` bấm lại | **Có** | `status <> 'open'` cộng `lock_version` |
| `void_order` bấm lại | **Có** | `status <> 'paid'` cộng `lock_version` (011:157) |
| **Tạo đơn mang đi, định danh mới sau khi tải lại trang** | **Không** | `table_id` là `null` nên cả guard lẫn chỉ mục đều không áp |
| **`pay_order_items` bấm lại sau khi version đã tiến hợp lệ** | **Không. Thu tiền hai lần** | Xem diễn biến sáu bước ở trên |
| **Gọi RPC trực tiếp với `p_expected_lock_version = NULL`** | **Không. Bỏ qua kiểm phiên bản** | So sánh `lock_version <> NULL` cho `NULL`, `IF` không chạy nhánh từ chối |

Phát biểu đúng, thay cho phát biểu cũ: **gửi lại nguyên yêu cầu cũ thường bị chặn; bấm lại sau khi dữ liệu và định danh đã thay đổi vẫn lặp được nghiệp vụ, và ca nặng nhất là tách đơn thanh toán hai lần.**

Lỗ hổng `NULL` ở dòng cuối bảng là **vấn đề độc lập với idempotency**. Cập nhật 08/09/2026: nếu xử lý bằng thay đổi riêng thì vẫn phải là phụ thuộc bắt buộc trước nghiệm thu OCC của change này.

**4. Áp khóa cho bốn lời gọi: `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`.** Chốt 2026-09-07.

Ba phương án đã cân nhắc:

| | Phạm vi | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Ba lời gọi tiền | **Loại.** Bỏ sót `void_order`, mà hủy đơn đã thanh toán cũng là thao tác đụng tiền |
| b | Bốn lời gọi trên | **Chọn.** Toàn bộ nhóm đụng tiền và đụng trạng thái đơn — ranh giới tự nhiên, không phải con số chọn bừa |
| c | Thêm cả thao tác quản trị | **Loại.** Thừa, xem lý do bên dưới |

Lý do loại c, **đã sửa ngày 2026-09-07 sau đánh giá độc lập**: giới hạn phạm vi change, **không phải** vì thao tác quản trị đã tự an toàn.

Lý do cũ ghi rằng chúng tự an toàn nhờ mọi kiểu `*Create` mang sẵn `id` do client sinh. **Điều đó không đủ.** `src/adapters/supabase/menuRepo.ts:51` cho thấy `saveMenuChanges` thực hiện **nhiều request nối tiếp**, không phải một giao dịch: tạo category xong mà tạo món hỏng, thì gửi lại nguyên changeset sẽ lỗi trùng khóa ở phần đã xong **trước khi** tới phần chưa xong.

Nguyên tắc phân loại, **đã sửa ngày 2026-09-07 sau đánh giá vòng hai**. Một thao tác cần khóa nếu thỏa **ít nhất một** trong hai điều kiện:

1. **Nó không bình thường hóa** — làm hai lần cho kết quả khác làm một lần. Đặt thực đơn thành trạng thái X thì làm mười lần vẫn ra X; tạo một đơn thì làm hai lần ra hai đơn.
2. **Caller cần xác nhận kết quả** — sau khi mất phản hồi, người dùng phải biết được lần gửi trước đã thành công hay chưa, và hệ phải trả lời được câu đó mà không thực hiện lại.

Lý do sửa: nguyên tắc cũ chỉ có điều kiện 1, nên nó **mâu thuẫn với chính lý do giữ `void_order`** ghi ngay dưới đây. Điều kiện 2 là thứ làm hai đoạn nhất quán, và nó cũng đúng với bản chất bài toán — khóa chống trùng sinh ra để trả lời "việc này xong chưa", không chỉ để chặn ghi thừa.

Riêng `void_order`: hủy một đơn đã hủy vẫn ra trạng thái đã hủy, nên **về mặt trạng thái nó đã bình thường hóa**. Nó vào phạm vi theo điều kiện 2, không theo điều kiện 1.

Lý do giữ nó trong phạm vi, **đã sửa ngày 2026-09-07**: sau khi mất phản hồi, caller **cần xác nhận thao tác hủy trước đã thành công hay chưa**.

Lý do cũ ghi rằng gọi hai lần sinh dấu vết kiểm toán rác. **Sai với mã**: lần gọi thứ hai bị guard trạng thái chặn **trước khi** cập nhật các trường kiểm toán (`011_void_paid_order.sql:157`).

**6. Không bật tự động thử lại. Giữ người dùng chủ động bấm lại.** Chốt 2026-09-07.

Hiện `src/app/AppProviders.tsx:31-36` đặt `retry: false` **trong khối `queries`**; không có khối `mutations`, nên các lời gọi ghi chạy theo mặc định của TanStack Query, vốn cũng không thử lại mutation. Quyết định này giữ nguyên trạng đó.

**Đính chính bổ sung 08/09/2026:** đoạn trên chỉ đúng cho retry sau lỗi. Thư viện đang cài có thể pause lần gửi đầu khi offline rồi tự resume khi online/focus; đã đọc body và chạy probe, xem [08, E1](../../../docs/reviews/2026-09-07-idempotency/08-review-doc-lap-plan-07.md#e1--mutation-co-the-tu-chay-khi-mang-tro-lai). Vì vậy không thể chỉ “giữ nguyên hiện trạng”: spec phải chặn tự tiếp tục lệnh ghi bị pause, ngoài việc không bật retry sau lỗi.

*(Sửa ngày 2026-09-07: bản cũ suy từ `queries.retry: false` ra "hệ đang không tự thử lại gì cả". Kết luận về hành vi vẫn đúng, nhưng nó đúng nhờ mặc định của thư viện chứ không nhờ dòng cấu hình đó — và nếu sau này có ai đặt `mutations.retry`, dòng cấu hình kia sẽ không cản.)*

| | Phương án | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Không tự động, người dùng bấm lại | **Chọn** |
| b | Tự động thử lại vài lần cho lỗi mạng | **Loại.** Phải phân biệt được lỗi mạng với lỗi nghiệp vụ; thử lại một `PAYMENT_AMOUNT_TOO_LOW` là vô nghĩa và làm chậm phản hồi |
| c | Đẩy sang change riêng | **Loại.** Không cần một change để nói "giữ nguyên hiện trạng" |

Lý do chọn a: bật tự động thử lại là thêm một hành vi **chạy ngầm vào đúng luồng tiền**, trong tuần đang trễ lịch. Và vấn đề gốc đã được giải rồi — có khóa chống trùng thì việc bấm lại thủ công không còn nguy hiểm nữa; phần còn lại chỉ là tiện lợi, không phải đúng sai.

Ranh giới giữ nguyên như mục "Ngoài phạm vi" đang ghi: change này bảo đảm **thử lại là an toàn**, không quyết định **khi nào thử lại**.

**7. Có ghi nhật ký lần gửi lặp, nhưng chỉ đếm.** Chốt 2026-09-07.

Một cột đếm số lần lặp trên chính hàng khóa, không sinh bản ghi riêng cho mỗi lần lặp. Đủ để biết mạng có vấn đề mà không đẻ thêm bảng, và không biến một việc vốn không có tác dụng gì thành một dòng ghi mới.

**5. Chưa từng phát sinh bản ghi trùng trên dữ liệu thật.** Chốt 2026-09-07.

Chủ dự án xác nhận: hệ chưa được dùng thật và chưa có kiểm thử tải, nên chưa có dữ liệu vận hành để đối chiếu. **Cập nhật 08/09/2026:** ưu tiên change vì tính đúng đắn và khả năng phục hồi trong vận hành online; không còn dựa vào lịch offline tuần 11–13.
