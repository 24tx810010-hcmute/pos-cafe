# Thiết kế chiến lược kiểm thử

## Context

Động cơ và phạm vi xem `proposal.md`. Phần này chỉ nêu hiện trạng kỹ thuật cần thiết để giải thích cách làm. Mọi số liệu dưới đây đo trên `main@c7f2f4e` ngày 2026-09-07.

**Bộ kiểm thử đang có**

| Nơi | Số file | Công cụ | Cấu hình |
| --- | --- | --- | --- |
| `src/**/*.test.{ts,tsx}` | 49 | Vitest, môi trường `jsdom` | `vitest.config.ts` |
| `tests/smoke/` | 1 | Playwright, 5 project viewport | `playwright.config.ts` |
| `tests/supabase/` | 1 | Playwright, chạy trên Supabase thật | `playwright.supabase.config.ts` |

**Phân bố 49 file Vitest theo tầng**

| Tầng | Số file | Nhận xét |
| --- | --- | --- |
| `app` | 21 | Gồm `app`, `app/shell`, `app/drawers/pos`, `app/components` |
| `features` | 18 | `admin` 8, `pos` 5, `integration` 4, `session` 1 |
| `adapters` | 7 | `supabase` 6, `mock` 1 |
| `core` | 1 | Chỉ `guards.test.ts` |
| `seed` | 1 | |
| Ranh giới kiến trúc | 1 | `src/architectureBoundaries.test.ts` |
| `domain` | 0 | |

**Bốn ràng buộc từ kho mã chi phối thiết kế dưới đây**

1. **`src/architectureBoundaries.test.ts` đã enforce hướng phụ thuộc bằng máy.** Nó quét AST mọi import và chặn: `domain` chỉ import `domain`; `core` chỉ `core` và `domain`; `ports` chỉ `ports` và `domain`; ba tầng đó cấm import `react`; `features` cấm import `app` và `adapters`; `adapters` cấm import `app` và `features`; chỉ `src/app/runtimePorts.ts` được lắp adapter cụ thể. Chiến lược kiểm thử **dựa vào luật này** thay vì phát biểu lại nó.

2. **`src/domain` gần như không có dòng chạy được.** 528 dòng, đúng một khai báo runtime là `emptyChangeset`. Đây là lý do tầng này bị loại khỏi phạm vi đo độ phủ.

3. **Cả 20 module không phải hook trong `src/features` đều không import `react`.** Chúng nhận port qua tham số nên kiểm thử được bằng adapter mock, không cần hạ tầng thật. Đây là cơ sở để mở rộng phạm vi đo độ phủ sang `features`.

4. **`src/adapters/mock` hiện thực đủ cả 12 port** của `AppPorts`. Nhờ vậy phần lớn hệ thống kiểm thử được mà không cần Supabase, và đó là lý do cloud E2E chỉ giữ những gì mock không chứng minh được.

## Goals / Non-Goals

**Goals**

- Trả lời được câu "tính năng mới thì viết loại test nào, bao nhiêu là đủ".
- Có tiêu chí "xong" kiểm chứng được, không phụ thuộc cảm tính.
- Đo được phần lõi nghiệp vụ bằng một con số, và con số đó có ý nghĩa.
- Chiến lược trích thẳng được vào chương phương pháp của báo cáo.

**Non-Goals**

- Không viết thêm test case cho tính năng đang có. Việc đó thuộc `expand-e2e-coverage`.
- Không dựng dữ liệu và môi trường test. Việc đó thuộc `setup-test-data-environment`.
- Không cấu hình pipeline tự động. Việc đó thuộc `add-ci-pipeline`.
- Không làm kiểm thử hiệu năng và kiểm thử xâm nhập.

## Decisions

### 1. Sáu tầng kiểm thử, mỗi tầng có ranh giới rõ về cái nó **không** kiểm

Điểm yếu của bảng đang có trong `docs/testing.md` là nó chỉ nói mỗi tầng kiểm gì, không nói tầng đó **không** kiểm gì. Thiếu vế sau thì cùng một thứ bị kiểm ở ba tầng, còn thứ khác không tầng nào nhận.

| Tầng | Công cụ | Kiểm | **Không kiểm** |
| --- | --- | --- | --- |
| Đơn vị | Vitest | Hàm thuần trong `core` và `features`: tính tiền, dựng nháp đơn, kiểm quyền, gom báo cáo | Bất cứ thứ gì cần port thật hoặc cần render |
| Luồng tính năng | Vitest + adapter mock | Kịch bản nghiệp vụ đi qua nhiều bước: gửi đơn, thanh toán, tách đơn, hủy đơn, đổi quyền | Cách trình bày trên màn hình |
| Thành phần giao diện | Vitest + Testing Library | Trạng thái màn: nút bị vô hiệu, thông báo lỗi, trạng thái đang tải, phần tử bị ẩn theo quyền | Tính đúng của nghiệp vụ phía sau |
| Ranh giới kiến trúc | Vitest + AST | Hướng phụ thuộc giữa các tầng | Hành vi lúc chạy |
| Mock E2E | Playwright, 5 viewport | Hành trình người dùng đầu cuối trên adapter mock, và bố cục theo kích thước màn | Chính sách bảo mật hàng, hành vi thật của RPC |
| Cloud E2E | Playwright + Supabase thật | Đúng ba nhóm mock không chứng minh được: chính sách bảo mật mức dòng, hành vi RPC trong PostgreSQL, và realtime giữa hai máy | Mọi thứ mock đã chứng minh được |

