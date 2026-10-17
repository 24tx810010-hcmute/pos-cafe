# Gói CI-1 local — 15/10/2026

**Cập nhật PLAN-D11:** owner chọn [CI1 tối thiểu với safe log/summary](permission-linux-ci1-minimal-2026-10-15.md), bỏ mã hóa/DPAPI và mandatory raw replay sâu cho pilot. Gói mã hóa dưới đây giữ làm lịch sử đã review, không còn là thiết kế được đề nghị áp dụng. Không xin lại D10 hoặc triển khai crypto từ hồ sơ này.

**Đề xuất để review và owner quyết định thiết kế; chưa sẵn sàng thực thi.** [Khảo sát/căn cứ](../../implementation-log/permission-linux-ci1-survey-2026-10-15.md), [CI0 đã review](../../implementation-log/permission-linux-ci0-execution-2026-10-15.md). Không tạo một change nghiệp vụ mới; đây là slice chuẩn bị môi trường dưới kế hoạch phân quyền hiện hành, không viết lại acceptance của feature.

## Quyền và quyết định

Owner giao “Tiếp tục khảo sát và soạn gói CI-1 ở local … Chưa push thêm, chưa chạy CI, chưa sửa database hay deploy … hỏi và đợi”. Chỉ đọc source/metadata/tài liệu gốc và ghi proposal/evidence nhỏ tại local. Không stage/commit/push, tạo repo/workflow/khóa, cài, chạy thử, copy private input vào CI hoặc cleanup.

**PLAN-D10, đã chốt hướng khảo sát:** owner chọn “Giữ CI public; khảo sát gói bằng chứng mã hóa, khóa giải mã chỉ giữ trên Windows, chưa chấp nhận thiết kế trước khi review”. [Receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/owner-public-encryption-direction.json). Private CI không được chọn; không quay lại hỏi D04–D09/Tailwind. D10 không duyệt age, artifact/publication, keygen, source upload, workflow permission hoặc run.

Đề xuất cần quyết định sau review: chấp nhận **thiết kế age/ciphertext-only artifact/Windows custody có điều kiện0đồng** làm cơ sở cho gói triển khai tiếp, hoặc yêu cầu sửa. Chưa xin quyền chạy khi bound/quota và exact payload chưa đủ. Chưa có câu trả lời cho phần thiết kế này; không coi im lặng là đồng ý.

## Kết quả mong muốn và I/O đề xuất

Một pilot synthetic t04 với12service, cùng source/lock/runtime/backend, Auth thật + Storage/2EdgeFunctions + Realtime2clients + preservation. Không dùng dữ liệu kinh doanh hoặc backup hosted làm fixture. Pilot không thay full gates hoặc chứng nhận Supabase online đã tương thích.

| Input | Ràng buộc trước chạy |
| --- | --- |
| Source bundle | Manifest SHA256, regular-file allowlist,833files/deletionmarkers hiện là mốc tham chiếu; freeze lại sau implementation. Bao gồm code/test/config/lock, không .git/node_modules/artifacts/.env/private raw. Nội dung POS chưa công bố chỉ được đưa lên CI sau owner duyệt exact allowlist/diff và đích truyền; D10 không cấp quyền này |
| Runtime | Pin Node24.16.0/npm11.13.0 theo Windows hoặc tuple mới phải được khai báo/kiểm, không dùng Node22 của CI0 như bằng chứng tương đương; CLI2.117.0/current service profile;12image references resolve đúng OCI/platform với sizes/hash |
| Synthetic fixture |2tenant,5employees,2Auth users;16migrations ban đầu và candidate activation theo test; marker ngẫu nhiên/runtimeProof/API-observer binding,6StoragePNG/3buckets; không tái dùng stale JWT/mốcsource40 |
| Recipient |Đúng một native age X25519 public recipient và SHA256 public-key file được pin. Không identity/private key/passphrase trong source, command log, workflow secret hoặc CI |
| Budget/free |Upper bounds download/retained/peak gồm cache/copies/evidence; task≤20GiB, reserve≥30GiB, storage allowance đủ và stop phát sinh phí được chứng minh; chưa đủ thì không cài/chạy/upload |

