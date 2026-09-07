# Kế hoạch kiểm thử

## Phạm vi

Change này giao ba loại sản phẩm: **cấu hình** (ngưỡng độ phủ, project Playwright mới), **mã kiểm thử** (script kịch bản demo), và **tài liệu** (`docs/test-strategy.md`, `docs/testing.md`). Kế hoạch dưới đây kiểm chứng cả ba.

Về bốn nhóm bắt buộc của `openspec/SPEC-STANDARD.md` mục 5:

| Nhóm | Áp dụng ở đây |
| --- | --- |
| Luồng chính | TC-TEST-01 tới 05 |
| Luồng ngoại lệ | TC-TEST-06 tới 09 |
| Biên | TC-TEST-10, 11 |
| **Bảo mật và quyền** | **Không áp dụng trực tiếp.** Change này không đụng quyền, tiền hay dữ liệu cửa hàng. Nhóm này được chuyển thành **luật** ở UC-TEST-03 và ràng buộc ở TC-TEST-12, để mọi change sau đụng quyền đều bị buộc phải có |

Việc **viết** ba ca cloud E2E bắt buộc ở quyết định 8 thuộc `expand-e2e-coverage`, không thuộc change này. Ở đây chúng được ghi thành yêu cầu bàn giao, xem TC-TEST-12.

---

## Nhóm A — Luồng chính

### TC-TEST-01 — Cấu hình độ phủ chạy được và báo đúng phạm vi

| | |
| --- | --- |
| **Truy vết** | UC-TEST-01; quyết định 2 và 5 |
| **Mức** | tích hợp, chạy tay một lần khi dựng |
| **Tiền điều kiện** | Đã cài `@vitest/coverage-v8`; đã thêm khối `coverage` vào `vitest.config.ts` |
| **Dữ liệu thử** | Kho mã ở baseline đang làm việc |

**Các bước**

1. Chạy `npm run test:coverage`.
2. Đọc báo cáo độ phủ sinh ra.

**Kết quả mong đợi**

- Lệnh chạy xong không lỗi.
- Báo cáo **có** liệt kê các file trong `src/core/` và `src/features/` không phải `use*.ts`.
- Báo cáo **không** liệt kê `src/domain/`, `src/app/`, `src/adapters/`, `src/seed/`, và các file `use*.ts`.
- Báo cáo in ra một con số phần trăm dòng cho toàn phạm vi gộp.

**Nơi hiện thực** — `vitest.config.ts`, kiểm bằng tay.

---

### TC-TEST-02 — Ghi lại số độ phủ nền

| | |
| --- | --- |
| **Truy vết** | Quyết định 2; mục Migration Plan bước 2 của `design.md` |
| **Mức** | tích hợp, chạy tay một lần |
| **Tiền điều kiện** | TC-TEST-01 đã qua |
| **Dữ liệu thử** | Baseline ghi rõ mã commit |

**Các bước**

1. Chạy `npm run test:coverage`.
2. Ghi con số phần trăm dòng, kèm mã commit và ngày, vào `docs/testing.md`.

**Kết quả mong đợi**

- `docs/testing.md` có một dòng ghi độ phủ nền, kèm **cả** baseline **và** ngày.
- Nếu số nền dưới 90%, có thêm một mục trong `tasks.md` ghi khoảng cách và lộ trình đóng.

**Nơi hiện thực** — `docs/testing.md`.

---

### TC-TEST-03 — Script kịch bản demo chạy hết 14 bước

| | |
| --- | --- |
| **Truy vết** | UC-TEST-04; quyết định 9 |
| **Mức** | E2E trên adapter mock |
| **Tiền điều kiện** | `npm run smoke` chạy được; adapter mock có dữ liệu seed đủ |
| **Dữ liệu thử** | Dữ liệu seed mặc định của `createSeededMockState()` |

**Các bước**

1. Chạy project Playwright dành riêng cho kịch bản demo, ở viewport `tablet-landscape`.
2. Script đi tuần tự bước 1 tới 14 của `docs/demo-runbook.md`: mở ứng dụng ngang, ghép hoặc tạo cửa hàng, nhập PIN, mở bàn trống, tạo đơn tại chỗ có tùy chọn món, gửi đơn, xác nhận bàn chuyển sang đang phục vụ, mở lại đơn, tách đơn thanh toán một phần rồi **kiểm doanh thu cộng vào ngay**, xác nhận hai đơn độc lập, thanh toán phần còn lại, xác nhận bàn trống, mở lịch sử và báo cáo, hủy một đơn đã thanh toán có lý do, xác nhận báo cáo tách doanh thu và tiền hủy, đổi quyền một nhân viên rồi đăng nhập lại và xác nhận nút thanh toán bị khóa.

**Kết quả mong đợi**

