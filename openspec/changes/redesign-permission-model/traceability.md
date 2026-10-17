# Truy vết — redesign-permission-model

**Checkpoint PERM60 12/10/2026:** [case matrix source-20](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source20/case-matrix.json) nối 60 REQUIRED TC/726 variants với27 observed runs; [biên bản](../../../docs/implementation-log/permission-perm60-2026-10-12.md) ghi aggregate full exit0/0 errors, actual candidate phase/binding và service tuần tự. Review SEC và EVC APPROVE exact candidate-01; hoàn tất kỹ thuật PERM60, hồ sơ verdict tại docs/reviews/2026-10-12-permission-perm60.md. Giữ nguyên requirement/UC/TC và expected; không gán toàn CLOSE-2/PIN19/release PASS từ ma trận này.

Ngày 2026-09-15. Bảng được đối chiếu từ ID khai báo trong bảy delta, 15 mục UC và 60 mục TC thực có trong file; không đếm tên file khung. Mã REMOVED vẫn có test kiểm phần Migration thay thế.

Đây là **độ phủ kế hoạch**, không phải kết quả implementation. Tất cả TC của change hiện NOT RUN; xem [testplan](testplan.md) cho oracle, dữ liệu và gate. Use case đầy đủ nằm tại [usecases](usecases.md).

