# Khảo sát và câu hỏi — redesign-permission-model

Ngày khảo sát: 2026-09-14. **Cổng câu hỏi đã đóng; bộ spec READY FOR APPROVAL ngày 2026-09-15 sau hai review/recheck.** Đây là báo cáo khảo sát, không phải biên bản hoàn tất implementation.

**Cập nhật 2026-09-15:** Q2/Q5 đã có câu trả lời; Q6 chọn hồ sơ hỗ trợ ngoài app; Q7 chọn audit cả lần quản trị bị từ chối sau khi xác minh actor/target cùng store; Q8 cho owner tự đổi PIN sau khi xác minh PIN hiện tại. [Đối chiếu và đính chính kỹ thuật](02-doi-chieu-q2-q5-2026-09-15.md) ghi nguyên tắc được chốt, ranh giới owner/audit/concurrency và các chi tiết còn mở. Bộ spec vẫn chưa qua cổng câu hỏi.

## Phạm vi và baseline

Chỉ hoàn thiện bộ spec `redesign-permission-model` và tài liệu bàn giao. Không viết application code, migration hoặc test implementation; không commit, push, merge, deploy, đổi nhánh, chạy DB hoặc truy cập dữ liệu cửa hàng thật.

| Nguồn | Kết quả kiểm đầu lượt |
| --- | --- |
| Code | `D:/Workspace/pos-cafe`, nhánh `main`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479` |
| Docs | `D:/Workspace/pos-cafe-docs`, nhánh `docs`, HEAD `f95e8a29358ce446c1b8d1be73bc2e9d12d56ad3` |
| Remote | `git ls-remote --heads origin main docs` khớp cả hai HEAD; không có commit mới so với mốc bàn giao |
| Code working tree | Không có tracked diff; `pnpm-lock.yaml` có sẵn, untracked |
| Lockfile | SHA-256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`, khớp bàn giao |
| Docs working tree | 8 tracked file có thay đổi, 74 dòng thêm/13 dòng bỏ; 1 file và 7 thư mục untracked như danh sách dưới |

Tracked diff có sẵn: `docs/README.md`, `docs/limitations.md`, `docs/report-source-map.md`, `docs/roadmap.md`, `docs/ui-redesign-context.md`, `openspec/README.md`, `openspec/changes/measure-runtime-load/proposal.md`, `openspec/changes/redesign-permission-model/proposal.md`.

Untracked có sẵn: `docs/references.md`; các thư mục change `add-electronic-payment`, `add-kitchen-display`, `add-manual-order-discount`, `add-modifier-link-realtime-subscription`, `add-table-transfer-and-merge`, `force-default-pin-change`, `redesign-pos-ui`.

Đã lưu nguyên diff Git, danh sách trạng thái và manifest SHA-256 của các file tracked/untracked vào `C:/Users/nguye/AppData/Local/Temp/pos-cafe-permission-spec-20260914/`. Đây là bản đối chiếu local của lượt làm việc, không phải dependency để đọc bộ spec hoặc tái hiện implementation. Không reset, stash, clean hoặc ghi đè file bằng HEAD.

## Nguồn đã đọc và cách khảo sát

Đã đọc hướng dẫn gốc `AGENTS.md`, `CLAUDE.md`, `openspec/SPEC-STANDARD.md` trên worktree docs. Ba subagent khảo sát chỉ đọc theo ba mảng: yêu cầu và dependency; SQL/server; client/session/cache/Realtime. Agent chính đối chiếu các phát hiện với source, tài liệu tổng quan và bằng chứng phase 27. Các subagent không sửa file hoặc chạy suite reset DB.

Phạm vi đọc gồm tám file của change; baseline access-control, employee-management, employee-session, store-onboarding, order-management, payment, order-void, receipt-printing, multi-device-sync; delta phase 27 liên quan. `write-idempotency` hiện nằm tại `openspec/changes/add-idempotent-write-operations/specs/write-idempotency/spec.md`, chưa được archive/apply vào baseline `openspec/specs`.

Đã đối chiếu các proposal giao nhau: enforce-permissions-at-database, add-owner-account-and-store-provisioning, force-default-pin-change, add-table-transfer-and-merge, add-manual-order-discount, redesign-pos-ui, add-modifier-link-realtime-subscription; các trang requirements/features/architecture/data-model/testing/limitations/roadmap, OpenSpec README và pos-cafe-context.

