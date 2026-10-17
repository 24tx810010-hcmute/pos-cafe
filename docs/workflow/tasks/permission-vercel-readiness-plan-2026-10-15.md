# Kế hoạch có điều kiện để khép phân quyền/chạy Vercel — 15/10/2026

**Trạng thái: giữ Tailwind3, hoãn4; cảnh báo3 không chặn theo D06. Windows D07/D08 đã được SEC/EVC APPROVE: unit1173/tooling489/build/2tsc đạt, smoke44PASS/37viewportSKIP/0FAIL, UI48checks không finding mới. Supabase vẫn legacy theo MCP mới; chưa đủ deploy, no-push/no-DB/no-deploy/no-delete giữ nguyên. Đây là metadata review sau freeze.**

## Đề bài và quyền

Đề bài ban đầu: “lập kế hoạch xử lý các điểm chặn để dự án đủ điều kiện push… Chưa push, sửa database, có gì cần tôi quyết định thì hỏi và đợi tôi trả lời… ưu tiên kết thúc phần này và đủ khả năng chạy thực tế trên vercel”. Ban đầu chỉ khảo sát/lập kế hoạch. Sau đó D07 giao đúng bản cài/kiểm nhẹ Windows và D08 giao sửa riêng một file smoke test. Không có quyền cài stack Linux/CI, tạo project, push, sửa database, deploy/promote hoặc cleanup. Quyền tương lai chỉ phát sinh từ lệnh owner cho gói cụ thể.

Đầu vào: [audit 15/10](../../implementation-log/permission-progress-audit-2026-10-15.md), [review audit](../../reviews/2026-10-15-permission-progress-audit.md), [HP1 hiện hành](permission-hosted-hp1-2026-10-14.md), [đường hosted HP1–8](../../runbooks/permission-hosted-path-2026-10-14.md), [rollout](../../runbooks/permission-controlled-rollout-2026-10-13.md), [spec tasks](../../../openspec/changes/redesign-permission-model/tasks.md). Không đọc tài liệu cũ thành quyền phát hành mới.

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; checkout vẫn dirty. Audit đã khóa nguồn58 có 835 entry khớp và actual LOCAL 75 PASS lịch sử; chưa full gate/review cuối. Online qua MCP chỉ đọc vẫn legacy, chưa permission contract2. 7 dependency findings và11 installed-lock version drift. Private archive nguồn56 thiếu tại đường dẫn đã ghi. Không tự khôi phục lab WSL/Docker.

Cập nhật sau D08: source58 là lịch sử; đúng1file smoke test được sửa theo lệnh owner. Bản Windows cách ly có fingerprint `8d6704883d7c4c2deb14bb5d97a29fc2f4ac925d9de3059f4df0df16cbd7acf4`,833file+2deletion markers; bản cài mới30direct versions đúng lock, shared node_modules không thay. [Kết quả và giới hạn mới](../../implementation-log/permission-windows-verification-2026-10-15.md) không thay full backend gates hoặc HP1/source58 proof.

## Mục tiêu bàn giao và điểm dừng

Tách hai mốc để tránh nhận “đủ push” thành “đã chạy production”:

1. **Gói sẵn sàng xin phép push/phát hành:** source/locks/commit scope rõ, đủ test/review trên đúng source và môi trường, dependency gate đóng, backend/Edge/Vercel deployment package cùng contract và có recovery plan đã kiểm. Phải trình owner trước mọi push hoặc hosted mutation.
2. **Chạy thực tế trên Vercel:** chỉ sau quyền triển khai riêng; backend/Edge/Storage/Realtime đúng contract trước frontend, deployment được pin, domain đúng bản, postflight nghiệp vụ và permission/PIN đạt. Chỉ local build/test không đủ nhận mốc này.

Không đưa temp cleanup vào critical path: các file đề xuất chỉ khoảng9,77MiB, không phải nguyên nhân chặn release. Giữ no-delete hiện hành. Giữ exact79/66Auth/3objects/delete2 và mọi tiêu chí60TC/19PIN, full-row/C/Storage/L; không tự đổi đích database hay acceptance để rút ngắn kế hoạch.

## Các giai đoạn đề xuất

