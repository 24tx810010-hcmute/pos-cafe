# EVC — chuẩn bị mốc Git minh chứng, 2026-10-16

**Verdict: APPROVE** đúng candidate SHA256 `62bf3101f518962e18b7ba986e39ae04bb7c9fd0d26243306017c0f31966bf0b`, chỉ cho deliverable phân tích/đề xuất. Không có finding blocking trong phạm vi này. **publicationReady=false**; verdict không cấp quyền tạo branch, stage/commit/push, sửa Preview, chạy CI/DB hoặc deploy.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/candidate-01/manifest.json`.

## Binding và source tham chiếu

- Tự đối chiếu đủ 28 original/snapshot pins: 1.194.137 bytes, mọi size/SHA256 khớp, không drift; cả 3 external proof references khớp.
- Tự parse selection và publication manifest; hash lại **826 file hiện hữu** trong proposed INCLUDE, tổng 8.066.969 bytes. Hai deletion entries được đối chiếu absence và SHA256/size của HEAD blobs bằng Git chỉ đọc. Cả 828 entries khớp, không drift; không mở actual env/private inputs hoặc raw backup.
- Snapshot phục hồi gói phân tích, không phải source archive/release bundle. Application source là hash-bound references trong publication-file-manifest.tsv; hash không thay cho lưu bytes, môi trường hay replay. Phải freeze/kiểm exact staged bytes và history lại khi có gói publication sau.
- Đã đọc helper summary/finalization, scoped reports, receipt allowlist, selection/triage/dependency/history metadata và source replacement cần thiết. Không chạy các helper hoặc import project module.

## Counts, lệnh và phạm vi bằng chứng

Đã đối chiếu 15 JSON inputs cố định của build-public-summary.cjs, gồm tám Windows step receipts, với các field/receipt SHA trong sanitized summary. Tám commands, cwd `D:/Workspace/pos-cafe-permission-verify/source`, exit0 và source fingerprint khớp. Không đọc raw logs. Log SHA là giá trị được chép/đối chiếu từ receipt lịch sử; public report:27 đã sửa rõ phân biệt này.

Windows summary giữ đúng unit110files/1.173PASS, tooling25files/489PASS, smoke81discovered/44PASS/37SKIP/0FAIL, UI selftest23findings và UI16states×3viewports/6classified false positives/0new. Lệnh TypeScript/build/mock smoke/UI được trình bày đúng argv sau chuẩn hóa tên công cụ, không nhận mock thành Supabase proof. Node/npm versions được dẫn như môi trường lịch sử trong hồ sơ Windows, không phải version probe mới.

Source-manifest SHA `6cf658ef…a2bb` và fingerprint `8d670488…acf4` khớp receipt. Tự kiểm mapping/counts: 835 entries =834 checked +1.env.example held; checked gồm832 file records và2 deletion markers, path sets khớp, correspondence ghi0drift. Đây là phép đối chiếu manifest cũ đã ghi bởi helper, không chạy lại tests hoặc phủ added files/full current-source acceptance. EVC không nhận correspondence đó thành một full-source PASS mới.

Worker summary bind closeout/node-attempt08: **33PASS/0FAIL/0SKIP**, đúng5test-file argv, gồm15 inherited cases; không cộng thành48. Actual Linux runs/backend cases vẫn0. Actor summary bind receipt `8b60e08e…28ba2` và reviewed candidate `5e32f578…382a9`: local13PASS tách riêng một actual READ ONLY metadata probe79/145/3, unexpected0, exact scope/TLS/rollback/close. Mọi cleanup/full-row/payload/fresh-backup/live-mutation flags giữfalse; không probe lại hoặc nhận schema/contract2/application compatibility PASS.

## Selection, triage và deletion pairs

Tự tính từ TSV cuối, không chỉ nhận summary:

| Checkout | INCLUDE | HOLD | EXCLUDE |
| --- | ---: | ---: | ---: |
| main | 509 | 1 | 0 |
| docs | 319 | 22 | 34 |

885 rows/885 unique repo-paths; publication manifest chứa đúng828 INCLUDE rows, mọi path/hash/size/scope khớp selection. Main INCLUDE gồm507 file hiện hữu và2 deletions; docs INCLUDE319 file. Main HOLD chỉ pnpm-lock.yaml. Docs index vẫn HOLD. Hai root reports là hai post-capture rows được ghi riêng; các review/metadata phát sinh sau freeze chưa nằm trong counts này.

privacy-triage.json bind đúng11 hashes, tổng14 scout hits. Tự kiểm cả11 chuyển HOLD→INCLUDE đúng path/hash và không sửa bytes. SEC clearance chỉ gỡ HOLD do những occurrences đã đọc, không phải full-file/payload/history privacy approval. Không đọc hoặc chạy recovery module để tái hiện privacy triage.

Tự tính lại29 known included→held edges sau triage: không còn target HOLD; file after-triage có0rows. Bốn required test-discovery files đều có trong INCLUDE. Đây là closure của các dependency tĩnh đã liệt kê, không phải chứng minh mọi dynamic import/build/runtime path hoặc toàn bộ privacy.

Hai deleted HEAD blobs là553 và2.143 bytes, tổng2.696; hash khớp manifest/scout. Đã đọc old hook và current wiring: [App:4](D:/Workspace/pos-cafe/src/app/App.tsx:4) import PermissionLifecycle, mount tại:118; [PermissionLifecycle:67](D:/Workspace/pos-cafe/src/app/PermissionLifecycle.tsx:67) subscribe permission/store/catalog signals, cleanup tại:90; integration index bỏ old export, core lifecycle/tests và ports đi cùng INCLUDE. Search trong src không còn literal useRealtimeInvalidation. Chỉ xác nhận deletion/replacement được chọn cùng nhau; không tuyên bố acceptance hoặc tương đương hành vi từ source reading.

## Lịch sử docs và phạm vi provider

Git object checks chỉ đọc xác nhận base `132e9d6cc065459031ee92cfbafcd423b5ac81c5` là ancestor của local docs `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; đúng hai additional commits `9937f1f005f1569b0e348374b37cc95d8b490ca5` và `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Diff có đúng24 unique paths, khớp docs-reachable-history.tsv. Những bytes/history reachable này là một chiều kiểm publication riêng, không cộng lại như24 dirty rows hoặc coi dirty allowlist là toàn bộ nội dung sẽ public. Không dùng compare API404 làm ancestry proof.

Đã xem JPG và accessibility snapshot của đúng Preview URL: Branch Tracking ON, matching “All unassigned branches”, không custom environment trong snapshot; UI ghi disabled vẫn cho CLI/API deployments. Những quan sát GitHub/repo/Production/hook khác được ghi dưới dạng normalized author observations ngày16/10; EVC không gọi provider/API mới hoặc coi record này là raw provider-signed response. Webhooks chưa được xác minh vì thiếu admin scope;0Actions/hasPages=false không chứng nhận mọi integration/provider không có trigger.

Proposal OFF chỉ tác động automatic Preview của mọi unassigned branches thuộc project đã chỉ định; không chặn manual deployment, project khác hoặc main Production push. Báo cáo nói rõ ảnh hưởng nhóm, rollback bằng setting sau lệnh riêng, không tự bật lại. Owner mới chọn hướng chuẩn bị; cần quyết định riêng trước toggle/Save/readback. Quyền đổi setting, nếu có sau này, không tự cấp quyền push.

## Findings đã xử lý và giới hạn bàn giao

- **EVC preflight: receipt/log wording — CLOSED.** Public progress report:27 phân biệt recomputed receipt hash và receipt-declared historical log hash; không thêm raw-log integrity claim.
- **EVC preflight: dependency/discovery HOLD — CLOSED trong proposed selection.** Finalize-selection.cjs:14–20 bind exact SEC triage;:53–57 kiểm29edges và4tests; final report:43–49 vẫn giữ publicationReady=false và giới hạn static/privacy.
- Không có finding chặn còn mở đối với analysis candidate. Remaining HOLD/EXCLUDE, exact public payload/history privacy, branch/refspec/isolated commit recipe và trigger readback là việc trước publication sau, được giữ rõ là pending, không bị che dưới APPROVE này.

Existing analysis2.633.861 + snapshot1.194.137 =3.827.998 logical bytes trước manifest/review metadata, trong budget8MiB; không copy8MB referenced source thành archive. Snapshot/receipts nói rõ operational budget/V8 heap, không phải quota OS/CPU/RAM. Không tạo môi trường test, tải/cài hoặc xóa temp.

NOT_READY_FOR_DEPLOY và Linux/full backend/hosted capability-control/backup-restore/cutover/Edge/Storage-Realtime/Production binding gates còn nguyên. Tailwind3 warning disposition được giữ là quyết định owner lịch sử, không nhận audit0/đã vá. Nhắc merge nhánh code về main chỉ sau đủ gates và lệnh owner; docs vẫn riêng. Walkthrough đã cung cấp, không nhận owner đã đọc/nghiệm thu.

Không branch/stage/commit/push/settings/CI/DB/deploy/delete; không credential/private-input/runtime/raw-backup/env contents hoặc project-module import, suite/build/helper/probe execution. Chỉ đọc/hash source công khai, sanitized receipts và Git objects cần thiết. Report này không cần reviewer lồng theo workflow.