Bằng chứng lịch sử phase 27 đã đọc: [log chính](../../implementation-log/phase-27-idempotent-write-operations.md), [release check](../../implementation-log/phase-27-release-check-2026-09-14.md), [timeout follow-up](../../implementation-log/phase-27-timeout-followup-2026-09-14.md), [rollout](../../implementation-log/phase-27-idempotency-rollout.md), [live MCP check](../../implementation-log/phase-27-live-mcp-check-2026-09-13.md), [runtime WSL](../../implementation-log/phase-27-test-runtime-wsl.md). Không sửa hoặc tái tạo các biên bản này; kết quả lịch sử không được tính là test vừa chạy trong lượt khảo sát.

## Hiện trạng và phân loại thay đổi

Mọi đường dẫn source bên dưới thuộc HEAD code đã ghi ở baseline. Bằng chứng test là source test hiện có, không phải tuyên bố test đã chạy lại.

| Hạng mục | Hiện trạng có nguồn | Xử lý trong spec |
| --- | --- | --- |
| Vai trò/quyền | [models.ts:1](D:/Workspace/pos-cafe/src/domain/models.ts:1), [guards.ts:25](D:/Workspace/pos-cafe/src/core/guards.ts:25): 3 role, 5 quyền, hai trục module/action | Đổi sang catalog dữ liệu, 6 role, kitchen chưa bật; điều hướng theo quyền |
| SQL quyền hiện hành | Định nghĩa cuối helper vẫn ở [012:7](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:7); các caller hiện hành ở 014–016 | Thay nguồn catalog, giữ actor từ phiên server; không coi helper nhận role là bằng chứng danh tính |
| Phiên nhân viên | [014:179](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:179), [014:211](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:211): server cấp phiên 12 giờ, xác minh token/store/active; [014:237](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:237): reset PIN/khóa thu hồi phiên | Giữ cơ chế phase 27; cập nhật quyền không đồng nhất với đổi phiên |
| Register/execute/get/list/cancel | [016:19](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:19), [016:46](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:46), [016:143](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:143): kiểm quyền hiện hành, kể cả sau đợi lock | Giữ K/payload/R1, takeover theo quyền hành động hiện hành; không biến mất quyền thành giao dịch mới |
| Chống bypass tài chính | [016:258](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:258): thu hồi DML tài chính, mọi overload RPC cũ và đọc trực tiếp ledger/audit | Giữ nguyên, không mở lại để tương thích client cũ |
| Quản trị dữ liệu | [016:183](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:183), [016:198](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:198): RLS dùng verified admin | Đổi sang quyền cụ thể cho menu/floor/employee/settings; cần bao cả RPC và DML |
| Nhân viên | [employeeRepo.ts:58](D:/Workspace/pos-cafe/src/adapters/supabase/employeeRepo.ts:58): create/reset qua RPC, update qua PATCH; [ports:46](D:/Workspace/pos-cafe/src/ports/index.ts:46): không có delete nhân viên | Bảo vệ owner, quyền theo trường, actor/target, audit/OCC nguyên tử; không claim đã có UI xóa nhân viên |
| Quyền đọc | [reportRepo.ts:11](D:/Workspace/pos-cafe/src/adapters/supabase/reportRepo.ts:11), [orderRepo.ts:54](D:/Workspace/pos-cafe/src/adapters/supabase/orderRepo.ts:54), [016:200](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:200), [016:257](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:257): SELECT theo cửa hàng | Q1 đã chốt bảo vệ đọc + ghi trong catalog; không hạ thành UI-only |
| Ảnh thực đơn | [005:21](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:21): ảnh đọc public; write policy chỉ theo store path ở [005:28](D:/Workspace/pos-cafe/supabase/migrations/005_menu_item_images_storage.sql:28) | Inventory `menu.manage` phải bao upload/overwrite/delete; phân biệt ảnh public với dữ liệu kinh doanh |
| Xóa dữ liệu | [016:237](D:/Workspace/pos-cafe/supabase/migrations/016_activate_write_protocol.sql:237), [ClearDemoDialog:53](D:/Workspace/pos-cafe/src/app/drawers/admin/ClearDemoDialog.tsx:53): chỉ clear demo, giữ dữ liệu tự tạo/tài chính/K/R1 | Q3 đã chốt quyền owner-only cho clear demo, mã dự kiến `data.clearDemo`; không thêm wipe toàn bộ |
| Màn mặc định | [AppShell.tsx:44](D:/Workspace/pos-cafe/src/app/shell/AppShell.tsx:44) luôn render floor; [LeftNav.tsx:56](D:/Workspace/pos-cafe/src/app/shell/LeftNav.tsx:56) có các lối vào chưa guard | Q11 chốt mọi vai trò đang dùng đều thấy sơ đồ. Floor có thể là fallback chung; vẫn phải gate phiên/quyền và các lối vào thao tác, không suy xem sơ đồ là được sửa sơ đồ/đơn |
| Làm mới quyền | [useAppStore.ts:54](D:/Workspace/pos-cafe/src/app/useAppStore.ts:54) tăng session version khi set employee; [WriteLifecycle.tsx:15](D:/Workspace/pos-cafe/src/app/WriteLifecycle.tsx:15) xóa recovery/cắt coordinator khi employee đổi | Tách permission/catalog revision với session generation; không cắt pending vì event trùng/no-op |
| Cache | [WriteRecoveryDrawer.tsx:26](D:/Workspace/pos-cafe/src/app/drawers/pos/WriteRecoveryDrawer.tsx:26) có store/employee/session key; [queryKeys.ts:1](D:/Workspace/pos-cafe/src/features/shared/queryKeys.ts:1) các cache khác chưa có scope này | Giữ recovery isolation; bổ sung quy tắc cache/late response cho các read mới được bảo vệ |
| Realtime | [realtimePort.ts:24](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:24) subscribe 9 bảng, không employees/audit/quyền; [008:54](D:/Workspace/pos-cafe/supabase/migrations/008_modifier_rework.sql:54) đã có lệnh thêm modifier link vào publication | Không phát PIN/token hoặc audit chi tiết mặc định; cần signal an toàn, refresh và fallback rõ. Không nhầm thiếu subscription với thiếu migration publication |
| Bootstrap/owner | [authRepo.ts:60](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:60) dựng ID admin theo store; [014:247](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:247) nhận UUID caller gửi | Không suy owner thật chỉ từ mọi UUID; preflight ca mơ hồ phải chặn và xin mapping |
| PIN form | [employeeDrawerFlow.ts:107](D:/Workspace/pos-cafe/src/features/admin/employeeDrawerFlow.ts:107) còn 4–6 số; [sessionFlow.ts:65](D:/Workspace/pos-cafe/src/features/session/sessionFlow.ts:65) yêu cầu 6 số | Ghi gap hiện trạng; thống nhất với hợp đồng PIN 6 số đã có, không hỏi lại độ dài |

