# Testing & Verification

Tài liệu này gom bằng chứng kiểm thử hiện hành để dùng trong báo cáo. Kết quả phải được đọc cùng **baseline, ngày chạy và môi trường**; không suy rộng local mock thành cloud production.

## Chiến Lược

| Lớp | Công cụ | Phạm vi |
| --- | --- | --- |
| Unit | Vitest | Money, guard, modifier, draft, report helper, invalidation và mapper |
| Feature/service | Vitest | Session, order, instant pay, void paid, admin flows và permission |
| Component | Testing Library + Vitest | Drawer/screen, dirty state, loading/error, permission UI, portal |
| Architecture | Vitest + TypeScript AST scanner | Hướng phụ thuộc giữa domain/core/ports/features/app/adapters |
| Adapter contract | Vitest | Mock/Supabase parity, RPC payload, mapping lỗi và migration contract |
| Mock E2E | Playwright | Flow người dùng và responsive trên nhiều viewport với adapter mock |
| Cloud E2E | Playwright | Flow thật qua Supabase, RPC, RLS và realtime khi có env phù hợp |

## Baseline Local Hiện Tại

Kiểm tra trực tiếp ngày **2026-08-12** trên `main@c7f2f4e`:

| Lệnh | Kết quả |
| --- | --- |
| `npm test` | **49/49 test files, 260/260 tests pass** trong 15,4 giây |
| `npm run build` | TypeScript strict + Vite production build pass, 3196 module trong 1,62 giây |
| `npm run smoke` | **34 passed, 31 skipped, 0 failed** trong 65 case/project combinations, 22,9 giây |

Ghi chú:

- 31 case skipped chủ yếu do test chỉ áp dụng cho một số viewport hoặc portrait guard; không phải 31 lỗi.
- Build tạo một chunk JS duy nhất 1.342,81 KB minified / 367,59 KB gzip (CSS 62,61 KB / 12,17 KB gzip) và còn Vite chunk-size warning trên 500 KB.
- `npm run smoke:supabase` không được chạy lại ngày 2026-08-12 vì phụ thuộc credential và cloud state; không được gộp với kết quả local ở trên.

## Bằng Chứng Cloud Gần Nhất

| Ngày/checkpoint | Bằng chứng | Phạm vi |
| --- | --- | --- |
| 2026-07-19, phase 20 | `npm run smoke:supabase`: **5/5 pass** | Tạo/pay/history/report, void paid, instant pay, realtime và deny `payment.take` qua RPC |
| 2026-07-27, phase 23 | PostgREST read-only HTTP 200 | Migration 013, `tables.background_asset_key` và full floor-plan select |

Không claim rằng toàn bộ 260 local tests đã chạy trên Supabase. Cloud suite là một tập flow E2E nhỏ hơn, có mục tiêu kiểm chứng integration/RPC.

## Nhóm Bằng Chứng Quan Trọng

- **Order/payment consistency:** `orderFlow`, `instantPay`, mock repo, Supabase repo contract và cloud E2E.
- **Permission:** `guards`, employee drawer flow, permission UI và cloud deny-permission.
- **Void paid:** feature flow, mock repo, adapter contract, history component và cloud E2E.
- **Realtime:** invalidation/resubscribe unit tests và scenario hai browser; reconnect self-heal vẫn cần diễn tập thủ công định kỳ.
- **Editor:** menu/floor changeset tests, asset resolver tests và mock smoke persist từ editor sang POS.
- **Responsive:** Playwright projects cho 1366×768, 1024×600, 844×390, 740×360 và portrait 390×844.
- **Architecture:** `src/architectureBoundaries.test.ts` ngăn dependency layer đi sai hướng và Supabase/browser leak.

## Cách Chạy

```text
npm test
npm run build
npm run smoke
npm run smoke:supabase
```

`smoke:supabase` cần cấu hình `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, migration/storage/realtime đúng phiên bản và Supabase Auth cho phép signup nhận session phù hợp với flow demo.

## Khoảng Trống Kiểm Thử

- Chưa có số liệu code coverage chính thức; không ghi phần trăm coverage trong báo cáo.
- Chưa có load/performance test hoặc đo latency realtime có kiểm soát.
- Polling 5 giây là khoảng cấu hình, không phải cam kết mọi thiết bị hội tụ dưới 5 giây.
- Reconnect self-heal có unit test nhưng lần kiểm chứng cross-device gần nhất vẫn cần diễn tập thủ công.
- Chưa có test cho thiết bị in thật, offline, QR/bank processing hoặc kitchen queue vì các phần đó ngoài scope.
- URL Vercel/live deployment và ngày kiểm tra live phải được bổ sung riêng trước khi đưa vào báo cáo như bằng chứng triển khai.

## Quy Tắc Ghi Vào Báo Cáo

- Luôn ghi dạng: `baseline + ngày + môi trường + lệnh + kết quả`.
- Kết quả phase cũ là evidence lịch sử, không thay cho baseline hiện tại.
- Failure lịch sử đã được phase sau sửa phải ghi là “tại checkpoint”, không mô tả như lỗi hiện hành.
- Phân biệt rõ automated test, manual verification và cấu hình/deployment readiness.
