# EVC — private input setup, 16/10/2026

**Verdict: APPROVE** cho hồ sơ lượt setup đã dừng và proposal v2, đúng [candidate 02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-02/candidate-02/manifest.json), SHA256 `274a5fe18e4c4fd1ef54f4bd8b1343f3dbb96f8302023fadf46dc5ab6aec1073`. Không có finding blocking còn mở trong phạm vi này. Đây là review độc lập của EVC, không phải quyền chạy setup/probe mới hoặc xác nhận database compatibility.

## Identity và tính nguyên vẹn

- Tự tính SHA của manifest; đối chiếu cả 21 file snapshot và 21 nguồn hiện tại theo bytes/SHA trong manifest: **154.090 byte, 0 mismatch**. Kiểm lại snapshot sau replay: 0 file đổi.
- Candidate 01 → 02 chỉ đổi walkthrough thành 11 kịch bản (2 positive/9 negative), bổ sung original `actor-probe.mjs` làm dependency cho phép so byte trong test, và đổi freeze helper tương ứng. Sáu file proposal v2 và các receipt giữ nguyên bytes. Dependency bổ sung có cùng SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e` với module v2.
- Đối chiếu v1 → v2: module, launcher và test probe giữ nguyên; setup chỉ đổi owner predicate, resolve/truyền TrustedInstaller SID. Setup v1 SHA `3fce5e68718b21b746f10a1bc88527780d50f395e03fd1e3c06200c39508a4e0`; v2 SHA `d328951b5e1762980ddb686dfd743640c5345ac79f9730eaa21f121d1ccfdd88`.

## Kết quả đối chiếu bằng chứng

1. `intent.json`, `setup-invocation.json`, `setup-invocation-provenance.json` và `setup-result.json` thống nhất approval reference `call_f7a2cc88b3bb46b287bada7a30597905`, source v1, đúng một setup invocation, bắt đầu 04:28:20Z, elapsed làm tròn 512 ms, exit 1, `PRIVATE_COPY_FAILED/PRIVATE_COPY_REFUSED`, directory/files/copied bằng false/0/0 và new probe bằng 0. Provenance ghi rõ executable, argv với `-Prepare`, cwd và nguồn là root tool trace được ghi lại sau đó; EVC đối chiếu các record, không thực thi lại invocation hay coi provenance là trace stage độc lập.
2. Kết quả generic không xác định Validate/LockSources stage và không chứng minh mật khẩu/TLS/SQL. Owner diagnosis sau lỗi là bằng chứng metadata riêng: trong 6 chain chỉ owner class TrustedInstaller tại drive-root C bị v1 từ chối; mọi entry còn lại được policy chấp nhận và không reparse. Destination được ghi nhận không tồn tại. Báo cáo phân biệt đúng receipt lỗi với chẩn đoán sau lỗi, không nâng thành SQL PASS.
3. Đọc [owner predicate thực](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v2/setup-private-inputs.ps1:37): reparse bị từ chối trước owner check; ngoại lệ chỉ nhận directory chính xác `C:\`, là ancestor không phải leaf, với SID TrustedInstaller được resolve local từ account cố định. SID rỗng/resolve lỗi không mở quyền. Private root/scope directory và input leaf vẫn bắt buộc current user; destination ACL không thêm principal.
4. Đọc cả phần effectful adapter, không chỉ coordinator giả lập. [Context và Validate](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v2/setup-private-inputs.ps1:94), source read-lock/pins, protected ACL, `CreateNew`, kiểm ACL trước payload, kiểm hash/length sau copy, close và giữ partial output giữ nguyên so với v1. Không có nhánh đổi C ownership/ACL, overwrite, delete, giải mã credential hoặc kết nối DB trong setup. Chỉ credential CLIXML được DPAPI bảo vệ; scope JSON và CA là byte plaintext được bảo vệ bằng ACL khi copy, không gọi cả ba file là encrypted.
5. `v2-owner-metadata-verification.json` gắn đúng SHA v2 và ghi 6 label đều owner/reparse PASS; không private bytes, DPAPI, ACL mutation, copy/setup hay DB. EVC xác minh receipt và source binding, **không tự chạy lại metadata trên private paths**. Sáu check này không thay actual protected-copy/launcher/DPAPI/TLS/actor proof.

## Replay độc lập từ snapshot

Chạy trực tiếp tại `candidate-02/main/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v2`, dùng Node có sẵn `D:/tools/nodejs/node.exe` v24.16.0:

```text
D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2 actor-probe.test.mjs retry-preparation.test.mjs
```

**19 PASS, 0 FAIL, 0 SKIP, 0 cancelled/todo; exit 0, stderr rỗng.** Gồm 18 test cũ và 1 test mới với 11 kịch bản owner chain; không cộng replay thành số ca mới. Test mới trích chính hàm `Assert-OwnerPath` bằng PowerShell AST, mock Get-Item/Get-Acl: 2 positive và 9 negative, phủ TI ở nonroot/private leaf/Droot, owner lạ ở Croot, required leaf owner sai, SID chưa resolve, reparse, root không phải directory và root được truyền như leaf. [Test source](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v2/retry-preparation.test.mjs:84).

Tự parse hai script PowerShell: 0 lỗi. Chạy hai default mode từ snapshot: setup trả `PREPARE_PLAN_OWNER_APPROVAL_REQUIRED`, privateInputsRead/aclChanged/credentialDecrypted/databaseConnected=false, copiedFiles=0; launcher trả `PREPARED_OWNER_APPROVAL_REQUIRED`, connectionAttempted/credentialRead=false. Test/các script chỉ dùng fake adapters, source công khai và default plans; không truyền `-Prepare`/`-RunReadOnly`.

## Giới hạn và bước kế tiếp

[Báo cáo nguồn](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-input-setup-2026-10-16.md) giữ đúng stop-on-error: setup v2 **NOT_RUN**, actual private copy/ACL mutation/probe mới chưa có bằng chứng, cần owner cấp quyền mới trước retry. APPROVE này đủ cho root trình proposal cụ thể sau SEC/EVC; không tự kích hoạt lượt chạy.

EVC không đọc private input contents/hash, giải mã credential, đổi ACL thực, tạo thư mục private/copy, mở network/DB/browser, install, CI, push, deploy hay xóa. Không chạy lại backend/business gates. Các giới hạn full-row/payload/backup/recovery/cutover/Vercel vẫn còn; 19 pure tests và 6 metadata receipt không chứng nhận các gate đó. Báo cáo này không sửa candidate, source, task index hoặc review cũ.