## Quyết định mới của chủ dự án

Các quyết định ngày 2026-09-14 ghi tại đây trong thời gian cổng câu hỏi còn mở; sẽ đưa vào proposal khi đủ điều kiện viết bộ spec.

| ID | Nội dung đã xác nhận | Lý do và phần cũ bị thay |
| --- | --- | --- |
| Q1 | Bảo vệ **đọc và ghi** cho danh mục quyền thuộc change này, gồm đường gọi trực tiếp và Realtime liên quan | Thay dòng ngoài phạm vi per-employee DB ở proposal:45; làm `report.view`/`orderHistory.view` có ý nghĩa bảo mật. Phần ngoài catalog/owner account tiếp tục thuộc change tương ứng |
| Q3 | Đổi quyền “xóa toàn bộ dữ liệu” thành quyền **xóa dữ liệu mẫu dành riêng owner**, đổi tên mã cho đúng chức năng | Thay semantic `data.wipe` bằng `data.clearDemo`. Không thêm chức năng wipe và không xóa tài chính/K/R1/audit. Q3 tự nó giữ số lượng 14; quyết định Q12 mới hơn thêm `receipt.reprint`, nâng catalog lên 15 |
| Q4 | Owner được cấp `employee.permission.edit` và `settings.manage` cho người khác; mặc định người khác không có | Làm rõ “chỉ owner có mặc định” khác “dành riêng owner”; sửa giải thích mâu thuẫn ở proposal:188. Giới hạn ủy quyền theo Q2 đã chốt 15/09 |

