# UI audit — dò lỗi giao diện đã render

Bộ này đo DOM thật của ứng dụng đang chạy (`getBoundingClientRect`,
`getComputedStyle`, `elementFromPoint`) để tìm các lỗi mà đọc code không ra:

- nút bị lớp phủ trong suốt che mất click,
- icon render 0x0 vì font icon không tải được,
- chuỗi `undefined` / `[object Object]` lọt ra màn hình,
- vùng chạm nhỏ hơn ngón tay,
- chữ bị cắt mà không có dấu `…`,
- phần tử tràn ngang viewport,
- tương phản dưới ngưỡng WCAG AA.

Không có mô hình AI trong vòng lặp và không so ảnh chụp màn hình. Cùng một trang
luôn cho ra cùng một kết quả, nên có thể đặt vào CI và chặn hồi quy.

Bảng đầy đủ 18 luật nằm ở [UPSTREAM-README.md](UPSTREAM-README.md) — đó là bản
gốc của bộ kit, giữ nguyên để về sau còn so được với phiên bản mới.

## Chạy

```bash
npm run ui-audit
```

Lệnh này tự bật dev server ở chế độ mock (`VITE_DATA_MODE=mock`, cổng 5178) nếu
chưa có, chạy hết các trạng thái trong `config.json` trên cả ba viewport, rồi tắt
server. Nếu đã có sẵn server ở cổng đó thì nó dùng lại và không tắt.

Các lệnh khác:

```bash
npm run ui-audit:selftest              # kiểm tra chính bộ đo, xem mục bên dưới
node ui-audit/run.mjs --list           # liệt kê trạng thái và viewport đã cấu hình
node ui-audit/run.mjs --state floor    # chỉ chạy một trạng thái
node ui-audit/run.mjs --viewport tablet
npm run ui-audit:update                # chốt kết quả hiện tại thành baseline
```

Kết quả:

- `ui-audit/report.md` — bảng tổng hợp theo severity, theo luật, theo trạng thái,
  rồi tới từng finding. Đây là file nên đọc.
- `ui-audit/report.json` — cùng dữ liệu, dạng máy đọc.
- `ui-audit/out/*.png` — ảnh chụp toàn trang, có khoanh đỏ/cam đúng chỗ bị bắt.
- Mã thoát 1 khi xuất hiện finding chưa nằm trong `baseline.json`.

Ba file kết quả đều nằm trong `.gitignore`. Chỉ `baseline.json` được commit.

## Tự kiểm tra bộ đo trước khi tin kết quả

`demo-buggy.html` là một trang có sẵn chín lỗi cố ý. Nếu bộ đo ngừng thấy chúng
thì mọi lần chạy sạch trên ứng dụng thật đều là kết quả giả.

```bash
npm run ui-audit:selftest
```

Phải ra 23 finding và phải có đủ 14 luật trong danh sách `SELFTEST_REQUIRED` ở
[run.mjs](run.mjs). Chạy lệnh này sau mỗi lần sửa `audit.js`, và trước khi tin
một báo cáo "không có lỗi nào".

## Trạng thái, không phải route

pos-cafe không có router URL. Toàn bộ ứng dụng là một trang, điều hướng bằng
zustand store (`src/app/useAppStore.ts`), nên chỉ có đúng một URL là `/`. Vì vậy
mục tiêu đo ở đây là **trạng thái** — một tên, kèm vài bước Playwright để đi tới
màn hình cần đo:

```json
{
  "name": "order-cart",
  "describe": "drawer goi mon co 1 mon trong gio",
  "extends": "order-drawer",
  "steps": [
    { "click": "@menu-item-3e43bb8c-198f-443f-83ab-18696983edaa" },
    { "click": "@modifier-confirm" },
    { "waitFor": "@order-cart-line" }
  ]
}
```

- `@ten` là viết tắt của `[data-testid="ten"]`. Chuỗi không có `@` được hiểu là
  CSS selector thường.
- `extends` nối tiếp các bước của trạng thái cha, nên phần đăng nhập chỉ viết một
  lần ở `floor` rồi mọi drawer kế thừa lại.
- Các bước hỗ trợ: `click`, `clickAll`, `fill` + `value`, `press`, `waitFor`
  (+ `state`), `wait` (mili giây), và `timeout` riêng cho từng bước.