| Giai đoạn | Công việc và đầu ra cụ thể | Điều kiện chuyển tiếp |
| --- | --- | --- |
| P0 — Chốt quyết định và baseline | Giữ3/hoãn4 theo D05; cảnh báo Tailwind3 không chặn theo D06. Browser chưa biết. Hướng Windows trước + Linux CI có điều kiện đã chốt theo PLAN-D04; kiểm source/HEAD và tách scope ngoài permission | Quyết định cảnh báo không chứng minh code/backend đã đạt; dữ kiện thiết bị còn thiếu phải kiểm trước release |
| P1 — Bản cài tái hiện được, giữ Tailwind3 | [Gói Windows/deployment](permission-deployment-preparation-2026-10-15.md) lập recipe đúng locks/runtime, giải 11installed-lock drift và graph mismatch bằng bản cài cách ly. Không nâng Tailwind4. Audit vẫn ghi trung thực; cảnh báo Tailwind3 không làm dừng phân quyền hoặc giữ release chờ upstream | D06 thay phần chờ upstream/BLOCKED do Tailwind của D01; không thay test/coverage/data guards. Đỉnh cài ước tính2,5GiB trên D, chưa cài/chạy trước lệnh cụ thể; không coi cài sạch làm hết7findings |
| P2 — Windows trước, Linux CI có điều kiện | Windows cho chuẩn bị/kiểm nhẹ sau bản cài hợp lệ. Linux standard public CI chỉ là phương án full stack cần pilot chứng minh resource/profile/bootstrap/privacy/retention. Không chọn VM trả phí, WSL hoặc Docker Desktop | Chưa dựng/chạy trước quyền riêng. Task tăng≤20GiB và giữ≥30GiB free C/runtime; advertised14GB CI chưa bảo đảm guard. CI-0 chỉ đo; ghi lớn phải đủ bound/guard, không tự miễn luật |
| P3 — Khép HP1 và gate local | Đánh giá phần private raw còn phục hồi được; lập fresh evidence thay phần không thể replay, không suy tar source là raw backup. Sửa/kiểm finding theo source cuối; unit/tooling/build/typecheck, PIN19/PERM60, UI và security/direct-DB, Realtime/images theo gate hiện hành. Snapshot source+recipe+evidence; SEC→EVC cùng candidate | Không ghép PASS56/57/58 hoặc environment khác thành full PASS. Kế hoạch retention phải đủ evidence bắt buộc; nếu vượt ngân sách thì dừng xin quyết định, không giảm coverage |
| P4 — Khép khả năng triển khai hosted | Xác minh chỉ đọc actual provider/consumer/actor và control C/Storage/L, capture/restore/recovery design, Edge JWT/settings, frontend environment provenance và Vercel binding. Hoàn thiện adapter/profile và rehearsal cách ly khi được giao. Mỗi capability chưa có cơ chế chứng minh vẫn BLOCKED | B/I LOCAL không chứng nhận hosted. Không xin “maintenance20phút” khi chưa có control/drain thật. Không trial write/grant/lock/backup online trong phạm vi hiện tại |
| P5 — Gói đề nghị phát hành | Source và gói build đúng lock/Node được pin; DB017+candidate activation/compatibility, Edge2functions, private staging/signals, frontendcontract2 đồng bộ. Kiểm private env provenance/target guard, Vercel Production/Preview binding/auto-assignment, deployment protection và bundle recovery tương thích. Có exact diff, actor, thời điểm, abort/unknown-ACK/reconcile, hậu kiểm và tiêu chí GO/NO-GO; SEC/EVC review gói | Không chứa secret trong Git/chat. Old frontend không mặc nhiên là rollback tương thích contract2. Không push/deploy/upload/promote hoặc sửa provider settings trước lệnh owner |
| P6 — Thực thi sau phê duyệt riêng | Kiểm mới đúng manifest IDs/fullrows/ACL/K/Storage; thực hiện backup/restore/control/cleanup/activation theo exact scope đã giao, backend/Edge trước frontend. Triển khai candidate Vercel chưa gán domain; kiểm contract/env/source/bundle; chỉ promote exact deployment sau khi đạt. Postflight login/store pairing/forcedPIN/roles/overrides/revocation/directdeny/order/payment/K/R1/receipt/images/Realtime | Đây chỉ là mô tả tương lai, không có quyền chạy. Khi có giao dịch/ID/control drift phải dừng đúng dependency và xin quyết định; không retry mù, không restore đè writes mới, không mở legacy grants để phục vụ client cũ |

