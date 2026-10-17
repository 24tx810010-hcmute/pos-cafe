# Truy vết

Change tooling không use case nghiệp vụ mới.

| Requirement | Test | Thực hiện |
| --- | --- | --- |
| CICD-01 | CI-01, CI-04 | S1, S2, S4 |
| CICD-02 | CI-02, CI-04, CI-05, CI-08 | S2, S4 |
| CICD-03 | CI-02, CI-03, CI-07 | S2, S3 |
| CICD-04 | CI-06, CI-07 | S3, S5 |
| CICD-05 | CD-01, CD-02, CD-03 | S6 |
| CICD-06 | CD-03, CD-04 | S4, S6 |
| CICD-07 | CI-03, CI-04, CI-07, EV-01 | S2–S7 |
| CICD-08 | EV-01 | S1, S7 |

Actual result sẽ ghi trong implementation log/handoff; bảng này không tuyên bố các TC đã PASS.

TC-CICD-DIAG17 (CICD-02/03/04): preflight đúng1case desktop gốc PASS, thiếu/sai case/retry/skip/hookerror phải reject và subset không qua fullsmoke; failed Playwright report chỉ xuất knownfile/count/line/ordinal, rawfake secret và privatepath bị loại. EdgeSRI và cleanupunmount failure giữ độc lập finitecode; D12PASS fixture + outercleanupfalse/nonnullcleanupFailure phải reject. Actual11phasefullCI và actualT09/T10 vẫn cần sourcecuối, không dùng unitfixture để nhậnPASS.

TC-CICD-DIAG18 (CICD-02/03): nested failed Playwright report phân loại đúng7finite API/fixture stages; chỉ knownfailedsource có positive bounded line/column; publicSummary giữ finite values, loại fake secret/URL/privatepath/unknownfile. Không dùng diagnostic để nhận subset hoặc failed run PASS.

TC-CICD-CORE18 (CICD-04): shared restore after stopped/empty exactunit, backend recipe LimitCORE0 + daemon/container ulimit0, supervisor/harness readback; arbitrary unit, pipe/nonzero/missing/duplicate flag phải refuse. Actual backend mới phải kiểm cache20 exactpins/unknownversion rejection và cleanuptrue, không dùng fixture PASS thay D12.

Candidate18 bị hai reviewer CHANGES_REQUESTED trước publication vì Docker default-ulimit có thể bị từng container override. Candidate18a thêm actual /proc/<State.Pid>/limits cho đủ12runningservices với12PID riêng: hard/soft đều0, patternregular; missing/readerror/EACCES/nonzero/stopped/invalidPID/duplicatePID/incompleteinventory đều refuse. Envelope bắt buộc containersCoreDisabled=true, thiếu field cũng reject. Short-lived bundle chỉ claim explicitulimit configuration+regularkernelpattern, không giả vờ có running-process snapshot sau khi nó đã kết thúc. Chưa Linuxbackend readbackPASS trước lượt18a mới.

TC-CICD-DIAG19/CACHE19/CLEAN19 (CICD-02/03/04): observer step reporter finite knownsource/selector/API/category/time, no status override and no subsetPASS; optionalmetadata-only exactdeclared3pins/regularfile/metadataSRI+deps/contenthash+bytes, notinstalledcounts; requiredmissing/unknown/symlink/SRIbad refuse; recursiveunmounttree outside/prefixescape/wrongloop/root reject, finiteumount reasons no raw. Trạng thái lịch sử tại checkpoint19: actual fullCI/backend source lúc đó vẫn pending. Hiện trạng source mới xem đầu handoff và implementation log.

Candidate19 bị package reviewer CHANGES_REQUESTED trước publish: metadata-only files có thể làm totalfiles>0 dù root versiondir trống. Candidate19a thêm counter riêng chỉ tăng khi đọc installedfile của expectedroot, bắt buộc rootFiles>0; metadata không tăng counter. Regression rootdir trống+optionalregistry cóbytes phải reject. Không dùng optionalmetadata làm evidence root package đã installed.

