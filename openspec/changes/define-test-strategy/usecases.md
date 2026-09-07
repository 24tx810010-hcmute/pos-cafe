# Use case

Change này thuộc nhóm quy trình, không sinh hành vi người dùng cuối nhìn thấy, nên `.openspec.yaml` đặt `skip_specs: true`. Theo `openspec/SPEC-STANDARD.md` thì nó được phép bỏ file này.

**Vẫn viết, vì hai lý do.** Thứ nhất, chiến lược kiểm thử có tác nhân thật là **nhà phát triển**, và quy trình họ đi qua kiểm chứng được y như một luồng người dùng. Thứ hai, change này là **khuôn mẫu** cho mọi change sau, nên nó cần có đủ bảy file để làm mẫu tham khảo.

Khác biệt cần lưu ý khi copy sang change tính năng: ở đây tác nhân là nhà phát triển và "hệ thống" là quy trình cùng bộ công cụ. Ở change tính năng, tác nhân là người dùng cuối và "hệ thống" là phần mềm POS.

---

## UC-TEST-01 — Thêm hoặc sửa một hàm thuần trong `core` hoặc `features`

| | |
| --- | --- |
| **Tác nhân** | Nhà phát triển. Ảnh hưởng: người rà soát thay đổi |
| **Mục tiêu** | Thêm một quy tắc nghiệp vụ mới mà biết chắc nó đúng và không làm hỏng quy tắc cũ |
| **Tiền điều kiện** | Kho mã ở trạng thái sạch, `npm test` đang xanh |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| Đường dẫn file sửa | chuỗi | có | Phải nằm trong `src/core/` hoặc `src/features/`, không phải file `use*.ts` | `src/core/money.ts` |
| Loại thay đổi | liệt kê | có | Một trong: thêm hàm, sửa hàm, sửa nhánh lỗi | `thêm hàm` |
| Nhánh lỗi mới | danh sách mã lỗi | không | Mỗi mã phải tồn tại trong `AppErrorCode` hoặc được khai mới trong `design.md` của change | `PAYMENT_AMOUNT_TOO_LOW` |

**Luồng chính**

1. Nhà phát triển sửa hàm trong `core` hoặc `features`.
2. Nhà phát triển viết test đơn vị đặt cạnh file, tên `<tên>.test.ts`.
3. Test phủ: luồng chính, **mọi** nhánh lỗi, và giá trị biên.
4. Chạy `npm test`, toàn bộ phải xanh.
5. Chạy `npm run test:coverage`, độ phủ gộp phải ≥ 90%.
6. Chạy `npm run build`, kiểu và bản dựng phải qua.
7. Thay đổi được coi là đủ điều kiện đóng.

**Luồng thay thế**

- 2a. Hàm đã có test sẵn: bổ sung ca mới vào file test đang có thay vì tạo file mới.
- 3a. Hàm không có nhánh lỗi nào: bỏ qua phần nhánh lỗi, vẫn phải có biên.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 4a | `npm test` có test đỏ | Dừng. Không được đóng thay đổi. Sửa cho tới khi xanh |
| 5a | Độ phủ gộp dưới 90% | Dừng. Viết thêm test, **không** hạ ngưỡng |
| 5b | File mới nằm ngoài phạm vi đo mà lẽ ra phải trong | Sửa `coverage.include` trong `vitest.config.ts`, không thêm ngoại lệ riêng lẻ |
| 6a | `npm run build` báo lỗi kiểu | Dừng. Sửa kiểu |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| File test mới hoặc sửa | Đặt cạnh file được kiểm |
| Kết quả `npm test` | Toàn bộ xanh |
| Số độ phủ | ≥ 90% trên phạm vi gộp |
| Tác dụng phụ | Không |

**Tiêu chí chấp nhận**

- Mọi nhánh lỗi của hàm có ít nhất một test case.
- Có ít nhất một test cho giá trị biên.
- `npm test`, `npm run test:coverage`, `npm run build` đều qua.
- Tên test mô tả hành vi, không mô tả tên hàm.

**Truy vết** — Quyết định 2, 3 và mục Decisions 1, 2, 4 của `design.md`.

---

## UC-TEST-02 — Sửa một migration hoặc một RPC

| | |
| --- | --- |
| **Tác nhân** | Nhà phát triển |
| **Mục tiêu** | Đổi tầng dữ liệu mà biết chắc hợp đồng với ứng dụng không gãy, và nhánh bị từ chối vẫn bị từ chối |
| **Tiền điều kiện** | Có project Supabase dùng để thử; migration trước đó đã áp |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| File migration | chuỗi | có | Nằm trong `supabase/migrations/`, đánh số tăng dần | `014_store_owner.sql` |
| Tên RPC bị đụng | danh sách chuỗi | có | Tên hàm có thật trong migration | `submit_order_changes` |
| Có đổi chữ ký không | luận lý | có | | `true` |

