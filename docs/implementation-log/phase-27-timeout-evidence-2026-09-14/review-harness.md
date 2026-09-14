# Review độc lập diff harness TC068 — 2026-09-14

**Không có finding cần sửa trong diff đã xem.** Đây là review chỉ đọc; không chạy test hay truy cập DB đồng thời với root.

Phạm vi chính xác: diff `tests/supabase/idempotencyRecovery.spec.ts` so với `main@8ed7418573fe88e27796d3b09807a3c55db4d0d6`, fixture mới `tests/supabase/idempotencyTest.ts`, cấu hình timeout và các helper mà TC068 sử dụng.

- **Oracle cũ được giữ:** bốn fixture reset riêng, observer thấy terminal committed trước khi làm mất ACK, clock chuyển sang 11/09, browser context mới pair/unlock qua runtime thật, UI hiện đúng terminal, resume disabled, payment count bằng 1 chỉ cho applied. Không chuyển backend sang mock.
- **Oracle được tăng:** `idempotencyRecovery.spec.ts:108` kiểm đúng một ledger row trước drop; `:123` kiểm đúng một execute/cancel trên thiết bị cũ; `:140` kiểm vẫn chỉ một ledger row/đúng terminal sau recovery; `:142` kiểm context mới không register/execute/cancel.
- **Barrier đúng thứ tự:** `:102–120` chờ cả observer assertion, `route.abort()` hoàn tất và browser `requestfailed`, rồi mới đóng page cũ và đổi clock. Assertion/network error trong handler được chuyển qua `dropFailed`, làm `Promise.all` reject; không bị nuốt thành pass.
- **Đóng page cũ không đổi mục tiêu TC068:** spec testplan `:861` yêu cầu terminal committed → mất ACK → clock+48h → context mới read/replay. Test vẫn tạo context mới thực sự, không chuyển storage/credentials. Trạng thái lỗi UI của tab cũ thuộc nhóm lifecycle TC053/054 và không phải oracle bị xóa trong diff này. Deep equality error/R1/decidedAt vẫn nằm ở DB counterpart `tests/contracts/writeRecovery.contract.test.ts:59–63`; review này không tuyên bố đã chạy nó.
- **Cleanup giữ lỗi gốc:** `idempotencyTest.ts:8–15` chuyển cleanup khỏi `finally` của test body sang fixture teardown, chờ tất cả context close rồi ném AggregateError nếu cần. Installed Playwright 1.60.0 (`lib/worker/workerProcessEntry.js:2512–2520`) append lỗi vào `testInfo.errors`; lỗi body đã ghi không bị thay bằng lỗi cleanup. `_useFuncFinished` được resolve trong teardown (`:1640–1642`), nên code sau `await use` vẫn chạy khi body fail.
- **Không nới gate:** `playwright.idempotency.config.ts:11–15` vẫn test timeout 45.000 ms, retry 0, forbidOnly, worker 1. Các named step 15.000 ms chỉ thêm giới hạn bên trong; không gọi `setTimeout`, `slow`, skip hay expected-failure. Prepare step vẫn dùng tổng giới hạn 45 giây.

Giới hạn: chưa có xác nhận từ lượt chạy riêng của reviewer rằng timeout đã biến mất. Root đang chạy bốn terminal ×10 trên DB cách ly; kết quả đó phải được đọc riêng. Không source edit, không test run, không deploy, không production read thêm trong subtask này.

`result.json` ghi SHA256 chính xác của các file đã review; source production app không nằm trong diff này.
