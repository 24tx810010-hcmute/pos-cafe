# PROPOSED — delta sau bổ sung LOCAL 14/10/2026

Chưa owner acceptance, chưa sửa normative/helper/verifier, chưa permission hosted. Xem [bằng chứng](../implementation-log/permission-backup-lab-2026-10-14.md) và [matrix](D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261014/matrix-final-v4.json). Giữ [options13/10](permission-backup-lab-options-2026-10-13.md) làm lịch sử.

| Phần | Kết quả local mới | Hệ quả đề xuất, chưa áp dụng |
| --- | --- | --- |
| B/I logical fidelity |35/63nonempty, LO/ACL/partition, full78identity restore; actual missing-role/schema/ACL errors không được bỏ qua | Có cơ sở hoàn thiện tiêu chí archive fidelity riêng; giữ exact inventory/TOC/full-row/provenance, không chỉ counts |
| Allocation | Shared/dynamic consumers và cached sessions tạo counterexamples thật; increment/cast/bounds/is_called được thử trên clone riêng | New proof phải explicit closed-world consumer contract; reject unknown/shared/cache/cycle chưa hỗ trợ. Không thể gọi catalog scan là exhaustive cho arbitrary SQL hoặc client |
| C có K | Canonical FK NO ACTION23503 giữ toàn K/payload/R1/receipt | Knonempty không đủ điều kiện destructive empty-target cleanup. Cần forward-fix/reconcile theo quyết định nghiệp vụ; không xóa ledger, không bypass trigger/FK |
| C Kempty | Elevated local actor cleanup+activation commit, giữ66outside/3metadata; observed postgres42501 ở hook/policy | Cần capability thực sự của execution actor đối với authenticator config và policy trên storage.objects; role flags/table DML grants chưa đủ. Superuser lab không là hosted receipt |
| Storage |TUS/S3/HTTP races có bytes-before-metadata; version query bị bỏ qua; retention200 ghi XML payload, IfMatch sai vẫn xóa | Reject immutable-version/retention/conditional-delete claim đối với runtime đã pin. Không dùng các lệnh này làm hosted workaround |
| Control |Gateway entry503 và drain counter hoạt động; direct API và worker vượt ngoài phạm vi | Minimum control cần bao mọi mutation ingress, admitted uploads, background jobs và giữ ổn định tới delete/reconcile. Local gateway/Docker admin không cung cấp provider capability |

Khuyến nghị vẫn là **A cho B/I + B cho C/Storage**, với điều kiện chưa được đáp ứng ghi rõ ở bảng. A không tự mở C/L. C giữ strict no-drift vẫn BLOCKED nếu không có control tương ứng. Old74/75 FAIL không được đổi trạng thái.

Owner cần quyết định nguyên tắc acceptance khi xem gói này: có tách B/I fidelity khỏi no-drift policy để viết spec/helper version mới hay giữ strict hiện tại; cách xử lý K khi không thể empty-target cleanup; nguồn capability/provider control nếu muốn đi tiếp tới hosted. Không tự đặt maintenance duration, không yêu cầu chọn window khi chưa có mechanism và receipt. Không contact provider/mua addon/lập lịch.

Trình tự sau quyết định: ghi accepted normative delta đúng phạm vi → implement new immutable helper/loader nếu được giao → fresh local gates và review → xét hosted permission riêng khi có capability. 7 upstream issues vẫn độc lập. Local experiment dispositions đóng không có nghĩa whole production STEP2 hoặc phase2 eligible.

Bổ sung sau SEC: actual non-config extension content bị dump bỏ sót dù restore tạo được table, do đó phải reject archive thiếu TABLE DATA. Trigger inventory được bổ sung nhưng không đóng arbitrary-consumer discovery. Journal demonstrator thực sự abort trước DELETE khi capture drift hoặc thiếu local control; nó chưa cung cấp atomic compare-and-delete hay provider fence.

Sau EVC, witness riêng S3 đã bổ sung: actual old backend version bị cleanup sau overwrite và cancellation có partial backend bytes trước SDK abort. Giới hạn control/retention và proposal giữ nguyên. Matrix v4 là kết quả hiện hành.
