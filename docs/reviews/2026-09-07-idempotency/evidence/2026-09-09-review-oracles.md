# Rà độc lập test design: khả năng tự chạy và tránh test xanh sai

Ngày 09/09/2026. Góc rà: oracle, fixture, traceability và harness. Không sửa ứng dụng/test, không chạy lại baseline, không đọc secret hoặc gọi cloud. Không đọc hay trao đổi với reviewer khác.

## Kết luận

**Chưa sẵn sàng tự chạy để nghiệm thu giao thức mới.** Ngoài việc bộ bảy artifact còn thiếu đã được tài liệu 12 công khai, có các lỗi thiết kế kiểm thử cụ thể: runner không khám phá đường dẫn contract dự kiến; lệnh chạy mang tên Supabase có thể dựng ứng dụng mock; fixture `void` dùng đơn mở có thể che lỗi SQL NULL; biến thể đảo mảng chưa có mảng đủ phần tử; oracle “tối đa một lần” chưa buộc có lần thành công; kiểm không ghi dữ liệu chưa chứng minh không tự gửi execute.

Không có phát hiện nào yêu cầu mở lại phạm vi modifier. Giữ đúng **2×30.000 + 1×(40.000+0) = 100.000đ**, thêm modifier lúc gọi món mới, không sửa modifier món cũ.

## Mốc và phương pháp

- Code đã kiểm `HEAD = 7183b31a4ca27ed2be3ca7097f391fd2c07f806c`; main chỉ có `?? pnpm-lock.yaml` khi kiểm. Không sửa file đó.
- Đọc `AGENTS.md`, `CLAUDE.md`, `openspec/SPEC-STANDARD.md` tại worktree docs; đọc proposal working tree, tài liệu 11, tài liệu 12 với **mục 7 là quyết định mới nhất**, và log/JSON baseline.
- Rà đủ PRE-IDEM-01–32, TTL-01–06 và các biến thể giá bổ sung; đối chiếu package/config, assertion baseline, runtime mock/Supabase, RPC liên quan và mapping lỗi. Đây là rà tĩnh và kiểm bằng chứng, không phải kết quả chạy TC mới.
- Tài liệu đầu vào có sửa chưa commit. SHA-256 dưới đây định danh chính xác bản đã đọc, tránh coi kết luận này tự động áp dụng cho bản sửa sau.

| Đầu vào | SHA-256 |
| --- | --- |
| `proposal.md` | `1C6AD6EE2651540540DBBF74AE01E2F52DF49CA075BCB699851C2084EF3D75C5` |
| `12-chuan-bi-ra-cuoi-truoc-code.md` | `1E899453B55553457D45A751B7E1EB07571132EFF7C67D333A57779D860BF6F9` |
| `11-thuong-mai-dien-tu-va-kiem-chung-test.md` | `96BEAA5BDF7EC2EF28FB7AFE817D30927CCB2CA841A09061E210BD817FD1D18D` |
| `2026-09-08-independent-baseline.json` | `274B01655823B3C6B752AB6DDD161F3F02DB16BF4FE485730378AB537790593E` |
| `2026-09-08-independent-baseline.log` | `8891A92A7DD0BFD81584DD9942F0C009EA52FC86EF147E6E86DB022539E50FAC` |

## Điểm mạnh và baseline được xác minh

Proposal đã yêu cầu lost ACK xảy ra **sau commit có observer xác nhận**, race có hai connection/barrier, fixture độc lập cho từng biến thể, phân biệt credential setup và caller, kiểm DB thực thay cho grep migration: [proposal:260](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:260). Không coi các yêu cầu đã có đó là finding mới.

Hai nhánh polling/clamp, TTL sau chờ khóa, register đến muộn, terminal result qua 24 giờ, giá cũ/mới cùng modifier 0đ và không tự in đã được đặt đúng mục tiêu. Giá có expected bằng số, thay vì chỉ “bằng kết quả server”: [12:294](D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md:294).

