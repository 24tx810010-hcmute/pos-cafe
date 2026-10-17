# Sửa oracle TC18 — 12/10/2026

## Phạm vi

Chủ dự án trả lời “ok làm đi” sau [finding SEC-01/02](permission-pin19-source20-review-2026-10-12.md) và đề xuất sửa trên candidate mới, thêm đối chứng, kiểm/review tuần tự. [PIN-D08](../../openspec/changes/force-default-pin-change/proposal.md), [handoff](../workflow/tasks/permission-pin-tc18-oracle-fix-2026-10-12.md), [testplan](../../openspec/changes/force-default-pin-change/testplan.md). Chỉ sửa test/harness; không đổi nghiệp vụ/quyền/UI/SQL. Không sang CLOSE2/restore/metrics/hosted/release, không commit/push. Snapshot và verdict FAIL source-20 giữ nguyên.

## Thay đổi và kiểm chứng

| Finding / vấn đề | Sửa và bằng chứng |
| --- | --- |
| SEC-01 | [Denial](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:3552) quét `TEMP_PIN` thực đã gửi. 11 đối chứng chèn PIN đó vào từng sink đều nhận mã `CANARY_LEAK_<sink>`, không echo PIN. |
| SEC-02 | [Capture](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:86) và [operator](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:4313) ghi rồi đọc lại PNG/JSON; [file oracle](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryOracle.ts:15) đọc bytes/text/JSON decode. Đối chứng file binary .png/JSON/log/reporter, overwrite sau projection sạch, JSON escape/base64, missing/malformed/non-file đều được kiểm. |
| Output sau runner | [Wrapper](D:/Workspace/pos-cafe/scripts/permission-pin-canary-run.mjs:42) đợi child exit, đóng stream rồi quét toàn output tree; [gate](D:/Workspace/pos-cafe/scripts/permission-pin-canary-run.mjs:12) đòi đủ20 scenario + operator, file bắt buộc và browser7/7/no retry. Đối chứng late reporter/log, thiếu coverage/file/PIN từ chối và child exit khác0 đều FAIL. |
| Cold Realtime | Hai subscription dùng replication readiness cùng adapter hiện có; [probe direct client](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:63) xác minh giao metadata trước thao tác credential. Completion19 pulse/2.062ms; recovery3 pulse/327ms. Thao tác PIN chạy một lần; sự kiện thật sau commit vẫn phải tới trong15s. |

Ledger canary là input control tạm ngoài output tree, không phải output sản phẩm. Wrapper đọc rồi xóa file/thư mục trong `finally`; receipt cuối `controlDeleted:true`. Không đưa raw PIN/Key/JWT/hash/DSN/rows vào docs/report. PNG kiểm bytes cùng mask form/DOM text; không tuyên bố OCR hay mọi encoding/compression tùy ý. Config TC18 trực tiếp thiếu wrapper context bị từ chối; dùng lệnh wrapper trong testplan/receipt.

## Source và môi trường

