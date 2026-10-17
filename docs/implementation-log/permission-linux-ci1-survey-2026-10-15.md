# Khảo sát CI-1 tại local — 15/10/2026

**Đầu ra là khảo sát/thiết kế đề xuất; chưa hiện thực hoặc chạy CI-1.** Owner giao khảo sát và soạn gói local, ưu tiên miễn phí, chưa push thêm/chạy CI/sửa DB/deploy; mọi quyết định phải hỏi và đợi. Sau câu hỏi, owner chọn giữ CI public và khảo sát bằng chứng mã hóa, khóa giải mã chỉ trên Windows, **chưa chấp nhận thiết kế trước review**. [Gói đề xuất](../workflow/tasks/permission-linux-ci1-local-proposal-2026-10-15.md).

## Nguồn và ranh giới

Code `D:/Workspace/pos-cafe`, main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs worktree riêng HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. Không stage/commit/đổi nhánh. [Baseline và quyền](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/survey-baseline.json), [hash24nguồn được khảo sát](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/source-references.json). Không tạo YAML/harness executable, khóa, môi trường, bản backup hoặc gói mã hóa. Không chạy test, DB hoặc provider mutation. Các GET mới chỉ user identity/metadata release công cụ và tài liệu chính thức; chưa truy cập billing UI hoặc xác minh quota.

[CI0](permission-linux-ci0-execution-2026-10-15.md) đã PASS một lượt trên public standard Ubuntu24.04:4CPU, khoảng16GBRAM và85,12GiBfree, đủ tools/namespace. Không nhận số đó là dung lượng đảm bảo của lượt sau hoặc khả năng chạy daemon/full stack. Windows exact-lock đã review riêng; không chạy lại trong khảo sát này. Giữ Tailwind3/cảnh báo3 không chặn.

## Phát hiện sửa nhận định về input cũ

Recipe [prepare-linux.py:12](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prepare-linux.py:12) trỏ staging source40 trong `/var/tmp` đã mất cùng WSL. Tuy nhiên [prepare-local.mjs:6](D:/Workspace/pos-cafe/artifacts/permission-backup-v2-20261014/prepare-local.mjs:6) còn trỏ config trên Windows và override scope ở dòng7. Kiểm mới chỉ parse5reference keys, stat và SHA256; không in, giải nén hay thực thi nội dung raw. **Cả6input gốc tồn tại và khớp hash**, tổng954.052bytes. [Receipt metadata](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/original-inputs-metadata.json) giữ đường dẫn/hash/bytes chính xác.

| Input | Bytes | Nguồn so khớp |
| --- | ---: | --- |
| database.dump |869.498|schemaArchive trong config Windows |
| roles-no-passwords.sql |5.354|schemaRoles |
| metadata.json |46.785|schemaMetadata |
| fixture.sql |3.175|fixture |
| diversity-attempt3.sql |5.732|diversity |
| scope79-approval.json |23.508|Override trong prepare-local và pin tại [permission-hosted-backup.mjs:38](D:/Workspace/pos-cafe/scripts/permission-hosted-backup.mjs:38) |

Mất staging WSL không chứng minh input gốc mất. Hash chỉ chứng minh byte identity, chưa chứng minh restore/semantic equivalence hoặc cấp quyền dùng input hosted trong CI mới. [local-run.mjs:26](D:/Workspace/pos-cafe/tests/contracts/hosted-backup/local-run.mjs:26) yêu cầu schemaOnly trước fixture/diversity; [runtime:61](D:/Workspace/pos-cafe/scripts/permission-hosted-runtime.mjs:61) truyền `--schema-only`. Điều đó không biến archive nguồn thành dữ liệu được phép công khai. Pilot đề xuất dùng migrations và synthetic fixture mới; sáu raw input trên **không thuộc payload CI-1**. Scope79 cũ không được dùng làm quyền cho run mới.

## Pilot nhỏ nhất giữ guard hiện có

Một profile t04 `supabase-identity-v1`, đủ12containers theo [runtimeProof:25](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:25): db/auth/rest/kong/storage/realtime/edge_runtime/studio/pg_meta/inbucket/vector/analytics. Không giảm còn7services hoặc gọi đó là cùng full gate. Recipe lịch sử [gate-namespace.py:6](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/gate-namespace.py:6) dựng5profiles, root/cache từngattempt; không chạy nguyên trạng cho pilot mộtprofile.