- Mỗi trạng thái chạy trong một browser context mới, vì ứng dụng lưu phiên ghép
  cửa hàng vào localStorage; dùng lại context thì trạng thái sau sẽ phụ thuộc
  trạng thái trước.

Dữ liệu mock dùng chung với `tests/smoke` — mã cửa hàng `0001-X8F3QA`, nhân viên
`6b7bd350-…`, PIN `123456`, bàn `7b035353-…`, món `3e43bb8c-…`. Khi cần thêm màn
hình, lấy test id từ `tests/smoke/demo-runbook.spec.ts` là nhanh nhất.

Danh sách trạng thái hiện có cố tình để nhỏ: `landing`, `store-pairing`,
`passcode`, `floor`, `order-drawer`, `order-cart`, `menu-editor`, `report`.
Thêm màn hình là thêm một khối vào `states` trong `config.json`, không phải sửa
code.

## Ba bản vá riêng cho pos-cafe

`audit.js` là bản gốc của kit cộng thêm ba chỗ, đều có chú thích trong file:

1. **Chỉ đo lớp trên cùng** (`scopeToTopLayer`). Khi drawer đang mở, mọi control
   của nền đều bị che, nên `hit-blocked` và `overlapping-controls` bắn ra toàn bộ
   nền và chôn mất finding thật. Bộ đo tìm phần tử `position: fixed` phủ ≥ 60%
   viewport và chỉ soi bên trong nó. Lần chạy đầu giảm từ 70 xuống 13 finding chỉ
   nhờ bản vá này.
2. **Bỏ qua lớp thông báo** (`skipTransientOverlays`). `react-hot-toast` render
   một container `position: fixed` + `pointer-events: none` phủ gần hết viewport.
   Toast trôi qua trong vài giây và làm `hit-blocked` bắn ra ngẫu nhiên tuỳ tốc độ
   chạy. Đặc trưng "fixed + click xuyên qua + cỡ viewport" chỉ có ở lớp thông báo,
   nên bỏ qua trọn container là an toàn.
3. **Không đoán màu nền gradient.** Thẻ tổng quan trong drawer báo cáo dùng nền
   gradient teal; `backgroundColor` của nó trong suốt nên bộ đo cũ leo lên tới nền
   trắng và báo sai tương phản. Nay gặp `background-image` khác `none` thì bỏ qua
   phép đo tương phản thay vì đoán.

Ngoài ra `run.mjs` gộp các finding chỉ khác nhau ở `:nth-of-type(N)` và chuẩn hoá
id kiểu `useId` của React (`#:r5:`). Một danh sách 40 món hỏng cùng kiểu sẽ ra
một dòng kèm `x40`, và baseline không vỡ khi dữ liệu seed đổi. Tắt bằng
`"collapse": false`.

## Quy trình tiếp nhận trên codebase đã lớn

1. Chạy `npm run ui-audit:selftest`, phải OK.
2. Chạy `npm run ui-audit`, đọc `report.md`, phân loại lỗi thật và dương tính giả.
3. Chạy `npm run ui-audit:update` một lần và commit `baseline.json`. Toàn bộ
   finding hiện tại được chấp nhận, build xanh trở lại.
4. Từ đó chỉ finding **mới** mới làm đỏ build, nên không lỗi UI nào thuộc các
   nhóm này lọt thêm vào được.
5. Giảm dần baseline. Mỗi lỗi sửa xong là một dòng bị xoá.

Finding được định danh bằng trạng thái + viewport + luật + selector, không bằng
pixel, nên thay đổi layout không liên quan sẽ không làm baseline nhiễu như cách
so ảnh chụp.

## Loại trừ

Thêm `data-ui-audit-skip` vào một nhánh DOM, hoặc thêm selector vào `ignore`
trong `config.json`. Hiện đang loại trừ biểu đồ recharts trong drawer báo cáo.

`severityOverride` trong `config.json` cho phép hạ hoặc nâng mức của một luật mà
không phải sửa `audit.js`, giữ cho bản vá còn dễ so với kit gốc.

## CI

```yaml
- run: npm ci && npx playwright install --with-deps chromium
- run: npm run ui-audit:selftest
- run: npm run ui-audit
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: ui-audit-screenshots
    path: ui-audit/out/
```

Bộ này dùng `chromium` từ `@playwright/test` đã có sẵn trong `devDependencies`,
không thêm gói `playwright` riêng để tránh hai bản Playwright lệch phiên bản.
