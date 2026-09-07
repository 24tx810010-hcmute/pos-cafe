# Định hình chiến lược kiểm thử tự động

## Why

Dự án đã có kiểm thử nhưng chưa có chiến lược được viết thành văn: hiện có Vitest (49 file, 257 test tại baseline `main@b7b7262`), Playwright smoke đa viewport, một architecture boundary test và `docs/testing.md` ghi kết quả chạy. Vấn đề là không ai trả lời được câu "tính năng mới thì phải viết loại test nào, bao nhiêu là đủ, và điều gì chặn merge". Khi 8 nhóm tính năng mở rộng phía sau lần lượt được làm, thiếu chiến lược sẽ dẫn tới mỗi tính năng test một kiểu, và NFR-07 (bằng chứng kiểm thử nhiều lớp) không kiểm chứng được.

## What Changes

- Viết tài liệu chiến lược kiểm thử xác định các tầng test, mỗi tầng test cái gì và không test cái gì, chạy ở đâu, chạy nhanh cỡ nào.
- Xác định tiêu chí "đủ test" cho một thay đổi: loại test bắt buộc theo loại thay đổi (thuần domain, adapter, UI, migration, RPC).
- Xác định cổng chất lượng: điều kiện tối thiểu để một thay đổi được coi là xong.
- Chuẩn hóa quy ước đặt tên, vị trí file test và cách tổ chức test theo ranh giới Ports and Adapters hiện có.
- Rà lại bộ test đang có, phân loại theo tầng và ghi nhận khoảng trống để các change kiểm thử sau nhắm vào.
- Cập nhật `docs/testing.md` thành tài liệu chiến lược thay vì chỉ là nhật ký kết quả chạy.

## Capabilities

### New Capabilities

Không có. Đây là thay đổi về quy trình và công cụ, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Tài liệu: `docs/testing.md`, `docs/requirements.md` (tiêu chí NFR-07), `pos-cafe-context.md`.
- Không đổi source code nghiệp vụ. Có thể đổi cấu hình `vitest.config.ts`, `playwright.config.ts`, `playwright.supabase.config.ts` nếu cần tách project theo tầng test.
- Là nền cho `expand-e2e-coverage`, `setup-test-data-environment`, `add-ci-pipeline`.

## Ngoài phạm vi

- Viết thêm test case mới. Việc đó thuộc `expand-e2e-coverage`.
- Dựng dữ liệu và môi trường test. Việc đó thuộc `setup-test-data-environment`.
- Cấu hình pipeline chạy tự động. Việc đó thuộc `add-ci-pipeline`.
- Kiểm thử hiệu năng và kiểm thử bảo mật.

## Phụ thuộc

- Không phụ thuộc change nào khác. Đây nên là change làm đầu tiên trong nhóm kiểm thử.

## Câu hỏi phải chốt trước khi làm

1. ~~Mục tiêu thật của chiến lược này là gì: bảo vệ code, hay còn làm bằng chứng cho báo cáo?~~ **Đã trả lời ở quyết định 1: cả hai.**
2. ~~Có đặt ngưỡng độ phủ bằng số không, và đo trên đâu?~~ **Đã trả lời ở quyết định 2: chỉ đặt số trên `domain` và `core`, ngưỡng 90% dòng.**
3. ~~Cổng chất lượng có được phép chặn merge không, và chặn ở mức nào?~~ **Đã trả lời ở quyết định 3: chặn ở mức chạy được cục bộ.**
4. ~~E2E chạy trên Supabase thật có được tính là bắt buộc không?~~ **Đã trả lời ở quyết định 4: bắt buộc theo mốc chứ không theo mỗi lần merge, và phạm vi phải gồm các tình huống biên quan trọng.**
5. ~~Có chấp nhận thêm dependency mới cho kiểm thử không?~~ **Đã trả lời ở quyết định 5: đúng một, là `@vitest/coverage-v8`.**
6. ~~Kiểm thử thủ công có còn chỗ trong quy trình không?~~ **Đã trả lời ở quyết định 6: còn nhưng giữ ở mức tối thiểu, và giảm dần là mục tiêu có chủ ý.**
7. ~~Tài liệu chiến lược đặt ở đâu?~~ **Đã trả lời ở quyết định 7: tách `docs/test-strategy.md`, giữ `docs/testing.md` làm nhật ký kết quả chạy.**

Hai câu phát sinh trong lúc trao đổi, cũng đã chốt:

