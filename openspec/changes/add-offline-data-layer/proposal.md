# Tầng dữ liệu cục bộ cho chế độ ngoại tuyến

> **HOÃN — 08/09/2026.** Chủ dự án ưu tiên online; không triển khai bán hàng offline hoặc hàng đợi cục bộ trong phạm vi hiện tại. Quyết định này thay thế việc đưa offline vào giai đoạn 1 ngày 30/08. Giữ nội dung bên dưới làm lịch sử đề xuất, không coi các quyết định/lịch cũ là cam kết triển khai. Xem [quyết định mới](../../../docs/reviews/2026-09-07-idempotency/07-uu-tien-online-va-khoi-phuc-tren-server.md).

## Why

Hệ thống hiện là online-only: mất mạng thì không bán được hàng. Với một quán cà phê thật, đây là lỗi nghiêm trọng, vì mạng ở quán hay rớt và quán không thể ngừng bán để chờ mạng. Baseline spec `multi-device-sync` ghi rõ mọi thao tác ghi thất bại khi mất mạng và không có hàng đợi nào lưu lại.

Đây là thay đổi lật lại một quyết định đã chốt. `pos-cafe-context.md` ghi offline-first là hoãn sang mở rộng, và mục ngoài phạm vi của `docs/requirements.md` liệt kê offline-first cùng database cục bộ là chưa làm. FR-21 và NFR-05 cũng viết trên giả định online.

Change này chỉ dựng nền: lưu dữ liệu cục bộ và xếp hàng thao tác. Việc hòa giải xung đột và phần giao diện được tách riêng vì mỗi phần đủ lớn để làm độc lập.

## Ràng buộc từ hiện trạng

Rà soát mã nguồn và migration ngày 2026-08-28 tìm ra năm ràng buộc quyết định mọi phương án. Ghi lại ở đây vì chúng không hiển nhiên từ tài liệu, và bỏ sót một trong số đó là thiết kế sai ngay từ đầu.

**1. Số đơn cũng là số bill, và nó thay đổi được.** Trong luồng tách đơn thanh toán, đơn gốc **bị đổi số** sang số kế tiếp để nhả số cũ cho đơn tách vừa thu tiền. Bàn số 12 trả hai lần thì bill lần một mang số 12, phần còn lại chuyển thành số 13.

Hệ quả cho ngoại tuyến rất nặng: số của một đơn đang mở đổi được **do hành vi của thiết bị khác**. Một máy ngoại tuyến giữ bản sao đơn số 12 có thể thấy nó thành số 13 sau khi nối lại. Nghĩa là ở chế độ ngoại tuyến, ngay cả dữ liệu **đọc** cũng không ổn định, chứ không riêng dữ liệu ghi.

**2. Cấp số là lấy số lớn nhất trong ngày cộng một, dưới khóa phía database**, kèm ràng buộc duy nhất theo cửa hàng và ngày kinh doanh. Hai thiết bị ngoại tuyến cùng tự cấp số thì chắc chắn đụng nhau lúc đồng bộ.

**3. Mọi lời gọi ghi đòi đúng phiên bản khóa lạc quan hiện tại.** Thao tác xếp hàng từ nhiều giờ trước mang phiên bản cũ, nên mọi khác biệt đều biến thành lỗi cần người xử lý chứ không tự hòa giải.

**4. Giá món do database ghi lúc gửi đơn**, không nhận từ client. Ngoại tuyến buộc phải chốt giá từ thực đơn đã lưu cục bộ, nên phải quyết dùng giá lúc ghi hay giá lúc đồng bộ.

**5. Một lần tách đơn thanh toán là giao dịch năm phần**: tạo đơn mới, chèn các dòng món, ghi bản ghi thanh toán, đổi số đơn gốc, cập nhật trạng thái bàn. Phát lại từ hàng đợi phải nguyên tử cả năm phần, không được nửa chừng.

**Điểm sáng:** định danh đơn, dòng món và thanh toán đều là UUID **do client sinh**, không phải chuỗi tăng dần của database. Cộng với ports mỏng và rõ ràng, nền để cắm một adapter cục bộ đã có sẵn mà không phải viết lại tầng tính năng.

## Mô hình đề xuất: hàng đợi ý định một chiều

Không làm theo hướng "cơ sở dữ liệu cục bộ là nguồn sự thật rồi hợp nhất hai chiều". Với dữ liệu tiền bạc, hợp nhất tự động là sai về nguyên tắc: không ai muốn hệ thống tự quyết giùm khi hai thiết bị bất đồng về một khoản tiền.

