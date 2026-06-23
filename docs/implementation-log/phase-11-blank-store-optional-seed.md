# Phase 11 - Blank Store + Optional Demo Seed

## Mục tiêu

- Tạo store không còn tự seed dữ liệu mẫu; mặc định store trống (chỉ store/settings + 1 admin).
- Cho phép tick checkbox "Khởi tạo sẵn dữ liệu mẫu" ngay khi tạo store, hoặc seed lại từ Cài đặt.
- Thu gọn bộ dữ liệu mẫu và dọn các dữ liệu giả hardcode rải rác trong UI để store trống là trống thật.

## Branch/Commit

- Branch code: `main`
- Commit: `ba58b27` (`feat(store): blank store by default with optional demo seed`).

## Đã implement

- `CreateStoreInput` thêm `address?` và `seedDemo?`; màn tạo store có checkbox seed demo (mặc định tắt) ngay trước nút tạo, gửi kèm tên + địa chỉ.
- Supabase create store: lưu `store_settings.address` từ form; nhánh `seedDemo=true` gọi `seed.seedDemo`, ngược lại `seed.seedBlank` (chỉ set `seed_status=seeded`). Seed lỗi vẫn vào app, màn kết quả hiện cảnh báo + nút thử lại (`useRetrySeedMutation`).
- Seed bundle thu gọn (`src/seed/demoSeedData.ts`): 2 category / 6 món / 1 option group / 1 khu / 4 bàn + 1 cashier demo. Tách fixture đầy đủ cho mock/test sang `mockData.ts` để không phụ thuộc bộ seed gọn.
- Mock: `createMockState()` trả store trống (1 admin); thêm `createSeededMockState()` (đầy đủ menu/floor/orders) cho test/smoke và runtime mock. `MockSeedRepo(state)` seed thật vào state; `MockSettingsRepo.clearDemoData` xóa đúng phần demo (helper `demoSeedHelpers.ts`), vẫn block khi còn order mở.
- Supabase seed idempotent: upsert trên 7 bảng editor kèm `deleted_at=null`/`deleted_by_employee_id=null` để hồi sinh row đã bị `clear_demo_data` xóa mềm; bảng `employees` không có cột tombstone (dùng `is_active`) nên không revive — đây là nguồn lỗi 400 khi áp revive toàn cục, đã fix bằng cờ `{ revive: true }` chỉ cho bảng có cột tombstone.
- Settings → Bảo trì dữ liệu: thêm action admin "Khởi tạo dữ liệu mẫu" (`seedDemoDataForAdmin` + `useSeedDemoDataMutation`) cạnh "Đặt lại dữ liệu mẫu".
- Dọn hardcode: bỏ `MOCK_PAID_TAKEAWAY` (Takeaway chỉ còn đơn mở thật) và `KITCHEN_TICKETS` (Kitchen rỗng, seam UI-only). Store pairing bỏ prefill `0001-X8F3QA`, chỉ còn placeholder.

## Quyết định kỹ thuật

- Tách "bộ demo seed của sản phẩm" (gọn, `demoSeedData.ts`) khỏi "fixture test" (đầy đủ, `mockData.ts`): test/flow cần dữ liệu giàu (orders, nhiều bàn) trong khi demo seed cần tối giản. Hai khái niệm độc lập, tránh trim demo làm vỡ test.
- Runtime mock dùng `createSeededMockState()` để dev/smoke vẫn có dữ liệu khi pair vào store mẫu; hành vi "blank by default" được kiểm chứng qua flow tạo store (`seedDemo=false`).
- Revive tombstone chỉ áp cho bảng có cột `deleted_at`/`deleted_by_employee_id`; cashier demo hồi sinh bằng `is_active=true` khi upsert (clear_demo_data deactivate chứ không tombstone employee).

## Verification

- `npm run build`: passed (vẫn cảnh báo chunk lớn như hiện trạng).
- `npm run test`: 179 tests passed (đã chuyển các test phụ thuộc dữ liệu mẫu sang `createSeededMockState`).
- Smoke desktop: flow chính xanh; cập nhật smoke bỏ thao tác click vé bếp đã xóa, và Supabase E2E tick checkbox seed để có menu/bàn tạo đơn.
- Kiểm chứng trực tiếp trên Supabase cloud (ngày 2026-06-23): tạo store trống → store_no tăng dần, key duy nhất; seed demo lỗi 400 ban đầu do revive áp nhầm bảng `employees`, sau khi fix retry seed thành công, menu/bàn/cashier demo lên đúng.

## Known Gaps/Risks

- Smoke `admin mock modules are reachable` vẫn fail do helper `cancelDirtyDrawer` tìm nút `Huỷ` trong Menu Editor (header dùng `Thoát`) — lỗi có sẵn từ trước phase này, không liên quan thay đổi seed.
- Paid takeaway và kitchen queue hiện rỗng (seam), chờ nối với đơn thật ở phase sau.

## Liên quan

- [../features.md](../features.md) — Store & Session, Takeaway, Settings & Maintenance, Optional/Future UI.
- [../data-model.md](../data-model.md) — `seed_status`, hành vi seed/blank, idempotency với `clear_demo_data`.
