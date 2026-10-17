# CLOSE-2 — ma trận kiểm TC-PIN-01–09, 12/10/2026

## Phạm vi và quy tắc kết luận

Người dùng giao hoàn thiện riêng TC01–09 trước khi chạy PERM60. Nguồn yêu cầu là `openspec/changes/force-default-pin-change/{testplan,design,usecases}.md` và `specs/employee-session/spec.md`. Ma trận dưới đây là kiểm kê **đầu lượt**; trạng thái thực thi và review ở phần cuối tài liệu. Các lượt G1/G2a/G2b/G2c và CLOSE-1 là lịch sử, không ghép thành một gate hiện hành.

| ID | Biến thể bắt buộc và oracle | Executable hiện có / phần cần bổ sung | Trạng thái 12/10 |
| --- | --- | --- | --- |
| 01.A | Blank Auth bootstrap: đúng một owner true/rev0; workflow skipped, stage0, session0, không normal seed | `ownerPinOnboardingCloseout.spec.ts` TC01: SQL snapshot | PENDING rerun cùng source cuối |
| 01.B | Login đúng restricted: exact 10-key DTO, TTL300s, không authority; sai PIN không session | Cùng test TC01: REST response + SQL count | PENDING rerun |
| 01.C | Anonymous REST HTTP401/42501; direct SQL `AUTH_REQUIRED`; cả hai không token/authority | Cùng test TC01 và `ownerPinServerRuntime.contract.test.ts` | PENDING rerun |
| 02.A | Cache, protected route, deep link, back/reload đều giữ gate; không protected query/AppShell, không skip | `restrictedAppGate.test.tsx`; browser `ownerPinOnboarding.spec.ts` chỉ một đường. Cần browser variants | GAP |
| 02.B | Check proof exact projection, TTL không gia hạn; focus/reconnect và network error giữ gate; expired/revoked về PIN | `requiredPinChange.test.tsx`, `PermissionLifecycle.tsx`; cần Auth/REST browser oracle | GAP |
| 02.C | G1 proof bị giữ rồi logout/login S2 G2; trả G1 không đổi G2 | Unit generation có; cần browser hai store | GAP |
| 03.A | Inventory candidate grants/routes: mọi protected RPC restricted/missing/invalid/foreign/revoked với exact denial, không protected body | `ownerPinSurface.contract.test.ts` kiểm 42 RPC trên G1 lịch sử; cần token transport matrix trên activated target | GAP |
| 03.B | Direct REST read/DML, SQL app-role, Storage upload/delete gateway; không row/data/K/R1 mutation đo trước rollback | G1 oracle/negative controls có; cần REST/Storage transport và candidate inventory hiện hành | GAP |
| 03.C | Chỉ check/complete/revoke restricted; exact allowed projection và public metadata tối thiểu | SQL contract có; cần REST projection/token matrix | GAP |
| 04.A | Mọi PIN/UUID/revision/extra-field boundary gọi forced RPC thật; từng denial giữ hash/flag/rev/session/signal, audit theo design | `ownerPinServerRuntime.contract.test.ts` source-02 17 input, per-call SQL snapshot; cần current run | PENDING rerun |
| 04.B | UI confirm mismatch không RPC; same PIN reuse denial exact message/audit | `requiredPinChange.test.tsx`; cần browser no-RPC, current SQL | GAP |
| 04.C | `000000`/`111111` khác PIN hiện tại được nhận, không blacklist | Source-02 SQL variants | PENDING rerun |
| 05.A | Tám recovery transitions: exact hash equality same PIN, rev+1, một audit/signal/registry, revoke 0/2 sessions | Source-02 SQL matrix | PENDING rerun |
| 05.B | App roles/overrides/service_role không operator; refs rỗng/201; missing/nonowner/inactive/wrong tenant/PIN; exact code/message, unchanged | SQL auxiliary một phần; cần full actor/target/refs transport | GAP |
| 06.A | Hai restricted tokens→complete; cả hai check/complete/business denied; old PIN denied, new normal12h/authority | SQL one-token + G2a browser; cần two-token same fixture | GAP |
| 06.B | Một audit/signal/receipt; pending K không tự execute/payment/print, network và DB observer | G2a pending K/net observer lịch sử; cần same-candidate aggregate | GAP |
| 07.A | Complete/recovery fault audit/signal/registry: full hash/state/session/audit/signal/registry rollback, exact context error; explicit retry | `ownerPinServerRuntime.contract.test.ts` faults một phần | GAP |
| 07.B | Employee/menu/floor stage receipt faults: prior committed stages/edited data giữ, needs_retry sanitized; retry không reapply | Employee SQL + TC15 browser menu lịch sử; floor/retry matrix cần thêm | GAP |
| 08.A | Barrier two complete cả ordering; complete/recovery cả ordering; lock wait được chứng minh, final state/session đúng | G2b two-complete lịch sử; cần complete/recovery transport | GAP |
| 08.B | TTL−1/0/+1ms và expiry while waiting; stale revision token còn valid | Source-02 SQL −1/0/+1 + G2c expiry-wait lịch sử; cần same-candidate run | PENDING rerun |
| 08.C | Late browser response không mở authority G2 | Unit generation; cần browser race | GAP |
| 09.A | Forced-complete ACK sau commit và trước execute; không auto replay, login xác minh | G2a Auth/REST/browser lịch sử; cần current run | PENDING rerun |
| 09.B | Denied request same/different payload; recovery→actual complete→replay; wrong payload/actor/tenant không receipt leak; no mutation | Source-02 SQL có actual complete/replay; cần transport/snapshot đầy đủ | GAP |

