# Setup CI/CD POS-cafe

Change công cụ, không đổi nghiệp vụ/UI; bỏ `usecases.md` theo SPEC-STANDARD. Testplan và traceability vẫn bắt buộc.

## Mục tiêu và quyền

Ngày 17/10/2026 owner giao lên kế hoạch rồi tiếp tục setup: CI nhẹ tự động PR/push, backend nặng manual, CD chỉ frontend Vercel; database/Edge triển khai riêng; **chưa phát hành production**. Quyết định này chốt Q02/Q03 trong [handoff](../../../docs/workflow/tasks/project-ci-cd-setup-2026-10-17.md), tiếp nối DEC-CICD-01.

Mốc source là code đã public `43921c7ebd957bf926bb45411eed849874ade446`; hai evidence refs giữ nguyên. Code/tools/workflows trên worktree `D:/Workspace/pos-cafe-ci`, nhánh `ci/project-pipeline-20261017`; docs ở nhánh docs. Không dùng checkout main đang dirty để stage hoặc chạy cài đặt.

## Lựa chọn và lý do

- Workflow trong repo POS: checks gắn trực tiếp SHA/PR, tránh mirror source qua repo CI khác. Repo CI-0 cũ giữ lịch sử. Worker backend cần mở allowlist đúng repo POS, vẫn chỉ manual/public/hosted và giữ limits.
- CI nhẹ chạy build, unit/coverage, tooling thuần, mock smoke đầy đủ viewport và UI detector/audit; không cần Supabase online. Backend pilot T09/T10 giữ đủ 4 cases và đủ service, là một scope riêng, không nhận thành full PIN/PERM/hosted PASS.
- CD manual có production environment protection; chỉ prepare/verify ở đợt này, production enable mặc định false. Không dùng approval workflow để bypass gate tương thích backend. Database migrations và Edge ngoài scope CD.
- Standard hosted Linux public/free; không self-hosted, WSL/Docker Windows, artifact/cache upload hoặc dịch vụ trả phí. Safe summary/counts/SHA thay raw stdout/stderr.

## Điều kiện tích hợp online còn phải kiểm

GitHub yêu cầu workflow_dispatch tồn tại trên default branch. Không merge bản ứng dụng phân quyền vào main để bootstrap. Chuẩn bị diff tooling/config riêng trên baseline main, chặn Vercel auto deploy trước mọi main update; nếu cần action ngoài scope đã rõ thì trình đúng diff/refs trước khi hỏi owner. Credential CLI thiếu workflow scope; ban đầu thiếu admin, sau repo transfer đã admin. Ưu tiên capability hiện có/phiên browser hợp lệ, không tự tăng quyền.

**DEC-CICD-04,17/10:** owner chuyển cùng repositoryID1263057386 từ24tx810010-hcmute/pos-cafe sang nguyentronglinh045/pos-cafe và trả lời “Dùng nguyentronglinh045/pos-cafe mới”. Dùng canonical repo mới cho CI/CD/Vercel checks, cập nhật origin dùng chung; từ chối oldslug trong activeallowlist để tránh slug reuse. Workflows/light source/CI release bind cả tên mới và stable ID; lịch sử oldruns/refs giữ nguyên. Tài khoản nguyentronglinh045 hiện admin, không cần mở OAuth scope mới.

Đầu ra hoàn tất phải phân biệt workflow đã viết, đã publish, actual CI PASS, backend pilot PASS/FAIL và CD protected/held. Thiếu quyền/admin/secret hoặc budget thì ghi blocker thật, không gọi setup đầy đủ chỉ vì YAML có trên máy.

**DEC-CICD-05, 17/10:** owner chọn “CI cho nhánh mới + bootstrap manual/CD trên main trước (khuyến nghị)”. Mốc này chỉ bật CI tự động trên nhánh CI chứa bản phân quyền; `main` cũ nhận đúng sáu file đăng ký backend manual/CD held và cấu hình chặn Vercel Git deployment. Chưa thêm CI riêng cho ứng dụng cũ, chưa gộp mã ứng dụng. Phương án thêm profile CI cho main cũ hoãn theo lựa chọn này. Publish bootstrap sau hai review trên exact tree/parent và đối chiếu remote không drift; không phát hành production.

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