8. ~~Tình huống biên nào bắt buộc có trên cloud E2E?~~ **Đã trả lời ở quyết định 8.**
9. ~~Có script hóa kịch bản demo thành test tự động không, và làm khi nào?~~ **Đã trả lời ở quyết định 9: có, làm ngay trong tuần này.**

Không còn câu hỏi bỏ ngỏ.

## Quyết định đã chốt

Ghi ngày 2026-09-07, theo trao đổi với chủ dự án. Đánh số theo câu hỏi ở mục trên.

**1. Chiến lược phục vụ cả hai mục tiêu: bảo vệ code khi phát triển tiếp, và làm bằng chứng trình bày trong báo cáo.**

Không chọn một trong hai. Hệ quả về mức chi tiết: mọi lựa chọn có đánh đổi phải ghi kèm phương án đã cân nhắc và lý do loại bỏ, vì phần lập luận đó là thứ báo cáo cần, còn bản thân kết luận thì không đủ để viết thành chương.

Quyết định này là hệ quả trực tiếp của chuẩn chung ở `openspec/SPEC-STANDARD.md`, không phải luật riêng của change này.

**2. Ngưỡng độ phủ chỉ đặt bằng số trên `domain` và `core`, mức 90% dòng. Các tầng còn lại dùng tiêu chí theo loại thay đổi, không đặt số.**

Ba phương án đã cân nhắc:

| | Phương án | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Không đặt số nào, chỉ dùng tiêu chí "loại thay đổi nào bắt buộc loại test nào" | **Loại.** Không có số thì không có gì ép được, và tiêu chí định tính sẽ trôi dần khi tiến độ gấp |
| b | Đặt số trên toàn bộ `src` | **Loại.** Ép số lên tầng giao diện và tầng adapter đẻ ra test viết cho đủ chỉ tiêu chứ không cho đúng hành vi. Đây là bệnh đã biết của việc lấy độ phủ làm mục tiêu thay vì làm chỉ báo |
| c | Số chỉ trên `domain` và `core`, phần còn lại dùng tiêu chí theo loại thay đổi | **Chọn** |

Lý do phương án c hợp với đúng dự án này: `src/architectureBoundaries.test.ts` đã enforce rằng `domain` chỉ import `domain`, `core` chỉ import `core` và `domain`, và cả hai **cấm import `react`**. Nghĩa là hai tầng đó thuần, không I/O, không vòng đời component — thứ khó phủ thì đã bị luật kiến trúc đẩy ra khỏi chúng rồi. Phủ 90% ở nơi như vậy là mục tiêu hợp lý chứ không phải con số cho đẹp.

Ngược lại, `app` và `adapters` là nơi có I/O thật và giao diện thật. Ở đó thứ đáng đo không phải số dòng chạy qua mà là **loại tình huống đã được kiểm**, nên tiêu chí phải là định tính theo loại thay đổi.

Con số 90% chọn thay vì 100% vì mức tuyệt đối buộc phải viết test cho cả nhánh phòng thủ không bao giờ chạy tới, và chi phí giữ nó vượt lợi ích.

**4. E2E trên Supabase thật: bắt buộc theo mốc, không bắt buộc theo mỗi lần merge. Phạm vi phải gồm các tình huống biên quan trọng, không chỉ luồng thuận.**

Mốc bắt buộc chạy và ghi lại kết quả: khi đóng mỗi mục của `docs/roadmap.md`, và trước ngày demo.

Lý do không ép mỗi lần merge: `npm run smoke:supabase` cần một project Supabase riêng cùng credential, và có chi phí thời gian đáng kể. Ép mỗi lần merge sẽ làm vòng lặp phát triển chậm tới mức người làm bắt đầu tìm cách bỏ qua nó — lúc đó cổng chặn thành hình thức, tệ hơn là không có.

Lý do không bỏ hẳn: đây là **bằng chứng duy nhất** cho hai thứ mà adapter mock về nguyên tắc không chứng minh được — chính sách bảo mật mức dòng thật, và hành vi thật của các RPC trong PostgreSQL. `docs/testing.md` đã ghi đúng giới hạn này: "Không claim rằng toàn bộ 260 local tests đã chạy trên Supabase."

Yêu cầu về phạm vi: bộ E2E trên cloud **MUST** gồm cả tình huống bị từ chối, không chỉ tình huống thành công. Danh sách tình huống biên bắt buộc sẽ chốt ở bước viết `testplan.md`.

