# SEC — checkpoint probe qua protected runtime, 16/10/2026

**APPROVE** candidate `6b41652d59d43b6e00861332759ec10f8c7ac4fd3a77eb4a1521edb9c3ae8423`, chỉ cho hồ sơ thực thi đã dừng, chẩn đoán local và đề xuất chưa áp dụng. Không có finding chặn checkpoint này. Đây không phải APPROVE launcher v1 để chạy tiếp, actor/scope online, release hoặc quyền thử lại.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/candidate-01/manifest.json`; 16 file, 118.383 B. Reviewer độc lập `/root/ci1_worker_sec`, không sửa candidate/source/index hoặc các review cũ.

## Bằng chứng và giới hạn

- Tự kiểm manifest SHA, kích thước/hash cả 16 original và 16 snapshot, cộng 5 external prerequisites công khai: 0 sai khác. Không đọc lại reference thứ sáu tại protected runtime; pin đó là provenance của parent receipt, không phải phép kiểm runtime mới của SEC. Launcher/test/module khớp `8ef30e…2491` / `d134ca…c439` / `cb3d13…f48e`.
- Đọc toàn parent body, launcher, module, tests và evidence chẩn đoán. Parse parent không lỗi; 9.085 ký tự, EncodedCommand 24.228 ký tự, UTF-16LE roundtrip exact. Chỉ parse/encode, không thực thi parent hoặc whole launcher.
- Replay độc lập diagnostic đã lưu, đổi duy nhất đường dẫn source trong bộ nhớ sang frozen snapshot. Chỉ trích năm function AST; Runtime/Inputs/Credential/Payload đều giả, child là pwsh công khai. Hai native synthetic children: trước suppress có 2 objects (`VoidTaskResult` + `OrderedDictionary`), JSON array bị parent schema từ chối; sau `$null=` trong bộ nhớ có 1 dictionary, được reader chấp nhận. Cả hai handlesClosed/processDisposed=true, termination=CONFIRMED. Đây là replay hai scenario, không cộng thành unique tests mới hay DB cases. Không đo UTC boundaries cho replay; 0 fixture file được tạo, không có receipt bổ sung ngoài báo cáo này.
- Không gọi `-RunReadOnly`, private-input metadata/bytes/DPAPI, protected Node/pg, DB/network, copy/ACL/install/Git/CI/deploy/delete. Không đổi bất kỳ file source nào.

## Đánh giá checkpoint

Nguồn dẫn dưới đây đều ở `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/`.

1. **Đúng một launcher thật, quyền đã dùng.** `actor-probe-protected-runtime-launch-02/parent-body.txt:26` từ chối target tồn tại; dòng 54–59 tạo/flush CreateNew marker trước một `Process.Start` ở dòng 68. Marker, transport và execution receipt cùng bind approval `call_ca7dd7f1f37d4c48a492f0ab56230e59`. Receipt ghi start thật, exit0, không timeout, termination/dispose confirmed và parent locks closed. Source không có retry hoặc xóa marker. Đây là bằng chứng về launcher/parent; không chứng minh process DB bên trong đã đóng hoặc rollback.
2. **Thiếu validated observation được ghi trung thực.** Parent dòng 75–84 chỉ nhận dictionary đúng 22 fields/status; dòng 85–117 bắt lỗi theo stage, bỏ raw stdout/stderr, đóng process/locks rồi lưu `EXECUTION_STOPPED`. Actual receipt không có `safeLauncherResult`, failure=`READ_SAFE_LAUNCHER_RESULT`. Runtime qualification, credential/DPAPI, Node/pg, connection/TLS/actor/scope/rollback của lượt thật phải giữ **UNKNOWN**. Exit0 hoặc synthetic PASS không thay được observation đã mất; không thể khôi phục hay khẳng định exact actual stdout từ source.
3. **Privacy và phạm vi SQL giữ nguyên.** Launcher `actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:112` đến dòng 158 giữ credential qua stdin, env clear, không đưa vào argv; dòng 162–191 whitelist report và dòng 193–240 cleanup/safe output. Module `actor-probe-retry-v3/actor-probe.mjs:10` đến dòng 18 chỉ có BEGIN READ ONLY, SELECT bounded và ROLLBACK; dòng 121–125 chỉ trả rollback/close proof sau thành công, TLS/target pins ở dòng 150–165. Đây là rà source, không nhận actual online PASS hoặc memory zeroization.
4. **Đề xuất chưa thành quyền hoặc triển khai.** Báo cáo tác giả `permission-protected-runtime-probe-execution-2026-10-16.md:48`–60 và `proposed-fix.diff.txt` ghi v2/two regressions/conditional probe là chưa được owner chấp nhận. Giữ strict reader, v1 và marker cũ là phù hợp. Cần quyết định mới trước sửa source hoặc gọi thêm; checkpoint không tự cấp quyền đó.

## Findings đã xác nhận, để mở cho phần tiếp theo

**SEC-OUT-01 — chặn lần thực thi tiếp theo bằng v1; không chặn hồ sơ dừng này.** `actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:155`: khi stdin WriteAsync hoàn tất trên PowerShell hiện tại, bare `GetAwaiter().GetResult()` phát `VoidTaskResult` vào success stream; sequence không chặn emission ở dòng 223 và trả dictionary thêm ở dòng 233. Trigger tái hiện với child public, làm `$result`/JSON thành array và parent dòng 80 từ chối. Fix đề xuất `$null=` đúng expression là đủ cho phản ví dụ đã kiểm; chỉ được áp dụng sau quyết định mới, rồi bind candidate/test/review mới. Không khẳng định đây là exact bytes/cause duy nhất của actual stdout đã bỏ.

**SEC-OUT-02 — gap kiểm chứng cần đóng khi chuẩn bị v2.** `invoke-actor-probe.test.mjs:92` dùng Child giả; dòng 145–153 native child chỉ assert RawStdout/exit/timeout/cleanup, không assert pipeline object count hoặc full coordinator → JSON → parent. Lịch sử 11 PASS vẫn đúng phạm vi cũ, chưa phủ boundary này. Hai regression tác giả đề xuất ở báo cáo dòng 52 trực tiếp xử lý gap; chưa có regression source mới hoặc PASS v2.

Kết luận giữ **APPROVE checkpoint** đúng hash trên. Actor/scope, Supabase compatibility và các gate backend/phát hành còn mở theo hồ sơ; chúng không phải claim hoàn thành của checkpoint này.