**Luật chống trùng lặp:** một hành vi chỉ được kiểm ở tầng **thấp nhất** có thể kiểm được nó. Cùng một quy tắc nghiệp vụ mà bị kiểm cả ở tầng đơn vị lẫn tầng E2E thì bỏ bản ở E2E, trừ khi bản E2E kiểm thêm phần nối giữa các bước.

### 2. Tiêu chí "đủ test" gắn với **loại thay đổi**, không gắn với cảm tính

Bảng này là thứ trả lời trực tiếp câu hỏi mở đầu của proposal. Đọc theo cột trái, làm đủ cột phải.

| Loại thay đổi | Bắt buộc có |
| --- | --- |
| Hàm thuần trong `core` hoặc `features` | Test đơn vị phủ luồng chính, mọi nhánh lỗi, và giá trị biên |
| Thêm hoặc sửa một port | Test hợp đồng chạy chung cho cả adapter mock và adapter Supabase |
| Sửa adapter Supabase | Test hợp đồng, cộng test ánh xạ lỗi nếu có mã lỗi mới |
| Migration hoặc RPC | Test hợp đồng migration, cộng **một ca cloud E2E cho nhánh bị từ chối** |
| Màn hình hoặc thành phần giao diện | Test thành phần cho trạng thái vô hiệu, lỗi, đang tải; cộng mock E2E nếu đổi hành trình |
| Đổi quyền hoặc chính sách bảo mật | Test đơn vị cho hàm quyền, test giao diện cho phần tử bị ẩn, **và** ca cloud E2E gọi thẳng vào database |
| Đổi hành trình chính của người dùng | Cập nhật script kịch bản demo ở `tests/smoke/` |
| Chỉ đổi tài liệu | Không bắt buộc test |

Cột phải là **mức sàn**, không phải mức trần.

### 3. Cổng chất lượng gồm đúng những kiểm chạy được cục bộ

| Kiểm | Lệnh | Áp dụng |
| --- | --- | --- |
| Kiểu và build | `npm run build` | Mọi thay đổi |
| Đơn vị, tính năng, giao diện, ranh giới | `npm test` | Mọi thay đổi |
| Ngưỡng độ phủ | `npm run test:coverage` | Thay đổi chạm `core` hoặc `features` |
| Mock E2E | `npm run smoke` | Thay đổi chạm giao diện |

Cloud E2E **không** nằm trong cổng mỗi lần; nó là cổng theo mốc, xem quyết định 4 của proposal.

**Trạng thái thực thi, phải nói đúng:** dự án chưa có CI nên tới thời điểm này cổng được giữ bằng kỷ luật, chưa có máy nào ép. `add-ci-pipeline` ở giai đoạn 2 sẽ biến bảng trên thành cấu hình. Chiến lược ghi rõ điều này thay vì tuyên bố đã có cổng chặn thật.

### 4. Đo độ phủ bằng luật, không bằng danh sách liệt kê tay

```
coverage.include: ["src/core/**/*.ts", "src/features/**/*.ts"]
coverage.exclude: ["src/features/**/use*.ts", "**/*.test.ts", "**/*.test.tsx", "src/domain/**"]
```

Ngưỡng: **90% dòng**, áp cho toàn bộ phạm vi gộp chứ không áp cho từng file. Áp từng file sẽ chặn cả những file nhỏ có một nhánh phòng thủ không chạy tới.

Lý do dùng luật thay vì liệt kê tên module: danh sách tay sẽ mục nát ngay khi thêm file mới, và người thêm file không có lý do gì để nhớ cập nhật nó. Luật thì file mới tự vào phạm vi.

Ràng buộc kèm theo: nếu về sau có module trong `features` phải import `react` mà không phải hook, thì luật này gãy. Khi đó **đổi luật, không thêm ngoại lệ rải rác**.

### 5. Quy ước đặt tên và vị trí, giữ nguyên cái đang chạy

Kho mã đã theo một quy ước nhất quán, chiến lược ghi lại chứ không đổi:

- File test **đặt cạnh file nó kiểm**, cùng thư mục, tên `<tên>.test.ts` hoặc `.test.tsx`.
- Test E2E đặt ở `tests/`, tách `smoke` cho mock và `supabase` cho cloud.
- Tên test viết bằng tiếng Việt hoặc tiếng Anh đều được, nhưng phải **mô tả hành vi** chứ không mô tả hàm. Viết "chặn thanh toán khi thiếu quyền", không viết "test payOrder".

