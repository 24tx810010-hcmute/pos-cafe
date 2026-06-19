# Design Spec — Hệ thống POS Quán Cà Phê (multi-store, online-only)

> **Trạng thái:** Đã chốt qua brainstorm 2026-06-09. Source of truth cho các session sau.
> **Bước kế:** implementation contract → multi-agent coding plan.
> **Schema/RLS:** [2026-06-10-pos-cafe-schema-rls-decisions.md](2026-06-10-pos-cafe-schema-rls-decisions.md)
> **Coding decisions:** [2026-06-11-pos-cafe-coding-decisions.md](2026-06-11-pos-cafe-coding-decisions.md)
> **Implementation contract:** [2026-06-11-pos-cafe-implementation-contract.md](2026-06-11-pos-cafe-implementation-contract.md)

---

## 1. Bối cảnh

- **Môn:** Tiểu Luận Chuyên Ngành (TLCN), Hệ VHVL — ĐH SPKT TP.HCM, Khoa CNTT
- **HK:** HK1 2025–2026 · **GV:** Huỳnh Xuân Phụng
- **Nhóm 3 người:** Người 1 (chính): ra yêu cầu + kiểm thử, **AI lập trình chính**. Người 2: test + báo cáo Word. Người 3: không thực chất.
- **Ràng buộc:** < 1 tháng, ~2h/ngày, **0 đồng** (free tier).

## 2. Đề tài

> **"Xây dựng hệ thống quản lý order quán cà phê đa chi nhánh, phân quyền theo vai trò"**

**Điểm đặc sắc (khác đối thủ):** 2 trình soạn trực quan — **Menu Editor** và **Floor-Plan Editor** (sơ đồ bàn). Flagship, ưu tiên cao nhất.

---

## 3. Auth & Multi-tenant — Store Key (cốt lõi)

POS thật không bắt nhân viên đăng nhập email. Mô hình 2 tầng:

| Tầng | Là gì | Enforce ở đâu |
|---|---|---|
| **Store** (quán) | 1 Supabase Auth account / quán | **RLS tại DB** — cô lập dữ liệu giữa các quán theo `store_id` |
| **Employee** (nhân viên) | record dưới store, có `passcode_hash` + `role` | **Tầng app (Core guard + UI)** — không phải RLS |

### 3.1 Luồng vào (online-only)

```
App mở
 └─ thiết bị đã ghép? (session Supabase trong localStorage)
      ├─ CHƯA → LANDING (2 thẻ: "Đã có quán" | "Tạo quán mới")
      │          ├─ Đã có quán → nhập Store Key (`store_no-secret`) → ghép (signIn) → session persist → PASSCODE
      │          └─ Tạo quán mới → tạo store_no kế tiếp + secret + seed demo → hiện Store Key + admin PIN 1 lần → PASSCODE
      └─ RỒI → PASSCODE (chọn nhân viên + PIN)
                 └─ link nhỏ "Đổi quán / Tạo quán mới / Gỡ ghép" → signOut → LANDING
```

- **Store Key chỉ xuất hiện ở LANDING.** Daily đã ghép → vào thẳng passcode. Gỡ ghép đặt ở passcode (link nhỏ) + general-setting.
- **Tạo quán tức thì, KHÔNG email** (Store Key là credential). Email = field recovery optional.

### 3.2 Store Key — kỹ thuật

- Format MVP: `STORE_NO-SECRET` (vd `0001-X8F3QA`). `STORE_NO` là số tăng dần để dễ đọc; `SECRET` là chuỗi ngẫu nhiên bắt buộc.
  - **KHÔNG cho nhập mỗi số store để vào quán.** Store number là định danh công khai, không phải credential. Nếu chỉ nhập `1`, `2`, `3` thì quá dễ đoán, mất luận điểm bảo mật/multi-tenant.
  - App tách:
    - `email = store<store_no>@store.pos.local` (ẩn, user không thấy)
    - `password = <secret>` → `supabase.auth.signInWithPassword(...)`
    - **Không cần bảng lookup public**, RLS sạch.
- Tạo quán MVP:
  - FE gọi RPC `get_next_store_no()` để lấy `store_no`; RPC dùng Postgres sequence, race-safe, **cho phép hở số** nếu tạo store/signUp lỗi.
  - FE sinh `secret`, gọi Supabase Auth `signUp` bằng email ẩn `store<store_no>@store.pos.local`.
  - Sau khi có session store account, client insert `stores`/`store_settings` và seed bằng TS seed bundle trong repo.
  - Tạo admin `employee` + PIN qua RPC/hash flow, cập nhật `stores.seed_status = seeded|failed`.
  - Nếu signUp/store tạo xong nhưng seed lỗi: giữ store, set `stores.seed_status = failed`, UI hiện **Retry seed**; không bắt user xoá store/tạo lại.
  - **Hiện Store Key + admin PIN 1 lần.**
- Sau pairing/create-store, app **không persist raw Store Key/secret** trong domain session hoặc local app state. `CreateStoreResult` được phép trả `storeKey` để hiển thị 1 lần; `StoreSession` chỉ giữ `storeId/storeNo` và Supabase Auth session.
- Nhiều thiết bị cùng quán = cùng store account → ghép bằng cùng Store Key. Chủ đưa mã cho nhân viên.

### 3.3 Caveat bảo mật (ghi rõ khi bảo vệ)