## Câu hỏi đang chờ và các nhóm tiếp theo

Chưa có câu trả lời không được coi là đồng ý với khuyến nghị. Không ghi giá trị tạm vào requirement rồi đánh dấu đã chốt.

| ID / trạng thái | Vấn đề cần quyết định | Khuyến nghị và đánh đổi |
| --- | --- | --- |
| Q2 — ĐÃ TRẢ LỜI 15/09 | Trần quyền và cấm tự sửa role/override | Cả tập target trước và sau phải là tập con của actor; owner được miễn trần với non-owner. Xem báo cáo 15/09 cho các kiểm tra bổ sung và audit còn cần làm rõ |
| Q5 — ĐÃ TRẢ LỜI 15/09 | Owner quên PIN trước khi email recovery triển khai | Chấp nhận giai đoạn khôi phục hạ tầng theo quy trình riêng có xác minh/audit, không chặn rollout. Manager vẫn không reset được owner |
| Nhóm owner tự quản trị — ĐÃ CHỐT Q2/Q8 | Cấm tự sửa role/override; owner được tự đổi PIN khi xác minh PIN hiện tại | Q2 thay requirement cũ cho tự giảm quyền rồi cảnh báo. Q8 tách self-change khỏi reset do quên; người khác vẫn không được reset owner, quên PIN dùng Q5 |
| Q9 — ĐÃ CHỐT 15/09 | Độ trễ UI chấp nhận khi foreground online, lost event, reconnect/resume; mức tải fallback | Chọn signal 5 giây, một poll revision dự phòng mỗi 30 giây khi tab hiển thị; tải snapshot khi revision đổi. Trần 35 giây có điều kiện online và cả chuỗi xác minh/tải quyền hoàn tất trong 5 giây. Focus/reconnect xác minh trước mở lại phần bảo vệ; đối xứng cấp/thu hồi. Gate Realtime thật NOT RUN |
| Q10 — ĐÃ CHỐT 15/09 | Bỏ phần nháp chưa gửi thuộc thao tác vừa mất quyền | Đóng phần bị ảnh hưởng và thông báo; giữ nháp không liên quan, đơn đã lưu và K đã được server tiếp nhận; không tự gửi lại. Không giữ nháp bị khóa chờ cấp lại quyền |
| Q11 — ĐÃ CHỐT 15/09, THAY QUYẾT ĐỊNH CŨ | Mọi nhân viên thuộc các vai trò đang sử dụng đều được xem sơ đồ bàn | `floor.view` là quyền nền luôn có trong catalog, khác `floor.manage` để chỉnh sơ đồ. Accountant cũng thấy sơ đồ; không cho override tắt quyền nền. Server vẫn kiểm phiên/cùng store. Q12 sau đó tăng catalog lên 15 mã |
| Q12/Q12a — ĐÃ CHỐT 15/09 | Tách quyền xem lịch sử khỏi quyền in lại; thêm `receipt.reprint`, catalog 15 mã | Mặc định owner/manager/cashier có; accountant phải được cấp thêm, waiter/kitchen không có mặc định. In lại cần quyền mới tại nơi đã được phép xem hóa đơn; không tự mở lịch sử/thu tiền/execute/cancel/tiếp quản K. In ngay sau thanh toán vẫn thuộc luồng `payment.take` |
| Q13 — ĐÃ CHỐT 15/09 | Owner và người có `employee.permission.edit` được đọc audit chi tiết cùng store | Không chọn đề xuất chỉ owner. Quyền đọc audit không bị trần quản trị target Q2 giới hạn; trần đó áp thao tác quản trị. Chưa thêm màn audit trong đợt này; Realtime vẫn chỉ signal tối thiểu |
| Q14 — ĐÃ CHỐT 15/09 | Giữ toàn bộ audit, chưa tự động xóa | Clear demo không xóa; không thêm lịch GC. Chấp nhận dung lượng tăng, không giả định dữ liệu luôn ít sau Q7 |

