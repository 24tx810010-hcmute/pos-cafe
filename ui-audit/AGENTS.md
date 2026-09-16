# Hướng dẫn cho agent: kiểm tra UI đã render

Đọc [README.md](README.md) trước khi đụng vào thư mục này.

## Khi nào dùng

Dùng `ui-audit` mỗi khi công việc chạm vào giao diện: sửa layout, đổi component,
đổi token Tailwind, thêm màn hình, hoặc khi người dùng báo "nút bấm không ăn",
"chữ bị cắt", "icon mất", "màn hình tablet vỡ". Đây là cách duy nhất trong repo
phát hiện lỗi chỉ xuất hiện sau khi trình duyệt đã render.

Không dùng nó thay cho `npm test` (logic) hay `npm run smoke` (luồng nghiệp vụ).
Nó chỉ trả lời một câu hỏi: *giao diện sau khi render có đo được lỗi nào không.*

## Quy trình bắt buộc

1. `npm run ui-audit:selftest` — phải ra 23 finding và in `selftest OK`. Nếu
   không, bộ đo đang hỏng; sửa bộ đo trước, đừng tin bất kỳ kết quả nào khác.
2. `npm run ui-audit` — chạy trên ứng dụng thật.
3. Đọc `ui-audit/report.md`, không đọc `report.json` trừ khi cần lọc bằng script.
4. Xem ảnh trong `ui-audit/out/` trước khi kết luận một finding là lỗi thật.
   Ảnh đã khoanh sẵn đúng phần tử bị bắt; phán đoán từ selector không thôi rất
   dễ sai.
5. Báo cho người dùng danh sách đã phân loại lỗi thật / dương tính giả **trước
   khi** chạy `--update`.

Không bao giờ tự chạy `npm run ui-audit:update`. Lệnh đó chấp nhận toàn bộ lỗi
hiện có làm chuẩn mới, và chỉ người dùng mới được quyết định điều đó.

## Thêm màn hình cần đo

Sửa `states` trong `ui-audit/config.json`, không sửa `run.mjs`. Lấy `data-testid`
từ `tests/smoke/demo-runbook.spec.ts` và `tests/smoke/helpers.ts` — hai file đó
đã có sẵn công thức đăng nhập và id của dữ liệu mock. Cú pháp `steps` mô tả trong
README.

Một trạng thái mới nên `extends` trạng thái gần nhất đã có, để phần đăng nhập
không bị chép lại.

## Ranh giới

- `ui-audit/` là công cụ đo, không phải code ứng dụng. Sửa ở đây không được đổi
  hành vi của `src/`.
- Khi audit chỉ ra lỗi trong `src/`, báo lỗi kèm selector và ảnh; chỉ sửa `src/`
  khi người dùng yêu cầu.
- `audit.js` là bản vendor của một kit bên ngoài. Ba bản vá riêng cho pos-cafe
  đều có chú thích `pos-cafe local patch` hoặc nêu rõ lý do trong comment. Giữ
  nguyên quy ước đó để về sau còn so được với phiên bản mới của kit.
- Sau mỗi lần sửa `audit.js`, chạy lại selftest.

## Nhóm dương tính giả đã biết

- Nhãn của thanh điều hướng trái khi thu gọn ở màn hình hẹp bị bắt
  `clipped-text` / `clipped-text-vertical`. Đó là thu gọn có chủ đích.
- `tiny-target` ở ngưỡng sát 24px (ví dụ 56x23) là cảnh báo biên, không phải lỗi
  chức năng.

Ba nhóm dương tính giả lớn hơn — nền sau drawer, toast trôi qua, và nền gradient
— đã được xử lý ngay trong `audit.js`. Nếu chúng quay lại, đọc mục "Ba bản vá
riêng cho pos-cafe" trong README trước khi thêm luật loại trừ mới.