| Requirement | Phạm vi tooling | Test | Bảo vệ |
| --- | --- | --- | --- |
| CICD-03 diagnostic trace21 | Failed preflight observation | TC-CICD-TRACE21 | Private bounded trace; no raw export or acceptance change |
| CICD-03 trace23 boundaries | ZIP member JSONL interoperability | TC-CICD-TRACE23 | No-final-newline fixture, aggregate decoded/time bounds, malformed member refusal |
| CICD-03 backend24 diagnostic | Failed pilot observation | TC-CICD-BACKEND24 | Strict bound nonPASS D12, unknown counts remain null, success gate rejects |
| CICD-03 trace25 DOM facts | Failed preflight observation | TC-CICD-TRACE25 | Fixed screen counts, v8 references, incomplete unknown, no HTML/text export |
| CICD-03 trace26 expect facts | Assertion/timeout distinction | TC-CICD-TRACE26 | Exact fixed locator/call correlation, booleans/ordinals only, no configured-timeout false positive |
| CICD-04 image26 backoff | Pinned image rate limit | TC-CICD-IMAGE26 | Up to3ECR attempts for rate limits, then1same-digest GHCR fallback under mirror30; at most4outerpulls, test retry0/caps unchanged |
| CICD-03 protocol27 | Early expect failure investigation | TC-CICD-PROTOCOL27 | Preflight-only private CDP, finite crash signal, no normal detach false positive |
| CICD-04 diagnostic isolated21 | Internal namespace failure receipt | TC-CICD-ISOLATED21 | Exact run/attempt/source binding, finite primary/cleanup errors; no pilot PASS |

TC-CICD-TRACE22 nối CICD-03: bounded refusal/metadata/IO counters và locator diagnostic; không thay acceptance hoặc privacy.

TC-CICD-BUS22 nối CICD-04: exact-unit live readonly system bus properties; giữ kernel/cgroup/namespace gates, không dùng cached receipt hoặc fake unit test thay actualLinux.

Lịch sử checkpoint28: CICD-03 diagnostic28 → TC-CICD-RUNTIME28 → three local regression cases (protocol source contamination, finite control/FAIL preservation, prior-process attribution). Actual CI23 chỉ chứng minh phase crash signal; actual28 còn pending, không thay full smoke/UI hoặc backend gate.

CICD-03 diagnostic29 → TC-CICD-FORMAT29 → two new regressions plus actual bundleddebug before/after synthetic receipts. CI24 boundsource1e6b000 remainsFAIL; partial control actualpending.

Lịch sử checkpoint30: CICD-03 runtime30 → TC-CICD-RUNTIME30 → CI25 staticcontrolfailure là inputdiagnosis; CI nguồn runtime30 còn pending. CICD-04 mirror30 → TC-CICD-MIRROR30 → local guarded fallback regression + bound12manifestmetadata; actualdockerpull/pilot pending. Không uncovered yêu cầu nghiệp vụ mới hoặc đổi release gate.

Lịch sử checkpoint31 trước CI27: CICD-03 user/native31 → TC-CICD-USER31/TC-CICD-NATIVE31 → local regression/pinned source; CI26root/fullruntimeFAIL là inputdiagnosis, actual non-root source chưa chạy. Backend15 đang chạy source7d6e269; không gộp source/evidence.

CICD-03 harness32 → TC-CICD-HARNESS32 → permission-ci1-harness.test.mjs finite/privacy regression. Backend15 actual exit78 là input; chưa gán phase/npm code khi chưa có run source32.

## Lịch sử checkpoint33 — trước CI28 terminal

Source hiện tại: `ci/project-pipeline-20261017` → `a47b0750f8e775fca34feca6d21dc5c4f47de7cc`; [CI28](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39021956973/attempts/1) đang chạy. Chỉ ba file backend diagnostics đổi từ source đã xanh; chưa gọi CI source mới PASS.

[CI27](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39020885656/attempts/1) đã completed/success trên đúng `dc7e77ea4b77ad706d3976e37f01c794bbbfbbc6`: đủ 11 phases, unit1.173/1.173, tooling566/566 + đúng1manualDeferred, Node93/93, preflight1/1, smoke44PASS+37applicabilityskip/81inventory, UIselftest23 và audit48/48 với6findings baseline sẵn có. Source preserved, core pattern restored; peak owned933.117.952B. Không nhận 6findings đã được sửa hoặc backend đã PASS.