| Output | Ràng buộc |
| --- | --- |
| Public summary |Versioned whitelist: repo/workflow/sourceSHA/lockSHA, runID/attempt, image/platform/runtime metadata, phase/resource high-water, case counts/status, ciphertext bytes/SHA. Không raw URL/token/DSN/schema rows/object IDs/exception stack/private path |
| Private payload |Manifest bên trong có run/source/environment bindings; đầy đủ raw receipts/logs, fixture identities, catalog/business/Storage preservation, source+recipe cần replay. Dữ liệu trước/sau phải có cùng provenance; không chỉ safe summary |
| Encrypted transport |Một ciphertext `.age` và summary gọn; upload chỉ explicit file, không glob/thư mục/hidden files/symlink. Size bị bound trước run và trước upload; thiếu/oversize thì BLOCKED, không drop raw hoặc split để né quota |
| Windows intake |Đích đề xuất `C:/Users/nguye/AppData/Local/pos-cafe-release/ci1-<runID>` với ACL current user+SYSTEM, thực đo C và D, không tự tạo/chmod lúc khảo sát. Key ở subdirkeys riêng; payload ở quarantine rồi verified sau đủ kiểm |

## Thiết kế mã hóa đề xuất — chưa triển khai

1. Sau scope cụ thể, cài age đúng upstream release/digest vào owned bin; trước đó hoàn tất download/extracted/peak bound. Không dùng mã tự viết hoặc shell password. Sinh private identity **trên Windows**, kiểm ACL không kế thừa; đề xuất bọc identity bằng DPAPI CurrentUser khi lưu, không log identity hoặc âm thầm fallback sang file plaintext. Derive public recipient và pin byte hash; key chỉ mở trong RAM/private process khi cần. Không export private key sang CI/secret/chat. DPAPI/recovery integration phải có test trước dùng. Một bản recovery của identity chỉ ở vị trí Windows do owner duyệt riêng; chưa chốt cơ chế recovery thì không keygen. Mất mọi bản key hoặc mất khả năng mở DPAPI profile thì có thể không khôi phục được ciphertext, không hứa có cloud recovery.
2. Kiểm canary không bí mật, wrong-key/tamper/truncation và binding/replay rejection trước pilot. Công cụ Windows nhận plaintext chỉ vào quarantine riêng tư; age có thể xuất một phần plaintext trước xác thực stream cuối, vì vậy chưa được đưa output `.partial` vào verified tree hoặc thực thi/restore. Exit0, archive validation và manifest binding đều phải đạt trước admission. Khi lỗi giữ riêng trạng thái lỗi, không tự xóa nếu chưa có scope cleanup.
3. CI chỉ có public recipient. Synthetic secrets/raw nằm dưới private root0700/files0600; capture stdout/stderr private, không `set -x`, không dump env/docker inspect/status ra log public. Sau quiesce+consistent DB/Storage capture, manifest tất cả raw regular files bằng path/bytes/SHA256. Seal bằng age streaming; không giữ thêm plaintext tar nếu stream dùng được. Dự trù raw+ciphertext+temporary overhead; không giả streaming loại mọi peak.
4. Ciphertext-only Actions artifact là đường chính đề xuất. Freeze/pin official upload action commit trước implementation, không cache, retention đề xuất7ngày chỉ cho ciphertext transport. Trước upload phải kiểm sốfile/hash/bytes và negative control ngăn raw/symlink/path escape. Native upload runtime token chỉ phục vụ artifact; workflow đề xuất `contents:read` nếu cần source checkout, không Contents write/deploy/OIDC/prod secrets. Permission thực tế phải được review với YAML cuối. Error handler cũng chỉ in code/safe summary, không fallback upload raw.
5. Windows tải bằng gh hiện có theo repo/runID/attempt/artifactID cố định; so API artifact digest và ciphertext hash/bytes với workflow/source SHA đã duyệt. Age bảo vệ tính toàn vẹn/confidentiality, **không xác thực người gửi**; ciphertext hash tự công bố không đủ. Giải mã vào quarantine rồi xác nhận manifest bindings, tất cả hashes, tar path không absolute/`..`/link/device/extras. Chỉ sau admission mới đọc raw/cho replay trong môi trường được giao. Chưa có actual roundtrip/replay chứng minh.
6. Artifact công khai ciphertext có thể bị tải/sao chép lâu dài; retention7ngày không thu hồi các bản sao, và lộ kích thước/thời gian/metadata whitelist. Plaintext trên CI chỉ riêng trong owned runtime đang chạy; private identity dài hạn chỉ Windows. Reviewer raw làm tại Windows private intake hoặc môi trường private được giao, không đổi ACL để gửi reviewer. Khóa phiên trong RAM CI là chi tiết mật mã tạm thời, không lưu vào output.
7. Không chủ động xóa artifact/key/plaintext/runtime; retention7ngày là TTL transport đề xuất cần được giao trong scope upload sau này, không phải setting đã đổi. Giữ raw phục vụ review/replay trong ngân sách, đo sau run; nếu sắp hết retention mà chưa intake/verify thì BLOCKED và báo owner, không nhận package hoàn tất hoặc giả đã giữ evidence. Ciphertext không đủ thay raw đã giải mã/kiểm chứng. Đề xuất cleanup theo đúng đường dẫn/bytes/tác động ở checkpoint riêng, chưa được giao.

