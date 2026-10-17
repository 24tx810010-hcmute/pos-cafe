# Truy vết — PIN owner tạm

Ma trận requirement ↔ use case ↔ test case chốt22/09, giữ nguyên. **Cập nhật08/10:** executable liên quan cho19TC đã có, nhưng phủ một phần và chưa có full current-source acceptance proof. [Matrix executable/gaps/evidence](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) là TC↔executable, không thêm ma trận requirement/usecase thứ hai. PASS runtime PIN d1/empty4ab là lịch sử; current66 TC55/signals không là PIN-wide PASS. TC vẫn có fixture/bước/expected trong testplan.

**Cập nhật execution 12/10:** [ma trận source-20 cho đủ TC01–19](../../../docs/implementation-log/permission-pin19-source20-matrix-2026-10-12.md) nối từng required variant với oracle, profile và receipt mới; [log](../../../docs/implementation-log/permission-pin19-source20-2026-10-12.md) giữ actual options/command/target preservation. Runner xanh nhưng review tìm thấy 18.A thiếu oracle thiết yếu, nên full gate source-20 chưa đạt. Dòng 08/10 ở trên là lịch sử inventory, không phải trạng thái hiện hành. Requirement ↔ UC ↔ TC bên dưới không đổi.

| Requirement | Use case | Test case |
| --- | --- | --- |
| PIN-01 — Trạng thái tạm | UC-PIN-01, UC-PIN-02, UC-PIN-03 | TC-PIN-01, TC-PIN-05, TC-PIN-06 |
| PIN-02 — Phiên hạn chế | UC-PIN-01, UC-PIN-03 | TC-PIN-01, TC-PIN-02, TC-PIN-03, TC-PIN-08, TC-PIN-13, TC-PIN-16 |
| PIN-03 — Đổi bắt buộc | UC-PIN-01, UC-PIN-03 | TC-PIN-02, TC-PIN-04, TC-PIN-06, TC-PIN-07, TC-PIN-12, TC-PIN-17 |
| PIN-04 — Đồng thời/recovery/ACK | UC-PIN-01, UC-PIN-02 | TC-PIN-04, TC-PIN-05, TC-PIN-06, TC-PIN-07, TC-PIN-08, TC-PIN-09, TC-PIN-16 |
| PIN-05 — Onboarding/seed bền vững | UC-PIN-03 | TC-PIN-02, TC-PIN-07, TC-PIN-10, TC-PIN-11, TC-PIN-12, TC-PIN-13, TC-PIN-14, TC-PIN-15, TC-PIN-16, TC-PIN-18 |
| PIN-06 — Scope/activation | UC-PIN-01, UC-PIN-02, UC-PIN-03, UC-PIN-04 | TC-PIN-05, TC-PIN-16, TC-PIN-17, TC-PIN-19 |
| PIN-07 — Bí mật/evidence | UC-PIN-01, UC-PIN-02, UC-PIN-03, UC-PIN-04 | TC-PIN-03, TC-PIN-05, TC-PIN-07, TC-PIN-09, TC-PIN-11, TC-PIN-12, TC-PIN-14, TC-PIN-18, TC-PIN-19 |

PIN-D08 (12/10) sửa hai oracle TC18 trên source-23, không thêm requirement/UC/TC: PIN-07 → UC-PIN-01/02/03 → TC-PIN-18 giữ nguyên. [Slice execution](../../../docs/implementation-log/permission-pin-tc18-oracle-fix-2026-10-12.md) có7/7,20×11,scan48/tooling28; review mới đang chờ, full gate source mới chưa chạy. Không dùng receipt source-20 làm current PASS.

Số requirement chưa có test case: **0 / 7**.

Số use case chưa có test case: **0 / 4**.

Số requirement chưa có use case: **0 / 7**.

Quyết định PIN-D07 (11/10) bổ sung UI operator riêng cho UC-PIN-02, được kiểm trong TC-PIN-18; không tạo app role, requirement hoặc TC mới. Trace PIN-04/07 → UC-PIN-02 → TC-PIN-18 giữ nguyên, nhưng executable UI/security/message evidence còn phải chạy trước khi nhận PASS.

Cả 19 TC có requirement và use case truy ngược; ma trận không tuyên bố executable coverage hoặc runtime PASS. Delta PERM-20/PERM-21/PERM-22 được kiểm bằng TC01/05/06/09/17; semantics ngoài scope giữ test hồi quy permission model.

Hiệu chỉnh oracle TC02 ngày 13/10 trên source34: giữ tiền điều kiện restricted có cache normal. Observer protected RPC bắt đầu sau recovery và unmount floor/AppShell, trước restricted relogin; vẫn đòi 0 protected RPC cùng các kiểm tra cache/focus/history. Diagnostic trước sửa ghi 12 RPC normal hợp lệ trước recovery COMMIT. Không đổi requirement/UC/TC, quyền, app code hoặc số case; [biên bản và bằng chứng](../../../docs/implementation-log/permission-npm-remediation-2026-10-13.md) phân biệt từng source và attempt, không dùng focused PASS thay full PIN19.

### Tham chiếu BACKUP-AB-14, 14/10/2026

Phần activation đích rỗng/PIN-06/PIN-T07 tiếp tục tham chiếu [backup v2 B/I/C/L](../../../docs/runbooks/permission-backup-v2-2026-10-14.md), PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2. Đây là cập nhật dependency vận hành theo quyết định owner; không đổi forced-PIN,19TC hoặc empty-target behavior. Old77 và74/75FAIL là lịch sử; phạm vi mới EXACT79 có private provenance. Knonempty chặn cleanup, ngoài66Auth/object3 giữ; chưa C/Storage/provider receipt thì release vẫn BLOCKED.
