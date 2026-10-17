# Chuẩn bị CI-1 tối thiểu — 15/10/2026

**Đang soạn và review gói local; chưa có implementation hoặc actual CI-1.** [Gói hiện hành](../workflow/tasks/permission-linux-ci1-minimal-2026-10-15.md) thay phương án mã hóa trước theo PLAN-D11. User chọn evidence tối thiểu cho đồ án/public, giữ thông tin quan trọng ngoài nội dung công khai. Raw/evidence cũ không bị xóa. Không coi chỉ đạo này là cấp quyền push/CI/DB online/deploy.

Code HEAD vẫn `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; worktrees dirty từ trước, không stage/commit/chuyển nhánh. Chỉ thêm local metadata investigation và docs; không sửa application/harness, không cài, tạo key, chạy test/DB/Docker/CI hoặc xóa gì.

## Thay đổi so với gói37file đã review

| Gói cũ | D11 hiện tại |
| --- | --- |
| age+DPAPI/private identity/ciphertext artifact |Bỏ toàn bộ phần crypto/key/recovery |
| Mandatory private raw+archive/replay |Chỉ safe counts/source/commands/status và ảnh thực cần thiết; chấp nhận không replay DB/raw sâu |
| Artifact allowance/storage0đồng là blocker |Không upload artifact/cache/Packages/Release; dùng log+JobSummary và local receipt nhỏ |
| Có khảo sát browser/cache trong BOM |Pilot T09/T10 API dùng Node, không cần cài/tải browser trong slice này |
| Mộtprofile12service/4businesscases |Giữ nguyên guard và toàn bộ assertions T09x1/T10x3, không giả healthcheck là behavioralPASS |

Đây là thay đổi acceptance do owner chọn, không phải AI âm thầm bỏ privacy/coverage để vượt gate. Nó chỉ áp dụng gói CI1; [full gate boundary lịch sử](permission-linux-ci1-survey-2026-10-15.md) vẫn cần nêu đúng khi đánh giá toàn dự án. Không nhận approval gói cũ thành approval gói tối thiểu mới.

## Điều kiện miễn phí đã khảo sát lại

GitHub ghi public standard compute miễn phí và log/JobSummary không tính vào artifact allowance; thiết kế không dùng storage features tính phí. [Nguồn chính thức](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [receipt](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/github-log-summary-policy.json). Không có thay billing setting/payment hoặc tạo resource; đây là điều kiện policy của thiết kế, không đối soát hóa đơn actual CI1. Safe log cũng là nội dung public nên vẫn cần allowlist và giữ bí mật ngoài output.

## Registry metadata — không pull/start

Đã dùng HTTP API public registry theo [AWS ECR Public documentation](https://docs.aws.amazon.com/AmazonECR/latest/public/public-registry-auth.html). GET đầu tiên không bearer trả401challenge, sau đó trao đổi anonymous bearer ngắn hạn theo challenge; không dùng AWS profile/credential đã lưu, không in/lưu token. Chỉ đọc manifest/index và config JSON nhỏ, không request layer hoặc tải installer.

[Collector chỉ khảo sát](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/inspect-registry-metadata.ps1), [receipt lần đầu](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/registry-metadata.json):11/12image đã xác minh manifest+Linux/amd64 config,98.350bytes metadata.11digest `c.Image` lịch sử khớp tag manifest/index, khác selected-platform manifest/config; vì vậy metadata mới đã phân biệt các loại digest cho11image, không còn phải suy đoán chỉ từ kích thước blob. Storage-api:v1.72.1 trảHTTP429, giữ làUNVERIFIED; không suy thiếu image hoặc tự thay tag.

93compressed-layer descriptors độc nhất của11image có tổng1.757.282.677bytes; **LỚN HƠN1GB**, và đây mới là partial compressed-download basis, chưa đủ12image, không phải unpacked/peak upper bound. Không có1,757GB layer được tải; dữ liệu nhận chỉ metadata98KB. Registry metadata PASS không chứng minh docker pull/CLI/profile tương thích hoặc startup thành công. Cần đóng phần Storage và bound còn thiếu trước cài.

Phần collector output ngắn ở console có Select-Object trên hashtable khiến hàng unverified hiệnnull; bản JSON receipt giữ đủ ref/status429. Đã đọc lại JSON xác nhận rõ storage-api429; không đổi kết quả thànhPASS hoặc ghi đè attempt cũ. Bản hiển thị không được dùng thay receipt chi tiết.

Đã retry **đúng một image metadata Storage** sau backoff>60giây, không chạy lại batch12 và không retryCI. [Intent](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/storage-metadata-retry-intent.json), [receipt riêng](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/registry-storage-retry.json). Storage manifest/config Linux/amd64 đã khớp; attempt429 được giữ. [Kết quả kết hợp](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/registry-combined.json) có12/12ref duy nhất: tất cả historical `c.Image` khớp tag indexmanifest; selected-platform/config là digest khác được kiểm riêng.106layer descriptors duy nhất tổng **1.997.580.262bytes≈1,860GiB** nén;12configJSON tổng66.349bytes. Tổng metadata thực nhận112.196bytes, không image layer được tải. Các con số11/12/93layers phía trên là lịch sử attempt đầu, không trạng thái hiện tại.

Đã khép registry tag/index/platform/config metadata binding; actualpull/CLI/image store identity/startup và mọi uncompressed/DB/WAL/peak bound vẫn chưa có. Không suy metadata thành runtimePASS hoặc khẳng định tổng lượt cài dưới20GiB.

## Correction sau review candidate01

EVC-MIN-01 phát hiện `elapsedSinceInitialSeconds=25433` trong intent retry bị sai. Giữ nguyên receipt và snapshot01; [correction riêng](D:/Workspace/pos-cafe/artifacts/permission-linux-ci1-minimal-20261015/timestamp-correction.json) tính lại trực tiếp từ chuỗi UTC gốc bằng DateTimeOffset: initial completed→intent **233,354818giây**, completed→retry actual **233,4025036giây**. Điều kiện thực tế >60giây vẫn đạt. Phép chuyển kiểu cũ parse lại DateTime do JSON tự chuyển đã làm mốc lệch bảy giờ và mất phần giây lẻ; guard tính từ phép đó không đáng tin, không được dùng làm bằng chứng. Không gọi registry hoặc chạy lại gì để sửa số liệu này.

SEC-MIN-01 phát hiện mục lục vẫn ghi chờ owner duyệt thiết kế crypto dù D11 đã thay thế. Đã sửa đúng dòng lịch sử trong task index, không mở lại câu hỏi mã hóa. Candidate01 giữ verdict CHANGES_REQUESTED của cả hai reviewer; candidate02 sẽ khóa correction và các chỉnh hồ sơ để review lại.

## Trạng thái và việc tiếp theo

Khảo sát mới gỡ crypto/retention/artifact quota/browser và xác minh đầy đủ registry metadata khỏi critical path của pilot. Còn fresh recipe, source publication allowlist, actual image-store/runtime binding và bounds npm/CLI/DB/WAL/peak. Dùng công cụ có sẵn và bản source Windows đã kiểm, không tạo môi trường nặng mới. Metadata/docs mới dự kiến<1MiB, có snapshot phục hồi; đo C/D tại freeze/final. Không tạo repo mới vì repoCIpublic đã có, nhưng publication/run mới vẫn cần lệnh riêng.

Gói tối thiểu sẽ được SEC/EVC review riêng trước bàn giao. Review không thay actual tests hoặc owner scope triển khai local; không tuyên bố dự án deploy-ready từ tài liệu này.

### Cập nhật review sau freeze

SEC và EVC đều **APPROVE candidate02** SHA256 `950abb1aaea99f32e00cf59e146cf9ffe7d133f73fe43d02ce7aa9f04e44e206`,22files/371839bytes; hai finding candidate01 đã đóng. [Review và giới hạn](../reviews/2026-10-15-permission-linux-ci1-minimal.md). Hoàn thành gói khảo sát/kế hoạch D11 tại local; chưa có actual CI1 hoặc implementation reporter. Việc triển khai hai file pure Node đã được mô tả cụ thể trong plan nhưng vẫn chờ owner giao scope. Không có cài/push/CI/DB/deploy/xóa mới.
