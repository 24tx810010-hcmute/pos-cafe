# Review EVC — khảo sát tương thích online,16/10/2026

Reviewer độc lập kiểm bằng chứng/source và độ đúng của gap assessment; không tham gia tác giả candidate. Vòng01 chỉ đọc/hash/parse local và source; vòng02 thêm pure fake-adapter tests/default-plan/syntax check của helper đã được giao. Không gọi database/network/browser, chạy application/backend tests hoặc runtime, cài gói, CI/push/deploy/delete, đọc private input hay sửa candidate/index.

## Candidate01 — APPROVE phạm vi khảo sát tại checkpoint

Manifest [candidate-01/manifest.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/candidate-01/manifest.json), SHA256 **fe4c88755ec47b9b889df3cf02928980cb10c80d1aa9dbc87faa306e75cfca5f**: **49tệp/726.268bytes**. Tự kiểm mọi snapshot SHA/bytes và source tương ứng;0mismatch/0live drift tại lượt kiểm.

### Bằng chứng đã đối chiếu

- Tự giải mã lại raw MCP result arrays và so từng JSON array với bản normalized: **20/20 khớp**. Query names/text trùng ba query input files;6+10+4queries, PASS và không isError. Đọc toàn20queries: chỉ SELECT catalog/metadata/count, không business RPC hoặc SQL mutation. Hai identity requests độc lập ghi actor `supabase_read_only_user`, transaction_read_only=on, PostgreSQL17.6. Batch gap không có identity query riêng; không nhận các request này là cùng transaction hoặc snapshot khóa nhất quán.
- Tự đọc/hash **12SQL source** và extract lại declarations; khớp **20table names/54public routine names**. Gap receipt ghi20table absent;17persistent và3legacy bridge tách đúng. [Controller steps:49](D:/Workspace/pos-cafe/scripts/permission-activation-steps.mjs:49) thực sự drop ba bridge tables.45routine names absent,9present có overload_count1; presence không được gọi là signature/body/grant hoặc semantic compatibility PASS.
- Counts79stores/158employees/83orders/70payments/0write_operations/145Auth/1bucket/3objects và tổng158role rows khớp raw→normalized→summary. Catalog có4Storage policies và12publication rows. Báo cáo không dùng counts làm selector/identity/full-row equality/backup/quiescence; generic overrides/outbox null không bị nhận nhầm requirement gaps.
- Đọc source references quan trọng: authRepo require contract2/write1; identity SQL công bố2/1; prepare cần settings/body cùng REST routing proof; signals SQL bỏ raw public routes trong publication rồi thêm hai signal tables; controller giữ transaction/locked recheck/rollback; profile registry rỗng và dispatch trust/action vẫn chặn. [Design:195](D:/Workspace/pos-cafe-docs/openspec/changes/redesign-permission-model/design.md:195) ghi gateway verify_jwt=true và dòng196 public verify_jwt=false riêng GET published; báo cáo không đảo hai profile hoặc tuyên bố deployed JWT đã kiểm.
- `ui-observations.json` là sanitized author record từ accessibility observations, không screenshot/raw provider API/version proof. Báo cáo ghi rõ provenance/giới hạn này: Edge list empty; Vercel Production commit5156820/main và docs PreviewError; không suy Ready là frontend mới tương thích, không suy docs push là không deploy, không nhận env/secret/all-alias binding đã xác minh.

### Findings và giới hạn

**Finding chặn:0.** Đề xuất không chặn EVC-N01: anchor `cutover:550` ở phaD dẫn condition strict postflight; đổi sang dòng553 nơi `executeCutoverTransaction` bắt đầu để dẫn trực tiếp phần transaction. Không ảnh hưởng kết luận fail-closed.

Candidate01 giữ **BLOCKED/actual application tests0/mutations0**, chưa xử lý xong database compatibility. Target strategy PENDING tại freeze01, không tự chọn project mới/cũ hoặc tạo executable apply package. Sau đó điều phối thông báo owner chọn giữ project hiện tại; cần candidate02 ghi đúng quyết định và review delta trước bàn giao cuối, không sửa lịch sử01.

**APPROVE candidate01/hash trên cho tính đúng của khảo sát ở checkpoint đó.** Không độc lập lặp online queries/UI; không xác thực token/helper credential/DPAPI store hoặc toàn bộ hoạt động OS/network; không thử REST/Auth/permission/Storage/Realtime/backend. Phép kiểm local xác nhận receipts/source/conclusions nhất quán, không là provider capability, backup/recovery, full-schema semantics hoặc quyền push/write/deploy.

## Candidate02 cuối — APPROVE

Manifest [candidate-02/manifest.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/candidate-02/manifest.json), SHA256 **7b3f7ee368dac71e4f3d876bdfeace3a92f262ef022baf521ee5bc8647a8ed76**. Tự kiểm **68tệp/989.488bytes**, mọi snapshot/source SHA và bytes khớp, không mismatch. Đọc delta báo cáo/quyết định/H0/provider summary, inventory handoff, năm source fixture, actor-probe và receipts/index; không sửa chúng. EVC-N01 **CLOSED**: anchor mới `cutover:553` trỏ đúng hàm transaction.

### Sáu query bổ sung và quyết định