Ai có Store Key + ghép máy → có session Supabase mà RLS cho đọc toàn bộ data quán (gọi API trực tiếp, bỏ qua UI passcode). **Passcode chỉ là rào tầng app, không phải rào DB.** Chấp nhận cho TLCN:
- Passcode = danh tính thao tác (ai đứng máy) → audit + phân quyền UX.
- Store Key = bí mật cấp quán, như license/mật khẩu wifi quán.
- Cô lập **giữa các quán** vẫn là rào DB thật (RLS) — luận điểm multi-tenant chính.
- RPC có thể check employee active/role để giảm lỗi thao tác và phục vụ audit, nhưng đây là guardrail spoofable nếu người gọi đã có Store Key/session. Không claim employee-level DB security khi bảo vệ nếu chưa thiết kế auth/token/RLS riêng cho từng nhân viên.

> **Câu phòng thủ:** "Cô lập dữ liệu giữa chi nhánh enforce tại DB bằng RLS theo store_id. Phân quyền nhân viên enforce tại tầng nghiệp vụ sau xác thực PIN — đúng mô hình POS thương mại (Square, KiotViet)."

### 3.4 Passcode/PIN — kỹ thuật

- Flow passcode chốt là **chọn nhân viên + nhập PIN**; không dùng PIN-only làm flow chính.
- Không yêu cầu PIN unique toàn store, vì RPC verify theo `employee_id + pin`.
- PIN nhân viên verify bằng SQL RPC + `pgcrypto` (`crypt`/`gen_salt`), client **không đọc trực tiếp `passcode_hash`**.
- Current employee chỉ giữ trong memory state (Zustand), **không lưu localStorage/sessionStorage**.
- Refresh tab/browser sau khi đã pair store sẽ quay về `passcode`, không tự giữ nhân viên cũ.
- Một máy có thể nhiều nhân viên thay phiên: nhân viên A unlock/tạo order, logout employee; nhân viên B nhập PIN và có thể tiếp tục thanh toán nếu role cho phép.

---

## 4. Demo & Seeding

- **Demo data = chỉ user + menu + sơ đồ bàn** (KHÔNG order history).
- **Seed-on-create:** tạo quán → seed demo data vào Supabase ngay từ **TS seed bundle trong repo** → quán mới không trống trơn, dùng thử được liền. **"Demo" = tạo 1 store có sẵn data** (store tạo tức thì, không email) → không cần local demo mode.
- Seed demo dùng **deterministic IDs + `seed_key` theo `store_id + seed_key`** cho nhân viên demo, category, món, option, area, bàn, decor. Retry seed idempotent: chạy lại không tạo trùng data.
- **Nút "Clear demo data"** (general-setting): tombstone menu + floor areas + bàn + decor demo, **chừa đúng 1 admin** (PIN mặc định giữ nguyên) → custom thật từ slate trắng.
- Clear demo **admin-only** và MVP **block nếu còn open orders**, yêu cầu thanh toán/huỷ order trước để tránh xoá menu/floor khi đang bán.
- `clear_demo_data` chỉ clear dữ liệu thuộc seed bundle bằng deterministic seed IDs; deactive cashier demo; giữ đúng 1 admin. Nếu sau này muốn xoá toàn bộ dữ liệu tự tạo của quán, đó là chức năng destructive reset riêng, phải đổi tên và có confirm rõ.
- 2 template seed bundle trong app: `seed.demo` (user+menu+floorplan+decor) và `seed.blank` (1 admin).
- Decor assets có sẵn nằm trong `src/assets/floor-decor`; seed chỉ lưu `asset_key`.
- **Report trong demo:** store mới chưa có order → report rỗng lúc đầu. Demo report bằng cách **tạo order live → thanh toán → hiện trong report** (thể hiện trọn luồng, hơn data giả).

Seed demo medium mặc định:
- Nhân viên: admin PIN `123456`, cashier PIN `111111`.
- Menu cafe Việt phổ thông, 4 categories / 22 món:
  - **Cà phê:** Cà phê đen, Cà phê sữa, Bạc xỉu, Cà phê muối, Americano, Latte.
  - **Trà & trà sữa:** Trà đào cam sả, Trà vải, Trà tắc, Trà sữa truyền thống, Trà sữa ô long, Matcha latte.
  - **Đá xay:** Chocolate đá xay, Matcha đá xay, Cookies đá xay, Cà phê đá xay.
  - **Bánh/snack:** Croissant, Tiramisu, Bánh mì que, Khoai tây chiên, Bông lan trứng muối, Flan.
- Option groups: size `M/L`, đá `0/50/100%`, đường `0/50/100%`, topping `trân châu/thạch cà phê/kem cheese`, thêm shot cho nhóm cà phê.
- Floor plan: 2 areas (`Tầng trệt`, `Lầu 1`), 14 bàn tổng (`8 + 6`), decor placeholder `plant_01`, `wall_01`, `counter_01`, `door_01`.
- Không seed order history.

---

## 5. Tech Stack (khóa)

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Package manager | **npm** | đơn giản cho Windows/Vite/Vercel |
| Frontend | React + Vite + **TypeScript** | TS để ports/adapters là interface thật |
| Styling | Tailwind CSS | |
| UI controls | **MUI controls** + Tailwind layout | MUI cho Button/Input/Dialog/Tabs/Table; POS surface/layout vẫn custom Tailwind |
| Form validation | React Hook Form + Zod | form menu/employee/settings/auth |
| Navigation + guard | Single URL + internal app state | POS/kiosk-style; không dùng browser history cho workflow nghiệp vụ |
| Client/draft state | Zustand | app screen, current employee(memory-only), POS/editor draft |
| Server state/cache | TanStack Query | fetch/refetch/invalidate khi Realtime event tới |
| Backend (BaaS) | **Supabase** | Postgres + Auth + Realtime + RLS |
| Database | PostgreSQL (Supabase cloud) | free 500MB |
| Schema/RLS/RPC | SQL migrations (`supabase/migrations/*.sql`) | apply trực tiếp lên Supabase cloud; không dashboard-only; không bắt buộc local CLI/Docker |
| Auth | Supabase Auth (1 user/store) + RLS cô lập store | role NV ở app-layer |
| **Đồng bộ nhiều máy** | **Supabase Realtime** (`postgres_changes`) | **online-only**, không offline/local DB |
| Biểu đồ | recharts | report doanh thu |
| Thông báo | react-hot-toast | |
| Test | Vitest + Playwright/manual smoke | core/services + luồng demo chính |
| Deploy | Vercel (FE) + Supabase cloud (BE/DB) | free, CI/CD GitHub |

