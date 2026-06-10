# Context: POS Quán Cà Phê (multi-store, online-only) — TLCN

> **Cập nhật 2026-06-09 sau brainstorm.** Tóm tắt nhanh cho mỗi session.
> **Spec đầy đủ (source of truth):** [docs/superpowers/specs/2026-06-09-pos-cafe-design.md](docs/superpowers/specs/2026-06-09-pos-cafe-design.md)

## Tóm tắt 1 phút

- **Đề tài:** Quản lý order quán cà phê **đa chi nhánh**, phân quyền vai trò. TLCN, < 1 tháng, 2h/ngày, 0đ. **AI lập trình chính**.
- **Flagship:** Menu Editor + Floor-Plan Editor (sơ đồ bàn trực quan).

## Quyết định đã chốt

| Hạng mục | Chốt |
|---|---|
| Ngôn ngữ | **TypeScript** |
| Stack | React + Vite + TS + Tailwind + React Router v6 + Supabase + recharts + react-hot-toast. Deploy Vercel + Supabase free |
| Backend | **Supabase** (Postgres + Auth + Realtime + RLS) |
| Kiến trúc | **Hexagonal** — Core thuần, chỉ adapter import Supabase |
| Multi-tenant | Row-level: `store_id` mọi bảng + RLS cô lập theo store account |
| **Auth** | **Store Key** (`STOREID-SECRET`) ghép máy 1 lần → session persist → daily chỉ **passcode (PIN)**. KHÔNG email login hằng ngày. Tạo quán tức thì, không email |
| Role enforce | Cô lập **store** = RLS (DB). Role **nhân viên** = app-layer (Core guard) |
| **Đồng bộ máy** | **Online-only** — Supabase Realtime (`postgres_changes` theo store_id: orders + tables). Offline-first **HOÃN sang mở rộng**, chừa seam sẵn (spec §12.1) |
| **Lưu editor** | Menu Editor + Floor-Plan Editor sửa local state, bấm **Save** mới upsert/update Supabase; máy khác nhận Realtime event rồi **refetch** menu/tables |
| **Demo** | Seed-on-create: tạo quán → seed sẵn demo (**user+menu+sơ đồ bàn**). Nút "Clear demo data" → chừa 1 admin. Không local demo mode |
| Landing UI | **2 thẻ**: "Đã có quán" (nhập key) \| "Tạo quán mới" (seed demo) |
| Licensing | Conceptual: `stores.is_active=false` → khóa. Không billing thật |

## Data model (~12 bảng)
`stores` · `employees`(passcode+role) · `store_settings` · `categories` · `menu_items` · `option_groups` · `option_values` · `tables`(x,y,status) · `orders` · `order_items` · `order_item_options`. Giá **snapshot** lúc order. (Cột → spec §7)

## Editor save/realtime
Menu và floor plan **không lưu JSON blob nguyên cục**. Menu lưu theo bảng quan hệ (`categories/menu_items/option_groups/option_values`), floor plan lưu từng bàn là row `tables` có tọa độ/layout. UI cho sửa local, bấm **Save** mới ghi Supabase. Supabase Realtime chỉ dùng làm tín hiệu invalidation: máy khác nhận event thì gọi `refetchMenu()` hoặc `refetchTables()`, không patch state thủ công trong MVP. Floor-plan save chỉ cập nhật field layout, **không ghi đè `tables.status`**.

## Màn hình
landing(2 thẻ) · store-pairing · create-store · passcode · quản-lý-NV · menu-editor⭐ · floor-plan-editor⭐ · report · floor-plan(view) · order · payment · order-history · general-setting(+clear demo) · kitchen-queue(opt) · payment-setting(opt)

## Tier
- **1 MVP:** landing/pairing/create(+seed demo)/passcode, NV+role, 2 editor⭐, order dine-in+takeaway, payment tiền mặt+bill, report, general-setting
- **2 nếu kịp:** topping/size/variant, giảm giá, history filter
- **3 cắt đầu:** gộp bàn, kitchen queue, QR

## Ngoài scope
kho · loyalty · chấm công · native · **offline-first/local DB (online-only)** · billing · super-admin

## Caveat nhớ khi bảo vệ
- **Passcode chỉ chặn tầng app**, không phải rào DB (Store Key + ghép máy = đọc được data quán qua API). Store Key = bí mật cấp quán như license.
- **Online-only** — mất mạng không dùng được. Offline-first HOÃN sang mở rộng, **đã chừa seam** (UUID client, updated_at, xoá=status, ports/transport cô lập — spec §12.1). GV hỏi → "điểm yếu đã biết, seam sẵn, mở rộng sau".
- Supabase free **pause sau ~7 ngày** → wake trước demo.

## Deploy (0đ, demo live — spec §14)
FE → Vercel free · BE → Supabase managed (không server code deploy). GV mở URL công khai, 2 máy sync realtime live. **Gotcha:** free pause sau 7 ngày → cron GitHub Action ping/ngày; online-only → mang hotspot 4G; tắt "Confirm email" để signUp instant.

## Luật cứng khi build (seam offline — spec §12.2, enforce mọi task)
1. UUID sinh **client** (không Postgres default) · 2. Hot-path **không hard-delete** (xoá=status: order→void, item→removed) · 3. **Supabase type không lọt Core** (chỉ adapter biết) · 4. Realtime **gom 1 module** (`useRealtime`). Vi phạm = seam hỏng.

## Bước kế
brainstorm xong → **writing-plans** tạo implementation plan.