[Bootstrap:80](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:80) có đường dựng fresh:16migrations,2synthetic Auth users,2tenant/5employees, business fixture và marker/API-observer binding. Sau bootstrap còn cần precreate3buckets,6PNGreadback ([helper:11](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/seed-t04-storage58.mjs:11)), Realtime infrastructure prewarm và baseline riêng. Những helper ad-hoc cần chuyển thành source được pin/review, không sửa artifact cũ tại chỗ.

Phần port còn thiếu: [bridge-runtime:16](D:/Workspace/pos-cafe/scripts/permission-bridge-runtime.mjs:16) gọi WSL vô điều kiện; identity/PIN đã có nhánh Linux nhưng còn root/project/port/CLI pin. [prepare-gate-isolation.py:7](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prepare-gate-isolation.py:7) cần60stoppedcontainers/runtime/cache cũ. Cần transport/path/config mới tường minh và fail-closed; không giả tuple Node22/Docker28/containerd2.3 của CI0 thành tuple WSL cũ. Một daemon/image store thuộc task; kiểm namespace/cgroup/network/owned sockets thực trước fixture. Không dùng Docker daemon mặc định hoặc tạo WSL/Docker Desktop.

## Ngân sách — chưa đủ điều kiện cài/chạy

**LỚN HƠN 1 GB:** archive12images lịch sử đã1.998.099.968bytes (~1,861GiB), chưa gồm giải nén/dependencies/cache/DB/evidence. Đây không phải số download mới hoặc trần peak. [Budget metadata](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/budget-observations.json).

| Hạng mục | Căn cứ | Giới hạn suy luận |
| --- | --- | --- |
| Image archive |[gate-isolation-inputs:17](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/gate-isolation-inputs.json:17),1.998.099.968B|Không là unpacked size/download upper bound |
| Một pure-image containerd root cũ |[rebuild-proof:200](D:/Workspace/pos-cafe/artifacts/disk-incident-20261014/hp1-image-rebuild-proof-02.json:200),8.480.505.856–8.480.563.200B≈7,898GiB|Đã gồm store; không cộng blob lần nữa, không là bound mới |
| Store+archive đồng thời |Khoảng9,759GiB từ hai số đo trên|Chưa DB/WAL/npm/browser/cache/raw/ciphertext |
| Linux browser cache cũ |[inventory:289](D:/Workspace/pos-cafe/artifacts/disk-incident-20261014/inventory-04-labelled.json:289),671.494.144B|Không gồm download/OSdeps/peak mới |
| npm/DB aggregate cũ |[inventory:2163](D:/Workspace/pos-cafe/artifacts/disk-incident-20261014/inventory-04-labelled.json:2163)|Nhiều roots; không chia trung bình thành one-pilot cap |
| Raw package source56 |[private-package:5](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/private-package-01.json:5),4.327.352.320B|Gồm runtime/image/evidence; không copy nguyên hoặc cộng trùng vào pilot |
| Source hiện Windows |13.328.217B/833files +2deletionmarkers theo manifest đã review|Không gồm dependency/runtime; source58 lịch sử là package khác |

Historical image map [prepare-gate-isolation.py:11](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/prepare-gate-isolation.py:11) lấy Docker `c.Image`. Chưa có chứng minh loại OCI manifest/config, RepoDigests hoặc platform; không tự ghép `tag@digest` rồi coi registry đã pin. Phải resolve registry/platform và sizes trước cài. Không tự đổi image/version để vừa dung lượng.

Giữ tăng task≤20GiB, free≥30GiB trước mỗi ghi lớn và checkpoint, một active heavy runtime. Chưa có upper bound hợp lệ cho pull/unpack/npm/browser/CLI/Edge/DB/WAL/preservation/raw+ciphertext/Windows nhận evidence; **STOP trước cài** cho tới khi đủ. Có thể nghiên cứu filesystem hữu hạn cho owned runtime, nhưng hiện chưa tạo/kiểm quota; polling/timeout không là quota. Không prune phần mềm preinstalled, hạ coverage hoặc thêm runtime thay thế. Bản Windows được giữ, không chạy song song stack mới.

