# PERM-T06 — Kiểm quyền financial sau chờ khóa

Ngày 2026-09-16. **Hoàn tất T06 local; T07–T18 chưa thực hiện.** Người dùng đã cho phép code và push nếu cần. Task này không cần push cho kiểm thử local; chưa commit/push, chưa áp candidate lên Supabase thật. AppPorts/UI vẫn legacy.

## Kết quả và phạm vi

- Code HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, main; T01–T06 còn local. Docs ở worktree riêng nhánh docs. Source fingerprint cuối: `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`.
- [SQL candidate](D:/Workspace/pos-cafe/supabase/candidate/permission-financial.sql:1) áp sau T04/T05 trong fixture; sáu RPC register/execute/get/list/cancel/capabilities dùng catalog, role/overrides và phiên hiện hành. Chưa phải launcher activation T16.
- Preliminary identity không giữ khóa actor/session; execute chờ pos-write/K và business trước. Sau đó prelock toàn bộ employee FK theo UUID, session, catalog SHARE và đọc lại authority/clock. Không outer store-authority SHARE ngăn admin revoke trong lúc chờ order.
- FK cần giữ trước checkpoint: store, actor của K mới/cancel, executor trong order/payment/K/event và initiator bất biến trong order_events. Takeover có initiator inactive vẫn hợp lệ khi executor đủ quyền; không chuyển initiator sang executor.
- Get/list/cancel/register lại và terminal replay kiểm action của K hiện hành. History/reprint không cho takeover. List lọc quyền trước LIMIT/cursor và kiểm phiên từng item; thiếu quyền không đổi pending K hoặc kết quả cũ.
- Giữ immutable payload/R1, protocol1, pending TTL24h, order lifetime, historical prices/options, business constraints và attribution. Sáu public RPC giữ timezone UTC từ migration016 ngay cả khi caller dùng múi giờ khác.
- Fragment tự đóng legacy financial overload, table/column DML và raw K/event SELECT; fixture chủ động mở grants trước khi áp candidate để tránh gate xanh nhờ revoke của fixture T04. Raw orders/items/payment SELECT theo projection T07, chưa hoàn tất tại T06.

## Bằng chứng kiểm thử

| Gate | Kết quả | Bằng chứng và SHA-256 |
| --- | --- | --- |
| T06 | 815 unit/component,44 SQL/Auth/REST; typecheck/build PASS | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t06/03b8e047-17a4-420d-8250-e93254901401/verification.json); `0f0a3d05eb50229b0afea7cea3bc3e59faab870346a764b677d9a7841e598c5e` |
| T05 | 55 SQL/Auth/REST; reuse unit/build T06 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t05/45b28c6b-e89a-4915-a07e-482eaf5f4abb/verification.json); `79ba5aecc5d3905998745acd50a1b5884cb0abaf2f013ff9fe57f3465fc92f71` |
| T04 | 42 SQL/Auth/REST; reuse unit/build T06 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/a738ee6c-ca66-4a59-a1a8-7fa29612a4ec/verification.json); `c07c18060091f063c2387f5c3916668b4d97faa2f2e1f53bdfd00a461b05ac65` |
| T03 | 4 SQL,1.280 profiles +9 lỗi; reuse unit/build T06 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t03/75d66c7a-8fd1-4906-b46b-f0ead7df426f/verification.json); `6bf3a97c416983c54e1a1ea088d5c662920744cb25001b84c8d050be7607ebed` |
| T02 | 52 test,6.144 comparison, protocol và revert thật | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/d40b711b-d7ae-41df-ae32-9457c8c47497/verification.json); `54c3a89bd75319893501acf4c92d0cf53587e373e958424279cf39dcc2a30de2` |
| T01 | 152 tooling +30 PostgreSQL; preflight READY | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/dddd18b4-be7f-4bb7-9a43-819a466db444/verification.json); `d6ba9bfe888c3dc2fe0269ee2ce2876ed53cde3a653aad38ea5e24ed5081d098` |

[Runner](D:/Workspace/pos-cafe/scripts/permission-financial-verify.mjs:1) kiểm Node24.16.0, dependency đúng package-lock, source trước/sau và [manifest bắt buộc](D:/Workspace/pos-cafe/tests/permissions/permissionFinancialCases.json:1). Discovery/results/options phải khớp, không skip/retry/expected-failure. Giữ nguyên lockfiles có sẵn.

[Suite bảo mật](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1) chạy PostgreSQL/Auth/REST thật trong runtime T04 cách ly. Barrier pg_blocking_pids kiểm revoke commit trước nhả order, catalog đổi quyền/hết phiên khi chờ, prelock initiator và writer/admin queue. Negative controls cố tình bỏ post-lock authority hoặc initiator prelock phải bị phát hiện, sau đó khôi phục định nghĩa hàm. TTL kiểm biên trước/bằng/sau expiresAt; mất ACK và K terminal tạo trước fragment không thay payload/R1/initiator/executor.

[Suite nghiệp vụ](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1) kiểm create/update/void-open, full payment, partial split và void-paid; giữ giá/tùy chọn lịch sử khi menu đổi, receipt/R1 bất biến, một effect/event mỗi K, trạng thái bàn và rejection PRICE_CHANGED/PAYMENT_AMOUNT_TOO_LOW không ghi dở dang. Test múi giờ Bangkok bảo vệ cấu hình UTC của giao thức.

Review phát hiện và sửa mất timezone config do CREATE OR REPLACE; các lỗi seed mapping/table occupied trong test cũng được sửa trước gate. Không đổi expected nghiệp vụ cũ để làm race xanh. 44 là execution variants, không phải 44 TC đã đóng toàn bộ.

## Giới hạn và bàn giao

- TC44 mới phần financial takeover/FK; bulk clear/seed, open-order blocker và retention cùng concurrency hai thứ tự là T08.
- TC54 có synthetic preexisting K và boundary tests, chưa có activation/mapping cửa hàng thật T16. TC42/43 đã regression T05, không coi financial suite thay thế admin/session tests.
- Projection/raw sensitive SELECT T07, menu/floor/settings/clear T08, Storage T09, Realtime T10 và consumer/UI T11–T14 chưa hoàn tất. Chưa bảo vệ đủ15 quyền trên ứng dụng đang chạy.
- Không đổi màn hình/nút, không thêm role kế toán hoặc recovery route. Không chạy Storage/Realtime live service gates hay rollout.

Chạy lại bằng `npm run test:permission:t06`, IDEM_ENV_FILE phải trỏ synthetic runtime T04 loopback59421/59422 có marker/config đúng. Fixture backup/restore hàng dữ liệu bằng TEMP tables để giữ độ chính xác timestamp/numeric, kiểm hash business sau rollback; đây không phải quy trình rollback phát hành. Không lưu credential trong repo/report. Sau nghiệm thu dừng riêng runtime T01/T02/T04 và helper giữ WSL, giữ volumes; không tắt Docker/WSL toàn máy.

**Tiếp theo PERM-T07:** projection đọc và danh bạ tối thiểu, đóng raw SELECT nhạy cảm theo mục đích/quyền hiện hành.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
