# SEC — chuẩn bị launcher/caller v2, 16/10/2026

**APPROVE** candidate SHA256 `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782`, trong phạm vi local preparation/caller và đóng SEC-OUT-01/02 cho v2. Không có finding chặn mới. Không kết luận actor/scope online, Supabase compatibility hoặc release PASS.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/candidate-01/manifest.json`; 14 file, 115.417 B. Reviewer độc lập `/root/ci1_worker_sec`; chỉ tạo báo cáo này, không sửa candidate/source/index/review cũ hoặc chạy actual probe.

## Binding và kiểm độc lập

Tự đối chiếu hash/kích thước 14 original + 14 snapshot và 9 external prerequisites công khai: 0 sai khác. Reference thứ mười là module trong protected runtime không được đọc lại trong lượt SEC này; pin được giữ theo provenance, không nhận thành kiểm runtime mới. Ba source/caller chính:

| File | SHA256 |
| --- | --- |
| launcher v2 | `d5922503e1de275468bddf6d3f5bf1e5332ea54ae267497aa2110377c8b6755e` |
| test v2 | `e3924502a0e9ec4ddcafdf00533a11cba7f634736730c89acc69f81dc4f27b3f` |
| parent body | `8b949c85fc28e854f235074ebf419f90f5af018f0bb65b36268f647664c61825` |

So toàn bộ launcher v2 với snapshot v1: đúng một insertion `$null=` ở expression duy nhất, không có thay đổi khác. Prefix toàn bộ 11 tests cũ byte-identical sau hai thay đường dẫn source/public-fixture đã khai báo. Strict reader cũ/mới nguyên văn, parent và launcher parse 0 lỗi; UTF-16LE EncodedCommand roundtrip exact.

Receipt `tests-verification-01.json` và TAP đóng cùng pins chứng minh full suite **13 PASS/0 fail/skip/cancel/todo**, 12 pins trước/sau, 0 drift, parent locks closed. Đây gồm default/fake/public-policy và native public contexts, không phải 13 DB tests. Không chạy lại full suite.

SEC chạy chọn lọc hai tests cuối bằng Node công khai đã có `D:/tools/nvm/v24.16.0/node.exe`, heap512, concurrency2, `--test-name-pattern='native pwsh Invoke-ProbeChild emits zero|full synthetic sequence emits one'`. Giữ read locks và kiểm đúng ba pins live trên trong suốt lượt chạy. Kết quả **2 PASS/0 fail/skip/cancel/todo**, exit0; hai native pwsh synthetic children, 0 fixture file mới. Không đo UTC boundaries cho replay; đây là replay hai cases có sẵn, không cộng vào unique13. Không gọi parent/whole launcher `-RunReadOnly`, private-input metadata/bytes/DPAPI, protected Node/pg, DB/network, copy/ACL/install/Git/CI/deploy/delete.

## Đóng findings và kiểm hiệu ứng

Các đường dẫn source dưới đây có prefix `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/`.

**SEC-OUT-01 CLOSED cho v2.** `actor-probe-protected-runtime-v2/invoke-actor-probe.ps1:155` gán kết quả await vào `$null`, chặn `VoidTaskResult` trước khi coordinator trả safe dictionary. Test dòng 166–177 dùng Invoke-ProbeChild/native public child thật, assert emitted count0, exact RawStdout/exit và finally close/dispose/termination. So toàn file xác nhận không đổi guards, stdin, timeout hoặc acceptance. V1/lượt actual cũ vẫn giữ nguyên lỗi và trạng thái thiếu validated observation.

**SEC-OUT-02 CLOSED cho boundary đã nêu.** `invoke-actor-probe.test.mjs:180`–215 dùng Runtime/Inputs/Credential/Payload giả, native public child, Report/Close thật; assert đúng 1 dictionary/22fields, cleanup và observation giả hợp lệ. Test lấy đúng reader production giữa hai anchor độc nhất ở parent dòng 84–90; array negative vẫn bị từ chối. Kết quả chọn lọc độc lập PASS, không lấy last JSON hoặc bỏ output lạ để hợp thức hóa.

**Security/caps không đổi.** Launcher dòng 61–111 vẫn khóa/kiểm runtime140file/172ACL trước private inputs; dòng 112–142 chỉ DPAPI sau guards, fixed private Node/module, env clear/SystemRoot, credential qua stdin. Dòng 144–160 giữ shared90s, heap512 trong argv; dòng 162–191 giữ exact39field/count/hash/role checks; dòng 193–240 cleanup rồi safe output, UNKNOWN khi không đủ chứng cứ. Module `actor-probe-retry-v3/actor-probe.mjs` vẫn `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`: fixed bounded SELECT/READ ONLY/repeatable-read, TLS verify-full, actor postgres với superuser/bypassRLS gate, scope79stores/145auth/3Storage metadata, rollback/close. Không mở eligibility hoặc DML/DDL/business RPC/payload/full-row proof. Đây là source review; không phải online proof.

## Caller, quyền có điều kiện và giới hạn

`actor-probe-protected-runtime-v2-preparation-01/parent-body.txt:1`–2 và dòng 34–51 phân biệt legacy351115…/reviews cũ chỉ là helper/runtime provenance. Current candidate/test/SEC/EVC gate được **root đối chiếu ở ngoài trước dispatch**, không phải guard đã cài trong body. Không dùng old APPROVE thay hai review v2 mới; không coi text reference là quyền của owner.

Body dòng 28 từ chối execution02 tồn tại; dòng 35–46 pin/giữ locks hai source v2 và runtime provenance; dòng 59–67 kiểm C/D reserve30GiB, CreateNew/flush marker trước một Start ở dòng 77. Dòng 81 và 100–107 giữ caller150s + cleanup tối đa10s, attempt-all close locks; dòng 84–93 strict reader không đổi; dòng 94–128 bỏ raw output, lưu fixed stage và không retry/delete marker. Evidence budget trong body262144B nhỏ hơn tổng phase512KiB; không có quota OS/RSS được chứng minh.

Owner `call_4b7f8595c137482d88fd8ed31f9250cb` đã cho local preparation và **đúng một probe có điều kiện**. Sau khi SEC/EVC cùng APPROVE chính candidate này và root xác minh full13/no skip, pins/no drift, giữ current candidate/source/parent/receipt/hai review locks và reserve trước dispatch, root có thể dùng quyền conditional đó; không cần hỏi lặp cho hành động đã duyệt. Báo cáo SEC này riêng lẻ chưa thỏa cả hai reviews và không phải phép gọi probe của reviewer. Nếu gate thiếu, source đổi hoặc có lỗi thì dừng, không tự retry.

Current actual probe chưa có trong gói chuẩn bị này. Không lấy synthetic success thành credential/connection/TLS/actor/scope/rollback PASS hoặc đổi lịch sử execution01 UNKNOWN. Các gate Supabase/cutover/backup/recovery/hosted/full backend và push/deploy giữ nguyên, ngoài verdict preparation này.
