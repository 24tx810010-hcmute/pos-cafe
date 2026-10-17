# Checkpoint khởi chạy actor/scope probe — 16/10/2026

## Quyền được giao và kết quả thực tế

Owner chọn “Cho phép đúng một probe chỉ đọc như mô tả” tại `call_f16bf4f90f4f493d88891a904a741453`: protected runtime/credential DPAPI đã lưu, TLS xác thực, một kết nối và transaction READ ONLY/ROLLBACK, scope 79 store/145 auth ID/3 Storage ID/metadata, chỉ lưu counts/booleans/hash; lỗi thì dừng, không tự retry. Không DB write, push/CI/deploy/delete/install hoặc chi phí. Evidence mới tối đa256KiB trên D:/Workspace, C/D giữ30GiB; heap512MiB và child90s+cleanup tối đa10s, không quota OS.

**Đã dừng trước invocation của launcher/probe thật.** Lệnh parent được gửi đúng một lần nhưng transport PowerShell `-Command -` qua stdin trả exit0/không output; thư mục execution và marker không tồn tại sau dispatch. Đây là lỗi cách gọi script của agent, không phải lỗi kết nối Supabase hoặc credential. Chưa có actor/scope/TLS/DB online PASS mới. Chưa gọi lại probe sau khi thấy lỗi.

[Launcher đã được duyệt](permission-protected-runtime-launcher-2026-10-16.md) và hai review SEC/EVC cùng candidate SHA `351115baa9cace254b0dacccdb56845d64301c19a823c2e3fc9c01dd8a79ec7b` giữ nguyên. Launcher SHA `8ef30eaadf258fcee13595f4770339653b85730cf120cf88fce329e8ec092491`, test SHA `d134caeb827aa131330f3d6a3a0b5c02c4e5162fa391929b80fd3b43495bc439`. Module SQL/TLS giữ `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`.

## Bằng chứng và chẩn đoán có giới hạn

Evidence ở [checkpoint local](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01). [Intent](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/intent.json) ghi tool chunk `c04651`: một dispatch shell, exit0, elapsed0,578s và output rỗng. Không lấy UTC boundary trước/sau dispatch, nên không dựng timestamp chính xác hồi cứu.

[Exact attempted command](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/attempted-parent-command.txt) lưu nguyên string đã đưa vào tool, không chứa credential contents. Parent chỉ có thể gọi reviewed launcher sau khi tạo thư mục `actor-probe-protected-runtime-execution-01` và marker bằng CreateNew; không có nhánh xóa chúng. Sau dispatch và sau diagnostic, thư mục vẫn absent. Đối chiếu control flow này là căn cứ cho **0 actual reviewed-launcher invocation, 0 protected Node/pg execution, không private-input/DPAPI/DB access từ lượt này**; không suy từ thời gian ngắn hoặc exit0. Kiểm process metadata riêng đã loại process đang kiểm và không thấy launcher/probe khớp.

[Diagnostic](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/transport-verification.json), tool chunk `7a79de`, chạy đúng hai synthetic PowerShell child với [fixture công khai](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/transport-fixture.txt): có biến, function, try/catch/finally; không đọc file, credential hoặc kết nối DB.

| Case | Phép kiểm | Kết quả |
| --- | --- | --- |
| LTC01 | Fixture qua stdin `-Command -`, cùng kiểu gọi đã dùng | Tái hiện exit0/0 dòng output; đây là tái hiện lỗi, không PASS probe |
| LTC02 | Cùng fixture qua `-EncodedCommand` (base64 UTF-16LE của code) | exit0/1 JSON, SYNTHETIC_TRANSPORT_PASS, value18 |
| LTC03 | Parse full parent body và encode/decode roundtrip, không thực thi body | syntax0errors, bytes/code khớp sau roundtrip |
| LTC04 | Hash/size source launcher/test +6 external prerequisites sau dừng | 8/8 khớp; đây là post-attempt verification, không giả sample trước dispatch |
| LTC05 | Kiểm thư mục marker absent và không retry thật | absent ở các checkpoint; chỉ synthetic diagnostic sau dispatch |

