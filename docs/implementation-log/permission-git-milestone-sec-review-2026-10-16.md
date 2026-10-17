# SEC — proposal mốc Git và Preview trigger, 16/10/2026

**APPROVE** candidate SHA256 `62bf3101f518962e18b7ba986e39ae04bb7c9fd0d26243306017c0f31966bf0b`, chỉ trong phạm vi phân tích/đề xuất file selection, minh chứng tiến độ đã lọc và phương án Preview Branch Tracking. Không có finding chặn deliverable này. **publicationReady=false**; không cấp quyền tạo nhánh, stage/commit/push, đổi provider, chạy CI/DB/deploy hoặc xóa dữ liệu.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/candidate-01/manifest.json`, 28 snapshots/1.194.137 B. Reviewer độc lập `/root/ci1_worker_sec`; không sửa candidate/source/index/report tác giả. Chỉ báo cáo SEC này là đầu ra mới.

## Kiểm độc lập và giới hạn chứng cứ

Tự đối chiếu SHA/kích thước toàn bộ 28 originals + 28 frozen snapshots và hash ba external proof references: 0 sai khác. Đọc helper phân tích, hai báo cáo, privacy/provider records và metadata selection/history/dependency. Đã xem ảnh `snapshot/008-vercel-preview-before.jpg` cùng accessibility record. Không gọi provider/API/browser mới trong review này; những quan sát provider là evidence đã được tác giả thu chỉ đọc tại checkpoint, không phải trạng thái được SEC đo lại sau freeze.

Parse TSV độc lập: **885 rows =828 INCLUDE +23 HOLD +34 EXCLUDE**, không duplicate repo/path; 828 rows của publication-file-manifest khớp đúng INCLUDE theo path/hash/hashScope. Tự kiểm 11 live source pins của triage: không drift, đều được chuyển HOLD→INCLUDE đúng hash. Các path metadata INCLUDE không có actual `.env`, private/runtime/raw/output/cache directories hoặc credential binary suffix đã kiểm. Đây chỉ là kiểm cấu trúc/path của đề xuất, **không phải đọc/duyệt bí mật trong mọi byte source, HEAD hoặc toàn history**.

Không đọc `.env`, credential/private inputs, protected runtime, DB backup/raw evidence; không import/chạy project/recovery modules hoặc tests, không network/SQL, cài/copy runtime, Git mutation, provider change, CI/deploy/delete. Candidate là snapshot của **analysis**, không phải source-release snapshot; source code được bind bằng hash references và cần kiểm lại trước publication cụ thể.

## Privacy triage được chép đúng phạm vi

`snapshot/006-privacy-triage.json` giữ đúng verdict **CLEAR_SYNTHETIC_FOR_REVIEWED_HITS** cho 11 file/14 scout occurrences, cùng hashes, provenance và giới hạn đã gửi root. Ba line references tới nơi tạo email được bổ sung để giải thích provenance nên tổng entries trong mảng lines là17, không phải17 pattern hits. Không lưu email/password/token/PIN literal values. Hai metadata tables cũng có `matchedValuePersisted=false` ở mọi row.

Tóm tắt đối chiếu với source triage trước freeze; path dưới đây tương đối với `D:/Workspace/pos-cafe/`:

| Nhóm / dòng | Kết luận cho đúng hit |
| --- | --- |
| `scripts/permission-bridge-runtime.mjs:151` / factory96; `permission-identity-runtime.mjs:154` / factory99; `permission-pin-identity-runtime.mjs:173` / factory117 | Expected email miền test khớp chính xác template bootstrap đầu; password dùng randomBytes(24), session/refresh lấy từ guarded runtime. Không suy secret từ TemplateExpression hoặc tên biến password |
| `scripts/permission-pin-onboard-recover-attempt04.mjs:25`, `permission-pin-tc02-recover.mjs:30`, `permission-pin-tc03-recover.mjs:31`, `permission-pin-tc06-recover.mjs:34` | Fixed fixture email so graph sau target/project/marker/exact-count guards, không contact người dùng được nạp vào source. Các recovery modules có top-level connect/nhánh apply thật; clearance không cho phép import/run |
| `src/adapters/supabase/realtimePort.test.ts:28`, `tests/contracts/permissionInventory.tool.test.ts:162`, `permissionPreflight.tool.test.ts:31`, `permissionRealtimeHarness.tool.test.ts:22,37` | Byte-identical với source của [review trước](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-online-compatibility-secret-screen-2026-10-16.md); giữ synthetic fixture/negative assertion verdict |
| `tests/contracts/permissionPreflight.tool.test.ts:77,202` | Hai hit của scanner mới đã đọc riêng: một ký tự lặp tạo fixture token; PIN literal6digits trong expected mock-fetch request. Không blind-reuse verdict cũ cho occurrences mới |

`002-finalize-selection.cjs:14`–20 chỉ chuyển đúng 11 entries HOLD có SHA trùng triage; publicationGate vẫn yêu cầu exact payload/owner/SEC/EVC review. Báo cáo tác giả `026-permission-git-milestone-preparation-2026-10-16.md:43`–49 nêu rõ INCLUDE là phạm vi đề xuất, không whole-file/payload/history secret clearance. Generated runtime/control/env outputs không được clear bởi source triage này.

29 known static import edges tới các HOLD và4 test-discovery omissions được khép bằng giữ lại source/tests, không bỏ tests hoặc source để né flag. Bảng after-triage rỗng tương ứng những cạnh đã biết; báo cáo không nhận đó thành mọi dynamic dependency/build đã PASS. Các HOLD/EXCLUDE khác vẫn nguyên; không có thao tác xóa.

## Minh chứng tiến độ không nâng mức PASS

`001-build-public-summary.cjs:18`–30 lấy fixed allowlist receipts đã lọc, không đọc raw logs; dòng 36–39 bỏ qua env template. Dòng 52–62 trích actor observation thành counts/booleans/status/hash và giữ release limits. Summary/portable report không có credential, raw Auth/store IDs, Storage paths/payload hoặc business full rows; env variable names trong AX không phải env values.

`027-permission-public-progress-evidence-2026-10-16.md:7`–27 ghi source fingerprint, lệnh và Windows lịch sử với giới hạn correspondence, không nhận hash recheck thành test rerun/full-source acceptance. Giữ unit1173/tooling489 và smoke44PASS/37SKIP; không nhận81/81PASS. Dòng 31–33 ghi worker33 đã gồm15 ca cũ, actual Linux/backend cases chưa chạy, caps chưa được quan sát áp dụng. Dòng 37–48 ghi actual actor/scope79/145/3/TLS/READ ONLY/rollback/close riêng với contract2/application/full-row/backup/recovery; cleanup/liveMutation và các proof mở rộng vẫn false. Không có tổng test count giả hoặc online compatibility/release PASS.

## Provider before-state và đề xuất có giới hạn

`009-vercel-preview-accessibility.txt:1`–2 bind đúng project URL; dòng 23 không có custom environments hiển thị, dòng 32 nêu auto deployments cho branches chưa match environment và vẫn deploy được bằng CLI/API khi tắt; dòng 35 checkbox=1, dòng 42 all unassigned branches. Ảnh before-state xác nhận cùng checkbox ON và nội dung giới hạn; không có secret value trong ảnh đã xem. Đây là before-state, không phải bằng chứng đã Save/OFF.

`007-provider-observations.json` và báo cáo tác giả dòng 59–80 nêu đúng tác động **toàn bộ nhánh chưa gán môi trường của project này**, gồm nhánh evidence/docs và nhánh nhóm khác; không chỉ riêng nhánh sắp push. Preview cũ không bị xóa; main Production branch/site/env/DB không đổi bởi setting được đề xuất. Main pushes và manual CLI/API deployments vẫn có đường chạy; other projects/providers/webhooks không được clear. Actions0/Pagesfalse hoặc docs Preview Error không được dùng làm bảo đảm không deploy. Không nâng scope credential để truy webhook.

Phương án cụ thể là owner cho tắt đúng Preview Branch Tracking rồi Save/re-read OFF; **chưa được cho thực hiện**. Khôi phục bằng cùng checkbox/Save/re-read chỉ sau lệnh owner, không tự bật lại vì sự kiện tương lai có thể deploy source còn chưa sẵn sàng. Đồng ý thay setting không phải quyền branch/commit/push. Nếu giữ ON, báo cáo yêu cầu dừng trước push thay vì tự chọn workaround. Ranh giới này phù hợp quyết định hiện chỉ chọn hướng chuẩn bị tại `call_d67bf7bb30f54f4a9fad75e26e9719c8`.

## Những việc còn mở không chặn proposal

- Public repo/nhánh/refspec, cách tạo commit cách ly và **exact bytes sẽ stage** chưa được duyệt thực thi. 828 INCLUDE là dirty deltas đề xuất; unchanged HEAD vẫn là nền implicit, không được hiểu là chỉ828 files sẽ reachable.
- `019-docs-reachable-history.tsv` ghi24 paths của hai local-only docs commits ngoài885 dirty rows. Báo cáo đã công bố reachability; không suy tracked/unchanged hoặc metadata clean thành full-history privacy assurance. Những hồ sơ raw/evidence chưa đọc không bị kết tội chứa secret vì thiếu audit, cũng chưa được chứng nhận công khai.
- Cần quyết định owner cho thay Preview setting, fresh state/trigger/ref/source check và review gói publication cụ thể trước branch/commit/push. Giữ code/docs riêng; đề xuất nhớ merge code evidence vào main sau gates/lệnh riêng, không merge docs kiến thức vào main.

Không phát hiện actionable blocker cần sửa trong candidate này. Giữ **APPROVE analysis/proposal** đúng hash trên; các giới hạn công khai và quyền thực thi không được tự miễn bởi verdict này.