Tách dữ liệu làm hai loại, xử lý khác nhau:

**Dữ liệu tham chiếu — bản sao chỉ đọc.** Thực đơn, sơ đồ bàn, danh sách nhân viên, quyền. Quán không sửa thực đơn lúc mất mạng nên nhóm này không xung đột; chỉ cần lưu cục bộ và làm mới khi có mạng.

**Thao tác bán hàng — hàng đợi ý định.** Không lưu "trạng thái đơn sau khi sửa" mà lưu **ý định**, ví dụ thêm hai ly cà phê vào đơn X, hoặc tạo đơn mang đi Y gồm các món này. Mỗi ý định mang một khóa chống trùng sinh đúng một lần và giữ nguyên qua mọi lần gửi lại.

Khi có mạng, phát lại tuần tự. **Database vẫn là nơi duy nhất cấp số và chốt tiền**; client chỉ đề nghị.

Ba lý do mô hình này hợp với hệ thống hiện tại:

- Nó **né hẳn bài toán số bill**. Ngoại tuyến không cấp số; số cấp lúc đồng bộ. Ràng buộc duy nhất và việc đổi số đơn gốc vẫn do database lo đúng như hiện nay, không phải viết lại.
- Nó đổi bài toán từ hợp nhất hai chiều thành **phát lại một chiều**, rẻ hơn nhiều bậc và kiểm thử được.
- Ý định dạng cộng dồn thì tự hòa giải được. Thêm hai ly cà phê áp dụng được bất kể ai đã thêm gì trước đó; trong khi đặt đơn thành một trạng thái cụ thể thì không.

Chính điểm cuối quyết định thao tác nào được phép làm khi ngoại tuyến:

| Thao tác | Ngoại tuyến | Lý do |
| --- | --- | --- |
| Tạo đơn mới | Cho | Định danh do client sinh, số cấp lúc đồng bộ |
| Thêm món vào đơn | Cho | Cộng dồn, hòa giải được |
| Sửa số lượng, xóa dòng đã gửi | Không | Không cộng dồn, cần phiên bản khóa lạc quan |
| Thanh toán | Không, ở phạm vi change này | Đụng số bill, tiền và trạng thái bàn cùng lúc |
| Hủy đơn mở, hủy đơn đã thanh toán | Không | Thao tác đụng tiền |
| Mọi thao tác quản trị | Không | Không gấp, không có lý do làm ngoại tuyến |

Bảng này là đề xuất, không phải quyết định. Câu hỏi số 3 ở dưới vẫn để mở việc có cho thanh toán ngoại tuyến hay không, vì đó là ranh giới giữa một tính năng có ích vừa phải và một tính năng có ích thật.

## What Changes

- Thêm kho dữ liệu cục bộ trên thiết bị, giữ đủ dữ liệu để bán hàng khi mất mạng: thực đơn, sơ đồ bàn, nhân viên, quyền và các đơn đang mở.
- Thêm hàng đợi thao tác: khi mất mạng, thao tác ghi được lưu lại thay vì thất bại.
- Đọc dữ liệu ưu tiên từ kho cục bộ, đồng bộ ngầm khi có mạng.
- Gửi lại hàng đợi khi mạng trở lại, đúng thứ tự và không gửi trùng.
- Xác định rõ thao tác nào được phép làm khi ngoại tuyến và thao tác nào bắt buộc phải có mạng.
- Giữ nguyên ranh giới Ports and Adapters: tầng cục bộ là một adapter, không được rò rỉ vào domain và core.

## Capabilities

### New Capabilities

- `offline-data-layer`: kho dữ liệu cục bộ trên thiết bị, hàng đợi thao tác chờ gửi, và quy tắc xác định thao tác nào khả dụng khi ngoại tuyến.

### Modified Capabilities

- `multi-device-sync`: đổi hẳn tuyên bố chỉ hoạt động khi có mạng, và đổi mô hình đồng bộ.
- `order-management`: đổi hành vi khi gửi đơn lúc không có mạng.
- `payment`: đổi hành vi khi thanh toán lúc không có mạng, nếu thanh toán được phép làm ngoại tuyến.

## Impact

