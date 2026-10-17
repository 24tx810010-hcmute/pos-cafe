# Bàn giao — runbook và readiness local, 08/10/2026

## Đề bài, quyền và kết quả

User chọn runbook/gate mapping sau [inventory Vercel](vercel-binding-inventory-2026-10-07.md), yêu cầu auto/UI test và subagent cân bằng model. Hai smoke FAIL dẫn tới câu hỏi mở scope; user chọn **“Sửa lỗi mock và kiểm lại (khuyên dùng)”**. Nguồn quyền trực tiếp trong chat, không phải handoff tự tạo.

- Đã sửa mock getter ảnh public/published để cashier không cần `menu.manage`; guard phiên/PIN và quyền ghi vẫn giữ. Regression mới bắt được code cũ.
- Sau sửa: unit106files/1.140 PASS; tooling3files/70 PASS; build PASS; mock smoke35 PASS/31 conditional viewport skips/0 FAIL; selftest23 OK. UI audit **FAIL**:48states/viewports,69 nhóm/33 ngoài baseline, setup0. Có kiểm UI trực tiếp cashier deny payment, mobile bị che và PIN validation fixture.
- [Log kỹ thuật và command/evidence](../../implementation-log/permission-runbook-readiness-2026-10-08.md), [runbook nháp T17](../../runbooks/permission-release-runbook-2026-10-08.md), [phân loại UI](../../implementation-log/permission-ui-audit-triage-2026-10-08.md), [review candidate](../../reviews/2026-10-08-permission-runbook-readiness.md).

## Candidate và giới hạn

Main/docs worktrees cũ giữ nguyên HEAD và dirty work; source final fingerprint `5f78d8692604e0a38d0b3be477a980d895cf268a4c6888d58cdb4fe6e9ed1bf2`. Snapshot có toàn source/test/file mới/lock và docs của slice, không chỉ hash. Sáu execution receipts sau sửa có fingerprint trước/sau khớp. Artefacts trước sửa giữ riêng, không ghép tạo full PASS.

Chỉ local mock; chưa SQL/Auth/REST/Storage/Edge/Realtime runtime gates, PIN service completion, hosted capability/release/postflight. T15/T16/PIN-T06/T17/T18 và task sản phẩm còn mở. Runbook có thứ tự DB/Storage/Edge/config trước frontend, cảnh báo main auto-deploy và COMMIT unknown; command tương lai NOT RUN, không tạo quyền live mới.

Layout/checkbox/font/contrast vẫn theo scope UI hoãn; lỗi mobile có tác động thật được đưa vào hồ sơ để chốt scope. Không sửa baseline. Code/docs chưa commit/push/deploy, không tạo session mới, không thay global auth/MCP config. Own UI tab/viewport/server đã cleanup.

## Bước tiếp theo đề nghị

Scope nhỏ tiếp theo: **full stack fixture cách ly và identity readiness**. Xác minh marker/lease/checksum/service binding trước reset; refresh JWT/identity đúng fixture rồi chạy images/TC44/service/PIN gates cần thiết theo source cuối. Chọn quyền và môi trường cụ thể trước thực hiện; đây là đề nghị, chưa là authorization. Có thể tiếp tục chat này; khi đổi chat đọc ba hồ sơ phía trên, không chạy lại controller lịch sử vô cớ.

Walkthrough nguyên nhân/guard/regression đã cung cấp trong log; owner chưa xác nhận nghiệm thu hoặc đã hiểu code. Review ghi verdict/candidate riêng; approval slice không thay approval rollout hay chứng minh UI sạch.
