# Chuẩn bị mốc minh chứng Git trên nhánh riêng — 16/10/2026

## Kết quả cần giao và quyền hiện có

Owner chốt “Ưu tiên push minh chứng lên nhánh riêng, chưa deploy” qua câu trả lời `call_d67bf7bb30f54f4a9fad75e26e9719c8`. Câu hỏi đã giới hạn đây là **chọn hướng chuẩn bị**, chưa cho push, tạo nhánh, stage/commit, sửa Vercel, chạy CI hoặc sửa DB. Lượt này lập danh sách file, bằng chứng công khai tối thiểu và đề xuất chặn trigger; không thay application code.

Đây là mốc lưu tiến độ có thể review trên Git. Giữ các gate phát hành/database hiện hành; **NOT_READY_FOR_DEPLOY** không cản việc chuẩn bị minh chứng, cũng không được đổi tên thành release PASS. Giữ Tailwind 3 và quyết định bỏ qua cảnh báo thuộc chuỗi Tailwind 3; không mở lại việc nâng Tailwind 4.

## Nhánh và remote đã khảo sát chỉ đọc

Repo đích hiện là public `24tx810010-hcmute/pos-cafe`, default `main`. Remote `main` trùng local HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`. Remote `docs` là `132e9d6cc065459031ee92cfbafcd423b5ac81c5`; local docs `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19` có thêm hai commit workflow/review `9937f1f` và `e47862b`. Git xác nhận remote docs là ancestor của local docs, không phân kỳ tại checkpoint. Compare API trả 404 nên không dùng nó làm bằng chứng ancestry. Hai commit local đó cũng thuộc phần lịch sử sẽ được công khai khi xuất bản từ local docs, không chỉ các file dirty.

Tên đề xuất để owner thấy rõ đích, **chưa tạo**:

| Nhánh đề xuất | Nền | Mục đích |
| --- | --- | --- |
| `evidence/permission-20261016` | Code local `main` | Lưu code/tests/tooling/SQL/Edge của mốc phân quyền; chưa merge vào main |
| `evidence/permission-docs-20261016` | Local `docs` | Lưu spec/quyết định/báo cáo tương ứng; vẫn là nhánh tài liệu riêng |

Sau khi code đủ gate phát hành và có lệnh owner, **nhớ merge nhánh code minh chứng vào `main`**. Không merge nhánh kiến thức `docs` hoặc nhánh docs minh chứng vào main. Không force-push, reset hay đổi checkout dirty trong gói đề xuất này. Cách tạo nhánh/commit cách ly và refspec cụ thể phải được chốt trong gói thực thi sau; chưa chạy chúng.

## Chọn file và loại dữ liệu ngoài payload

Scout đối chiếu inventory đã review với dirty trees mới và lập từng dòng INCLUDE/HOLD/EXCLUDE, kèm SHA, bytes, lý do và dependency. Danh sách là **đề xuất**, không phải staging list đã được owner duyệt. Candidate cuối sẽ bind đúng TSV/receipt và bản tóm tắt scout; file phát sinh sau capture được liệt kê thành delta riêng.

- Giữ cùng nhau application source, ports/adapters/lifecycle, npm manifest/lock/config liên quan, tests/smoke/UI audit, SQL 017 + candidate fragments, Edge/shared và scripts/worker kiểm chứng.
- Hai file realtime bị xóa phải đi cùng wiring/replacement `PermissionLifecycle` và tests; không coi deletion là temp.
- Docs giữ spec phân quyền, PIN bắt buộc đổi có dependency với phân quyền, quyết định/quy trình, runbook và lịch sử PASS/FAIL/UNKNOWN. Đề xuất feature độc lập và tài nguyên redesign không tự nhập vào mốc này.
- Không đưa actual `.env`, credential/private inputs, private runtime, DB backup, raw nhạy cảm, `node_modules`, caches, dist/coverage/browser output hay toàn cây `artifacts` vào payload. `.env.example` giữ nguyên bản nền, không thêm nội dung vào đợt này.
- Lock pnpm thay thế và những file có scope/privacy chưa rõ được HOLD với lý do; không xóa hoặc sửa lock để hợp thức hóa lựa chọn. npm/Vercel hiện dùng npm ci theo `vercel.json:4`.

Temp không cần xóa để push. Hai `.tmp` logs và hai PLAN local được inventory trước phân loại ngoài payload vẫn giữ nguyên; 12 PNG redesign là tư liệu, không tự nhận temp. Không xóa file/backup/evidence hoặc đổi ignore trong lượt này. Những file được giữ ngoài mốc đầu vẫn còn ở máy, không phải bị hủy bỏ hay được nhận đã review đầy đủ.

### Kết quả selection sau đối chiếu ngữ cảnh

Capture scout có 883 dirty rows: code 510, docs 373. Root thêm đúng hai báo cáo của gói này và cập nhật hash bản index đang HOLD; bảng cuối có **885 rows**. Phạm vi đề xuất sau triage:

| Checkout | INCLUDE | HOLD | EXCLUDE khỏi mốc này |
| --- | ---: | ---: | ---: |
| Code | 509, gồm 2 deletion markers | 1 lock pnpm thay thế | 0 dirty files |
| Docs | 319 | 22 shared index/mixed-scope/incident/optimizer files | 34 file thuộc đề xuất/tư liệu độc lập |

Main INCLUDE có 507 file hiện hữu và 2 deletion markers. INCLUDE chỉ xác định phạm vi **đề xuất**; không có nghĩa từng file đã được duyệt công khai. HOLD/EXCLUDE chỉ giữ delta ngoài mốc này, không xóa bản local hoặc làm mất file nền đã có trong Git. 24 paths trong hai commit docs local được theo dõi riêng, không cộng lần nữa vào 885 dirty rows. Counts này chưa gồm các biên bản review/metadata được tạo sau freeze.

Scanner ban đầu để HOLD 11 code/test files với 14 occurrences; điều đó tạo 29 static import edges tới HOLD và 4 test-discovery holds. Reviewer SEC đã xác nhận đúng hashes và đọc AST/control flow: 7 email literals là fixture đối chiếu bootstrap/recovery, passwords sinh ngẫu nhiên hoặc nạp từ runtime; 4 file test chứa fixture/negative assertions. Hai hit mới trong Preflight test được đọc riêng, không suy từ verdict cũ. **Chỉ gỡ HOLD do đúng các hit này**, không kết luận cả file/payload/history sạch mọi bí mật. Bản triage không lưu literal values. Không import/chạy recovery modules vì chúng có nhánh kết nối/apply thật. Toàn bộ source giữ nguyên.

Sau khi đưa lại đủ 11 file, 29 cạnh tới HOLD đó và 4 test-discovery omissions được khép trong selection. Lock pnpm còn HOLD không được npm ci hiện hành tham chiếu. Đây là kiểm dependency tĩnh đã chọn, không chứng minh mọi dynamic path/build/runtime hoàn chỉnh. Hai realtime deletions là `src/features/integration/useRealtimeInvalidation.ts` và `.test.tsx` (2.696 B trong HEAD), đi cùng `App.tsx`, `PermissionLifecycle.tsx`, ports, export cleanup và tests mới; không giảm coverage để bỏ file bị gắn cờ.

Exact rows, SHA và lý do được giữ local tại `artifacts/permission-git-milestone-20261016/selection-reviewed-proposal.tsv`; đây chưa phải manifest commit đã tạo. Trước publish phải kiểm lại toàn bộ exact bytes sẽ stage, nội dung công khai/history liên quan, source drift và refs/trigger, rồi owner ra lệnh riêng. **publicationReady=false** trong gói này; không nhận các checks tĩnh hoặc review proposal là full security audit.

## Minh chứng công khai tối thiểu

[Bản minh chứng có thể đọc trên Git](permission-public-progress-evidence-2026-10-16.md) chứa source fingerprint, lệnh, counts, trạng thái và giới hạn. Bản trích máy đọc local `sanitized-progress-summary-final.json` lấy field cố định từ các receipt đã lọc; không đọc credential hoặc probe DB mới. Raw/local paths trong hồ sơ lịch sử chỉ là nguồn bổ sung ở máy, không giả rằng mọi link local sẽ hoạt động trên GitHub. Bản tóm tắt này cung cấp nội dung chính độc lập với các link đó.

Đối chiếu Windows cũ: 832 file + 2 deletion markers khớp, 1 `.env.example` held không mở, 0 drift. Chưa phủ file mới ngoài manifest và không chạy lại tests. Public summary giữ đúng unit 1.173, tooling 489, smoke 44 PASS/37 SKIP và worker 33 gồm 15 ca kế thừa. Actual actor/scope probe 79/145/3 đã PASS chỉ đọc; schema/contract2/full-row/backup/recovery/cutover và ứng dụng online chưa được nhận PASS.

## Trigger vừa xác minh

Vercel đúng team `24tx810010-hcmutes-projects`, project `pos-cafe`, Git nối đúng repo. Production hiện Ready từ commit nền trên main; Production Branch Tracking theo `main`, Auto-assign Custom Production Domains đang bật. **Không push main** trong mốc minh chứng.

Preview Branch Tracking **đang ON**, pattern “All unassigned branches”, UI không có custom environment. Vì vậy nhánh code mới và nhánh tài liệu vẫn có đường auto Preview; docs từng có Preview Error không đồng nghĩa docs được miễn deployment. Git settings không có deploy hooks, nhưng integration vẫn nối. Không mở giá trị env/secret.

GitHub read-only API hiện trả 0 Actions workflows, `has_pages=false`. Webhook API không đủ quyền admin nên chưa liệt kê được; không nâng scope credential. Phép khảo sát không chứng nhận mọi integration/other Vercel project/provider đều không có automation. User đã bỏ bước Locofy trước đó; không tự mở lại đăng nhập/provider đó.

Vercel xác định push branch ngoài production là nguồn tạo Preview theo [tài liệu Git](https://vercel.com/docs/git). `git.deploymentEnabled` có thể khóa theo nhánh trong source config theo [tham chiếu chính thức](https://vercel.com/docs/project-configuration/git-configuration), nhưng config code không tự bảo vệ docs nếu docs không mang cùng config. Gói này đề xuất một setting đã thấy trực tiếp trong UI, không sửa source deploy để lách mô hình code/docs.

## Đề xuất cụ thể cần owner quyết định trước phần online

**Chỉ tắt Preview > Branch Tracking** của project POS rồi Save, đọc lại để xác minh OFF. Không đổi Production branch/auto-assign, không ngắt Git integration, không sửa env/domain/DB và không tạo deployment thủ công.

| Tác động | Giới hạn / cách khôi phục |
| --- | --- |
| Dừng auto Preview cho **mọi nhánh chưa gán môi trường** của project này, gồm code evidence và docs | Trong thời gian OFF, các nhánh khác của nhóm cũng không tự có Preview. Các Preview cũ không bị xóa |
| Production đang chạy và nhánh main không bị đổi bởi setting này | Main push vẫn có thể tạo Production; cấm main push vẫn giữ |
| Không cần gói cài, tài nguyên test hoặc dịch vụ mới | Manual CLI/API deploy và integration khác không bị setting này khóa; không được dùng chúng trong mốc này |
| Có thể bật lại cùng checkbox rồi Save | Chỉ thực hiện sau lệnh owner; không tự bật lại ngay sau push vì các sự kiện tiếp theo có thể deploy code còn chưa sẵn sàng |

Đường dẫn setting: [Preview của POS](https://vercel.com/24tx810010-hcmutes-projects/pos-cafe/settings/environments/preview). Ảnh local `vercel-preview-before.jpg` đã xem xác nhận trạng thái ON. Đây là **đề xuất chưa được phép thực hiện**. Cần quyết định này vì owner mới cho chuẩn bị local, chưa cho thay đổi hành vi deployment của Vercel. Dù owner cho đổi setting, quyền tạo branch/commit/push vẫn cần lệnh riêng trên gói cụ thể.

Nếu owner giữ setting ON, tiếp tục được phần local, **dừng trước mọi push** đến repo POS. Không tự chọn phương án dự phòng hoặc coi im lặng là đồng ý.

## Kiểm chứng và giới hạn tài nguyên lượt này

Chỉ đọc Git/source/receipt và provider metadata; tạo analysis artifacts/docs nhỏ trên D:/Workspace, không chạy app/SQL/CI. Trước ghi, C còn 201.905.823.744 B và D còn 102.737.707.008 B, đều trên dự trữ 30 GiB. Gói mới giới hạn vận hành 8 MiB logical, trong đó scout tối đa 2 MiB; không copy toàn repo/runtime. Helper trích summary dùng Node sẵn có, heap 256 MiB, một process. Đây là giới hạn vận hành/V8 heap, không quota OS cho CPU/RAM/đĩa. Không phát sinh tải/cài, WSL/Docker, phí dịch vụ hoặc môi trường kiểm thử nặng.

Chờ hai review độc lập: SEC kiểm privacy/authority/trigger proposal; EVC kiểm source binding/counts/selection/deletion và tính đúng của báo cáo. Approval chỉ phủ chuẩn bị/proposal, không mở quyền publish/deploy, không chứng nhận full application security. Walkthrough cho owner: file selection → nguồn test → actor/scope khác DB compatibility → Preview trigger → nhắc merge code về main; chưa nhận owner đã đọc/nghiệm thu.


### Metadata review cuối — hoàn tất chuẩn bị, chưa publication-ready

SEC và EVC cùng **APPROVE analysis/proposal candidate01**, SHA256 `62bf3101f518962e18b7ba986e39ae04bb7c9fd0d26243306017c0f31966bf0b`, 28 snapshots/1.194.137 B, không findings chặn trong phạm vi. [SEC](permission-git-milestone-sec-review-2026-10-16.md), [EVC](permission-git-milestone-evc-review-2026-10-16.md). Root kiểm lại 28 original/snapshot pins và 828 proposed INCLUDE entries:0drift; HEAD/staged-entry hashes hai checkout không đổi. Chỉ metadata review được bổ sung sau freeze; TSV giữ bytes checkpoint, báo cáo này/index có suffix metadata được ghi trong closeout. Hai review mới không cộng vào885rows đã freeze.

[Closeout local](D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/closeout.json) ghi scope/review/hash/tài nguyên; không là bằng chứng đã push hoặc đã tắt Preview. **publicationReady=false**, phát hành NOT_READY_FOR_DEPLOY. Chờ owner quyết định đúng setting Preview Branch Tracking OFF; chưa có quyền thay setting hoặc branch/stage/commit/push/CI/DBwrite/deploy/delete. Nếu owner chưa trả lời hoặc giữ ON, dừng trước phần thay setting/push; không tự chọn phương án. Nhớ merge nhánh code minh chứng vềmain chỉ sau gate/lệnh; docs giữ riêng.


Cập nhật sau quyết định owner16/10 — [actual Preview OFF](permission-preview-tracking-off-2026-10-16.md): owner call_be33cd11bcb8463e90c03060b324d81c đã cho tắt đúng Preview Branch Tracking; Save1lần/reload OFF, Production main/autoAssignON/oldReady deployment không đổi theo UI. SEC/EVC APPROVE actual candidate `b7ddc871cf4562d095a9bdc0b77a6c88aca8e791881b9296444d178fdce03919`. Thay trạng thái pending/Preview ON ở checkpoint trước bằng kết quả mới này; giữ lịch sử frozen nguyên trạng. Giữ OFF đến lệnh owner bật lại, chưa có quyền branch/stage/commit/push/CI/DB/deploy/delete. publicationReady=false; không suy mọi trigger/provider hoặc database compatibility đều đã được khép.
