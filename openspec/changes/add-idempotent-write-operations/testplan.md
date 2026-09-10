# Testplan — expected độc lập trước triển khai

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](proposal.md#thuat-ngu).

Ngày 2026-09-09. **93 testcase gốc đã thiết kế; chưa hiện thực/chưa chạy.** Các ma trận tham số có suffix riêng (mục B); số testcase thực chạy phải lấy từ manifest, không coi 93 là số execution cuối. Mọi vị trí file bên dưới là **dự kiến**, không tuyên bố file test hiện đã tồn tại.

## A. Cổng chạy và quan sát

### A1. Tách bằng chứng

Baseline main@7183b31 đã có báo cáo 63 test/5 file pass tại [evidence cũ](../../../docs/reviews/2026-09-07-idempotency/evidence/2026-09-08-independent-baseline.log). Baseline dùng mock/mockedRPC, không chứng minh tính năng mới hoặc SQL thật. Lượt viết spec này không chạy lại baseline và không có log thực thi 93 TC mới.

### A2. Runner sẽ bổ sung khi code

| Lớp | Vị trí dự kiến trên main | Runner/lệnh phải có |
| --- | --- | --- |
| Core/flow/mock | src/core/writePayload.test.ts; src/features/pos/writeOperationFlow.test.ts; src/adapters/mock/writeOperationRepo.test.ts | npm test (Vitest include src hiện hành tìm được) |
| UI component | src/app/writeRecovery.test.tsx; src/app/components/ReceiptPreview.test.tsx | npm test; jsdom, không giả thành server recovery |
| DB contract | tests/contracts/writeOperations.contract.test.ts; writePermissions.contract.test.ts; writeConcurrency.contract.test.ts; writeSchema.contract.test.ts | Thêm vitest.contract.config.ts include tests/contracts/**/*.contract.test.ts, environment node; script npm run test:contracts -- --reporter=json --outputFile=artifacts/idempotency-contracts.json |
| Browser server thật | tests/supabase/idempotency.spec.ts; idempotencyRecovery.spec.ts; idempotencyPricing.spec.ts | Script npm run test:idempotency:e2e gọi config Supabase đã preflight; VITE_DATA_MODE=supabase bắt buộc |
| Discovery | tests/contracts/caseManifest.ts và artifact JSON | npm run test:idempotency:discover xuất IDs/names/file/backend; đối chiếu Vitest list và Playwright --list trước suite |
| Tổng kết nghiệm thu | artifact manifest/result JSON + log + raw DB snapshot + DOM/trace cần thiết | npm run test:idempotency:verify-results: thiếu/skip/timeout/unexecuted required ID => exit nonzero |

Các script/config trên là task phải tạo, **chưa chạy được như lệnh mới ở hiện trạng**. Tên test bắt đầu TC-IDEM-xxx, parameter suffix ổn định. Một TC đa lớp có bản kiểm mỗi lớp, ghi suffix /core, /mock, /db, /e2e; không báo DB pass dựa vào /mock.

Preflight bắt buộc, fail-closed: mode đúng supabase, URL/key có và hợp lệ, observer DSN của **test DB riêng** có, project/store fixture marker đúng, capabilities v1/migration checksum khớp. Không sử dụng service-role làm caller nghiệp vụ; caller dùng Store JWT+employee token, observer đặc quyền tách riêng chỉ setup/inspect/fault. Không in credential. Missing config/DB paused/migration missing phải fail hoặc ghi BLOCKED trước suite, không skip xanh. Không phụ thuộc RUN_SUPABASE_REALTIME_E2E mặc định skip hiện tại. Không dùng project đang có dữ liệu người dùng để fault/delete fixtures.

### A3. Oracle chung bắt buộc G

Mỗi DB testcase ghi snapshot trước/sau bằng connection observer mới sau COMMIT/ROLLBACK, không dùng getOrder của SUT hoặc snapshot MVCC cũ. Snapshot toàn bộ rows của store fixture, gồm orders (số/ngày/version/status/tổng/actor/times), cả removed items, options, payments, bàn, ledger, events. Đếm toàn store/nhóm fixture để thấy payment/order thừa, không chỉ lọc ID trong R1 trả về. G bao gồm:
- Invariants: tổng lượng và component giá; các ID/quan hệ/source-child/payment; số bill unique; không orphan; creator/executor/initiator/times giữ; no hard-delete lịch sử.
- Xác nhận **R1 đúng trước**, theo literal và raw DB; sau đó mới deep-equality result R1 cho replay (bỏ replayCount envelope, không bỏ money/time/actor trong R1).
- Với rejected/rollback: ngoài K/metadata được contract cho đổi, raw business snapshot nguyên. K pending/rejected không phải bằng chứng đủ nếu business đã ghi.
- Race input hợp lệ không fault: đúng số applied yêu cầu và có tiến triển ≤ 30 s. “ ≤ 1 payment” hoặc “cả hai rejected” không đủ.
- UI no-auto: đếm outbound register/execute/cancel, generation, preview open và window.print; read/list/refetch cho phép. DB không đổi không thay thế assertion 0 request.
- Expected literal không gọi helper tính giá/snapshot/formatVnd của SUT. DOM phải kiểm chuỗi “40.000” và “80.000” theo UI locale, option × 2, không chỉ spy printPort no-op.
- Mỗi data parameter là fixture isolated có positive control khi test null/schema/status; không để lỗi sớm che nhánh mục tiêu.

### A4. Harness race/fault/clock

DB contract dùng hai hoặc nhiều connection PostgreSQL thực (pg, dev dependency) + PostgREST caller; ghi backend PID/transaction ID khác nhau. Test driver dùng advisory/test gate và quan sát pg_locks/pg_stat_activity để chứng minh contender đã chờ. Promise.all đơn thuần không được coi là race proof. Mỗi bên thắng được ép trong fixture riêng; hết 30 s fail, không catch timeout → pass.

Clock boundary không sleep để đoán −1 ms. Test DB có private test clock/hook được cài bởi harness đặc quyền, chỉ trong test database; caller ứng dụng không truy cập, không p_now/HTTP header/GUC tùy ý do authenticated đặt. Production helper đọc clock_timestamp; migration audit bảo đảm không deploy hook/test time override. DB clock wiring test riêng không override để phát hiện dùng now() đầu transaction.

Fault tại renumber/tombstone/items/options/payment/order/table/result before commit phải rollback cả business lẫn applied. Hook business-error test riêng để chứng minh subtransaction rollback+outer rejected commit. Hook không phải khả năng public API. Lost ACK: observer xác minh commit trước proxy/Playwright route bỏ response; thả response muộn trong ca riêng; không abort request trước delivery rồi gọi là lost ACK after commit.

### A5. Fixture định danh và số liệu

UUID fixture: alias ánh xạ thành UUID dạng 00000000-0000-4000-8000-xxxxxxxxxxxx; suffix 12 hex là số thứ tự cố định: S1=1, S2=2, A=11, B=12, C=13, E=14, X=15, B01=21, B02=22, O1=101, O2=102, O3=103, L1=201, L2=202, L30=230, L35=235, P0=300, P1=301, M_A=401, M_T=402, Q=501, Z=502. K1=1001, K2=1002, Knew=1003. Khi cần hơn 1 entity loại đó harness dùng bảng số tăng deterministic, không UUID cùng nil. Fixture registry là dữ liệu test, không import UUID generator/app seed logic của SUT.

A admin đủ 5 quyền; B cashier với deny create/update/voidOpen, chỉ payment.take; C cashier deny all; E có order.update; X admin S2. PIN: A = 123456, B = 111111, C = 222222, E = 333333; mỗi fixture reset policy. Ghi rõ khi C được bỏ deny payment.take rồi grant quyền ấy trong TC 056. Clock T = 2026-09-08T00:00:00.000Z; timezone Asia/Saigon; currency VND. Tất cả số trong bảng là literal oracle. Trong ví dụ dòng bán, món A là M_A, trà là M_T; A ở vị trí actor là nhân viên A. Trong các ca so payload, P1/P2 là nhãn payload; P1 ở vị trí paymentId là UUID thanh toán trong registry trên.

| Fixture | Dữ liệu ban đầu |
| --- | --- |
| F0 | S1 chưa có order/payment; B01 empty; món A giá 30.000, trà 20.000, option Q giá 5.000, Z giá 0; quan hệ group hợp lệ; nhân viên A/B/C/E và X thuộc S2 như trên; maxNo = 0. |
| F1 | O1 open, bàn B01 occupied, số đơn 12, businessDate = 2026-09-08, version = 5. L1: món A, quantity = 5, base = 30.000, options = [], total = 150.000. createdBy = A, lastModified = A. maxNo = 20 (fixture có đơn số 20); O1 chưa có payment. |
| F2 | O1 open, số đơn 12, version = 5. L30: món A, quantity = 1, base = 30.000, note = “ít đá”. L35: món A, quantity = 1, base = 35.000, note = null. Total = 65.000; hai phần khác ID; maxNo = 20. |
| F3 | O1 open, version = 5. L1 cũ: quantity = 2, base = 30.000, tên “Cà phê cũ”; option Q tên “Topping cũ”, delta = 5.000, quantity = 2 cho mỗi ly; total = 80.000. Catalog hiện tại: món A giá 35.000, tên “Cà phê mới”; Q giá 7.000, tên “Topping mới”. |
| F4 | O1 paid, số đơn 12, version = 6, total = 150.000; payment P0 có amount = 150.000, received = 200.000, change = 50.000, paidAt = T. B01 đang có đơn O3 open của khách mới, version = 0, total = 20.000. Payment P0 của O1 vẫn được giữ. |
| F5 | O1 open, version = 5. L1: món A, quantity = 2, base = 30.000; option Z giá 0, quantity = 1; total = 60.000. Catalog hiện tại: A giá 40.000, Z giá 0. Chưa có payment. Giữ modifier giống nhau để bắt lỗi gộp chỉ dựa vào signature. |
| F6 | O1 ban đầu có số đơn 7, maxNo = 7, version = 5; L1 có 5 ly × 30.000 = 150.000. K1 tách 1 ly đã applied: đơn nguồn số 8, version = 6, total = 120.000; đơn con số 7, total = 30.000. K2 pending tách 1 ly, version = 6, payload riêng. Mỗi lệnh, payment và đơn con có ID riêng. |
| F7 | O1 open, số đơn 12, version = 5. L1 có quantity = 2, base = 30.000; option Q có delta = 5.000, quantity = 2, tên “Topping cũ”; total = 80.000. Catalog sẽ đổi tên và giá sau thanh toán; maxNo = 20. |

Các fixture đề cập paidAt/date/total/version đều phải set trực tiếp bởi setup observer, ghi snapshot đầu. Không seed ra tình trạng ngẫu nhiên rồi tính expected từ số thực tế.

**Clock và phiên:** Mọi TC dịch clock tới ≥ 12 h (TC 013/061–068/082 và biến thể tương ứng) phải cấp phiên nhân viên mới hợp lệ tại thời điểm kiểm, hoặc re-PIN sau dịch clock; không gia hạn/tạo lại K cũ. Chỉ TC 005 và TC 062/validation_session_expiry cố ý dùng token hết hạn. Gate fixture assert token.expiresAt > checkpoint; không để lỗi session che TTL lệnh.

**Biên payload:** TC 078 phải tạo literal có 200 NewLine × 8 option, ID cố định và giá 0. Harness đo độ dài JSONB::text ban đầu B ≤ 262144 rồi thêm (262144−B) ký tự ASCII vào các note, mỗi note ≤ 500; bản kế tiếp thêm 1 ký tự thành 262145. Nếu B không cho dựng fixture hợp lệ thì setup fail, không nới giới hạn. Reviewer đã kiểm một hình dạng JSONB B=261804 có thể dùng note 340/341, nhưng con số này phải được xác minh lại bằng octet_length tại DB thử, không xem phép tính ngoài DB là kết quả chạy SQL.

## B. Ma trận biến thể bắt buộc

Mỗi tổ hợp được materialize thành test riêng với ID suffix, không loop assert rồi reporter chỉ báo 1 case. Manifest của implementation liệt kê tất cả tên mở rộng trước chạy.

| TC gốc | Suffix/miền cụ thể | Oracle |
| --- | --- | --- |
| 006 | action={create, update, void_open, pay, split, void_paid} × endpoint={register, execute, get, list, cancel} × actor={A, B, C}; thêm override={grant, deny_both} cho từng action | Ma trận design, mục 2.3; list filter, endpoint cấm FORBIDDEN; actor/effect không đổi |
| 020 | winner={P1, P2} | Payload/initiator first registration; 1 K; loser mismatch |
| 023 | pair={update_pay, update_split, pay_split, update_voidOpen, voidPaid_voidPaid} × winner={left, right} | Expected theo đúng winner ở TC 023; một applied, một rejected OCC |
| 032 | source={other_order, other_store, removed, moved, duplicate, omitted, over_quantity} | INVALID_ORDER_ITEMS và full DB giữ |
| 047 | kind={update, pay, split, void} × version={missing, null, positive} | NULL schema block; positive đúng state applied |
| 063 | blocker={operation, store, order, table} | Check clock sau blocker, expired/0 effect |
| 068 | terminal={applied, rejected, cancelled, expired} | Commit thật trước drop ACK, 48 h giữ terminal/R1 |
| 069 | point={submit_removed, submit_option, split_number, split_move, split_copy_option, split_payment, pay_payment, pay_order, pay_table, void_order} | Infra rollback business+result, K pending; retry manual success |
| 074 | field theo bảng dưới × variant={missing, null, wrong_type, positive} | INVALID_WRITE_REQUEST cho schema, 0 K; exceptions nullable ghi rõ |
| 078 | array={create_lines, options}; count={0,1, max, max+1}; bytes={262144,262145} | Empty options hợp lệ nếu group optional; empty create không; max pass, max+1 fail |
| 079 | note={absent, null, empty, 500_ascii, 501_ascii, 500_emoji, 501_emoji}; reason other={absent, null, empty, spaces, nonblank} | Note ≤ 500 valid; other nonblank valid; errors đúng mã |

**Fields schema TC 074:** common schemaVersion/kind; register/execute.operationId; submit.action/orderId; create.expectedVersion/orderType/tableId/newLines; update.expectedVersion/retainedLines/newLines; retained.sourceItemId/quantity; newLine.id/menuItemId/quantity/quotedBasePrice/options; option.id/optionValueId/quantity/quotedPriceDelta; pay.orderId/paymentId/expectedVersion/method/receivedAmount; split.newOrderId/lines/orderItemId/quantity/splitItemId; void.reason/expectedVersion. Mỗi kind fixture có đủ mọi field khác để chỉ sai một field.

Nullable exceptions: create.expectedVersion **required null**, positive=null; takeaway.tableId **required null**, dine_in.tableId UUID; note/reasonNote optional string/null (covered 079), other nonblank kiểm execute. Wrong type cho UUID dùng integer, cho array dùng object, cho money dùng string, cho string dùng array. Missing kind/schemaVersion cũng invalid. Invalid literal kind/schemaVersion/action/orderType/method/enum test từng field ngoài wrong type. Same K schema-invalid ưu tiên INVALID_WRITE_REQUEST, không gọi làm mismatch test.

## C. Testcase chi tiết

Mỗi TC kế thừa fixture và oracle G (mục A3). Thực hiện theo thứ tự ba bước ghi bên dưới. “DB+mock” yêu cầu hai implementation cùng expected nhưng kết quả được báo riêng. DB/UI trường hợp trạng thái terminal phải kiểm đồng thời raw DB và thông báo chính xác từ error catalog trong design, mục 7.

### TC-IDEM-001 — Đăng nhập, khóa và reload

- **Truy vết:** IDEM-01, IDEM-23; UC-IDEM-01.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** A/PIN 123456.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Cấp phiên; gọi get capabilities; khóa online; thử lại token; đăng nhập rồi reload.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Token 43 ký tự chỉ memory; expiresAt-issuedAt=12 h; revoke được ACK thì token cũ EMPLOYEE_SESSION_REQUIRED; reload về PIN, Store session còn. Mã phải hiện đúng thông báo tại design, mục 7: EMPLOYEE_SESSION_REQUIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-002 — PIN sai và employee inactive

- **Truy vết:** IDEM-01, IDEM-23; UC-IDEM-01.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Sai PIN 000000; biến thể A inactive với PIN đúng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi start trực tiếp cho mỗi biến thể, gồm positive control A active/PIN đúng.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Sai/inactive trả INVALID_PIN, không cấp token; positive control được phiên. Không trả hash. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_PIN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-003 — Token không đúng store/thiếu/giả

- **Truy vết:** IDEM-01, IDEM-03; UC-IDEM-01, UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Store JWT S1; token absent, 43 ký tự giả, token X của S2.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register pay cho từng biến thể.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** EMPLOYEE_SESSION_REQUIRED; 0 K/0 hiệu ứng nghiệp vụ; employeeId A trong JSON không giúp vượt. Mã phải hiện đúng thông báo tại design, mục 7: EMPLOYEE_SESSION_REQUIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-004 — Store session vắng hoặc sai

- **Truy vết:** IDEM-01, IDEM-03; UC-IDEM-01.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Không JWT; JWT invalid.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi capabilities/register với token A thật.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** AUTH_REQUIRED, 0 K/0 hiệu ứng nghiệp vụ. Mã phải hiện đúng thông báo tại design, mục 7: AUTH_REQUIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-005 — Biên hạn phiên và reset PIN

- **Truy vết:** IDEM-01, IDEM-23; UC-IDEM-01.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** issuedAt=T; clock=T+12 h−1 ms, =12 h, +1 ms; reset PIN của A.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute fixture pending hợp lệ tại từng clock, fixture riêng; reset PIN rồi dùng token cũ.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** −1 ms có quyền và applied; =, +1 ms EMPLOYEE_SESSION_REQUIRED/K pending; reset PIN cũng chặn, token mới đăng nhập PIN mới dùng được. Hai race start-session/reset-PIN có suffix riêng: start thắng lock employee thì reset chờ và thu hồi token vừa cấp; reset thắng thì start PIN cũ INVALID_PIN/không token. Observer xác minh không có token PIN cũ sống sau reset commit. Mã phải hiện đúng thông báo tại design, mục 7: EMPLOYEE_SESSION_REQUIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-006 — Ma trận action × endpoint × actor

- **Truy vết:** IDEM-02, IDEM-24, IDEM-25; UC-IDEM-01, UC-IDEM-07, UC-IDEM-08, UC-IDEM-09.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0+F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** 6 action × 5 endpoint × {A all, B pay, C none}; K do A register, terminal/pending fixture riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi trực tiếp từng cell; list phải chỉ trả action được phép; thêm override grants/denies độc lập.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Theo design, mục 2.3 từng cell; B chỉ pay/split, C: 0; deny thắng grant; request cấm FORBIDDEN trừ list lọc; 0 hiệu ứng/0 counter và K pending giữ. Mỗi cell có test ID suffix riêng. Mã phải hiện đúng thông báo tại design, mục 7: FORBIDDEN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-007 — Thu hồi quyền lúc execute chờ khóa

- **Truy vết:** IDEM-02, IDEM-24, IDEM-25; UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay pending của A; B có payment.take; connection 1 giữ O1.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** B execute chờ O1; admin connection 2 deny B và commit; nhả O1; B tiếp tục.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Checkpoint đọc quyền mới: FORBIDDEN, K pending, 0 payment; A execute sau đó applied 1 payment. Observer xác minh revoke commit trước checkpoint. Mã phải hiện đúng thông báo tại design, mục 7: FORBIDDEN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-008 — Tự nâng quyền/PIN bằng direct DML

- **Truy vết:** IDEM-03, IDEM-24; UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Store JWT trần và token C; UPDATE role/grants/is_active/passcode_hash; INSERT admin.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi REST/SQL role authenticated trực tiếp, từng field/thao tác riêng.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mọi attempt denied; employees/sessions không đổi. SELECT whitelist thành công nhưng passcode_hash và SELECT * không rò hash. Không dùng service-role làm caller. Mã phải hiện đúng thông báo tại design, mục 7: FORBIDDEN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-009 — Bypass bốn RPC và các overload

- **Truy vết:** IDEM-03, IDEM-21; UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** Inventory pg_proc mọi overload cũ + helper private.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi từng overload với payload valid/employeeId A; thử INSERT/UPDATE/DELETE financial+ledger/audit.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Permission denied mọi đường; no effect. Manifest inventory thiếu overload hoặc function mới chưa audit thì fail. Mã phải hiện đúng thông báo tại design, mục 7: FORBIDDEN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-010 — Parent, table status và cross-store bypass

- **Truy vết:** IDEM-03; UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0+F1, reset riêng mỗi variant.
- **Dữ liệu thử:** DELETE stores/cascade; UPDATE tables.status; đổi store_id; IDs parent S2.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Thử trực tiếp token C và admin A với field ngoài allowlist; get K của S2; list S1.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Parent/status/identity write bị chặn; K store khác OPERATION_NOT_FOUND; list không lộ S2; mọi dữ liệu thuộc fixture giữ nguyên. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_NOT_FOUND.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-011 — Bootstrap, admin và seed không bị phá

- **Truy vết:** IDEM-03, IDEM-21; UC-IDEM-01.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F0 empty new store, reset riêng mỗi variant.
- **Dữ liệu thử:** admin UUID mới; name Quán A; address Q 1; seedDemo=true/false fixture riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Với seedDemo=false, sau activation A tạo bàn id UUID mới/store_id=S1 và parent area S1; B/C thử INSERT bàn tương tự.  Tạo Store → bootstrap → PIN → seed; bootstrap lần 2; B/C thử seed/reset PIN; A đổi menu/layout.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Admin INSERT bàn thành công với id đã gửi, store_id=S1, status mặc định empty; đọc/layout-update được, không được UPDATE id/store/status. B/C INSERT bị từ chối.  Lần đầu một store/admin, vào POS được; lần 2 ENTITY_ID_CONFLICT không reset admin; B/C bị chặn; admin layout không đổi status; clear_demo giữ finance/ledger/audit. Mã phải hiện đúng thông báo tại design, mục 7: ENTITY_ID_CONFLICT.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-012 — Register không tạo đơn

- **Truy vết:** IDEM-05; UC-IDEM-02.
- **Mức / nhóm:** DB+mock / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K create Onew/A 2 × 30 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register; đọc DB qua observer mới.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 pending, expires=T+24 h, 0 order/items/options/payment/event; initiator A, count 0.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-013 — Retry register và terminal không gia hạn

- **Truy vết:** IDEM-04, IDEM-05, IDEM-12; UC-IDEM-02, UC-IDEM-07.
- **Mức / nhóm:** DB+mock / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Cùng K create/payload ởT, T+1 h, T+25 h.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register 2 lần; get sau 25 h; register lại cùng K.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Chỉ 1 K; registeredAt/expiry/initiator giữ; get expired; register terminal trả expired, không pending mới/0 hiệu ứng nghiệp vụ.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-014 — Create lần đầu và replay R1

- **Truy vết:** IDEM-05, IDEM-06, IDEM-07, IDEM-13; UC-IDEM-02.
- **Mức / nhóm:** DB+mock / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K create A 2 × 30 k bàn B01; maxNo 0.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register/execute; assert R1 literal và DB; replay 2 lần.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 order #1/version 0/open 60 k, 2 units/0 payment/B01 occupied; creator A; 1 event; count 2; R1 exact không đổi.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-015 — Khóa object order không làm khác payload

- **Truy vết:** IDEM-04, IDEM-06; UC-IDEM-07.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Hai payload create đủ 2 newLines A 30 k và trà 20 k, object keys đảo; arrays giữ.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register P1, execute P2.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Equality hợp lệ, 1 applied/total 50 k. Không dựa stringify text để so.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-016 — Đảo mảng hai phần tử là mismatch

- **Truy vết:** IDEM-04; UC-IDEM-07.
- **Mức / nhóm:** đơn vị+DB / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** P1 newLines[A 1, T1]; P2[T1, A 1], cả hai valid.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register P1 rồi execute P2; execute P1 sau đó.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** P2 IDEMPOTENCY_KEY_REUSED, 0 hiệu ứng/count 0; P1 applied 50 k, stored array A, T. Mã phải hiện đúng thông báo tại design, mục 7: IDEMPOTENCY_KEY_REUSED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-017 — Absent và null đều valid nhưng khác lệnh

- **Truy vết:** IDEM-04; UC-IDEM-07.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** NewLine.note absent so với note:null; mọi field khác giống.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Validate hai payload, register absent, execute null.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Cả hai schema hợp lệ; execute mismatch không phải INVALID_WRITE_REQUEST; execute absent thành công. Mã phải hiện đúng thông báo tại design, mục 7: IDEMPOTENCY_KEY_REUSED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-018 — Same K khác kind/tiền/lượng/version

- **Truy vết:** IDEM-04, IDEM-06, IDEM-18; UC-IDEM-04, UC-IDEM-05, UC-IDEM-07.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K split L1 qty 1/P1; từng mutation valid qty 2, received 60000, version 6, kind pay.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register gốc; gửi từng payload thay đổi.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mỗi biến thể IDEMPOTENCY_KEY_REUSED; K/expiry/actor/count giữ, 0 hiệu ứng; gửi gốc thành công 1 split. Mã phải hiện đúng thông báo tại design, mục 7: IDEMPOTENCY_KEY_REUSED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-019 — Race cùng K/payload

- **Truy vết:** IDEM-05, IDEM-06, IDEM-07, IDEM-20; UC-IDEM-02, UC-IDEM-07.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Hai connection độc lập, cùng K create/payload.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Barrier hai register; barrier hai execute; await commit trong 30 s.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Đúng 1 K/1 order/1 event, applied; cả hai execute trả cùng R1 đúng 60 k, count 1. Cả hai lỗi/treo không đạt; PIDs khác.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-020 — Race cùng K khác payload

- **Truy vết:** IDEM-04, IDEM-05; UC-IDEM-02, UC-IDEM-07.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K same, P1 A 1=30 k; P2 A 2=60 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Điều khiển P1 thắng register, fixture khác P2 thắng; executor dùng payload thắng.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 pending payload thắng; bên thua IDEMPOTENCY_KEY_REUSED; expiry/initiator của winner; execute đúng 1 order 30 k hoặc 60 k tương ứng. Mã phải hiện đúng thông báo tại design, mục 7: IDEMPOTENCY_KEY_REUSED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-021 — Khác K tạo cùng bàn

- **Truy vết:** IDEM-08; UC-IDEM-02.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K1/O1 và K2/O2 cùng B01, A 1=30 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Hai create chạy hai thứ tự thắng bằng barrier.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Đúng 1 applied, 1 rejected TABLE_OCCUPIED; 1 open order 30 k/1 item/B01 occupied/1 event; không orphan bên thua. Mã phải hiện đúng thông báo tại design, mục 7: TABLE_OCCUPIED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-022 — Khác K takeaway cùng nội dung

- **Truy vết:** IDEM-05, IDEM-08; UC-IDEM-02.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K1/O1, A 1; K2/O2, A 1; tableId null.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register/execute cạnh tranh.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Cả hai applied; 2 orders 30 k, IDs/số bill khác; không dedupe bằng payload hash.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-023 — OCC race khác K cùng version

- **Truy vết:** IDEM-07, IDEM-08; UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F1; F4 cho voidPaid, reset riêng mỗi variant.
- **Dữ liệu thử:** Các cặp update–pay, update–split, pay–split, update–void_open, voidPaid–voidPaid; mỗi bên thắng fixture riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register 2 K/v5 hoặc paid v6, barrier execute; update fixture chỉ note.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Đúng 1 applied, 1 rejected ORDER_VERSION_CONFLICT. Winner update:150 k/v6/0 payment; pay:paid 150 k/v6/1 payment; split:child 30 k/source 120 k/v6/1 payment; voidOpen:0/void v6/0 payment; voidPaid:150 k/void v7/payment cũ. Không deadlock bị nuốt. Mã phải hiện đúng thông báo tại design, mục 7: ORDER_VERSION_CONFLICT.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-024 — Create tranh cấp số với split

- **Truy vết:** IDEM-08; UC-IDEM-02, UC-IDEM-05.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Nguồn #12/max 20; create take A 1 và split L1 qty 1.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Buộc create thắng rồi fixture khác split thắng.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Create first:#21 create, source #22, child #12; split first:source #21, create#22, child #12. Mọi (store, date, no) unique; replay không cấp số.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-025 — Update giữ snapshot 100 k

- **Truy vết:** IDEM-15, IDEM-16, IDEM-26, IDEM-27; UC-IDEM-03.
- **Mức / nhóm:** DB+mock+E2E / chính. **Tiền điều kiện:** F5, reset riêng mỗi variant.
- **Dữ liệu thử:** retained L1 qty 2; new L2 A qty 1 base 40 k/Z 0.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gửi update, refetch, replay.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** L1 qty 2/base 30 k/old options/60 k; L2 qty 1/base 40 k/Z 0/40 k; total 100 k/v6/0 payment, 2 active IDs; R1 và DB khớp.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-026 — Tăng qua dấu cộng tạo phần giá mới

- **Truy vết:** IDEM-15, IDEM-16, IDEM-26; UC-IDEM-03.
- **Mức / nhóm:** đơn vị+DB+E2E / chính. **Tiền điều kiện:** F5, reset riêng mỗi variant.
- **Dữ liệu thử:** L1 qty 2 base 30 k; current 40 k; click+1 tại L1.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Quan sát draft và payload rồi execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Retained L1 qty 2; newLine qty 1 quote 40 k; total 100 k, không L1 qty 3 giá cũ; không định giá lại cũ.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-027 — Đổi note giữa dòng khác giá

- **Truy vết:** IDEM-16, IDEM-27; UC-IDEM-03.
- **Mức / nhóm:** đơn vị+DB+E2E / chính. **Tiền điều kiện:** F2, reset riêng mỗi variant.
- **Dữ liệu thử:** L30 note ít đá → null; L35 null → ít đá.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Dirty check; cố pay khi chưa gửi; gửi update; refetch.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Dirty true, không cho thanh toán trước gửi; sau update L30=30 k/null, L35=35 k/ít đá, total 65 k/v6/0 payment.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-028 — Giảm và xóa đúng phần cũ

- **Truy vết:** IDEM-15, IDEM-16, IDEM-27; UC-IDEM-03.
- **Mức / nhóm:** DB+mock / biên. **Tiền điều kiện:** F5, reset riêng mỗi variant.
- **Dữ liệu thử:** Retained 2 → 1 rồi fixture riêng 2 → 0+new 1 × 40 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute từng fixture.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Giảm:old 30 k/version 6; old menu 40 k không ảnh hưởng. Xóa+new:raw old status removed/quantity 2/base 30 k/options cũ giữ, result.items chỉ new 1 × 40 k, 0 payment; không hard delete/options orphan.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-029 — Giữ phần cũ khi catalog đổi tên/không còn bán

- **Truy vết:** IDEM-15, IDEM-16, IDEM-26; UC-IDEM-03.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F3, reset riêng mỗi variant.
- **Dữ liệu thử:** Old name Cà phê cũ/Q Tên cũ; catalog name Cà phê mới/Q Tên mới, prices 35 k/7 k; inactive old catalog variant.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Chỉ sửa note/giảm retained, không thêm mới; refetch.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Phần cũ vẫn base 30 k/Q 5 k qty 2/tên cũ; inactive không chặn retained. Giảm qty 1 total 40 k; no current catalog snapshots.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-030 — Modifier quantity và giá mới từng phần

- **Truy vết:** IDEM-15, IDEM-26; UC-IDEM-03, UC-IDEM-05.
- **Mức / nhóm:** DB+mock+E2E / chính. **Tiền điều kiện:** F3, reset riêng mỗi variant.
- **Dữ liệu thử:** Cũ 2 × (30+2 × 5)=80 k; +new 1 × (35+2 × 7)=49 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute add; fixture riêng tách new, fixture khác tách 1 old.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Tổng 129 k; tách new paid 49 k/source 80 k; tách old paid 40 k/source 89 k; IDs/options qty/tên cũ-mới đúng, không chỉ assert sum.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-031 — Không gộp các cấu trúc cùng tổng giá

- **Truy vết:** IDEM-15, IDEM-16; UC-IDEM-03.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** A base 30 k+Q 5 k và A base 35 k không Q; mỗi 1 cái; cùng note.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Tạo/đọc hai portions qua fixture thời gian giá; dirty/selection.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Hai source IDs/options khác, total 70 k; không gộp 2 × 35 k mất components.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-032 — Nguồn retained giả mạo

- **Truy vết:** IDEM-16, IDEM-26; UC-IDEM-03.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F1/F2, reset riêng mỗi variant.
- **Dữ liệu thử:** ID khác order, khác store, removed, moved sang child, duplicate ID, omitted active ID, qty 6>nguồn 5.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Từng biến thể riêng có admin A/order.update; register schema valid rồi execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mỗi K rejected INVALID_ORDER_ITEMS; DB full snapshot không đổi/0 event. Positive control retained 5 cùng O1 applied. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_ORDER_ITEMS.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-033 — Không sửa giá/menu/modifier/name phần cũ qua JSON

- **Truy vết:** IDEM-04, IDEM-16; UC-IDEM-03.
- **Mức / nhóm:** đơn vị+DB / bảo mật. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** RetainedLine thêm price 0/menuItemId/options/name/id từng field.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi register trực tiếp từng payload.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** INVALID_WRITE_REQUEST trước ledger; 0 K/0 hiệu ứng; không silently strip rồi accept. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-034 — Quote base tăng và giảm

- **Truy vết:** IDEM-17, IDEM-26; UC-IDEM-11.
- **Mức / nhóm:** DB+E2E / ngoại lệ. **Tiền điều kiện:** F5, reset riêng mỗi variant.
- **Dữ liệu thử:** O 60 k/v5/new quote 40 k; current 45 k hoặc 35 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** K1 execute; xem UI; replay K1; xác nhận mới K2 current quote.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** K1 rejected PRICE_CHANGED; O 60 k/v5/0 payment; UI proposed 105 k hoặc 95 k; K2 applied total 105 k/95 k/v6; K1 rejection giữ. Mã phải hiện đúng thông báo tại design, mục 7: PRICE_CHANGED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-035 — Quote chỉ option đổi

- **Truy vết:** IDEM-17, IDEM-26; UC-IDEM-11.
- **Mức / nhóm:** DB+E2E / ngoại lệ. **Tiền điều kiện:** F3, reset riêng mỗi variant.
- **Dữ liệu thử:** Phần mới quote base 35 k, Q 5 k qty 2, current Q 7 k; variant bù giá: quote 35 k+2 × 7 k=49 k, current 37 k+2 × 6 k=49 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute K1, kiểm details và xác nhận K2.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** K1 PRICE_CHANGED/0 hiệu ứng nghiệp vụ; new portion 45 k → 49 k; tổng cũ 80 k → 129 k chỉ sau K2; không dùng orderVersion để bắt menu change. Variant bù giá vẫn PRICE_CHANGED dù tổng 49 k không đổi; details chỉ rõ base 35 → 37 k và option 7 → 6 k, chỉ K mới sau xác nhận được áp dụng. Mã phải hiện đúng thông báo tại design, mục 7: PRICE_CHANGED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-036 — Menu, group và option validation

- **Truy vết:** IDEM-26, IDEM-04; UC-IDEM-02, UC-IDEM-03.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Món inactive; option deleted/khác store/không gắn group; required thiếu; single 2; required multi thiếu chọn; positive multi chọn 2 option khác nhau.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Từng variant riêng; gửi quote chính xác để không lẫn lỗi giá.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Negative: MENU_ITEM_UNAVAILABLE với món; OPTION_VALUE_UNAVAILABLE với option/group; 0 order/payment/event, K rejected bền. Positive: F0 A 30 k chọn Q 5 k và Z 0 thuộc cùng group multi hợp lệ, quantity 1 mỗi value → applied, 1 order 35 k, 2 option snapshots, 0 payment, 1 event. Không áp expected rejection cho positive. Mã lỗi hiển thị theo design, mục 7.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-037 — Void open giữ lịch sử removed

- **Truy vết:** IDEM-07, IDEM-13, IDEM-27; UC-IDEM-03.
- **Mức / nhóm:** DB+mock / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K void_open/v5.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute và replay; inspect all rows.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** O1 void/v6/subtotal 0/total 0/paidAt null; result.items=[], active 0; raw removed L1.quantity 5/items/options cũ không hard-delete; 0 payment/B01 empty; No 12/date/creator giữ; 1 event; replay không đổi updatedAt.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-038 — Full cash và receipt literal

- **Truy vết:** IDEM-06, IDEM-13, IDEM-19, IDEM-28, IDEM-32; UC-IDEM-04, UC-IDEM-12.
- **Mức / nhóm:** DB+mock+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay/P1/v5/received 200 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute; inspect payment/order/table/R1/DOM; replay.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 payment amount 150 k/received 200 k/change 50 k/employee A; O paid v6/B empty; receipt 150 k. Replay giữ nguyên/no auto print.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-039 — Tiền nhận thấp hơn tổng

- **Truy vết:** IDEM-28; UC-IDEM-04.
- **Mức / nhóm:** DB+mock / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** received 149999, positive 150000.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute fixture riêng cho 2 mức.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 149999 rejected PAYMENT_AMOUNT_TOO_LOW, 0 payment/O open v5; 150000 applied/change 0. Mã phải hiện đúng thông báo tại design, mục 7: PAYMENT_AMOUNT_TOO_LOW.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-040 — Split partial exact row/number oracle

- **Truy vết:** IDEM-06, IDEM-13, IDEM-18, IDEM-29; UC-IDEM-05.
- **Mức / nhóm:** DB+mock / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** L1 qty 1/split L2, P1, new O2, received 50 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute; raw observer items/options/payments/all orders; replay.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Nguồn L1 qty 4/open 120 k/v6/#21; child L2 qty 1/paid 30 k/v0/#12; 1 payment child/0 payment source/thừa 20 k/B occupied; split IDs/options/1 event giữ sau replay.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-041 — Split nguyên dòng giữ ID

- **Truy vết:** IDEM-29; UC-IDEM-05.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F2, reset riêng mỗi variant.
- **Dữ liệu thử:** Tách L30 qty 1, nhận 50 k; source #12/max 20.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute, observer quan hệ items/options.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** L30 move child v0/paid 30 k/#12, L35 source open 35 k/v6/#21; không copy L30; options chuyển cùng; payment 1 thừa 20 k.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-042 — Full selection route trước register

- **Truy vết:** IDEM-18, IDEM-30; UC-IDEM-04, UC-IDEM-05.
- **Mức / nhóm:** đơn vị+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Chọn 5/5 ly.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Quan sát requests từ click confirm.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 register kind pay_order, 1 execute cùng K; 0 register/execute split; payment 150 k.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-043 — RPC split toàn bộ hoặc selection sai

- **Truy vết:** IDEM-18, IDEM-29, IDEM-30; UC-IDEM-05.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** lines[]; L1 qty 5(full); qty 6; duplicate L1; ID ngoài nguồn.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Từng variant riêng qua DB; schema empty array kiểm trước register, remaining valid schema execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Empty INVALID_WRITE_REQUEST/0 K; full, over qty, duplicate/outside source INVALID_ORDER_ITEMS/rejected/0 hiệu ứng; positive twin qty 1 applied. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST, INVALID_ORDER_ITEMS.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-044 — Clamp còn đủ sau mất ACK

- **Truy vết:** IDEM-06, IDEM-14, IDEM-18, IDEM-30; UC-IDEM-05, UC-IDEM-07.
- **Mức / nhóm:** E2E / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K split 1 applied, mất ACK, nguồn còn 4, lựa chọn 1 giữ nguyên.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Drop reply sau observer commit; polling 5 s; bấm Thử lại cùng lệnh.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Outbound execute K cũ/payload qty 1/v5, không new register; đúng 1 payment/child, total nguồn 120 k. Không split lần 2 dù selection vẫn có 1.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-045 — Clamp rỗng rồi fallback fullSelection

- **Truy vết:** IDEM-06, IDEM-14, IDEM-18, IDEM-30; UC-IDEM-05, UC-IDEM-07.
- **Mức / nhóm:** E2E / ngoại lệ. **Tiền điều kiện:** F2, reset riêng mỗi variant.
- **Dữ liệu thử:** K split L30 nguyên dòng applied, mất ACK; nguồn còn L35.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Poll khiến selection L30 rỗng; recover/thử lại.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Chỉ replay K split gốc; 0 outbound pay_order/0 K mới; source 35 k vẫn open; payment 30 k duy nhất. Không fallback thành thanh toán 35 k.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-046 — Void paid không đổi bàn khách mới

- **Truy vết:** IDEM-06, IDEM-13, IDEM-31; UC-IDEM-06.
- **Mức / nhóm:** DB+mock+E2E / chính. **Tiền điều kiện:** F4, reset riêng mỗi variant.
- **Dữ liệu thử:** K void/v6/duplicate; B01 có O3 open.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute/replay; inspect O3/bàn/report.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** O1 void v7/total 150 k/payment/paidAt cũ giữ; B01 occupied/O3 không đổi; void actor A/time một lần; tiền void 150 k không 300 k.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-047 — NULL version cả bốn kind và positive twin

- **Truy vết:** IDEM-04, IDEM-08, IDEM-31; UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, F4, reset riêng mỗi variant.
- **Dữ liệu thử:** update/pay/split O open v5 và void O paid v6; expectedVersion null/missing.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Mỗi kind × null/missing riêng; reason/IDs/amount valid; chạy ca đối chứng dương với expectedVersion = 5 hoặc 6 trong fixture khác.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** NULL/missing INVALID_WRITE_REQUEST/0 K; positive cùng fixture applied. Không test void trên open rồi kết luận đã chặn NULL. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-048 — Stale version, sai trạng thái và không thấy order

- **Truy vết:** IDEM-08, IDEM-31; UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** Version 4 trên O1 version 5; paid cho update/pay/split; open cho void; order UUID không có/S2.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Từng kind/variant register valid rồi execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Version/status ORDER_VERSION_CONFLICT; missing/cross-store order NOT_FOUND; K rejected, 0 hiệu ứng; không dùng mismatch payload che OCC. Mã phải hiện đúng thông báo tại design, mục 7: ORDER_VERSION_CONFLICT, NOT_FOUND.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-049 — Lý do hủy other và enum

- **Truy vết:** IDEM-31; UC-IDEM-06.
- **Mức / nhóm:** DB+giao diện / ngoại lệ. **Tiền điều kiện:** F4, reset riêng mỗi variant.
- **Dữ liệu thử:** reason other note absent/null/empty/spaces; 5 reason hợp lệ; invalid enum.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute valid schema other không note; validate enum; positive có note.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Other blank VOID_REASON_REQUIRED/rejected; invalid enum INVALID_WRITE_REQUEST/0 K; 5 reason hợp lệ (other note Nhập nhầm) applied fixture riêng. Mã phải hiện đúng thông báo tại design, mục 7: VOID_REASON_REQUIRED, INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-050 — Receipt option quantity lần đầu/replay/in lại

- **Truy vết:** IDEM-19, IDEM-32, IDEM-33; UC-IDEM-04, UC-IDEM-05, UC-IDEM-12.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F7, reset riêng mỗi variant.
- **Dữ liệu thử:** 2 ly base 30 k+Q qty 2 × 5 k; full received 100 k; split 1 received 50 k.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Kiểm R1 literal; menu đổi tên/giá; replay; history preview; click In.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Full 80 k/unit 40 k/change 20 k; split 40 k/change 10 k/source 40 k; Q × 2 hiển thị; tên cũ; mọi đường cùng components và tổng; window.print 1 lần chỉ sau click.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-051 — Tắt in, replay và current void cấm in lại

- **Truy vết:** IDEM-14, IDEM-19, IDEM-32, IDEM-33; UC-IDEM-07, UC-IDEM-12.
- **Mức / nhóm:** E2E / biên. **Tiền điều kiện:** F7, reset riêng mỗi variant.
- **Dữ liệu thử:** print setting false; R1 paid; later order status void.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Pay tắt in; replay/later ACK/reconnect; mở R1 sau void; bấm In lại; open order chưa pay variant.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 0 auto preview/0 window.print; paid manual preview được; void/open in lại RECEIPT_UNAVAILABLE; R1 vẫn đọc lịch sử, không vượt guard bằng R1. Mã phải hiện đúng thông báo tại design, mục 7: RECEIPT_UNAVAILABLE.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-052 — ACK applied mất sau commit và đến muộn

- **Truy vết:** IDEM-06, IDEM-07, IDEM-14; UC-IDEM-04, UC-IDEM-07.
- **Mức / nhóm:** DB+E2E / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay; response bị giữ sau COMMIT observer xác nhận.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Chặn response đã commit, chờ timeout 15 s, read K; thả response muộn; chủ động replay.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** UI WRITE_RESULT_UNKNOWN trước read; DB 1 payment/R1 đúng 150 k; late ACK 0 new register/execute/cancel/preview/print; replay cùng K/R1. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_RESULT_UNKNOWN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-053 — Register ACK muộn không tự execute

- **Truy vết:** IDEM-05, IDEM-14; UC-IDEM-02, UC-IDEM-07.
- **Mức / nhóm:** E2E / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K create pending; giữ register ACK>15 s.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Timeout, offline → online/focus hoặc đóng drawer/khóa phiên; thả ACK; read/list.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 1 pending/0 order; 0 execute/0 cancel tự phát, 0 preview; người đăng nhập lại mới chọn pending và bấm tiếp tục. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_RESULT_UNKNOWN.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-054 — Offline không có outbox hoặc auto-resume

- **Truy vết:** IDEM-14; UC-IDEM-02, UC-IDEM-04, UC-IDEM-07.
- **Mức / nhóm:** E2E / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Mạng offline trước click; mạng rớt giữa register/execute.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Thử click offline; reconnect/focus/reload; quan sát mọi RPC writes và storages.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Offline không gửi/queue ghi; reconnect 0 register/execute/cancel mới; chỉ read được phép. Mạng rớt giữa lượt báo chưa rõ, không tự cho thất bại.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-055 — Mất toàn bộ local, tìm đúng hai K

- **Truy vết:** IDEM-06, IDEM-09, IDEM-13; UC-IDEM-07, UC-IDEM-08.
- **Mức / nhóm:** E2E+DB / chính. **Tiền điều kiện:** F6, reset riêng mỗi variant.
- **Dữ liệu thử:** K1 applied/source 120 k v6#8/child #7; K2 pending qty 1/v6.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Xóa cookies/localStorage/sessionStorage/IndexedDB của browser 1; dùng browser 2 context mới, ghép store/nhập PIN B; list chọn K1 rồi chọn K2 execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** K1 lịch sử 120 k v6 giữ; K2 applied source 90 k v7#9/child #8; đúng 2 payments/tổng 60 k; không K3; read R1 không patch current 90 k thành 120 k.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-056 — Takeover giữ đúng actor và creator

- **Truy vết:** IDEM-02, IDEM-09, IDEM-13, IDEM-24; UC-IDEM-08.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** A tạo O1; E edit note/v6; A register pay; B execute; C bỏ deny payment.take rồi grant để replay; assert effective permission trước request.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Thực hiện từng bước rồi dùng observer/context mới đọc ledger/events/payment.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** creator A, lastModified E, initiator A, executor B, payment B; replay C không đổi actor/time; legacy null không đoán A.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-057 — Tìm kiếm/phân trang/quyền sau local wipe

- **Truy vết:** IDEM-09, IDEM-12; UC-IDEM-07.
- **Mức / nhóm:** DB+E2E / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** 101 K valid đăng ký, registeredAt tie nhiều row; mix kind/status/order; S2 có K riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** List limit 50 → cursor → cursor; lọc order/kind/status/date; quyền B pay only; invalid cursor.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Không duplicate/missing IDs theo tuple(timestamp, id); limit 50/50/1 cho A; B chỉ authorized; expired được lọc đúng sau lazy expiry; S2 không lộ; cursor invalid INVALID_WRITE_REQUEST. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-058 — Execute không implicit register và unknown cancel

- **Truy vết:** IDEM-05, IDEM-09, IDEM-10; UC-IDEM-07, UC-IDEM-09.
- **Mức / nhóm:** DB+E2E / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** K chưa có; payload create valid.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute/cancel/get K; sau đó register muộn; UI chưa execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** OPERATION_NOT_FOUND, 0 order; UI không nói đã hủy; late register 1 pending 0 order, cần manual cancel hoặc expiry. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_NOT_FOUND.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-059 — Cancel chủ động pending

- **Truy vết:** IDEM-10; UC-IDEM-09.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay pending còn 23 h; B cancel; A execute sau.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Cancel, đọc lại, execute/replay cùng payload.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** cancelled/cancelledBy B/decidedAt fixed; 0 payment/O open; execute chỉ OPERATION_CANCELLED và count 1; cancel retry không count/thay actor. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_CANCELLED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-060 — Race cancel thắng hoặc execute thắng

- **Truy vết:** IDEM-07, IDEM-10; UC-IDEM-04, UC-IDEM-09.
- **Mức / nhóm:** DB / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay; hai PID/transaction riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Barrier ép cancel trước, fixture khác execute commit trước.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Cancel win:cancelled/0 payment; execute win:applied/1 payment 150 k, cancel trả applied. Không cả hai hiệu ứng; race hoàn tất ≤ 30 s.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-061 — Cancel quá hạn không đổi đơn

- **Truy vết:** IDEM-10, IDEM-11; UC-IDEM-09, UC-IDEM-10.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K registered T; clock T+24 h; O open v5.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Cancel, execute/read lại.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** expired/0 payment/O open 150 k v5/B occupied; không cancelled, không void order. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_EXPIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-062 — TTL đúng −1 ms/0/+1 ms tại checkpoint

- **Truy vết:** IDEM-11; UC-IDEM-10.
- **Mức / nhóm:** DB+đơn vị / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Clock test T+24 h−1 ms, =24 h, +1 ms; K pending.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Thêm hai suffix gate sau validation/trước checkpoint: validation_k_expiry (K đăng ký T, phiên cấp T+20 h, validation lúc T+24 h−1 ms, nhả gate T+24 h+1 ms); validation_session_expiry (K và phiên cấp T, validation T+12 h−1 ms, nhả gate T+12 h+1 ms).  Execute ba fixture với clock controlled tại checkpoint.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** validation_k_expiry trả expired/0 hiệu ứng dù check trước validation còn hạn; validation_session_expiry trả EMPLOYEE_SESSION_REQUIRED, K vẫn pending/0 hiệu ứng vì K chưa hết 24 h.  −1 ms applied 1 payment; =, +1 ms expired/0 hiệu ứng; không dùng now()đầu transaction; hạn registered không đổi. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_EXPIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-063 — TTL qua các khóa K/store/order/table

- **Truy vết:** IDEM-11; UC-IDEM-10.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Bốn fixture giữ lần lượt K row, POS store advisory, O1 row, B01 row trước expiry.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute trước expiry, observer chứng minh wait, clock qua expiry rồi nhả khóa.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mỗi case expired/0 hiệu ứng nghiệp vụ/0 event/No 12/total 150 k/v5; checkpoint timestamp ≥ expiry. Không pass nếu chỉ test wait K. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_EXPIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-064 — Clock production wiring sau chờ thật

- **Truy vết:** IDEM-11, IDEM-22; UC-IDEM-10.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** registeredAt từ DB thật, expiry fixture gần hiện tại; không clock override.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Dùng transaction đã bắt đầu trước expiry, giữ row tới DB clock>expiry, release; so điểm kiểm với clock_timestamp.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** expired dù transaction_timestamp()<expiry; test fail nếu implementation dùng now/current_timestamp/transaction timestamp. Mã phải hiện đúng thông báo tại design, mục 7: OPERATION_EXPIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-065 — Bắt đầu hợp lệ trước hạn, commit sau hạn

- **Truy vết:** IDEM-07, IDEM-10, IDEM-11; UC-IDEM-09, UC-IDEM-10.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Checkpoint T+24 h−1 ms; fault gate sau hiệu ứng đầu không throw.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Giữ gate qua 24 h; cancel phải chờ; release commit.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** applied 1 payment, commitAt>expiry; cancel trả applied; không rollback transaction hợp lệ vì check TTL lần 2 sau hiệu ứng.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-066 — Đơn 48 h thanh toán với K mới

- **Truy vết:** IDEM-11, IDEM-12, IDEM-28; UC-IDEM-10.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** O1 businessDate 2026-09-08; now 2026-09-10T00:00:00Z; K cũ expired, K mới register now.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Read K cũ, xác nhận pay K new, xem history/report.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** O paid v6/150 k/payment 1/paidAt 2026-09-10; report ngày 2026-09-08 tăng 150 k, ngày 2026-09-10 tăng 0 từ O1; B empty. K cũ expired vẫn còn.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-067 — Applied 48 h không bị TTL ghi đè

- **Truy vết:** IDEM-06, IDEM-11, IDEM-12; UC-IDEM-07, UC-IDEM-10.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K pay applied T+1 h; clock T+48 h.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Get/list/execute/cancel và duplicate register cùng payload.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mọi view applied/R1 gốc; only execute count 1; 0 new payment; registered/expiry/decidedAt unchanged.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-068 — ACK lost cho mọi terminal

- **Truy vết:** IDEM-06, IDEM-07, IDEM-10, IDEM-12; UC-IDEM-07, UC-IDEM-09, UC-IDEM-10.
- **Mức / nhóm:** DB+E2E / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** rejected(amount 1), cancelled, expired, applied; 4 fixture riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Commit terminal observer xác minh rồi drop ACK; clock+48 h; context mới read/replay.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Đúng terminal/error/R1 cũ từng fixture; không reopen, không đổi rejected/cancelled thành expired; 0 hiệu ứng mới. Không chỉ test applied.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-069 — Fault rollback tại mọi điểm giữa business

- **Truy vết:** IDEM-07; UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F1/F4/F5, reset riêng mỗi variant.
- **Dữ liệu thử:** Submit sau tombstone/insert option; split sau renumber/move-copy/options/payment; pay sau payment/order/table; void sau update.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Test-only throw infra từng checkpoint riêng, await rollback; observer fresh; remove fault và retry cùng K.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Mọi orders/items removed/options/payment/table/number/event/result quay snapshot trước; K pending payload/expiry giữ; retry một applied/hiệu ứng đúng fixture. Không chỉ đếm payment. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_TEMPORARILY_UNAVAILABLE.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-070 — Fault sau lưu applied trước commit

- **Truy vết:** IDEM-07; UC-IDEM-04, UC-IDEM-05.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Pay và split, hook sau ledger result write/before commit.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Throw SQL exception, observer transaction mới; retry chủ động.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Applied/result/event và business đều rollback; K pending không R1; retry đúng 1 payment. Không cho R1 sống mà business rollback. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_TEMPORARILY_UNAVAILABLE.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-071 — Business error muộn rollback nhưng giữ rejected

- **Truy vết:** IDEM-07, IDEM-17; UC-IDEM-03, UC-IDEM-07.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F5, reset riêng mỗi variant.
- **Dữ liệu thử:** Hook test-only raise known OPTION_VALUE_UNAVAILABLE sau thay items trước outer decision.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute, await commit; inspect full DB; bỏ hook/sửa menu để hợp lệ; replay cùng K.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Business raw snapshot giữ 60 k v5; K rejected cùng code bền; replay vẫn cùng rejection 0 hiệu ứng; chỉ K new có xác nhận mới được ghi. Mã phải hiện đúng thông báo tại design, mục 7: OPTION_VALUE_UNAVAILABLE.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-072 — Infrastructure error không poison K

- **Truy vết:** IDEM-07, IDEM-14; UC-IDEM-04, UC-IDEM-07.
- **Mức / nhóm:** DB+mock / ngoại lệ. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** SQL deadlock/serialization disposition/connection abort fixture riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Inject hạ tầng, trả mapping adapter; read K fresh; sau đó chủ động retry.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** WRITE_TEMPORARILY_UNAVAILABLE hoặc WRITE_RESULT_UNKNOWN tùy biết rollback; K không rejected giả; no auto retry; cuối 1 payment. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_TEMPORARILY_UNAVAILABLE, WRITE_RESULT_UNKNOWN.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-073 — Replay counter chính xác và độc lập R1

- **Truy vết:** IDEM-06, IDEM-20; UC-IDEM-07.
- **Mức / nhóm:** DB+mock / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** K applied count 0; 2 concurrent execute; register/get/list/cancel/mismatch/unauthorized.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Chạy 2 replay đồng thời rồi từng non-count action; biến thể terminal rejected/cancelled/expired.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** count 2 và giữ nguyên sau các non-count actions; R1/error/actor/time không đổi; rolled back replay không count; first terminal decision count 0.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeConcurrency.contract.test.ts`; runner ở mục A2.

### TC-IDEM-074 — JSON required/type/null và unknown fields

- **Truy vết:** IDEM-04; UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0/F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** Matrix mục B schema bên dưới; mỗi field required thiếu/null/sai kiểu; positive đúng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Validate core và register DB bằng cùng literal fixture không share validator.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** INVALID_WRITE_REQUEST/0 K cho invalid; positive twin register pending; không SQL cast UNKNOWN hoặc coalesce quantity null thành 1. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-075 — UUID collision của thực thể

- **Truy vết:** IDEM-04, IDEM-07; UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0/F1, reset riêng mỗi variant.
- **Dữ liệu thử:** OrderId/NewOrderId/PaymentId/NewLine.id/NewOption.id/SplitItemId đã có hoặc cross store; ID trùng trong payload.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi từng variant riêng; IDs valid UUID; không dùng K collision thay thế.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** ENTITY_ID_CONFLICT/rejected cho collision DB; duplicate new ID trong payload INVALID_WRITE_REQUEST trước register; 0 partial writes/0 event. Mã phải hiện đúng thông báo tại design, mục 7: ENTITY_ID_CONFLICT, INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-076 — Money min/max và overflow business

- **Truy vết:** IDEM-04, IDEM-07; UC-IDEM-02, UC-IDEM-04.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Money 0;2147483647; −1;2147483648; 0.5; string; unit base 2147483647+option 1.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register/execute fixture riêng; catalog price 0 hoặc max có admin setup.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 0/max hợp lệ khi tạo đơn và tổng trong range; thanh toán riêng phần tổng 0 vẫn bị chặn như TC 092; ngoài range/type INVALID_WRITE_REQUEST trước register; sum overflow rejected INVALID_WRITE_REQUEST/0 hiệu ứng, không âm/wrap. Variant quote cũ 1 × qty 2, catalog tăng 2147483647: proposed 4294967294 bị INVALID_WRITE_REQUEST trước dựng PRICE_CHANGED, không response money ngoài miền. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-077 — Quantity line và option min/max

- **Truy vết:** IDEM-04, IDEM-26; UC-IDEM-02, UC-IDEM-03.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Line qty 0,1,999,1000; option qty 0,1,99,100; actual catalog base/option=0 và quote=0 để tránh overflow/PRICE_CHANGED ngoài mục tiêu.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Từng variant validate/register/execute với group multi cho phép số lượng option.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Line 1/999 và option 1/99 hợp lệ; 0/>max INVALID_WRITE_REQUEST/0 K; qty source tăng quá nguồn là INVALID_ORDER_ITEMS ở execute, không schema. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-078 — Array empty/max và payload bytes

- **Truy vết:** IDEM-04; UC-IDEM-02, UC-IDEM-03, UC-IDEM-05.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** newLines create 0/1/200/201; options 0/20/21; payload JSONB text 262144/262145 byte.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Dựng catalog 201 món và 21 options có actual price=quote=0, names/notes ASCII padding có kiểm byte; submit 200 đơn giá 0; gọi RPC.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** 0 create/201/21/>bytes bị chặn INVALID_WRITE_REQUEST; 1/200/20/byte đúng max pass schema. Fixture 262144 phải đạt thật bằng observer pgsize, không ước lượng HTTP. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-079 — Note unicode, optional và reason boundary

- **Truy vết:** IDEM-04, IDEM-31; UC-IDEM-03, UC-IDEM-06.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** Note absent/null/empty/500/501 codepoints, emoji; reason other trim space.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Đếm Unicode codepoints bằng literal fixture độc lập; register và execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** ≤ 500 valid, 501 INVALID_WRITE_REQUEST; other empty/whitespace VOID_REASON_REQUIRED; equality absent/null vẫn khác; DB/UI không đếm UTF16 units lệch. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST, VOID_REASON_REQUIRED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-080 — List input và version overflow

- **Truy vết:** IDEM-04, IDEM-08, IDEM-09; UC-IDEM-03, UC-IDEM-07.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** limit 0/1/100/101; invalid timestamp/order filter UUID; O version 2147483647.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Gọi list biến thể; register update version max rồi execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Limit 1/100 valid, 0/101/type bad INVALID_WRITE_REQUEST; version increment overflow rejected INVALID_WRITE_REQUEST/0 hiệu ứng, không wrap hoặc K pending vĩnh viễn. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-081 — Cash-only và dữ liệu tiền nhận thiếu

- **Truy vết:** IDEM-04, IDEM-28; UC-IDEM-04, UC-IDEM-05.
- **Mức / nhóm:** đơn vị+DB / biên. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** method bank_transfer/qr/other/null; receivedAmount absent/null/−1/0.5/string.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register từng variant có IDs/version/selection valid.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** INVALID_WRITE_REQUEST/0 K/0 payment; cash integer 150 k positive twin pay applied. Mã phải hiện đúng thông báo tại design, mục 7: INVALID_WRITE_REQUEST.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-082 — Kiểm toàn bộ ledger/event giữ bền

- **Truy vết:** IDEM-12, IDEM-13, IDEM-21; UC-IDEM-07.
- **Mức / nhóm:** DB / biên. **Tiền điều kiện:** F0/F1/F4, reset riêng mỗi variant.
- **Dữ liệu thử:** K terminal đủ 4 loại và legacy order creator unknown; clock+30 ngày.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Migration fixture legacy; list/read; thử clear_demo/admin parent delete; inspect rows.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** K/payload/result/error/event không bị xóa; creator legacy null hiển thị không xác định; price/payment/date cũ giữ; clear_demo không đụng finance.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-083 — R1 lịch sử sau child void và sửa nguồn

- **Truy vết:** IDEM-06, IDEM-09, IDEM-19, IDEM-29, IDEM-33; UC-IDEM-05, UC-IDEM-07, UC-IDEM-12.
- **Mức / nhóm:** DB+E2E / chính. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** Split K1 child 30 k/source 120 k; update K2 source note; void K3 child.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Read/replay K1 từ context mới; xem current separate; thử in lại child.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** R1 paid child 30 k/source v6 giữ; current child void/source v7; payment 1 vẫn ghi; không cascade hủy nguồn; in lại bị chặn RECEIPT_UNAVAILABLE. Mã phải hiện đúng thông báo tại design, mục 7: RECEIPT_UNAVAILABLE.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-084 — Capability và adapter fail closed

- **Truy vết:** IDEM-21; UC-IDEM-01, UC-IDEM-07.
- **Mức / nhóm:** đơn vị+E2E / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Server version absent/0/2; VITE_DATA_MODE supabase thiếu URL/key.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Khởi động và thử ghi; spy old RPC/mock construction.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** WRITE_PROTOCOL_UNSUPPORTED khi version wrong; runtime config fail rõ khi thiếu config; 0 oldRPC/0 mock fallback/0 hiệu ứng nghiệp vụ. Mã phải hiện đúng thông báo tại design, mục 7: WRITE_PROTOCOL_UNSUPPORTED.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-085 — Migration/grant/search_path audit

- **Truy vết:** IDEM-03, IDEM-21; UC-IDEM-01, UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F0 legacy, reset riêng mỗi variant.
- **Dữ liệu thử:** Schema đang main@7183b31 → candidate migrations; schema spoof object.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Apply migration test DB, inventory functions/grants/RLS, thử shadow helper trong schema user writable.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Fixed search_path/schema qualified; no exposed private/test hooks; mọi old overload revoked; snapshots legacy nguyên; onboarding/POS functional. Thiếu bất kỳ inventory row fail.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

### TC-IDEM-086 — Runner discovery manifest

- **Truy vết:** IDEM-22; UC-IDEM-07.
- **Mức / nhóm:** công cụ / biên. **Tiền điều kiện:** Không businessfixture, reset riêng mỗi variant.
- **Dữ liệu thử:** Manifest mọi TC và suffix; src include và new contract config.
- **Bước 1:** Dựng manifest/config hoặc bản SUT có lỗi tạm theo dữ liệu thử; không cần snapshot nghiệp vụ cho kiểm tra thuần công cụ.
- **Bước 2:** Chạy list tests với config explicit; đối chiếu names+paths; deliberately move one file ngoài include.
- **Bước 3:** Chờ runner kết thúc, kiểm exit code/discovery/skip và assertion failure mong đợi; không coi không chạy được là pass.
- **Kết quả mong đợi:** Thiếu TC/file/suffix làm gate fail nonzero; số test cũ pass không bù được. Khôi phục config thì discovery đủ, không ghi đã pass behavior.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/caseManifest.ts`; runner ở mục A2.

### TC-IDEM-087 — Supabase preflight không giả xanh

- **Truy vết:** IDEM-21, IDEM-22; UC-IDEM-07.
- **Mức / nhóm:** công cụ / biên. **Tiền điều kiện:** Test DB riêng, reset riêng mỗi variant.
- **Dữ liệu thử:** Missing URL/key/observer DSN; mode=mock; DB migration marker wrong; required test skip.
- **Bước 1:** Dựng manifest/config hoặc bản SUT có lỗi tạm theo dữ liệu thử; không cần snapshot nghiệp vụ cho kiểm tra thuần công cụ.
- **Bước 2:** Chạy DB/E2E preflight từng variant; positive đúng URL/Auth/RPC marker.
- **Bước 3:** Chờ runner kết thúc, kiểm exit code/discovery/skip và assertion failure mong đợi; không coi không chạy được là pass.
- **Kết quả mong đợi:** Mỗi invalid exit nonzero trước suite; nêu config thiếu không in secret; skip bắt buộc bị gate fail; positive observer thấy writeProtocol v1 và real DB UUID.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/caseManifest.ts`; runner ở mục A2.

### TC-IDEM-088 — Oracle độc lập và mutation sensitivity

- **Truy vết:** IDEM-22; UC-IDEM-07.
- **Mức / nhóm:** công cụ / biên. **Tiền điều kiện:** F1/F3/F7, reset riêng mỗi variant.
- **Dữ liệu thử:** SUT lỗi tạm:always pending, always reject, duplicate payment, reprice old, drop option qty, replay current.
- **Bước 1:** Dựng manifest/config hoặc bản SUT có lỗi tạm theo dữ liệu thử; không cần snapshot nghiệp vụ cho kiểm tra thuần công cụ.
- **Bước 2:** Chạy các TC liên quan từng mutant trên branch test isolated; không đưa mutant vào main.
- **Bước 3:** Chờ runner kết thúc, kiểm exit code/discovery/skip và assertion failure mong đợi; không coi không chạy được là pass.
- **Kết quả mong đợi:** Mỗi mutant bị ít nhất 1 TC phát hiện; expected literal/DB raw không dùng buildReceipt/calc total/formatVnd của SUT. Pass do 0 operation không được chấp nhận.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/caseManifest.ts`; runner ở mục A2.

### TC-IDEM-089 — Regression seams và báo cáo baseline

- **Truy vết:** IDEM-21, IDEM-22, IDEM-23, IDEM-25, IDEM-26, IDEM-28, IDEM-29, IDEM-31, IDEM-32, IDEM-33; UC-IDEM-01, UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06, UC-IDEM-12.
- **Mức / nhóm:** đơn vị+E2E / chính. **Tiền điều kiện:** Baseline testfixture hiện hành + F1/F7, reset riêng mỗi variant.
- **Dữ liệu thử:** npm test/build/smoke; independent new tests trên code candidate.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Chạy test cũ+build+mock smoke; DB/E2E cases mới; đối chiếu manifests/artifact SHA.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Không boundary violation; PIN/admin/floor/payment/history/print dùng được. Variant dirty-exit: đóng draft chưa gửi phải xác nhận bỏ, chọn ở lại giữ draft, 0 register/execute/cancel; variant empty-selection: chặn hoàn tất, 0 write; variant tạm tính: mở preview đúng snapshot/0 payment; variant pay-then-void: tải version 6 trước xác nhận hủy mới, void thành version 7, retry giữ K/version 6; 63 test baseline cũ không được gắn nhãn idempotency passed; báo đúng executed/skip/fail.
- **Nơi hiện thực:** Chưa có. Dự kiến `src/features/pos/writeOperationFlow.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-090 — Nút kết quả và request schema không lộ credential

- **Truy vết:** IDEM-01, IDEM-04, IDEM-09, IDEM-13, IDEM-14; UC-IDEM-07, UC-IDEM-08.
- **Mức / nhóm:** DB+E2E / bảo mật. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** A register pay/B takeover; capture log/network R1/list.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Kiểm payload, result, error, logger và storages; đối chiếu network header redaction.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Không PIN/token/hash trong payload/R1/error/log/local; credential chỉ header request được redact trong artifact; initiator/executor UUID đúng; không serialize whole employee hash.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts` và `tests/supabase/idempotency.spec.ts` (UI/server thật); runner ở mục A2.

### TC-IDEM-091 — Bàn không tồn tại hoặc tombstone

- **Truy vết:** IDEM-26; UC-IDEM-02.
- **Mức / nhóm:** DB / ngoại lệ. **Tiền điều kiện:** F0, reset riêng mỗi variant.
- **Dữ liệu thử:** Bàn UUID không có, B01 deleted, tableId S2; dine_in món valid.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Register create riêng cho 3 fixture; execute.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** K rejected TABLE_NOT_FOUND; 0 order/items/payment; không lộ table S2; positive B01 active applied. Mã phải hiện đúng thông báo tại design, mục 7: TABLE_NOT_FOUND.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`; runner ở mục A2.

### TC-IDEM-092 — Split tiền thiếu và tổng bằng không

- **Truy vết:** IDEM-28, IDEM-29; UC-IDEM-04, UC-IDEM-05.
- **Mức / nhóm:** DB+đơn vị+E2E / biên. **Tiền điều kiện:** F1; F0 price 0, reset riêng mỗi variant.
- **Dữ liệu thử:** Split 1 ly 30 k received 29999/30000; đơn 1 món 0 nhận 0; đơn[A 0, T 20 k] chọn A 0 hoặc chọn cả hai; empty selection riêng.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute từng fixture.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** Nhận 29.999 cho phần 30.000 trả PAYMENT_AMOUNT_TOO_LOW, không ghi; nhận 30.000 thành công/thừa 0. Đơn tổng 0 hoặc chỉ chọn dòng 0 trong đơn[A 0, T 20 k] bị INVALID_ORDER_ITEMS, không payment, kiểm cả core/UI/DB. Chọn cả hai dòng tổng 20 k thì paid 20 k với 1 payment. Selection rỗng chặn trước register; phần 0 qua DB bị rejected, không tạo payment 0. Giữ giới hạn hiện hành, không thêm tính năng thanh toán 0 đ.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writeOperations.contract.test.ts`, `src/features/pos/writeOperationFlow.test.ts`, `tests/supabase/idempotency.spec.ts`; runner ở mục A2.

### TC-IDEM-093 — Terminal không bị unauthorized/mismatch sửa

- **Truy vết:** IDEM-02, IDEM-04, IDEM-06, IDEM-12, IDEM-20; UC-IDEM-07, UC-IDEM-08.
- **Mức / nhóm:** DB / bảo mật. **Tiền điều kiện:** F1, reset riêng mỗi variant.
- **Dữ liệu thử:** 4 terminal statuses; token C none hoặc A/payload khác valid.
- **Bước 1:** Dựng fixture, đọc snapshot trước bằng observer độc lập; kiểm positive control nếu có.
- **Bước 2:** Execute/get/cancel theo quyền; mismatch bằng token A.
- **Bước 3:** Chờ request/transaction kết thúc (timeout 30 s là fail), đọc snapshot mới và đối chiếu oracle G cùng expected dưới đây.
- **Kết quả mong đợi:** C FORBIDDEN, A mismatch IDEMPOTENCY_KEY_REUSED; result/error/status/actor/count/timestamps giữ. K terminal không mở lại hoặc đổi loại. Mã phải hiện đúng thông báo tại design, mục 7: FORBIDDEN, IDEMPOTENCY_KEY_REUSED.
- **Nơi hiện thực:** Chưa có. Dự kiến `tests/contracts/writePermissions.contract.test.ts`; runner ở mục A2.

## D. Tiêu chí nghiệm thu và gói bằng chứng

1. Candidate code/migrations có commit SHA; record config đã redact, checksum fixture/manifest/expected; không commit secret.
2. Build/architecture/unit/mock smoke đạt. DB contracts/E2E trên backend thật đủ manifest, không required skip/unexecuted; mỗi failure phải có expected/actual và raw DB/trace phù hợp.
3. Ba review độc lập test design không thay thế chạy test. Reviewer triển khai phải đọc test+SUT, chạy lại các ca được giao bằng environment đã preflight, báo rõ engine/backend/command/exitcode, không chỉ đọc log từ agent viết code.
4. Không cần tuyên bố “đảm bảo không có bug”. Chỉ nghiệm thu những bất biến và lịch race đã thiết kế/thực thi; hoạt động mạng/thiết bị ngoài fixtures vẫn có giới hạn.
5. Cổng triển khai không đạt nếu thiếu môi trường kiểm thử DB hoặc không thể fault test an toàn: ghi BLOCKED/NOTRUN đúng thực tế, không giảm required test hoặc thay bằng mock.
