# EVC — chuẩn bị runtime private, 16/10/2026

**Verdict: APPROVE** cho preparation local, đúng [candidate 01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/candidate-01/manifest.json), SHA256 `14d532a575b1a30a38619a736593139c124e35212b5b33b59c4cc21677eb227d`. Không có finding blocking trong phạm vi EVC. Đây là review source/recipe/evidence chuẩn bị; không cấp quyền `-Prepare`, `-Verify`, copy runtime, credential use hoặc probe/DB mới.

## Candidate và tính nguyên vẹn

Tự hash manifest; đối chiếu regular-file/bytes/SHA của **30 snapshot files và 30 nguồn hiện tại: 297.755 byte, 0 drift**. Kiểm 12 source pins trong `runtime-preparation-full-verification-02.json`: đều trùng snapshot/live. Probe module giữ SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`, không nhận phase này thành sửa/chạy probe.

Các pin quan trọng được nối đúng giữa helper, verifier, manifest, proof và recipe:

- Runtime manifest: `1408e6e8fabfd1fe4346b5d3369fbba044e57ac539d2abfc1b923bdc7235d0e4`.
- Archive qualification proof: `42d7159ef29634387cafa64e521c93485a0c00f5e129105be001515d667fd1f0`.
- Copy helper: `a0d9890785e22266c9331b5abf80fa60627d2322a3c848d36de6d53765d46430`.
- Offline program: `98b95b00ff3b06fa465f235525c7c966b854cffa75d3fb6cd3a97eb835b01577`.

## Integrity và nguồn bằng chứng

Đọc source qualifier, proof, manifest và cached publisher document. Checksum text 2.967 byte có SHA `e20ebbf68d33f42d196a7a11b8a91d422fa37b759c0a51aa4857977135cc5e95`; đúng entry `win-x64/node.exe` bằng SHA Node local `b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3`. `node-publisher-check.json` ghi tác giả lấy qua HTTPS chính thức, HTTP 200/không redirect. EVC không fetch lại HTTP hoặc kiểm GPG; không nhận checksum text thành chữ ký phát hành đã xác minh.

Archive proof có **14 package, 138 file members, 122.603 byte archive**. Qualifier yêu cầu public registry URL/name/version và SRI từ package-lock pin `85969c1c161f74e9f68563182d99d1b0ac6fb5f17f5074444f329675ffd34e18`; hash archive trước giải gzip/tar trong bộ nhớ, chặn size/bomb/link/extended record/path/case collision, rồi so exact inventory/size/SHA256 với installed tree. Không chỉ nhận tên package, số file hoặc local fingerprint thành integrity.

EVC chạy **`--check-existing-public` từ qualifier trong snapshot**, exit 0/stderr rỗng, `PUBLIC_RUNTIME_BYTES_QUALIFIED`: proof/manifest tái tạo trùng pin, **140 files/92.755.145 logical byte** (Node 92.279.112 + packages 463.780 + probe 12.253). Lệnh check không ghi proof/manifest, không tạo runtime, không đọc credential/private inputs, không import pg hoặc gọi network. Nó vẫn dùng các absolute external paths được source cố định; không coi snapshot là môi trường tự chứa.

Receipt cache EVC trước đó chỉ chứng minh archive SRI; phase này đã có phép so archive members với installed files và proof source-bound mới. Không dùng receipt cũ để giả thành installed-content proof. `pg-native` vẫn optional peer chưa cài; pg-cloudflare có trong inventory. Qualification cho fixed versions/đường dẫn hiện tại không thay actual protected-runtime resolution/offline check sau copy.

## Đọc source effectful

Đã đọc toàn bộ copy helper, offline verifier/program, public preflight và tests; không chỉ coordinator giả lập.

1. [Copy helper default/policy](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/prepare-private-runtime.ps1:4) trả PLAN trước input/effect. Policy compile fixed destination, package versions/roots, manifest/proof pins, 140 files, 92.755.145 bytes và cap 250 MiB. Structural graph nối đúng publisher/probe/lock/package SRI/member inventories với từng file mapping; không để caller override path/count/cap.
2. [Source locking](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/prepare-private-runtime.ps1:182) kiểm owner/ancestor/reparse, giữ read handles deny write/delete, hash/size toàn bộ nguồn trước target creation. Source package tree không được có extra file/link. Target phải absent, parent được chấp nhận và C/D đạt dự trữ.
3. Copy adapter chỉ tạo target mới và protected directories. DACL-only không SetOwner/elevation; current owner và đúng ba explicit FullControl principals/inheritance được kiểm lại. File CreateNew nhận security descriptor trước payload; kiểm ACL/hash/size và final inventory, close mọi handle. Lỗi giữ partial và failure stage cố định, không overwrite/delete/retry hoặc execute runtime.
4. [Offline verifier](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/verify-private-runtime-offline.ps1:10) là entrypoint cần quyền riêng. Nó lock/hash reviewed helper/program và đủ protected runtime; output allowlist/count/type, exit, timeout, close failure đều fail-closed. ProcessStartInfo dùng CreateNoWindow, Environment.Clear chỉ thêm SystemRoot, heap512, Node wait15s; không private credential input.
5. [Generated program](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/offline-runtime-check.mjs:3) khớp bytes chương trình production đã pin. Kiểm exact pg ESM entry, chặn CJS dependency resolution ra ngoài runtime trước evaluate, chặn API net/tls/DNS dùng trong graph đã khảo sát; chỉ dựng Client với password synthetic. Có check loaded CJS count dương trong verifier. Đây là targeted qualification cho source đã pin, không sandbox tổng quát hoặc chứng minh offline trên pg/runtime thật đã chạy.

## Test history và preflight

Tự hash/đọc TAP final02: **7.403 byte**, SHA `99c8e5c86a4c102644fb17149feac0a644ac1d5dd33e1b9d96f99e613c6b5f6a`, khớp receipt. **28 PASS, 0 FAIL/SKIP/cancel/todo**, 12 source pins không drift; timestamp receipt 12:34:05.505506Z–12:34:27.8660749Z. Source test cases chia đúng 7 qualifier + 15 helper + 6 offline = **24 non-native + 4 native synthetic**. Ba PS syntax checks và hai actual default plans được ghi riêng, không cộng thành ca DB hoặc thêm unique cases.

EVC chỉ replay **7 qualifier tests trong bộ nhớ từ snapshot**, heap512/concurrency2: 7 PASS/0 FAIL/SKIP/cancel/todo, exit 0/stderr rỗng. Đây là subset của 28, không thêm ca mới. Các negative cases kiểm SRI mismatch, traversal/ADS/reserved/collision, link/extended tar, checksum/prefix, missing/extra/modified installed mapping và compressed/decompressed limits. Không lặp full suite hoặc tạo native fixture trong review này vì source/TAP/receipt đã đủ.

Lịch sử initial 10 tests (7 PASS/3 FAIL) được giữ dưới receipt hồi cứu với chunk ID và hai source-history pins; không dùng làm current-source PASS. Đối chiếu history/current cho thấy env guard vẫn giữ chỉ SystemRoot; harness chuyển từ Node child_process sang đúng ProcessStartInfo/Environment.Clear của verifier. Diagnostic `sharedResolutionRejected` được thêm để chứng minh fallback bị từ chối. Không giảm guard để làm test xanh; không nhận fixture giả thành actual pg qualification. Raw TAP của lượt lỗi đầu không nằm trong candidate, nên EVC coi số lịch sử đó là record hồi cứu, không tái chứng thực riêng.

Public preflight02 dùng helper được pin/lock trước parse, ScriptBlock.Create cho đúng function/context/adapter AST. Chỉ gọi Qualify, LockSources, ValidateTarget và Close: **140 runtime sources + 4 metadata/proof/lock/publisher streams = 144 public streams**, thêm helper lock; không gọi CreateDirectories/CreateFile/Copy. Receipt02 ghi close thành công, target-new accepted, created dirs/files=0 và runtimeCreated=false. Điều này kiểm actual public read/hash/owner/reparse path, không kiểm actual destination ACL/copy hoặc offline execution. Receipt01 chỉ là lịch sử trước utility pin/lock correction, không thay current02.

## Replay, ngân sách và authority

Recipe là fixed-path/local: source tests/helper có absolute live paths; canonical Node, lock, 14 cache archives, installed files và các pins phải còn đúng. Snapshot lưu source/evidence, không chứa các runtime/cache bytes này. Một replay từ thư mục snapshot vẫn cần các prerequisite/live paths đã ghi, không hứa portability hoặc độc lập với checkout hiện tại.

EVC đo hai public phase roots (source + run/evidence/snapshot/fixtures): **121 files/571.220 logical bytes** trước file review này, dưới 1 MiB; không follow links hoặc khảo sát toàn máy. Review này dưới trần reviewer 30 KiB. Logical bytes không phải disk allocation. Runtime payload tương lai khoảng 88,46 MiB; estimate tăng 100–150 MiB/peak150–250 MiB và cap250 MiB được phân biệt với quota OS. Helper kiểm C≥30 GiB và D≥30 GiB+250 MiB trước copy. Future outer controller phải pin/lock reviewed source, marker CreateNew và timeout copy90s/offline parent30s; controller/timeout đó **chưa được thực thi**. Không nhận heap/concurrency hoặc dự trữ chương trình thành OS CPU/RAM/disk quota.

Kiểm metadata ở review: **`D:/Workspace/pos-cafe-db-probe-runtime-private` vẫn absent**. Không chạy `-Prepare`/`-Verify`, actual runtime copy/offline, private input read/decrypt, package install/download, DB/network/browser, push/CI/deploy/delete. Node sẵn có chỉ dùng làm công cụ kiểm public source/byte và test trong bộ nhớ; không execute pg thật. Chỉ tạo báo cáo này, không sửa candidate/source/index.

[Báo cáo](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-runtime-private-preparation-2026-10-16.md) và current task index giữ đúng preparation-only: owner `call_8c7d925b11ca4d56bb70055958e0237a` chưa cấp quyền create/copy runtime hoặc actual offline verifier. Candidate đủ để root trình gói execution cụ thể sau review; execution cần quyền mới và vẫn không cho credential-bearing PostgreSQL probe. Trust gaps run04 có phương án/source local, chưa CLOSED bằng actual protected-runtime evidence. Actor/scope online, database contract2, backup/recovery/cutover/backend gates và push phát hành còn mở; không thay historical FAIL bằng PASS.