**Luồng chính**

1. Nhà phát triển viết migration.
2. Cập nhật hoặc thêm test hợp đồng migration ở `src/adapters/supabase/migrations.test.ts`.
3. Cập nhật test hợp đồng adapter cho cả mock và Supabase.
4. Viết **một ca cloud E2E cho nhánh bị từ chối** của RPC vừa sửa.
5. Chạy `npm test` và `npm run build`.
6. Chạy `npm run smoke:supabase` trên project thử, ghi kết quả.
7. Đóng thay đổi.

**Luồng thay thế**

- 4a. RPC không có nhánh từ chối nào: ghi rõ lý do trong mô tả thay đổi, bỏ bước 4.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 3a | Chữ ký đổi mà adapter mock chưa cập nhật | Test hợp đồng đỏ. Dừng, cập nhật mock cho khớp |
| 6a | Không có credential Supabase | Không được coi là đã kiểm chứng. Ghi vào nhật ký là chưa chạy, kèm lý do |
| 6b | `smoke:supabase` đỏ | Dừng. Không được ghi là đã kiểm chứng |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| Migration mới | Trong `supabase/migrations/` |
| Test hợp đồng cập nhật | mock và Supabase khớp nhau |
| Ca cloud E2E mới | Nhánh bị từ chối |
| Dòng nhật ký | Thêm vào `docs/testing.md` kèm ngày và baseline |

**Tiêu chí chấp nhận**

- Adapter mock và adapter Supabase cùng qua một bộ test hợp đồng.
- Nhánh bị từ chối của RPC có ca cloud E2E chứng minh.
- Kết quả `smoke:supabase` được ghi kèm **ngày và baseline**, không gộp với số liệu cục bộ.

**Truy vết** — Quyết định 4 và 8; mục Decisions 1 và 2 của `design.md`.

---

## UC-TEST-03 — Đổi quyền hoặc chính sách bảo mật

| | |
| --- | --- |
| **Tác nhân** | Nhà phát triển |
| **Mục tiêu** | Đổi phân quyền mà chứng minh được nó chặn thật ở tầng dữ liệu, không chỉ ẩn nút trên giao diện |
| **Tiền điều kiện** | `redesign-permission-model` đã hoặc chưa áp, tùy thời điểm; ghi rõ baseline |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| Quyền bị đụng | danh sách chuỗi | có | Phải nằm trong danh mục quyền hiện hành | `payment.take` |
| Vai trò bị đụng | danh sách chuỗi | có | | `cashier` |
| Có sửa chính sách bảo mật hàng không | luận lý | có | | `true` |

**Luồng chính**

1. Sửa hàm kiểm quyền trong `core`.
2. Viết test đơn vị cho hàm đó, phủ cả cho phép lẫn từ chối.
3. Viết test giao diện: phần tử điều khiển bị ẩn hoặc vô hiệu đúng quy tắc.
4. Viết ca cloud E2E **gọi thẳng vào database** bỏ qua giao diện, phải bị từ chối.
5. Chạy cổng chất lượng đầy đủ.
6. Chạy `smoke:supabase`, ghi kết quả.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 4a | Bỏ qua bước gọi thẳng database | **Thay đổi không được coi là xong.** Ẩn nút không phải biện pháp bảo vệ |
| 4b | Gọi thẳng database mà **không** bị từ chối | Lỗi bảo mật. Dừng toàn bộ, sửa chính sách trước |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| Test đơn vị hàm quyền | Cả hai chiều cho phép và từ chối |
| Test giao diện | Phần tử ẩn hoặc vô hiệu đúng quy tắc |
| Ca cloud E2E | Gọi thẳng database bị từ chối |

**Tiêu chí chấp nhận**

- Có bằng chứng ở **cả ba tầng**: hàm quyền, giao diện, và database.
- Ca gọi thẳng database tồn tại và xanh.

**Truy vết** — Quyết định 8; mục Decisions 2 của `design.md`; và requirement "Cô lập enforce ở tầng database" của baseline spec `store-isolation`.

---

## UC-TEST-04 — Đổi hành trình chính của người dùng

| | |
| --- | --- |
| **Tác nhân** | Nhà phát triển |
| **Mục tiêu** | Đổi luồng thao tác mà lưới chặn hồi quy vẫn phản ánh đúng hành trình mới |
| **Tiền điều kiện** | `tests/smoke/demo-runbook.spec.ts` đang xanh trước khi sửa |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| Bước bị đổi | danh sách số | có | Tham chiếu số bước trong `docs/demo-runbook.md` | `2, 3` |
| Loại đổi | liệt kê | có | Một trong: thêm bước, bỏ bước, đổi thao tác | `đổi thao tác` |

**Luồng chính**

