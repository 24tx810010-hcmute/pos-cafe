# Kế hoạch thực hiện và cổng chặn

**Cập nhật 2026-09-10:** chủ dự án đã duyệt phạm vi, push docs trước và bắt đầu triển khai; chỉ push code sau khi đạt các kiểm tra bắt buộc. Ngân sách giờ chưa cố định; cập nhật dự báo theo thực tế, không yêu cầu chọn lại kịch bản để bắt đầu.

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](proposal.md#thuat-ngu).

Kế hoạch lập ngày 2026-09-09; **triển khai bắt đầu ngày 2026-09-10** sau khi chủ dự án duyệt. Docs đã push ở commit `0ecf84d`; code đã nghiệm thu, commit và push `main@3ada48c`; chưa deploy migration thật. Checkbox chỉ được đánh hoàn thành khi cả phần hiện thực và kiểm chứng của task đã đủ; có code hoặc một nhóm test pass chưa thay thế nghiệm thu toàn bộ. Ước lượng mỗi mục ≤ 2 h là kích thước công việc, không cam kết tổng lịch; nếu thực tế vượt thì tách task có đầu ra/kiểm thử riêng.

Thứ tự: contract/harness → danh tính/nguồn quyền → ledger/coordinator → business helpers → UI/mock → tests độc lập → docs/rollout. Task có thể song song chỉ sau đủ dependency và không cùng file. Cổng danh tính/bypass + DB test thật không được hoãn rồi gọi giao thức đã an toàn.

## Tổng khối lượng và phần chưa cố định

| Nhóm | Task | Giờ công dự kiến |
| --- | --- | --- |
| Cổng trước code | 01–03 | 2,5 |
| Contract và harness | 04–08 | 10 |
| Phiên server và quyền | 09–14 | 12 |
| Giao thức và persistence | 15–19 | 10 |
| Bốn nghiệp vụ | 20–25 | 11,5 |
| Mock và UI | 26–32 | 13 |
| Chạy kiểm chứng và ba reviewer | 33–39 | 13,5, trong đó reviewer là 6 |
| Sửa lỗi phát sinh | 40 | 2n, với n là số task sửa lỗi |
| Tài liệu và rollout | 41–43 | 4 |
| **Tổng** | **43 đầu mục** | **76,5 + 2n** |

78,5 giờ tương ứng một task sửa lỗi; không phải trần khối lượng. Nếu một việc vượt 2 giờ thì tách lại và cập nhật ước lượng. Đây là giờ công, không phải thời gian lịch đã cam kết. Lịch một tuần ở roadmap và việc đưa một phần quyền tầng dữ liệu vào change này cần được chủ dự án chốt lại; xem [proposal](proposal.md).

## 0. Cổng trước code

- [x] 01. Đã đọc bộ spec và review 14–15; chủ dự án duyệt phạm vi và bắt đầu triển khai ngày 2026-09-10. Lịch cập nhật theo quỹ giờ thực tế, không ấn định 20/40 giờ (0,5 h).
- [x] 02. Đã kiểm main/docs status và SHA ngày 2026-09-10: main/origin-main tại `7183b31`, docs đã push `0ecf84d`; giữ nguyên `pnpm-lock.yaml` có sẵn và không đưa file này vào commit của change. Triển khai trực tiếp tại worktree main theo mô hình hai nhánh (0,5 h).
- [x] 03. Tạo manifest TC/suffix/expected, preflight test DB riêng và observer. Thiếu môi trường đánh BLOCKED DB tests, không xóa ca bắt buộc (1,5 h).

## 1. Contract và test harness

- [x] 04. Thêm domain/ports cho operation/payload/session/error và fixture registry độc lập; test validate required/null/UUID (2 h).
- [x] 05. Thêm money/quantity/note/options/size validators với tests biên, tránh import helper SUT làm expected (2 h).
- [x] 06. Thêm explicit Vitest contract config/scripts/discovery/result verifier; chứng minh thiếu file/skip/config bị fail (2 h).
- [x] 07. Thêm harness DB observer/barrier/clock/fault test-only và preflight cách ly test project; chứng minh PID khác và không public hook (2 h).
- [x] 08. Tạo receipt schema/expected literals và kiểm renderer/historical builder dùng option quantity đúng (2 h).

## 2. Phiên server và đóng bypass

- [x] 09. Migration employee_sessions, start/revoke token, employee/PIN safe fields; test phiên/PIN/store/12 h/reset (2 h).
- [x] 10. Adapter/token header memory + lock/reload/expired flow; test không persist credential và không auto execute sau đổi phiên (2 h).
- [x] 11. Bảo vệ employees/overrides/PIN bằng admin server session; test self-promotion và deny-vs-grant matrix (2 h).
- [x] 12. Bootstrap store một lần và đổi create/seed flow dùng phiên admin tạm; giữ UX Store Key/PIN, test seed true/false/retry (2 h).
- [x] 13. Khoá grants financial/parent/tables.status; chỉnh config/admin/clearDemo cần thiết và kiểm inventory mọi overload/helper (2 h).
- [x] 14. Catalog lock BEFORE STATEMENT và lock-order kiểm chứng; test giá/quyền đổi trong lúc execute chờ (2 h).

## 3. Giao thức và persistence

- [x] 15. Migration ledger/audit/creator/receipt_snapshot, indexes/constraints/legacy preflight; test giữ snapshot/unknown creator (2 h).
- [x] 16. Register/get/capabilities + schema/equality/no effect/TTL timestamp đầu; test race register/mismatch (2 h).
- [x] 17. List/filter/cursor/authorization/lazy expiry, không lộ tenant; test 101 rows/ties/filter/status (2 h).
- [x] 18. Execute coordinator/terminal/counter/auth checkpoint và error taxonomy/subtransaction; test counter/rollback skeleton (2 h).
- [x] 19. Cancel/expiry lock arbitration và clock after business locks; test −1 ms/0/+1 ms, 4 blockers, commit after deadline (2 h).

## 4. Bốn nghiệp vụ trong transaction

- [x] 20. Refactor submit create private helper, quote/catalog check, ID collision và create-bàn/takeaway-number races (2 h).
- [x] 21. Refactor update retained/new source, note/decrease/void_open, audit; chạy fake-source và giá 100 k/129 k/dirty-note tests (2 h).
- [x] 22. Refactor pay full helper + receipt/payment snapshot/audit; test 150 k/200 k/cash/money bounds/OCC (2 h).
- [x] 23. Refactor split helper move/copy/options/numbering/linkage; test partial/full row/races/receipt (2 h).
- [x] 24. Refactor void paid helper NULL-safe/version/reason/audit; test paid positive control và bàn khách mới (1,5 h).
- [x] 25. Activation migration thu hồi tất cả old overloads/helpers, capability v1; test trực tiếp RLS/grants và client cũ bị chặn (2 h).

## 5. Mock và UI online

- [x] 26. Mock state machine/immutable payload/clock/errors/counter cùng contract; chạy expected literals độc lập với DB (2 h).
- [x] 27. Draft giữ source ID/snapshot; dirty detection/nút cộng/hiển thị hai giá/không modifier cũ; unit+component tests (2 h).
- [x] 28. Coordinator explicit register → execute/generation/15 s timeout/không paused mutation/outbox; test request counts (2 h).
- [x] 29. Payment selection đóng băng kind/IDs/qty/version trước register; test cả hai clamp và full → pay (2 h).
- [x] 30. Màn list/detail recovery chọn K, phân biệt R1/current, takeover/cancel/expired/manual new K; component tests (2 h).
- [x] 31. PRICE_CHANGED UI quote cũ/mới, yêu cầu confirm K mới; test tăng/giảm/option-only và 0 auto resubmit (1,5 h).
- [x] 32. Receipt first/replay/history/print/current void guard và late response/timer đã kiểm lại; xem log khắc phục F2–F5 ngày2026-09-11.

## 6. Kiểm chứng độc lập và nghiệm thu

- [x] 33. Chạy DB contracts success/errors/schema/direct security; lưu snapshot/manifest actual/expected và lỗi nếu có (2 h).
- [x] 34. Chạy DB concurrency/TTL/rollback/lost ACK với barriers/fault từng checkpoint; không coi timeout là pass (2 h).
- [x] 35. Chạy Supabase E2E hai browser contexts mới, local wipe/K1, K2/takeover/late ACK/online/UI receipt (2 h).
- [x] 36. Chạy build/unit/architecture/mock smoke regression; đối chiếu discovery và không skip tất cả required TC (1,5 h).
- [x] 37. Reviewer độc lập 1 đọc code+test, tự chạy nhóm nghiệp vụ/giá/receipt; báo expected/actual/SHA/backend, không chỉ đọc log (2 h).
- [x] 38. Reviewer độc lập 2 tự kiểm DB/quyền/race/rollback/TTL trên test DB riêng; báo kết quả/giới hạn (2 h).
- [x] 39. Reviewer độc lập 3 kiểm discovery/preflight/oracle/mutation sensitivity và tổng hợp thiếu TC (2 h).
- [x] 40. Findings F1–F5 và generation guard phát sinh đã xử lý; gate cuối1123pass/758required cùng fingerprint, hai subagent cross-review phần không do mình viết. Xem log khắc phục F2–F5.

## 7. Tài liệu và rollout

- [x] 41. Cập nhật docs kiến trúc/data-model/features/requirements/limitations theo code thực, ghi actor/TTL/giá/lýdo và log test; không gọi tính năng chưa chạy là done (2 h).
- [x] 42. Lập rollout DB/app cùng cửa sổ dừng ghi, migration backup/rollback không mở lại RPC cũ; kiểm concrete diff trước yêu cầu deploy nếu chưa được phép (1 h).
- [x] 43. Bàn giao gói SHA/manifest/results/reviewer reports và điểm deferred cho báo cáo; chỉ archive change sau đạt yêu cầu (1 h).

## Bằng chứng hoàn thành ngày 2026-09-10

Task 03–36: code main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9, 1.034 test PASS, 669/669 execution bắt buộc cùng fingerprint; build/coverage/mock smoke đạt. Task 37–39: ba reviewer độc lập đều đã tự kiểm và chốt không finding mở trong scope. Task 41–43: live docs, rollout, runtime và [gói bàn giao](../../../docs/implementation-log/phase-27-evidence/verification.md) đã tồn tại. Triển khai môi trường thật và archive delta không nằm trong lần push code này.

Task 40 được chia thành các đầu ra sửa lỗi sau, mỗi đầu ra ước lượng tối đa 2 h để theo dõi, không dùng làm số giờ thực tế đã đo:

| Task con | Đầu ra đã sửa | Kiểm chứng |
| --- | --- | --- |
| 40a | Đọc order muộn không tạo void sau đóng/khóa/offline | Reviewer 1 + writeReviewRegressions |
| 40b | Retained-plus kiểm link/required/single hiện hành | Reviewer 1 oracle và core regression |
| 40c | Mock required/single đúng OPTION_VALUE_UNAVAILABLE | Reviewer 1 và TC-IDEM-036 |
| 40d | Employee DTO có overrides{} được chuẩn hóa | Supabase adapter tests + signup/E2E |
| 40e | Thử lại cùng K giữ payload; dirty navigation có xác nhận | Core/component và lostACK E2E |
| 40f | DB quote overflow/midnight/trim đúng checkpoint | Native SQL supplement + contract schema/clock |
| 40g | Discovery không trùng TC/sai backend | Actual runner discovery, 0 missing/duplicate/wrongBackend |
| 40h | Expected-failure/retry/repeat/only không được tính pass | Reviewer 3 actual Vitest/Playwright controls |
| 40i | Oracle raw tiền/zero mixed/4 terminal + lưu PID/xid | Reviewer 3 đọc oracle, DB contracts 415 PASS |
| 40j | Runtime CORS, print iframe/selector, fixture UUID hợp lệ | Actual Auth/REST E2E 34 PASS + mock smoke 35 PASS |

Đây là nhật ký đầu ra phát sinh, không thay expected đã duyệt hoặc nới gate. Không quy thời gian máy/agent chạy thành giờ làm của chủ dự án.

## Điều kiện đánh dấu hoàn thành

### Theo dõi hậu kiểm F1 ngày 2026-09-10

- [x] 40k. Cô lập cache theo store/employee/session, loại dữ liệu sau denial, chặn response/receipt cũ đi qua phiên; thêm 12 core/component + 3 E2E bắt buộc. Hai subagent kiểm độc lập đạt; gate cuối 560 unit/component + 415 DB + 37 tooling + 37 E2E = 1.049 pass, 684/684 required cùng fingerprint `7e006793780d39218b28712db96bbbe62e4d9e4901ac1bb1cc504a1fec9deeca`. [Bằng chứng F1](../../../docs/implementation-log/phase-27-f1-evidence/verification.md). Working tree chưa commit/push/deploy.
- [x] 40l. F2–F5 đã xử lý/kiểm chứng tại lần bổ sung2026-09-11; không dùng chỉ riêng evidence F1 làm bằng chứng.

Các số 1.034/669 và kết luận reviewer phía trên là biên bản của main@3ada48c trước hậu kiểm; không dùng làm số test của candidate khắc phục F1.

Một checkbox chỉ hoàn thành khi đầu ra đã tồn tại và testcase tương ứng chạy đúng expected. Task viết test và task chạy test khác nhau. Final gate yêu cầu không còn requirement/UC thiếu TC, mọi biến thể bắt buộc có execution result, không skip, không fallback mock, không finding nghiệp vụ/quyền chưa xử lý. Nếu thiếu môi trường, báo rõ BLOCKED/NOTRUN và điều kiện mở lại; không thay nhãn này bằng pass.


### Theo dõi khắc phục F2–F5 ngày 2026-09-11

Chủ dự án đã cho xử lý cả bốn finding. Thay mô tả “chưa triển khai trong yêu cầu F1” ở40l bằng phạm vi bổ sung này; các số/nghiệm thu phía trên vẫn là lịch sử.

- [x] 40l1. F2: guard await/timer in, late error, offline/close/session và positive print.
- [x] 40l2. F3: cast số JSON nguyên tương đương trong015; raw-wire positives/negatives và mutation.
- [x] 40l3. F4: consume draft đúng lượt retry applied, khóa giỏ unresolved, không tự in/sinh K.
- [x] 40l4. F5: đủ oracle TC030 old/TC066 report/TC085 legacy, manifest và gate cuối cùng fingerprint.
- [x] 40l5. Hai subagent cross-review phần không do mình viết, xử lý finding phát sinh và ghi giới hạn bằng chứng.
- [x] 40l6. Cập nhật bàn giao và nhắc chủ dự án migration014→015→016; không tự áp trên môi trường thật.

Kết quả cuối2026-09-11: [log F2–F5](../../../docs/implementation-log/phase-27-p2-fixes.md), [verification](../../../docs/implementation-log/phase-27-p2-evidence/verification.md). 1123passed/758required; fingerprint 35c5f9485b42056303e63a688b8d4a711e0603161a77028e659313796028ea51. Chưa commit/push/deploy; migration và archive vẫn là việc phát hành riêng.


## Hậu kiểm trước push ngày 2026-09-13

- [x] 40m1. Tái hiện P2 lỗi action recovery cũ khóa phiên mới/xóa draft; bổ sung guard và 12 regression bắt buộc.
- [x] 40m2. Negative control: 8 assertion FAIL/4 positive PASS; full unit 589 PASS, build PASS và hai reviewer xác minh guard.
- [x] 40m3. Dựng runtime WSL PostgreSQL/PostgREST/GoTrue; preflight/marker và gate mới 14/09 đạt cùng fingerprint. Lần fail timezone và một timeout E2E/rerun được giữ riêng; xem báo cáo 14/09.
- [ ] 40m4. Chỉ commit/push phần phase27 sau gate mới và review đạt; giữ pnpm-lock và tài liệu tính năng khác ngoài commit này.


## Hậu kiểm WSL ngày 2026-09-14

- [x] 40n1. Tái hiện và sửa callback initial-submit/payment/split/history cũ; giữ positive current errors/success và busy generation của popup hủy.
- [x] 40n2. Viết 48 regression bắt buộc và cập nhật manifest 818; assertion tooling phân nhóm riêng, không bỏ 12 cache oracles.
- [x] 40n3. Hai reviewer chốt độc lập và gate bốn stage trên candidate cuối; không cộng các run chồng lặp hoặc report cũ.
- [ ] 40n4. Bàn giao bằng chứng runtime WSL, lịch sử lỗi môi trường/test, SHA code/docs và kết quả push có kiểm remote.
