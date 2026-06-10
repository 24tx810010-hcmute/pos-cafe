# Design Spec — Hệ thống POS Quán Cà Phê (multi-store, online-only)

> **Trạng thái:** Đã chốt qua brainstorm 2026-06-09. Source of truth cho các session sau.
> **Bước kế:** writing-plans → implementation plan.

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
      │          ├─ Đã có quán → nhập Store Key → ghép (signIn) → session persist → PASSCODE
      │          └─ Tạo quán mới → tạo store + seed demo → hiện Store Key + admin PIN 1 lần → PASSCODE
      └─ RỒI → PASSCODE (chọn nhân viên + PIN)
                 └─ link nhỏ "Đổi quán / Gỡ ghép" → signOut → LANDING
```

- **Store Key chỉ xuất hiện ở LANDING.** Daily đã ghép → vào thẳng passcode. Gỡ ghép đặt ở passcode (link nhỏ) + general-setting.
- **Tạo quán tức thì, KHÔNG email** (Store Key là credential). Email = field recovery optional.

### 3.2 Store Key — kỹ thuật

- Format: `STOREID-SECRET` (vd `7K2P9M-x8f3qa`). App tách:
  - `email = <storeid>@store.pos.local` (ẩn, user không thấy)
  - `password = <secret>` → `supabase.auth.signInWithPassword(...)`
  - **Không cần bảng lookup public**, RLS sạch.
- Tạo quán: sinh `storeId` + `secret`, tạo Supabase auth user, insert `stores`, **seed demo data**, tạo admin `employee` + PIN. **Hiện Store Key + admin PIN 1 lần.**
- Nhiều thiết bị cùng quán = cùng store account → ghép bằng cùng Store Key. Chủ đưa mã cho nhân viên.

### 3.3 Caveat bảo mật (ghi rõ khi bảo vệ)

Ai có Store Key + ghép máy → có session Supabase mà RLS cho đọc toàn bộ data quán (gọi API trực tiếp, bỏ qua UI passcode). **Passcode chỉ là rào tầng app, không phải rào DB.** Chấp nhận cho TLCN:
- Passcode = danh tính thao tác (ai đứng máy) → audit + phân quyền UX.
- Store Key = bí mật cấp quán, như license/mật khẩu wifi quán.
- Cô lập **giữa các quán** vẫn là rào DB thật (RLS) — luận điểm multi-tenant chính.

> **Câu phòng thủ:** "Cô lập dữ liệu giữa chi nhánh enforce tại DB bằng RLS theo store_id. Phân quyền nhân viên enforce tại tầng nghiệp vụ sau xác thực PIN — đúng mô hình POS thương mại (Square, KiotViet)."

---

## 4. Demo & Seeding

- **Demo data = chỉ user + menu + sơ đồ bàn** (KHÔNG order history).
- **Seed-on-create:** tạo quán → seed demo data vào Supabase ngay → quán mới không trống trơn, dùng thử được liền. **"Demo" = tạo 1 store có sẵn data** (store tạo tức thì, không email) → không cần local demo mode.
- **Nút "Clear demo data"** (general-setting): xoá menu + bàn, **chừa đúng 1 admin** (PIN mặc định giữ nguyên) → custom thật từ slate trắng.
- 2 template seed bundle trong app: `seed.demo` (user+menu+floorplan) và `seed.blank` (1 admin).
- **Report trong demo:** store mới chưa có order → report rỗng lúc đầu. Demo report bằng cách **tạo order live → thanh toán → hiện trong report** (thể hiện trọn luồng, hơn data giả).

---

## 5. Tech Stack (khóa)

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | React + Vite + **TypeScript** | TS để ports/adapters là interface thật |
| Styling | Tailwind CSS | |
| Routing + guard | React Router v6 | guard theo role nhân viên |
| Backend (BaaS) | **Supabase** | Postgres + Auth + Realtime + RLS |
| Database | PostgreSQL (Supabase cloud) | free 500MB |
| Auth | Supabase Auth (1 user/store) + RLS cô lập store | role NV ở app-layer |
| **Đồng bộ nhiều máy** | **Supabase Realtime** (`postgres_changes`) | **online-only**, không offline/local DB |
| Biểu đồ | recharts | report doanh thu |
| Thông báo | react-hot-toast | |
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
├── ports/               # IAuthRepo, IEmployeeRepo, IMenuRepo, ITableRepo, IOrderRepo, IReportRepo, ISettingsRepo
├── adapters/
│   └── supabase/        # Supabase*Repo — implement ports + realtime subscriptions
├── hooks/               # useAuth, useMenu, useTables, useOrders, useStats, useSettings, useRealtime
├── features/
│   ├── auth/            # landing(2 thẻ), store-pairing, create-store, passcode
│   ├── admin/           # employees, menu-editor⭐, floor-plan-editor⭐, report, general-setting
│   └── pos/             # floor-plan-view, order(+menu picker), payment, order-history
├── components/ui/
├── lib/supabaseClient.ts
└── types/               # enums + shared types (Role, OrderStatus, OrderType...)
```