1. Sửa mã nguồn theo hành trình mới.
2. Chạy `npm run smoke`. Script kịch bản demo **dự kiến sẽ đỏ**.
3. Cập nhật `docs/demo-runbook.md` cho khớp hành trình mới.
4. Cập nhật `tests/smoke/demo-runbook.spec.ts` theo runbook đã sửa.
5. Chạy lại `npm run smoke` cho tới khi xanh.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 2a | Script vẫn xanh dù hành trình đã đổi | Nghi ngờ script không thực sự đi qua bước đó. Kiểm lại phạm vi script |
| 4a | Sửa script trước khi sửa runbook | Sai thứ tự. Runbook là nguồn, script là bản thi hành của nó |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| `docs/demo-runbook.md` cập nhật | Hành trình mới |
| Script cập nhật | Khớp runbook |
| `npm run smoke` | Xanh |

**Tiêu chí chấp nhận**

- Runbook và script khớp nhau từng bước.
- Runbook được sửa **trước** script.

**Truy vết** — Quyết định 9; mục "Script kịch bản demo" của `design.md`.

---

## UC-TEST-05 — Đóng một mục của roadmap

| | |
| --- | --- |
| **Tác nhân** | Chủ dự án |
| **Mục tiêu** | Kết thúc một mục với bằng chứng đủ để trích vào báo cáo |
| **Tiền điều kiện** | Mọi thay đổi thuộc mục đó đã qua cổng chất lượng cục bộ |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| Số mục roadmap | số nguyên | có | 1 tới 10 | `3` |
| Baseline | chuỗi | có | Mã commit đầy đủ hoặc rút gọn | `main@c7f2f4e` |
| Ngày chạy | ngày | có | Định dạng `dd/mm/yyyy` | `07/09/2026` |

**Luồng chính**

1. Chạy `npm run build`, `npm test`, `npm run test:coverage`, `npm run smoke`.
2. Chạy `npm run smoke:supabase` trên project thật.
3. Chạy checklist thủ công trong `docs/testing.md`.
4. Ghi toàn bộ kết quả vào `docs/testing.md` kèm **baseline và ngày**.
5. Đánh dấu mục trong `docs/roadmap.md` là xong, ghi ngày.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 2a | Không chạy được cloud E2E | Mục **không** được đánh dấu xong. Ghi lý do vào nhật ký |
| 4a | Ghi kết quả mà thiếu ngày hoặc baseline | Số liệu không dùng được cho báo cáo. Bổ sung trước khi đóng |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| Mục nhật ký mới | Trong `docs/testing.md`, có baseline và ngày |
| Trạng thái roadmap | Chuyển `[x]` kèm ngày |

**Tiêu chí chấp nhận**

- Có kết quả của cả bốn lệnh cục bộ và một lệnh cloud.
- Mỗi con số đi kèm baseline và ngày; **không** gộp số cục bộ với số cloud thành một con số.

**Truy vết** — Quyết định 4 và 6; mục Decisions 3 và 6 của `design.md`.

---

## UC-TEST-06 — Chạy phần kiểm thử thủ công còn lại

| | |
| --- | --- |
| **Tác nhân** | Chủ dự án |
| **Mục tiêu** | Kiểm những thứ về bản chất không tự động hóa được, và để lại dấu vết |
| **Tiền điều kiện** | Bộ tự động đã xanh |

**Đầu vào**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- | --- |
| Ngày chạy | ngày | có | | `07/09/2026` |
| Thiết bị thật đã dùng | chuỗi | có | Ghi rõ loại và kích thước | `tablet Android 10 inch` |

**Luồng chính**

1. Gửi một email thử qua đường gửi đang cấu hình, kiểm nó vào hộp thư chính hay thư rác.
2. Mở ứng dụng trên thiết bị thật ở chế độ ngang, kiểm thao tác chạm và bàn phím ảo.
3. Đánh dấu hai mục trên vào checklist trong `docs/testing.md`, ghi ngày.

**Luồng ngoại lệ**

| Nhánh | Điều kiện | Kết quả |
| --- | --- | --- |
| 1a | Email rơi vào thư rác | Chặn phát hành. Xử lý đường gửi trước, xem quyết định 15 của `add-owner-account-and-store-provisioning` |
| 2a | Không có thiết bị thật | Ghi rõ là chưa kiểm, **không** ghi là đã kiểm bằng trình duyệt giả lập |

**Đầu ra**

| Kết quả | Chi tiết |
| --- | --- |
| Checklist cập nhật | Có ngày chạy và thiết bị đã dùng |

**Tiêu chí chấp nhận**

- Checklist chỉ còn đúng hai mục. Mục thứ ba là diễn tập demo đã chuyển sang tự động ở quyết định 9.
- Mỗi mục có ngày chạy; mục chưa chạy được ghi rõ lý do thay vì bỏ trống.

**Truy vết** — Quyết định 6 và 9; mục Decisions 6 của `design.md`.