[Post-stop verification](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/public-post-stop-verification.json) ghi source pins, Git branch/HEAD, dung lượng và kết quả LTC03–05. Không cộng hai transport diagnostic thành test DB hoặc cộng vào11 unique tests của launcher. Ba mốc source/runtime cũ vẫn là bằng chứng lịch sử đúng phạm vi.

## Cách sửa transport đã chuẩn bị, chưa thực thi thật

[Recipe mới](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/future-transport-recipe.json): thay stdin `-Command -` bằng `-EncodedCommand` của đúng parent body UTF-16LE, dùng PowerShell đã có. Encoding chỉ là truyền code và không bảo vệ bí mật; credential values không nằm trong argv. Diagnostic xác minh transport bằng dữ liệu giả và parse/roundtrip body; **chưa chứng minh full parent invocation hoặc DB kết nối thành công**.

Lần thật sau này phải có quyết định mới của owner sau checkpoint lỗi; thay reference cũ bằng reference mới, kiểm source/reviews/external pins và giữ read lock launcher, C/D reserve30GiB, đích execution vẫn absent, CreateNew marker trước một child. Reviewed launcher tự qualify/lock đủ140runtime files trước private inputs. Giữ nguyên SQL/TLS/scope/rollback, một kết nối, heap512MiB, child90s+cleanup10s. Parent wait150s/cleanup10s là lớp chờ bên ngoài, không OS quota; không thay child budget đã duyệt.

Không tự thực thi lại dựa trên exit0 hoặc việc chưa có kết nối DB: điều kiện owner “có lỗi thì dừng, không tự retry” được giữ. Chỉ cần owner quyết định invocation mới, không cần tạo/copy runtime hay cài gói thêm.

## Handoff và giới hạn báo cáo

- Phần preparation launcher hoàn tất và11/11 local checks vẫn giữ; lỗi mới thuộc transport parent, không sửa launcher/test hoặc giảm gate.
- Lượt này **chưa kiểm credential/actor/scope/online compatibility**. Supabase legacy/contract2 và các gate backend/backup/recovery/hosted vẫn chưa được khép; chưa đủ điều kiện push/deploy.
- Có thể đưa vào báo cáo: runtime offline và launcher local đã có bằng chứng; lần online actor/scope chưa chạy do lỗi khởi động đã tái hiện. Không ghi DB online PASS.
- Source/evidence nhỏ nằm trên D; không đo allocation vật lý, không coi logical bytes là disk allocation. Giữ runtime/private inputs/evidence cần dùng, không xóa hoặc đề nghị dọn chúng khi vẫn cần. Không UI hoặc Playwright trong lượt này.
- Chờ hai review độc lập SEC/EVC trên frozen checkpoint trước bàn giao; reviewer không được gọi parent/launcher thật, private inputs/credential, protected Node/pg hoặc DB. Chỉ sửa metadata review sau freeze.

## Metadata review và closeout

SEC và EVC cùng **APPROVE checkpoint dừng/chẩn đoán** candidate01 SHA256 `8ae45dd05899bcb037fac9b401cdbe139539e263665f2c6ac9b52692922f1f79`, 11 files/101.427 B +6 external refs, không findings cần sửa. [SEC review](permission-probe-launch-transport-sec-review-2026-10-16.md) SHA `feb00a0b2856e5ab3648498680868cbe01aff1e80b2d323e0ef5e71df9f5556e`; [EVC review](permission-probe-launch-transport-evc-review-2026-10-16.md) SHA `3d4f428fe275bd567754c03a743c75fbb12c0d00bef57c9e438eeaa8999af8b4`. Reviewer chỉ public hash/parse/encode, không gọi parent/launcher, child mới, private input hoặc DB. Không mở quyền invocation mới hoặc nhận actual DB PASS.

[Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/closeout.json) giữ source/review pins, Git HEAD/staged và dung lượng. Metadata này supersede dòng chờ reviewer trong frozen body; các source/evidence/snapshot không đổi. Checkpoint hoàn tất; **chờ quyết định mới của owner trước invocation thật bằng transport đã chuẩn bị**. Giữ lỗi-dừng/no-retry, chưa push/CI/DB write/deploy/delete.