- Tự đối chiếu6queries-provider với raw online-provider và giải mã lại từng array so normalized: **6/6 khớp**, statusPASS/isErrorfalse, target đúng/readOnlytrue, toànSELECT catalog. Các hash raw/normalized của cả4batches khớp summary-current; tổng **26queries=6+10+4+6**, không phải26backend tests hoặc một snapshot transaction.
- Tự tính được **53owners**:27auth/supabase_auth_admin,8storage/supabase_storage_admin,17public+1private/postgres; **7role rows/15schema privilege rows/58FK rows/39user triggers/5extensions**. Arrays/owner-counts trong summary khớp receipt. Có metadata rolepostgres NOSUPERUSER/BYPASSRLS và CREATE public/private/extensions, không CREATE auth/storage; kết luận không suy đã kết nối bằngpostgres hoặc đủ/thiếu toàn bộ ALTER-policy/DDL privileges là đúng. `connectedAsPostgres=false`, `ddlRehearsed=false`, profile chưa certified được giữ.
- Quyết định mới chọn giữ đúng project hiện tại, chỉ chốt hướng chuẩn bị. Candidate01/gap-summary PENDING được giữ như lịch sử; summary-current và báo cáo hiện hành ghi KEEP_EXISTING_PROJECT. Quyết định không được diễn thành quyền đọc credential direct, chạy probe, cleanup, SQLwrite, CI hoặc publish/deploy. Quyền dùng kênh có đặc quyền vẫn phải hỏi riêng.
- Handoff kiểm kê được relay đúng SHA a477a6178528fa393d2fb21837982c975d73780aaada547508544a6dbe0996fa; closeout SHA e4e11c99a38333601abe0dc6d1940b8f12284a10b624820ba5e9635fbb368e79 và hash hai review khớp, cả hai APPROVE đúng candidate đó. EVC này không chạy lại toàn1.471file source hoặc gọi handoff là full privacy/payload approval. Snapshot omissions825/841changed được ghi đúng.

### Fixture pattern hits

Đọc [SEC delta](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-online-compatibility-secret-screen-2026-10-16.md) và tự parse TypeScript AST năm source snapshot bằng TypeScript có sẵn, không import/chạy các tests đó. Áp lại năm regex pattern được công bố cho đúng năm source: **7occurrences=4credential-URL+3secret-assignment**, ở đúng dòng SEC nêu; không có private-key/JWT/provider-token hit trong các source này. Mọi matched value là string literal trong mock session, negative parser input, fake Error/redaction hoặc local refresh fixture/expected output. Kiểm mock/helper/caller/assertion context; matched values đã được che trước khi in context, không in/lưu chúng.

Kết luận CLEAR_SYNTHETIC_FOR_REVIEWED_HITS có căn cứ cho đúng các hit này; không biến thành toàn file/payload/history sạch secret.125raw/evidence docs chưa được đọc; thiếu assurance không tự là leak hoặc yêu cầu rotate/xóa/history rewrite. Bản inventory cũ không bị ghi đè; source bổ sung có bytes/SHA trong online candidate02.

### Probe local và kiểm độc lập

Đọc cả helper effectful branch, launcher và plan/test source. SQL là các hằng cố định: identity, store IDs, Auth IDs, Storage metadata trong REPEATABLE READ READ ONLY; giới hạn80/146/4 có một hàng dư để phát hiện ngoài exact79/145/3. Probe so exact approved/preserved IDs cùng bucket/path/version/size; không đọc object bytes hoặc nhận metadata size thành payload/full-row/backup proof. Luồng lỗi vẫn thử rollback/close; không được xuất success nếu chúng lỗi. Output chỉ whitelist status/count/boolean/hash, cleanupEligible=false.

Default-plan trả trước private-input/credential/dependency load. Nhánh tương lai dùng host/port/database/username cố định, moduleSHA trước DPAPI, owner/ACL/reparse và scope/CA pins, inherited-env clear, stdin credential handoff, verified TLS/actual identity cùng timeouts. Đây là kiểm source; ACL/hash inputs thực, credential, TLS certificate, actual actor/unfiltered scope chưa được thử. Cờ RunReadOnly/approval-reference không tự tạo human authorization.

Tự chạy lại bằng Node24.16.0 có sẵn, cwd `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe`:

`D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-concurrency=2 --test-reporter=tap actor-probe.test.mjs`

**12PASS/0FAIL/0SKIP/0cancelled,exit0**; stderr rỗng. Chạy Node `--plan` và PowerShell launcher mặc định đều exit0, PREPARED_OWNER_APPROVAL_REQUIRED, credentialRead=false/connectionAttempted=false/cleanupEligible=false. PowerShell Parser.ParseFile báo0syntax errors. Không dùng RunReadOnly hoặc nhánh kết nối, không đọc private inputs. Bốn source hashes trước/sau không đổi, khớp root receipt; module SHA cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e, launcher SHA5ea040b564dc8079360dee2aab182fdb1c3035180f2d6809c7384a4ac8a41d67.

Root receipt12tests và raw filename `.tap` dùng spec reporter đã được ghi đúng; lượt EVC chạy TAP riêng không đổi định dạng root evidence.12cases này riêng probe, không cộng vào33worker cases lịch sử hoặc full gates. Đã đối chiếu local Markdown links trong candidate, không missing file; hai dòng index chỉ relay phạm vi hiện hành.

**Finding chặn:0. Finding không chặn còn mở:0. Verdict: APPROVE candidate02/SHA7b3f7ee368dac71e4f3d876bdfeace3a92f262ef022baf521ee5bc8647a8ed76 trong phạm vi khảo sát read-only và chuẩn bị probe local.** Database/application compatibility vẫn **BLOCKED**, application/backend tests0, actual privileged probe0. Chưa có full-source/publication/privacy/history assurance, provider-qualified control/backup/recovery hoặc runtime/online postflight. Review không cấp quyền sử dụng credential/direct channel, DBwrite, push, CI, deploy hoặc delete.
