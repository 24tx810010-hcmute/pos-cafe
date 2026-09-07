# 05 — Nhờ đánh giá vòng hai

> **ĐÃ CÓ TRẢ LỜI — xem [06-ket-qua-vong-hai.md](06-ket-qua-vong-hai.md).**
> Cả ba khẳng định 1a/1b/1c được xác nhận đúng; vòng hai tìm thêm hai chỗ sai và
> đã trả lời câu *"cùng một thao tác là gì"*.

Lập ngày 07/09/2026, ngay sau khi tiếp thu vòng một.

## Vòng một đã cho kết quả gì

Bạn rà tập tài liệu ở `a880e9e` và tìm ra **tám lỗi**, ba trong số đó làm sai kết luận trung tâm. **Toàn bộ đã được kiểm lại độc lập bằng cách đọc mã và xác nhận là đúng.** Chi tiết ở [04-dinh-chinh-sau-danh-gia.md](04-dinh-chinh-sau-danh-gia.md).

Nặng nhất: tập tài liệu từng khẳng định phần Why của proposal "nói quá" khi nói có thể sinh hai bản ghi thanh toán cho một lần thu tiền. **Chính khẳng định đó mới sai** — ca `pay_order_items` bạn chỉ ra là thật.

Đã sửa: thêm tài liệu `04`, đánh dấu lỗi tại chỗ trong `01` `02` `03` thay vì sửa lén, và gỡ đính chính sai khỏi `proposal.md`.

## Vòng hai xin bạn làm hai việc

### Việc 1 — Kiểm xem bản sửa có sinh lỗi mới không

Vòng một cho thấy cách rà của tôi có một kiểu sai lặp lại: **tìm kiếm sai phạm vi rồi kết luận là không tồn tại**. Chỉ mục duy nhất nằm ở `002` mà tôi chỉ tìm trong `001`; `paymentId` được truyền ở `orderFlow.ts` mà tôi chỉ tìm trong `useOrderPaymentFlow.ts` và các drawer.

Bản sửa ở tài liệu `04` được viết bởi cùng người mắc kiểu sai đó. Xin bạn kiểm **chính bản sửa**, đặc biệt ba khẳng định sau:

**1a.** Diễn biến sáu bước của ca `pay_order_items` thu tiền hai lần có đúng từng bước không? Tôi đã kiểm thêm `clampSelection` (`orderFlow.ts:355-362`):

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

Suy luận của tôi: nếu 5 ly là **một dòng** số lượng 5, thì sau khi tách 1 ly dòng nguồn giữ **nguyên `orderItemId`** với số lượng còn 4. Clamp cho `min(1, 4) = 1`, tức **lựa chọn sống nguyên vẹn**. Suy luận này có đúng không, hay việc tách sinh ra `orderItemId` mới cho phần còn lại?

**1b.** Nhánh còn lại của cùng effect (`PaymentDrawer.tsx:58`) là:

```tsx
return Object.keys(next).length > 0 ? next : fullSelection(payableLines);
```

Tức nếu clamp cho rỗng thì **quay về chọn tất cả**. Theo tôi hiểu thì đây là kết cục **tệ hơn**: lần bấm lại sẽ thanh toán toàn bộ phần còn lại thay vì 1 ly. Và vì `isFullSelection` cho `true`, flow còn **rẽ sang `payOrder`** thay vì `payOrderItems` (`orderFlow.ts:368`). Cách đọc này có đúng không?

**1c.** Kết luận "đơn mang đi không được bảo vệ": guard `Table already has an open order` chỉ chạy `if p_table_id is not null`, và chỉ mục `orders_store_table_open_idx` có `where ... and table_id is not null`. Nên với đơn mang đi thì **cả hai đều không áp**. Có lớp bảo vệ nào khác cho đơn mang đi mà tôi lại bỏ sót lần nữa không?

### Việc 2 — Một mâu thuẫn mới lộ ra từ chính bốn điều kiện của bạn

Bạn nêu bốn điều kiện phải ghi vào thiết kế, trong đó điều kiện 2 là: **cùng khóa nhưng khác payload thì bị từ chối.**

Điều kiện đó hợp lý, nhưng nó **va vào** ca `pay_order_items` ở trên:

