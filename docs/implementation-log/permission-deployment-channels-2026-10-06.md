# Khảo sát kênh triển khai phân quyền — 2026-10-06

## Đề bài, phạm vi và trạng thái

Sau [slice guard provider](permission-provider-capability-guard-2026-10-06.md), chủ dự án yêu cầu: “ok phần tiếp theo là gì? ta cứ làm theo từng scope nhỏ và đảm bảo kết quả đầu ra nhất có thể (có subagent nhé)”. AI chọn khảo sát **chỉ đọc** kênh Supabase/Edge/Storage và Vercel, theo gói1 trong [kế hoạch đóng task](../workflow/tasks/permission-closeout-review-2026-10-05.md). Đầu ra là điều đã xác minh, điều còn thiếu và tiêu chí cho lần đọc có xác thực tiếp theo. Đây là bước phân tích của task hiện hành, không tạo change/spec nghiệp vụ mới.

Trong lúc khảo sát, chủ dự án nêu ràng buộc: “liệu nó có gửi mai kết nối về mail đăng kí codex không (tôi không muốn nó gửi mail về mail đăng kí)”. Chưa chọn đường kết nối đáp ứng ràng buộc này. Không bắt đầu login, cấp quyền OAuth, cài/kết nối plugin hoặc tạo credential. Tiếp tục phần độc lập: đọc source/config, metadata GitHub, HTTP công khai và ghi hồ sơ.

**Management có xác thực còn chờ kết nối.** Kết quả khảo sát ở dưới; review/bàn giao ở [biên bản](../reviews/2026-10-06-permission-deployment-channels.md). Chưa chứng minh kênh sẵn sàng deploy; sản phẩm chưa đóng/chưa phát hành. Không DDL/grants/cleanup/deploy, sửa code/config, commit/push hoặc tạo chat.

## Source, môi trường và bằng chứng