| Requirement | Use case | Test case |
| --- | --- | --- |
| [PERM-01 — Bộ vai trò dựng sẵn](specs/access-control/spec.md) (ADDED) | UC-PERM-01, UC-PERM-02, UC-PERM-14 | TC-PERM-01, TC-PERM-02, TC-PERM-05, TC-PERM-19, TC-PERM-50, TC-PERM-56 |
| [PERM-02 — Danh mục quyền hành động lưu ở tầng dữ liệu](specs/access-control/spec.md) (ADDED) | UC-PERM-01, UC-PERM-04, UC-PERM-09, UC-PERM-10, UC-PERM-11, UC-PERM-14 | TC-PERM-01, TC-PERM-03, TC-PERM-04, TC-PERM-07, TC-PERM-12, TC-PERM-13, TC-PERM-19, TC-PERM-25, TC-PERM-50, TC-PERM-56 |
| [PERM-03 — Điều hướng suy ra từ quyền hành động](specs/access-control/spec.md) (ADDED) | UC-PERM-01, UC-PERM-09, UC-PERM-12 | TC-PERM-03, TC-PERM-25, TC-PERM-34, TC-PERM-56 |
| [PERM-04 — Ẩn phần tử điều khiển khi thiếu quyền](specs/access-control/spec.md) (ADDED) | UC-PERM-01, UC-PERM-04, UC-PERM-09, UC-PERM-11, UC-PERM-12 | TC-PERM-03, TC-PERM-13, TC-PERM-34, TC-PERM-36, TC-PERM-56, TC-PERM-59 |
| [PERM-05 — Nhật ký thay đổi quyền](specs/access-control/spec.md) (ADDED) | UC-PERM-02, UC-PERM-03, UC-PERM-04, UC-PERM-05, UC-PERM-06, UC-PERM-07, UC-PERM-08, UC-PERM-10, UC-PERM-13 | TC-PERM-05, TC-PERM-06, TC-PERM-07, TC-PERM-08, TC-PERM-09, TC-PERM-10, TC-PERM-11, TC-PERM-12, TC-PERM-15, TC-PERM-20, TC-PERM-21, TC-PERM-22, TC-PERM-23, TC-PERM-24, TC-PERM-42, TC-PERM-44, TC-PERM-58 |
| [PERM-06 — Chuyển đổi quyền có preflight và chủ sở hữu xác định](specs/access-control/spec.md) (ADDED) | UC-PERM-14 | TC-PERM-48, TC-PERM-49, TC-PERM-50, TC-PERM-51, TC-PERM-53 |
| [PERM-07 — Ranh giới kiến trúc và nguồn catalog duy nhất](specs/access-control/spec.md) (ADDED) | **không có use case**: ràng buộc kiến trúc/nguồn catalog, không phải thao tác người dùng; vẫn có TC kiểm chứng | TC-PERM-30, TC-PERM-41, TC-PERM-57 |
| [PERM-08 — Ghi đè quyền theo từng nhân viên](specs/access-control/spec.md) (MODIFIED) | UC-PERM-03, UC-PERM-04 | TC-PERM-04, TC-PERM-06, TC-PERM-07, TC-PERM-16, TC-PERM-19, TC-PERM-20 |
| [PERM-09 — Chốt quyền ở luồng nghiệp vụ và guardrail phía database](specs/access-control/spec.md) (MODIFIED) | UC-PERM-09, UC-PERM-10, UC-PERM-11, UC-PERM-13, UC-PERM-15 | TC-PERM-12, TC-PERM-13, TC-PERM-22, TC-PERM-24, TC-PERM-25, TC-PERM-26, TC-PERM-27, TC-PERM-28, TC-PERM-29, TC-PERM-39, TC-PERM-40, TC-PERM-41, TC-PERM-44, TC-PERM-45, TC-PERM-46, TC-PERM-47 |
| [PERM-10 — Hai trục kiểm soát truy cập độc lập](specs/access-control/spec.md) (REMOVED) | UC-PERM-01 | TC-PERM-01, TC-PERM-03, TC-PERM-50 |
| [PERM-11 — Bộ quyền hành động được enforce](specs/access-control/spec.md) (REMOVED) | UC-PERM-01 | TC-PERM-01, TC-PERM-03, TC-PERM-50 |
| [PERM-12 — Giới hạn đã biết của mô hình quyền hiện tại](specs/access-control/spec.md) (REMOVED) | UC-PERM-09, UC-PERM-12 | TC-PERM-31, TC-PERM-33 |
| [PERM-13 — Bất biến của bản ghi chủ quán](specs/employee-management/spec.md) (ADDED) | UC-PERM-02, UC-PERM-03, UC-PERM-05, UC-PERM-06, UC-PERM-07, UC-PERM-08, UC-PERM-10, UC-PERM-14 | TC-PERM-05, TC-PERM-09, TC-PERM-10, TC-PERM-11, TC-PERM-12, TC-PERM-14, TC-PERM-48, TC-PERM-49, TC-PERM-51, TC-PERM-52, TC-PERM-56, TC-PERM-58 |
| [PERM-14 — Không tự khóa tài khoản đang đăng nhập](specs/employee-management/spec.md) (ADDED) | UC-PERM-03, UC-PERM-04, UC-PERM-05 | TC-PERM-08, TC-PERM-14 |
| [PERM-15 — Danh bạ hiển thị quyền hiệu lực của từng nhân viên](specs/employee-management/spec.md) (ADDED) | UC-PERM-02, UC-PERM-04, UC-PERM-09 | TC-PERM-02, TC-PERM-05, TC-PERM-18 |
| [PERM-16 — Trần quyền trước và sau thao tác quản trị](specs/employee-management/spec.md) (ADDED) | UC-PERM-02, UC-PERM-03, UC-PERM-04, UC-PERM-05, UC-PERM-06 | TC-PERM-05, TC-PERM-06, TC-PERM-07, TC-PERM-08, TC-PERM-09, TC-PERM-15, TC-PERM-16, TC-PERM-17, TC-PERM-18, TC-PERM-42, TC-PERM-56 |
| [PERM-17 — Tạo và chỉnh sửa nhân viên](specs/employee-management/spec.md) (MODIFIED) | UC-PERM-02, UC-PERM-03, UC-PERM-04, UC-PERM-05, UC-PERM-06, UC-PERM-10 | TC-PERM-05, TC-PERM-06, TC-PERM-07, TC-PERM-08, TC-PERM-09, TC-PERM-12, TC-PERM-16, TC-PERM-17, TC-PERM-18, TC-PERM-19, TC-PERM-20, TC-PERM-21, TC-PERM-23, TC-PERM-42, TC-PERM-43, TC-PERM-44, TC-PERM-56, TC-PERM-59 |
| [PERM-18 — Bảo vệ quyền quản trị của cửa hàng](specs/employee-management/spec.md) (REMOVED) | UC-PERM-02, UC-PERM-14 | TC-PERM-05, TC-PERM-14, TC-PERM-48 |
| [PERM-19 — Cảnh báo khi tự sửa quyền của mình](specs/employee-management/spec.md) (REMOVED) | UC-PERM-03, UC-PERM-04 | TC-PERM-14 |
| [PERM-20 — Chọn nhân viên và xác minh PIN](specs/employee-session/spec.md) (MODIFIED) | UC-PERM-01, UC-PERM-05, UC-PERM-06, UC-PERM-07, UC-PERM-08, UC-PERM-12, UC-PERM-15 | TC-PERM-02, TC-PERM-08, TC-PERM-09, TC-PERM-10, TC-PERM-11, TC-PERM-28, TC-PERM-32, TC-PERM-33, TC-PERM-35, TC-PERM-43, TC-PERM-51, TC-PERM-60 |
| [PERM-21 — Chủ quán tự đổi PIN có xác minh PIN hiện tại](specs/employee-session/spec.md) (ADDED) | UC-PERM-07 | TC-PERM-10, TC-PERM-43, TC-PERM-59 |
| [PERM-22 — Khôi phục PIN owner qua quy trình hạ tầng chuyển tiếp](specs/employee-session/spec.md) (ADDED) | UC-PERM-08 | TC-PERM-11, TC-PERM-58 |
| [PERM-23 — Tạo cửa hàng mới](specs/store-onboarding/spec.md) (MODIFIED) | UC-PERM-14 | TC-PERM-52 |
| [PERM-24 — Hội tụ quyền có revision và thời gian đo được](specs/multi-device-sync/spec.md) (ADDED) | UC-PERM-04, UC-PERM-12 | TC-PERM-30, TC-PERM-31, TC-PERM-32, TC-PERM-33, TC-PERM-35, TC-PERM-41, TC-PERM-55 |
| [PERM-25 — Thu hồi quyền đóng đúng phần dữ liệu và nháp](specs/multi-device-sync/spec.md) (ADDED) | UC-PERM-11, UC-PERM-12, UC-PERM-15 | TC-PERM-33, TC-PERM-34, TC-PERM-35, TC-PERM-36, TC-PERM-39, TC-PERM-46, TC-PERM-55, TC-PERM-59, TC-PERM-60 |
| [PERM-26 — Tín hiệu tối thiểu và làm mới catalog toàn cục](specs/multi-device-sync/spec.md) (ADDED) | UC-PERM-09, UC-PERM-12, UC-PERM-13 | TC-PERM-24, TC-PERM-29, TC-PERM-30, TC-PERM-33, TC-PERM-55 |
| [PERM-27 — In lại hóa đơn](specs/receipt-printing/spec.md) (MODIFIED) | UC-PERM-11, UC-PERM-15 | TC-PERM-13, TC-PERM-36, TC-PERM-37, TC-PERM-38, TC-PERM-56, TC-PERM-60 |
| [PERM-28 — Phiếu tạm tính và hóa đơn](specs/receipt-printing/spec.md) (MODIFIED) | UC-PERM-11, UC-PERM-15 | TC-PERM-37, TC-PERM-38, TC-PERM-60 |
| [PERM-29 — Quyền hiện hành và tiếp quản](specs/write-idempotency/spec.md) (MODIFIED) | UC-PERM-10, UC-PERM-11, UC-PERM-12, UC-PERM-15 | TC-PERM-12, TC-PERM-27, TC-PERM-34, TC-PERM-37, TC-PERM-38, TC-PERM-39, TC-PERM-40, TC-PERM-41, TC-PERM-44, TC-PERM-54 |
| [PERM-30 — Tương thích giao thức và migration](specs/write-idempotency/spec.md) (MODIFIED) | UC-PERM-14, UC-PERM-15 | TC-PERM-27, TC-PERM-37, TC-PERM-50, TC-PERM-51, TC-PERM-52, TC-PERM-53, TC-PERM-54 |

