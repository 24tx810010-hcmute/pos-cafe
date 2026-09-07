# Testing & Verification

Tài liệu này gom bằng chứng kiểm thử hiện hành để dùng trong báo cáo. Kết quả phải được đọc cùng **baseline, ngày chạy và môi trường**; không suy rộng local mock thành cloud production.

## Chiến Lược

Chiến lược kiểm thử — sáu tầng, tiêu chí "bao nhiêu là đủ" theo loại thay đổi, cổng chất lượng, ngưỡng độ phủ và quy ước đặt tên — nằm ở [test-strategy.md](test-strategy.md).

File này chỉ chứa **nhật ký kết quả chạy** và **checklist thủ công**. Hai file tách nhau vì nhịp cập nhật khác nhau: chiến lược đổi hiếm, nhật ký đổi mỗi lần chạy lại.

## Độ Phủ Nền, Đo Ngày 2026-09-07

Lần đầu tiên đo được độ phủ, sau khi cài `@vitest/coverage-v8` theo `define-test-strategy`. Baseline: nhánh `claude/hopeful-albattani-42cb20`, xuất phát từ `main@c7f2f4e`.

**Phạm vi đo** là logic nghiệp vụ thuần, không phải toàn bộ `src`: `src/core/**` cộng các module trong `src/features/**` không phải hook. Loại `src/domain` (chỉ khai kiểu), `src/app`, `src/adapters`, các hook `use*.ts`, các barrel `index.ts` và mọi file `.tsx`. Lý do chọn phạm vi này ghi ở quyết định 2 của `openspec/changes/define-test-strategy/proposal.md`.

| Chỉ số | Kết quả | Ngưỡng đang đặt |
| --- | --- | --- |
| **Dòng** | **92,77%** (591/637) | **90%**, đã đạt |
| Câu lệnh | 88,80% (674/759) | không đặt ngưỡng |
| Nhánh | 80,80% (421/521) | không đặt ngưỡng |
| Hàm | 95,95% (190/198) | không đặt ngưỡng |

Số file trong phạm vi: **24**. Bộ kiểm thử tại lần đo: 49 file, 260 test, tất cả pass trong 13,9 giây.

**Sáu file thấp nhất theo dòng**

| File | Dòng |
| --- | --- |
| `features/admin/menuDraft.ts` | 0% trên 0 dòng — file chỉ khai `interface`, không ảnh hưởng tổng |
| `features/pos/posInvalidation.ts` | 71,42% |
| `features/admin/menuEditorDraft.ts` | 80% |
| `features/admin/floorEditorDraft.ts` | 85,71% |
| `features/admin/adminFlow.ts` | 86,48% |
| `features/admin/draftUtils.ts` | 86,66% |

**Ngưỡng đã được kiểm chứng là có tác dụng thật**, không phải chỉ nằm trong file cấu hình:

| Phép thử | Ngưỡng đặt tạm | Kết quả |
| --- | --- | --- |
| Ngưỡng phải chặn khi không đạt | 96% | Thoát với mã 1, báo `Coverage for lines (92.77%) does not meet global threshold (96%)` |
| Điều kiện là lớn hơn **hoặc bằng** | 92,77% | Thoát với mã 0 |
| File chưa có test phải vào báo cáo với 0% | 90% | Tạo file thử chưa có test nào, file đó xuất hiện ở mức 0% và kéo tổng xuống |

**Ghi chú kỹ thuật.** Reporter `text` **ẩn các file đạt 100% ở cả bốn cột**, nên bảng in ra màn hình chỉ có 16 dòng trong khi phạm vi thật là 24 file. Con số tổng vẫn đúng. Muốn thấy đủ danh sách thì đọc `coverage/coverage-summary.json`; đó là lý do `json-summary` được thêm vào danh sách reporter. Đã cân nhắc provider `istanbul` và loại: nó cho số liệu y hệt nhưng bỏ qua file chỉ khai kiểu và transform chậm hơn khoảng 8 giây.

## Chạy Lại Ngày 2026-08-21