> **Vận hành:** Supabase free **pause sau ~7 ngày** không hoạt động → wake trước demo.

---

## 6. Kiến trúc — Hexagonal (Ports & Adapters) + TS

- **Core** thuần: không import Supabase/React. Business logic + entities.
- **Ports** = TS `interface`. **Adapters** = nơi *duy nhất* gọi Supabase. **Dependency Rule** ép bởi TS compiler.
- **Không over-abstract:** 1 port/repo mỗi domain.

```
src/
├── core/
│   ├── entities/        # Store, Employee, MenuItem, OptionGroup, OptionValue, Table, Order, OrderItem
│   └── services/        # OrderService, MenuService, AuthService, TableService, ReportService, SettingsService, SeedService
├── ports/               # IAuthRepo, IEmployeeRepo, IMenuRepo, IFloorPlanRepo, IOrderRepo, IPaymentRepo, IReportRepo, ISettingsRepo, ISeedRepo, IPrintPort
├── adapters/
│   └── supabase/        # Supabase*Repo — implement ports + realtime subscriptions
├── data/                # TS seed bundles + built-in catalogs
├── assets/
│   └── floor-decor/     # ảnh decor built-in, map qua asset_key
├── hooks/               # useAuth, useMenu, useFloorPlan, useOrders, useStats, useSettings, useRealtime, useAppNavigation
├── features/
│   ├── auth/            # landing(2 thẻ), store-pairing, create-store, passcode
│   ├── admin/           # employees, menu-editor⭐, floor-plan-editor⭐, report, general-setting
│   └── pos/             # floor-plan-view, order(+menu picker), payment, order-history
├── components/ui/
├── lib/supabaseClient.ts
└── types/               # enums + shared types (Role, OrderStatus, OrderType...)

supabase/
└── migrations/          # 001_schema_enums, 002_indexes_rls_triggers, 003_rpc_functions
```

**Prompt AI theo layer:** Adapter (paste port) → Hook (paste Service interface) → UI (paste Hook interface). Không bao giờ "làm cả feature 1 lần".

---

## 6.1 Navigation — Single URL, internal state

**Quyết định:** MVP dùng **một URL duy nhất** (`/` hoặc `/app`). Toàn bộ màn hình và workflow POS/admin render theo internal app state, không tạo route/browser history cho từng thao tác.

Lý do:
- POS là workstation/kiosk app, không phải website để người dùng duyệt bằng Back/Forward.
- Tránh edge case browser Back quay lại payment cũ, order đã paid, form edit stale, draft floor plan cũ.
- Mọi mutation nghiệp vụ phải đến từ action rõ ràng (`Save`, `Pay`, `Void`, `Clear demo`), không đến từ navigation/history.

State app tối thiểu:

```ts
type AppScreen =
  | "pairing"
  | "createStore"
  | "passcode"
  | "posFloor"
  | "order"
  | "payment"
  | "adminMenu"
  | "adminFloorPlan"
  | "employees"
  | "report"
  | "orderHistory"
  | "settings";
```

Luật navigation:
- Browser Back/Forward **không phải workflow nghiệp vụ**. Nếu bấm Back, browser có thể rời app/về trang trước, không quay lại state nghiệp vụ cũ.
- Chuyển màn bằng sidebar/tab/button nội bộ, không push URL mới.
- App mở/refresh:
  - chưa có Supabase session → `pairing`
  - có session nhưng chưa unlock employee → `passcode`
  - current employee chỉ giữ memory-only; refresh luôn mất employee → `passcode`
- Không khôi phục panel nhạy cảm sau refresh (`payment`, edit item, edit layout draft).
- Nếu editor có thay đổi chưa Save mà chuyển màn, app confirm nội bộ.
- Auth/store transition cũng dùng state: pair/create thành công → `passcode`; nhập PIN thành công → `posFloor`; gỡ ghép → clear session + `pairing`.

Guard:
- Role guard chạy theo `AppScreen`, không dựa vào route.
- Admin: `adminMenu`, `adminFloorPlan`, `employees`, `report`, `settings`, `clear_demo_data`, và toàn bộ POS.
- Cashier: `posFloor`, `order`, `payment`, `orderHistory`; không vào editor/report/settings/clear demo.
- Kitchen role giữ enum/seam, chưa có màn MVP.

