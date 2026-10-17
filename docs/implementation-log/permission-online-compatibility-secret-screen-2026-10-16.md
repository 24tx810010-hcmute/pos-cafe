# SEC delta — năm test có pattern hit, 16/10/2026

Reviewer `ci1_worker_sec`. Chỉ đọc năm source test được giao và định nghĩa pattern tại `artifacts/permission-file-inventory-20261016/audit.cjs:39–44`; không chạy audit hoặc sửa inventory đã freeze. Dùng regex và TypeScript AST có sẵn để xác định literal, helper/mock, caller và assertions; không import/chạy test hoặc module ứng dụng, không network. Không đọc `.env`, credential/direct-postgres, raw/private backup hoặc nội dung 125 hồ sơ raw/evidence. Không in/lưu matched literal token/password/URL có userinfo hay context chứa chúng.

## Kết luận từng hit

**CLEAR_SYNTHETIC_FOR_REVIEWED_HITS**: cả năm file, bảy vị trí khớp đều có provenance synthetic test rõ. Có thể đóng HOLD do chính các hit này, không tự đóng các kiểm tra payload/scope khác của file và không sửa manifest/inventory gốc.

| Source / dòng | Loại hit | Hardcode synthetic rõ? | Provenance và lý do |
| --- | --- | --- | --- |
| [realtimePort.test.ts:28](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.test.ts:28) | `secret_assignment_literal` trên trường session | Có | Nằm trong helper `makeFakeClient` từ dòng14, giá trị được `vi.fn().mockResolvedValue` trả qua mock `auth.getSession`; channel/setAuth cũng là mock. Test dùng fake client và đối chiếu lời gọi tại dòng42–46. Đây là marker session điều khiển bởi test, không kết quả đọc secret hoặc session provider. |
| [harness.tool.test.ts:64](D:/Workspace/pos-cafe/tests/contracts/harness.tool.test.ts:64) | `credential_url_literal` | Có | Input hardcode có userinfo trong URL thuộc miền ví dụ dành cho fixture, truyền vào `environment` → `parseTestEnvironment` và expected `toThrow`. Test cố ý kiểm URL credential bị từ chối; không dùng làm request/network credential. |
| [harness.tool.test.ts:67](D:/Workspace/pos-cafe/tests/contracts/harness.tool.test.ts:67) | `credential_url_literal` | Có | DSN hardcode thuộc input môi trường âm trên miền ví dụ; `parseTestEnvironment` phải từ chối. Cùng nguồn fixture/parser test, không nạp DSN từ credential store. |
| [permissionInventory.tool.test.ts:162](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:162) | `credential_url_literal` trong lỗi giả | Có | Object `failure` có query giả ném `Error` được gắn metadata lỗi; `collectInventory(failure)` được kiểm từ chối và không phản chiếu nội dung nhạy cảm ở dòng163–164. URL là chuỗi cố ý đưa vào lỗi để kiểm redaction, không cấu hình connection thực. Không dựa riêng hình dạng hostname để kết luận. |
| [permissionPreflight.tool.test.ts:31](D:/Workspace/pos-cafe/tests/contracts/permissionPreflight.tool.test.ts:31) | `credential_url_literal` | Có | Một hàng input âm của `test.each` bắt đầu dòng27, DSN trên miền ví dụ được chuyển vào `config`/`parseObserverEnvironment`, expected `toThrow` tại dòng37. Là fixture kiểm parser/target binding, không actual DB connection. |
| [permissionRealtimeHarness.tool.test.ts:22](D:/Workspace/pos-cafe/tests/contracts/permissionRealtimeHarness.tool.test.ts:22) | `secret_assignment_literal` trên trường refresh | Có | Helper `fixture` tạo thư mục tạm và JSON control riêng của test; marker khởi tạo hardcode. Đây là dữ liệu fixture local được tạo trong test, không đọc token từ tài khoản/credential store. |
| [permissionRealtimeHarness.tool.test.ts:37](D:/Workspace/pos-cafe/tests/contracts/permissionRealtimeHarness.tool.test.ts:37) | `secret_assignment_literal` trên expected refresh | Có | Expected JSON sau refresh bằng `fetchMock`/`vi.stubGlobal` ở dòng33–34; token response do factory local dòng26–27 tạo. Assertion kiểm chuyển trạng thái control của fixture, không literal provider credential. |

Regex năm loại của inventory được đối chiếu trên riêng năm source này: bốn vị trí credential URL và ba vị trí secret assignment; không có hit của private-key/JWT/provider-token pattern trong năm file. Đây là kết quả pattern giới hạn, không chứng minh scanner bao phủ mọi secret representation. Số **năm file** của handoff khác **bảy vị trí** khi rà mọi occurrence; không nhận bảy là số credential thật.

## Fingerprint source đã đọc

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/adapters/supabase/realtimePort.test.ts` |4271|`edb759d8fea9b80e199e6e131c0e70e72bec18f20dcd118bd91218f9e9af88d4`|
| `tests/contracts/harness.tool.test.ts` |6609|`b2b9b978124eb1ed2b1a93e46492e4b6503be3dd75658db59e97c16035caf383`|
| `tests/contracts/permissionInventory.tool.test.ts` |15080|`0fb9cbd013b2311b877a1f2cbfc1ac98b3f19b49909b2160fc55fc1dec53238a`|
| `tests/contracts/permissionPreflight.tool.test.ts` |16508|`b6df38a90853da78f9e8f1c5db6d65cef000e108892fa92840dd60e3f13a5555`|
| `tests/contracts/permissionRealtimeHarness.tool.test.ts` |7684|`cc0ee973e078c5f42a06108aebc6d990a0d533460337971ac5445b55bf5c25f4`|

Chỉ báo cáo này là đầu ra ghi mới; năm source không đổi và inventory freeze không bị ghi đè. Không chạy test để tạo PASS mới. Khi bytes của file đổi, kết luận cần đối chiếu delta.

## Giới hạn 125 hồ sơ raw/evidence và lịch sử Git

Đối với nhóm 125 file được handoff ghi là tracked/unchanged, nhãn và trạng thái Git chỉ là metadata; reviewer không đọc nội dung nhóm đó trong slice này. **Chưa có bằng chứng trong slice này cho thấy chúng chứa secret thật.** Thiếu full-history audit không được đổi thành finding credential leak; tracked/unchanged cũng không tự chứng minh nội dung đã được phép công khai hoặc sạch bí mật.

Exact public payload, repo/branch và phần history sẽ reachable/access được phải được chốt ở gói xin push tương ứng. Khi phạm vi đó rõ mới đối chiếu nội dung/provenance/privacy cần thiết, giữ ranh giới credential/private raw. Không tự công khai/xóa/di chuyển/viết lại history hoặc tạo yêu cầu rotate credential chỉ vì thiếu assurance. Lượt này không cấp overall push-ready, release-ready hoặc DB compatibility PASS; các HOLD khác và quyền owner vẫn riêng.