Một source mới sau P1/implementation có thể làm bằng chứng P3/P4 mất hiệu lực; phải chạy lại đúng phần và các aggregate bắt buộc. Ưu tiên khảo sát chỉ đọc P4 và chuẩn bị recipe trước full runs tốn tài nguyên; full gate phải gắn source/graph cuối, không ghép lần trước. Không hứa thời lượng hoàn tất trước khi môi trường và control hosted đủ; không còn dùng việc chờ vá Tailwind3 để hoãn công việc độc lập.

## Quyết định và trạng thái câu hỏi

### Q1 — Lịch sử hướng dependency trước PLAN-D06

Ở mốc hỏi trước PLAN-D06, audit có5high/2moderate và quyết định13/10 “giữ Tailwind3, giữ chặn phát hành và chờ upstream” còn hiệu lực. Các phương án A/B/C dưới đây là lịch sử lúc hỏi, không phải lựa chọn đang chờ hoặc trạng thái hiện hành. **PLAN-D06 đã thay phần chờ upstream/BLOCKED do Tailwind** bằng chỉ đạo owner cho bỏ qua cảnh báo3; không yêu cầu chấp nhận lại.

- A: cho phép lập phương án migration Tailwind4 với điều kiện thiết bị phù hợp; chưa sửa/cài. Có khả năng loại chuỗi dependency cũ nhưng phải chứng minh bằng audit mới và kiểm UI; không bảo đảm nâng major tự hết mọi finding.
- B: giữ Tailwind3 và chờ bản vá upstream, giữ release BLOCKED; phạm vi nhỏ hơn nhưng không thể hứa ngày khép.
- C: giữ Tailwind3, khảo sát patch/đổi build dependency có kiểm chứng; chưa nâng major hoặc chấp nhận residual risk. Chưa có giải pháp đã chứng minh nên có thể vẫn BLOCKED.

**PLAN-D01 — quyết định lịch sử 15/10, phần chờ upstream/BLOCKED do Tailwind đã được D06 thay thế:** owner trả lời “Giữ Tailwind 3, tiếp tục chờ bản vá upstream và giữ phát hành BLOCKED”. Tại mốc đó chọn B, không migration/override/residual-risk acceptance hoặc theo dõi định kỳ. Quyết định kế thừa13/10 đã được tái xác nhận lúc đó; D05/D06 bên dưới ghi chỉ đạo mới, không sửa lịch sử thành owner đã chấp nhận từ trước.

### Q2 — Thiết bị và trình duyệt phải hỗ trợ

**PLAN-D02 — đã ghi nhận 15/10:** owner trả lời “chưa biết”. Chưa có danh sách thiết bị/OS/browser bắt buộc, không tự đặt minimum support. Giữ Tailwind3 nên chưa có migration browser floor mới. Trước release cần owner xác định thiết bị dùng/demo và lấy version từ Settings/About của browser/OS, chạy kiểm trên thiết bị đó. Chromium viewports hiện có không tự chứng nhận Safari/Firefox/thiết bị thật. Không chặn khảo sát môi trường hoặc lập recipe vì dữ kiện này chưa biết.

### Q3 — Hướng môi trường kiểm thử sau sự cố WSL

Không thấy Docker/PostgreSQLCLI trong PATH và không thấy PostgreSQL ở đường dẫn cài thông thường tại lượt đọc này; điều đó không chứng minh không còn binary ở mọi nơi. Node Windows có sẵn đủ kiểm nhẹ nhưng không thay full stack Linux/Storage/Realtime.

