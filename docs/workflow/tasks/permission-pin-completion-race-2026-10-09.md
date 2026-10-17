# G2b — Hai thiết bị cùng hoàn tất đổi PIN

## Trạng thái, quyền và phạm vi

Cập nhật 09/10/2026. **Hai ordering runtime G2b, tooling, repo+targeted typecheck và preservation đã PASS trên source-02; hai reviewer non-author đã APPROVE candidate-02, finding cleanup candidate-01 đã đóng. Chưa nghiệm thu chủ dự án hoặc release.** Đây là metadata trạng thái review sau freeze; Session nguồn `01a10b60-e6db-7692-831c-584eee63cda3`. [Log kỹ thuật](../../implementation-log/permission-pin-completion-race-2026-10-09.md) ghi phép chạy, evidence và giới hạn; phần dưới giữ kế hoạch/khảo sát trước thực thi để truy vết quyết định.

Người dùng trả lời **“ok”** ngay sau đề nghị **“G2b — hai thiết bị đổi PIN đồng thời”**, khi đã nhận báo cáo đóng G2a. Các yêu cầu còn hiệu lực: scope nhỏ, kết quả chính xác, auto test và UI thật, subagent cân bằng model/chi phí, vấn đề kỹ thuật lưu trên nhánh docs, tạo session mới nếu cần để ưu tiên độ chính xác. Hồ sơ ghi quyền, không tạo thêm quyền.

G2b thực hiện hai ordering của hai complete trong bước 1 [TC-PIN-08](../../../openspec/changes/force-default-pin-change/testplan.md:76): A thắng/B thua và B thắng/A thua. Được thêm test/tooling/harness/fixture tổng hợp local riêng, chạy kiểm chứng và ghi hồ sơ. Không đổi requirement/expected, `src/`, candidate SQL hoặc grants để test xanh. Scope này không bao gồm complete/recovery, TTL−1/0/+1 ms, expiry trong lúc chờ, staleRevision còn valid hoặc đầy đủ lifecycle-generation matrix. Nếu cần sửa ứng dụng/hợp đồng ngoài tooling, chứng minh lỗi và xin đúng scope bị ảnh hưởng trước.

Không tác động hosted Supabase/Vercel, credential/dữ liệu thật, email hoặc tài nguyên trả phí. Giữ nguyên worktree dirty và các fixture đã kiểm; không reset/stash/switch/commit/push/deploy. Không có câu hỏi nghiệp vụ mới cần người dùng ở bước khảo sát này.

## Đọc tiếp và baseline

