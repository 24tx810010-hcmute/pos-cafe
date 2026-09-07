# Chiến Lược Kiểm Thử

Tài liệu này trả lời ba câu: **tính năng mới thì viết loại test nào**, **bao nhiêu là đủ**, và **điều gì chặn một thay đổi được coi là xong**.

Nó không chứa kết quả chạy. Kết quả, số liệu và ngày nằm ở [testing.md](testing.md). Hai file tách nhau vì nhịp cập nhật khác hẳn: chiến lược đổi hiếm, nhật ký đổi mỗi lần chạy lại bộ test.

Chốt ngày 2026-09-07 theo `openspec/changes/define-test-strategy`. Lý do đầy đủ của từng lựa chọn nằm ở mục `## Quyết định đã chốt` của proposal đó.

## Sáu Tầng Kiểm Thử

Cột **không kiểm** quan trọng ngang cột **kiểm**. Thiếu nó thì cùng một thứ bị kiểm ở ba tầng, còn thứ khác không tầng nào nhận.

| Tầng | Công cụ | Kiểm | Không kiểm |
| --- | --- | --- | --- |
| Đơn vị | Vitest | Hàm thuần trong `core` và `features`: tính tiền, dựng nháp đơn, kiểm quyền, gom báo cáo | Bất cứ thứ gì cần port thật hoặc cần render |
| Luồng tính năng | Vitest + adapter mock | Kịch bản nghiệp vụ nhiều bước: gửi đơn, thanh toán, tách đơn, hủy đơn, đổi quyền | Cách trình bày trên màn hình |
| Thành phần giao diện | Vitest + Testing Library | Trạng thái màn: nút bị vô hiệu, thông báo lỗi, trạng thái đang tải, phần tử ẩn theo quyền | Tính đúng của nghiệp vụ phía sau |
| Ranh giới kiến trúc | Vitest + quét AST | Hướng phụ thuộc giữa các tầng | Hành vi lúc chạy |
| Mock E2E | Playwright, 5 viewport | Hành trình người dùng đầu cuối trên adapter mock, và bố cục theo kích thước màn | Chính sách bảo mật hàng, hành vi thật của RPC |
| Cloud E2E | Playwright + Supabase thật | Đúng ba nhóm mock không chứng minh được: chính sách bảo mật mức dòng, hành vi RPC trong PostgreSQL, realtime giữa hai máy | Mọi thứ mock đã chứng minh được |

**Luật chống trùng lặp.** Một hành vi chỉ được kiểm ở **tầng thấp nhất có thể kiểm được nó**. Cùng một quy tắc nghiệp vụ mà bị kiểm cả ở tầng đơn vị lẫn tầng E2E thì bỏ bản ở E2E, trừ khi bản E2E kiểm thêm phần **nối giữa các bước**.

## Bao Nhiêu Là Đủ — Tra Theo Loại Thay Đổi

Đọc cột trái, làm đủ cột phải. Đây là **mức sàn**, không phải mức trần.

| Loại thay đổi | Bắt buộc có |
| --- | --- |
| Hàm thuần trong `core` hoặc `features` | Test đơn vị phủ luồng chính, mọi nhánh lỗi, và giá trị biên |
| Thêm hoặc sửa một port | Test hợp đồng chạy chung cho cả adapter mock và adapter Supabase |
| Sửa adapter Supabase | Test hợp đồng, cộng test ánh xạ lỗi nếu có mã lỗi mới |
| Migration hoặc RPC | Test hợp đồng migration, cộng **một ca cloud E2E cho nhánh bị từ chối** |
| Màn hình hoặc thành phần giao diện | Test thành phần cho trạng thái vô hiệu, lỗi, đang tải; cộng mock E2E nếu đổi hành trình |
| Đổi quyền hoặc chính sách bảo mật | Test đơn vị cho hàm quyền, test giao diện cho phần tử bị ẩn, **và** ca cloud E2E gọi thẳng vào database |
| Đổi hành trình chính của người dùng | Cập nhật `docs/demo-runbook.md` **trước**, rồi cập nhật script kịch bản demo theo nó |
| Chỉ đổi tài liệu | Không bắt buộc test |

