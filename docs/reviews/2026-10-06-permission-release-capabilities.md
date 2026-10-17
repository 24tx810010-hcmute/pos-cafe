# Review khảo sát quyền/kênh phát hành — 2026-10-06

## Phạm vi

Hai reviewer độc lập kiểm gói khảo sát chỉ đọc và tài liệu, theo review gate nhạy cảm của `AGENTS.md`. Không duyệt thay controller, cấp quyền hoặc phát hành.

Candidate manifest và snapshot được lưu ở `D:/Workspace/pos-cafe/artifacts/permission-release-capabilities-20261006/review-candidate.json` và `review-candidate/`. Nội dung được review gồm log khảo sát, bàn giao task, hai chỉ mục và nguồn báo cáo. File này chỉ ghi metadata review, không thuộc candidate nội dung.

## Candidate cuối và kiểm tra

Manifest round 2 SHA-256: `ac5f7245cdc21fe8f11f4c419fab93c577a211cc46b32ae3c742fdc85f55bd76`. Fingerprint main tính lại: `fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef`. Các snapshot và live docs đều khớp manifest; không có link local hỏng ở gói được kiểm.

| File trên docs | SHA-256 |
| --- | --- |
| `docs/implementation-log/permission-release-capabilities-2026-10-06.md` | `d392833f00c594811758c0c004069e407338e21ccf665530e833be4e06420814` |
| `docs/workflow/tasks/redesign-permission-model.md` | `077bedea9261746f9d8c02e441b32e547b617ac5d4e396ac4fb840fd22cf578b` |
| `docs/workflow/tasks/README.md` | `648b83af260b6a1c220a31a69d9a120ac530e56d4c635de18b4e363d04556f42` |
| `docs/implementation-log/README.md` | `913125a58824592fe329a455494d0fcc800719a2b990d6b9716abc78b334288a` |
| `docs/report-source-map.md` | `539e6743d178debc21f6dd59dd5f5ef30aa61d20c604e3abc4daa3fb24130501` |

Round 1 có manifest/snapshot riêng `review-candidate-round1.json` và `review-candidate-round1/`; log trước sửa hash `fa635ba1a6c71f93cc829dae175d0f9fb192a1a6df9539548fb1be4ecf3d76be`. Chỉ log đổi nội dung ở round 2; bốn file còn lại giữ nguyên.

## Reviewer bằng chứng/kỹ thuật

- Reviewer: `/root/closeout_evidence_review`, độc lập, chỉ đọc, không query live hoặc chạy controller/suite.
- Đã kiểm: 5 docs/snapshot hashes, helper/evidence hashes, cách truyền credential qua stdin, DB READ ONLY/SELECT/rollback, native predicates và thứ tự guard trước prepare, catalog provider và nguồn supautils chính thức, giới hạn suy luận hosted và channel/deploy status. Reviewer tính lại fingerprint main.
- Chưa kiểm: DDL/reload/controller hosted, management calls, triển khai hoặc các gate ứng dụng; không dùng review này thay các gate đó.
- **EV01, chặn round 1:** claim “control socket unavailable” thiếu raw stderr; helper dùng regex `/socket|pipe|daemon|proxy/i`, nên cờ classifier không đủ chứng minh nguyên nhân socket. Kết luận có căn cứ chỉ là proxy status unavailable/exit 1.
- Xử lý: tác giả bỏ claim nguyên nhân ở bảng và bổ sung caveat heuristic/không giữ stderr. Artifact/helper lịch sử được giữ, không rerun để dựng thêm kết quả. Reviewer đối chiếu delta, xác nhận EV01 đóng ở round 2.
- **Verdict cuối: APPROVE round 2.** Không còn finding chặn, không có đề xuất không chặn thêm. Chỉ khảo sát và 5 tài liệu; không duyệt sửa guard, cấp quyền, cleanup hoặc release.

## Reviewer ủy quyền/phạm vi/hồ sơ

- Reviewer: `/root/closeout_scope_review`, độc lập, chỉ đọc docs/helper/evidence, không query live, sửa file hay chạy controller.
- Đã kiểm: lời yêu cầu và scope chỉ đọc, không mở rộng grants/cleanup hoặc bỏ gate; suy luận provider chưa thành bằng chứng DDL, giữ lịch sử clone 01/10; trả lời về session và chưa tự tạo chat; phương án A còn là đề xuất cần chốt trước thay guard; nguyên liệu báo cáo có nguồn, phương pháp, evidence, phương án/trade-off và giới hạn. Không nhận đã phát hành hoặc chủ dự án đã hiểu/nghiệm thu. Kiểm link local và hashes.
- Round 1: APPROVE trong scope; không có findings. Verdict này chỉ ứng với hash cũ, không tự áp cho sửa sau đó.
- Round 2: reviewer đối chiếu delta/snapshot round 1 và hashes toàn bộ gói, xác nhận claim nguyên nhân socket đã bỏ và caveat phù hợp.
- **Verdict cuối: APPROVE round 2.** Không có finding chặn hoặc đề xuất sửa. Chỉ khảo sát/docs; không duyệt code, DDL hoặc phát hành.

## Kết quả bàn giao

Hai reviewer bắt buộc đều APPROVE candidate cuối trong scope được giao, EV01 đã đóng. **Khảo sát chỉ đọc và hồ sơ kỹ thuật hoàn tất trong phạm vi được ủy quyền.** Gói xác minh sẵn sàng phát hành vẫn còn phần provider rehearsal/DDL capability và kênh quản trị chưa được kiểm chứng; task sản phẩm chưa đóng/chưa phát hành.

Tài liệu đã lưu trong worktree nhánh `docs`, còn chưa commit; raw evidence/snapshot giữ local trong artifacts. Không thay application source, live grants/dữ liệu, push/deploy hoặc tạo chat. Chưa có quyết định của chủ dự án chọn phương án tiếp theo và chưa hoàn tất walkthrough.
