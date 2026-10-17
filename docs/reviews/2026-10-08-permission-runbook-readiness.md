# Review — runbook/readiness và lỗi ảnh mock, 08/10/2026

Metadata review loại khỏi candidate để tránh đệ quy. Candidate C1: [manifest](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/candidate-1.json), SHA256 `181b0dc44b7e800655f888ba7e149ce6be4b6392671ab41bd48da280df0b37c9`; [snapshot phục hồi](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/snapshot-c1),1.169 entries gồm706 source paths/26 docs/437 evidence. Source fingerprint `5f78d8692604e0a38d0b3be477a980d895cf268a4c6888d58cdb4fe6e9ed1bf2`. Snapshot chứa source hiện có cùng file mới/tests/lock và trạng thái file xóa; những dirty changes ngoài hai file sửa mock chỉ là baseline được giữ để tái hiện.

Phạm vi: user duyệt runbook/gate mapping +auto/UI test, sau đó rõ ràng duyệt sửa mock/regression/kiểm lại. Hai scope review độc lập bắt buộc: (1) ứng dụng/quyền/hợp đồng, (2) runbook/evidence/UI/ủy quyền. Reviewer không tham gia viết, không sửa candidate/deploy; không kế thừa approval trước đó.

| Reviewer | Scope | Verdict |
| --- | --- | --- |
| mock_boundary_review — Sol/high | Guard đọc ảnh/ghi ảnh, session/PIN, regression, spec và hồi quy | **APPROVE C1**; không finding chặn/không chặn |
| readiness_evidence_review — Sol/medium | Runbook/gate mapping, provenance/source/counts, UI findings và phạm vi | **APPROVE C1**; không finding chặn/không chặn |

## Kết quả độc lập

Reviewer nguồn/quyền tự kiểm exact manifest/source fingerprint và toàn1.169 entry, inventory706 paths cùng marker xóa; đọc delta chỉ hai file. Xác nhận getter chỉ đọc published map, stage/read/discard/save vẫn cần `menu.manage`, normal actor giữ pairing/store/expiry/revoked/active/role/PIN boundary. Tự chạy lại hai suite mock/image **9/9 PASS**, exit0; đọc JSON/receipts và guard viewport, hai smoke lỗi trước đã PASS, không giảm expected. Chưa tự chạy full/browser, mọi nhánh role/expiry được đối chiếu nguồn, không chứng nhận service/hosted/UI layout/toàn baseline.

Reviewer hồ sơ tự kiểm manifest SHA, source fingerprint hiện tại và trước sửa; **2.334 hash/size checks +hai marker xóa** đạt, **222 links/line bounds** hợp lệ. Đối chiếu commands/UTC/counts, đọc ảnh cashier/mobile/PIN và annotated payment ba viewport/employees/settings/clear-demo. Xác nhận triage/false positive có điều kiện, audit FAIL/skip/mock/service limits trung thực; runbook đúng DELIVERY-03, Storage/journal/COMMIT unknown/provider và frontend cuối. Chỉ đọc file/ảnh, không chạy lại runtime hoặc dùng browser/network/credential.

[Author check](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/author-check.json) là static:2.334 hashes/hai deleted checks/222 filelinks không sai; kiểm anchor không nằm trong author script. Hai reviewer tự đối chiếu candidate, không dựa kết luận của nhau. [Receipt cuối](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/final-review-receipt.json) lưu verdict/phạm vi; [cleanup](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/final-review-cleanup.json) có0 listener5175/5178/5181 và0 process Playwright MCP.

## Bàn giao

Hai reviewer bắt buộc **APPROVE exact C1**; không finding cần sửa, không đổi substantive candidate sau freeze. Slice runbook nháp +sửa mock/regression +kiểm local/phân loại UI **hoàn tất trong phạm vi đã giao**. UI audit vẫn FAIL; service/hosted/T15/T16/PIN-T06/T17/T18 và task sản phẩm còn mở, chưa được phép rollout từ approval này. Code/docs chưa commit/push, owner chưa xác nhận nghiệm thu/walkthrough. Chỉ metadata verdict này được bổ sung sau review, không tạo gate review đệ quy.

[Log](../implementation-log/permission-runbook-readiness-2026-10-08.md) · [handoff](../workflow/tasks/permission-runbook-readiness-2026-10-08.md).