## Ngưỡng Độ Phủ

**90% dòng**, áp cho toàn phạm vi gộp chứ không áp cho từng file. Áp từng file sẽ chặn cả những file nhỏ có một nhánh phòng thủ không bao giờ chạy tới.

Phạm vi đo là **logic nghiệp vụ thuần**, không phải toàn bộ `src`:

| Đưa vào đo | Loại khỏi đo |
| --- | --- |
| `src/core/**/*.ts` | `src/domain/**` — tầng chỉ khai kiểu |
| `src/features/**/*.ts` | `src/features/**/use*.ts` — hook gắn với vòng đời component |
| | `src/app/**`, `src/adapters/**`, `src/seed/**` |
| | `**/index.ts` — barrel chỉ re-export |
| | `**/*.tsx` — thành phần React |

Cơ sở của luật này: cả 20 module không phải hook trong `src/features` đều **không import `react`** và nhận port qua tham số, nên kiểm thử được bằng adapter mock. Còn `app` và `adapters` là nơi có I/O thật và giao diện thật; ở đó thứ đáng đo là **loại tình huống đã kiểm**, không phải số dòng chạy qua. Ép số lên đó chỉ đẻ ra test viết cho đủ chỉ tiêu.

Chỉ đặt ngưỡng cho **dòng**. Câu lệnh, nhánh và hàm vẫn được báo cáo để theo dõi nhưng không chặn.

**Phạm vi đo là luật, không phải danh sách liệt kê tay.** File mới trong `features` tự vào phạm vi. Nếu về sau có module trong `features` phải import `react` mà không phải hook thì luật này gãy — khi đó **đổi luật, không thêm ngoại lệ rải rác**.

**Bẫy đã gặp:** reporter `text` **ẩn các file đạt 100% ở cả bốn cột**, nên bảng in ra màn hình ngắn hơn phạm vi thật. Con số tổng vẫn đúng. Muốn thấy đủ danh sách thì đọc `coverage/coverage-summary.json`.

## Cổng Chất Lượng

Một thay đổi chỉ được coi là xong khi cả bốn kiểm dưới đây xanh.

| Kiểm | Lệnh | Áp dụng |
| --- | --- | --- |
| Kiểu và bản dựng | `npm run build` | Mọi thay đổi |
| Đơn vị, tính năng, giao diện, ranh giới | `npm test` | Mọi thay đổi |
| Ngưỡng độ phủ | `npm run test:coverage` | Thay đổi chạm `core` hoặc `features` |
| Mock E2E | `npm run smoke` | Thay đổi chạm giao diện |

`npm run smoke:supabase` **không** nằm trong cổng mỗi lần. Nó là cổng theo mốc: bắt buộc chạy và ghi kết quả khi **đóng mỗi mục của [roadmap.md](roadmap.md)** và **trước ngày demo**.

Lý do tách: cloud E2E cần một project Supabase riêng cùng credential và tốn thời gian đáng kể. Ép mỗi lần merge sẽ làm vòng lặp phát triển chậm tới mức người làm tìm cách bỏ qua — lúc đó cổng thành hình thức, tệ hơn là không có.

**Trạng thái thực thi, nói đúng:** dự án **chưa có CI**. `add-ci-pipeline` nằm ở giai đoạn 2 của roadmap. Tới thời điểm này cổng được giữ bằng **kỷ luật**, chưa có máy nào ép. Khi CI lên, bảng trên bê nguyên thành cấu hình, không phải thiết kế lại.

## Ba Tình Huống Bắt Buộc Trên Cloud E2E

Nguyên tắc chọn: **chỉ đưa lên cloud những thứ adapter mock không chứng minh được.**

