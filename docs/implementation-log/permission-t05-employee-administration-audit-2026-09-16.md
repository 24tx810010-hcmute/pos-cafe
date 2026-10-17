# PERM-T05 — Quản trị nhân viên, trần quyền và audit

Ngày 2026-09-16. **Hoàn tất T05 local; T06–T18 chưa thực hiện.** Chủ dự án đã cho phép code và push nếu cần. T05 không cần push để triển khai/kiểm thử local, nên chưa commit/push; không mở task mới hoặc thao tác Supabase thật. Runtime composition/UI vẫn legacy.

## Nguồn và kết quả

- Code HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, nhánh main; thay đổi T01–T05 còn local. Docs ở worktree riêng nhánh docs.
- Source fingerprint cuối: `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`.
- [SQL candidate](D:/Workspace/pos-cafe/supabase/candidate/permission-administration.sql:1) cài sau T04, nằm ngoài migrations tự động; chưa có launcher activation T16.
- Create/update/reset PIN dùng actor từ store JWT+employee token, quyền theo field presence và trần before/after kể cả target inactive; owner/self constraints giữ nguyên. Đổi role xóa tùy chỉnh cũ, áp bộ mới nếu gửi rõ như quyết định chủ dự án; mixed request cần cả hai quyền quản trị.
- OCC employee revision và catalog stale không ghi đè hoặc tự chuẩn hóa theo bản mới; role-only reset null, same-role thiếu overrides giữ nguyên. No-op không tăng revision hoặc thu hồi phiên. Đổi PIN/khóa nhân viên thu hồi mọi phiên; tên/role/overrides giữ phiên.
- Audit applied/noop/denied cùng registry HMAC private; không PIN/hash/token/MAC ở DTO/audit. Lỗi audit/signal/registry rollback toàn bộ. Retry exact không nhân mutation/audit; kiểm lại quyền hiện hành, dùng snapshot terminal cũ và key version lịch sử. Key rotation chỉ append, không sửa/xóa khóa cũ.
- Audit read cho owner hoặc employee.permission.edit toàn same-store, gồm target owner/operator, không target ceiling. Lọc target/outcome, limit1–100 default50, cursor ký gắn store/filter, keyset giữ độ chính xác timestamp PostgreSQL và thứ tự auditKey cố định; không GC/màn audit.
- Fragment thu hồi legacy employee RPC mọi overload cùng employee table **và column grants**. Đây là phần cần bổ sung sau static review: revoke table không tự xóa grants từng cột ở migration016. Fixture khôi phục grants trước fragment làm negative control, kiểm trực tiếp bằng phiên owner hợp lệ.
- [Supabase adapter](D:/Workspace/pos-cafe/src/adapters/supabase/permissionAdminRepo.ts:1) whitelist DTO/error, mang token hiện hành và chặn response generation cũ. [Mock](D:/Workspace/pos-cafe/src/adapters/mock/permissionAdminRepo.ts:1) cùng field/ceiling/audit/retry rules; không giả làm bằng chứng SQL concurrency. [Port](D:/Workspace/pos-cafe/src/ports/permissions.ts:1) candidate full admin đã nối mock factory; AppPorts/UI thật chưa chuyển.

## Kiểm chứng

| Gate | Kết quả | Bằng chứng và SHA-256 |
| --- | --- | --- |
| T05 | 815 unit/component,55 SQL/Auth/REST; typecheck/build PASS | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t05/b74db794-66bb-47ed-9f29-656ae8faacf2/verification.json); `4ce65f6d6e236088e089dfd0d8c60480b12f0d2a61ebcb07b97cb837022bf86a` |
| T04 | 42 SQL/Auth/REST; reuse unit/build T05 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t04/7c423f13-7cae-445e-87fe-4cebf1a8d401/verification.json); `fccbf6db4659e9072e8da18671d76a74530fe872b604d57bae1871cb0441815b` |
| T03 | 4 SQL,1.280 profiles +9 lỗi; reuse unit/build T05 theo manifest/hash | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t03/d34d911b-8ece-4614-bbc2-bfdcccae0e60/verification.json); `699af5a4b65bf7726de38c3554eabe823f7b23d08cc5befdce31be1edf02d250` |
| T02 | 52 test,6.144 comparison, protocol và revert thật | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t02/453f8b41-6851-4570-af31-4584a531d4b3/verification.json); `549988d911ccbccb0e2320b7761b8d7e0217e6d183b42035416b5023c6fc1143` |
| T01 | 152 tooling +30 PostgreSQL; preflight READY | [verification.json](D:/Workspace/pos-cafe/artifacts/permissions/t01/5f3462bd-26a9-45bb-9250-d7857d93188b/verification.json); `cf2f76a38b6079abb11bd058ed7bd360194f82a71854761a4f550c0668ca63f2` |

