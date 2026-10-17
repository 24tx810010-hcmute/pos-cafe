# SEC review — native ACL và đề xuất private resume v3, 16/10/2026

**Verdict: APPROVE**, chỉ cho hồ sơ setup v2 thất bại, chẩn đoán native công khai và đề xuất local v3. Reviewer độc lập `ci1_worker_sec`, không viết candidate. Kết luận không cấp quyền `-Prepare`, copy private inputs hoặc probe DB.

## Candidate và nguồn đã kiểm

[Manifest candidate-01/run03](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/candidate-01/manifest.json), SHA256 **`67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b`**, 23 file/**174878 byte**. Đã đối chiếu hash/length toàn bộ snapshot với manifest và current source trước/sau kiểm: **0 mismatch, 0 drift**.

Đọc delta setup v2→v3, toàn bộ setup v3/test mới/plan, receipt run03 và hồ sơ native/provenance. Module DB (`cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`), launcher (`e6c786b31b6f203413aa281b661bf0eec4892f34a5423c5ca186a5867ca68425`) và probe tests giữ nguyên bytes. Original module cho phép so sánh/replay cũng có trong snapshot. Setup v3 SHA256 `ff6d3904021f9560904680d6e8aba43735f93ba018e74c6fed87f318446618d8`.

## Kết luận có căn cứ

1. **Lần thực thi cũ và nguyên nhân không bị nói quá.** Intent/result ghi approval `call_c5e5fed39d324541bc9680abb3fdf3d6`, đúng một setup v2, exit 1/685 ms, createdDirectory=true nhưng files/copy=0, DB probe=0. Metadata sau đó ghi thư mục rỗng, owner current user/non-reparse nhưng ACL inherited 8 rules. [Hồ sơ:7–13](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-input-native-2026-10-16.md:7) nói đúng v2 đã khóa/đọc/hash source trước khi tạo directory; không suy counters=0 thành chưa đọc bytes nguồn. Không có decrypt hoặc DB PASS.
2. **Native controls có giới hạn rõ.** [Hồ sơ:19–28](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-input-native-2026-10-16.md:19) phân biệt exception của public control với generic refusal của actual setup. Descriptor có SetOwner thất bại và DACL-only thành công hỗ trợ bản sửa; không chứng minh stage/exception thật hoặc privilege/token cụ thể. Command provenance hồi cứu được ghi đúng là hồi cứu, không giả hash đồng thời. Không yêu cầu elevation, takeown hoặc đổi owner Windows để qua guard.
3. **Resume chỉ nhận thư mục rỗng đã ghim.** [Setup:79–92](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:79) kiểm exact path `D:/Workspace/pos-cafe-db-readonly-private`, creation UTC `2026-10-16T11:17:39.2729671Z`, directory/current-user owner, ancestor policy, non-reparse và entries=0. [Adapter:151–178](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:151) kiểm lại trước/sau DACL; không tạo hoặc thay thế directory khác. Ngoại lệ TrustedInstaller vẫn chỉ non-leaf directory C-root; private leaf không được ngoại lệ.
4. **DACL-only vẫn bảo vệ trước source bytes.** [Builder:67–77](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:67) bỏ SetOwner, chỉ tạo protected DACL ba principals current user/SYSTEM/Administrators. [Checker/native helpers:94–129](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:94) kiểm current owner trước/sau, exact ba explicit Allow FullControl rules. Coordinator áp và xác minh DACL directory trước LockSources; mỗi file CreateNew có protected DACL được kiểm trước copy. Không chuyển quyền sở hữu hoặc nới ACL.
5. **Writes/handles/failure vẫn bị giới hạn.** [Setup:140–211](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:140) chỉ ba source/đích cố định, tổng 25782 byte logic; locks deny write/delete, size và scope/CA pins trước tạo file, internal credential-copy hash, verify từng ACL/hash và exactly-three-files cuối cùng. CreateNew từ chối đích có sẵn; không overwrite/delete. Close thử mọi stream. [Coordinator:11–46](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:11) giữ partial outputs và trả fixed stage enum, không raw exception/private value; close failure không nhận success. Setup không DPAPI/decrypt/DB/network.
6. **Quyền thực thi và acceptance không mở rộng.** [Hồ sơ:38,46–54](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-private-input-native-2026-10-16.md:38) yêu cầu approval mới sau stop-on-error. Probe chỉ được đề nghị khi setup verified và owner duyệt mới; review không tự tạo quyền. Chưa có actual v3 resume/copy/DPAPI/TLS/actor proof. Gate compatibility, backup/recovery, hosted profile/control, cutover/backend và release vẫn chưa hoàn tất.

## Kiểm chứng độc lập

Từ thư mục v3 **trong snapshot** chạy:

```text
D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2 --test-name-pattern="^fixed failure stages|^exact resume facts|^native DACL-only|^actual owner guard" retry-preparation.test.mjs
```

Exit 0, **4 PASS / 0 FAIL / 0 SKIP**, khoảng 8,15 giây. Phép kiểm quyết định gồm:

- Fixed-stage test: 10 failure seams, không xuất canary exception.
- Resume facts: một bộ hợp lệ được nhận, bảy trường hợp đổi path/time/type/owner/ancestor/reparse/emptiness bị từ chối.
- Owner guard thật trích AST: 11 tình huống, 2 dương/9 âm.
- Native public test dùng đúng sáu helper từ setup v3: DACL-only/owner giữ nguyên/protected 3 rules, CreateNew hai file, copy/hash khớp và collision bị từ chối. Fixture mới [409a4d40-825f-495e-927e-c709b8190817](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/native-fixtures/409a4d40-825f-495e-927e-c709b8190817), **hai file giả/48 logical byte**, nằm ngoài snapshot; không xóa.

Độc lập kiểm hai PowerShell syntax: 0 errors; hai default plans exit 0. Setup báo privateInputsRead/aclChanged/databaseConnected=false, launcher báo credentialRead/connectionAttempted=false và return trước nhánh effectful. Đã đọc receipt full replay của root [snapshot-replay-01.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/snapshot-replay-01.json): 22/22, đúng candidate SHA; đó là lần chạy của tác giả, không đổi bốn kiểm reviewer thành 22 hoặc cộng các lần thành ca mới.

Trước native fixture: C còn 203523665920 byte, D còn 103461273600 byte; sau kiểm C/D vẫn hơn dự trữ 30 GiB. Fixture tiny, không install/download/runtime mới; 48 byte là logical size, chưa đo allocation. Node heap 512 MiB/concurrency 2 không phải OS RAM/CPU quota.

## Findings và giới hạn verdict

**Finding chặn: không có. Đề xuất không chặn: không có.** Rủi ro SetOwner đã được xử lý bằng DACL-only với native verification phù hợp; không nhận thay đổi local là đã khắc phục actual private run.

Reviewer không truy cập actual private target/C private inputs, không thực thi `-Prepare`/`-RunReadOnly`, credential/DPAPI/DB/network, không sửa candidate/app/index, push/CI/deploy/delete. Không cần thay đổi quyền hoặc đọc secret để kết luận trong gate local này. Báo cáo/review cũ giữ nguyên.

**APPROVE gắn SHA `67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b`, chỉ trong phạm vi đã nêu: failed v2 + native diagnosis + local v3 proposal. Owner phải duyệt mới trước private resume và probe có điều kiện.**