UI target:
- Landscape-first từ desktop/tablet tới điện thoại xoay ngang; mọi màn MVP vẫn truy cập được trên màn ngang nhỏ, không cắt feature theo thiết bị.
- Phone portrait không cố render đầy đủ POS; hiện trạng thái/hướng dẫn xoay ngang để dùng.
- UI mặc định dùng tiếng Việt.
- App shell dùng left rail (icon + label) để chuyển module.
- App body/shell không scroll tự do; drawer/module cố định theo viewport, header/action bar sticky, từng pane nội dung tự `overflow: auto`.
- Trên mọi màn ngang, module demo giữ tối đa 2 pane chính; category/filter/navigation/status nằm trong toolbar, tabs, accordion, hoặc inline summary thay vì pane thứ ba.
- POS order screen dùng category tabs/toolbar, menu/catalog pane và cart/order summary pane; cart item list scroll riêng, tổng tiền + nút chính sticky dưới.
- Admin editor dùng split-pane cùng mô hình: danh sách/canvas ở vùng chính, panel thuộc tính bên phải; phone landscape vẫn đủ chức năng nhưng compact hơn.
- Floor view/editor dùng pan/zoom canvas riêng, không phụ thuộc page scroll.
- UI responsive reference: `docs/superpowers/ui-prototype/pos-cafe-responsive-shell.html`; kiểm tra tablet/phone landscape bằng `docs/superpowers/assets/pos-cafe-ui-tablet-1024x600.png`, `docs/superpowers/assets/pos-cafe-ui-phone-844x390.png`, và `docs/superpowers/assets/pos-cafe-ui-phone-740x360.png`.

---

## 7. Data Model (~15 bảng)

> Mọi bảng (trừ `stores`) có `store_id` + RLS lọc theo store account. Giá lưu **snapshot** lúc order.
> **Future-proof (seam §12.1):** mọi bảng có `created_at` + `updated_at`(auto trigger) [C]; `id` UUID **sinh client** lúc insert [B]; dữ liệu sync/editor xoá bằng tombstone `deleted_at`, không hard-delete [D].

```
stores          id PK(auth.uid) · store_no UNIQUE(sequence, gaps allowed) · name · email NULL(recovery) · seed_status enum(pending,seeded,failed) · is_active · created_at · updated_at
employees       id PK · store_id FK · name · role enum(admin,cashier,kitchen) · passcode_hash · is_active · created_at · updated_at
store_settings  store_id PK FK · display_name · address · currency='VND' · timezone='Asia/Saigon'
                · bill_footer · qr_info jsonb NULL · created_at · updated_at
categories      id PK · store_id FK · name · sort_order · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
menu_items      id PK · store_id FK · category_id FK · name · price · image_asset_key NULL · sort_order · is_available · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
option_groups   id PK · store_id FK · menu_item_id FK · name · select_type enum(single,multi) · is_required · min_select · max_select · sort_order · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
option_values   id PK · store_id FK · option_group_id FK · name · price_delta · sort_order · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
floor_areas     id PK · store_id FK · name · sort_order · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
tables          id PK · store_id FK · area_id FK · name · pos_x · pos_y · width · height · shape enum(round,square,rectangle)
                · rotation · seats · sort_order · status enum(empty,occupied) · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
floor_decor_items  id PK · store_id FK · area_id FK · kind enum(wall,plant,counter,door,decor,image) · label NULL
                   · asset_key · pos_x · pos_y · width · height · rotation · z_index · is_locked · deleted_at NULL · deleted_by_employee_id NULL · created_at · updated_at
orders          id PK · store_id FK · table_id FK NULL · order_type enum(dine_in,takeaway) · order_no int
                · business_date date · status enum(open,paid,void)
                · subtotal · discount_type enum(none,percent,amount) · discount_value · total · employee_id FK · paid_at NULL
                · lock_version int default 0 · created_at · updated_at
payments        id PK · store_id FK · order_id FK · method enum(cash,bank_transfer,qr,other) · amount
                · received_amount NULL · change_amount NULL · employee_id FK · created_at · updated_at
order_items     id PK · store_id FK · order_id FK · menu_item_id FK · item_name(SNAPSHOT) · quantity
                · unit_price(SNAPSHOT) · note NULL · status enum(waiting,done,removed) · created_at · updated_at
order_item_options  id PK · store_id FK · order_item_id FK · option_value_id FK · option_name(SNAPSHOT) · price_delta(SNAPSHOT) · created_at · updated_at
```

> **Gộp bàn (Tier 3):** nếu làm → bảng nối `order_tables(order_id, table_id)` thay `orders.table_id`. Hiện giữ `table_id` đơn.
> **MVP đã gồm option + floor areas + decor:** `option_groups/option_values` phục vụ size/topping cơ bản; `floor_areas` phục vụ khu/tầng; `floor_decor_items` phục vụ cây/tường/quầy/cửa/vật trang trí trên sơ đồ.
> **Schema/RLS/delete policy chi tiết:** xem [2026-06-10-pos-cafe-schema-rls-decisions.md](2026-06-10-pos-cafe-schema-rls-decisions.md).

---

## 8. Màn hình + Quyền

| Màn hình | Admin | Cashier | Kitchen(opt) | Ghi chú |
|---|:--:|:--:|:--:|---|
| landing (2 thẻ) / store-pairing / create-store / passcode | công khai | | | luồng vào §3.1 |
| general-setting (+ nút Clear demo data) | ✅ | | | setting chung, share mọi máy |
| quản lý nhân viên (CRUD + role + reset PIN) | ✅ | | | |
| **menu-editor** ⭐ | ✅ | | | flagship |
| **floor-plan-editor** ⭐ (kéo-thả toạ độ bàn) | ✅ | | | flagship |
| report (recharts) | ✅ | | | |
| floor-plan (view) | ✅ | ✅ | | trạng thái bàn realtime |
| order (+ menu picker, topping, note) | ✅ | ✅ | | |
| payment (tiền mặt + bill) | ✅ | ✅ | | MVP cash-only; schema chừa payment method/discount sau |
| order-history | ✅ | ✅ | | |
| kitchen queue | | | ✅ | **future seam only, không làm phase này** |
| payment-setting (QR) | ✅ | | | **optional** |

### 8.1 Cơ chế lưu cho Menu Editor + Floor-Plan Editor