[Runner T05](D:/Workspace/pos-cafe/scripts/permission-administration-verify.mjs:1) khóa Node24.16.0 và dependency versions theo package-lock, giữ nguyên pnpm lock đã có; [manifest](D:/Workspace/pos-cafe/tests/permissions/permissionAdministrationCases.json:1) kiểm discovery/results/options và source trước/sau. Không skip/retry/expected failure. Test T03 read-only composition đã đổi đúng sang full candidate admin của T05, cùng manifest T03; quyền đọc và mutation riêng vẫn được kiểm.

[Suite SQL](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1) dùng Auth/REST và PostgreSQL thật trong runtime T04 cách ly. Barrier/pg_blocking_pids chứng minh hai admin ngược chiều, catalog writer, mất action khi chờ mutex, hết phiên khi chờ catalog và hai thứ tự issuance/reset. Inject lỗi audit/signal/registry chứng minh rollback; MAC rotation/replay và cursor tamper/timestamp tie có test riêng. 55 là execution variants, không phải 55 TC nghiệp vụ đã đóng toàn bộ.

Các lỗi được phát hiện và sửa trước nghiệm thu: test giữ mutex đến commit nhưng chờ cả hai request; mock pagination dùng comparator khác nhau; mock bỏ audit một số denied input; audit thiếu đề nghị hợp lệ ở forbidden/OCC; adapter từ chối tên Unicode/legacy hợp lệ khi đọc; grants theo cột còn mở. Không hạ expected hoặc dùng mock thay gate DB để làm test xanh.

## Phạm vi còn lại

- UI danh bạ/form/ẩn nút và authority/cache lifecycle chưa triển khai (T11–T14); chưa có thay đổi trực tiếp trên UI.
- Bảo vệ financial K sau khóa là T06; projection còn lại T07; clear-demo giữ audit T08. T05 đã giữ audit khỏi app DML, chưa chứng minh clear-demo integration.
- Store signal hiện chỉ là row metadata trong transaction; publication/Realtime thật T10 chưa chạy. Storage T09, activation/migration cửa hàng thật T16 chưa chạy.
- T05 không thêm owner recovery route trong app, không thực hiện khôi phục con người, không đổi 15 quyền hoặc thêm role Kế toán.

## Chạy lại và vận hành fixture

Lệnh chính: `npm run test:permission:t05` với IDEM_ENV_FILE trỏ fixture synthetic của runtime T04 ở localhost59421/59422. Môi trường phải khớp project/config/marker và chỉ bind loopback. CLI local2.117.0 được dùng trong WSL cho fixture; không liên kết hoặc gọi Supabase MCP production.

Runner stage/revert candidate trong runtime riêng, xác minh hash business/ledger không đổi; không dùng quy trình đó làm rollback phát hành thật. Không lưu JWT/PIN/service secret ở repo/report. Sau nghiệm thu dừng các runtime test riêng T01/T02/T04, giữ volumes và cấu hình để chạy lại. Không tắt Docker/WSL toàn máy.

**Bàn giao tiếp theo: PERM-T06.** Giữ immutable payload/R1/TTL/initiator; prelock tất cả employee FK trước checkpoint catalog, đọc quyền và clock mới sau chờ business/K. Không thay expected race cũ để tránh lỗi.

**Regression sau T06, 2026-09-16:** xem [biên bản T06](permission-t06-financial-authority-2026-09-16.md) tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. Giữ các kết quả trên cho checkpoint lịch sử; T06 không thay gate consumer/service/activation còn lại.

**Regression sau T07, 2026-09-16:** xem [biên bản T07](permission-t07-read-projections-2026-09-16.md) tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. Giữ kết quả trên cho checkpoint lịch sử; các consumer/service/activation gate chưa cung cấp không được coi đã chạy.