## Miễn phí và giữ evidence

[GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) công bố standard Ubuntu public4CPU/16GB, private2CPU/8GB. CI0 public không chứng minh resource của private runner. [Billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) cho public standard minutes miễn phí; larger runner luôn tính phí. Quota Actions artifact dùng chung với Packages; không nhận minutes miễn phí là toàn tác vụ0đồng. CLI user GET có planName=null, chưa biết allowance hiện còn, payment/stop/budget; null không chứng minh miễn phí hoặc không có thẻ.

[Artifact read access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) không bảo vệ raw trên public repo. Thiết kế chính đề xuất ciphertext-only Actions artifact, không cache; chỉ cho upload khi kiểm đủ miễn phí và bound. Repo public không đổi visibility/ACL. Thiếu bằng chứng storage0đồng thì dừng; không tự chọn dịch vụ có phí, repo private hoặc nới bảo mật.

Đã khảo sát phương án dự phòng [Release assets](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases): mỗifile<2GiB, tổng/bandwidth không có giới hạn công bố. Draft chỉ có push users trong listings ([REST releases](https://docs.github.com/en/rest/releases/releases)); chưa kiểm download ACL thực. Đường này cần quyền Contents write/tag/release và xét integration, nên **chưa được chọn hoặc cho phép**; không dùng để lách điều kiện storage của thiết kế chính. Không suy giới hạn phát hành thành đối soát hóa đơn.

Đề xuất `age`v1.3.2 native X25519/AEAD theo [upstream](https://github.com/FiloSottile/age) và [format specification](https://age-encryption.org/v1), không tự viết thuật toán. GPG2.4.9/OpenSSL3.5.6 có sẵn; chưa chạy encryption hoặc keygen. `age` chưa thấy trong PATH/bundled paths đã kiểm. [Release metadata](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-survey-20261015/age-release-metadata.json) ghi Linuxamd64 archive19.405.817B và Windowsamd64zip20.250.704B, tổng39.656.521B tải nếu cảhai được chọn; có digest upstream. Chưa tải, chưa biết extracted/cache/peak nên chưa có install upper bound. GPG hiện có là phương án được cân nhắc; age được đề xuất vì format/recipient đơn giản, streaming authenticated encryption, không cần keyring/UID hoặc tự dựng hybrid protocol. Quyết định thiết kế còn chờ owner sau review.

Private identity key chỉ Windows; CI chỉ nhận public recipient. Khóa phiên do công cụ dùng trong RAM để mã hóa không là private identity key; không lưu key/session state vào artifact. Không nhận mã hóa là chứng minh sender: offline intake phải so GitHub repo/workflow commit/runID/attempt/assetSHA từ kênh đọc xác thực, rồi kiểm manifest bên trong. Thiết kế chi tiết và failure tests ở handoff. Chưa tạo key/ciphertext, chưa nhận ciphertext public là đã được owner đồng ý công khai.

## Kết luận đúng phạm vi

Đã có source map, correction6inputs, pilot/test matrix, ranh giới port, budget gaps và encryption proposal. Chưa chứng minh execution khả thi trong20GiB, storage miễn phí, crypto roundtrip hoặc full gate. Khảo sát và proposal sẽ qua SEC/EVC trên frozen candidate trước xin quyết định thiết kế. Không thay các gate PIN19/PERM60/HP1/27stages hoặc quyền hosted. Không có dữ liệu được xác định hết nhu cầu để đề nghị xóa; giữ evidence khảo sát gọn.

Metadata sau freeze: SEC/EVC cùng APPROVE candidate01 SHA `85c4d595de332e99dceab176640ac408822018edaa3775f31eec9c34d289f34d`,37files/568.201bytes, không findings. [Biên bản review](../reviews/2026-10-15-permission-linux-ci1-local-proposal.md). Gói khảo sát local đã hoàn tất đúng phạm vi; owner approval thiết kế còn chờ. Các điều kiện execution chưa có proof vẫn giữ, không được chuyển thành PASS từ approval tài liệu.
