# EVC — protected-runtime launcher preparation, 16/10/2026

**Verdict: APPROVE preparation-only**, đúng [candidate 01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-run-01/candidate-01/manifest.json), SHA256 `351115baa9cace254b0dacccdb56845d64301c19a823c2e3fc9c01dd8a79ec7b`. Không có finding blocking trong phạm vi EVC. Review này không cấp quyền `-RunReadOnly`, private-input/credential use, PostgreSQL probe hoặc DB mới.

Đã tự hash manifest và 13 original/snapshot pairs: **100.868 byte, 0 drift**. Sáu external prerequisites khớp bytes/SHA hiện tại; tám source/external pins của root replay đều khớp. Launcher SHA `8ef30eaadf258fcee13595f4770339653b85730cf120cf88fce329e8ec092491`, test SHA `d134caeb827aa131330f3d6a3a0b5c02c4e5162fa391929b80fd3b43495bc439`. Probe module cũ và bản runtime cùng giữ SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`; không đổi SQL/READ ONLY/TLS/scope/rollback.

Đã đọc toàn bộ source effectful và test, đối chiếu PLR01–07 với flow/negative controls:

- Default PLAN trả trước helper/runtime/private read. Reference/switch chỉ là guard, không suy quyền từ string.
- Runtime qualification pin/lock helper, manifest/proof/lock và byte/hash/size đủ 140 protected files. Exact tree 32 directories/172 ACL objects, owner/no-reparse/ba principals và no-extra được kiểm trước và sau file locks. **144 public streams** giữ xuyên các bước sau; private-input metadata/locks và DPAPI chỉ nằm sau runtime qualification.
- Private-input branch giữ đúng ba path, protected ACL/current owner/type/bounds, scope/CA hash pins trước DPAPI. Fixture/fake chỉ kiểm guard ordering/payload/disposal; không nhận thành actual private-input validation hoặc credential proof.
- Child exe/module/cwd đều ở protected runtime, env chỉ SystemRoot, heap512, payload chỉ stdin; một child trong sequence, stdin/exit dùng chung wait90s, cleanup tối đa hai waits5s. Đây không phải total wall-clock hard cap/OS quota.
- Success report yêu cầu exact schema/types/counts/proof flags, actor/session/database, role booleans và superuser-or-bypass visibility, hash format và scope/CA pins. Failure chỉ nhận code allowlist và bốn false proof/mutation flags; unknown/raw/secret fields bị từ chối. Success mới có connectionState CONFIRMED_ROLLED_BACK_CLOSED; lỗi child chưa có proof giữ UNKNOWN, không suy từ elapsed.
- Output được dựng sau finally. Close attempts child termination/dispose, credential/SecureString và mọi stream; cleanup lỗi không trả PASS. Flags phân biệt load/start attempted với loaded/started; call lỗi có thể UNKNOWN. Không tuyên bố immutable managed strings đã zero hóa, không retry/delete/overwrite.

Source không tự pin launcher đang chạy; future root caller phải kiểm và giữ read lock chính launcher, kiểm external pins/C-D reserve, tạo marker mới và chỉ gọi một probe sau quyền mới. Đây là prerequisite execution được báo cáo rõ, không được coi là đã thực hiện trong preparation.

Root replay source-bound 13:36:03.7248435Z–13:36:18.0364509Z ghi **11 PASS, 0 FAIL/SKIP/cancel/todo**, syntax0; lấy tám pins trước/sau, giữ read locks xuyên suite, sourceDrift rỗng/parent locks closed. Tự kiểm root TAP **3.003 byte**, SHA `657f0000808fd707440c7dcae53dcd5e51a4d0cecdbaf1cc85684056a4d2dcf3`, đúng counts và receipt.

Phân loại đúng **8 default/fake/public-policy + 3 native contexts**, không gọi cả bộ là pure/no-OS. Case3 đọc public helper/metadata thật. Ba context native là public synthetic payload/locks/SecureString, PowerShell synthetic stdin/timeout/dispose, và public runtime Lock-ProbeRuntime+Close. Preflight record 140 files/172 ACL objects/144 streams, handlesClosed=true; không gọi Inputs/Credential/Child, connectionState NOT_STARTED, không execute protected Node/pg. PLR matrix là coverage cho local slice, không phải actor/scope/TLS/DB acceptance đã chạy.

Test history được giữ trung thực: TAP01 10 PASS/1 FAIL do giả định getter SecureString.Length sau Dispose, sửa sang AppendChar để kiểm disposal; launcher không đổi qua sửa assertion đó. TAP02 11 PASS trước assertion reference guard mới trong case1; TAP03 current11PASS nhưng builder chỉ lấy hash sau suite. Root replay mới cung cấp before/after/held-lock binding. Không có đầy đủ source versions01/02 trong snapshot, không nhận PASS cũ cho bytes mới hoặc cộng replay thành22 cases.

EVC không rerun suite/base35/actual offline vì evidence/source đã đủ. Chỉ đọc candidate/public sources/receipts và hash public prerequisites, gồm byte-identical runtime module; **không đọc metadata hay bytes của private inputs thật**, không DPAPI, `-RunReadOnly`, protected Node/pg execution, DB/network/install/push/CI/deploy/delete. Không sửa candidate hoặc nguồn cũ; chỉ tạo review này.

Replay vẫn cần fixed live helper/manifest/proof/lock và public runtime theo pins; snapshot không chứa binary/cache/private inputs hoặc môi trường tự chứa. Đo hữu hạn hai phase roots: **168.121 logical byte**, cộng docs theo manifest 42.744 = **210.865 byte** trước review này, dưới 256 KiB. Review dưới 10 KiB, không tạo receipt/fixture mới; allocation chưa đo.

[Báo cáo và PLR plan](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-protected-runtime-launcher-2026-10-16.md) giữ đúng owner `call_f7792e1526f04c44a29f351267391dd5` chỉ cho hai file launcher/test local và review. Runtime copy/offline PASS trước đó không cấp quyền probe mới. Candidate đủ để bàn giao preparation và hỏi owner quyền invocation cụ thể; chưa có credential/connection/TLS/actor/scope online PASS mới, database compatibility/full gates hoặc quyền push/deploy.
