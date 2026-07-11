# Tech Stack & Technical Tradeoffs

File này là technical decision record rút gọn. Mỗi quyết định nêu rõ dùng gì, vì sao chọn, không chọn gì, đánh đổi và cách giảm rủi ro.

## Architectural Pattern: Hexagonal Architecture / Ports & Adapters

- **Quyết định:** dùng Ports & Adapters, lấy cảm hứng từ Hexagonal Architecture.
- **Dùng cho:** tách UI/feature flow khỏi Supabase, realtime, print và mock data.
- **Vì sao chọn:** dự án có nhiều nghiệp vụ cần test và demo ổn định; port boundary giúp UI không phụ thuộc trực tiếp SDK backend.
- **Không chọn:** để React components gọi Supabase client, print API hoặc realtime SDK trực tiếp.
- **Đánh đổi:** thêm interface, mapper và adapter boilerplate.
- **Giảm rủi ro:** giữ `AppPorts` nhỏ, adapter Supabase/mock cùng implement contract, print/realtime cũng đi qua port riêng.
- **Liên quan tới tiểu luận:** có thể trình bày đây là cách cô lập nghiệp vụ khỏi hạ tầng, giúp test bằng mock adapter và mở đường đổi backend/offline/native printer sau này.

## 1. React + Vite + TypeScript

- **Quyết định:** dùng React 18, Vite, TypeScript.
- **Dùng cho:** frontend single-page POS app.
- **Vì sao chọn:** setup nhanh, build nhanh, phù hợp UI nhiều state/drawer, dễ deploy static, TypeScript giúp khóa domain DTO và port interface.
- **Không chọn:** Next.js/full-stack framework.
- **Đánh đổi:** không có routing/server rendering built-in; API/backend phải do Supabase đảm nhiệm.
- **Giảm rủi ro:** app là single URL POS nên không cần SSR; navigation dùng Zustand/internal state.
- **Liên quan tới tiểu luận:** chứng minh ưu tiên đúng bài toán POS realtime nội bộ thay vì dùng framework nặng hơn scope.

## 2. Supabase

- **Quyết định:** dùng Supabase làm backend managed.
- **Dùng cho:** Postgres, auth/session store owner, RLS/RPC, realtime, cloud demo.
- **Vì sao chọn:** miễn phí cho demo, có Postgres quan hệ, realtime và RLS sẵn; giảm thời gian tự build backend.
- **Không chọn:** tự viết NestJS/VPS, PocketBase, Firebase.
- **Đánh đổi:** phụ thuộc managed service và online connection; giới hạn free tier.
- **Giảm rủi ro:** ports/adapters cô lập Supabase; demo runbook có bước wake/check Supabase trước demo.
- **Liên quan tới tiểu luận:** có thể giải thích tradeoff giữa tốc độ phát triển, dữ liệu quan hệ và realtime multi-device.

## 3. PostgreSQL + RPC + RLS

- **Quyết định:** nghiệp vụ quan trọng chạy qua Postgres tables/RPC/RLS.
- **Dùng cho:** submit order, pay order, clear demo data, store-scoped data.
- **Vì sao chọn:** order/payment cần transaction, lock version, snapshot giá/tên và consistency bàn/order/payment.
- **Không chọn:** để client tự tính và ghi nhiều table rời rạc.
- **Đánh đổi:** SQL/RPC phức tạp hơn CRUD client đơn giản.
- **Giảm rủi ro:** RPC boundary rõ, test migration/RPC, adapter map lỗi thành `AppError`.
- **Liên quan tới tiểu luận:** thể hiện xử lý consistency và concurrency trong bài toán POS thật.

## 4. Realtime Invalidate/Refetch

- **Quyết định:** realtime event chỉ là tín hiệu invalidate/refetch.
- **Dùng cho:** menu, floor, open orders, payment/report sync giữa nhiều máy.
- **Vì sao chọn:** giảm bug merge state thủ công, phù hợp data nhỏ của cafe/demo.
- **Không chọn:** patch cache thủ công từ từng payload hoặc offline-first replication.
- **Đánh đổi:** có thêm request refetch và không tối ưu tuyệt đối realtime latency.
- **Giảm rủi ro:** TanStack Query cache tập trung; realtime adapter gọi invalidate theo domain.
- **Liên quan tới tiểu luận:** giải thích được lựa chọn đơn giản, ổn định hơn cho MVP nhưng vẫn chứng minh multi-device sync.

## 5. Ports/Adapters

- **Quyết định:** UI/features phụ thuộc `AppPorts`, không phụ thuộc trực tiếp Supabase.
- **Dùng cho:** auth, employee, menu, floor, order, payment, report, settings, seed, print, realtime.
- **Vì sao chọn:** dễ test bằng mock adapter, dễ đổi backend/offline sau này.
- **Không chọn:** import Supabase client trực tiếp trong components/features.
- **Đánh đổi:** phải duy trì interface và mapper.
- **Giảm rủi ro:** port surface nhỏ, adapter Supabase/mock cùng implement contract.
- **Liên quan tới tiểu luận:** chứng minh kiến trúc tách layer và khả năng mở rộng.

## 6. TanStack Query