Chạy lại trên cùng baseline `main@c7f2f4e` để xác nhận số liệu trước khi dùng cho báo cáo:

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm test` | **49/49 test files, 260/260 tests pass** trong 22,89 giây | Khớp lần chạy 2026-08-12; thời gian chạy khác do máy |
| `npm run build` | TypeScript strict + Vite production build pass, **3197 module** trong 2,43 giây | Tăng 1 module so với 2026-08-12 |
| `npm run smoke` | **Không chạy được** | Playwright thiếu binary trình duyệt: `browserType.launch: Executable doesn't exist ... chrome-headless-shell.exe`. Không phải lỗi ứng dụng. Cần `npx playwright install` rồi chạy lại |

Số liệu bundle cập nhật theo lần build 2026-08-21: một chunk JS duy nhất **1.347,25 KB minified / 368,88 KB gzip**, CSS 62,61 KB / 12,17 KB gzip. Chunk-size warning trên 500 KB vẫn còn.

Kết quả mock smoke **34 pass/31 skipped/0 failed** dưới đây là của ngày **2026-08-12** và chưa được xác nhận lại; khi đưa vào báo cáo phải ghi đúng ngày đó, không gộp vào ngày 2026-08-21.

## Baseline Local Hiện Tại

Kiểm tra trực tiếp ngày **2026-08-12** trên `main@c7f2f4e`:

| Lệnh | Kết quả |
| --- | --- |
| `npm test` | **49/49 test files, 260/260 tests pass** trong 15,4 giây |
| `npm run build` | TypeScript strict + Vite production build pass, 3196 module trong 1,62 giây |
| `npm run smoke` | **34 passed, 31 skipped, 0 failed** trong 65 case/project combinations, 22,9 giây |

Ghi chú:

- 31 case skipped chủ yếu do test chỉ áp dụng cho một số viewport hoặc portrait guard; không phải 31 lỗi.
- Build ngày 2026-08-12 tạo một chunk JS duy nhất 1.342,81 KB minified / 367,59 KB gzip (CSS 62,61 KB / 12,17 KB gzip) và còn Vite chunk-size warning trên 500 KB. Số liệu mới nhất xem mục chạy lại ngày 2026-08-21 ở trên.
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

## Checklist Thủ Công

Hai việc dưới đây **về bản chất không tự động hóa được**. Mọi thứ khác đã hoặc đang được chuyển sang tự động; lý do giữ đúng hai việc này xem [test-strategy.md](test-strategy.md) mục "Phần Giữ Thủ Công".

Chạy trước mỗi mốc đóng mục roadmap và trước ngày demo. Ghi ngày ngay khi chạy; **chưa chạy được thì ghi rõ lý do, không bỏ trống**.

| Việc | Ngày chạy gần nhất | Kết quả và ghi chú |
| --- | --- | --- |
| Gửi một email thử qua đường gửi đang cấu hình, xác nhận vào hộp thư chính chứ không vào thư rác | *chưa chạy* | Chưa dựng đường gửi email. Thuộc `add-owner-account-and-store-provisioning` nhóm 1 |
| Mở ứng dụng trên thiết bị thật ở chế độ ngang, kiểm thao tác chạm và bàn phím ảo | *chưa chạy* | Ghi rõ loại và kích thước thiết bị khi chạy |

Diễn tập kịch bản demo trước đây nằm ở đây, nay **đã chuyển sang tự động** thành `tests/smoke/demo-runbook.spec.ts`.

## Cách Chạy

```text
npm run build
npm test
npm run test:coverage
npm run smoke
npm run smoke:supabase
```

Bốn lệnh đầu là cổng chất lượng, chạy được cục bộ và không cần hạ tầng ngoài. Lệnh thứ năm là cổng theo mốc.

`smoke:supabase` cần cấu hình `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, migration/storage/realtime đúng phiên bản và Supabase Auth cho phép signup nhận session phù hợp với flow demo.

## Khoảng Trống Kiểm Thử

- ~~Chưa có số liệu code coverage chính thức~~ **Đã có từ 2026-09-07**, xem mục "Độ Phủ Nền" ở trên. Khi ghi vào báo cáo phải kèm **phạm vi đo**, vì con số là của phần logic nghiệp vụ thuần chứ không phải của toàn bộ `src`.
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