**5. Thêm đúng một dependency phát triển: `@vitest/coverage-v8`.**

Cần nó để đo được ngưỡng ở quyết định 2; không có công cụ đo thì ngưỡng chỉ là lời nói.

Hai loại thư viện đã cân nhắc và loại:

- **Thư viện sinh dữ liệu giả.** Loại vì dữ liệu ngẫu nhiên làm test nhấp nháy: hỏng lúc này chạy lúc khác, và khi hỏng thì không dựng lại được ca hỏng. Dữ liệu thử trong dự án này phải là giá trị cố định ghi thẳng trong test, đúng như chuẩn ở `SPEC-STANDARD.md` mục 5 yêu cầu.
- **Thư viện assertion bổ sung.** Loại vì Vitest cộng `@testing-library/jest-dom` đã phủ đủ nhu cầu hiện có. Thêm bộ assertion thứ hai chỉ tạo ra hai lối viết cho cùng một việc.

Bối cảnh: dự án đang có 12 dependency runtime và một commit gần đây còn gỡ bớt thư viện không dùng, nên mỗi lần thêm phải có lý do đứng được.

**6. Kiểm thử thủ công vẫn còn chỗ nhưng giữ ở mức tối thiểu, và việc thu hẹp dần phần thủ công là mục tiêu có chủ ý.**

Phần thủ công chỉ giữ ở những chỗ **về bản chất không tự động hóa được**, không phải ở những chỗ ngại viết test.

Ghi thành một checklist có cột ngày chạy trong `docs/testing.md`. Không có checklist thì phần thủ công biến mất khỏi bằng chứng, trong khi NFR-07 đòi bằng chứng kiểm thử nhiều lớp.

Lý do coi việc giảm thao tác thủ công là điểm mạnh chứ không chỉ là tiện lợi: một quy trình tự động hóa cao là thứ trình bày được thành đóng góp kỹ thuật của đồ án, và nó chứng minh luận điểm rằng ranh giới ports và adapters cho phép kiểm thử phần lớn hệ thống mà không cần hạ tầng thật.

Danh sách cụ thể phần giữ thủ công, và phần nào chuyển sang tự động được, chốt ở bước viết `testplan.md`.

**7. Tách `docs/test-strategy.md` cho chiến lược. `docs/testing.md` giữ nguyên vai trò nhật ký kết quả chạy.**

Ba lý do:

- Hai tài liệu có **nhịp cập nhật khác hẳn nhau**: chiến lược đổi hiếm, nhật ký đổi mỗi lần chạy lại bộ test.
- Gộp chung thì phần chiến lược bị chôn dưới các bảng số liệu và ngày chạy, khó đọc và khó trích.
- Báo cáo trích **hai chỗ khác nhau**: chiến lược thuộc chương phương pháp thực hiện, nhật ký kết quả thuộc chương kiểm thử và đánh giá. Tách sẵn thì không phải bóc tách lúc viết báo cáo.

**3. Cổng chất lượng chặn ở mức chạy được cục bộ, không chặn ở mức cần hạ tầng ngoài.**

Nội dung cổng, tất cả phải xanh mới coi là xong một thay đổi:

| Kiểm | Lệnh | Áp dụng cho |
| --- | --- | --- |
| Kiểu và build | `npm run build` | Mọi thay đổi |
| Kiểm thử đơn vị và tích hợp | `npm test` | Mọi thay đổi |
| Ngưỡng phủ `domain` và `core` | `npm run test:coverage` | Mọi thay đổi chạm hai tầng đó |
| Ranh giới kiến trúc | Đã nằm trong `npm test` | Mọi thay đổi |
| Mock E2E | `npm run smoke` | Thay đổi chạm giao diện |
| Cloud E2E | `npm run smoke:supabase` | **Không** thuộc cổng mỗi lần; chạy theo mốc ở quyết định 4 |

Ba phương án đã cân nhắc:

| | Phương án | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Chặn ở mức chạy được cục bộ | **Chọn** |
| b | Chỉ khuyến nghị, không chặn gì | **Loại.** Không có gì ép được, và không mô tả được thành quy trình trong báo cáo |
| c | Chặn tất cả, gồm cloud E2E mỗi lần | **Loại.** Mâu thuẫn trực tiếp với quyết định 4 |

