# Phân quyền — đề xuất bước Linux CI-0, 15/10/2026

**D09 đã thực hiện: đúng một workflow xuất bản ở repo CI riêng, một manual run/attempt1 PASS11giây; SEC/EVC APPROVE actual candidate01.** Đã kiểm Vercel đúng owner và đóng step2; Locofy bỏ khỏi phạm vi theo lệnh owner. Chưa push POS/docs, sửa DB, deploy hoặc xóa. SEC/EVC APPROVE proposal02 là review thiết kế; [actual execution](../../implementation-log/permission-linux-ci0-execution-2026-10-15.md) ở cuối hồ sơ và [kết quả Windows](../../implementation-log/permission-windows-verification-2026-10-15.md) không chứng nhận full backend/phát hành. Những đoạn chờ login/ủy quyền bên dưới giữ làm lịch sử.

## Vì sao cần bước này

Full backend PIN19/PERM60/HP1 vẫn thiếu bằng chứng mới cùng source/backend; CI-0 chỉ đo xem Linux miễn phí có đủ tài nguyên và tạo được namespace cách ly để lập bước bootstrap tiếp theo. Nó không chạy ứng dụng, database hoặc full gates. Quyết định D04 cho hướng Windows trước + Linux CI có điều kiện; D07/D08 chỉ giao thực hiện Windows và sửa đúng một file smoke. Lệnh chưa push/chưa sửa DB/chưa deploy vẫn có hiệu lực. Giữ Tailwind3; cảnh báo dependency3 không chặn theo D06.