- Code: `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479` cộng working tree. Fingerprint trước/sau probe `30dd5664e47f670e1c208151407c58b5dbb71943ca30d8a57f17de49051c1bad`, không đổi. Snapshot706 đường dẫn ở slice guard vẫn là nguồn có thể khôi phục; proofs cũ không thành gate tổng trên source này.
- Docs: `D:/Workspace/pos-cafe-docs`, nhánh `docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, bổ sung worktree chưa commit và giữ thay đổi trước. Không switch/reset/stash hoặc chép docs lên main.
- Probe Windows/Node `v24.16.0`/GitHub CLI hiện có: helper [read-channel-evidence.mjs](D:/Workspace/pos-cafe/artifacts/permission-deployment-channels-20261006/read-channel-evidence.mjs), `gh repo view`, `gh api --method GET`, đọc local config/presence và public HTTP GET. Chạy bằng Node từ code root, exit0, `2026-10-06T04:08:28.100Z`–`04:08:33.920Z`. Probe JS công khai sau đó tại `04:09:43.289Z`.
- Chrome qua extension của Codex: hai tab do AI tạo chuyển sang trang login; lưu ảnh, không nhập credential/bấm login/consent. Đã đóng hai tab sau khảo sát, không thay tab người dùng. Không dùng Playwright MCP.
- Không đọc token/cache/plaintext credential. Chỉ ghi boolean cho bốn biến env quản trị và sự tồn tại ở các vị trí cụ thể; không quét toàn máy hoặc suy không có credential nơi khác.
- Artifacts: `D:/Workspace/pos-cafe/artifacts/permission-deployment-channels-20261006/`. `channel-evidence.json` là response được lọc; `public-asset-evidence.json` giữ URL/hash/hostname, không lưu JS/key. `session-observations.json` là **bản ghi lại tool result của tác giả**, không phải authenticated provider response. `evidence-manifest.json` giữ hash của receipts/helper/hai ảnh; candidate/snapshot review theo biên bản.

## Kết quả theo kênh

| Phép kiểm | Bằng chứng | Kết luận và giới hạn |
| --- | --- | --- |
| PostgreSQL/TLS | [Probe live trước cùng ngày](permission-release-capabilities-2026-10-06.md), không query lại | DB read-only đã kiểm; hosted DDL/reload còn pending; không chứng minh quyền Edge/Storage |
| GitHub | Đọc repo `24tx810010-hcmute/pos-cafe`, default branch `main`, API ref vẫn `ef2c372aec60d8362549e47b7aedb27126129479` | Metadata đọc thành công. Code phân quyền còn local; không thử quyền ghi |
| Deployment GitHub | Đọc20 bản mới nhất. Bản tên environment `Production` mới nhất trong danh sách: `6430580267`, SHA `ef2c372…`, creator `vercel[bot]`, status `success`, tạo `2026-09-14T04:40:44Z` | Đọc lại hôm nay **bản ghi lịch sử**. Trường `production_environment=false` dù tên là Production; giữ cả hai trường, không dùng để xác nhận môi trường Vercel hôm nay |
| Vercel commit status | Context `Vercel`, success14/09, URL `https://vercel.com/24tx810010-hcmutes-projects/pos-cafe/31AizN1RSmqKLLQ1kgNY6pJeHQm6` | Có địa chỉ lịch sử project/deployment; chưa đọc project/team ID, domain, Production branch hoặc auto-deploy hiện tại từ provider |
| GitHub workflows | API hiện trả `total_count=0`; local không có `.github` | Không có workflow trong tập API trả; không suy Vercel Git integration tắt hoặc không thể deploy |
| Frontend công khai | `https://pos-cafe-azure.vercel.app/` HTTP200, title `POS Cafe`; HTML SHA `2a7fc4f2a0b7219c636d4a1497cf3336ec297a6cd805df55ca829bf8a7d0911d` | Chứng minh trả HTML tại snapshot; không chứng minh source, quyền deploy, business flow hoặc domain→deployment binding |
| JS được HTML chỉ ra | `/assets/index-CfdNnUcO.js` HTTP200;1.405.737 byte; SHA `74bc45fea095942a74ca64f31ddd8712ed3143d04b1ad9c7ec25d6eeeb073eac`; phép tìm literal chỉ thấy Supabase hostname `kfqjdfwxhkdwihjobpny.supabase.co` | Có địa chỉ đích đã duyệt trong bundle. Chỉ occurrence tĩnh; không xác nhận runtime, env provider hoặc equality với candidate local |
| Supabase MCP local | [Survey trước](permission-release-capabilities-2026-10-06.md): config enabled/đúng project, CLI nhãn `o_auth`; catalog slice này0 Supabase/0 Vercel | Chưa có authenticated management request. Không kết luận OAuth hết hạn hoặc project unhealthy |
| Plugin discovery | Supabase/Vercel available/enabled, `installed=false`; đã gợi ý, chưa xác nhận cài/kết nối | Khác kênh MCP local đã cấu hình; directory listing không tạo quyền hoặc chứng minh kết nối |
| Supabase browser | URL project chuyển tới `dashboard/sign-in?returnTo=%2Fproject%2Fkfqjdfwxhkdwihjobpny`, heading `Sign in to your account` | Profile được chọn cần login; không suy trạng thái MCP hoặc account ở profile khác |
| Vercel browser | `/dashboard` chuyển tới `login?next=%2Fdashboard`, heading `Log in to Vercel` | Chưa đọc metadata quản trị project/Production settings |
| CLI/link/env local | Supabase/Vercel không thấy trong PATH đã kiểm trước; vị trí local đã chọn không có binary/auth file; không có `.vercel/project.json`, `supabase/config.toml`; `.temp` chỉ `cli-latest`; bốn biến management absent | Chưa tìm thấy đường dùng ngay trong tập được kiểm; không kết luận toàn máy không có credential/CLI. Không init/link/default deploy để thử |
| Edge/Storage API | Không authenticated request | **NOT_VERIFIED**; DB catalog/HTML/GitHub status không thay phép đọc này |