JSON baseline thực có 5 `testResults`: instantPay 3, mockRepos 20, repos Supabase 14, modifier 7, orderFlow 19; tổng **63 passed, 0 failed, 0 pending, 0 todo**, `success=true`. Log khớp **5 file, 63 test, 5,95 giây**. Trường 15 suites không phải 15 file. Lệnh/môi trường và exit code 0 được ghi tại [11:84](D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/11-thuong-mai-dien-tu-va-kiem-chung-test.md:84); JSON/log nhất quán với kết quả đó.

Assertion giá hiện hữu có điểm tốt: [modifier.test.ts:60](D:/Workspace/pos-cafe/src/features/pos/modifier.test.ts:60) gọi hàm cần kiểm rồi so **53000 literal**; đây không phải lỗi dùng chính SUT tính expected. [mockRepos.test.ts:439](D:/Workspace/pos-cafe/src/adapters/mock/mockRepos.test.ts:439) có literal 61000/64000, số đơn 24/30 và trạng thái bàn. Nhưng RPC trong [repos.test.ts:43](D:/Workspace/pos-cafe/src/adapters/supabase/repos.test.ts:43) là `vi.fn` trả dữ liệu dựng sẵn. Không có bằng chứng DB, race, idempotency hay PRE-IDEM mới trong baseline này.

## Findings cần xử lý trong thiết kế

### ORA-01 — P1: file contract dự kiến không được runner hiện tại khám phá

**Vị trí:** [proposal:252](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:252) đặt contract tại `tests/contracts/writeOperations.contract.test.ts`; [vitest.config.ts:9](D:/Workspace/pos-cafe/vitest.config.ts:9) chỉ include `src/**/*.{test,spec}.{ts,tsx}`. Playwright thường có testDir `tests/smoke`, cấu hình Supabase có [testDir `tests/supabase`:29](D:/Workspace/pos-cafe/playwright.supabase.config.ts:29). [package.json:6](D:/Workspace/pos-cafe/package.json:6) không có runner contract riêng.

**Lỗi có thể lọt:** người triển khai viết đủ contract vào đường dẫn đã chỉ định; `npm test`, coverage và hai lệnh smoke vẫn xanh vì không chạy file đó. Traceability trỏ tới một file tồn tại cũng không phát hiện thiếu thực thi.

**Check bổ sung:** analyst chốt runner/config/lệnh cho file contract trong tasks; acceptance kiểm danh sách test được khám phá đối chiếu manifest TC, gồm từng biến thể và adapter. Expected: mỗi TC bắt buộc xuất hiện và có kết quả của đúng backend; thiếu một TC/backend, skip/todo hoặc file bị bỏ qua làm cổng nghiệm thu thất bại. Không chỉ kiểm `numFailedTests=0`.

### ORA-02 — P1: `smoke:supabase` chưa bảo đảm ứng dụng thực sự dùng Supabase

**Vị trí:** [playwright.supabase.config.ts:25](D:/Workspace/pos-cafe/playwright.supabase.config.ts:25) nạp env nhưng không bắt buộc mode/URL/key; webServer ở dòng 36–40 không ép mode. [runtimePorts.ts:15](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:15) chọn mock khi không có URL/key, hoặc khi mode là `mock`. Ca hai browser hiện có [pos-cafe-supabase.spec.ts:253](D:/Workspace/pos-cafe/tests/supabase/pos-cafe-supabase.spec.ts:253) còn skip nếu `RUN_SUPABASE_REALTIME_E2E` không bằng `1`.

**Lỗi có thể lọt:** lỗi migration/RLS/transaction không ảnh hưởng đến lượt chạy ứng dụng mock mang nhãn Supabase. Các ca UI một máy trong suite không tự chứng minh backend; thiếu môi trường không được biến thành lượt nghiệm thu xanh. Đây là suy luận trực tiếp từ config/runtime, không phải tuyên bố đã chạy với env trống.

**Check bổ sung:** trước suite DB/E2E server, xác minh mode thực của ứng dụng, khả năng kết nối observer và phiên bản migration DB test. Ca preflight với mode mock hoặc thiếu cấu hình DB phải dừng thất bại trước nghiệp vụ. Với cấu hình hợp lệ, tạo marker fixture riêng và đọc thấy marker bằng connection DB độc lập. TC hai context bắt buộc trong mốc nghiệm thu không được thừa hưởng opt-in skip của ca realtime cũ. Không ghi URL chứa credential hoặc Store Key vào evidence; suite cũ đang đưa Store Key vào annotation tại dòng 115, nên không sao chép cách đó sang harness mới.

