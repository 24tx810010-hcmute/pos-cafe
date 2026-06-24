# Phase 15 - Realtime Hardening (accuracy-first sync)

## Mục tiêu

- Ưu tiên độ chính xác dữ liệu giữa các máy mà không làm chậm sync; chốt **online-only + refetch-only** (không optimistic update, không patch cache).
- Giữ sync nhanh khi realtime gián đoạn (tự lành thay vì chờ poll), và ghi rõ SLA hội tụ.
- Chừa đường cho offline-first ở phase sau (không phá đường đọc đơn nhất).

## Branch/Commit

- Branch code: `main`
- Commit: `cb24887` (`feat(realtime): self-heal resync on (re)subscribe`).

## Bối cảnh / khảo sát

- Kiến trúc đã đúng hướng accuracy-first: realtime = tín hiệu invalidate/refetch, server là nguồn sự thật, có `lock_version`.
- `order(id)` detail = `["orders","detail",id]` nằm dưới prefix `["orders"]` → invalidate `ordersRoot` đã phủ luôn order detail (không cần thu hẹp granularity; thu hẹp còn dễ sót).
- `ORDER_VERSION_CONFLICT` đã map sang `reloadOrder` (refetch order + floor) và có test (`demoHardening`, `uiError`). Không cần sửa.
- `order_items` không có trong publication; nhưng `submit_order_changes` luôn bump `orders.lock_version` nên event `orders` đã phủ — thêm `order_items` chỉ gây double-refetch.

## Đã implement

- `SupabaseRealtimePort`: thêm callback trạng thái cho `channel.subscribe`. Mỗi lần `SUBSCRIBED` (lần đầu + mỗi auto-reconnect resubscribe) gọi `resyncAll()` (open orders + floor + report + menu) → máy **tự lành** ngay khi socket rớt/khôi phục, không phải chờ poll 5s. Comment hoá rõ lý do `order_items` không publish và order detail nằm dưới prefix `["orders"]`.
- Unit test `realtimePort.test.ts`: (1) `SUBSCRIBED` resync 4 nhóm query, resubscribe resync lại, `CHANNEL_ERROR` không resync; (2) event `orders` → open orders + floor + report (không menu), event `menu_items` → menu.
- Không đổi: mock realtime port (no-op), invalidation orchestration, conflict handling.

## Quyết định kỹ thuật (ADR tóm tắt)

- **Refetch-only, không optimistic/không patch cache** (xem `architecture.md` mục Realtime). Ưu tiên chính xác đa thiết bị; đánh đổi là một nhịp refetch nền trên máy đang thao tác. Đây cũng là lựa chọn offline-friendly (đường đọc đơn nhất → sau này thay bằng bản sao local + outbox).
- Tự lành dựa trên `SUBSCRIBED` thay vì bắt từng `CHANNEL_ERROR`/`TIMED_OUT`: supabase-js tự rejoin và bắn lại `SUBSCRIBED`, nên đây là điểm chốt chắc chắn để resync.
- Giữ poll 5s làm SLA hội tụ ≤5s khi realtime rớt.

## Verification

- `npx tsc -b`: passed.
- `npm test`: 182/182 passed (thêm 2 test realtime self-heal).
- **Chưa kiểm chứng cross-device trực tiếp**: realtime chỉ chạy trên Supabase (mock realtime là no-op; mỗi tab mock có state riêng). Cần chạy `npm run smoke:supabase` / mở 2 thiết bị trên cùng store thật để xác nhận self-heal + latency. Để lại cho lần chạy có `.env` Supabase.

## Known Gaps/Risks

- Self-heal verify cross-device cần Supabase thật (chưa chạy trong phase này).
- Resync khi `SUBSCRIBED` gây một lượt refetch lúc pair lần đầu (chấp nhận; đảm bảo tươi ngay sau khi vào store).
- Optimistic update / local-first replication để dành phase offline.

## Liên quan

- [../architecture.md](../architecture.md) — Realtime (ADR refetch-only, coverage, self-heal, SLA, conflict).
- [../tech-stack.md](../tech-stack.md) — quyết định Realtime Invalidate/Refetch & online-only.