**Prompt AI theo layer:** Adapter (paste port) → Hook (paste Service interface) → UI (paste Hook interface). Không bao giờ "làm cả feature 1 lần".

---

## 7. Data Model (~12 bảng)

> Mọi bảng (trừ `stores`) có `store_id` + RLS lọc theo store account. Giá lưu **snapshot** lúc order.
> **Future-proof (seam §12.1):** mọi bảng có `created_at` + `updated_at`(auto trigger) [C]; `id` UUID **sinh client** lúc insert [B]; hot-path "xoá" bằng status/flag không hard-delete [D].

```
stores          id PK · name · email NULL(recovery) · is_active · created_at
employees       id PK · store_id FK · name · role enum(admin,cashier,kitchen) · passcode_hash · is_active · created_at
store_settings  store_id PK FK · display_name · address · currency='VND' · bill_footer · qr_info jsonb NULL · updated_at
categories      id PK · store_id FK · name · sort_order
menu_items      id PK · store_id FK · category_id FK · name · price · image_url NULL · is_available · created_at
option_groups   id PK · store_id FK · menu_item_id FK · name · select_type enum(single,multi) · is_required
option_values   id PK · option_group_id FK · name · price_delta
tables          id PK · store_id FK · name · pos_x · pos_y · status enum(empty,occupied) · created_at
orders          id PK · store_id FK · table_id FK NULL · order_type enum(dine_in,takeaway) · status enum(open,paid,void)
                · subtotal · discount_type enum(none,percent,amount) · discount_value · total · employee_id FK · paid_at NULL · created_at
order_items     id PK · order_id FK · menu_item_id FK · quantity · unit_price(SNAPSHOT) · note NULL · status enum(waiting,done)
order_item_options  id PK · order_item_id FK · option_value_id FK · price_delta(SNAPSHOT)
```

> **Gộp bàn (Tier 3):** nếu làm → bảng nối `order_tables(order_id, table_id)` thay `orders.table_id`. Hiện giữ `table_id` đơn.

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
| payment (tiền mặt + bill + giảm giá) | ✅ | ✅ | | |
| order-history | ✅ | ✅ | | |
| kitchen queue | | | ✅ | **optional** |
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

Menu Editor:
- Lưu dạng quan hệ theo `categories`, `menu_items`, `option_groups`, `option_values`; **không lưu cả menu thành JSON blob**.
- Edit form thao tác local state; Save gọi insert/update/upsert từng entity.
- Xoá menu/category/option nên ưu tiên `is_active=false` hoặc `is_available=false` thay vì hard-delete nếu record có thể đã đi vào lịch sử order.
- Order phải lưu snapshot giá/tên/options lúc bán (`unit_price`, `price_delta`, optional snapshot name) để sửa menu sau này không làm lệch order cũ.
- Máy POS/Menu picker subscribe các bảng menu; khi có thay đổi thì refetch menu.