Main hiện `f9c566999c4367a5ca54a879fe3b06b5870f26f2`: bootstrap sáu file cộng một file policy; policy giữ19keys và chỉ đổi5hash sau hai review. [CD positive39021837504](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39021837504) kiểm source `dc7e77e` / CI27attempt1: preflightPASS, approval đang waiting tại Production16685477499 cho reviewer54500418. Không approve/deploy. Đây là setup checkpoint; production=false và không có deploy command/token. Run waiting chiếm concurrency group pos-frontend-release; trước candidate release sau này cần reject/cancel checkpoint cũ hoặc quyết định xử lý riêng, không tự nhận run mới sẽ vượt qua queue.

[Backend15](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39019898992/attempts/1) source7d6e269 FAIL tại PILOT_HARNESS/node exit78, cleanuptrue/cleanupFailurenull/core pattern restored; không có D12 evidence hợp lệ. Candidate32 được hai APPROVE,95/95localPASS/lint3 và đã publish đúng ba file vào a47b075. Chỉ thêm numeric setup diagnostics, chưa xác định phase/npm cause và chưa actual backend source32. TC-IDEM-087 legacy và full PIN/PERM/hosted vẫn chưa được kiểm ở scope này.

## Lịch sử checkpoint34 — trước source211c9b4

Nhánh CI hiện tại: `ci/project-pipeline-20261017` → `a47b0750f8e775fca34feca6d21dc5c4f47de7cc`.

[CI28](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39021956973/attempts/1) completed/success trên source hiện tại `a47b0750f8e775fca34feca6d21dc5c4f47de7cc`: đủ11phases; unit1173, tooling566PASS+1manualDeferred, Node95, preflight1, smoke44PASS+37applicabilityskip/81inventory, selftest23, UI48PASS/6baselinefindings. Source preserved, core pattern restored; peak owned961.138.688B. Đây là light/mock scope, không thay backend acceptance.

[Backend16](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39022743785/attempts/1) đã dispatch cùng source `a47b075` sau khi CI28 terminal SUCCESS; hiện đang chạy, chưa kết quả pilot hoặc phase gây exit78. Backend15 source7d6e269 vẫn là FAIL/PILOT_HARNESS/node78, cleanuptrue, không D12 evidence hợp lệ. Không lấy CI PASS hoặc diagnostic fixture để nhận pilot PASS.

Main `f9c566999c4367a5ca54a879fe3b06b5870f26f2` giữ bootstrap6files+policy1file; 19frontendchecker pins không đổi giữa dc7e77e và a47b075. CD positive39021837504 đang waiting human approval sau preflightPASS, kiểm exactsource dc7e77e/CI27attempt1; chưa chạy positive cho a47b075. Không approve/deploy; production=false và không deploy command/token. Main cũ chưa CI riêng/branch protection theo phạm vi đã chọn.

CICD-04 → TC-CICD-MIRRORPROOF35 → pure imagebinding regression12pins; CICD-03 → TC-CICD-PHASE35 → finite phase8/privacy regression. Backend16 run39022743785/attempt1 trên a47b075 đã FAIL tại PILOT_HARNESS/node78. Diagnostic mới xác định phase8 (verifyCi1ImagePins), cause10unknown/exit256sentinel/npm0; install offline và post-install envelope đã qua, chưa vào pilot. Cleanuptrue, cleanupFailurenull, core restored; không có D12 evidence hợp lệ. Raw runtime error/RepoDigests không được export, nên chưa kết luận nguyên nhân thực tế duy nhất. Newsource actual pending, không gán hồi cứu cause20.

## Checkpoint35a — source mới đã publish

Nhánh `ci/project-pipeline-20261017` hiện ở `211c9b45aa9109548bea053b5043b20574217575`. Candidate35a đã hai APPROVE, local99/99 PASS/lint3, publish5files backend tooling. [CI29](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024304178/attempts/1) đang chạy; chưa nhận PASS cho source này. Backend17 chưa dispatch, chờ CI29 terminal.

