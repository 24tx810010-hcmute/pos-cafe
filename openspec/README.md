# OpenSpec cho pos-cafe

## Cập nhật bộ chống trùng ngày 2026-09-10

[add-idempotent-write-operations](changes/add-idempotent-write-operations/proposal.md) có **bảy loại artifact / 13 file Markdown**, gồm 33 requirement, 12 use case, 93 testcase gốc và các ma trận biến thể. [Testplan](changes/add-idempotent-write-operations/testplan.md) ghi expected trước code; [đối chiếu review ngoài](../docs/reviews/2026-09-07-idempotency/15-doi-chieu-review-ngoai-va-bien-tap.md) ghi các đính chính sau mốc ba reviewer. Ước lượng 76,5 + 2n giờ công; lịch/phạm vi triển khai chưa chốt lại. Chưa triển khai ứng dụng hoặc chạy test tính năng mới.

Thư mục này là nơi quản lý spec của dự án. Nó chỉ tồn tại trên nhánh `docs`; nhánh `main` cố ý không có.

## Cập nhật ưu tiên 2026-09-08

Chủ dự án chọn **online** cho phạm vi hiện tại. `add-idempotent-write-operations` tiếp tục ưu tiên, hướng tới đăng ký và khôi phục lệnh trên server. `add-offline-data-layer` và `add-offline-sync-conflict-resolution` **hoãn**; `add-offline-status-ux` hoãn phần hàng đợi/đồng bộ, còn báo mất kết nối và kết quả chưa rõ của bốn RPC thuộc spec chống trùng. Không còn cam kết offline tuần 11–13.

Quyết định nghiệp vụ nằm trong [tài liệu 10](../docs/reviews/2026-09-07-idempotency/10-quyet-dinh-sau-review-va-chinh-sach-gia.md); bộ hiện hành nằm tại [proposal chống trùng](changes/add-idempotent-write-operations/proposal.md). Tài liệu 07 và danh sách 32 PRE-IDEM là mốc trước review, không thay thế bộ hoàn chỉnh ngày 2026-09-09. Các proposal offline hoãn vẫn được giữ tham khảo, không archive như đã hoàn thành; vì vậy vẫn có thể xuất hiện trong `openspec list`.

## Cách gọi

Worktree này đã đăng ký làm store id `pos-cafe-docs`, nên chạy được từ bất kỳ đâu:

```bash
openspec list --store pos-cafe-docs
```

Slash command `/opsx:propose`, `/opsx:apply`, `/opsx:archive` chỉ nạp khi mở Claude Code tại chính worktree này, vì `.claude/commands` nằm trên nhánh `docs`.

## Hai thư mục

- `specs/` là **hiện trạng**: hệ thống đang làm được gì, tại thời điểm này. Backfill từ `docs/requirements.md` (FR-01 tới FR-21, NFR-01 tới NFR-08) và `docs/features.md`.
- `changes/` là **đề xuất**: việc muốn làm nhưng chưa làm. Khi một change được hoàn thành và archive, phần delta của nó được nhập vào `specs/`.

`specs/` hiện có 16 năng lực. Ngày 2026-08-28 đã tách hai năng lực mới ra khỏi các spec cũ, không đổi một chữ nào trong nội dung requirement nên hiện trạng hệ thống giữ nguyên:

- `receipt-printing` gom việc in ấn vốn nằm rải ở ba spec: phiếu tạm tính và hóa đơn cùng giới hạn in từ `payment`, in lại hóa đơn từ `order-history`, phiếu gửi bếp từ `order-management`. Lý do tách: requirement giới hạn in áp dụng cho cả ba nhưng chỉ được phát biểu trong `payment`. Truy vết FR-10 và FR-13 chuyển sang năng lực này.
- `order-void` tách hủy đơn đã thanh toán khỏi `order-history`. Lý do tách: đây là thao tác ghi đụng tiền có quyền riêng, lý do bắt buộc, dấu vết kiểm toán và khóa lạc quan, khác loại với mục đích tra cứu của spec cũ. Truy vết FR-15 chuyển sang năng lực này.

Các proposal trỏ tới phần đã di chuyển đã được cập nhật theo: `add-discount-engine`, `add-recipe-based-stock-deduction`, `add-offline-status-ux`, `add-customer-registry`, `expand-e2e-coverage`.

## Kiểm kê `changes/` trước khi hoàn thiện chống trùng ngày 2026-09-09

Các số đếm dưới đây là mốc kiểm kê cũ; thay đổi mới nhất của chống trùng được ghi ở đầu trang. Không dùng số lỗi validate tổng cũ để kết luận bộ chống trùng hiện còn thiếu delta.

