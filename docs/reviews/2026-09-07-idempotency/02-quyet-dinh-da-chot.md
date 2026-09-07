# 02 — Bốn quyết định đã chốt

Chốt ngày 07/09/2026. Mỗi quyết định ghi kèm phương án bị loại và lý do loại, để người đánh giá kiểm được lập luận chứ không chỉ kiểm kết luận.

Bằng chứng mã nguồn cho mọi khẳng định ở đây nằm ở [01-hien-trang-va-bang-chung.md](01-hien-trang-va-bang-chung.md).

---

## Quyết định 4 — Áp khóa cho bốn lời gọi

**Chốt:** `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`.

| | Phạm vi | Kết luận |
| --- | --- | --- |
| a | Ba lời gọi tiền, bỏ `void_order` | **Loại.** Hủy đơn đã thanh toán cũng là thao tác đụng tiền |
| b | Bốn lời gọi trên | **Chọn** |
| c | Thêm cả thao tác quản trị | **Loại.** Xem lý do bên dưới |

### Nguyên tắc phân loại

Chỉ thao tác **không bình thường hóa** mới cần khóa.

- *Đặt thực đơn thành trạng thái X* — làm mười lần vẫn ra X. Tự nó đã an toàn.
- *Tạo một đơn* — làm hai lần ra hai đơn. Không an toàn.

### Vì sao loại thao tác quản trị

Mọi kiểu `*Create` trong `src/domain/changes.ts` mang sẵn `id` do client sinh (trích đoạn ở tài liệu `01` mục 7). Gửi lại cùng một changeset là ghi lại cùng khóa chính, nên không sinh bản ghi trùng. Chúng đã bình thường hóa sẵn nhờ thiết kế định danh, không phải nhờ may mắn.

### Chỗ lập luận yếu, tự nhận

`void_order` **về mặt trạng thái đã bình thường hóa**: hủy một đơn đã hủy vẫn ra trạng thái đã hủy. Theo đúng nguyên tắc trên thì lẽ ra nó không cần khóa.

Nó vẫn nằm trong phạm vi vì hai lý do **khác** với lý do của ba cái kia:

1. Nó ghi **dấu vết kiểm toán** gồm người hủy, thời điểm và lý do. Gọi hai lần thì dấu vết thứ hai là rác.
2. Nó đụng **số liệu tiền hủy** trong báo cáo đối soát.

**Xin người đánh giá xét:** hai lý do này có đủ mạnh để đưa `void_order` vào phạm vi không, hay đó là mở rộng phạm vi không cần thiết? Và nếu chúng đủ mạnh, thì có thao tác nào khác cũng ghi dấu vết kiểm toán mà đang bị bỏ sót không?

---

## Quyết định 5 — Chưa từng phát sinh bản ghi trùng trên dữ liệu thật

**Chốt:** chưa từng, vì hệ chưa được dùng thật và chưa có kiểm thử tải.

Đây là **giả định của chủ dự án, chưa phải kết quả truy vấn**. Hai truy vấn kiểm chứng đã được soạn nhưng **chưa chạy**:

```sql
select order_id, count(*) from public.payments
group by order_id having count(*) > 1;

select store_id, table_id, date_trunc('second', created_at) as giay, count(*)
from public.orders where table_id is not null
group by 1,2,3 having count(*) > 1 order by 4 desc limit 20;
```

Kết luận này **không làm giảm mức ưu tiên của change**, vì nó là nền bắt buộc cho nhóm ngoại tuyến ở tuần 11–13: gửi lại hàng đợi chính là gửi trùng có chủ ý.

**Xin người đánh giá xét:** truy vấn thứ hai có bắt đúng dấu vết "bấm lại tạo đơn trùng" không? Nhóm theo giây có quá hẹp hoặc quá rộng không?

---

## Quyết định 6 — Không bật tự động thử lại

**Chốt:** giữ người dùng chủ động bấm lại. Hiện `AppProviders.tsx` đặt `retry: false`, quyết định này giữ nguyên trạng đó.

| | Phương án | Kết luận |
| --- | --- | --- |
| a | Không tự động | **Chọn** |
| b | Tự động thử lại vài lần cho lỗi mạng | **Loại.** Phải phân biệt được lỗi mạng với lỗi nghiệp vụ; thử lại một `PAYMENT_AMOUNT_TOO_LOW` là vô nghĩa và làm chậm phản hồi |
| c | Đẩy sang change riêng | **Loại.** Không cần một change để nói "giữ nguyên hiện trạng" |

**Lý do chọn a:** bật tự động thử lại là thêm một hành vi **chạy ngầm vào đúng luồng tiền**, trong một tuần đã trễ lịch. Và vấn đề gốc đã được giải — có khóa chống trùng thì bấm lại thủ công không còn nguy hiểm; phần còn lại chỉ là tiện lợi.

Ranh giới giữ nguyên: change này bảo đảm **thử lại là an toàn**, không quyết định **khi nào thử lại**.

**Xin người đánh giá xét:** có tình huống nào mà việc *không* tự thử lại gây hại thật, chứ không chỉ bất tiện? Ví dụ mạng rớt đúng lúc thu ngân đã rời máy.

---

## Quyết định 7 — Ghi nhật ký lần gửi lặp, nhưng chỉ đếm

**Chốt:** một cột đếm số lần lặp trên chính hàng khóa. Không sinh bản ghi riêng cho mỗi lần lặp.

Đủ để phát hiện mạng có vấn đề, mà không đẻ thêm bảng và không biến một việc vốn không có tác dụng gì thành một dòng ghi mới.

**Chỗ chưa nghĩ hết, tự nhận:** cột đếm cho biết *có bao nhiêu lần lặp* nhưng không cho biết *khi nào*. Nếu muốn phát hiện "mạng hỏng vào giờ cao điểm" thì cần thêm mốc thời gian lần lặp gần nhất. Chưa quyết có thêm hay không.

---

## Đính chính đã ghi vào proposal

Phần Why của `proposal.md` gốc viết rằng hậu quả là *"hai bản ghi thanh toán cho một lần thu tiền, kéo theo doanh thu sai"*.

Theo phân tích ở tài liệu `01`, phát biểu đó **nói quá**: đường dẫn tới bản ghi thanh toán trùng đã bị khóa lạc quan chặn. Hại thật là **sai dữ liệu chỉ ở luồng tạo đơn mới**, còn ba luồng kia là **trải nghiệm tệ**.

Đính chính này đã được ghi vào đầu mục `## Quyết định đã chốt` của proposal, kèm bảng bằng chứng.

**Xin người đánh giá xét:** đính chính này có đúng không? Nếu phân tích ở tài liệu `01` sai ở một chỗ nào đó thì đính chính này cũng sai, và mức ưu tiên của change phải xét lại.