Source trước `a47b0750f8e775fca34feca6d21dc5c4f47de7cc`: [CI28](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39021956973/attempts/1) full11phase PASS (unit1173/tool566+1manualDeferred/Node95/preflight1/smoke44PASS+37skip/selftest23/UI48PASS+6baselinefindings); [backend16](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39022743785/attempts/1) FAIL phase8 verifyCi1ImagePins, cause10 unknown, exit256 sentinel, cleanuptrue/core restored, không D12 counts. Candidate35a sửa lỗi tương thích RepoDigests ECR/GHCR được tái hiện bằng actual verifier trước/sau với fixture; chưa chứng minh đó là nguyên nhân duy nhất của backend16.

Main `f9c566999c4367a5ca54a879fe3b06b5870f26f2` giữ bootstrap6files+policy1file, 19frontendchecker pins không đổi. CD39021837504 preflightPASS/approvalwaiting vẫn kiểm source dc7e77e/CI27; chưa kiểm source211c9b4. Không approve/deploy; production=false, không deploy command/token. Main cũ chưa CI riêng/branch protection theo phạm vi owner chọn.

## Checkpoint35b — CI29 PASS; backend17 đang chạy

Nhánh `ci/project-pipeline-20261017` hiện ở `211c9b45aa9109548bea053b5043b20574217575`. [CI29](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024304178/attempts/1) completed/success đủ11phases: unit1173, tooling566PASS+1manualDeferred, Node99, preflight1, smoke44PASS+37applicabilityskip/81inventory, selftest23, UI48PASS/6baselinefindings. Source preserved/core restored; peak owned913.096.704B. Đây là light/mock scope; không thay backend acceptance.

[Backend17](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024971276/attempts/1) đã dispatch exactsource211c9b4 sau CI29 terminal SUCCESS, hiện đang chạy; chưa có pilot/D12 counts. Backend16 trước đó sourcea47 FAIL phase8 cause10unknown/exit256sentinel, cleanuptrue/core restored. Sửa mirror đã kiểm fixture, kết quả runtime source mới còn chờ.

Main `f9c566999c4367a5ca54a879fe3b06b5870f26f2` giữ bootstrap6files+policy1file; 19frontendchecker pins không đổi. CD39021837504 preflightPASS/approvalwaiting vẫn boundsource dc7e77e/CI27, chưa boundsource211c9b4. Helper refresh35 đã hai APPROVE, chưa execute; chờ backend17 terminal. Không approve/deploy; production=false và không deploy command/token. Main cũ chưa CI riêng/branch protection theo phạm vi owner chọn.

## Checkpoint36 — suite-level failure diagnostics, đang chuẩn bị

[Backend17](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024971276/attempts/1) completed/FAIL trên exactsource211c9b4 sau CI29SUCCESS. D12 thật lần này: bootstrap/auth/apiBinding/sourcePreservationPASS; T09suiteFAIL/exit1 dù assertion run1/pass1/fail0/skip0; T10NOT_RUN, totalsUNKNOWN. Inner checks.cleanupFAIL (preservation hash không khớp), outer environment cleanuptrue/cleanupFailurenull/core restored. Không có hook/run error details trong public report, chưa kết luận bước teardown hay nguyên nhân duy nhất. Image verification/bootstrap đã vượt; sửa mirror không còn blocker phase8 ở lần này.

Candidate36 sẽ bổ sung finite suite/hook diagnostic ordinals từ private Vitest report, không raw names/errors/stack/SQL/URL/credentials; không đổi D12 acceptance/counts, T09/T10 inventory, retry0, preservation hoặc budgets. Chưa publish/chạy source36.

CICD-03/04 → TC-CICD-SUITE36 → three local regressions for finite privacy projection/bounds/state-machine unchanged. Source35 actual backend17FAIL remains evidence; newdiagnostics do not retrospectively classify its hook/root cause.

### Preservation mask36a