27 trong 29 change đang ở trạng thái **mới có `proposal.md`**, chưa có các artifact còn lại. Đây là chủ ý, không phải thiếu sót. Hai change đã có đủ bốn artifact và sẵn sàng implement: `redesign-permission-model` và `add-owner-account-and-store-provisioning` (viết ngày 2026-08-31).

`define-test-strategy` đã hoàn tất và archive ngày 2026-09-07 thành `changes/archive/2026-09-07-define-test-strategy`. Nó là **khuôn mẫu** của chuẩn bảy artifact.

Ba change thêm ngày 2026-09-07 sau khi rà tải lúc chạy: `measure-runtime-load`, `optimize-runtime-load` và `handle-long-running-session`. Xem mục "Nhóm hiệu năng và phiên chạy dài" bên dưới.

Vì vậy `openspec validate --changes` báo lỗi `Change must have at least one delta` cho 21 change. Đó là trạng thái mong đợi: delta spec chỉ được viết sau khi các câu hỏi trong proposal đã có câu trả lời. 6 change thuộc nhóm công cụ và quy trình đặt `skip_specs: true` nên pass, cộng hai change đã có delta, tổng 8 pass.

Hai change đã có mục `## Quyết định đã chốt` được điền:

- `redesign-permission-model`: **đã chốt hết và đã có đủ artifact** gồm `specs/`, `design.md` và `tasks.md`. Chờ implement.
- `add-owner-account-and-store-provisioning`: **đã chốt hết**, 21 quyết định, không còn câu hỏi bỏ ngỏ. Bốn artifact đã viết xong ngày 2026-08-31, delta chia bốn capability là `owner-account` (mới), `store-onboarding`, `store-isolation` và `employee-session`. Chờ implement.

Hai change này phải làm nối tiếp: `redesign-permission-model` đưa vào vai trò chủ quán, `add-owner-account-and-store-provisioning` sau đó gắn vai trò đó với tài khoản chủ đã xác thực email. `add-provider-admin-console` tách ra từ trao đổi ngày 2026-08-28 và làm sau cùng.

## Quy tắc bắt buộc trước khi làm một task

Mỗi `proposal.md` có section `## Câu hỏi phải chốt trước khi làm`. Trước khi viết delta spec, design, tasks hoặc bất kỳ dòng code nào cho một change:

1. Đọc section đó.
2. Hỏi người dùng toàn bộ câu hỏi chưa được trả lời.
3. Ghi câu trả lời vào section `## Quyết định đã chốt` của chính proposal đó.
4. Sau đó mới chạy tiếp `/opsx:apply`.

Quy tắc này cũng được khai báo trong `openspec/config.yaml` phần `operations.apply.guidance` để mọi phiên làm việc sau đều thấy.

## Thứ tự phụ thuộc

Mục này ghi **cái nào chặn cái nào**. Còn **khi nào làm và theo trình tự nào**, kèm trạng thái tiến độ, nằm ở `docs/roadmap.md`. Đừng chép nội dung giữa hai nơi.

Lưu ý: phụ thuộc khái niệm ở đây **không phải** thứ tự thực hiện. Thứ tự thực hiện còn bị chi phối bởi chi phí trên kho mã, cụ thể là ba lời gọi tiền bị khai báo lại toàn bộ mỗi lần sửa, quanh 1.100 dòng mỗi lần. `docs/roadmap.md` giải thích chỗ hai tiêu chí này mâu thuẫn và vì sao chọn như vậy.

Mỗi proposal có section `## Phụ thuộc`. Các quan hệ chính:

- `define-test-strategy` nên làm trước `expand-e2e-coverage` và `setup-test-data-environment`; cả ba nên có trước `add-ci-pipeline`, và `add-ci-pipeline` trước `add-cd-deployment`.
- `redesign-permission-model` nên làm trước mọi nhóm tính năng, vì nhóm nào cũng sinh quyền mới.
- `add-discount-engine` bắt buộc trước mã giảm giá, giờ vàng và đổi điểm.
- `add-customer-registry` bắt buộc trước `add-loyalty-points`.
- `add-inventory-core` bắt buộc trước hai change tồn kho còn lại.
- `add-owner-account-and-store-provisioning` bắt buộc trước `add-multi-store-ownership` và `add-provider-admin-console`.
- Quan hệ giữa `add-owner-account-and-store-provisioning` và `enforce-permissions-at-database` tùy **phạm vi** của cái sau. Với bản đầy đủ có danh tính riêng cho từng nhân viên ở tầng chính sách bảo mật thì tài khoản chủ **bắt buộc** làm trước. Với bản thu hẹp, tức mọi lời gọi nhạy cảm đọc lại quyền từ cơ sở dữ liệu, thứ tự ngược lại rẻ hơn; xem phần "Vì sao thứ tự này" trong `docs/roadmap.md`.
- `add-multi-store-ownership` bắt buộc trước `add-cross-store-reporting`.
- `add-idempotent-write-operations` phối hợp với `enforce-permissions-at-database`: phần xác minh danh tính nhân viên/quyền server tối thiểu là điều kiện nghiệm thu giao thức mới, không thể mặc định chống trùng luôn làm trước xác thực chỉ để tiết kiệm sửa chữ ký RPC. Nếu mở lại offline, change chống trùng vẫn bắt buộc trước `add-offline-data-layer`.
- `measure-runtime-load` bắt buộc trước `optimize-runtime-load`.
- `handle-long-running-session` nên trước `add-offline-data-layer`.
- `add-offline-data-layer` bắt buộc trước hai change offline còn lại. Riêng lát mỏng hiển thị trạng thái mạng trong `add-offline-status-ux` làm được độc lập trước.