Lý do phương án a hợp: nó chỉ gồm những kiểm **chạy nhanh và luôn chạy được** mà không cần credential hay project ngoài, nên không ai có động cơ bỏ qua. Cổng mà người ta thường xuyên bỏ qua thì tệ hơn là không có cổng, vì nó tạo cảm giác an toàn giả.

**Ghi chú quan trọng về hiện trạng:** dự án **chưa có CI**; `add-ci-pipeline` nằm ở giai đoạn 2 của `docs/roadmap.md`. Nên tới thời điểm này cổng được thực thi bằng kỷ luật chứ chưa có máy nào ép. Khi CI lên, bảng trên bê nguyên thành cấu hình, không phải thiết kế lại. Chiến lược phải ghi rõ điều này thay vì tuyên bố có cổng chặn thật.

**8. Bộ E2E trên cloud phải phủ ba tình huống biên bắt buộc, cộng ba tình huống nên có.**

Bộ hiện tại có 5 test tại `tests/supabase/pos-cafe-supabase.spec.ts`: tạo cửa hàng và thanh toán, chặn quyền `payment.take` ở cả giao diện lẫn RPC, hủy đơn đã thanh toán, tách đơn thanh toán, và realtime giữa hai trình duyệt.

Bắt buộc bổ sung:

| Tình huống | Vì sao bắt buộc |
| --- | --- |
| **Cô lập chéo cửa hàng**: phiên của cửa hàng A truy vấn dữ liệu cửa hàng B phải trả về rỗng | Đây là luận điểm NFR-02 và **hiện chưa có test nào chứng minh**. Adapter mock về nguyên tắc không chứng minh được vì nó không có chính sách bảo mật mức dòng |
| **Xung đột khóa lạc quan**: hai thiết bị cùng sửa một đơn, thiết bị sau nhận `ORDER_VERSION_CONFLICT` | Chứng minh phần xử lý ghi đồng thời, thứ chỉ tồn tại thật ở tầng database |
| **Không trùng số bill khi thanh toán đồng thời**: ràng buộc `unique (store_id, business_date, order_no)` giữ được | Đụng thẳng phần tiền. Cấp số dùng khóa phía database nên chỉ kiểm được ở đó |

Nên có, làm nếu còn thời gian: món bị xóa giữa chừng trả `MENU_ITEM_UNAVAILABLE`; tiền khách đưa thiếu trả `PAYMENT_AMOUNT_TOO_LOW`; hủy đơn không nhập lý do trả `VOID_REASON_REQUIRED`.

Nguyên tắc chọn: **chỉ đưa lên cloud những thứ mock không chứng minh được.** Ba ca bắt buộc đều thuộc loại đó; ba ca nên có thì mock kiểm được phần lớn, chạy trên cloud chỉ để xác nhận thêm.

**9. Script hóa kịch bản demo thành một test Playwright, làm ngay trong tuần này, không hoãn tới tuần 14.**

Đề xuất ban đầu là hoãn tới tuần 14 với lý do kịch bản demo còn đổi theo tính năng làm thêm. Chủ dự án bác lại và lý lẽ đó đúng: **đây không phải việc chuẩn bị demo mà là lưới chặn hồi quy cho hành trình chính của người dùng**, tức đúng mục đích của mục 1 trong `docs/roadmap.md`. Hoãn tới tuần 14 thì mất tác dụng bảo vệ suốt 12 tuần ở giữa.

Phạm vi: bước 1 tới 14 của `docs/demo-runbook.md`, chạy liền một mạch trong một test. Bước 15 và 16 là thao tác quản trị, đã có test riêng phủ, không nhân đôi.

Giá trị tăng thêm so với bộ test đang có, nói rõ để không phóng đại: các bước riêng lẻ **đã** được phủ bởi 5 test cloud và bộ mock E2E hiện tại. Cái mới là **một mạch liên tục theo đúng thứ tự demo** — nó bắt được lỗi ở chỗ nối giữa các bước mà test rời rạc bỏ sót, và nó sinh ra một trace chạy được dùng làm bằng chứng trong báo cáo.

Hệ quả đã biết và chấp nhận: `add-owner-account-and-store-provisioning` sẽ **làm vỡ script này** ở tuần 7 tới 9, vì proposal của change đó ghi rõ luồng tạo cửa hàng hiện tại phải viết lại. Đó là hành vi đúng chứ không phải lãng phí: script vỡ là tín hiệu cho biết hành trình người dùng đã đổi, và việc sửa nó là một phần của change kia.