Diagnostics36a bổ sung preservationComponentDriftMask0..31 (1catalog/2financial/4storage.objectsmetadata/8buckets/16payloads) và preservationFinancialDriftMask0..63 (1orders/2order_items/4order_item_options/8payments/16write_operations/32order_events). Private snapshot vẫn cùng5values {catalog,financial,metadata,buckets,payloads}; capture trả cùngwholeSHA256string và verify vẫn exactbefore===hash(snapshot), không sửa assertion/restore/ACL hoặc acceptance. Chỉ lưu additional component hashes trong private state. Emit đúng1 CI1_PRESERVATION_FAILURE với2canonicalintegers khi wholehashlệch, đúngprivatebaseline và validhash arrays5×64hex/6×32hex; financialbit phải đồng nhất financialmasknonzero. Unknown/malformed/duplicate/suffix/leadingzero/outofrange không tạo facts. Callback lỗi không thay booleanpreservation. Masks chỉ xác định nhóm drift, không chứng minh nguyên nhân. Actual17 innercleanupFAIL được source phân biệt là preserved(baseline)false; close/envelope throw sẽERROR, nên không nhận là daemoncleanupFAIL. Outercleanuptrue riêng. Source36a actual vẫn pending.

TC-CICD-PRESERVE36 (CICD-04): pure masks/bounds/consistency plus VM rehearsal of actual fixture capture/verify function bodies with fake snapshots; same old wholehash, changed metadata producesfalse/mask4, unchanged producestrue/no marker, throwingcallback cannot alterfalse. Đây là mock-only, không actualbackendPASS.

## Checkpoint36d — đã publish, actualsource mới còn chờ

Nhánh `ci/project-pipeline-20261017` hiện ở `0781f755737747fc8cc810ac5484b12d892013a4`. Candidate36d đã hai APPROVE, local104/104PASS/lint3, publish6backendtoolingfiles gồm newfinite diagnostics. [CI30](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39026804330/attempts/1) đang chạy; chưa nhận PASS cho source này. Backend18 chưa dispatch, chờ CI30 terminal.

Source trước `211c9b45aa9109548bea053b5043b20574217575`: [CI29](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024304178/attempts/1) completed/success đủ11phases (unit1173/tool566+1manualDeferred/Node99/preflight1/smoke44PASS+37applicabilityskip/selftest23/UI48PASS+6baselinefindings; sourcepreserved/core restored, peak913.096.704B). [Backend17](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39024971276/attempts/1) FAIL có D12 thật: bootstrap/auth/apiBinding/sourcePreservationPASS, T09suiteFAILexit1 dù assertionrun1/pass1/fail0/skip0, T10NOT_RUN/totalsUNKNOWN; innerpreservationFAIL, outercleanuptrue/core restored. Chưa có finite hook/cause/componentdrift cho actual17; không gán hồi cứu từ diagnostics36d.

Main `f9c566999c4367a5ca54a879fe3b06b5870f26f2` giữ bootstrap6files+policy1file; 19frontendchecker pins không đổi. CD39021837504 preflightPASS/approvalwaiting vẫn boundsource dc7e77e/CI27, chưa boundsource0781f75. Helpersrefresh34/35 chưa execute và hiện obsolete. Không approve/deploy; production=false, không deploy command/token. Main cũ chưa CI riêng/branch protection theo phạm vi owner chọn.

## Checkpoint36e — actualCI30 PASS; backend18 đang chạy

[CI30](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39026804330/attempts/1) completed/success đủ11phases trên source0781f75: unit1173/tooling566PASS+1manualDeferred/Node104/preflight1/smoke44PASS+37applicabilityskip/81inventory/selftest23/UI48PASS+6baselinefindings. Source preserved/core restored; peakowned978.341.888B. ScopeLIGHT_MOCK_ONLY, không thay backend acceptance.

[Backend18](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39027568904/attempts/1) đã dispatch exactsource0781f75 sau CI30 terminalSUCCESS; hiện đang chạy, chưa D12/mask/cause của source mới.

## Mốc bàn giao36 — theo quyết định owner DEC-CICD-06