- **Quyết định:** dùng TanStack Query cho server state.
- **Dùng cho:** menu, floor plan, orders, history, reports, settings.
- **Vì sao chọn:** cache, loading/error state, refetch/invalidate hợp với realtime signal.
- **Không chọn:** tự viết global store cho server state trong Zustand.
- **Đánh đổi:** cần quản lý query keys và invalidation discipline.
- **Giảm rủi ro:** query key helper theo domain, mutation hooks refetch đúng scope.
- **Liên quan tới tiểu luận:** phân biệt server state và UI state rõ ràng.

## 7. Zustand

- **Quyết định:** dùng Zustand cho UI/navigation state.
- **Dùng cho:** pre-login screen, current employee, active area/category, drawer context, draft/payment context.
- **Vì sao chọn:** nhẹ, dễ đọc, phù hợp single URL app.
- **Không chọn:** Redux hoặc route-based navigation.
- **Đánh đổi:** phải tự giữ invariant khi mở/đóng drawer.
- **Giảm rủi ro:** store nhỏ, action rõ: `openOrder`, `openPayment`, `openDrawer`, `closeDrawer`.
- **Liên quan tới tiểu luận:** phù hợp POS thao tác nội bộ không cần browser history phức tạp.

## 8. MUI + Tailwind + Design Tokens

- **Quyết định:** dùng MUI components kết hợp Tailwind utilities và token POS.
- **Dùng cho:** buttons/forms/dialogs/drawers/layout và shared portal primitives.
- **Vì sao chọn:** MUI giúp form/control nhanh; Tailwind giúp chỉnh layout responsive và visual polish trực tiếp trong TSX.
- **Không chọn:** CSS file lớn hoặc design system tự viết từ đầu.
- **Đánh đổi:** có nguy cơ style lẫn lộn nếu không có quy tắc.
- **Giảm rủi ro:** ưu tiên Tailwind utilities, token tập trung, test chống legacy CSS class, chuẩn hóa popup/drawer bằng `PortalPopup` và `PortalDrawer`.
- **Liên quan tới tiểu luận:** cho thấy cân bằng giữa tốc độ build UI và khả năng redesign.

## 9. Vitest + Playwright

- **Quyết định:** dùng Vitest cho unit/component/feature tests và Playwright cho smoke E2E.
- **Dùng cho:** core logic, adapters, drawer behavior, demo flow, Supabase realtime smoke.
- **Vì sao chọn:** nhanh trong local, hợp Vite, Playwright kiểm chứng flow người dùng thật.
- **Không chọn:** chỉ manual test hoặc chỉ unit test.
- **Đánh đổi:** E2E tốn thời gian hơn unit test và cần data/test mode ổn định.
- **Giảm rủi ro:** tách `npm run test`, `npm run smoke`, `npm run smoke:supabase`.
- **Liên quan tới tiểu luận:** có bằng chứng kiểm thử từ logic tới flow demo.
- **Validation gần nhất (phase 18, working tree chưa commit):** `npm test` pass 42 files/211 tests; `npm run build` (tsc strict) pass; `npm run smoke` (mock, 5 viewport) 26 pass; **`npm run smoke:supabase` 3/3 pass** trên cloud đã áp migration 009+010 — gồm full-pay + history/report, **instant pay tách đơn** (kèm assert số bill theo thứ tự trả), và realtime cross-device 2 browser (phase 15 coi như đã kiểm chứng trên Supabase thật).

## 10. Browser Print Preview

- **Quyết định:** `IPrintPort` render HTML/template preview cho phiếu tạm và hóa đơn.
- **Dùng cho:** order ticket và final receipt.
- **Vì sao chọn:** đủ demo, không phụ thuộc driver/máy in, chạy được trên web deployment.
- **Không chọn:** native printer, USB, ESC/POS, service in local.
- **Đánh đổi:** không phải tích hợp máy in POS thật.
- **Giảm rủi ro:** giữ `IPrintPort` để sau này thay adapter in thật mà không đổi order/payment flow.
- **Liên quan tới tiểu luận:** giải thích phạm vi web/free demo và seam mở rộng phần cứng.

## 11. Online-Only Phase Này

- **Quyết định:** phase tiểu luận là online-only.
- **Dùng cho:** toàn bộ app web và Supabase realtime.
- **Vì sao chọn:** yêu cầu chính là sync nhiều máy; offline-first sẽ làm tăng lớn độ phức tạp.
- **Không chọn:** RxDB/local-first/offline replication ngay trong phase này.
- **Đánh đổi:** mất mạng thì không dùng được.
- **Giảm rủi ro:** thiết kế seam: UUID client, timestamps, soft delete editor, ports/adapters, realtime transport tập trung.
- **Liên quan tới tiểu luận:** trình bày được điểm yếu đã biết và hướng nâng cấp sau.

## 12. Cash-Only Payment Phase Này

- **Quyết định:** payment flow thật chỉ dùng tiền mặt trong phase tiểu luận.
- **Dùng cho:** payment drawer, `pay_order`, receipt.
- **Vì sao chọn:** cash là flow POS nền tảng, dễ demo end-to-end và đủ kiểm chứng transaction order/payment/table.
- **Không chọn:** QR/bank/e-wallet processing thật ngay trong phase này.
- **Đánh đổi:** chưa cover thanh toán điện tử thật.
- **Giảm rủi ro:** schema có `payment_method` và `store_settings.qr_info` seam; Payment Settings/QR hiện là preview/local UI, chưa persist qua `settingsRepo` và không claim processing thật.
- **Liên quan tới tiểu luận:** tập trung vào nghiệp vụ lõi và consistency thay vì tích hợp cổng thanh toán ngoài.