**Quyết định:** 2 editor flagship dùng nút **Save** rõ ràng. Người dùng sửa trong local state trước, chỉ khi bấm Save mới ghi lên Supabase. Supabase là source of truth; các máy khác nhận thay đổi qua Realtime.

Luồng chung:

```
Máy A edit menu / kéo bàn
 └─ bấm Save
      └─ app gọi Supabase update/upsert
           └─ Postgres lưu row mới
                └─ Supabase Realtime phát postgres_changes
                     └─ Máy B/C nhận event
                          └─ refetch menu/tables và render lại UI
```

**MVP chọn "event -> refetch", không patch state thủ công.** Khi nhận Realtime event, app refetch lại danh sách liên quan (`refetchMenu()` / `refetchTables()`). Menu và bàn ít row nên chi phí nhỏ, code ít lỗi hơn tự merge từng event.

Save contract:
- Menu/Floor editor gửi **changeset** gồm `created`, `updated`, `deleted`.
- `deleted` luôn là tombstone (`deleted_at`, `deleted_by_employee_id`), không hard-delete.
- Không dùng full draft overwrite toàn bộ vì dễ ghi đè dữ liệu máy khác.

Menu Editor:
- Lưu dạng quan hệ theo `categories`, `menu_items`, `option_groups`, `option_values`; **không lưu cả menu thành JSON blob**.
- **MVP làm luôn option/topping** vì đây là năng lực lõi của POS cà phê: size, đá/đường, topping, thêm shot...
- Giới hạn scope option MVP: option chỉ gắn vào món, 1 cấp group/value; chưa làm công thức kho, tồn nguyên liệu, rule phụ thuộc phức tạp giữa các option.
- Ảnh món MVP **không upload**; món dùng text/placeholder hoặc `image_asset_key` trỏ tới asset built-in. Không thêm Supabase Storage/bucket/policy trong phase này.
- Edit form thao tác local state; Save gọi insert/update/upsert từng entity.
- Save gửi `MenuChanges`: categories/menu_items/option_groups/option_values chia `created`, `updated`, `deleted`.
- Xoá menu/category/option dùng tombstone `deleted_at`, không hard-delete. `is_available=false` chỉ dùng cho món tạm hết hàng, không phải xoá.
- Order phải lưu snapshot giá/tên/options lúc bán (`item_name`, `option_name`, `unit_price`, `price_delta`) để sửa menu sau này không làm lệch order cũ; snapshot này do RPC lấy từ DB, không tin giá/tên client gửi.
- Máy POS/Menu picker subscribe các bảng menu; khi có thay đổi thì refetch menu.

Floor-Plan Editor:
- Kéo/thả bàn thao tác local state; Save layout mới batch update các field layout.
- **MVP làm luôn `floor_areas`** vì nhiều khu/tầng là luận điểm mạnh cho Floor-Plan Editor.
- UI MVP cho floor areas: danh sách tab/khu đơn giản (vd Tầng trệt, Lầu 1, Sân vườn), mỗi bàn thuộc một `area_id`.
- Field layout gồm `area_id`, `pos_x`, `pos_y`, `width`, `height`, `shape`, `rotation`, `seats`, `sort_order`.
- Coordinate system: lưu theo logical stage **1600x900 (16:9)**, render `scale-to-fit` theo container để desktop/tablet/phone ngang không tràn/cắt bàn.
- Drag/resize: trong `pointermove` mutate DOM thật qua ref/`requestAnimationFrame`; chỉ commit draft state khi `pointerup`. Không update React state liên tục từng pixel.
- **MVP làm luôn decor cơ bản** qua `floor_decor_items`: cây, tường, quầy, cửa, vật trang trí từ asset có sẵn. Decor chỉ render trên sơ đồ, **không có status, không nhận order, không xuất hiện trong nghiệp vụ bàn**.
- Decor lưu theo `area_id` với `asset_key` trỏ tới ảnh built-in trong frontend, kèm `pos_x`, `pos_y`, `width`, `height`, `rotation`, `z_index`, `is_locked`.
- User **không upload/custom decor asset** trong MVP; không lưu `image_url` cho decor ở schema MVP.
- Giới hạn scope floor-plan MVP: chưa làm đo kích thước thật, snap nâng cao, layer manager phức tạp, upload asset; tập trung vào khu/tầng + kéo/thả bàn/decor + trạng thái bàn realtime.
- Save layout **không ghi đè `status`**. `status` là trạng thái vận hành do order/payment realtime cập nhật (`empty`/`occupied`), còn editor chỉ cập nhật layout.
- Save gửi `FloorPlanChanges`: floor_areas/tables/floor_decor_items chia `created`, `updated`, `deleted`; table update không chứa `status`.
- Máy POS floor-plan view subscribe `floor_areas`, `tables`, `floor_decor_items`; khi layout/status/decor đổi thì refetch floor plan.

Conflict MVP:
- Chấp nhận **last write wins** nếu 2 admin cùng sửa cùng lúc.
- Vì đã có `updated_at`, sau này có thể nâng cấp cảnh báo "dữ liệu đã thay đổi ở máy khác" trước khi ghi đè.

### 8.2 Order/Payment/RPC contract

**Quyết định:** các thao tác làm thay đổi order + table status phải đi qua SQL RPC transaction, tránh lệch trạng thái bàn nếu một update lỗi giữa chừng.