Chi tiết căn cứ và ràng buộc kỹ thuật của Q9/Q10: [khảo sát cập nhật quyền và nháp ngày 15/09](03-cap-nhat-quyen-va-nhap-2026-09-15.md). Đây là phân tích trước cổng câu hỏi, chưa thay nội dung requirement.

## Findings và việc cần sửa sau cổng câu hỏi

| ID | Mức | Phát hiện / vị trí | Trạng thái xử lý |
| --- | --- | --- | --- |
| F01 | P1 | Proposal:45 loại DB khỏi scope nhưng access delta:160 yêu cầu mọi endpoint kiểm lại | ĐÃ CẬP NHẬT: Q1/proposal/PERM-09 và inventory design3 bảo vệ đọc+ghi15 quyền |
| F02 | P1 | Role change/reset PIN có thể tăng quyền gián tiếp; employee delta:49,64 và access delta:141 | ĐÃ CẬP NHẬT: PERM-16, design4, UC02–06 và TC15–18/41/42 |
| F03 | P1 | `data.wipe` không có chức năng sản phẩm, trái yêu cầu chỉ seed quyền có chức năng | ĐÃ CẬP NHẬT: data.clearDemo owner-only, PERM-02 và UC10/TC12 |
| F04 | P1 | Hai quyền owner mặc định bị gọi nhầm là owner-only tại proposal:188 | ĐÃ CẬP NHẬT: Q4/catalog/field permissions phân biệt default với owner-only |
| F05 | P1 | Owner role có trước email recovery và có thể tự mất quyền quản trị | ĐÃ CẬP NHẬT: PERM-13/14/21/22, self PIN và runbook limitation có audit |
| F06 | P1 | Claim nhận diện owner chắc chắn theo ID quá mạnh; bootstrap nhận UUID tùy caller | ĐÃ CẬP NHẬT: preflight/mapping evidence; TC48/49/51/52 chặn mơ hồ |
| F07 | P1 | Scope đọc mới có thể bị bypass qua SELECT, Storage mutation hoặc payload Realtime | ĐÃ CẬP NHẬT: design3/6, TC25–29/45–47/55; gate thật vẫn NOT RUN |
| F08 | P2 | Refresh employee tăng generation/cắt coordinator; cache không phải recovery chưa tách employee | ĐÃ CẬP NHẬT: PERM-24/25/26, design7 và TC31–35/60 |
| F09 | P2 | Task nhóm 1–3 nói không đổi hành vi nhưng xóa guards ở tasks:27 trước chuyển consumer | ĐÃ CẬP NHẬT: tasks T01–18, bridge/candidate/activation tách rõ; BR02/SR03 đã recheck |
| F10 | P2 | Access delta:184 còn “12 quyền”; proposal:109 còn Store Key rotate tăng lên 15 | ĐÃ CẬP NHẬT: catalog15 gồm receipt.reprint, không Store Key rotate hoặc quyền tương lai |
| F11 | P2 | Scenario manager cấp quyền thiếu tiền điều kiện `employee.permission.edit` | ĐÃ CẬP NHẬT: scenario manager có permission.edit và qua ceiling trước/sau |
| F12 | P2 | usecases/testplan/traceability là khung; traceability ép mọi requirement có UC trái ngoại lệ chuẩn | ĐÃ CẬP NHẬT:30R/15UC/60TC;0R và0UC thiếuTC;PERM07 khôngUC có giải trình/TC |
| F13 | P2 | Bootstrap tạo owner cửa hàng mới chưa có delta; 2 capability hiện tại không đủ bao phạm vi đọc/session mới | ĐÃ CẬP NHẬT:7capability,bootstrap/session/receipt/K delta; không email owner |
| F14 | P2 | Docs hiện trạng còn mốc chống trùng trước implementation/deployment; limitation nói modifier link chưa có publication migration | ĐÃ CẬP NHẬT: navigation/limitations có ngày; giữ nguyên evidence phase27 |