Miễn phí là **điều kiện bắt đầu**, chưa đạt chỉ từ public repo: compute standard miễn phí nhưng storage phải chứng minh allowance/stop/bounds. Release assets/draft là hướng dự phòng được khảo sát trong biên bản, chưa chọn; không tự chuyển sang upload Release hoặc cấp Contents write nếu artifact quota không đạt. Không upload bất cứ thứ gì trong scope hiện tại.

## Kế hoạch thực hiện có điều kiện

| Bước | Việc/đầu ra | Điều kiện/quyền |
| --- | --- | --- |
| C1-P0 |Review proposal, owner quyết định thiết kế sau review |Phạm vi hiện tại. Không là quyền implement/keygen/install |
| C1-P1 |Read-only inventory registry/platform/sizes, source recovery, allowance/budget/retention metadata; freeze install bill of materials |Tiếp tục khảo sát local/metadata; không cần xin lại khảo sát. Nếu quota chỉ owner xem được thì trình đúng câu hỏi, không xin PAT rộng hơn |
| C1-P2 |Gói triển khai local với diff/manifest/testplan và scope được giao: transport/path/runtime preflight/bootstrap/pilot/seal/offline-intake helpers |Phải có lệnh triển khai riêng; code executable thuộc main, docs thuộc docs; không sửa artifacts lịch sử. Hiện chưa có quyền |
| C1-P3 |Đóng tests local phù hợp và crypto/budget/ACL/negative controls, 2review final candidate code/YAML/source/recipe |Chỉ sau scope P2/installs có estimate hợp lệ; không chạy test DB trong scope khảo sát hiện tại |
| C1-P4 |Trình exact push/source allowlist/workflow permissions/đích artifact/run count/timeout/install bounds để owner duyệt |Chưa đủ dữ kiện nên chưa xin quyền chạy. Phải kiểm Vercel/integration tránh tự deploy ở thời điểm publish mới; waiver Locofy CI0 không tự mở rộng CI1 |
| C1-P5 |Một pilot nếu được giao, không retry/matrix; fresh preflight mỗi lần, một backend/candidate; seal và Windows intake |Không thực hiện từ proposal này; fail/unknown ACK phải reconcile, không dispatch lại |
| C1-P6 |SEC/EVC actual, giữ evidence replay; sau đó mới lập full PIN19/PERM60/HP1 +27stagegate |Pilot PASS không thay denominator hoặc mở DB online/deploy |