- A: lập phương án lab Linux ngoài máy (CI/VM được kiểm soát), ưu tiên tránh tích lũy trên C/D. Phải kiểm runner/profile có đáp ứng gates, quyền riêng của dữ liệu/evidence và chi phí/quota trước tạo/upload/chạy; không coi cloud CI là zero-cost hoặc đã sẵn có.
- B: lập phương án một WSL trên D với vị trí/quota/ngân sách như P2. Chỉ tạo sau owner duyệt môi trường và ước tính cụ thể; chưa có quota kỹ thuật đang bật.
- C: chỉ dùng Windows hiện có để khảo sát khả năng thay thế, giữ các gate Linux/fullstack chưa đáp ứng là BLOCKED. Không được đổi acceptance để nhận PASS.

**PLAN-D03 — phạm vi khảo sát được giao 15/10, mốc lịch sử trước D04:** owner nói “tôi nghiên về 1 hoặc 3, bạn khảo sát, ưu tiên không tốn chi phí về tiền bạc”. Tại mốc này chưa chọn môi trường cuối; B/WSL không được chọn hoặc cho phép tạo lại. [Khảo sát Windows/CI](../../implementation-log/permission-test-environment-feasibility-2026-10-15.md) xác minh repo public/standard minutes miễn phí, nhưng disk/profile/retention và Actions policy còn điều kiện. Windows có công cụ song graph đang lệch và không thay full stack. Đề xuất kết hợp Windows trước+CI có điều kiện được trình owner; không coi “nghiêng1hoặc3” là đồng ý tự động. D04 bên dưới ghi câu trả lời tiếp theo, không thay đổi nguồn ủy quyền của D03.

<a id="plan-d04"></a>
### PLAN-D04 — Đã chốt hướng kế hoạch Windows + Linux CI có điều kiện, 15/10

Nguồn: owner trả lời câu hỏi async `call_b8e577273c8f452b8a345fb9603f4c28` trong chat hiện tại: **“Kết hợp Windows trước + Linux CI có điều kiện, giữ nguyên coverage/privacy/ngân sách và dừng nếu không đủ điều kiện miễn phí (khuyến nghị)”**. Câu hỏi đã nêu rõ lựa chọn chỉ chốt kế hoạch, chưa cho cài, push, chạy CI, sửa database hoặc deploy.

Chấp nhận hướng kết hợp đã khảo sát thay vì chỉ Windows/hoãn chọn CI. Lý do được trình lúc chốt: Windows có thể chuẩn bị/kiểm nhẹ sau bản cài đúng lock, full gates cần Linux; standard public minutes miễn phí nhưng disk/profile/private retention và tổng chi phí chưa được chứng minh. Đây là lựa chọn kế hoạch của owner, không phải kết quả pilot hoặc xác nhận CI đã đủ điều kiện.

Hệ quả: thứ tự chuẩn bị là PLAN-W0 rồi PLAN-W1 khi được giao thực thi; PLAN-C0 chỉ chạy sau lệnh riêng và kiểm đường trigger/Vercel Preview. Không chuyển C1/C2 nếu thiếu bootstrap, upper bound, guard, privacy/retention hoặc bằng chứng không phát sinh tiền. Giữ nguyên coverage, privacy/ACL, task tăng tối đa20GiB và free tối thiểu30GiB; không tự hạ ngưỡng hoặc thuê runner. Nếu không đáp ứng điều kiện miễn phí thì dừng phần phụ thuộc và trình owner, không tự chọn phương án có phí/WSL hoặc giảm acceptance. D02 (thiết bị chưa biết) tiếp tục có hiệu lực; trạng thái dependency hiện theo D06 thay D01.

<a id="plan-d05"></a>
### PLAN-D05 — Ưu tiên hoàn thành phân quyền/Supabase/Vercel, hoãn Tailwind4

Ngày15/10 owner nói: “phần nâng lên tailwind 4 sẽ làm sau (không phải lúc này). cần ưu tiên hoàn thành phần phân quyền này đủ khả năng đeploy được lên vercel và đảm bảo database supbase hoạt động đúng với code mới”. Giữ Tailwind3 là ràng buộc hiện tại; không mở migration4, không đặt deadline hoặc automation nâng cấp. Ưu tiên đóng khoảng cách code/backend, clean-lock verification và deployment package; không viết lại tính năng đã có hoặc dùng cảnh báo Tailwind làm lý do dừng phần độc lập. Mục tiêu này không tự cấp lệnh push, hosted migration/settings/deploy hoặc cleanup đã bị giữ trước đó. [Gói chuẩn bị cụ thể và phần chưa kiểm](permission-deployment-preparation-2026-10-15.md).