RPC phase này:
- `get_next_store_no()` → cấp `store_no` tiếp theo cho create-store bằng Postgres sequence; race-safe, có thể hở số.
- `verify_employee_pin(...)` → verify PIN bằng `pgcrypto`; client không đọc `passcode_hash`; passcode UI là chọn nhân viên + PIN.
- `submit_order_changes(..., p_expected_lock_version)` → nút **In/Gửi đơn**; tạo/cập nhật/huỷ order open dựa trên draft items, nếu dine-in thì cập nhật table status trong cùng transaction.
- `pay_order(..., p_expected_lock_version)` → tạo `payments` row, set order `paid`, set `paid_at`, nếu dine-in thì set table `empty` trong cùng transaction.
- `void_order(...)` → reserved/admin/future only; không dùng để void paid order trong MVP.
- `clear_demo_data(...)` → admin-only; nếu còn open orders thì block, nếu không thì tombstone demo menu/floor/decor và giữ 1 admin.
- RPC nào insert row mới vẫn nhận UUID do client sinh trước khi gọi, không dựa vào Postgres default UUID.
- Với order mới có item, adapter sinh UUID client và truyền vào `submit_order_changes.p_order_id`; `p_order_id=null` chỉ là no-op cho draft rỗng, không tạo order DB.
- `submit_order_changes` dùng typed scalar params + `jsonb` items/options payload; chiến lược **replace order lines** của order open khi bấm **In/Gửi đơn**.
- Replace order lines **không hard-delete**: khi submit lại order open, mark order_items cũ `status='removed'`, insert snapshot active mới bằng UUID client; option rows cũ đi theo removed item và không xuất hiện trên bill/report.
- DB là nguồn sự thật cho giá/tên order: client gửi `menuItemId`, `quantity`, `note`, `optionValueId`; RPC đọc menu/options active từ DB rồi snapshot `item_name`, `option_name`, `unit_price`, `price_delta`.
- RPC phải lock order/table liên quan trong transaction, check `lock_version`, cấp `order_no` an toàn theo `(store_id, business_date)`, tính `subtotal/total` trong DB, rồi update order/table/payment cùng transaction.
- Nếu menu item/option bị tombstone, unavailable hoặc không thuộc đúng món/store tại thời điểm submit, RPC trả lỗi nghiệp vụ để UI reload menu.
- `orders.lock_version int default 0`; `submit_order_changes`/`pay_order` nhận expected version và chỉ mutate nếu status + version còn khớp. Nếu lệch, RPC trả lỗi conflict để UI báo "Dữ liệu đã thay đổi, vui lòng tải lại".
- Role nhân viên vẫn là **app-layer/Core guard**; RPC có thể kiểm tra employee active/role để giảm lỗi nghiệp vụ/audit, nhưng docs không claim đây là DB-level role security tuyệt đối.

Order flow MVP:
- Bấm bàn trống chỉ mở order draft UI, **chưa tạo order DB**.
- Bấm **In/Gửi đơn** mới gọi `submit_order_changes`, lưu DB, render/in phiếu tạm bằng PrintPort, rồi quay về floor plan.
- Bàn đang có order open: vào order screen. Nếu có draft thay đổi thì nút chính là **In/Gửi đơn**; nếu không có draft thay đổi thì nút chính là **Thanh toán**.
- Mỗi order open khi load vào UI mang theo `lockVersion`; submit/pay dùng `expectedVersion` để chống double-click hoặc 2 máy cùng thao tác.
- Nếu giảm toàn bộ item của order open về 0 rồi bấm **In/Gửi đơn**: set order `void`, table về `empty`, không tạo payment.
- Takeaway có nút **Mang đi** + danh sách order takeaway đang mở; dùng cùng order screen/submit/payment flow.
- Mọi order có `order_no` theo ngày vận hành (`business_date`) để gọi khách/in bill; RPC tự cấp số theo `store_settings.timezone` trong transaction.

Payment MVP:
- UI chỉ làm **cash payment**: nhập tiền nhận (`received_amount`), tính tiền thối (`change_amount`), in/hiện bill đơn giản.
- `payments.method` enum chừa `cash`, `bank_transfer`, `qr`, `other`; phase này UI chỉ dùng `cash`.
- Nếu `received_amount < total`, không cho Complete và báo lỗi bằng toast/popup.
- Bấm **Complete** trước để `pay_order` set paid/table empty, sau đó mới render/in final bill.
- Paid order không void trong MVP.
- `orders.discount_type`/`discount_value` giữ trong schema để mở rộng, nhưng phase hiện tại **không làm UI giảm giá/voucher**.
- Voucher/code không làm trong dự án hiện tại; chỉ chừa đường bằng schema/port sau này.

Money/snapshot/print:
- Tiền lưu integer VND.
- Order item/options snapshot cả tên + giá (`item_name`, `option_name`, `unit_price`, `price_delta`) để bill/history không lệch khi sửa menu.
- `daily order_no` và report "hôm nay" tính theo `store_settings.timezone`, default `Asia/Saigon`, không theo timezone thiết bị.
- Print qua `IPrintPort`: MVP render HTML/template preview cho phiếu tạm và final bill, chưa tích hợp máy in thật.

Report MVP:
- Doanh thu/số đơn/trung bình đơn/top món chỉ tính order `status = paid`.
- Order `void` không tính doanh thu.
- Mặc định "hôm nay" dùng `business_date` theo `store_settings.timezone`.

Kitchen seam:
- Không làm màn kitchen queue trong phase này.
- Giữ `order_items.status = waiting|done|removed` để sau này thêm kitchen queue không phải đổi model order item.

---

## 9. Đồng bộ nhiều máy — Online-only