Future implementation map (đề xuất, **chưa tạo file**): `scripts/permission-ci1-preflight.mjs`, `permission-ci1-bootstrap.mjs`, `permission-ci1-pilot.mjs`, seal/intake helpers và tooling contracts; source hóa helper Storage/prewarm từ artifact; adapter transport tường minh trong identity/bridge/PIN runtime với guard giữ nguyên. Không sửa application permissions/UI hoặc baseline audit để làm pilot xanh. Nếu cần profile/service/version mới, review chênh lệch trước, không tự đổi acceptance.

## Ma trận kiểm chứng/traceability đề xuất

| Mã | Yêu cầu → kiểm | Expected / hiện trạng |
| --- | --- | --- |
| C1-T01 |Fresh source/runtime → manifest/checksums/endpoint/marker/observer |Đúng same source/backend, không ngoại tenant; chưa chạy |
| C1-T02 |Auth → bootstrap2synthetic users và login thật |Không stale token/prod DSN; đúng2tenant/5employees; chưa chạy |
| C1-T03 |Storage+Edge → **toàn bộ1case T09** tại permissionImagesRuntime.contract.test.ts:47 |Direct storage deny; HTTP/auth/cache lifecycle đúng; chưa chạy |
| C1-T04 |Realtime → **toàn bộ3cases T10** tại permissionSignals.contract.test.ts:10,47,56 |Minimal signals/RLS; same event tới2clients,cross-tenant0; rollback0signal; catalog không đổi employee revision. SUBSCRIBED không là delivery; chưa chạy |
| C1-T05 |Preservation → source/catalog/business/Storage6payload trước/sau + consistent archive đọc được |Không drift; owned targets; replay inputs đủ, chưa chạy. Restore rehearsal là bước riêng cần budget/scope, không gọi readable/hash là restore PASS |
| C1-T06 |Namespace/daemon/cgroup/network và budget/free → fault/threshold controls |Owned store/socket, không host daemon, ≤20GiB/≥30GiB, STOP trước ghi không bound. Chưa có proof/enforcement mới |
| C1-T07 |Encryption/custody → canary,wrong-key,tamper,truncation,partial-output quarantine |Fail-closed, private key chỉWindows, không raw/logsecret upload; chưa chạy |
| C1-T08 |Authenticity/replay → wrong repo/run/attempt/source/recipient/hash/path/extra files |Không admit encrypted package chỉ dựa self-declared hash; chưa chạy |
| C1-T09 |Quota/retention/intake failure → upload/download unavailable/oversize/expired |BLOCKED/chưa đủ evidence; không fallbackpublicraw/paidstore hoặc bỏ raw; chưa chạy |

Đây là9nhóm expected, không là9runtime cases đã chạy. Pilot nghiệp vụ chính4cases=T09x1+T10x3, còn preflight/bootstrap/preservation/security controls là tiêu chí bổ sung bắt buộc; không nhận một healthcheck là PASS. Full gate giữ PIN19 với55browser/41SQL/1canary/2operator, PERM60/726variants,27stages và HP1 đầy đủ theo gate hiện hành. Không ghép evidence nhiều backend/source thành aggregate.

## Bàn giao

SEC/EVC đã APPROVE khảo sát/proposal có điều kiện, chưa có owner approval thiết kế. Source/metadata được hash tại survey root; frozen candidate gồm proposal/report/correction/index/receipts và nguồn liên quan để phục hồi. Guided review đã chuẩn bị: input survival → oneprofile/guards → budget gaps → crypto custody/transport → intake failures → gates; chưa có xác nhận owner đã đọc/hiểu. Bước kế tiếp hợp lệ là quyết định thiết kế và đóng read-only unknowns; chưa có lệnh push/run/DB/deploy/cleanup.

Metadata sau freeze: candidate01 SHA `85c4d595de332e99dceab176640ac408822018edaa3775f31eec9c34d289f34d`,37files/568.201bytes; cả hai reviewer APPROVE,0findings. [Review](../../reviews/2026-10-15-permission-linux-ci1-local-proposal.md). Snapshot không đổi; chỉ bổ sung verdict review vào live docs. Lựa chọn D10 và giới hạn quyền vẫn nguyên; chờ owner quyết định thiết kế.