<a id="plan-d06"></a>
### PLAN-D06 — Cảnh báo Tailwind3 không chặn phát hành theo quyết định owner

Ngày15/10 owner trả lời async `call_7fda9661d40f440eb1eb9792356a0eff`: **“tôi chọn 1, nhưng vẫn như đã xác định từ trước, sẽ sử dụng tailwind 3 và đợi khi có thời gian sẽ update lên tailwind 4, vì vậy nếu có cảnh báo nào về tailiwnd 3 thì bỏ qua cảnh báo đó”**. Phần trả lời tự do xác nhận rõ hơn lựa chọn1: không giữ blocker chờ upstream do các cảnh báo Tailwind3. Đây là quyết định mới của owner; không tự suy owner đã đưa quyết định này ở mốc D01.

Áp dụng ngay cho hai advisory hiện có (`GHSA-vfj7-8cjw-p6xm`, `GHSA-rj75-hqrm-r3gf`) và7package findings trong chuỗi Tailwind3: vẫn ghi audit, phân loại là cảnh báo được owner cho bỏ qua trong điều kiện phát hành; không tắt audit, che exit hoặc gọi thành audit0. Không tự dùng riêng cảnh báo Tailwind3 để chặn công việc/phát hành. Nâng4 để sau, không có lịch tự chạy. Quyết định này không xác nhận lỗ hổng đã được vá/không thể khai thác; build/module graph và provider metadata chưa kiểm vẫn ghi đúng giới hạn. Không miễn clean-lock parity, lỗi build/test, hợp đồng phân quyền, bảo toàn dữ liệu, CI privacy/ngân sách hay quyền push/DB/deploy. Release tổng thể còn chưa đạt vì các dependency kỹ thuật đó, không vì yêu cầu chờ vá Tailwind3.

## Danh sách việc theo kế hoạch đã chọn — Windows đã thực hiện, CI/hosted chưa được giao

| ID | Đầu ra | Dependency / tiêu chí |
| --- | --- | --- |
| PLAN-W0 | Windows npmci đã đạt,30direct versions đúng lock và ba internal mismatch cũ không còn trong bản cách ly | Shared modules giữ nguyên. Estimate trước cài2,5GiB; dữ liệu quan sát thấp hơn. Không tải browser/WSL/Docker |
| PLAN-W1 | Đã chạy trên source D08: unit1173,tooling489,2tsc/build đạt; smoke44PASS/37viewportSKIP; UIselftest23 rồi48checks,6false positives/0mới | [Log/current review](../../implementation-log/permission-windows-verification-2026-10-15.md); không thay PIN/PERM/hosted proof. Không ghép lần smoke lỗi cũ thành PASS |
| PLAN-C0 | Gói CI preflight và trigger plan an toàn: actual runner policy/runtime/disk/RAM/namespace, sanitized logs, không production secrets/cache/artifact mặc định | Chưa có workflow/runs, policyGET403; no-push còn hiệu lực. Đưa source/YAML lên GitHub và tránh kích hoạt Vercel Preview cần lệnh cụ thể trước |
| PLAN-C1 | Fresh bootstrap và một pilot synthetic đủ Storage/Realtime/Edge/preservation, resource peaks | C0 đủ điều kiện, upper bound/guard và private retention được duyệt; không giả14GB đủ/free30GiB đã đạt. Không auto-retry hoặc tạo runtime thay thế |
| PLAN-C2 | Full PIN19/PERM60/HP1 đúng fingerprint/profile/backend/discovery/options/raw refs; independent replay và hai reviews | C1 đạt; giữ candidate backend duy nhất,27stages không overlap, không chia matrix để ghépPASS. Nếu không đủ resource/privacy0cost thì BLOCKED và báo owner |
| PLAN-H0 | Ma trận C/Storage/L/actor/provider/env/Edge/Vercel, executable release/recovery proposal | Có thể khảo sát chỉ đọc trước C1; mọi capability thiếu vẫn BLOCKED. Không sửa DB/settings, dump/payload capture hoặc nhận local proof thành hosted |
| PLAN-R0 | GO/NO-GO package với source/gates/locks, backendcontract2 và deployment/rollback tương thích | Cảnh báo Tailwind3 xử lý theo D06; clean-lock/test/C2/H0 đủ, thiết bị được chốt và owner duyệt exact action/window. Hiện R0 chưa đạt; không push/deploy/DB action từ kế hoạch |