- Multi-device sync = **Supabase Realtime** `postgres_changes`, subscribe theo `store_id`:
  - **orders** → sync đơn giữa máy (+ kitchen queue nếu bật).
  - **payments** → payment/order history/report invalidation.
  - **tables** → trạng thái bàn (empty/occupied) live trên sơ đồ.
  - **floor_areas/floor_decor_items** → layout khu/tầng + decor trong sơ đồ.
  - **categories/menu_items/option_groups/option_values** → menu editor save xong, máy order refetch menu.
- Report/stats: fetch thường.
- Đóng gói trong `hooks/useRealtime.ts` + adapter; Core không biết realtime.
- Pattern nhận event: **Realtime event chỉ là tín hiệu invalidation** → gọi `refetch...()`, không tự patch state phức tạp trong MVP.
- **Online-only:** server (Supabase) là nguồn duy nhất. Mất mạng = không thao tác (xem §11 + §12).

### 9.1 Quy tắc load dữ liệu

**Không load toàn bộ dữ liệu quán khi mở app.** Order history có thể lớn, nên chỉ fetch theo màn hình và filter.

Khi app vừa ghép store / vào passcode / vào POS:
- Load `employees` active để chọn nhân viên.
- Load `store_settings`.
- Load menu active: `categories`, `menu_items`, `option_groups`, `option_values`.
- Load floor plan active: `floor_areas`, `tables`, `floor_decor_items`.
- Load **open orders** / đơn chưa thanh toán cần cho vận hành hiện tại.

Không load mặc định:
- Toàn bộ paid/void orders cũ.
- Toàn bộ `order_items`/`order_item_options` lịch sử.
- Report nhiều ngày/tháng.

Order history/report:
- Chỉ fetch khi vào màn `order-history` hoặc `report`.
- Filter mặc định: hôm nay.
- Có option 7 ngày / tháng này / khoảng ngày.
- Dùng `limit` + phân trang nếu danh sách dài.

---

## 10. Phân Tier

| Tier | Gồm |
|---|---|
| **1 — MVP bắt buộc** | landing/pairing/create-store(+seed demo)/passcode, quản lý NV+role, **menu-editor⭐ có option/topping**, **floor-plan-editor⭐ có floor areas/khu/tầng + decor cơ bản**, order dine-in+takeaway, payment tiền mặt+bill, core report doanh thu, general-setting(+clear demo) |
| **2 — làm nếu kịp** | order-history filter nâng cao, tinh chỉnh editor nâng cao, report mở rộng |
| **3 — mở rộng sau** | gộp bàn, kitchen queue, payment-setting/QR, discount/voucher UI |

---

## 11. Ngoài scope (KHÔNG làm)

Kho nguyên liệu · loyalty · chấm công/ca · app native · **offline-first / local DB (online-only)** · billing/cước thật · super-admin nhiều quán · WebSocket tự viết.

> **Caveat online-only:** mất mạng = không dùng được. POS thật thường cần offline, scope free/web chấp nhận online-only.

---

## 12. Nhật ký quyết định (ADR — dùng khi bảo vệ)

| # | Quyết định | Đã cân nhắc gì | Vì sao chốt |
|---|---|---|---|
| 1 | **TypeScript** | JS | TS làm ports/adapters thành interface *thật*, compiler ép Dependency Rule |
| 2 | **Supabase** BaaS | Tự viết NestJS, PocketBase, Firebase | Realtime+Auth+RLS+Postgres sẵn, free; Firebase NoSQL sai mô hình quan hệ + stats |
| 3 | **Store Key** (ghép máy 1 lần) | Email login mỗi NV | Đúng mô hình POS thật; không lộ tài khoản cá nhân; bảng user gọn |
| 4 | **Role app-layer** | Mỗi NV 1 auth user (RLS role) | Giữ mô hình passcode gọn; RLS vẫn cô lập store tại DB |
| 5 | **Online-only + Realtime, HOÃN offline-first sang mở rộng** | Offline-first local-first (RxDB+Supabase replication) — grill ra ~25-40% timeline, tail debug sync variance cao | Yêu cầu thật là *sync nhiều máy* — Realtime online lo trọn. Offline-first ngốn timeline đúng vào điểm khác biệt (2 editor). **Hoãn sang mở rộng nhưng CHỪA SEAM sẵn (§12.1)** để nâng cấp không phải viết lại. GV hỏi mất mạng → "điểm yếu đã biết, đã thiết kế seam, mở rộng sau" |
| 6 | **Demo seed-on-create** | Local pre-pairing demo, public demo store chung | Store tạo tức thì (no email) → tạo quán = demo luôn; bỏ được local DB; tránh data dùng chung bị ghi đè |
| 7 | **Hexagonal** | Layered thường | Tách business logic khỏi infra: đổi Supabase→Firebase chỉ sửa Adapter; bằng chứng = swap adapter |

### 12.1 Future-proofing seam cho offline-first (chừa sẵn, cost ~0)

Offline-first **hoãn sang mở rộng**, nhưng code chừa seam để nâng cấp (RxDB+Supabase replication, chỉ hot-path) không phải viết lại:

| # | Seam | Cost giờ | Cứu gì sau |
|---|---|---|---|
| A | Mọi data access **sau Ports** (Core/UI không gọi Supabase trực tiếp) | 0 (đã có) | Đổi RxDB = thay adapter, Core/UI im |
| B | **UUID sinh ở client** lúc insert (uuidv4), không Postgres default | ~0 | Row tạo offline có id ổn định, không retrofit |
| C | **`created_at` + `updated_at`(auto trigger)** mọi bảng | ~0 | Replication checkpoint cần `updated_at` |
| D | Dữ liệu sync/editor xoá bằng **tombstone `deleted_at`**, order xoá bằng trạng thái nghiệp vụ (`void`/`removed`) | nhỏ | RxDB/offline sau này kéo được sự kiện xoá qua `updated_at + deleted_at`, không retrofit |
| E | Cô lập **transport realtime 1 module** (`useRealtime`/adapter) | ~0 | Thay Realtime→replication chạm 1 chỗ |
| F | **`IRealtimePort`/`useRealtime` tập trung** phát tín hiệu invalidate TanStack Query; repo domain không tự expose subscribe trong MVP | nhỏ | Thay Realtime→replication chạm 1 chỗ |
| G | **Supabase types không lọt Core** — map ở adapter | 0 (đã có) | Core bất biến khi đổi infra |