- Đây là thay đổi kiến trúc lớn. Nó chạm vào mọi adapter và toàn bộ cách ứng dụng lấy dữ liệu.
- Một số bất biến hiện đang được database bảo đảm sẽ không còn giữ được khi ngoại tuyến: số bill sinh theo thứ tự thanh toán, khóa lạc quan chống ghi đè, và việc chốt giá phía database lúc gửi đơn.
- Có thể phải thêm dependency mới cho kho dữ liệu cục bộ.
- Tăng đáng kể độ phức tạp của việc kiểm thử.
- Cập nhật `pos-cafe-context.md`, `docs/requirements.md` (FR-21, NFR-05, mục ngoài phạm vi), `docs/architecture.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Hòa giải xung đột khi đồng bộ. Việc đó thuộc `add-offline-sync-conflict-resolution`.
- Hiển thị trạng thái mạng và trạng thái đồng bộ cho người dùng. Việc đó thuộc `add-offline-status-ux`.
- Đồng bộ trực tiếp giữa các thiết bị trong quán mà không qua máy chủ.
- Làm việc ngoại tuyến cho các module quản trị.

## Phụ thuộc

- `add-idempotent-write-operations`: **bắt buộc làm trước.** Phát lại hàng đợi chính là gửi trùng có chủ ý; không có khóa chống trùng thì mọi lần gửi lại đều có nguy cơ sinh thêm bản ghi.
- `add-offline-status-ux`: phần hiển thị trạng thái mạng ở mức tối thiểu làm được **trước** change này và độc lập với nó; xem ghi chú trong proposal đó.
- `expand-e2e-coverage`: rất nên có trước, vì change này viết lại cách toàn bộ ứng dụng lấy dữ liệu.

## Câu hỏi phải chốt trước khi làm

1. Đây là tính năng cần làm thật, hay chỉ cần phân tích thiết kế cho báo cáo? Phạm vi rất lớn và rủi ro cao, cần chốt trước khi bỏ công.
2. Nếu làm thật thì mục tiêu tối thiểu là gì: chỉ cần đọc được thực đơn và sơ đồ khi mất mạng, hay phải bán và thanh toán được đầy đủ?
3. Thanh toán có được phép làm ngoại tuyến không? Đây là câu hỏi khó nhất. Cho phép thì có nguy cơ hai máy cùng thu tiền một bàn; không cho phép thì tính năng ngoại tuyến mất phần lớn giá trị.
4. Số bill xử lý thế nào khi ngoại tuyến? Hiện số bill tăng theo thứ tự thanh toán và do database sinh. Ngoại tuyến thì thiết bị không biết số kế tiếp là bao nhiêu.
5. Dữ liệu cục bộ lưu ở đâu, và chấp nhận rủi ro gì? Dữ liệu bán hàng chưa gửi mà nằm trên trình duyệt thì xóa dữ liệu trình duyệt là mất tiền thật.
6. Giữ dữ liệu cục bộ bao lâu, và giới hạn dung lượng thế nào?
7. Có chấp nhận thêm dependency mới không?
8. Ngoại tuyến áp dụng cho toàn bộ ứng dụng hay chỉ cho luồng bán hàng? Các module quản trị có thể để nguyên yêu cầu có mạng.
9. Nhiều thiết bị cùng ngoại tuyến trong cùng một quán thì có cần thấy nhau không? Nếu có thì đây là bài toán khác hẳn và lớn hơn nhiều.
10. Ý định tạo lúc ngoại tuyến rồi đồng bộ sau khi ngày kinh doanh đã sang ngày mới thì ghi vào ngày nào? Ngày lúc thao tác thì báo cáo đúng nghiệp vụ nhưng phải ghi lùi; ngày lúc đồng bộ thì đơn giản nhưng doanh thu sai ngày.
11. Đơn ngoại tuyến trỏ tới một món hoặc một bàn đã bị xóa trong lúc thiết bị mất mạng thì xử lý thế nào?
12. Nhân viên bị tạm khóa hoặc bị gỡ quyền trong lúc thiết bị ngoại tuyến thì các ý định họ tạo trước đó có được áp dụng không?
13. Đăng nhập lúc ngoại tuyến bằng cách nào? Hiện PIN được so khớp phía database, nên ngoại tuyến hoặc phải lưu bản băm cục bộ, hoặc phải chấp nhận không đổi được người trực khi mất mạng.
14. Giới hạn thời gian ngoại tuyến tối đa là bao lâu trước khi ứng dụng từ chối nhận thêm thao tác? Không có giới hạn thì hàng đợi có thể phình tới mức không hòa giải nổi.

## Quyết định đã chốt

**1. Làm thật, không dừng ở phân tích thiết kế.** Chốt 2026-08-30.

Quyết định online-only là **hoãn theo ngân sách thời gian** của bài tiểu luận chuyên ngành, không phải một lựa chọn kiến trúc: làm hybrid tốn thời gian viết và thời gian kiểm thử, mà lúc đó không đủ. `docs/requirements.md` đã ghi đúng như vậy khi đặt "Offline-first/local database" dưới mục "Ngoài Phạm Vi Hoặc Hoãn", kèm câu "không được tính là thiếu so với baseline tiểu luận hiện tại".

Đồ án tốt nghiệp có ngân sách 16 tuần nên ràng buộc đó không còn. Vì vậy đây là **gỡ một khoản hoãn**, không phải lật một quyết định thiết kế.

Hệ quả cho tài liệu:

- FR-21 và NFR-05 nói về đồng bộ giữa nhiều thiết bị khi online. Vẫn đúng, không phải sửa.
- `openspec/specs/multi-device-sync/spec.md` yêu cầu "MUST NOT tuyên bố hỗ trợ làm việc ngoại tuyến" sẽ đổi khi change này được archive. Đó là luồng bình thường của OpenSpec, không phải mâu thuẫn.
- Mục "Change lật lại quyết định đã chốt" trong `openspec/README.md` đang xếp change này chung với các change thật sự lật quyết định. Đã ghi chú lại cho đúng.

**2. Mục tiêu tối thiểu: nhận đơn mới khi mất mạng, không thanh toán.** Chốt 2026-08-30.

Cho phép khi ngoại tuyến:

- Đọc thực đơn, sơ đồ bàn, danh sách nhân viên và quyền từ bản sao cục bộ.
- Tạo đơn mới.
- Thêm món vào đơn **được tạo lúc ngoại tuyến và chưa đồng bộ**.

Không cho phép:

- Sửa số lượng hoặc xóa dòng của đơn **đã tồn tại trên máy chủ**.
- Thanh toán, hủy đơn mở, hủy đơn đã thanh toán.
- Mọi thao tác quản trị.

Cơ sở kỹ thuật, đo trên kho mã ngày 2026-08-30: `submit_order_changes` nhận `p_order_id` là UUID do client sinh (`src/adapters/supabase/orderRepo.ts`), và `p_expected_lock_version` khai kiểu `number | null` (`src/domain/inputs.ts`), đơn mới truyền `null` (`src/features/pos/orderFlow.test.ts`). Migration 012 đã có nhánh `if p_expected_lock_version is not null`. Vì vậy phát lại một đơn mới **không cần phiên bản khóa lạc quan và không phải đổi chữ ký RPC nào**.

Đây là điều kiện giữ danh sách xung đột đủ ngắn để liệt kê hết và kiểm thử hết trong ngân sách ba tuần.

**3. Không cho thanh toán khi ngoại tuyến.** Chốt 2026-08-30.

Cho phép thì thiết bị phải tự cấp số bill lúc ngoại tuyến. Số bill hiện do database cấp dưới khóa theo cửa hàng và ngày kinh doanh, và còn **bị đổi** trong luồng tách đơn thanh toán. Hai thiết bị ngoại tuyến cùng thu tiền là chắc chắn đụng nhau, và đó là mất tiền thật.

Giữ quyết định này thì `pay_order` và `pay_order_items` không bị đụng: trong ba lời gọi tiền, offline chỉ chạm `submit_order_changes`.

**4. Số bill cấp lúc đồng bộ. Database giữ độc quyền cấp số.** Chốt 2026-08-30.

Hệ quả của quyết định 3. Ngoại tuyến không sinh số tạm, nên không có việc đánh số lại lúc đồng bộ, và hóa đơn đã đưa cho khách không bao giờ lệch với hệ thống. Ràng buộc duy nhất theo cửa hàng và ngày kinh doanh giữ nguyên, không phải viết lại.

**5. Kho cục bộ dùng IndexedDB, đặt trong `src/adapters/offline/`.** Chốt 2026-08-30.

Hai bảng: `outbox` chứa hàng đợi ý định có thứ tự, mỗi bản ghi mang khóa chống trùng; `reference` chứa ảnh chụp thực đơn, sơ đồ, nhân viên và quyền.

Không dùng `localStorage`: API đồng bộ chặn main thread, không có transaction nên tab chết giữa lúc ghi làm hỏng dữ liệu, chỉ chứa chuỗi, và giới hạn khoảng 5MB.

Hai luật thiết kế bắt buộc:

1. **Ghi bền trước, cập nhật giao diện sau.** Không bao giờ báo cho nhân viên là đã ghi nhận trước khi ý định nằm trên đĩa.
2. **Không có bước đẩy dữ liệu lúc đóng tab.** Không dựa vào `beforeunload`; sự kiện này không đáng tin và trên thiết bị di động thường không bắn. Đóng tab phải là chuyện không có gì xảy ra, vì không còn gì chỉ sống trong bộ nhớ.

Rủi ro chấp nhận, phải ghi vào `docs/limitations.md`: người dùng xóa dữ liệu duyệt web, mở tab ẩn danh, hoặc đổi máy thì hàng đợi mất hẳn. Không có cách kỹ thuật nào cứu; IndexedDB cũng bị xóa cùng. Giảm nhẹ bằng ba việc: gọi `navigator.storage.persist()` để chặn eviction tự động khi máy thiếu chỗ, giới hạn cửa sổ ngoại tuyến, và hiển thị rõ số việc chưa gửi.

Ghi chú: ứng dụng **đã** phụ thuộc kho trình duyệt từ trước. `createSupabaseBrowserClient` đặt `persistSession: true`, và supabase-js lưu phiên vào `localStorage`. Xóa dữ liệu duyệt web đã đồng nghĩa mất phiên cửa hàng ngay ở hiện trạng. Ngoại tuyến mở rộng rủi ro đang có chứ không tạo ra loại rủi ro mới.

**7. Thêm đúng một dependency mới: Dexie.** Chốt 2026-08-30.

Không dùng RxDB. RxDB là framework replication hai chiều, mà hệ này cố ý không hợp nhất hai chiều: database phải giữ độc quyền cấp số bill và chốt tiền. Dùng RxDB là trả giá đầy đủ cho một cỗ máy rồi tắt phần chính của nó, đồng thời kéo kiến trúc về hướng local-first vốn đã bị loại ở phần "Mô hình đề xuất". Ngoài ra một số plugin storage của RxDB thuộc bản premium trả phí, không hợp với đồ án.

Không dùng `localForage`: chỉ có key-value, không có transaction, và tự động rơi về `localStorage` khi IndexedDB không dùng được — phá đúng yêu cầu transaction ở quyết định 5.

Không dựng service worker và Background Sync ở phạm vi này: chỉ Chromium hỗ trợ, Safari và Firefox không có, nên chạy iPad là hỏng; ngoài ra service worker nằm ngoài cây `adapters` nên `src/architectureBoundaries.test.ts` không canh được. Tab POS mở suốt giờ bán nên phát lại lúc mở ứng dụng cộng lúc có mạng lại là đủ. Ghi vào phần "Ngoài phạm vi".

Ràng buộc bắt buộc: thư viện **không được xuất hiện trong `ports` hay `domain`**. Test biên giới enforce `ports` chỉ import `ports` và `domain`, nên interface outbox phải khai bằng type của `domain`. Nhờ vậy quyết định chọn thư viện đảo ngược được, chỉ đụng một thư mục.

**Ba điều kiện kèm theo quyết định làm.** Chốt 2026-08-30.

1. Phạm vi hẹp theo quyết định 2 và 3. Không nới trong giai đoạn 1.
2. Làm sau một cờ tắt. Hết tuần 13 mà chưa vững thì tắt cờ, demo trực tuyến, trình phần ngoại tuyến ở dạng thiết kế cộng nguyên mẫu.
3. Danh sách tình huống xung đột phải có chính sách viết ra và kiểm thử chạy xanh mới tính là xong.

**Câu hỏi đã thành không áp dụng nhờ phạm vi hẹp**

- Câu 3 của `add-offline-sync-conflict-resolution`: không sinh số tạm nên không có việc đánh số lại.
- Câu 2 của `add-offline-sync-conflict-resolution`: không có đơn thanh toán ngoại tuyến.
- Câu 4 của `add-offline-status-ux`: không có hóa đơn ngoại tuyến để đánh dấu.

Còn để mở: câu 6, 8, 9, 10, 11, 12, 13, 14 của change này.