## Vấn đề kỹ thuật cần xử lý

### Quyền DB và triển khai nhiều dịch vụ

[Guard local](permission-provider-capability-guard-2026-10-06.md) chứng minh DDL cụ thể trên clone có binary/profile pin, không tạo credential quản trị Edge/frontend. [Supabase deployment](https://supabase.com/docs/guides/functions/deploy) yêu cầu authenticate, xác định/link project rồi deploy function. Chỉ đọc đúng đích trước khi dùng kênh đó; chưa thực hiện các lệnh deploy trong khảo sát.

Controller [config:81](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:81) không có lệnh triển khai Edge/frontend; [checkpoint:651](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:651) còn `PENDING_STORAGE_API` sau xác nhận DB commit. Thành công DB controller chưa chứng minh Storage bytes cleanup hoặc rollout phối hợp đã xong.

### Vercel binding và thứ tự phát hành

[vercel.json:3](D:/Workspace/pos-cafe/vercel.json:3) chỉ pin Vite/`npm ci`/`npm run build`/`dist`/SPA rewrite, không có project/team ID. [CLI linking](https://vercel.com/docs/cli/project-linking) lưu org/project ID trong `.vercel/project.json`; thiếu file này chưa phủ nhận đường Git/API.

[Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github) hỗ trợ deploy tự động khi push/merge. **Suy luận:** nếu integration/Production branch vẫn bật, push client trước khi DB/Edge đủ dependency có thể phát hành sớm. Status14/09 không xác nhận setting hôm nay. Gate trước push phải đọc project/repo/Production branch/domain binding, auto-deploy/ignored build và build config; không tự tắt integration hoặc tạo project khác.

Candidate frontend nhận mode/URL/key: [runtimePorts:16](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:16) dùng mode rõ ràng hoặc chọn theo URL/key; [client:32](D:/Workspace/pos-cafe/src/adapters/supabase/client.ts:32) yêu cầu URL/key nhưng không pin với đích đã duyệt. Provider readback cần tên/phạm vi Production của `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; ghi hostname và key presence, không xuất key. Literal trong JS cũ không thay bước này cho build mới.

### JWT của hai Edge function

| Candidate | Thiết kế/source hiện có | Metadata cần đọc |
| --- | --- | --- |
| `menu-image-gateway` | [design:195](../../openspec/changes/redesign-permission-model/design.md): `verify_jwt=true`. [source:7](D:/Workspace/pos-cafe/supabase/functions/menu-image-gateway/index.ts:7) dùng URL/anon/server service key; RPC kiểm employee/quyền | Tên, version/status, JWT setting, runtime/config và tên secret trên đúng project; không dump giá trị |
| `menu-image-public` | [design:196](../../openspec/changes/redesign-permission-model/design.md): `verify_jwt=false` riêng function này. [source:9](D:/Workspace/pos-cafe/supabase/functions/menu-image-public/index.ts:9) GET-only, lookup published rồi đọc private object | Cùng metadata; không dùng `--no-verify-jwt` cho toàn functions hoặc authenticated fetch thay anonymous GET gate |

Chưa có root `supabase/config.toml` pin settings triển khai. Đây là thiếu metadata local, chưa chứng minh hosted sai/chưa có functions. Cần xác định và review cách pin hai settings trong runbook/config trước deploy; chưa sửa trong khảo sát.

### Storage API và dữ liệu

[permission-images.sql:4](D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:4) thiết lập private `menu-item-image-staging`, limit5MiB, MIME JPEG/PNG/WebP khi activation. Inventory có xác thực cần bucket public flag/limits/MIME và object metadata cần thiết, xác định route API. Candidate bucket/function chưa có thì ghi `ABSENT` kèm response, không tạo để biến survey thành PASS.

Deletion bytes sau DB commit vẫn theo journal/allowlist/gate đã duyệt; quyền DML `storage.objects` không chứng minh thao tác API đã xong. Count3 object ở survey DB cùng ngày không thay manifest cleanup hoặc recheck UUID/full-row digest dưới khóa.

## Ràng buộc email

Chủ dự án muốn tránh email tới địa chỉ đăng ký Codex. [Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt) mô tả flow có thể chia sẻ email/profile với dịch vụ; [plugins](https://learn.chatgpt.com/docs/plugins) phân biệt phương thức xác thực/quyền kết nối. Không chọn `Continue with ChatGPT` khi ràng buộc chưa xử lý. [Vercel accounts](https://vercel.com/docs/accounts) mô tả đường email sử dụng OTP. Nguồn đã đọc không bảo đảm flow connection bất kỳ sẽ không có email tới địa chỉ OpenAI; không tuyên bố đã có hoặc chắc chắn không có email thực gửi, không truy cập inbox.

Tài khoản Supabase/Vercel riêng là phương án có thể xét để tránh liên kết danh tính ChatGPT. Chưa biết email của các account dịch vụ hoặc thông báo provider/OpenAI sẽ gửi; chưa có phương án được chủ dự án chọn. Không yêu cầu password/token trong chat, đổi email hoặc tắt thông báo bảo mật. **Bước kết nối còn chờ chốt phù hợp ràng buộc.**

## Scope tiếp theo và điều kiện kết thúc

1. **Chốt đường xác thực:** tận dụng quyền/tài khoản/kênh đã có; nếu login/consent mới, xác định danh tính/đích/phạm vi và xử lý ràng buộc email trước. Chat/profile mới không chứng minh tránh email.
2. **Supabase inventory chỉ đọc:** đúng `kfqjdfwxhkdwihjobpny`, list functions/JWT settings và Storage bucket metadata qua API phù hợp. Receipt có thời điểm/đích/status/error/trường đã đọc, không mutation/secret dump. Đọc được metadata hoặc ghi blocker có căn cứ; không gọi deployment-ready khi còn quyền/gate chưa kiểm.
3. **Vercel binding chỉ đọc:** đúng project/team/domain/repo `24tx810010-hcmute/pos-cafe`, Production branch/auto-deploy/build/env names/scopes. Không tạo project/link mặc định hoặc push thử. Xác định thứ tự release phối hợp và quyền ghi còn chưa biết.

Mỗi mục làm riêng với bằng chứng/review; không tự chạy xuyên đến cleanup/deploy. Có thể đề xuất scope kiểm local độc lập lúc chờ kết nối, chưa bắt đầu scope mới ở đây. Chat hiện tại dùng được cho code/docs/GitHub/HTTP; chưa cần tạo chat mới, không bảo đảm chat mới nạp MCP hoặc tránh email.

## Kiểm chứng, subagent và nguyên liệu đồ án

- `/root/deployment_config_investigator` chỉ tìm cấu hình/call sites, không viết candidate/live request; tự kiểm fingerprint hai lần khớp `30dd5664…`. Tác giả đối chiếu file/dòng. Investigator không thay review cuối.
- Hai reviewer không tham gia viết candidate kiểm kỹ thuật/evidence và phạm vi/ủy quyền/hồ sơ theo [review gate](../workflow/README.md#review-doc-lap); verdict đúng snapshot ở biên bản. Approval guard/survey trước không thay approval gói này.
- Phép kiểm là source/hash/response/ảnh/link/giới hạn kết luận. Không chạy test/build/UI audit cho survey không sửa ứng dụng/UI. Số77/7 là kết quả slice guard, không phải tests chạy lại ở đây.
- Hồ sơ cung cấp nguyên liệu về triển khai nhiều thành phần, authentication/authorization/availability, cấu hình JWT riêng, auto-deploy lệch dependency, bảo vệ credential và phân biệt response mới với bản ghi lịch sử. Không viết thành đã rollout/phân quyền hoàn tất hoặc đã chứng minh không gửi email.
- Docs/evidence còn local chưa commit/publish; walkthrough với chủ dự án chưa hoàn tất. Survey không thay nghiệm thu/gate phát hành tổng.
