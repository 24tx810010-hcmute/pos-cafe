# POS Cafe Demo Readiness Runbook

> Mục tiêu: checklist vận hành cho buổi demo/bảo vệ. File này không chứa Store Key thật, PIN riêng, service role key, hoặc URL private.

## 1. Trạng thái code cần dùng

- Code branch demo hiện tại: `main`.
- Docs branch hiện tại: `docs`; `main` đã có bản docs mới nhất sau merge.
- Supabase cloud đã apply migrations `001` -> `004`, gồm realtime publication migration `004_realtime_publication.sql`.
- Supabase UI E2E đã pass:
  - Single browser: create store -> passcode -> order -> payment -> history/report.
  - 2 browser realtime: browser A tạo order, browser B thấy table occupied; browser B pay, browser A thấy table empty.
- Verification mới nhất 2026-06-14: `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` pass 2/2.

Deploy Vercel nên trỏ `main`. Nếu dùng preview branch riêng, cần smoke lại đúng preview URL trước demo.

## 2. Env bắt buộc

Local `.env.local` hoặc Vercel Environment Variables:

```text
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Không dùng service role key trong frontend. Không commit `.env.local`.

## 3. Checklist trước ngày demo

1. Wake Supabase project.
   - Mở Supabase Dashboard project.
   - Mở app public URL một lần.
   - Nếu project free bị pause, resume trước giờ demo.

2. Verify Vercel.
   - Production hoặc preview deployment build xanh.
   - Env trên Vercel có đủ `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - URL public mở được trên laptop và thiết bị thứ hai.

3. Verify cloud flow.
   - Chạy local:

```powershell
npm run build
VITE_DATA_MODE=supabase npm run build
npm run smoke:supabase
$env:RUN_SUPABASE_REALTIME_E2E='1'
npm run smoke:supabase
Remove-Item Env:\RUN_SUPABASE_REALTIME_E2E
```

4. Chuẩn bị mạng.
   - Wi-Fi chính.
   - Hotspot 4G backup vì app là online-only.

5. Chuẩn bị credential demo ngoài repo.
   - Store Key demo nếu muốn dùng lại store cũ.
   - Admin PIN.
   - Cashier PIN demo mặc định: `111111`.
   - Nếu tạo store mới live, ghi Store Key/Admin PIN ở giấy/notes riêng, không đưa vào docs/git.

## 4. Kịch bản demo chính

### Mở đầu

- Nói rõ đây là app POS quán cà phê online-only, đa thiết bị, dữ liệu cloud.
- Nhấn mạnh scope: một quán/account, không phải quản lý chuỗi nhiều chi nhánh.
- Nói kiến trúc: React/Vite frontend, Supabase Postgres/Auth/Realtime/RLS, UI gọi qua ports/hooks, không gọi Supabase trực tiếp từ component.

### Tạo quán hoặc ghép quán

Option A - tạo store mới:

1. Mở app public URL.
2. Chọn `Tạo quán mới`.
3. Nhập tên quán.
4. Tạo store.
5. Ghi Store Key/Admin PIN hiển thị một lần.
6. Vào màn PIN và login admin.

Option B - dùng store đã chuẩn bị:

1. Chọn `Đã có quán`.
2. Nhập Store Key đã chuẩn bị ngoài repo.
3. Login PIN admin.

### Demo POS dine-in

1. Mở `Sơ đồ bàn`.
2. Chọn một bàn trống.
3. Thêm 1-2 món.
4. Bấm `In/Gửi đơn`.
5. Xem bàn chuyển sang occupied.

### Demo realtime 2 thiết bị

1. Thiết bị/browser B ghép cùng Store Key.
2. Browser B login admin hoặc cashier.
3. Browser A tạo order ở một bàn.
4. Browser B thấy bàn chuyển occupied sau realtime invalidation/refetch.
5. Browser B mở thanh toán, thanh toán tiền mặt.
6. Browser A thấy bàn empty lại.

### Demo report/history

1. Mở `Lịch sử`, chọn đơn vừa paid.
2. Mở `Báo cáo`, kiểm tra doanh thu hôm nay có order vừa thanh toán.
3. Nói rõ report tính từ order `paid`, không tính open/void.

### Demo editor

Menu Editor:

1. Mở `Menu`.
2. Tạo/sửa một món nhỏ.
3. Save.
4. Nói rõ save dùng changeset `created/updated/deleted`, soft delete bằng tombstone.

Floor Editor:

1. Mở `Sơ đồ`.
2. Thêm/sửa bàn/decor nhỏ.
3. Save.
4. Nói rõ stage logical `1600x900`, UI scale theo màn hình, DB lưu logical units, không lưu pixel viewport.
5. Nói rõ floor save không ghi đè `tables.status`.

### Demo nhân viên/settings

1. Mở `NV`, tạo hoặc tạm khoá cashier.
2. Mở `Cài đặt`, chỉnh tên quán/footer hoá đơn.
3. Mở `Clear demo data`.
4. Nếu còn open order, cho thấy bị chặn.
5. Nếu không còn open order, chỉ clear seed bundle, không xoá data user tự tạo.

## 5. Fallback khi demo lỗi

Cloud bị pause:

- Resume Supabase project trong dashboard.
- Mở lại app sau khi project active.
- Chạy `npm run smoke:supabase` local nếu cần xác nhận.

Mạng yếu:

- Chuyển sang hotspot 4G.
- Reload cả hai thiết bị.
- Pair lại bằng Store Key nếu session bị mất.

Realtime chậm:

- Bấm `Làm mới` trên màn Sơ đồ bàn.
- Giải thích realtime trong MVP dùng signal để invalidate/refetch, không patch state thủ công.

Store demo bị bẩn:

- Ưu tiên tạo store mới.
- Không chạy SQL delete thủ công khi đang demo.
- Nếu dùng Clear demo, nhớ nó chỉ clear seed data và block khi còn open orders.

Frontend public deploy lỗi:

- Mở local dev app với Supabase env.
- Fallback UI mock chỉ dùng để trình bày giao diện khi cloud/network không thể phục hồi:

```powershell
$env:VITE_DATA_MODE='mock'
npm run dev
Remove-Item Env:\VITE_DATA_MODE
```

## 6. Câu trả lời ngắn khi bảo vệ

- Vì sao web app: nhiều thiết bị dùng chung dữ liệu cloud, không cần cài app native, deploy miễn phí bằng Vercel + Supabase.
- Vì sao Store Key + PIN: đúng mô hình POS, ghép máy một lần bằng credential cấp quán, nhân viên dùng PIN hằng ngày.
- Giới hạn bảo mật: PIN là guard tầng app; RLS cô lập store account; ai có Store Key thì có session cấp quán, nên Store Key là secret.
- Vì sao online-only: phù hợp thời gian TLCN, realtime live đơn giản; offline-first được để seam sau bằng UUID client, tombstone, ports và sync transport.
- Vì sao editor changeset: tránh lưu blob lớn, hỗ trợ realtime/refetch, tombstone, và mở đường sync/offline sau này.
- Vì sao không lưu pixel floor: layout lưu logical units `1600x900`, UI scale-to-fit theo màn hình nên ổn trên nhiều viewport.

## 7. Checklist cuối trước khi trình bày

- Supabase awake.
- Vercel URL public mở được.
- Store Key demo và PIN nằm ngoài repo.
- 2 thiết bị/browser đã test cùng Store Key.
- Hotspot backup sẵn.
- `npm run smoke:supabase` pass trong ngày demo.
- `RUN_SUPABASE_REALTIME_E2E=1 npm run smoke:supabase` pass nếu có thời gian kiểm tra realtime.
