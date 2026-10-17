# Phân quyền — CI-0 execution checkpoint, 15/10/2026

**CI-0 actual PASS; SEC/EVC đã APPROVE candidate01.** Đã xuất bản đúng một workflow ở repo CI riêng và chạy đúng một lượt manual, attempt1. Source POS/docs vẫn chưa push; không sửa DB, deploy Vercel hoặc xóa dữ liệu. Các mục chờ login/pre-push bên dưới là lịch sử trước lượt chạy; kết quả hiện tại ở cuối hồ sơ. CI-0 chỉ kiểm tài nguyên/namespace, chưa phải full backend hoặc deploy readiness.

## Quyền và gói

Owner giao PLAN-D09 bằng tin nhắn trực tiếp ngày15/10; [quyết định và proposal](../workflow/tasks/permission-linux-ci0-next-step-2026-10-15.md). [Authorization receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/owner-authorization.json). Proposal02 SHA `787d119c4f9c789be678389e5b1aaa4092686ef9d28355217581b982b5c0290d`, payload SHA `e27e848b0e596f89081a6727bdfbfa4aebc76a3a084df5d5f4a3ce3608e815d0`; không đổi payload sau review.

Đã tạo [nguyentronglinh045/pos-cafe-ci-preflight](https://github.com/nguyentronglinh045/pos-cafe-ci-preflight) public, GitHub ghi04:11:27UTC (11:11:27giờ Việt Nam/Thái Lan)15/10. Tài khoản CLI đúng owner, defaultmain, admin; Actionsenabled. API trả hooks/environments/secrets/variables/workflows/runs/deployments/selfhostedrunners đều0. [Các receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/). Lệnh tạo repo không fork/import/source/push hoặc tạo integration.

## Local Git, chưa push

[git-local-prepare.json](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/git-local-prepare.json): Git riêng tại `D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/repository`, một root commit `68b886af7534eb1e2dc3e0ed5425504b56b1671e`, tree chỉ `.github/workflows/permission-linux-preflight.yml`. Raw payload SHA khớp review; staged blob SHA1 `6b8766a6670677aa9135cecd902b0b71b10724bf`. Dùng noreply GitHub của owner, empty template/hooks riêng, chỉ Git config local; không sửa global config hoặc Git của POS/docs. Không tạo nhánh mới trong POS; CI dùng main riêng, không có việc merge vào main POS tại slice này.

Không cài gì. Ước tính local<10MB/trần vận hành50MiB, giữ30GiB trống C/D; precheck C205.717.782.528bytes/D103.664.934.912bytes. Không phải quota filesystem. Runner chưa tạo nên chưa có số đo Linux hoặc chi phí actual run; public standard runner được tài liệu GitHub hiện hành công bố miễn phí, chưa dùng private/larger runner hoặc thêm billing.

## Pre-push blocker và chờ người dùng

[Prepush checkpoint](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/prepush-checkpoint.json). Vercel UI đọc mới: Allprojects trong team `24tx810010-hcmutes-projects` chỉ có pos-cafe nối `24tx810010-hcmute/pos-cafe`, không thấy CI repo/project. Đây chỉ là một team đã xem. API `user/installations`403 do loại token CLI; không được nhận thành không có App. IAB GitHub Settings đang loggedout; hiện không có Chrome extension browser kết nối để dùng phiên sẵn có. Không đọc/nhập credential.

SEC pre-push verdict: **BLOCKED**, vì proposal step2 yêu cầu kiểm deployment integration áp dụng cho repo mới trước push; hook/workflow/deployment0 không thay cho GitHubApp/repositoryaccess, và một team không phủ provider khác. Không cần tuyên bố kiểm mọi App trên toàn tài khoản, nhưng cần đủ bằng chứng trực tiếp cho repo CI mới. Approval proposal02 vẫn giữ nguyên, D09 vẫn có hiệu lực; chưa có quyền bỏ điều kiện này.

Đã mở GitHub login return-to Settings trong trình duyệt Codex để người dùng tự đăng nhập đúng `nguyentronglinh045`. Chờ người dùng báo hoàn tất rồi kiểm Settings/App access chỉ đọc; không tự push hoặc dispatch khi chưa xác minh. Sau đó mới tiếp tục đúng một workflow/một run, giữ guard30GiB/timeout3phút và không retry. Nếu còn quyết định mới thì hỏi và chờ. Chưa có CI-0 PASS, full backend hoặc deploy readiness.

## Sau khi người dùng đăng nhập GitHub

Người dùng báo “đăng nhập rồi, tiếp đi”; đã đọc Settings đúng nguyentronglinh045, repo Apps liệt kê Vercel installation41260162 và Locofy45684219. Cả hai Allrepositories, áp dụng current/future repos, có write deployments; Locofy còn write Pages/actions/workflows. Vercel có đề nghị tăng quyền nhưng không mở/accept. Không đổi radio, Save, Suspend hoặc Uninstall. Allrepos là quyền truy cập, không phải bằng chứng đã có hoặc chưa có deploy mapping.

Vercel team switcher chỉ một team trong phiên hiện tại, Allprojects chỉ pos-cafe nối repo24tx810010-hcmute/pos-cafe; Authentication xác nhận GitHub sign-in24tx810010-hcmute. Phiên này khác chủ repo CI nguyentronglinh045 nên không đủ phủ installation đó. GET Pages trả404, phù hợp chưa có Pages site; không thay kiểm Locofy mapping. [Checkpoint sau login](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/prepush-checkpoint-after-login.json), [Pages receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/pages-before.json).

SEC vẫn BLOCKED step2: tối thiểu kiểm đúng Vercel account/team/project Gitbindings và Locofy project/repository/sync/deploy mapping. Một phương án thay thế là owner xác nhận cụ thể CI repo chưa từng import/liên kết Vercel/Locofy/Pages **và** không có automation đã cấu hình tự gắn/triển khai repo mới; chỉ “chưa import” hoặc “tiếp tục” không bao gồm điều kiện automation. Không tự hạn chế App sang Onlyselected vì đó là thay đổi phạm vi quyền riêng. Chờ owner xác nhận hoặc chọn kiểm provider account; chưa push/dispatch, D09 giữ nguyên.

## Owner chọn kiểm provider; chờ xác thực

Owner trả lời “Chưa chắc; kiểm đúng tài khoản provider trước (khuyến nghị)”; đây không phải attestation không có automation hoặc quyền bỏ step2. Đã kết thúc phiên Vercel24tx chỉ trong IAB và dùng ContinuewithGitHub→Continueasnguyentronglinh045. Vercel tới màn hình VerifyYourIdentity của tài khoản hiện có, cần user tự nhập2FA/passkey; không đọc/nhập mã, không cấp quyền mới/tạo account. Không lưu callbackURL vì có temporaryauth token.

Locofy official login ở `https://www.locofy.ai/login`: chưa có session; thử Github một lần vẫn cùng login screen, không có tab/permission screen mới quan sát được. Bàn giao cho user đăng nhập tài khoản hiện có, không tự tạo account hoặc nhận mật khẩu. Đã mở/giữ hai tab cho user, câu hỏi login được gộp một lượt; chờ báo hoàn tất rồi mới đọc mapping. [Handoff receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/provider-login-handoff.json). Repo vẫn chưa push, dispatch0; không đổi App, DB hoặc projectsettings/deploy.

## Owner bỏ bước kiểm Locofy; chờ Vercel2FA

User trả lời “không cần locofy đâu”: bỏ Locofy login/mapping verification cho scope CI0 hiện tại. Đây là thay đổi phạm vi kiểm do owner giao, không là bằng chứng không có App/automation. Không gỡ/sửa App; đã đóng đúng tab login Locofy. [Scope receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/scope-locofy-deferred.json). Kiểm Vercel đúng account trước push vẫn bắt buộc. Chỉ đọc tab inventory title/origin/path để thấy Vercel còn `/login/callback/verify/2fa`; không đọc query token hoặc form đang chờ user. Giữ tab Vercel chờ người dùng hoàn tất và báo, chưa push/chạy CI0.

## Đóng cổng Vercel và xuất bản workflow

Owner báo “Tôi đã hoàn tất đăng nhập Vercel”. Đọc UI đúng account `nguyentronglinh045`: team switcher không lọc chỉ có `nguyentronglinh045s-projects`, Allprojects không lọc có6project. Git bindings là mew-shop, smart-exam, staff-management, vite, shopeeClone và atc-website của owner; không có repo CI. Project vite-gwei không hiện binding ở card được kiểm riêng qua Overview→Repository. [Quan sát chỉ đọc](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/vercel-correct-owner-observation.json). SEC kiểm receipt và trả APPROVE đóng step2 trong scope owner đã bỏ Locofy; đây không phải audit mọi automation bên thứ ba. Không sửa settings/App permissions, import project hoặc deploy. Tab kiểm Vercel đã đóng.

Lượt CLI push duy nhất bị GitHub từ chối vì OAuth credential thiếu scope `workflow`; [receipt lỗi](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/push-workflow.json), [kiểm remote vẫn trống](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/remote-after-push-rejection.json). Không retry push hoặc mở rộng credential. Dùng phiên GitHub web đã đăng nhập để tạo đúng file được D09 duyệt. Settings Emails xác nhận web Git dùng noreply hiện có, không đổi privacy/settings. Không thêm file README hoặc source khác.

Commit thực tế trên GitHub là **`d2f3120960a8786b3fff36e116ae99ff0de1427c`**, root commit do web tạo; khác local commit chưa xuất bản `68b886a…`, cùng blob `6b8766a6670677aa9135cecd902b0b71b10724bf`. API tree không truncated, chỉ một blob `.github/workflows/permission-linux-preflight.yml`,2869bytes; decode Contents API rồi SHA256 khớp nguyên byte payload đã duyệt `e27e848b…`. [Publication verification](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/publication-verification.json), [bản source phục hồi](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/published-workflow.yml). Workflow active duy nhất; runs0 trước dispatch, deployments0 sau xuất bản workflow.

## Kết quả actual CI-0, 15/10/2026

[Run38699149083](https://github.com/nguyentronglinh045/pos-cafe-ci-preflight/actions/runs/38699149083), `workflow_dispatch`, `main`, headSHA `d2f3120…`, runnumber1/attempt1. Dispatch07:29:58UTC, completed07:30:09UTC, UI tổng11giây; job07:30:04–07:30:08UTC/4giây. [Run receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/run-final.json), [jobs/steps](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/run-jobs-final.json), [count đúng1run](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/runs-after-one-dispatch.json). Tất cả step success, không retry/rerun/matrix.

| Điều kiện | Bằng chứng actual | Kết quả |
| --- | --- | --- |
| Đúng source/phạm vi | Public repo CI riêng, exact blob/SHA256; không checkout/source POS | PASS |
| Standard runner, timeout | ubuntu-24.04, GitHub Actions group; workflow timeout3phút; image20261004.327.1 | PASS |
| Công cụ bắt buộc | git2.55.0, Node22.23.3, Python3.12.3, Docker CLI/daemon binary28.0.4, containerd2.3.6, unshare2.39.3 | 7/7 PASS |
| CPU/RAM | CPU4; MemTotal16.373.452KiB, MemAvailable15.039.668KiB; cgroup2fs | Đã đo |
| Reserve `/` và RUNNER_TEMP | Trước91.396.554.752bytes; sau91.396.550.656bytes cho cả hai, khoảng85,12GiB; ngưỡng32.212.254.720bytes/30GiB | PASS |
| Namespace mount/net/PID riêng, PID1, loopback | `CI0_NAMESPACE_PROBE_PASS` actual output sau probe | PASS |
| Kết thúc | `CI0_PREFLIGHT_PASS_FULL_STACK_NOT_RUN` actual output, success | PASS CI0 ONLY |

[Log receipt đầy đủ](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/run-log-final.json), [output gọn](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/runtime-output-summary.txt), [kết quả máy đọc](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/runtime-result.json), [ảnh summary](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/ci0-run-success.jpg). Parser chỉ đếm marker ở dòng output có timestamp, không lấy dòng echo trong shell-source GitHub tự in thành bằng chứng PASS.

Public standard runner thuộc diện GitHub công bố miễn phí; không dùng larger/private/self-hosted runner, cache/artifact upload hoặc dịch vụ trả phí. [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Đây là kiểm điều kiện miễn phí theo loại runner/repo, không phải đối soát hóa đơn. Chênh lệch free disk4096bytes không phải phép đo peak task writes hoặc khả năng chứa full stack. Node22 trên runner khác Node24 Windows; CI0 chưa chạy app/tests nên chưa có bằng chứng tương thích ứng dụng ở Node22.

Không cài thêm trên Windows, không tạo WSL/Docker/local stack. Owned proposal/execution khoảng173KB logic trước freeze review; C207.275.470.848bytes/D103.662.850.048bytes trống tại checkpoint. Giữ local receipts/source/ảnh để review và tái hiện; không xóa dữ liệu. Không coi GitHub runner tự kết thúc là đã dọn Windows runtime. Repo CI chỉ có main riêng; không tạo nhánh POS cần merge.

## Giới hạn và bước kế tiếp

D09 đã dùng hết một lượt CI0 cho phép; không tự dispatch lại hoặc chạy bootstrap. CI0 không start daemon/DB, tải image, dựng private evidence, restore/cutover, chạy PIN19/PERM60/HP1 hoặc27stagegate. Supabase online trước đó vẫn legacy/chưa contract2; CI0 không thay trạng thái đó. Giữ Tailwind3/cảnh báo3 không chặn theo D06.

Bước kế tiếp trong kế hoạch là chuẩn bị một gói bootstrap backend Linux riêng: chốt image/runtime theo source hiện tại, ước tính tải/retained/peak trong20GiB và reserve30GiB; chứng minh namespace/cgroup/daemon, dữ liệu/evidence private và không có source/secret POS trong public log; xác định source recovery cùng full gates. Có binary/version và namespace PASS chưa đáp ứng các điều kiện này. Mọi push workflow mới, đưa source lên CI, cài stack hoặc lượt chạy mới cần scope cụ thể được owner giao; không sửa DB online/deploy từ kết quả CI0.

Review runtime sẽ chốt manifest/snapshot riêng cho hồ sơ này, handoff, index và các receipt/source actual; approval proposal02 không thay review actual execution.

Metadata sau freeze: actual candidate01 SHA `c73fc2f7074931040bacc57baa9c0a80aacf890b2176341fbb91fd3c5a2b3549`,55files/160.435bytes, SEC và EVC cùng APPROVE, không findings. [Review actual](../reviews/2026-10-15-permission-linux-ci0-execution.md). Chỉ thêm trạng thái/verdict review vào live docs; frozen candidate/snapshot giữ nguyên. Coordinator kiểm lại833file+2deletionmarker của source Windows, không lệch; không nhận phép kiểm này là scan file mới ngoài manifest. [Preservation receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution-source-preservation-check.json). Phần CI0 trong D09 đã khép đúng phạm vi, các bước backend/deploy chưa mở quyền.
