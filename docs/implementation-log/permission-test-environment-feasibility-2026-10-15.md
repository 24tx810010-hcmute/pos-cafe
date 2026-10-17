# Khảo sát môi trường kiểm thử không phát sinh tiền — 15/10/2026

Addendum khảo sát CI1 cùng ngày: [kiểm mới6input gốc trên Windows](permission-linux-ci1-survey-2026-10-15.md) đều còn và SHA256 khớp; chỉ staging source40 trong WSL không còn. Không được diễn giải đoạn bootstrap lịch sử bên dưới thành mất toàn bộ input hoặc đã restore tương đương. CI0 public đã PASS; owner chọn khảo sát public CI+bằng chứng mã hóa/private identity chỉWindows, chưa duyệt thiết kế hoặc chạy. [Gói local CI1](../workflow/tasks/permission-linux-ci1-local-proposal-2026-10-15.md) giữ budget/privacy/full gates và no-push/no-DB/no-deploy.

## Kết luận đúng phạm vi

**Cập nhật sau khảo sát:** owner đã hoãn Tailwind4 và cho bỏ qua cảnh báo Tailwind3 trong điều kiện phát hành theo [PLAN-D05/D06](../workflow/tasks/permission-vercel-readiness-plan-2026-10-15.md#plan-d05). Các mốc “chờ upstream/BLOCKED do Tailwind” bên dưới là lịch sử khảo sát, không còn là blocker hiện hành. Môi trường/coverage/privacy/ngân sách và quyền hosted giữ nguyên; [gói chuẩn bị Windows/Supabase/Vercel](../workflow/tasks/permission-deployment-preparation-2026-10-15.md) ghi việc tiếp theo.

**Owner đã chọn kế hoạch kết hợp Windows cho chuẩn bị/kiểm nhẹ và Linux CI có điều kiện cho các gate Linux theo PLAN-D04.** GitHub Actions Ubuntu tiêu chuẩn là phương án CI đã khảo sát, chỉ dùng nếu preflight chứng minh đủ điều kiện. Quyết định mới chỉ chốt kế hoạch, chưa phải môi trường đã được dựng hoặc chạy đạt. Windows hiện có không thay full PIN19/PERM60/HP1. GitHub CI có đường chạy miễn phí về minutes, nhưng full runtime, dung lượng và cách giữ private evidence chưa được chứng minh.

Tại mốc khảo sát trước D05/D06, user đã chọn **giữ Tailwind 3, tiếp tục chờ upstream và giữ phát hành BLOCKED**; thiết bị/browser trả lời “chưa biết”. Scope lúc khảo sát chỉ là nghiên cứu Linux ngoài máy hoặc Windows sẵn có, ưu tiên không tốn tiền; không cài/chạy. D06 thay phần chặn Tailwind; [D07](../workflow/tasks/permission-vercel-readiness-plan-2026-10-15.md#plan-d07) sau đó giao giai đoạn Windows cụ thể, không giao CI/hosted hoặc automation.

Lượt này chỉ đọc source/config/metadata, GitHub GET và tài liệu chính thức; không chạy test/browser/framework, không cài/tải stack. Evidence nhỏ lưu tại `D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/`. [Kế hoạch có điều kiện](../workflow/tasks/permission-vercel-readiness-plan-2026-10-15.md).

## GitHub: điều đã kiểm và điều chưa có quyền xác minh

| Phép đọc mới | Kết quả | Giới hạn |
| --- | --- | --- |
| Repo GET qua connector và gh | `24tx810010-hcmute/pos-cafe`, **public**, default branch main; credential đang dùng có push=true nhưng admin/maintain=false | Không coi quyền kỹ thuật push là lệnh owner cho push |
| Workflows và runs GET qua gh | Cả hai total_count=0 | Chưa có workflow/run để dùng ngay; không suy Actions bị tắt |
| Actions permissions GET | HTTP403 | Chưa xác minh policy enable/allowlist; cần đúng credential/scope hoặc owner quan sát khi đến bước triển khai, không tự xin quyền admin |
| Billing/remaining artifact quota | Chưa quan sát | Owner repo khác login gh đang dùng; không suy plan/quota của owner từ tài khoản CLI hoặc public visibility |

Connector không hỗ trợ hai URL actions/permissions và actions/workflows (allowlist400); đã dùng CLI GET để đối chiếu, không mutation. Receipts [repo](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/github-repo.json), [workflows](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/github-workflows.json), [runs](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/github-runs.json), [policy403](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/github-policy-read.json).

Theo [GitHub runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), Ubuntu24.04 x64 tiêu chuẩn cho public repo có 4CPU/16GB RAM/14GB SSD và minutes miễn phí, không giới hạn. Đây là thông số công bố, không phải free disk/peak đã đo; không áp cấu hình private2CPU/8GB vào repo này. Full VM có sudo, nhưng chưa chứng minh namespace/cgroup/profile cụ thể của runner dự án hoạt động. Không chọn ubuntu-slim cho gate cần mount/namespace/Docker.

Theo [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), artifact/cache có cơ chế allowance riêng; larger runner luôn bị tính tiền. Phần minutes miễn phí không bảo đảm storage hoặc toàn tác vụ miễn phí. Trong thiết kế pilot đề xuất: chỉ standard Ubuntu, không VM trả phí/Codespaces/larger runner, không cache hoặc upload artifact mặc định; chưa thêm payment method, thay budget hoặc chạy gì. Full gate cần evidence vẫn phải có retention hợp lệ trước khi chạy, không bỏ evidence để giữ zero cost.

[Artifact access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) và [log access](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs) gắn với read access; trên public repo không được coi chúng là private storage. Không đưa hosted credentials, raw backup, SQL/session raw hoặc synthetic secret vào stdout/public artifact. Mã hóa artifact chỉ là hướng cần thiết kế/key custody/replay/ACL review riêng, chưa được nhận là tự đáp ứng policy hoặc được owner cho phép. Không đổi repo visibility/privacy/ACL để giảm chi phí.

## Windows hiện có

Metadata mới: Node24.16.0/npm11.13.0 tại D:/tools/nodejs; cache D:/tools/npm-cache tồn tại nhưng chưa biết đủ package cho offline install. Chromium/headless-shell revision1223 có executable trên C, đúng descriptor của playwright-core1.60.0 đang resolve; có cả cache1234. Chưa kiểm integrity hoặc launch browser, chưa chứng nhận Safari/Firefox/thiết bị thật.

**Không chỉ lệch lock: graph hiện cài còn có dependency không thỏa metadata của chính package đang dùng.**

| Package đang cài | Yêu cầu dependency | Module thực resolve |
| --- | --- | --- |
| Vite8.2.1 | rolldown~1.2.1 |1.0.3 |
| @playwright/test1.62.1 | playwright1.62.1 |1.60.0 |
| coverage-v8 4.1.11 | Vitest4.1.11 |4.1.10 |

11direct dependencies lệch exact version lock vẫn còn. [Receipt metadata/module resolution](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/windows-observation.json) và [collector chỉ đọc](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/collect-windows.mjs) ghi đầy đủ. Nguồn: [Vite requirement:62](D:/Workspace/pos-cafe/node_modules/vite/package.json:62), [Playwright:33](D:/Workspace/pos-cafe/node_modules/@playwright/test/package.json:33), [coverage:71](D:/Workspace/pos-cafe/node_modules/@vitest/coverage-v8/package.json:71). Audit trước có hai typecheck PASS; không suy build/unit/browser của graph này chắc chắn fail hoặc PASS khi chưa chạy.

| Nhóm kiểm | Khả năng Windows | Điều kiện để dùng làm bằng chứng |
| --- | --- | --- |
| TypeScript không emit | Có binary, audit trước PASS | Ghi đúng environment, không gọi clean-lock verification |
| Unit/component/mock | Có Node/Vitest/jsdom recipe | Cần bản cài đúng lock và actual run trước kết luận |
| Pure tooling | Có Node config | Phải phân loại từng suite: một số chạy process/browser/temp; không gọi toàn bộ tooling là chỉ đọc |
| Build/mock smoke/UI | Có recipe, có cache Chromium | Giải graph, kiểm browser và chốt output/temp scope; build ghi dist/buildinfo, audit ghi report/ảnh. Mock/viewport không thay backend hoặc thiết bị thật |
| SQL/Storage/Realtime/Edge/PIN19/PERM60/HP1 full | **Chưa đáp ứng trên Windows hiện có** | Runtime hiện gọi WSL/Docker; native Auth/REST scaffold ghi rõ thiếu Storage API/Realtime |

Nguồn: [package scripts:8](D:/Workspace/pos-cafe/package.json:8), [Vitest:8](D:/Workspace/pos-cafe/vitest.config.ts:8), [permission tooling:7](D:/Workspace/pos-cafe/vitest.permission-tooling.config.ts:7), [mock smoke:15](D:/Workspace/pos-cafe/playwright.config.ts:15), [UI audit:21](D:/Workspace/pos-cafe/ui-audit/run.mjs:21), [PIN runtime:18](D:/Workspace/pos-cafe/scripts/permission-pin-identity-runtime.mjs:18), [native omissions:83](D:/Workspace/pos-cafe/scripts/idempotency-auth-bootstrap.mjs:83).

Chi phí phần mềm bổ sung cho việc đọc/chuẩn bị bằng công cụ Windows đã có là0đồng; không có cam kết npm cache đủ để cài lại không tải mạng. Trước install phải ước tính download/install/peak và đo C+D, báo **LỚN HƠN 1 GB** nếu tổng vượt1.000.000.000bytes. Chưa có upper bound đầy đủ nên chưa cài. Không copy node_modules Windows sang Linux; native bindings phải đúng OS/arch/runtime.

## Linux CI: phần phải làm trước khi nhận khả thi

1. **Fresh bootstrap phục hồi được.** [prepare-linux.py:12](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prepare-linux.py:12) dùng config/schemaArchive/roles/metadata/fixture/diversity/scopeApproval nguồn40 trong /var/tmp. Không thể dựa trên distro đã xóa hoặc coi tar source58 chứa raw đó. Cần recipe mới từ nguồn còn phục hồi được, đủ schema/roles/fixture/profile và kiểm equivalence; không dùng kết quả synthetic thay dữ liệu hosted.
2. **Portable runtime có guard.** Recipes hardcode /mnt/d, /var/tmp, Git paths, CLI2.117.0, image/config/identity. [Bridge runtime:16](D:/Workspace/pos-cafe/scripts/permission-bridge-runtime.mjs:16) gọi wsl vô điều kiện; shim lịch sử chỉ thực thi allowlist lệnh đọc. [Namespace:6](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/start-gate-namespace.py:6) cần unshare/mount/net/pid/cgroup và daemon riêng. Runner có sudo chưa là proof recipe này đã chạy; phải pin hoặc khai báo runtime mới rồi kiểm, không giả tuple lịch sử.
3. **Disk/RAM/peak.** Image archive lịch sử12images là1.998.099.968bytes (~1,86GiB), chưa gồm unpack/image store/node/browser/DB/clone/evidence: [inputs:17](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/gate-isolation-inputs.json:17). Không được save/load trùng vô hạn data roots. Không có đo mới chứng minh peak dưới14GB. [Supabase workflow](https://supabase.com/docs/guides/local-development/cli-workflows) khuyến nghị7GB RAM cho full services;16GB công bố có triển vọng cho một profile nhưng chưa phải resource proof.
4. **Giữ nguyên giới hạn.** Luật hiện hành giữ tối thiểu30GiB trống C/ổ runtime và task tăng≤20GiB. Runner công bố14GB không bảo đảm đạt ngưỡng free30GiB. Trước ghi lớn phải đo actual filesystem và chứng minh guard được đáp ứng; nếu không đạt thì STOP. Chưa đề xuất hoặc áp ngoại lệ remote budget. Không dọn phần mềm preinstalled hay system prune để tạo chỗ, không tự thuê runner lớn. Nếu cần đổi guard phải trình owner bằng số đo và phạm vi riêng.
5. **Không shard làm mất binding.** [Aggregate:117–145](D:/Workspace/pos-cafe/scripts/permission-aggregate-verify.mjs:117) đòi đúng một run/profile/stage và candidate backend+fixtureIds+markerProof+apiBinding duy nhất; [collector:25](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/collect-perm.mjs:25) đòi27stages không overlap. Đề xuất chia tuần tự theo profile khi hợp lệ, giữ candidate service trên một job/backend; không matrix nhiều backend rồi sửa JSON/hash để ghép. Relocation/report graph cần resolver được review. Giữ đầy đủ PIN55browser/41SQL/1canary/2operator và PERM60/726variants, không giảm denominator.
6. **Retain private evidence trước run.** CI VM mất khi job kết thúc; chỉ giữ safe summary không đủ khi gate cần raw replay. Cần kênh riêng có quyền/retention/chi phí đã được xác minh. Không lấy cache làm archive, không tự upload public raw hoặc làm mất proof để tránh phí. Full pilot còn BLOCKED nếu chưa có phương án đạt cả privacy và ngân sách.

## Pilot đề xuất — chưa được giao chạy

Pilot có hai pha, một lần thử, không auto-retry:

- **CI-0:** chỉ kiểm runner/runtime/tools/free disk/RAM/namespace/cgroup/policy bằng output whitelist, không tải stack hoặc kết nối production. Đây là kiểm khả thi, không test nghiệm thu. Chỉ được thực thi khi có đường trigger và quyền chạy riêng.
- **CI-1:** chỉ sau CI-0 đạt, có upper bound download/install/peak, guard đủ, fresh bootstrap và retention được duyệt. Chạy một profile synthetic đại diện gồm Auth/Storage/Realtime/Edge/preservation, ghi peak/duration/source/npm/image/actor binding. Thiếu điều kiện thì không chuyển pha. PASS pilot không là full gate.

Hiện **no-push** và repo không có workflow; không thể dispatch candidate chưa được đưa lên GitHub. Bước đưa workflow/source lên nhánh riêng cũng là push cần lệnh owner. Nhánh đó có thể kích hoạt Vercel Preview theo cấu hình Git cũ, nên phải xác minh/chặn auto-deploy bằng phương án được duyệt trước. Không dùng upload/CLI deploy để vòng qua no-push. Chưa tạo YAML executable trong repo hoặc thay provider settings.

## Khuyến nghị và giới hạn mục tiêu

Kế hoạch nên chuẩn bị Windows trước, khảo sát hosted control C/Storage/L song song ở mức chỉ đọc, và giữ CI Linux là môi trường đề xuất cho phần Windows không thể phủ. Full gates chỉ chạy trên source/lock cuối và môi trường được chứng minh, tránh tốn công lặp sau dependency changes. Windows-only giúp tiến lên ở tầng nhẹ nhưng **không đủ khép sản phẩm/running Vercel theo acceptance hiện tại**.

Tại mốc khảo sát trước PLAN-D06, giữ Tailwind3/chờ upstream làm dependency gate BLOCKED. **D06 đã thay phần chặn đó:** cảnh báo Tailwind3 không chặn theo quyết định owner; không tự nâng4. Chưa được nhận đủ điều kiện push main/phát hành khi clean-lock/full gates/hosted chưa đạt. Không tạo lịch theo dõi hoặc hứa thời điểm hoàn tất.

**Cập nhật quyết định sau khảo sát, 15/10 — PLAN-D04:** owner đã chọn “Kết hợp Windows trước + Linux CI có điều kiện, giữ nguyên coverage/privacy/ngân sách và dừng nếu không đủ điều kiện miễn phí”. [Nguồn và hệ quả quyết định](../workflow/tasks/permission-vercel-readiness-plan-2026-10-15.md#plan-d04) lưu trong kế hoạch. Phương án chỉ Windows/hoãn CI không được chọn. Việc chọn **kế hoạch** không cho phép cài, sửa code/DB, push, trigger CI hoặc phát hành. Chưa có số đo/pilot/chi phí/retention mới từ câu trả lời; các điều kiện và giới hạn khảo sát giữ nguyên. Các chốt budget/privacy/provider/action cụ thể để đúng thời điểm sau khi có gói review được; không xin blanket approval trong khảo sát này.