- Số requirement chưa có **test case**: **0/30**.
- Số use case chưa có **test case**: **0/15**.
- Số requirement chưa có **use case**: **1/30**, chỉ PERM-07; giải trình ngay trong hàng tương ứng, có TC30/57 kiểm catalog và ranh giới kiến trúc.

Có **30 requirement, 15 use case, 60 test case unique**; không có ID trùng hoặc tham chiếu ngoài bộ. Một TC có nhiều biến thể không làm tăng số TC. Hai phép kiểm requirement→TC và UC→TC độc lập; không suy coverage chỉ từ việc requirement cùng xuất hiện ở một UC. PERM-12 được TC31/33 kiểm rõ hành vi revision/lifetime thay limitation cũ.

Cập nhật sau review R01–R15/Q15 ngày15/09 giữ ID và ma trận: TC02 giữ INVALID_PIN; TC19/49/52/59 kiểm bound120 và legacy; TC36/37/60 kiểm nhiều click initial, nút theo quyền, giữ preview còn quyền đọc và chống timer cũ; TC45/47 kiểm cache/gateway; TC29 giữ giới hạn join subscription; TC48–54/57 và gate mục3 kiểm đúng source/profile/cleanup. Đây là độ phủ kế hoạch, không phải số TC runtime đã đạt. Các scenario trùng được gộp, không dùng việc gộp để giảm các biến thể bắt buộc.

