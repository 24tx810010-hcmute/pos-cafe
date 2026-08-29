# OpenSpec cho pos-cafe

Thư mục này là nơi quản lý spec của dự án. Nó chỉ tồn tại trên nhánh `docs`; nhánh `main` cố ý không có.

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

## Trạng thái hiện tại của `changes/`

26 trong 27 change đang ở trạng thái **mới có `proposal.md`**, chưa có `specs/`, `design.md`, `tasks.md`. Đây là chủ ý, không phải thiếu sót. Change còn lại là `redesign-permission-model`, đã có đủ bốn artifact và sẵn sàng implement.

Vì vậy `openspec validate --changes` báo lỗi `Change must have at least one delta` cho 21 change. Đó là trạng thái mong đợi: delta spec chỉ được viết sau khi các câu hỏi trong proposal đã có câu trả lời. 5 change thuộc nhóm công cụ và quy trình đặt `skip_specs: true` nên pass, cộng `redesign-permission-model` đã có delta nên cũng pass, tổng 6 pass.

Hai change đã có mục `## Quyết định đã chốt` được điền:

- `redesign-permission-model`: **đã chốt hết và đã có đủ artifact** gồm `specs/`, `design.md` và `tasks.md`. Chờ implement.
- `add-owner-account-and-store-provisioning`: **đã chốt hết**, 18 quyết định, không còn câu hỏi bỏ ngỏ. Đủ điều kiện viết delta spec.

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
- `add-idempotent-write-operations` bắt buộc trước `add-offline-data-layer`, và nên trước `enforce-permissions-at-database` nếu cả hai cùng sửa chữ ký các lời gọi ghi.
- `add-offline-data-layer` bắt buộc trước hai change offline còn lại. Riêng lát mỏng hiển thị trạng thái mạng trong `add-offline-status-ux` làm được độc lập trước.

## Change lật lại quyết định đã chốt

Bốn change dưới đây mâu thuẫn với các quyết định đang ghi trong `pos-cafe-context.md` và `docs/requirements.md`. Nếu làm thì phải cập nhật lại các tài liệu đó.

| Change | Quyết định bị lật |
| --- | --- |
| `add-multi-store-ownership` | Không phải bài toán quản lý chuỗi đa chi nhánh |
| `add-provider-admin-console` | Cô lập dữ liệu tuyệt đối giữa các cửa hàng (NFR-02) |
| `add-offline-data-layer` | Online-only, offline-first hoãn sang mở rộng (FR-21, NFR-05) |
| `enforce-permissions-at-database` | NFR-02 không đồng nghĩa bảo mật per-employee |
