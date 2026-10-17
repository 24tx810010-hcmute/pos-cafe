# Delta — PIN owner tạm

Yêu cầu chốt22/09, giữ nguyên SHALL/MUST/Scenarios. **Cập nhật08/10:** có code/test liên quan, coverage/gate chưa đầy đủ; trạng thái và nguồn executable/evidence ở [testplan](../../testplan.md). Spec không tự chứng nhận runtime PASS/nghiệm thu. Scope và ủy quyền ở [proposal](../../proposal.md).

## ADDED Requirements

### Requirement: Trạng thái PIN tạm có nguồn gốc rõ

**PIN-01.** Server SHALL quản lý `pinChangeRequired`. Bootstrap owner đặt true; mỗi request operator recovery mới đặt true, kể cả PIN giống hiện tại. Client không tự ghi cờ; true chỉ hợp lệ cho owner. Không suy cờ từ PIN phổ biến. Normal self-change và reset non-owner giữ hợp đồng hiện có.

#### Scenario: Khởi tạo hoặc recovery owner

- **WHEN** bootstrap hoặc một ca recovery mới commit
- **THEN** owner có cờ true; đúng PIN chỉ nhận phiên hạn chế. Replay recovery sau đổi PIN không thay cờ hoặc credential hiện hành.

### Requirement: Phiên hạn chế không có quyền vận hành

**PIN-02.** Phiên `required_pin_change` SHALL gắn store/employee/revision, TTL 5 phút, memory-only. Chỉ cho complete-required-PIN, revoke và proof-only session check. Check chỉ trả hiệu lực, purpose, revision, expiry của chính phiên, không role/quyền/dữ liệu protected. Hết hạn/revoke trả `EMPLOYEE_SESSION_REQUIRED`. Normal guard MUST từ chối phiên hạn chế hoặc employee còn cờ true bằng `PIN_CHANGE_REQUIRED`, kể cả đúng version/header. Không bypass nhờ `floor.view`, RLS tenant hoặc cache.

#### Scenario: Gọi thẳng tầng dữ liệu

- **WHEN** phiên hạn chế gọi read/write/admin/audit/financial/K/print/ảnh có employee authorization
- **THEN** không dữ liệu protected hoặc mutation nghiệp vụ/K/R1; chỉ ba route purpose riêng được phép. Metadata ghép quán/công khai giữ projection tối thiểu hiện hành.

### Requirement: Đổi PIN bắt buộc và đăng nhập lại

**PIN-03.** UI SHALL chặn AppShell và dữ liệu protected, chỉ cho đổi PIN/đăng xuất/đổi quán. PIN mới string đúng 6 chữ số ASCII `0-9`, khác PIN tạm; xác nhận UI phải khớp. Commit SHALL nguyên tử: hash mới, cờ false, revision +1, thu hồi mọi phiên owner, audit và signal. Không trả normal token; owner phải login lại. Không tự replay mutation, order/payment hoặc print. Lỗi trước commit rollback toàn bộ.

#### Scenario: PIN trùng hoặc chưa đổi

- **WHEN** PIN mới trùng PIN tạm, hoặc reload/đóng ứng dụng trước commit
- **THEN** trùng nhận `PIN_REUSE_NOT_ALLOWED`; cờ true vẫn ở server, mở lại vẫn phải đổi.

### Requirement: Đồng thời, recovery và mất ACK

**PIN-04.** Complete SHALL dùng requestId/expectedRevision, kiểm token/TTL/cờ/revision sau khóa. Hai thiết bị không ghi đè lượt thắng. Token đã revoke luôn nhận `EMPLOYEE_SESSION_REQUIRED` khi gọi lại; receipt không hồi sinh quyền. Mất ACK giải quyết bằng login PIN mới và quan sát loại phiên/cờ hiện tại; không hứa replay completion. Mỗi recovery mới SHALL tăng revision một lần, ghi một audit applied/signal, đặt true, thu hồi mọi phiên kể cả credential/cờ đã giống. Replay recovery chỉ trả kết quả lịch sử, không áp lại. `credentialChanged` chỉ mô tả hash có đổi hay không.

