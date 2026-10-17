# Review oracle TC-PIN-13 — 11/10/2026

- Vai trò: subagent không tham gia tạo candidate; chỉ đọc, không sửa/commit/deploy.
- Phạm vi: spec TC13 đối chiếu browser Auth/REST, lifecycle/SQL, năm status, restricted denial, GET read-only, auto seed một lần, explicit retry và blank graph.
- Candidate v1: main manifest `602153d1f9726a1fa99f1a2a7790cbf7bdda2d3d3450dcef68ed42bcd1aa23d0`, docs manifest `cacdb53d85423222180f23741148d3df967163a0b2757e9a36990c2e4a0ba5c1`.
- Candidate cuối v2: [main manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc13-close2/source-manifest.json) SHA-256 `46423a2e38dd16dc5ce65f3692963876fed48084ae688ce42948e24a573f65b6`, source tar `5806ed6b4a63f8753f6b9480265eac00489df054580d6bb44c8cfd4c3eba7c8d`; [docs manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc13-close2/docs-manifest.json) SHA-256 `dd271eaf74a99a6a0d5c923bfebfe387373bf85e73f900cecbf1cfba9a736f47`, docs tar `1ff98e832e1b3f914021617c6ba40122c376c5b1d5ab0832826a2b052c0b422c`.

| Finding | Phân loại và bằng chứng | Xử lý / xác nhận |
| --- | --- | --- |
| TC13-O1 | **Chặn v1:** `seedReadOnlySnapshot` chỉ đếm tám bảng menu/sơ đồ; GET lỡ thay giá/tên/row giữ count vẫn qua, nên chưa đủ cho claim read-only/full snapshot. | Tác giả đổi sang so toàn hàng store/settings/workflow/stages/employees/audit/signals/registry và tám bảng seed graph, session so riêng quanh GET. Reviewer kiểm delta v2 và xác nhận finding đã đóng. |

Reviewer v1 trả `CHANGES_REQUESTED`; SQL GET hiện đọc trạng thái nhưng oracle browser còn lỗ đo nêu trên. Reviewer v2 xác nhận DB trước đổi PIN chỉ có `required_pin_change` session, stage ID theo UUID xác định và giữ đến receipt; năm status/bốn ca, restricted GET/begin denial, pending một lần, dở dang không auto retry, owner PIN và blank graph đều có cơ sở. Kiểm hash artifact/file docs hiện tại khớp. **Verdict cuối: APPROVE exact candidate v2** trong phạm vi TC13 local; không tuyên bố toàn PIN/release.