**KHÔNG làm (YAGNI):** không thêm RxDB/local DB; không `_deleted` kiểu replication riêng khi chưa cần; không bịa tầng sync-abstraction thứ hai (Ports đã là seam); F chỉ cho hot-path repo.

### 12.2 Offline-readiness checklist — LUẬT CỨNG khi build (enforce, không trôi)

Seam chỉ có giá trị nếu **không bị xói** trong lúc build gấp. 4 luật bắt buộc, đưa vào mọi task + review checkpoint:

- [ ] **L1 — UUID sinh ở client:** mọi insert dùng `crypto.randomUUID()`/uuidv4, KHÔNG để Postgres `default gen_random_uuid()`. (Row offline cần id ổn định.)
- [ ] **L2 — Không hard-delete dữ liệu sync/editor:** `categories`/`menu_items`/`option_groups`/`option_values`/`floor_areas`/`tables`/`floor_decor_items` xoá bằng `deleted_at`; `orders` dùng `void`, `order_items` dùng `removed`. UI mặc định lọc `deleted_at is null`.
- [ ] **L3 — Supabase type không lọt Core:** chỉ `adapters/supabase/*` biết Supabase; adapter map row→entity thuần. Core/hooks/UI không import gì từ `@supabase/*`.
- [ ] **L4 — Realtime gom 1 chỗ:** mọi `supabase.channel()`/subscription chỉ trong `hooks/useRealtime.ts` + adapter, KHÔNG rải khắp feature.

**Bonus enforce (optional):** ESLint `no-restricted-imports` cấm import `@supabase/supabase-js` ngoài thư mục `src/adapters/`.

> Vi phạm 1 luật = seam offline-first hỏng → tương lai bổ sung phải retrofit thủ công. Kiểm ở mỗi PR/checkpoint.

---

## 13. Lý do chọn (bảo vệ)

- **Web app?** Data cloud, mọi máy ghép Store Key có dữ liệu, nhiều máy chạy song song realtime.
- **Không dùng POS có sẵn?** Quán nhỏ không trả phí; bản đơn giản chạy trình duyệt; 2 editor trực quan là khác biệt.
- **Supabase thay tự viết backend?** Realtime+Auth+RLS+Postgres free; tập trung business logic + kiến trúc.
- **Store Key thay email?** Đúng mô hình POS thương mại: ghép máy 1 lần, NV dùng PIN.

---

## 14. Triển khai (Deployment) — 0đ, demo live

**Gần như KHÔNG có BE để deploy** — Supabase là managed, không server code. "Deploy BE" = tạo project + apply schema/RLS + config Auth. MVP chỉ cần **client + Supabase** (không Edge Function/VPS/Docker).

```
GV mở URL công khai ──HTTPS──► Vercel (FE, free Hobby, CI/CD GitHub)
                                   │ VITE_SUPABASE_URL + ANON_KEY
                                   ▼
                          Supabase cloud (Postgres+Auth+Realtime+RLS) — free
```

→ GV mở link trên máy họ + bạn trên laptop → **2 máy sync realtime live**. Tất cả 0đ.

### Free tier (verify số lúc build)
- **2 project free** (trên các org là Owner/Admin); project **paused không tính** vào limit.
- 500MB DB · ~5GB egress/tháng · 50k MAU · Realtime ~200 kết nối / 2M msg/tháng → demo dư.

### Gotcha + mitigation

| Rủi ro | Chặn |
|---|---|
| **Free project tự PAUSE sau 7 ngày không hoạt động** (mở lại tay ~1-2') | Wake trước demo **+ GitHub Action cron ping/ngày** (1 query nhẹ) → không bao giờ pause |
| **Online-only → phòng demo mất wifi = chết** | **Mang 4G hotspot** backup (hedge cho quyết định online-only ADR#5) |
| signUp mặc định cần confirm email (store account ẩn không có mail thật) | Tắt **"Confirm email"** trong Auth settings → signUp ra session ngay (email provider vẫn bật) |
| Anon key lộ ở FE | Bình thường — RLS bảo vệ, không phải lỗ hổng |

### Checklist demo-day
1. Wake Supabase (hoặc cron keep-alive đang chạy) · 2. Vercel build xanh · 3. Test tạo store + order trên 2 máy · 4. Hotspot 4G sẵn · 5. "Confirm email" đã tắt.

---

## 15. Cấu trúc báo cáo Word

1. Giới thiệu — bài toán, mục tiêu, phạm vi
2. Công nghệ — React/TS, Supabase, Tailwind, lý do chọn (§13)
3. Thiết kế hệ thống — Hexagonal, folder, mô hình Store Key, **nhật ký quyết định §12**
4. Thiết kế database — ERD, mô tả bảng, RLS
5. Cài đặt & triển khai — chức năng theo role, màn hình minh hoạ (highlight 2 editor + seed/clear demo)
6. Kiểm thử — test case theo luồng: tạo quán→seed demo→passcode→order→payment→report; clear demo→custom
7. Kết luận — kết quả, hướng phát triển (offline-first/RxDB, multi-store full, loyalty)