## Bằng chứng đầu vào, chưa phải acceptance hiện tại

- Main HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, dirty; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, dirty. Snapshot đầu vào: main manifest SHA-256 `4a270445af6da0d68dcb3c895bd24441737e8fe048bd2397822c01c7057a016a`, tar `a57f786a60203acf2506647d5a3600d8c3a372a5ce481ee0c3774cfc315b1ec1`; docs manifest `e101510fb979b991e607d8bc6b42c7984553a19480919ca22e641a6e4dd8c718`, tar `f7185ec15972268571fb245a459a7e1bcec3812582baec595607a932d26ad582`.
- `permissionFingerprint()` đầu vào `e381326feee264bf7fcb326ddd3f71534ffd75db28e628591138e5057fbf541a`; browser full46/46, unit1173, build/typecheck và UI audit chỉ chứng minh assertion hiện hữu. SQL source-02 35/35 và G1/G2a/G2b/G2c là lịch sử từng scope.
- Target 599xx đã được kiểm stopped12, label/config/network loopback/volume, rồi start12. Preflight đầu `PIN_ONBOARD_SERVICE_REFUSED` lúc health chưa sẵn; preflight sau PASS project/port/strict. Chưa chạy DB suite khi ghi ma trận này. Keepalive WSL helper Windows PID 33832, phải xác minh command trước khi dừng.

## Hướng dẫn walkthrough dự kiến

Đọc testplan→ma trận này→forced SQL và browser/REST/Storage oracle→safe receipts→review hai scope. Chưa ghi chủ dự án đã xem hoặc nghiệm thu.

## Đối chiếu execution trên source-09

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, working tree chưa commit; snapshot `artifacts/permission-pin-identity-close1/source-09.json` và `source-09.tar`, tar SHA-256 `9c8c18be929e89fa2cd668f62ec538874dedde6f86ef58f8d384b8cc7660a5cf`. Đây là source sau cùng của code/test TC01–09. Hai target được chạy **tuần tự**: activated contract2 599xx cho Auth/REST/Storage/browser, legacy16 600xx cho SQL staged trong transaction. Không có PERM60 hoặc CLOSE-3 trong lượt này.

| Biến thể | Oracle thực thi hiện hành | Kết quả |
| --- | --- | --- |
| 01.A–C | Blank bootstrap + DTO/TTL/invalid PIN + anonymous REST/SQL, fixture graph/session | Browser TC01, PASS |
| 02.A–C | Browser TC02 tạo floor cache normal thật, recovery owner thật, theo dõi RPC dữ liệu/quyền từ trước recovery; focus/reconnect→passcode rồi restricted login, AppShell/floor vắng và các RPC được theo dõi count0 (không gồm revision revalidation). Proof projection/TTL/network/offline/online/revoke/expiry/reload; S1→S2 route cũ settle, unit kiểm callback muộn. Query/hash POS/admin/report/print + back là URL probes vì app không có URL router. | Browser TC02 3 PASS + unit generation/lifecycle PASS; giới hạn URL/response ghi dưới bảng |
| 03.A–C | Candidate grant inventory 42 protected RPC; restricted/missing/invalid/revoked/foreign token; per-call whole-store snapshot; REST/SQL DML và Storage metadata/bytes; allowed routes/projection | Browser TC03 2 PASS, SQL grant checks PASS |
| 04.A–C | Forced RPC full PIN/UUID/revision/shape boundary, same-PIN replay, weak PIN allowed; UI confirm no RPC | SQL + browser TC02 PASS |
| 05.A–B | Tám recovery combinations; refs/PIN/target and no mutation; app role ACL, owner/manager/cashier/foreign token cannot assume operator; inactive owner synthetic malformed fixture rollback | SQL source-09, PASS |
| 06.A–B | Hai restricted tokens revoked, login mới12h, authority, one audit/signal/receipt; pending K/no-auto network+print+DB | Browser TC06, PASS |
| 07.A–B | Complete/recovery fault audit/signal/registry rollback+explicit retry; employee/menu/floor stage receipt faults, needs_retry, prior edit preserved | SQL source-09, PASS |
| 08.A–C | Barrier complete/complete được queue deterministic cả hai thứ tự, complete/recovery cả thứ tự, TTL−1/0/+1 và expiry trong wait, stale revision; S1 completion route settle không tháo gate S2; unit kiểm callback muộn | SQL source-09 + browser TC08, PASS theo oracle và giới hạn dưới bảng |
| 09.A–B | ACK drop before execute/after commit, login verification/no auto replay; denied same/different request; recovery→actual complete→replay and actor/tenant denial | Browser TC09 2 + SQL source-09, PASS |

Final safe receipts và phần lịch sử FAIL được liên kết trong [biên bản TC01–09](permission-pin-tc01-09-closeout-2026-10-12.md). `PASS` ở bảng này là oracle đã thực thi; tuyên bố bàn giao hoàn tất còn phụ thuộc hai reviewer độc lập theo workflow. URL query/hash probes không đại diện deep-link route thật vì ứng dụng hiện không dùng URL router; gate được kiểm bằng AppShell vắng mặt sau mỗi probe/back. Browser S1 route settle có thể kết thúc do request bị hủy khi chuyển quán; unit test kiểm riêng late callback generation, không gán browser là một response được UI nhận.