## Nhóm hiệu năng và phiên chạy dài

Thêm ngày 2026-09-07 sau khi rà mã và phát hiện tải của hệ gần như toàn bộ là **đọc do polling**, không phải ghi, chênh khoảng 50 lần. Ba change này tách nhau vì chúng có mức rủi ro và thứ tự bắt buộc khác nhau:

| Change | Việc | Rủi ro |
| --- | --- | --- |
| `measure-runtime-load` | Đo độ trễ RPC, đếm tải polling thật, rà hạn mức Supabase | Thấp. Chỉ đo, không sửa |
| `optimize-runtime-load` | Giảm tải polling, xem lại quan hệ polling và realtime | **Cao.** Đụng nhịp đồng bộ giữa các máy |
| `handle-long-running-session` | Xử lý tích tụ bộ nhớ khi tab mở liên tục nhiều ngày | Trung bình. Phía trình duyệt |

`measure-runtime-load` **bắt buộc trước** `optimize-runtime-load`. Chưa có số nền thì không chứng minh được tối ưu có tác dụng, và rất dễ tối ưu nhầm chỗ rẻ trong khi bỏ qua chỗ đắt.

`handle-long-running-session` nên làm **cùng đợt** với `measure-runtime-load` vì cả hai cùng cần một môi trường chạy dài, và nên làm **trước** `add-offline-data-layer` vì change đó thêm một kho dữ liệu sống lâu trên máy.

## Change lật lại quyết định đã chốt

Bốn change dưới đây mâu thuẫn với các quyết định đang ghi trong `pos-cafe-context.md` và `docs/requirements.md`. Nếu làm thì phải cập nhật lại các tài liệu đó.

| Change | Quyết định bị lật |
| --- | --- |
| `add-multi-store-ownership` | Không phải bài toán quản lý chuỗi đa chi nhánh |
| `add-provider-admin-console` | Cô lập dữ liệu tuyệt đối giữa các cửa hàng (NFR-02) |
| `add-offline-data-layer` | **Đã hoãn lại 2026-09-08.** Giữ ưu tiên online; không còn là phần phải làm trong giai đoạn 1 |
| `enforce-permissions-at-database` | NFR-02 không đồng nghĩa bảo mật per-employee |

**Lịch sử 2026-08-30, đã được thay thế ngày 2026-09-08.** Khi đó nhóm offline được kéo vào đồ án theo ngân sách 16 tuần. Sau khi rà lại độ phức tạp khôi phục và nhiều thiết bị, chủ dự án chọn hoãn nhóm này để tập trung online. Các phụ thuộc offline ở trên chỉ còn áp dụng nếu mở lại nhóm trong tương lai.

## Chuẩn viết spec

Bộ tài liệu bắt buộc cho mỗi change, cách viết use case và test case, quy cách ma trận truy vết, và vai trò phân tích viên: xem [SPEC-STANDARD.md](SPEC-STANDARD.md). Chốt ngày 2026-09-07, áp cho mọi tính năng từ thời điểm đó trở đi.

Tóm tắt: mỗi change cần bảy file thay vì bốn. Ba file bổ sung là `usecases.md`, `testplan.md` và `traceability.md`.

`define-test-strategy` là change đầu tiên viết trọn theo chuẩn này và đóng vai **khuôn mẫu** — cần biết một file nên trông như thế nào thì mở change đó ra xem.

Hai change viết trước ngày 2026-09-07 là `redesign-permission-model` và `add-owner-account-and-store-provisioning` đã có khung ba file mới nhưng để trống, sẽ điền khi bắt đầu thực hiện.