Main dirty sẵn, HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs dirty sẵn tại `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, worktree riêng. Source cuối **source-23**: [manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-23.json) SHA-256 `6e8ea0a541190606987df1f4324dbb0581a6f32d8471aaafcbe58c3712755d3c`; [tar](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-23.tar) SHA-256 `e7159f87912e215eba27b3097bfa756bec6c1425b2efbe916f03e1b90c4096d2`; fingerprint `67f9f3e7042fb5a7e079a6e390d9c26807c531de589b3d7efb5bfeaf32540d1d`. 810 file + 2 deletion marker, drift0. [Verification/delta](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/source23-verification.json): đúng8 file test/tooling/config so source-20, không `src/`/`supabase/`; hai dependency lock giữ nguyên.

Windows Node24.16.0/Vitest4.1.10/Playwright1.62.1/SupabaseJS2.112.3/TypeScript5.9.3; local target `pos-cafe-perm-pin-onboard-20261009`, API59921/DB59922/Vite5189, Supabase CLI2.117.0. Preflight/beforeEach guard config/marker/16 migration checksums/activation hash/contract2 strict/API↔DB/fixture graph. Env explicit ngoài ứng dụng; không chạy hosted. Docker dùng trong WSL, exact container/project/volume/network guards. WSL keepalive riêng đóng sau stop.

## Kết quả và lịch sử

| Lượt | Kết quả / giới hạn |
| --- | --- |
| Preflight ban đầu | Windows thiếu Docker CLI, chuyển WSL. Guard từ chối Edge Runtime dừng và startup health chưa đạt; giữ receipt riêng, chưa chạy browser. Khởi động lại đúng service và đợi guard đạt. |
| Attempt01/02 — source-21 | FAIL ở chờ applied-event của case đầu; case sau serial skip. Postflight zero/stop0. Không dùng làm PASS. |
| Attempt03 — source-22 | FAIL cùng applied-event; chỉ replication config chưa đủ. Postflight zero/stop0. Giữ lịch sử. |
| Attempt04 — source-23 | **7/7 PASS**, một worker, retry/missing/fatal/failure0, ma trận20×11 + operator; UTC16:10:12–16:12:01, exit0. [Browser](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-04/browser-safe.json), [command](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-04-command.json). |
| Artifact source-23 | **48 file đọc/quét PASS**: PNG/JSON thực, runner log, reporter và `.last-run.json`. [Scan receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-04/artifact-scan-safe.json) chỉ counts/hash/metadata, ghi sau scan. |
| Tooling source-23 | **28/28**, 4 files; hai typecheck exit0. [Commands](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/source23-check-commands.json). Dòng `PIN_CANARY_FAIL 0/1` của tooling là đối chứng reporter cố tình fail. |
| Cleanup/preservation | [Postflight](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-04-postflight.json): 8 nhóm fixture counts zero. [Stop proof](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/stopped-targets.json): ba target599xx/600xx/598xx, mỗi target12 container/running0; volume/network giữ, attachments0. Suite chỉ chạy599xx, không reset G1/G2a/G2b/G2c. |

## Gate và bàn giao

Execution TC18 đạt; [hai review](permission-pin-tc18-oracle-fix-review-2026-10-12.md) đang chờ. Chỉ đóng slice khi security/oracle và evidence/preservation/docs cùng APPROVE candidate cuối. Không có bằng chứng leak app thực tế trong task này.

Walkthrough đã chuẩn bị: wrapper → file oracle → capture/denial/operator → [đối chứng](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryArtifacts.tool.test.ts) → scan48. Chưa có xác nhận owner đã đọc/hiểu hoặc nghiệm thu.

Đây là **slice TC18**, chưa phải full PIN19/PERM60 source-23. Không gắn SQL41/TC19/unit/build/UI/PERM60 source-20 thành receipt mới. Full gate cùng candidate cuối còn phải chốt trước CLOSE2/CLOSE3/release; không đổi gate cho phép ghép fingerprint. Báo kết quả slice trước phần tiếp theo.

<a id="checkpoint-cuoi-sau-sec-03--source-25"></a>
## Checkpoint cuối sau SEC-03 — source-25

Vòng security candidate-01 **CHANGES_REQUESTED** vì primitive số không được quét; [review](permission-pin-tc18-oracle-fix-review-2026-10-12.md) giữ phản ví dụ và phạm vi. Không có leak app thực tế. Tác giả sửa oracle số/BigInt, normalize PIN đúng6 chữ số khi coercion mất số0 đầu, giữ mã lỗi cố định. Thêm11 đối chứng trên từng sink với8 biểu diễn số/BigInt của PIN thường và có số0 đầu; thêm đối chứng phân biệt array length nội bộ với phần tử numeric0 thực. Array length không nằm trong JSON persisted nên không được coi là dữ liệu PIN.

Source-24 giữ riêng: tooling10 FAIL/29 PASS do array length0 bị nhận thành PIN numeric0; browser attempt05 7/7 nhưng không đủ gate, không dùng làm PASS candidate. Source-25 sửa array metadata rồi kiểm lại tuần tự: [tooling40/40 và hai typecheck0](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/source25-check-commands.json); [attempt06 browser7/7](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-06/browser-safe.json), [command](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-06-command.json), [scan48/20scenario+operator/controlDeleted](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-06/artifact-scan-safe.json). Một worker/no retry/missing/fatal, ma trận20×11. [Postflight](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/attempt-06-postflight.json) zero; [stop proof mới](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/stopped-targets-source25.json) cả ba target12/running0, volume/network giữ/attachments0. Keepalive riêng đã đóng.

Candidate nguồn cuối là [source-25 manifest/tar](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-25.json), tar SHA-256 `cbd1a9cca1d6d18fc32b6ec786628a9aafa3f0652006b9b50a5a5d21ae719ebb`; fingerprint `45e697906e2b366c011eeeace0b9e160781ce8b3811cf770135de04558d02db4`. [Verification](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/source25-verification.json): drift0,810 present+2deletion, vẫn8 file test/tooling/config so source-20, không đổi `src/`/SQL/dependency lock; delta từ source-23 chỉ oracle và đối chứng. Hồ sơ source-23 ở trên là checkpoint lịch sử, thay bởi source-25 cho slice này. Review lại security rồi evidence/preservation/docs đang chờ candidate-02. Full PIN19/PERM60 source-25 chưa chạy; source-20 FAIL giữ nguyên. Walkthrough thêm nhánh numeric oracle → đối chứng array/data; owner chưa xác nhận nghiệm thu.