### ORA-03 — P1: PRE-IDEM-14 dùng O1 mở sẽ che chính lỗi NULL của `void_order`

**Vị trí:** fixture chung [proposal:207](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:207) định nghĩa O1 `open`; [PRE-IDEM-14:227](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:227) liệt kê update/pay/split/**void** với version cũ/SQL NULL. [011_void_paid_order.sql:157](D:/Workspace/pos-cafe/supabase/migrations/011_void_paid_order.sql:157) từ chối khi `status <> paid OR lock_version <> expected`.

**Lỗi có thể lọt:** gọi void O1 mở với NULL sẽ trả `ORDER_VERSION_CONFLICT` vì status sai; test vẫn xanh ngay cả khi code vẫn còn so sánh `<> NULL` thiếu guard. Test “đã kiểm NULL” thực tế chưa đi tới trường hợp nguy hiểm paid + NULL.

**Ca bổ sung/hiệu chỉnh:** tạo fixture `V1` **paid, version=5, payment=150000, reason=duplicate, caller có order.voidPaid**, cùng cửa hàng và UUID hợp lệ. Ba fixture riêng: expectedVersion=5 thành công (`void`, version=6, payment/tổng/số đơn nguyên); version=4 bị `ORDER_VERSION_CONFLICT`, không thay đổi; SQL NULL bị từ chối bằng mã được design quy định, không thay đổi. Ca positive bắt buộc chứng minh các tiền điều kiện khác hợp lệ. Mutation mục tiêu bỏ riêng guard NULL phải làm ca NULL thất bại.

Tương tự, split của O1 quantity=1 phải có UUID `splitItemId`: RPC hiện kiểm ở [012:198](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:198). Khi kiểm version/quyền/lost ACK, thiếu ID này không được tính là đã chạm nhánh cần kiểm. Fixture void lỗi lý do phải dùng reason hợp lệ trong mọi ca không nhằm kiểm `VOID_REASON_REQUIRED`.

### ORA-04 — P2: biến thể đảo mảng của PRE-IDEM-07 chưa có fixture làm mảng thay đổi

**Vị trí:** [PRE-IDEM-07:220](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:220) bắt đầu từ split `L1=1`, trong khi O1 chỉ có một dòng. Quyết định mảng có thứ tự đã chốt ở [12:56](D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md:56).

**Lỗi có thể lọt:** đảo mảng một phần tử không đổi payload; nếu test chỉ kiểm roundtrip cùng K, implementation tự sort mảng vẫn có thể xanh. Nếu kỳ vọng mismatch, fixture này lại gây đỏ sai.

**Ca cụ thể:** fixture hai dòng `L1: 2×30000`, `L2: 2×20000`, tổng 100000; chọn mỗi dòng 1, tiền nhận 50000, hai `splitItemId` UUID khác nhau. Register mảng `[L1=1,L2=1]`; cùng K đảo riêng thứ tự **key object** phải nhận cùng đăng ký, không đổi hạn. Ở fixture khác, đảo thành `[L2=1,L1=1]` phải nhận mã mismatch đã khai báo trong design; payload gốc và trạng thái pending nguyên, 0 payment. Cả hai payload phải tự qua schema để lỗi schema không giả làm mismatch.

Với vắng/null, cần dùng đúng một trường mà **cả hai biểu diễn đều hợp lệ theo schema**; nếu schema chỉ cho phép một dạng, đó là ca schema-invalid riêng, không phải bằng chứng về thuật toán so sánh. Đây là lựa chọn contract của analyst, không cần hỏi lại người dùng về thứ tự mảng.

### ORA-05 — P1: oracle race cần chứng minh thành công, không chỉ “tối đa một lần”

**Vị trí:** [PRE-IDEM-06:219](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:219) cho expected “tối đa 1 lần áp dụng” và caller có thể nhận trạng thái phải tra lại. Yêu cầu barrier/đếm DB đã có ở dòng 263; chỗ thiếu là điều kiện kết thúc thành công của fixture hợp lệ.

**Lỗi có thể lọt:** implementation deadlock rồi abort cả hai, luôn trả pending, hoặc luôn từ chối execute vẫn thỏa `effects <= 1`; hai response timeout không phải bằng chứng chống trùng thành công.

**Ca/check bổ sung:** với mỗi loại RPC, trước hết fixture tương đương một caller phải thành công. Trong race không chủ động gây transport fault, sau giải phóng barrier và hết các transaction phải có **đúng 1 applied**, đúng 1 hiệu ứng, và read kết thúc trong timeout harness được chốt. Với pay O1: 1 payment 150000, tiền nhận 200000, thừa 50000, version=6, bàn empty. Với split: 1 payment 30000, nguồn 120000/version=6, bàn occupied. Hai caller nếu có timeout do test chủ động gây ra đều phải tra về cùng terminal result. Hết timeout mà vẫn pending là fail, không coi là một kết quả thành công được phép.

Không buộc mọi loại RPC đều tạo payment: submit/void có delta riêng. Manifest phải tách create tại bàn, takeaway, update và void-open trong submit, thay vì một hàng “submit” đại diện tất cả nhánh.

### ORA-06 — P1: DB không đổi chưa chứng minh UI không tự execute

**Vị trí:** [PRE-IDEM-09–12:222](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:222), PRE-IDEM-23 và PRE-IDEM-32 cấm tự execute/in, nhưng oracle định lượng của PRE-IDEM-12 chỉ nói số lần **ghi nghiệp vụ** tự phát bằng 0. Polling hiện mỗi 5000ms ở [usePosData.ts:7](D:/Workspace/pos-cafe/src/features/pos/usePosData.ts:7); clamp rỗng quay về fullSelection ở [PaymentDrawer.tsx:58](D:/Workspace/pos-cafe/src/app/drawers/pos/PaymentDrawer.tsx:58).

**Lỗi có thể lọt:** focus/reconnect tự phát execute nhưng server từ chối do version cũ, hết hạn hoặc thiếu quyền; DB vẫn nguyên nên test xanh. UI vẫn vi phạm yêu cầu không tự tiếp tục, và có thể thực sự thu tiền ở trạng thái khác.

**Check bổ sung:** ngoài observer DB, ghi từng lần phát register/execute/cancel/read/list theo K và loại lệnh, không ghi token. Sau thời điểm lần thử đã kết thúc, giải phóng response muộn, đóng/mở drawer, reconnect/focus và cho chạy hai chu kỳ polling bằng đồng hồ/harness điều khiển: **0 register mới, 0 execute tự phát, 0 lần gọi print**; read/list được phép. Sau click phục hồi, request phải giữ K/loại/payload bất biến. Chạy cả fixture còn hợp lệ có thể execute thành công để tránh mọi automatic request chỉ tình cờ bị server chặn. PRE-IDEM-10/11 kiểm loại lệnh thực gửi, không chỉ tổng payment sau lỗi.

### ORA-07 — P2: E2E mock dự kiến chưa có backend sống qua reload/hai context

**Vị trí:** [proposal:255](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:255) gán mất local/khôi phục/tiếp quản cho `tests/smoke/write-operation-recovery.spec.ts`. [runtimePorts.ts:35](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:35) dựng `createSeededMockState()`, singleton dòng 38–45 chỉ thuộc module JavaScript trong trang. [mockRepos.ts:19](D:/Workspace/pos-cafe/src/adapters/mock/mockRepos.ts:19) chia sẻ state qua object trong cùng lần tạo ports.

**Lỗi có thể lọt:** hai browser context không có state server chung; reload tạo lại mock. Nếu test tự seed cùng K/result vào context B để UI tìm thấy, nó chứng minh UI hiển thị fixture, không chứng minh register ở A được phục hồi từ server sau mất local.

**Check bổ sung:** giữ test mock làm kiểm UI theo state được cấp, ghi đúng giới hạn. PRE-IDEM-13/21 và biến thể reload/đổi máy của PRE-IDEM-24 phải có lượt E2E server: B bắt đầu context rỗng, chỉ pairing/login bằng luồng hợp lệ, tìm đúng K/payload/result mà A thật sự register; không chép storage, cache hoặc payload A sang B. Nếu muốn smoke mock tự chạy luồng này, tasks phải thêm test backend chung độc lập tuổi thọ trang và kiểm cùng marker K qua reload; không gọi đó là test PostgreSQL.

### ORA-08 — P2: cần oracle độc lập cho kết quả đầu và số tiền hiển thị

**Vị trí:** proposal [dòng 208](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:208) lưu R1 để replay; [PRE-IDEM-32:245](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:245) so receipt với snapshot. Pattern UI hiện hữu dùng chính `formatVnd` để dựng expected ở [instantPay.test.tsx:6](D:/Workspace/pos-cafe/src/app/instantPay.test.tsx:6), dòng 15 và 75. Hàm SUT ở [money.ts:1](D:/Workspace/pos-cafe/src/core/money.ts:1).

**Lỗi có thể lọt:** R1 và replay cùng sai vẫn bằng nhau; cả màn hình và expected cùng dùng formatter sai hệ số/đơn vị vẫn xanh. Đây không phủ nhận các literal số tiền tốt của baseline; chỉ rõ pattern nào không được dùng làm bằng chứng độc lập cho ca mới.

**Check bổ sung:** trước lưu R1, đối chiếu với fixture viết tay và query DB thô; lưu bản sao bất biến của phần kết quả nghiệp vụ. Không dùng `snapshotDraftItems`, `calculateSnapshotTotal`, `buildPayableLines`, `makeTicket` hoặc formatter sản xuất để tạo expected. Ví dụ bắt buộc cho PRE-IDEM-24: tổng literal 100000; phần cũ quantity=2/unitPrice=30000; phần mới quantity=1/unitPrice=40000; option 0đ vẫn có ID/name/quantity; có ánh xạ riêng để chọn cũ/mới. Sau hai fixture split, dùng literal 30000/70000 và 40000/60000, đồng thời kiểm số dòng, ID nguồn và payment, không chỉ cộng thành 100000.

Với PRE-IDEM-25, thực sự đổi **tên** món và option ở catalog cùng lần đổi base/phụ thu, rồi ghi chú/giảm số món; expected vẫn là tên snapshot cũ, quantity option=2, giá option=5000, tổng 80000 rồi 40000. Nếu chỉ đổi giá, assertion “giữ tên” không phát hiện việc đọc tên mới từ catalog. PRE-IDEM-32 dùng fixture receipt có tên modifier xác định, đòi chuỗi `Tên topping ×2`, literal tiền hiển thị theo UI contract và số lần in; không dựng expected receipt bằng hàm in của app.

## Truy vết thực thi cần cụ thể hóa

Không cộng mỗi hàng PRE-IDEM thành một test duy nhất. Bảng dưới chỉ nhóm các ca đã rà, **không thay thế** requirement/UC/TC matrix theo SPEC-STANDARD.

| Nhóm PRE-IDEM đã rà | Điều cần giữ khi tách TC |
| --- | --- |
| 01–05 | Tạo bàn/mang đi; update/void-open; pay; split; void-paid là fixture riêng. Kiểm R1 bằng số/ID/trạng thái trước so replay. |
| 06–08 | Tách từng RPC/nhánh hợp lệ, register/execute cạnh tranh, từng biến thể mismatch, execute không đăng ký và register-only. Áp ORA-04/05. |
| 09–13 | Hai nhánh clamp là hai TC; lost ACK sau commit và request chưa tới server là hai fault khác nhau. Áp ORA-06/07. |
| 14–15 | Mỗi RPC × stale/NULL với positive control, rollback và rejected đã lưu là các TC riêng. Áp ORA-03. |
| 16–18 | Ba mốc TTL × lệch giờ client; hai thứ tự chờ khóa; retry không gia hạn và qua nửa đêm. Không để đồng hồ mock thay kiểm wiring DB đã yêu cầu. |
| 19–23 | Đơn cũ/lệnh cũ/result cũ; hai bên thắng cancel; not-found trước register muộn. Mỗi terminal state phải có ID/trạng thái và zero business delta phù hợp. |
| 24–26 | Tách 100000, cùng modifier 0đ, 107000, dấu cộng 65000, split cũ/mới, giảm đúng phần, cấu hình bằng tổng, giá quay lại 95000, ACK sau đổi menu; note/giảm với option quantity=2; tăng/giảm giá hoặc chỉ option đổi khi version đơn không đổi. |
| 27–30 | Từng endpoint × caller/cửa hàng/quyền, takeover pending/applied, hai xác nhận K độc lập, overload/helper/DML. Không gộp toàn bộ quyền vào một ca admin thành công. |
| 31–32 | Từng input âm/biên và từng lỗi; full UI so với direct split-full; receipt lịch sử so với trạng thái hiện tại và chủ động in. Áp ORA-06/08. |

Fixture quyền cần ma trận cụ thể theo loại lệnh: A chỉ có create/update, B payment, C void-paid như [proposal:206](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md:206) chưa đủ để suy B được tiếp quản một **submit** do A đăng ký ở PRE-IDEM-13. Analyst phải chỉ rõ K loại payment khi B takeover, hoặc dùng B có quyền đúng loại ở fixture khác; không cấp admin cho tất cả để test chạy qua. Quyền read/replay của C cũng phải được cấp tường minh theo contract mới. Đây là fixture cần hoàn thiện, không phải yêu cầu quyền mới của người dùng.

Mỗi TC âm phải ghi **đúng tầng lỗi**: schema/register, execute nghiệp vụ, DB authorization hay transport. App hiện chỉ có các code ở [appError.ts:1](D:/Workspace/pos-cafe/src/core/appError.ts:1); mapping Supabase chưa biết code mới sẽ rơi về fallback ở [errors.ts:49](D:/Workspace/pos-cafe/src/adapters/supabase/errors.ts:49). Design cần code/message/status/state-after-error và TC chạy xuyên RPC → adapter → UI. Không chấp nhận `.rejects.toThrow()` hoặc một exception bất kỳ làm bằng chứng mismatch/expired/price-change đã đúng; lỗi cast UUID, `UNKNOWN` hoặc lỗi fixture có thể che nhánh đó. Expected cho code mới chưa tồn tại phải được khai báo trong design, không được reviewer tự ghi thành code hiện hữu.

## Phần việc của analyst và phần cần người dùng

**Analyst có thể làm tiếp ngay:** hoàn thiện contract/schema/error; tách TC/biến thể, literal oracle và positive control; sửa thiết kế runner/preflight/manifest; chọn cách dựng/reset DB test, barrier, observer, clock và fault injection; phân loại đúng mock so với DB; ghi các check trên vào tasks và traceability. Không cần hỏi lại mảng/object/null đã chốt, full-selection routing đã chốt, giá/modifier đã chốt, hay yêu cầu người dùng tự thiết kế giao thức xác thực.

**Chưa xác minh trong lượt này:** có sẵn DB test nào, kết nối test/fixture credential và test transport nào. Không có quyền suy “sẵn sàng cloud” từ việc baseline chạy local. Người triển khai xác minh môi trường đã được cấu hình; chỉ xin thông tin môi trường nếu thực sự thiếu khi đến bước đó, không xin người dùng gửi secret vào hội thoại/báo cáo.

**Phần vẫn cần người dùng ở đúng cổng:** duyệt bộ spec cụ thể khi analyst hoàn thiện và yêu cầu triển khai. Chỉ hỏi thêm nếu lựa chọn kỹ thuật thực sự đổi luồng sản phẩm đã chốt, như cách đăng nhập; lượt rà oracle này không phát hiện một câu hỏi nghiệp vụ modifier còn mở.

Khi code được cho phép triển khai, kiểm vài mutation có mục tiêu: bỏ guard NULL trên void-paid, bỏ execute thành no-op, tự execute khi focus, tự sort mảng, gộp dòng cũ/mới cùng option, hoặc làm formatter hiển thị sai hệ số. Các TC tương ứng phải đỏ. Chưa chạy những mutation này trong lượt rà tài liệu.