- Test xanh, chạy liền một mạch không tách thành nhiều test.
- Sinh ra một trace Playwright lưu lại được.
- Thời gian chạy dưới 90 giây.

**Nơi hiện thực** — `tests/smoke/demo-runbook.spec.ts`.

---

### TC-TEST-04 — Cổng chất lượng chạy đủ bốn lệnh

| | |
| --- | --- |
| **Truy vết** | UC-TEST-01, UC-TEST-05; quyết định 3 |
| **Mức** | tích hợp, chạy tay |
| **Tiền điều kiện** | Kho mã sạch |

**Các bước**

1. Chạy lần lượt `npm run build`, `npm test`, `npm run test:coverage`, `npm run smoke`.

**Kết quả mong đợi**

- Cả bốn lệnh tồn tại trong `package.json` và chạy được.
- Cả bốn cùng xanh trên baseline hiện tại.
- `npm run smoke:supabase` **không** nằm trong danh sách này.

**Nơi hiện thực** — `package.json`, kiểm bằng tay.

---

### TC-TEST-05 — Hai tài liệu tách đúng vai trò

| | |
| --- | --- |
| **Truy vết** | UC-TEST-05; quyết định 7 |
| **Mức** | rà soát tài liệu |

**Các bước**

1. Mở `docs/test-strategy.md` và `docs/testing.md`.

**Kết quả mong đợi**

- `docs/test-strategy.md` chứa: bảng sáu tầng kèm cột "không kiểm", bảng tiêu chí theo loại thay đổi, bảng cổng chất lượng, quy ước đặt tên và vị trí file.
- `docs/testing.md` chứa: nhật ký kết quả chạy có baseline và ngày, cộng checklist thủ công có cột ngày.
- **Không** có nội dung trùng nhau giữa hai file.

---

## Nhóm B — Luồng ngoại lệ

### TC-TEST-06 — Độ phủ dưới ngưỡng thì lệnh phải đỏ

| | |
| --- | --- |
| **Truy vết** | UC-TEST-01 nhánh 5a; quyết định 2 |
| **Mức** | tích hợp |
| **Tiền điều kiện** | Ngưỡng đã bật trong `vitest.config.ts` |
| **Dữ liệu thử** | Tạm thời đặt ngưỡng cao hơn số hiện đạt 5 điểm phần trăm |

**Các bước**

1. Sửa ngưỡng trong `vitest.config.ts` lên mức chắc chắn không đạt.
2. Chạy `npm run test:coverage`.
3. Trả ngưỡng về giá trị thật.

**Kết quả mong đợi**

- Bước 2 kết thúc với mã thoát khác 0.
- Thông báo nêu rõ độ phủ thực tế và ngưỡng yêu cầu.

**Ghi chú** — Đây là phép thử chứng minh ngưỡng có tác dụng thật. Không có nó thì không biết ngưỡng có được thực thi hay chỉ nằm trong cấu hình.

---

### TC-TEST-07 — File mới trong `features` tự vào phạm vi đo

| | |
| --- | --- |
| **Truy vết** | UC-TEST-01 nhánh 5b; quyết định 2 |
| **Mức** | tích hợp |
| **Dữ liệu thử** | Một file tạm `src/features/pos/tmpProbe.ts` chứa một hàm không có test |

**Các bước**

1. Tạo file tạm chứa một hàm thuần chưa có test nào.
2. Chạy `npm run test:coverage`.
3. Xóa file tạm.

**Kết quả mong đợi**

- File tạm **có** xuất hiện trong báo cáo độ phủ với mức 0%.
- Độ phủ gộp giảm xuống.

**Ghi chú** — Chứng minh phạm vi đo là luật chứ không phải danh sách liệt kê tay, đúng như mục Decisions 4 của `design.md`.

---

### TC-TEST-08 — Hook `use*.ts` không lọt vào phạm vi đo

| | |
| --- | --- |
| **Truy vết** | Quyết định 2 |
| **Mức** | tích hợp |
| **Dữ liệu thử** | Các file `useOrderPaymentFlow.ts`, `usePosData.ts`, `useOrderModifierPicker.ts` đang có |

**Các bước**

1. Chạy `npm run test:coverage`.
2. Tìm ba file trên trong báo cáo.

**Kết quả mong đợi**

- Cả ba **không** xuất hiện trong báo cáo.

---

### TC-TEST-09 — Script kịch bản demo đỏ khi hành trình đổi

| | |
| --- | --- |
| **Truy vết** | UC-TEST-04 nhánh 2a; quyết định 9 |
| **Mức** | E2E trên mock |
| **Dữ liệu thử** | Tạm gỡ `data-testid` của nút gửi đơn ở `src/app/drawers/pos/OrderCartPane.tsx` |

**Các bước**

1. Gỡ thuộc tính `data-testid="submit-order-button-footer"` khỏi component.
2. Chạy project kịch bản demo.
3. Hoàn tác thay đổi.