Không đổi quy ước hiện có vì 49 file đã theo nó, và lợi ích của việc đổi không bù được chi phí sửa toàn bộ.

### 6. Tách hai tài liệu theo nhịp cập nhật

| File | Nội dung | Nhịp đổi |
| --- | --- | --- |
| `docs/test-strategy.md` | Sáu tầng, tiêu chí theo loại thay đổi, cổng chất lượng, quy ước | Hiếm |
| `docs/testing.md` | Nhật ký kết quả chạy, có baseline và ngày, cộng checklist thủ công | Mỗi lần chạy lại |

Lý do đầy đủ ghi ở quyết định 7 của proposal.

## Script kịch bản demo

Đây là phần có sản phẩm chạy được duy nhất của change này.

**Vị trí:** `tests/smoke/demo-runbook.spec.ts`, chạy trên adapter mock.

**Vì sao trên mock chứ không trên cloud:** nó phải chạy được mọi lúc, không cần credential, để làm lưới chặn hồi quy. Bản chạy trên cloud đã có 5 test riêng ở `tests/supabase/`.

**Phạm vi:** bước 1 tới 14 của `docs/demo-runbook.md`, liền một mạch trong một test. Bước 15 và 16 là thao tác quản trị đã có test riêng, không nhân đôi.

**Giá trị tăng thêm, nói đúng mức:** từng bước riêng lẻ **đã** được phủ bởi bộ test hiện có. Cái mới là mạch liên tục theo đúng thứ tự demo, nên nó bắt được lỗi ở **chỗ nối giữa các bước** mà test rời rạc bỏ sót. Kèm theo là một trace Playwright dùng làm bằng chứng trong báo cáo.

**Chỉ chạy ở một viewport** là `tablet-landscape`, không chạy cả 5. Lý do: mục đích là kiểm mạch nghiệp vụ, không phải kiểm bố cục — bố cục đã có bộ mock E2E hiện tại phủ ở 5 kích thước. Chạy 5 lần chỉ làm chậm mà không thêm thông tin.

**Hệ quả đã biết:** `add-owner-account-and-store-provisioning` sẽ làm vỡ script này ở tuần 7 tới 9 vì luồng tạo cửa hàng phải viết lại. Đó là hành vi đúng: script vỡ là tín hiệu hành trình đã đổi.

## Ảnh hưởng tới cấu hình

| File | Thay đổi |
| --- | --- |
| `package.json` | Thêm devDependency `@vitest/coverage-v8`; thêm script `test:coverage` |
| `vitest.config.ts` | Thêm khối `coverage` với `include`, `exclude`, `thresholds` |
| `playwright.config.ts` | Thêm một project chạy riêng file kịch bản demo ở `tablet-landscape` |
| `playwright.supabase.config.ts` | Không đổi ở change này |

Không đổi một dòng nào trong mã nghiệp vụ.

## Risks / Trade-offs

| Rủi ro | Giảm nhẹ |
| --- | --- |
| Độ phủ hiện tại có thể thấp hơn 90% khá nhiều, và đóng khoảng cách tốn thời gian đang thiếu | Đo baseline **trước tiên**. Khoảng cách lớn thì chốt lộ trình theo mốc, không hạ ngưỡng cho vừa số đo được |
| Lấy độ phủ làm mục tiêu đẻ ra test viết cho đủ chỉ tiêu | Ngưỡng chỉ áp cho phần logic thuần, không áp cho `app` và `adapters`. Cộng với tiêu chí định tính theo loại thay đổi |
| Cổng chất lượng không có máy ép nên dễ trôi | Ghi rõ trạng thái này trong tài liệu. `add-ci-pipeline` biến nó thành cấu hình |
| Script kịch bản demo trùng lặp với bộ test đang có | Chấp nhận có chủ ý. Giá trị nằm ở mạch liên tục, và ghi rõ điều đó thay vì tuyên bố nó phủ thêm hành vi mới |
| Script kịch bản demo sẽ vỡ ở tuần 7 tới 9 | Đã biết trước, coi là tín hiệu chứ không phải lỗi. Việc sửa nó thuộc change làm vỡ nó |

## Migration Plan

Không có chuyển đổi dữ liệu. Trình tự:

1. Cài `@vitest/coverage-v8`, thêm script `test:coverage`.
2. **Đo baseline độ phủ và ghi lại con số.** Đây là cổng: chưa có số thì chưa đặt được ngưỡng có ý nghĩa.
3. Bật ngưỡng 90%. Nếu baseline dưới ngưỡng thì bật ở mức baseline làm mốc chống tụt, và ghi lộ trình nâng dần vào `tasks.md`.
4. Viết `docs/test-strategy.md`.
5. Rút gọn `docs/testing.md` còn phần nhật ký, thêm checklist thủ công.
6. Viết script kịch bản demo.
7. Cập nhật `docs/requirements.md` phần NFR-07.

## Open Questions

Không còn. Chín quyết định trong `proposal.md` đã phủ hết.