| Tình huống | Vì sao bắt buộc | Trạng thái |
| --- | --- | --- |
| Cô lập chéo cửa hàng: phiên cửa hàng A truy vấn dữ liệu cửa hàng B phải trả về rỗng | Đây là luận điểm NFR-02. Mock không có chính sách bảo mật mức dòng nên về nguyên tắc không chứng minh được | **Chưa có test nào** |
| Xung đột khóa lạc quan trả `ORDER_VERSION_CONFLICT` | Xử lý ghi đồng thời chỉ tồn tại thật ở tầng database | Chưa có ở tầng cloud |
| Không trùng số bill khi thanh toán đồng thời, ràng buộc `unique (store_id, business_date, order_no)` | Đụng thẳng phần tiền. Cấp số dùng khóa phía database | Chưa có |

Nên có nếu còn thời gian: món bị xóa giữa chừng trả `MENU_ITEM_UNAVAILABLE`; tiền khách đưa thiếu trả `PAYMENT_AMOUNT_TOO_LOW`; hủy đơn không nhập lý do trả `VOID_REASON_REQUIRED`.

**Việc viết ba ca bắt buộc thuộc `expand-e2e-coverage`**, không thuộc `define-test-strategy`.

### Nợ đã biết của cổng cloud

`npm run smoke:supabase` **không có bước dọn dẹp**, nên mỗi lần chạy để lại một cửa hàng thử trên project Supabase thật. Đã chấp nhận có ý thức ở quyết định 10 của `define-test-strategy`, vì dữ liệu cũ đằng nào cũng bị xóa sạch ở tuần 7 tới 9.

**Nhưng khoản nợ này có hạn dùng.** Trần 5 cửa hàng mỗi tài khoản chủ sẽ làm **lần chạy thứ sáu đỏ vì chạm trần**, tính từ khi `add-owner-account-and-store-provisioning` lên. Phải xử lý **trước khi kết thúc tuần 9**, nếu không cổng cloud E2E tự khóa chính nó — và nó là cổng duy nhất chứng minh được chính sách bảo mật mức dòng. Nghĩa vụ ghi ở `setup-test-data-environment`, mục "Nợ kỹ thuật thừa hưởng".

## Quy Ước Đặt Tên Và Vị Trí

- File test **đặt cạnh file nó kiểm**, cùng thư mục, tên `<tên>.test.ts` hoặc `.test.tsx`.
- Test E2E đặt ở `tests/`, tách `smoke/` cho mock và `supabase/` cho cloud.
- Tên test **mô tả hành vi**, không mô tả hàm. Viết "chặn thanh toán khi thiếu quyền", không viết "test payOrder".
- Dữ liệu thử là **giá trị cố định ghi thẳng trong test**. Không dùng thư viện sinh dữ liệu ngẫu nhiên: test nhấp nháy thì khi hỏng không dựng lại được ca hỏng.

Quy ước này ghi lại cái 49 file test hiện có đang theo, không phải quy ước mới.

## Phần Giữ Thủ Công

Chỉ giữ ở những chỗ **về bản chất không tự động hóa được**, không phải ở những chỗ ngại viết test. Việc thu hẹp dần phần này là mục tiêu có chủ ý.

| Việc | Vì sao không tự động được |
| --- | --- |
| Kiểm email vào hộp thư chính hay rơi thư rác | Phụ thuộc bộ lọc của nhà cung cấp hộp thư |
| Kiểm trên thiết bị thật ở chế độ ngang | Playwright giả lập được kích thước, không giả lập được cảm ứng thật và bàn phím ảo |

Diễn tập kịch bản demo **đã chuyển sang tự động** thành `tests/smoke/demo-runbook.spec.ts`.

Checklist có cột ngày chạy nằm trong [testing.md](testing.md). Không có checklist thì phần thủ công biến mất khỏi bằng chứng, trong khi NFR-07 đòi bằng chứng nhiều lớp.