**Kết quả mong đợi**

- Bước 2 đỏ, và thông báo chỉ đúng bước đang hỏng.

**Ghi chú** — Chứng minh script thực sự đi qua các bước chứ không chỉ mở ứng dụng rồi kết thúc. Không có phép thử này thì một script rỗng cũng xanh.

**Sửa ngày 2026-09-07.** Bản đầu ghi "đổi nhãn của một nút" và **sai**: script bám `data-testid` chứ không bám chuỗi hiển thị, nên đổi nhãn sẽ không làm test đỏ. Phép thử khi đó tự nó xanh và không chứng minh được điều gì — đúng loại lỗi mà chính test case này sinh ra để phát hiện.

---

## Nhóm C — Giá trị biên

### TC-TEST-10 — Ngưỡng đúng tại 90%

| | |
| --- | --- |
| **Truy vết** | Quyết định 2 |
| **Mức** | tích hợp |
| **Dữ liệu thử** | Đặt ngưỡng bằng đúng con số độ phủ hiện đạt |

**Các bước**

1. Đặt ngưỡng bằng đúng số hiện đạt.
2. Chạy `npm run test:coverage`.

**Kết quả mong đợi**

- Lệnh xanh. Điều kiện là **lớn hơn hoặc bằng**, không phải lớn hơn.

---

### TC-TEST-11 — Phạm vi đo không rỗng

| | |
| --- | --- |
| **Truy vết** | Quyết định 2 |
| **Mức** | tích hợp |

**Các bước**

1. Chạy `npm run test:coverage`.
2. Đếm số file trong báo cáo.

**Kết quả mong đợi**

- Số file ≥ 24, gồm 4 file của `core` và ít nhất 20 module không phải hook của `features`.

**Ghi chú** — Chặn ca hỏng âm thầm khi mẫu đường dẫn viết sai làm phạm vi rỗng, lúc đó độ phủ báo 100% mà không đo gì cả. Đây là kiểu sai dễ xảy ra và khó nhận ra nhất của cấu hình độ phủ.

---

## Nhóm D — Bàn giao

### TC-TEST-12 — Ba ca cloud E2E bắt buộc được ghi thành yêu cầu cho change sau

| | |
| --- | --- |
| **Truy vết** | Quyết định 8; UC-TEST-03 |
| **Mức** | rà soát tài liệu |

**Các bước**

1. Mở `docs/test-strategy.md`.

**Kết quả mong đợi**

Tài liệu ghi rõ ba ca bắt buộc, kèm lý do từng ca là thứ adapter mock không chứng minh được:

| Ca | Trạng thái hiện tại |
| --- | --- |
| Cô lập chéo cửa hàng: phiên cửa hàng A đọc dữ liệu cửa hàng B phải rỗng | **Chưa có test nào** |
| Xung đột khóa lạc quan trả `ORDER_VERSION_CONFLICT` | Chưa có ở tầng cloud |
| Không trùng số bill khi thanh toán đồng thời | Chưa có |

Và ghi rõ việc **viết** ba ca này thuộc `expand-e2e-coverage`, không thuộc change hiện tại.

---

### TC-TEST-13 — Mọi quyết định có đánh đổi đều ghi phương án bị loại kèm lý do

| | |
| --- | --- |
| **Truy vết** | Quyết định 1; `openspec/SPEC-STANDARD.md` mục "Quy tắc viết" |
| **Mức** | rà soát tài liệu |

**Các bước**

1. Mở mục `## Quyết định đã chốt` của `proposal.md`.
2. Với từng quyết định có nhiều hơn một phương án khả dĩ, kiểm xem có ghi phương án đã cân nhắc và lý do loại hay không.

**Kết quả mong đợi**

- Quyết định 2, 3, 4, 5, 7 và 8 đều có phần nêu phương án bị loại kèm lý do loại.
- Quyết định 9 ghi rõ đề xuất ban đầu đã bị bác và vì sao lý lẽ bác là đúng.

**Ghi chú** — Đây là phép kiểm cho chính quyết định 1. Không có nó thì quyết định 1 chỉ là lời tuyên bố, và phần lập luận mà báo cáo cần sẽ rơi rụng dần khi tiến độ gấp. Áp cho mọi change sau, không riêng change này.

---

## Tổng kết độ phủ của kế hoạch

| Nhóm | Số test case | Trạng thái |
| --- | --- | --- |
| Luồng chính | 5 | TC-TEST-01 … 05 |
| Luồng ngoại lệ | 4 | TC-TEST-06 … 09 |
| Biên | 2 | TC-TEST-10, 11 |
| Bảo mật và quyền | 0 trực tiếp | Chuyển thành luật, xem TC-TEST-12 và UC-TEST-03 |
| Bàn giao và rà soát | 2 | TC-TEST-12, 13 |
| **Cộng** | **13** | |