## Nguồn kỹ thuật đã đọc mới

- [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide): v4 có breaking changes/CSS/browser floor; cần kiểm browser thực sau migration, không chạy upgrade tool trong lượt lập kế hoạch.
- [Vercel environments](https://vercel.com/docs/deployments/environments), [environment variables](https://vercel.com/docs/environment-variables): Preview/Production có scope riêng; phải kiểm đúng backend binding và build inputs. Không coi Preview trỏ production DB là môi trường dữ liệu cách ly.
- [vercel.json](D:/Workspace/pos-cafe/vercel.json:4) hiện npmci→build→dist; pipeline này không tự chạy full acceptance gates.

## Việc tiếp theo

Không hỏi lại D04–D08. Windows đã thực hiện, [gói kết quả](../../implementation-log/permission-windows-verification-2026-10-15.md) chờ review đúng scope. Tiếp theo cần fresh Linux/bootstrap/profile/retention/full gates và matching hosted C/Storage/L/env/Edge/Vercel; no-push/no-DB/no-deploy còn nguyên. [Biên bản kế hoạch](../../reviews/2026-10-15-permission-readiness-plan.md) và [review Windows](../../reviews/2026-10-15-permission-windows-verification.md) có scope khác nhau; không lấy approval này thay full release. Quyền provider/action chỉ hỏi khi có gói hành động cụ thể.

<a id="plan-d07"></a>
## PLAN-D07 — Giao thực hiện giai đoạn Windows

Ngày15/10 owner trả lời async `call_7df474a1adbf4c04934116fe5b33c7d9`: **“Cho phép thực hiện giai đoạn Windows trong phạm vi trên (khuyến nghị)”**. Câu hỏi đã trình đúng đích `D:/Workspace/pos-cafe-permission-verify`, npmci đúng lock bằng Node/npm/browser có sẵn, unit/tooling thuần/typecheck/build mock/smoke/UI với ngân sách từng bước; tải150–650MB, tăng giữ lại0,5–1,5GB, cảnh báo LỚN HƠN 1 GB/đỉnh cài2,5GiB. Không push, sửa DB, deploy hoặc xóa dữ liệu. Nguồn này cấp quyền cài/chạy Windows cụ thể, thay phần chưa được giao của D04/W0/W1; không mở CI hoặc hosted. Giữ shared checkout nguyên trạng, không hỏi lại quyền routine trong giai đoạn này. Kết quả hiện vẫn NOT_RUN tại freeze, không lấy câu trả lời làm PASS.

<a id="plan-d08"></a>
## PLAN-D08 — Sửa riêng smoke test theo hợp đồng ngang/dọc

Ngày15/10 owner trả lời async `call_82edae102af34f289f99f0bd3f662516`: **“Cho phép sửa test đúng hợp đồng ngang/dọc và kiểm lại (khuyến nghị)”**. Câu hỏi đã chỉ rõ `tests/smoke/permission-ui-closeout.spec.ts` trên main và bản kiểm thử: hai ca nghiệp vụ chỉ trên viewport ngang; thêm ca dọc hiển thị rotate guidance/ẩn POS và kiểm lại. Không đổi UI/quyền/assertions nghiệp vụ, không push/DB/deploy. D08 mở đúng ngoại lệ1file đối với giữ checkout của D07. Không thay app hoặc loại assertion để che lỗi. Sau sửa chạy lại unit/tooling/tsc/build/smoke/UI trên source mới, giữ các log lỗi và source cũ có thể phục hồi. D07 NOT_RUN phía trên là mốc freeze quyền trước khi thực hiện; kết quả hiện tại ở log Windows.