Quyết định ngày 2026-09-15 sau T01: loại role Kế toán, giữ 15 quyền và toàn bộ 30 requirement/15 UC/60 TC. PERM-01/02 và TC01/19 kiểm catalog chỉ năm role, bốn hoạt động, ba selectable và từ chối accountant. Fixture A chuyển thành waiter có overrides chỉ xem; TC03/07/13/39/56 kiểm cấu hình tác nhân thay thế, TC60 giữ hành vi lifetime in đã chốt. Không giảm biến thể bảo mật hoặc gộp quyền đọc/in/thu tiền/K. Đây là chỉnh kế hoạch T02 trở đi, không ghi các test candidate đã chạy.

**Bằng chứng T02, 2026-09-15:** [biên bản T02](../../../docs/implementation-log/permission-t02-catalog-bridge-2026-09-15.md) ghi TC01/04 phần SQL và TC50 gate bridge đã đạt, 52 test cùng 6.144 hồ sơ comparison. T01 regression và unit/component legacy chạy cùng source. Đây là tiến độ hiện thực từng phần; số 30 requirement/15 UC/60 TC và độ phủ ở trên vẫn là kế hoạch, chưa phải 60 TC runtime PASS. T03–T18 và các gate consumer/service/activation còn lại chưa thực hiện.

**Bằng chứng T03, 2026-09-15:** [biên bản T03](../../../docs/implementation-log/permission-t03-domain-ports-mock-2026-09-15.md) ghi phần core/DTO/mock của TC01/03/04/19/57, SQL parity và regression cùng source. Giữ30 requirement/15 UC/60 TC; các ca UI, server admin/audit/ceiling, service và activation theo task phụ thuộc vẫn chưa thực hiện. Sửa chữ Bốn thành Ba lựa chọn role ở input UC03 để khớp quyết định đã chốt, không đổi nghiệp vụ.

**Bằng chứng T04, 2026-09-16:** [biên bản T04](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md) ghi42 SQL/Auth/REST và27 unit mới, full suite788, build và regression cùng source. TC08–11/14/28/43/52/58 chỉ đóng biến thể identity/credential/bootstrap trong manifest T04; admin mutations T05, seed T08, UI T12 và activation T16 chưa đóng. Giữ nguyên30 requirement/15 UC/60 TC kế hoạch.

**Làm rõ T05, 2026-09-16:** quyết định role+overrides cùng lần lưu áp cho PERM-16/17, UC-PERM-03/04, TC-PERM-06/17/20; chỉ đổi role reset null, gửi bộ mới cần thêm employee.permission.edit, kiểm after cuối. PERM-05/UC13/TC22/24 ghi audit proposedAfter khi tính được, details và phân trang/filter hiện hành. Không thêm requirement/UC/TC mới.

**Tiến độ T05 ngày 2026-09-16:** [biên bản T05](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md) ghi 55 execution SQL/Auth/REST và full unit 815, build/regression cùng source. UC02–06/13 đã có server/adapter/mock tương ứng; UI form T12 chưa nối, retention qua clear-demo T08 và signal transport T10 chưa chạy. Giữ 30 requirement/15 UC/60 TC kế hoạch; không coi số execution là số TC đã hoàn tất toàn bộ.