Read-only Vercel ngày15/10 xác nhận project `pos-cafe` vẫn nối `24tx810010-hcmute/pos-cafe`: Production theo `main`, auto-domain ON; Preview Branch Tracking ON cho tất cả nhánh chưa gán. Production Ready hiện là `DqnFhDaswqUcqiryL6A2XwDfMmHY`, nguồn `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, trang ghi tạo11/10. Vì vậy việc push nhánh CI vào repo POS cần xử lý tác động Preview trước. [Quan sát UI chỉ đọc](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/vercel-readonly-observation.json) là bản ghi chép từ UI, không phải raw network export. Chỉ đọc tên/scope ba biến Secret, không mở giá trị; binding Supabase vẫn chưa được xác minh.

Vercel hỗ trợ `git.deploymentEnabled` theo nhánh, nhưng chưa thực nghiệm hành vi first-push ở dự án này. Không dùng một giả định chưa kiểm để mở quyền push trong khi owner yêu cầu chưa deploy. [Tài liệu Vercel](https://vercel.com/docs/project-configuration/git-configuration). Không đề xuất đổi Ignored Build Step như bằng chứng chắc chắn không có deployment.

## Gói được đề xuất để duyệt riêng

Đề xuất dùng repo mới **`nguyentronglinh045/pos-cafe-ci-preflight`**, public, độc lập với repo POS/Vercel. Đây là tài khoản CLI đang đăng nhập; GET tên repo trả404 trong lượt khảo sát, chưa chứng minh quyền tạo hoặc chính sách Actions. [Quan sát GitHub](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/github-readonly-observation.json). Nếu owner muốn tài khoản/tên khác, sửa candidate và review lại trước thực hiện; không tự chọn thay thế.

Payload duy nhất: [.github/workflows/permission-linux-preflight.yml](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/payload/.github/workflows/permission-linux-preflight.yml). Đây là **candidate cục bộ**, chưa nằm trong `.github` của checkout chính và chưa được đưa lên GitHub. Repo mới không chứa app source, SQL, tài liệu nội bộ, fixtures, raw evidence, `.env`, PAT hoặc credential.

Nếu owner cho phép đúng gói này, thứ tự thực hiện sẽ là:

1. Kiểm lại tài khoản/tên repo, quyền tạo, public/Actions standard miễn phí; không thêm phương thức thanh toán hoặc đổi chính sách tài khoản. Tạo repo trống, không fork/import, không cài App/integration. Nếu tên tồn tại hoặc quyền/chính sách không đủ thì dừng, không sửa repo sẵn có.
2. Xác minh repo mới không nối project Vercel, không deploy hook, workflow khác, environment/secret hoặc integration triển khai được cấu hình cho nó. Không chuyển secret/settings từ POS. Nếu không xác minh được điều kiện tránh deploy thì dừng trước push; không ngắt integration của POS.
3. Dùng thư mục Git nhỏ riêng trong owned proposal root, không clone source/module/runtime POS. Commit/push đúng một file workflow lên `main` của **repo CI mới**. Workflow chỉ có `workflow_dispatch`; push không tự chạy CI. Không push `main`, `docs` hoặc nhánh khác của repo POS.
4. Kiểm file/commit trên GitHub khớp payload đã duyệt, repo vẫn public và chỉ có workflow này. Dispatch thủ công **đúng một lượt** trên commit/ref đó, `ubuntu-24.04` standard, tối đa3phút. Không tự retry, mở matrix hoặc chuyển sang runner trả phí.
5. Giữ URL/runID/SHA, log metadata và kết quả guard. Kết quả thiếu điều kiện hoặc lỗi là BLOCKED/chưa đủ bằng chứng; không đổi thành PASS. Chỉ sau đó lập bootstrap/full backend riêng; scope này không cho cài stack hoặc đưa source POS vào CI.

Đây là ngoại lệ push **chỉ repo CI mới**, cần owner giao rõ trước làm. Chọn giữ toàn bộ no-push cũng là phương án hợp lệ: giữ payload cục bộ và tạm dừng phần Linux; không tự quay lại WSL/Docker hoặc thay runner trả phí.

## Phạm vi, chi phí và dung lượng

Workflow dùng `permissions: {}`, exact repo/ref/manual-event/public guards; không checkout, `uses`, install/npm, tải image/browser, daemon start, database, secret, cache, upload artifact hoặc gọi network bằng script. Chỉ đọc whitelist: SHA/image/kernel, CPU/memory/free disk, phiên bản công cụ có sẵn. Không dump environment, token, thông tin người dùng hoặc source. Namespace probe ngắn hạn dùng mount/net/PID riêng và loopback; tự kết thúc, không giữ stack.

Standard GitHub-hosted runner cho repo public được GitHub công bố miễn phí; Ubuntu24.04 public công bố4CPU/16GBRAM/14GBSSD. Actual free vẫn phải đo, không suy từ tên image. [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Chỉ dùng loại standard đó; private/larger runner hoặc điều kiện tính phí khác thì dừng. Không có payload artifact/cache hoặc dữ liệu nhạy cảm cần giữ private trên Actions; log metadata sẽ công khai cùng repo. Không thay privacy/ACL của dữ liệu POS.

Giữ guard hiện hành: trước/sau namespace phải còn **30GiB trống** ở `/` và `$RUNNER_TEMP`; nếu không đủ thì báo `CI0_BLOCKED_DISK_RESERVE_30_GIB` và không probe/cài gì thêm. Task budget20GiB không đổi. Không hạ reserve theo14GB quảng bá và không nhận CI-0 PASS là full-stack peak đã đo. Timeout/guard tiến trình không phải quota filesystem kỹ thuật.

Không cài công cụ trên Windows. Dữ liệu cục bộ mới chỉ payload/Git metadata/receipts/log metadata, ước tính thấp hơn10MB, trần vận hành50MiB cho slice này; kiểm C/D còn≥30GiB trước ghi. Không copy node_modules, tạo môi trường nặng thứ hai hoặc xóa dữ liệu. Bản Windows hiện tại còn giữ cho review/tái kiểm. VM Linux là runner tạm do GitHub cung cấp; proposal không tải hoặc lưu image/VHD trên máy người dùng. Kích thước VM nền và log hệ thống do GitHub quản lý không phải số đo task writes; chưa có quota hệ điều hành cho chúng.

## Expected và điều chưa được mở

CI-0 PASS cần đủ reserve, **cả7tool `git`, `node`, `python3`, `docker`, `dockerd`, `containerd`, `unshare`** hiện diện/đọc được version, `sudo -n` dùng được, namespace mount/net/PID khác parent, PID1 và loopback hoạt động; in `CI0_NAMESPACE_PROBE_PASS` và `CI0_PREFLIGHT_PASS_FULL_STACK_NOT_RUN`. Thiếu bất kỳ tool trong list thì in `CI0_BLOCKED_REQUIRED_TOOL`, exit1 trước namespace; không chỉ in UNAVAILABLE rồi cho PASS. Có binary/version không chứng minh Docker daemon/service stack chạy được; phần đó thuộc bootstrap sau. Không đủ điều kiện thì giữ BLOCKED và trình owner bước tiếp theo. Lỗi syntax/runtime không được coi là thiếu tài nguyên đã chứng minh.

Không mở quyền chạy SQL, backup/restore/cutover hoặc triển khai Edge/Vercel. Supabase mới qua MCP read-only vẫn legacy/chưa permission contract2; [Windows log](../../implementation-log/permission-windows-verification-2026-10-15.md) ghi rõ6SELECT và giới hạn. CI-0 không kiểm hoặc thay backend online. Không giảm coverage/gate, không dùng evidence lịch sử làm PASS nguồn mới, không thay đổi Tailwind.

Kiểm tĩnh cục bộ: PyYAML6.0.3 parse và Git Bash `-n` cho outer/inner script đạt, không thực thi shell body. [Receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/local-syntax-check.json). Chưa có actionlint/GitHub workflow-schema hoặc actual runner proof; không tải công cụ để thêm kiểm tra.

Hai reviewer độc lập đã rà candidate02 trước khi đề nghị owner cấp quyền; [hồ sơ review](../../reviews/2026-10-15-permission-linux-ci0-proposal.md). Review proposal chỉ đánh giá tính rõ ràng/phạm vi/guard, không chứng nhận workflow đã chạy hoặc quyền phát hành. Tại freeze02 owner chưa quyết định; D09 bên dưới là quyết định mới sau đó, không sửa snapshot cũ.

## PLAN-D09 — owner giao thực hiện, 15/10/2026

Nguồn: tin nhắn trực tiếp của chủ dự án: “Đồng ý tạo repo CI riêng và chạy một lượt CI-0 miễn phí như đề xuất. Chỉ push workflow, chưa push thay đổi phân quyền/docs, chưa sửa database hay deploy Vercel. Có gì cần quyết định thì hỏi và đợi tôi.” Scope: đúng repo public/tài khoản/payload của candidate02, một lượt manual CI0 miễn phí; không thêm run hoặc đổi điều kiện step2/guard. D09 thay trạng thái chờ owner của proposal, không mở code POS/docs push, DB, Vercel, cài stack hoặc cleanup.

Đã tạo repo trống và chuẩn bị local commit1file; [checkpoint thực hiện](../../implementation-log/permission-linux-ci0-execution-2026-10-15.md). SEC trả BLOCKED trước first push vì chưa kiểm được App/integration áp dụng cho repo mới: API403 và IAB GitHub chưa đăng nhập. Không cần xin lại D09, cần bổ sung bằng chứng qua login/đọc Settings. Không được suy API403 thành không có integration hoặc bỏ điều kiện dừng.

Checkpoint tiếp theo sau người dùng đăng nhập: đã đọc đúng GitHub Settings, hai App Vercel/Locofy áp dụng mọi repo hiện tại/tương lai của nguyentronglinh045. Phiên Vercel đang kiểm nối GitHub24tx810010-hcmute; một team/một project POS không phủ mapping của chủ repo CI. SEC vẫn BLOCKED trước push, cần đọc đúng provider mappings hoặc owner xác nhận cụ thể cả chưa import/liên kết CI repo và không có automation tự gắn/deploy repo mới. Chưa thay App permissions hoặc chấp nhận yêu cầu cập nhật quyền Vercel.

## Owner bỏ kiểm Locofy trong scope CI0, 15/10/2026

Nguồn tin nhắn trực tiếp trả lời câu hỏi login provider: “không cần locofy đâu”. Áp dụng là bỏ bước đăng nhập/kiểm mapping Locofy trong lượt CI0 này; không suy thành App không tồn tại hoặc đã chứng minh không có automation. Đã đóng tab login Locofy, giữ nguyên App/quyền cài đặt. Điều kiện xác minh đúng Vercel trước push, một workflow/một run miễn phí, noPOS/docs push/noDB/noVerceldeploy và các guard khác giữ nguyên. [Scope receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/execution/scope-locofy-deferred.json). Chờ người dùng hoàn tất2FA Vercel; không đọc mã hoặc callbackquery.

## Actual CI0 sau khi owner hoàn tất Vercel login

**CI0 PASS, SEC/EVC APPROVE actual candidate01.** Đã kiểm đúng account/team Vercel, không project nào nối repo CI; SEC đóng blocker step2 theo scope bỏ Locofy. CLI push bị từ chối thiếu `workflow` scope, remote vẫn trống; chuyển sang web GitHub session hiện có, không tăng quyền. GitHub tạo root commit `d2f3120960a8786b3fff36e116ae99ff0de1427c`, chỉ một file workflow, payload SHA256 khớp candidate02 nguyên byte; local commit `68b886a…` không được push.

Đúng một [manual run38699149083](https://github.com/nguyentronglinh045/pos-cafe-ci-preflight/actions/runs/38699149083), attempt1, success11giây. Ubuntu24.04standard/public, đủ7tools, free trước/sau khoảng85,12GiB>30GiB, namespace probe PASS. [Biên bản/receipt/source actual](../../implementation-log/permission-linux-ci0-execution-2026-10-15.md). D09 đã dùng hết một lượt; không tự chạy tiếp. Các đoạn repo trống/chờ2FA phía trên là lịch sử trước execution.

Chưa chạy stack, DB, PIN19/PERM60/HP1/full gates; chưa chứng minh peak20GiB/private retention/bootstrap hoặc deploy readiness. Không push POS/docs, sửa Supabase, deploy Vercel hoặc xóa gì. CI repo dùng main riêng, không có nhánh POS mới cần merge. Bước tiếp theo là chuẩn bị gói bootstrap/Linux backend theo ngân sách/privacy/gate giữ nguyên rồi xin scope chạy cụ thể; CI0 PASS không mở quyền đó.

Metadata review sau freeze: candidate01 SHA `c73fc2f7074931040bacc57baa9c0a80aacf890b2176341fbb91fd3c5a2b3549`, SEC/EVC đều APPROVE, không findings; [review actual](../../reviews/2026-10-15-permission-linux-ci0-execution.md). Snapshot55files giữ nguyên, bổ sung này chỉ ghi kết quả review; D09 không cấp lượt chạy tiếp.