Floor-Plan Editor:
- Kéo/thả bàn thao tác local state; Save layout mới batch update các field layout.
- Field layout gồm tối thiểu `pos_x`, `pos_y`; nên chừa sẵn `width`, `height`, `shape`, `rotation`, `seats`, `area_id` nếu làm nhiều khu/tầng.
- Save layout **không ghi đè `status`**. `status` là trạng thái vận hành do order/payment realtime cập nhật (`empty`/`occupied`), còn editor chỉ cập nhật layout.
- Máy POS floor-plan view subscribe `tables`; khi layout/status đổi thì refetch tables.

Conflict MVP:
- Chấp nhận **last write wins** nếu 2 admin cùng sửa cùng lúc.
- Vì đã có `updated_at`, sau này có thể nâng cấp cảnh báo "dữ liệu đã thay đổi ở máy khác" trước khi ghi đè.

---

## 9. Đồng bộ nhiều máy — Online-only

- Multi-device sync = **Supabase Realtime** `postgres_changes`, subscribe theo `store_id`:
  - **orders** → sync đơn giữa máy (+ kitchen queue nếu bật).
  - **tables** → trạng thái bàn (empty/occupied) live trên sơ đồ.
  - **categories/menu_items/option_groups/option_values** → menu editor save xong, máy order refetch menu.
- Report/stats: fetch thường.
- Đóng gói trong `hooks/useRealtime.ts` + adapter; Core không biết realtime.
- Pattern nhận event: **Realtime event chỉ là tín hiệu invalidation** → gọi `refetch...()`, không tự patch state phức tạp trong MVP.
- **Online-only:** server (Supabase) là nguồn duy nhất. Mất mạng = không thao tác (xem §11 + §12).

---

## 10. Phân Tier

| Tier | Gồm |
|---|---|
| **1 — MVP bắt buộc** | landing/pairing/create-store(+seed demo)/passcode, quản lý NV+role, **menu-editor⭐**, **floor-plan-editor⭐**, order dine-in+takeaway, payment tiền mặt+bill, report doanh thu, general-setting(+clear demo) |
| **2 — làm nếu kịp** | topping/size/variant, giảm giá/voucher, order-history filter nâng cao |
| **3 — cắt đầu tiên** | gộp bàn, kitchen queue, payment-setting/QR |

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
| D | Hot-path "xoá" bằng **status/flag** (order→void, item→removed), không hard-delete | ~0 | Soft-delete sau = đổi tên, không redesign |
| E | Cô lập **transport realtime 1 module** (`useRealtime`/adapter) | ~0 | Thay Realtime→replication chạm 1 chỗ |
| F | Hot-path repo expose **`subscribe(onChange)`** trong port (impl Realtime giờ) | nhỏ | Khớp observable RxDB sau |
| G | **Supabase types không lọt Core** — map ở adapter | 0 (đã có) | Core bất biến khi đổi infra |

**KHÔNG làm (YAGNI):** không thêm RxDB/local DB; không `_deleted` khắp nơi (chỉ "xoá=status" hot-path); không bịa tầng sync-abstraction thứ hai (Ports đã là seam); F chỉ cho hot-path repo.

### 12.2 Offline-readiness checklist — LUẬT CỨNG khi build (enforce, không trôi)

Seam chỉ có giá trị nếu **không bị xói** trong lúc build gấp. 4 luật bắt buộc, đưa vào mọi task + review checkpoint:

- [ ] **L1 — UUID sinh ở client:** mọi insert dùng `crypto.randomUUID()`/uuidv4, KHÔNG để Postgres `default gen_random_uuid()`. (Row offline cần id ổn định.)
- [ ] **L2 — Không hard-delete hot-path:** `orders`/`order_items`/`order_item_options`/`tables` "xoá" bằng status/flag (order→`void`, item→`removed`), KHÔNG `DELETE`. (Admin tables được hard-delete.)
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