**Tiến độ T06 ngày 2026-09-16:** [biên bản T06](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md) ghi 44 execution SQL/Auth/REST, full unit 815, build/regression cùng source. UC15 có financial authority sau khóa; UC10 bulk clear/seed còn T08. TC44 và TC54 được ghi rõ phần đã kiểm và phần chờ; giữ 30 requirement/15 UC/60 TC kế hoạch, không dùng số execution làm số TC đã đóng toàn bộ.

**Bổ sung quyết định múi giờ T07 ngày 2026-09-16:** PERM-13 tiếp tục truy vết tới use case đọc/quản trị cài đặt hiện có, TC-PERM-25 kiểm nhãn giờ cửa hàng và business_date, TC-PERM-18 kiểm quyền thay đổi timezone (T08). Không thêm quyền hoặc role; chỉ owner được đổi timezone, settings.manage vẫn ủy quyền cho trường khác. T07 không đánh dấu gate ghi T08/UI T13 đã đạt.

**Bổ sung bảng đơn báo cáo T07:** PERM-13 / use case đọc dữ liệu hiện có / TC-PERM-25 bao gồm projection tối đa20 paid summaries dưới report.view, không cấp history/receipt detail. Consumer chuyển từ history query sang listReportOrders thuộc T13; T07 nghiệm thu port/mock/SQL/adapter và ACL.

**Tiến độ T07 ngày 2026-09-16:** [biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) ghi 120 SQL/Auth/REST execution, 919 unit/component và build/regression cùng source. TC13/38 mới phần read, print T14; T08 ghi timezone owner-only chưa chạy. Giữ 30 requirement/15 UC/60 TC kế hoạch, không dùng số execution làm số TC đã đóng toàn bộ.

### Guard inventory T10 ngày 13/10/2026

PERM-26 / TC-PERM-29 có bổ sung guard source inventory [permissionInventory.tool.test.ts:193](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:193): adapter chỉ subscribe metadata `store_change_signals`, không business rows. [Remediation source34](../../../docs/implementation-log/permission-npm-remediation-2026-10-13.md) không đổi requirement/UC/TC hoặc gate runtime; focused7/expanded306 là static/tooling, không tự đóng TC29 hay toàn PERM60.

### Truy vết bổ sung NEW79 ngày13/10/2026

PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-NEW79 (subcase TC53). [Quyết định](../../../docs/workflow/tasks/permission-close3-scope79-2026-10-13.md) khóa exact77+2, Auth79/preserve66 và Storage delete2/preserve1. Local18/18 chỉ xác minh scope và các nhánh từ chối proof cũ; controller rehearsal/backup mới/live postflight chưa chạy. Không tạo requirement/UC/TC mới, không đổi tổng30/15/60 hoặc phủ thiếu bằng kết quả scope-only.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.


### SEC-01 — oracle globals đã kiểm LOCAL (14/10/2026, chờ review)

Candidate01/source39 bị SEC yêu cầu sửa: projection roles thiếu expiration/comment/security labels. Source40 đã bổ sung `rolvaliduntil`, shared comment/security-label catalog, cùng bốn bản `pg_dumpall --roles-only --no-role-passwords` từ source trước capture, source cuối cửa sổ, pristine và allocation clone. Cùng binary/flags/restrict-key ngẫu nhiên cho một run; so toàn văn, không bỏ dòng. Mọi artifact/command được pin và loader tự recompute ba check bắt buộc `catalog:complete-roles`, `catalog:probe-roles`, `catalog:roles-window`. Cửa sổ source lệch phải refuse `BACKUP_V2_CATALOG_WINDOW_DRIFT`. Password vẫn ngoài profile đã ghi; không suy ra hosted global actor control. Positive fixture có expiration/comment; negative sửa riêng từng thuộc tính trên clone mới và trong source window, cộng forged PASS proof. Đây là sửa completeness trong phạm vi backup được ủy quyền, không đổi nghiệp vụ hoặc mở phase2. Source39 và candidate01 giữ nguyên, không tái gán PASS.


## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
