> Bản sao báo cáo độc lập, giữ nội dung/kết luận; thay tiền tố đường dẫn máy bằng nhãn worktree để đọc ngoài máy tác giả. SHA-256 file gốc: `0f62510d0a7d1a8dcb9f9e2c867a04fa6a25526e170292f5308f00c658755ed7`. Lệnh và artifact được ghi như bằng chứng lịch sử; summary không thay full manifest tại [verification](verification.md).

# Review độc lập 1 — nghiệp vụ, giá, receipt và vòng đời UI

Ngày 2026-09-10. Reviewer không viết/sửa application source, không commit/push, không dùng log tác giả để kết luận. Baseline main 7183b31; nguồn đang uncommitted và tác giả sửa trong lúc review. Các SHA cuối ở final-source-fingerprints.json và final-test-fingerprints.json xác định phạm vi xác nhận.

## Kết luận

Ba finding đã tái hiện độc lập đều đã được tác giả sửa, reviewer tự chạy lại và đạt. Không còn finding chưa xử lý trong phạm vi nguồn/lịch thực thi dưới đây. Đây không phải nghiệm thu toàn bộ spec hoặc xác nhận push/deploy an toàn.

| Finding | Trước sửa: oracle và kết quả thực chạy | Sau sửa: tự xác nhận |
| --- | --- | --- |
| P1 — OrderHistoryDrawer confirmVoid đợi refetch rồi tạo lệnh sau khi người dùng đã đóng drawer | Real component + WriteLifecycle, giữ getOrder pending, đóng/unmount, nhả read ACK. Expected register=0, execute=0, status=paid; actual register=1, execute=1, status=void. Scratch chạy riêng exit 1 lúc 10:35. Source cũ OrderHistoryDrawer.tsx:210–230. | Refetch chuyển sang trước khi mở popup; confirm dùng snapshot đã hiển thị. Scratch final kiểm close, lock, offline→reconnect trong lúc read chờ: không mở popup, 0 register/execute, paid giữ. |
| P2 — retained-plus chấp nhận option thuộc group đã unlink | orderFlow.ts:186–190 cũ: option vẫn tồn tại, group không còn gắn món. Expected OPTION_VALUE_UNAVAILABLE và 0 new line; actual không lỗi và 1 new line. | Scratch final kiểm unlink, required mới thiếu, đổi single khi source có 2 value: cả 3 bị OPTION_VALUE_UNAVAILABLE. |
| P2 — mock sai error contract cho required/single | writeBusiness.ts:39–42: expected rejected/OPTION_VALUE_UNAVAILABLE/0 created theo TC-IDEM-036; actual rejected/INVALID_ORDER_ITEMS/0 created. SQL đã dùng mã đúng. | Scratch final missing-required trả đúng OPTION_VALUE_UNAVAILABLE; không tạo order. |

Ngoài ra kiểm độc lập root fix dirty-exit: draft chưa register, bật offline rồi bấm Đóng phải giữ drawer=order, hiện “Bỏ đơn chưa gửi?”, giữ draft và 0 register/execute/cancel. Final đạt.

## Các kiểm tra tự chạy

- Node v24.16.0 tại D:/tools/nodejs/node.exe; Vitest 4.1.11.
- Lượt final 11 file hiện có: 298 passed / 0 failed / 0 pending. Kết quả máy đọc được: final-existing-tests.json. Phạm vi core và React/jsdom dùng mock trong bộ nhớ; không phải browser E2E.
- File scratch reviewer business-review.test.ts: 8 passed / 0 failed / 0 skipped. Chạy bằng config ngoài repo reviewer-workspace/vitest.config.ts; import source ứng dụng trực tiếp.
- PostgreSQL 16.15 cục bộ, DB mới pos_cafe_idem_test_b508e7f4411d, migration 001–016. Tự chạy scripts/idempotency-native-business.mjs exit 0 và bản scratch mở rộng native-business-review.mjs exit 0. Mỗi lần tạo store UUID riêng, raw counts cuối orders=2, payments=2, events=5.

Oracle SQL literal được kiểm: create 2 × (30.000 + 2 × 5.000) = 80.000; retained giá/tên cũ + new 40.000 = 120.000; split paid 40.000/source 80.000, thừa 10.000; full 80.000 nhận 100.000; receipt thừa 20.000. In lại giữ receipt cũ sau đổi tên quán/nhân viên/bàn/món; void chặn get_payment_receipt nhưng replay R1 payment vẫn bất biến. Register có 0 order trước execute. Quote overflow bị INVALID_WRITE_REQUEST trước PRICE_CHANGED. Không có effect mới sau replay/cancel/rejection trong các raw-count assertions của lịch này.

## Cách chạy lại

```powershell
& 'D:/tools/nodejs/node.exe' 'node_modules/vitest/vitest.mjs' run src/core/writePayload.test.ts src/features/pos/writeOperationFlow.test.ts src/features/pos/orderFlow.test.ts src/features/pos/modifier.test.ts src/app/writeRecovery.test.tsx src/app/instantPay.test.tsx src/app/components/ReceiptPreview.test.tsx src/adapters/mock/writeOperationRepo.test.ts src/app/orderHistoryVoid.test.tsx src/features/pos/voidOrder.test.ts src/features/pos/posInvalidation.test.ts --reporter=json --outputFile='reviewer-workspace/final-existing-tests.json'
& 'D:/tools/nodejs/node.exe' 'node_modules/vitest/vitest.mjs' run --config 'reviewer-workspace/vitest.config.ts' --reporter=verbose
```

Native bootstrap dùng scripts/idempotency-local-bootstrap.mjs và IDEM_RUNTIME_DIR riêng, không đọc .env.local. Native checker dùng IDEM_SQL_CHECK_DSN lấy từ file env của DB test riêng; không xuất token/DSN ra report.

## Giới hạn

Native SQL gọi hàm PostgreSQL bằng SET LOCAL ROLE authenticated/request GUC; bootstrap auth/storage là schema tối thiểu. Không kiểm JWT signature, PostgREST HTTP, GoTrue, Supabase stack hoặc browser thật. Không chạy smoke:supabase, không truy cập remote. Không xác nhận đủ 93 TC/suffix manifest, toàn bộ quyền/race/rollback/TTL, migration legacy thực tế hoặc mutation sensitivity; các phần đó thuộc reviewer khác/gate tổng hợp. Những script/test bị sửa sau SHA đã lưu phải được recheck, không suy rộng kết quả này sang nguồn mới.