1. Thu ngân xác nhận ý định "trả 1 ly". Khóa `K` sinh ra ở thời điểm đó, payload dựa trên đơn 5 ly, version 5.
2. Phản hồi mất. Polling kéo về version 6, đơn còn 4 ly.
3. Thu ngân bấm lại. Nếu khóa `K` sống sót được thì payload lần này **đã khác**: version 6, ngữ cảnh 4 ly, và các `splitItemId` mới.
4. Theo điều kiện 2, máy chủ **từ chối** vì cùng khóa khác payload.

Nhưng đây lại chính là ca mà khóa chống trùng sinh ra để giải. Từ chối thì thu ngân thấy lỗi và vẫn không biết tiền đã vào chưa — tức quay về đúng vấn đề ban đầu.

**Câu hỏi cho vòng hai:** trong ca này, đâu là "cùng một thao tác"?

- Nếu tính theo **ý định người dùng** ("trả 1 ly") thì hai lần bấm là một thao tác, và máy chủ nên phát lại kết quả lần đầu.
- Nếu tính theo **payload** thì chúng khác nhau, và điều kiện 2 bắt phải từ chối.
- Nếu khóa được sinh lại ở lần bấm thứ hai thì chúng là hai thao tác khác nhau, và ta có ca thu tiền hai lần.

Ba cách đọc dẫn tới ba hành vi khác nhau. Xin bạn cho biết cách nào đúng, và **khóa nên gắn với cái gì** để cách đọc đó thực hiện được: gắn với ý định người dùng, với payload chuẩn hóa, hay với một khái niệm khác?

Đây là câu tôi cho là quan trọng nhất còn lại, vì nó quyết định luôn câu A trong tài liệu `03` — cần lưu bền cái gì để khôi phục một thao tác đang chờ.

## Ba câu cũ vẫn mở, tiền đề đã đổi

[03-ba-cau-dang-mo.md](03-ba-cau-dang-mo.md) có ba câu, cả ba đã bị vòng một bác một phần:

| Câu | Trạng thái sau vòng một |
| --- | --- |
| A — khóa giữ ở đâu | Chỉ giữ chuỗi khóa là **chưa đủ**; cần đủ ngữ cảnh khôi phục thao tác. Chưa biết "đủ" là gồm những gì |
| B — máy chủ trả gì khi gặp khóa cũ | Kết luận A giữ được, nhưng **lập luận phải viết lại** quanh việc khôi phục kết quả thao tác lịch sử |
| C — giữ bao lâu, dọn thế nào | Bốn ràng buộc **đặt trọng tâm sai chỗ**; chưa quy định thao tác quá hạn khóa thì xử lý ra sao |

Nếu vòng hai có kết luận cho việc 2 ở trên thì câu A gần như được quyết theo.

## Một vấn đề độc lập, xin ý kiến về mức ưu tiên

Lỗ hổng `NULL` bạn phát hiện — truyền `p_expected_lock_version = NULL` làm biểu thức so sánh cho `NULL`, `IF` không chạy nhánh từ chối, kiểm phiên bản bị bỏ qua hoàn toàn.

Nó **không thuộc phạm vi** change chống trùng. Dự định tách thành một change riêng.

Xin bạn cho biết: đây là lỗi **cần sửa ngay** vì đụng luồng tiền, hay chấp nhận được trong bối cảnh giao diện luôn truyền số và hệ chưa mở cho ai gọi RPC trực tiếp? Bối cảnh: đây là đồ án tốt nghiệp, hạn 21/12/2026, và tuần hiện tại đã trễ lịch.

## Bối cảnh để bạn cân nhắc mức độ

- Đồ án tốt nghiệp, không phải sản phẩm thương mại. Hạn 21/12/2026, còn khoảng 15 tuần.
- Hệ **chưa từng chạy thật**, chưa có người dùng, chưa có dữ liệu vận hành.
- Không có ngân sách tiền; mọi dịch vụ dùng gói miễn phí.
- Change này nằm ở tuần 2 và **đã trễ hạn chốt câu hỏi**.
- Nó là nền bắt buộc cho nhóm chế độ ngoại tuyến ở tuần 11–13, vì gửi lại hàng đợi chính là gửi trùng có chủ ý.

Xin bạn nói rõ nếu đề xuất nào của bạn vượt quá mức mà bối cảnh này cần.