Ba khảo sát là nguồn findings ban đầu, không thay hai review cuối. Bảng trên giữ vị trí của bản được khảo sát và cập nhật trạng thái xử lý; các số dòng của bản cũ có thể đã dịch. Hai reviewer độc lập đã đọc bộ hoàn chỉnh và recheck: [nghiệp vụ](04-review-nghiep-vu.md), [bảo mật/nghiệm thu](05-review-bao-mat-va-nghiem-thu.md). Xem [bàn giao](06-ban-giao-spec-2026-09-15.md) cho kết quả cuối.

## Kiểm chứng tại mốc khảo sát, trước khi viết bộ spec

Đã chạy: Git status/HEAD/branch/worktree inventory, remote refs read-only, diff/stat/name-only, SHA-256 lockfile, lưu baseline diff + manifest, tìm/đọc source bằng `rg` và PowerShell. Không có lệnh chạy application test, build, DB gate, smoke Supabase, migration hoặc live store.

Kiểm sau khi ghi báo cáo: `git diff --check` PASS; 45 liên kết trong báo cáo được kiểm tồn tại, 0 liên kết hỏng. Manifest hash xác nhận chỉ bốn file có sẵn thay đổi bởi lượt này: `docs/README.md`, `docs/limitations.md`, `docs/roadmap.md`, `openspec/README.md`; mọi file khác trong baseline, gồm các thay đổi có sẵn và toàn bộ bộ bảy artifact phân quyền, giữ nguyên byte. Báo cáo này là file mới. Code không có tracked/staged diff, lockfile vẫn nguyên hash đã ghi. Git có cảnh báo chuẩn hóa LF/CRLF, không phải lỗi whitespace.

Mục đích bốn sửa docs: thêm đường dẫn báo cáo; sửa trạng thái chống trùng theo evidence 14/09 mà không đổi lịch; ghi phân quyền đang chốt spec; đính chính thiếu subscription modifier link khác với migration publication đã có và phân biệt frontend đã xác minh với business smoke chưa chạy. Không sửa evidence phase27, không archive change.

Test source hồi quy quan trọng đã đọc: [writePermissions.contract.test.ts:9](D:/Workspace/pos-cafe/tests/contracts/writePermissions.contract.test.ts:9), [writeConcurrency.contract.test.ts:107](D:/Workspace/pos-cafe/tests/contracts/writeConcurrency.contract.test.ts:107), [writeRecovery.contract.test.ts:32](D:/Workspace/pos-cafe/tests/contracts/writeRecovery.contract.test.ts:32), [writeBootstrap.contract.test.ts:62](D:/Workspace/pos-cafe/tests/contracts/writeBootstrap.contract.test.ts:62), [writeRecoveryAccess.test.tsx:53](D:/Workspace/pos-cafe/src/app/writeRecoveryAccess.test.tsx:53). Chưa chạy lại; không dùng số test phase27 làm kết quả kiểm bộ quyền mới.

Gate Realtime/Storage mới: **NOT RUN**, chỉ thiết kế trong task tài liệu. Runtime WSL phase27 không có hai service này, nên gate integration tương ứng phải dùng môi trường cách ly có service thật và xác minh backend; thiếu môi trường thì BLOCKED, không thay bằng mock rồi báo integration PASS.

Task implementation đầu tiên **chưa đủ điều kiện thực hiện**: bộ spec chưa được duyệt. Hướng chia task dự kiến là inventory/preflight/đối chiếu hành vi legacy trước khi activation role mới; ID, đầu ra và nghiệm thu cuối sẽ chốt trong `tasks.md` sau requirements/UC/design/testplan/traceability. Không tự gọi là phase 28, không đánh dấu task code hoàn thành.

Sau khi chốt câu hỏi: ghi decisions vào proposal, viết delta → UC → design → testplan → traceability → tasks; chạy kiểm tra tài liệu; dùng đúng hai reviewer độc lập; xử lý findings, rồi bàn giao **READY FOR APPROVAL** nếu không còn blocker. Điểm dừng vẫn là duyệt spec.



**Bàn giao cuối 15/09:** bộ bảy artifact đã được viết và kiểm tra; hai reviewer đã đóng findings. Các số kiểm tra/diff bốn file ở đoạn trên chỉ thuộc mốc khảo sát ban đầu. Trạng thái, số đếm cuối và task PERM-T01 nằm trong [biên bản bàn giao](06-ban-giao-spec-2026-09-15.md); chưa triển khai task code.
