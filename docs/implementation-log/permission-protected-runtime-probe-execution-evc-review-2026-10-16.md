# EVC — checkpoint invocation protected launcher, 2026-10-16

**Verdict: APPROVE** cho checkpoint đã dừng, đúng candidate SHA256 `6b41652d59d43b6e00861332759ec10f8c7ac4fd3a77eb4a1521edb9c3ae8423`. Không có finding blocking về binding hay tính trung thực của kết luận. Verdict này không duyệt v2 hoặc invocation mới.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/candidate-01/manifest.json`.

## Kiểm độc lập

- Đủ 16 file live/snapshot, tổng 118.383 bytes, size/SHA256 khớp và 0 drift; đủ 6 external prerequisite khớp. Đối chiếu riêng cả 12 public source pins trong execution receipt: 0 drift.
- Đọc parent body, source launcher/test đã pin, receipt/marker, diagnostic source/results, đề xuất diff, báo cáo và mục index. Launcher `8ef30eaa…2491`, test `d134caeb…c439`, module `cb3d13b4…f48e` vẫn nguyên bytes; không áp dụng diff trong memory lên file.
- Body hiện tại 9.085 bytes/ký tự, SHA256 `01d4f1e5520e48c68da267d9c75fb9bf4a41d34902acbf59d71a45d8b422def3`. Tự so với body checkpoint trước: đúng một lần thay approval reference, không delta khác. Parse 0 lỗi; UTF-16LE Base64 dài 24.228 ký tự, roundtrip ordinal khớp. Không thực thi body.
- Tổng logical evidence trước snapshot gồm hai roots launch02/execution01 và hai tài liệu là 72.283 bytes. Cộng snapshot 118.383 và allowance 40.960 = 231.626 bytes, khớp manifest và dưới trần 262.144. Đây không phải allocated disk size hoặc quota OS.

## Kết quả thật và giới hạn quan sát

Owner approval `call_ca7dd7f1f37d4c48a492f0ab56230e59` dành cho một invocation dùng nguyên v1 qua EncodedCommand. Transport receipt ghi một dispatch; marker CreateNew ghi max1/no-retry; parent body tạo marker trước Process.Start (parent-body.txt:55,68).

Receipt ghi launcher start attempted/started=true, exit0, không timeout, termination CONFIRMED và process disposed; 12 parent read locks đóng. Outer envelope nhận được và parse thành công, nhưng parent dừng tại `READ_SAFE_LAUNCHER_RESULT`; không có validated safeLauncherResult. Source tại parent-body.txt:75–88 gom các lỗi parse/schema/status trong stage này, đồng thời bỏ stdout/stderr. Vì vậy không xác định được exact lỗi đọc kết quả hay byte output thật đã nhận.

Mốc transport UTC là 14:09:18.898Z–14:09:31.319Z, hiệu 12.421 ms; receipt elapsedMs=12.419 là phép đo monotonic riêng. Root xác nhận marker UTC được lấy trước ghi dispatch file, clock monotonic bắt đầu sau ghi file; không gọi elapsedMs là phép trừ hai UTC. Khoảng parent UTC 14:09:19.4777985Z–14:09:31.2474609Z là 11.769,6624 ms; marker nằm trong khoảng này.

**Runtime qualification của lượt này, credential/DPAPI, protected Node/pg, connection, TLS, actor, scope và rollback đều UNKNOWN khi thiếu validated launcher observation.** Outer exit0/termination/dispose chỉ chứng minh thông tin ở lớp process cha đã ghi; không thay thế rollback/server/DB proof. Report giữ đúng giới hạn này, không gán lỗi credential/TLS/SQL và không nhận online PASS. EVC không tự đọc lại private input hoặc kiểm trạng thái DB để lấp khoảng trống.

## Chẩn đoán và khoảng trống test

Source [invoke-actor-probe.ps1](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:155) gọi `$write.GetAwaiter().GetResult()` mà không suppress pipeline output. Coordinator gọi adapter Child rồi trả dictionary (cùng file:223,233); top-level serialize toàn result (cùng file:262).

Receipt ghi đúng ba native pwsh children synthetic, không phải ba probe DB:

1. Diagnostic hẹp ghi một `System.Threading.Tasks.VoidTaskResult` thừa từ Invoke-ProbeChild.
2. Sequence dùng Runtime/Inputs/Credential/Payload giả, native pwsh child giả, Report/Close thật tạo hai objects rồi JSON array; strict parent từ chối.
3. Chỉ suppress expression trong function ở memory: sequence tạo một dictionary 22 fields, strict parent chấp nhận và resource đóng.

Đã đọc source diagnostic để xác nhận các adapter nhạy cảm là giả và observation 39 fields là fixture. Ba child không chạy launcher thật/protected Node-pg/credential/DB. Không có UTC boundaries của diagnostic; hồ sơ không dựng lại. Chẩn đoán chứng minh lỗi output có thể tái hiện và phù hợp symptom, nhưng **không chứng minh byte stdout hoặc mọi stage của invocation thật**, vì output thật không còn.

Bộ 11 tests cũ vẫn là lịch sử riêng đúng source, không phải coverage của boundary mới phát hiện. Test native trước tại invoke-actor-probe.test.mjs:145 kiểm RawStdout/timeout/dispose; fake coordinator tách native child. Báo cáo nêu đúng việc thiếu assertion emitted-object count và không cộng 11+3 thành DB cases. EVC không rerun suite hay synthetic children trong lượt review này.

## Readiness, authority và kết luận

Báo cáo/index ghi rõ EXECUTION_STOPPED, không retry, chưa actor/scope hoặc Supabase contract2 PASS; cutover/backup/recovery/hosted/full backend/push/deploy gates còn mở. Post-source/Git receipt ghi main/docs HEAD/branch và staged-entry hashes giữ baseline; hash staged entries không phải hash raw physical .git/index. EVC đối chiếu receipt và pins, không chạy Git lại.

Đề xuất v2 suppress đúng expression và thêm hai regression vẫn chưa được giao triển khai. Cần candidate/test/review mới và quyết định owner mới trước conditional probe; giữ strict reader, guard, marker/evidence cũ và no-retry. APPROVE chỉ chốt hồ sơ sự kiện và chẩn đoán, không chứng nhận v1 retry-ready.

Lượt EVC chỉ read/hash/parse/encode public artifacts; không whole parent/launcher, -RunReadOnly, private-input metadata/bytes, DPAPI, protected Node-pg, network/DB, install, copy runtime, sửa candidate/index/source, push/CI/deploy hoặc delete.