### Requirement: Tạo quán và seed tiếp tục an toàn

**PIN-05.** Pending create context memory-only SHALL tồn tại trước allocation/Auth/bootstrap, giữ payload/request IDs/credential trong cùng vòng đời; retry không tạo quán hoặc Auth thứ hai. Completed Key chưa ACK SHALL sống qua unmount/compatibility gate. Trước tạo có cảnh báo hard reload/đóng tab làm mất Key và xác nhận đã hiểu; sau tạo ACK đã lưu Key trước xóa/chuyển login. Không hứa recovery bí mật sau hard reload.

Lựa chọn seed SHALL lưu cùng bootstrap. Quán blank không seed. Quán demo có một workflow server, stable IDs/receipts cho employee/menu/floor; chỉ normal owner hiện hành chạy được. Chỉ workflow chưa bắt đầu được auto claim sau normal login. Sau lỗi, reload giữa chừng hoặc kết quả chưa rõ, client chỉ đọc trạng thái và chờ explicit retry. Mỗi stage commit dữ liệu và receipt nguyên tử; committed stage MUST NOT chạy lại, kể cả sau đổi cashier PIN/menu/floor, mất ACK hoặc thiết bị khác retry. Hai thiết bị phải serialize; seed không tạo lại quán/owner/reset owner PIN. Failure không cấm vận hành dữ liệu đã có.

### Requirement: Phạm vi và activation đích rỗng

**PIN-06.** Giữ 15 quyền/role/trần ủy quyền, normal self-PIN no-op và non-owner reset. Đích đã duyệt SHALL có zero stores, employees và mọi business row liên quan sau scoped cleanup, kiểm lại dưới khóa loại trừ ghi ngay trước activation. Công cụ phải có opt-in `expectedEmptyStoreSet:true` cho chế độ logic empty-target, giữ execution mode/schemaVersion hiện có; chỉ khi opt-in mới nhận storeIds/mappingFiles rỗng, không owner/mapping giả. Còn dữ liệu hoặc drift phải dừng. Không xóa project/schema/config, Auth/Storage ngoài allowlist; không suy backfill môi trường khác.

### Requirement: Bí mật và evidence

**PIN-07.** PIN/hash/token/Store Key MUST NOT vào log/audit/Realtime/browser persistent storage/report. Registry chỉ chứa keyed MAC của payload bí mật và receipt không secret. Kiểm mock, SQL/Auth/REST thật cách ly, browser, bypass, UI audit; evidence gắn source. Kế hoạch không phải kết quả test.

## MODIFIED Requirements

Với owner có cờ true, PIN-02/PIN-03 thay phát biểu PERM-20 “đúng PIN cấp phiên 12 giờ và authority”; 12 giờ chỉ còn áp dụng normal login khi cờ false. PIN-03 thay phần PERM-21 “Không thêm forced-default-change” trong scope bootstrap/recovery owner. Self-PIN thông thường vẫn xác minh currentPin, cho no-op cùng PIN; email recovery ngoài scope. PERM-22 áp dụng transition/replay PIN-04; xác minh con người và quyền operator giữ nguyên.


### Tham chiếu BACKUP-AB-14, 14/10/2026

Phần activation đích rỗng/PIN-06/PIN-T07 tiếp tục tham chiếu [backup v2 B/I/C/L](../../../../../docs/runbooks/permission-backup-v2-2026-10-14.md), PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2. Đây là cập nhật dependency vận hành theo quyết định owner; không đổi forced-PIN,19TC hoặc empty-target behavior. Old77 và74/75FAIL là lịch sử; phạm vi mới EXACT79 có private provenance. Knonempty chặn cleanup, ngoài66Auth/object3 giữ; chưa C/Storage/provider receipt thì release vẫn BLOCKED.