Nhánh triển khai `ci/project-pipeline-20261017` ở `0781f755737747fc8cc810ac5484b12d892013a4`. [CI30](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39026804330/attempts/1) đã **PASS đủ 11 bước** trên đúng commit: unit1.173, tooling566 + đúng1manualDeferred, Node104, browser preflight1, smoke44PASS+37applicabilityskip/81inventory, UIselftest23, UIaudit48PASS với6finding baseline sẵn có. Source preserved/core restored; peak trong vùng task978.341.888B. Scope light/mock không thay backend acceptance.

[Backend18](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39027568904/attempts/1) đã chạy thật trên cùng commit và **FAIL**. Bootstrap/Auth/API binding/source preservation đạt. T09 có 1 assertion PASS nhưng suite FAIL/exit1 vì 1 hook error, không có run error; T10 chưa chạy, tổng counts chưa xác định. Chẩn đoán hữu hạn: phase4 `read-fixture`, step13 `cleanup-read`, code17 generic `IMAGE_CLEANUP_STEP_FAILED`, SQLSTATE không xác định; catalog drift mask1, financial drift mask0, các nhóm Storage không có drift trong snapshot. Điều này xác định nhánh lỗi, chưa chứng minh root cause cụ thể bên trong cleanupReadFixture. Cleanup môi trường ngoài đạt, core pattern đã khôi phục.

[CD checkpoint mới](https://github.com/nguyentronglinh045/pos-cafe/actions/runs/39028263852) dùng workflow trên main `f9c566999c4367a5ca54a879fe3b06b5870f26f2`, kiểm exact source `0781f755737747fc8cc810ac5484b12d892013a4` và CI30/attempt1: **preflight PASS, approval WAITING_HUMAN**. Production16685477499 yêu cầu reviewer54500418, chỉ main và admin bypass=false. Tín hiệu `FRONTEND_RELEASE_PREFLIGHT_VALID_PRODUCTION_HELD` đã được đọc trong DOM job117383454382; job approval117383507170 còn waiting. Checkpoint cũ39021837504 đã cancelled vì source lỗi thời. Không approve/deploy; code production=false, chưa có lệnh hoặc token deploy Vercel.

**DEC-CICD-06 — 17/10/2026:** owner trả lời câu 0 của `call_801a8f97fddc4f58a5825cd0bbfe23e5`: “Chốt CI/CD; ghi backend FAIL, sửa fixture ở phiên phân quyền (khuyến nghị)”. Mốc bàn giao này xác nhận CI/CD đã cấu hình và chạy thật; giữ nguyên backend acceptance FAIL, chuyển việc điều tra/sửa cleanup fixture sang phiên phân quyền. Không giảm coverage, đổi baseline/ACL hoặc nhận backend PASS; chưa phát hành production.

Phiên phân quyền tiếp tục từ commit `0781f755737747fc8cc810ac5484b12d892013a4`, run backend18/attempt1 và các ordinals/masks ở trên. Cần xác định lỗi trong cleanupReadFixture, sửa khôi phục catalog đúng baseline và chạy lại toàn bộ T09/T10 trên source mới; không bỏ hook, đổi acceptance hoặc lấy assertion PASS thành suite PASS. Gate production vẫn cần đầy đủ backend và bước bật triển khai được duyệt. TC-IDEM-087 legacy chưa chạy, cần fixture riêng; pilot T09/T10 không phủ case này. Main cũ chưa CI riêng/branch protection, và database/Edge nằm ngoài CD, đúng phạm vi owner đã chọn.

Hồ sơ này được freeze trước công bố. Nhánh đích `docs-ci-cd-20261017` chỉ được tạo sau khi hai reviewer độc lập APPROVE exact manifest và helper công bố; commit message của nhánh ghi manifest cùng hai approvals. Trạng thái công bố cuối được đối chiếu bằng [lịch sử commit của nhánh](https://github.com/nguyentronglinh045/pos-cafe/commits/docs-ci-cd-20261017) và receipt local `artifacts/project-ci-local/docs-published.json`, không tự nhận sự kiện sau freeze trong nội dung snapshot.