- Authoritative `AGENTS.md`, `CLAUDE.md`, [quy trình](../README.md) và [SPEC-STANDARD](../../../openspec/SPEC-STANDARD.md) trên worktree docs; [G2a handoff](permission-pin-completion-loss-2026-10-09.md), [log G2a](../../implementation-log/permission-pin-ack-loss-2026-10-09.md), [review G2a](../../reviews/2026-10-09-permission-pin-ack-loss.md), bộ artifact `force-default-pin-change` hiện hành.
- Main `D:/Workspace/pos-cafe`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs `D:/Workspace/pos-cafe-docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Khảo sát đầu G2b: 358 main/103 docs dirty entries trước ghi hồ sơ này. Kiểm lại status và freeze source thực tế; HEAD không thay cho dirty-source snapshot.
- G2a [candidate-03](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/candidate-03.json), SHA256 `13f98a1387a1b626fa14a98d86e15bed50f38bc675401120ee7c7701f9d1c149`: hai real Auth/REST/Chromium ca ACK 2/2, tooling4/4, typecheck/G1 preservation PASS, hai APPROVE khác scope. Parent đã đối chiếu 727 source entries, 16 artifact/attestation hashes và docs snapshot: không drift; live docs delta chỉ review metadata. Đây là evidence lịch sử G2a, không áp thành G2b PASS.
- G1 target `pos-cafe-perm-t04-20260916`, API59421/DB59422; G2a target `pos-cafe-perm-g2a-20261009`, API59521/DB59522/Vite5179. Không sửa graph, marker, roles, migrations, guard hoặc dữ liệu hai target này. Baseline/postflight G2b phải độc lập bảo toàn cả hai target.

## Khảo sát chỉ đọc

Hai investigator Sol/high (lock/transaction/isolation) và Sol/medium (UI/transport/evidence) đã tự đọc source, không sửa file hoặc chạy mutation. Các kết luận dưới đây là kế hoạch suy từ code, **chưa runtime chứng minh**; họ không phải reviewer cuối của implementation G2b.

| Nguồn | Hiện trạng cần đối chiếu khi thực hiện |
| --- | --- |
| [identity mutex](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:129), [identity lock](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:146) | Lấy store advisory mutex trước owner/session/catalog locks. |
| [completion](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:346) | Reread owner/session sau khóa; revoked token bị `EMPLOYEE_SESSION_REQUIRED` trước receipt lookup. Winner đổi hash/cờ/revision, revoke sessions, ghi một signal/audit/receipt ở dòng 376. |
| [runtime race cũ](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:110) | Hai direct SQL calls sau cùng barrier và `Promise.race` chọn bên thắng; chưa buộc cả hai ordering, không thay real two-device UI. |
| [required screen](D:/Workspace/pos-cafe/src/app/screens/RequiredPinChangeScreen.tsx:126) | Winner về login với “Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.”; loser session error về login với “Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.” ở dòng 139. Không kỳ vọng version conflict cho loser revoked. |
| [adapter](D:/Workspace/pos-cafe/src/adapters/supabase/permissionIdentityRepo.ts:82), [store](D:/Workspace/pos-cafe/src/app/useAppStore.ts:68) | Credential/context được clear khi complete terminal; generation guard và `setCurrentEmployee(null)` chặn authority cũ. |
| [G2a target guard](D:/Workspace/pos-cafe/tests/supabase/permissionPinAckEnvironment.ts:32) | Hardbind profile/project/ports; graph dòng 81 chỉ nhận tối đa hai quán tên G2a ACK A/B. Không đổi guard hoặc thêm graph G2b vào target G2a. |
| [Auth pairing](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:34), [G2a browser](D:/Workspace/pos-cafe/tests/supabase/permissionPinAckLoss.spec.ts) | Thiết bị B phải pair thật bằng Store Key memory-only và login restricted từ UI. Direct second start của G2a không thay two-browser coverage. |

Root đã đọc ports/resources: WSL báo khoảng 13.268 MiB available, 46 container entries; các cổng 5962x/5180 chưa xuất hiện trong lần đọc `ss`. Đây chỉ là khảo sát, không reservation hoặc health gate. Các service G1/G2a có thể vừa tự khởi động khi WSL được gọi; Edge của cả hai đang exited15. Không nhận health-starting/WSL shutdown là lỗi ứng dụng; không tự sửa/dừng/start Edge cũ cho G2b.

## Quyết định thực thi

### DEC-G2b-01 — Target riêng và session mới

AI chọn project/profile/port block/volume/network/marker G2b riêng, database trống activate bằng nguồn hiện hành; hai quán blank `seedDemo:false`, mỗi quán phục vụ một ordering. Target/port cuối **chưa được tạo**; khảo sát lại rồi ghi giá trị thực tế. Có thể dùng mẫu G2a nhưng không chạy prepare/reset trên hai target cũ hoặc nới guard của chúng. Network/ports chỉ loopback, services/config/CLI/images/migrations/activation/contract/API↔DB/owned graph phải được guard trước mọi mutation.

Lý do: guard G2a gắn với graph/evidence đã kiểm, còn reset/đổi tên nó trộn kết quả cũ và dữ liệu mới. Target riêng cần thêm tài nguyên local; máy hiện có dữ kiện khả thi để khảo sát tiếp, không chi phí cloud. Nếu không thể cùng tồn tại mà cần dừng/sửa target cũ hoặc mở dữ liệu/quyền/chi phí, hỏi phần đó trước.

Mở session mới theo quyền “nếu cần”, vì concurrency cần đồng bộ SQL wait graph, hai browser contexts và thứ tự ACK trong hội thoại nguồn dài. Đây là chuyển task đang làm, không tuyên bố bàn giao hoàn tất.

### DEC-G2b-02 — Buộc winner bằng wait graph, không dùng lịch chạy

1. Controller `BEGIN`, `SELECT` đúng owner `FOR UPDATE`; **không lấy store mutex**.
2. Forward completion của thiết bị được chỉ định thắng. Observer tìm đúng một backend đã giữ granted advisory mutex của đúng store/database và bị controller chặn trên owner/transaction wait.
3. Forward completion bên còn lại. Observer xác nhận backend thứ hai đang chờ cùng mutex, `pg_blocking_pids` chỉ ra blocker là winner. Trước nhả controller: hai request thật đã vào DB, đều chưa terminal, state/evidence chưa đổi.
4. `COMMIT` controller: winner tiếp tục, commit và revoke sessions; loser qua mutex rồi reread state mới, trả `EMPLOYEE_SESSION_REQUIRED`. Ca thứ hai đảo vai.

Chỉ đọc PID/count/boolean/lock metadata, không xuất `pg_stat_activity.query`, token/headers/payload. Advisory bigint xác định đúng classid/objid/objsubid/database; row wait có thể biểu diễn bằng transactionid nên không bắt buộc tuple-wait. Poll có deadline để quan sát predicate, delay không quyết định winner. Nếu chỉ forward loser sau winner commit, không gọi đó là hai DB request concurrent. Kế hoạch phải được kiểm bằng runtime/negative controls trước nhận PASS; lỗi giả thuyết phải ghi và xử lý, không hạ expected.

## Hai ca kiểm chứng

Mỗi case dùng hai Chromium contexts cách ly, không chia `storageState` hoặc employee token. A tạo store từ UI, Store Key đọc vào biến memory trước acknowledge; B pair qua UI/Auth thật. Cả hai cùng owner, restricted tokens khác nhau, revision giống nhau, TTL5 phút; form proof-ready và submit đã pending trước điều phối khóa. Capture request/token/PIN chỉ memory, assertion secret dùng boolean/mã lỗi hữu hạn.

| Tiêu chí | Expected đúng scope |
| --- | --- |
| Hai ordering | A thắng/B thua và B thắng/A thua đều qua wait-graph barrier thật; không `Promise.race` chọn winner theo may rủi. |
| Commit/effects | Winner applied, loser session error; hash khớp PIN winner và không khớp temp/loser; cờ false/revision baseline+1; mọi session baseline revoked; đúng một applied audit/receipt và signal+1 thuộc request winner; loser có zero audit/receipt. Snapshot sau loser không thêm effect. |
| UI/ACK | Chủ động giữ ACK winner đến khi loser response đã render, rồi deliver ACK winner. Winner/loser đều đúng notice/login, forced form rời, không protected shell trước fresh login; một UI completion mỗi thiết bị, không auto replay. Không gọi đó là toàn lifecycle-generation matrix. |
| Old tokens/fresh login | Replay probe có chủ ý bằng cả token cũ bị session error và không thêm effects; temp/loser PIN `INVALID_PIN`; winner PIN fresh normal12h, authority đúng store/owner/revision, shell chỉ mở sau authority trên cả hai máy. |
| K/financial/seed | Pending K tổng hợp đúng schema giữ nguyên, zero auto execute/payment/receipt/print và zero extra order/payment/seed effect; đo network/print cả trước fresh authority và sau normal shell, không chỉ DB pending. |

Owner bootstrap vốn restricted, nên hai active restricted sessions là baseline thật của scope này. Chưa tuyên bố phủ riêng normal session đang active bị complete revoke; không thêm normal row tổng hợp chỉ để mở claim ngoài hai-ordering cần kiểm.

Route handlers phải settle bằng outcome/mã lỗi hữu hạn, có consumer trước khi lỗi; không unhandled rejection/raw error leak. Cleanup: giải phóng/rollback controller trước, release gates và đợi hai requests settle có deadline, đóng DB/context. Cleanup lỗi phải giữ FAIL receipt; không bỏ hook failure để nhận PASS.

## Bằng chứng, docs và review gate

- Code/test/config/tooling G2b trên main, prose/log/handoff/spec implementation pointers trên docs. Auto regression/negative control của barrier/observer/privacy reporter, native rendered Chromium Auth/REST hai case và typecheck liên quan trên cùng frozen source/lockfile. Không mock thay real UI; không bắt chạy UI audit layout mới nếu không đổi interface; không tự update audit baseline.
- Config riêng: workers1/retries0/forbidOnly/no requiredskip/expectedfailure; screenshot/trace/video off. Ghi discovery/options/lệnh/UTC/exit/body+hook/counts, runtime/config/image/migration/lockfile parity, observer wait-graph predicates, driver/reporter attestation. Giữ mọi FAIL theo source/attempt riêng.
- Source freeze và recoverable snapshot gồm file mới/tests/config/deletion markers; docs snapshot cùng final candidate. Không đọc raw private env/control/logs/backups/credential/DSN/PIN/hash/Storage URL vào model/chat/docs; script xử lý kín chỉ trả finite code/count/boolean. Reporter phải an toàn cả assertion/setup/teardown FAIL.
- Native repo Playwright tự thoát; nếu browser MCP được dùng, browser_close và dừng đúng node/cmd `@playwright/mcp` sau dùng, giữ cấu hình. Không liên kết/login dịch vụ ngoài.
- Sau code/test/docs cuối, freeze manifest; hai reviewer non-author kiểm riêng authority/transaction/fixture/privacy và coverage/UI/evidence/authorization/docs. Cả hai explicit APPROVE đúng candidate cuối, substantive edits cần review lại. Investigator hiện tại không là reviewer của phần họ tạo; APPROVE G1/G2a không áp G2b.

Chuẩn bị walkthrough barrier → hai UI requests → locks → commit → observer → login/authority; không ghi owner đã đọc/hiểu/nghiệm thu khi chưa có phản hồi. Runtime G2b đã chạy đúng hai ordering trên target riêng; [source-02](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/source-02.json), [browser safe report attempt02](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/ui-attempt-02-safe.json) và [postflight bảo toàn G1/G2a](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/old-postflight-source02-safe.json) là evidence cuối. Candidate-01/source-01 giữ làm lịch sử bị yêu cầu sửa. Metadata sau freeze: hai reviewer non-author khác scope đã explicit **APPROVE candidate-02**, SHA256 `ff3db5afc074342ce1cc0b7febca88000426903df4f05cdea4e4d45b828f99d1`; [hồ sơ verdict](../../reviews/2026-10-09-permission-pin-completion-race.md) giữ lịch sử finding và giới hạn review. Chưa nghiệm thu/release. TC08 còn recovery/TTL/staleRevision/lifecycle variants; full PIN/19TC/G3/UI audit33/release vẫn mở.
