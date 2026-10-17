# Chốt phiên phân quyền — 28/09/2026

**Trạng thái: dừng theo yêu cầu chủ dự án, sản phẩm chưa hoàn tất và chưa phát hành.** Chủ dự án yêu cầu “các phần không làm được hãy note lại, ta sẽ làm từng phần tiếp chứ không làm liên tục như hiện tại nữa”. Không tự tiếp tục code, test dài, cleanup hoặc deploy sau checkpoint này; chờ chọn phần tiếp theo. Quyền triển khai đã ghi trước đó không bị xóa, nhưng yêu cầu dừng hiện tại được ưu tiên.

Đây là điểm vào hiện hành. [Biên bản ngày28/09](permission-release-resume-2026-09-28.md) giữ diễn biến và evidence; [handoff task](../workflow/tasks/redesign-permission-model.md) giữ nghiệp vụ/ủy quyền. Các đoạn “đang chạy/đang xây” trong nhật ký cũ là trạng thái tại thời điểm ghi, không phải công việc còn tự chạy sau khi chốt.

## Source được giữ lại

| Nơi | Trạng thái khi chốt |
| --- | --- |
| `D:/Workspace/pos-cafe`, `main` | HEAD `ef2c372aec60d8362549e47b7aedb27126129479`;329 đường dẫn thay đổi/chưa theo dõi, gồm thay đổi có sẵn. Chưa commit/push trong đợt này. Giữ `pnpm-lock.yaml` và toàn bộ working tree, không reset/stash. |
| `D:/Workspace/pos-cafe-docs`, `docs` | HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, tài liệu cập nhật chưa commit. Không trộn hai nhánh. |
| Fingerprint code hiện hành | `9ea58de9f0910608e1ba0e303e93c92bad51a3cabc98ee8e84e257d8a9183d8d`, Windows và native đã khớp. |
| Snapshot native | `/var/tmp/pos-cafe-perm-t08-20260922/frozen-source-1790597883752`,696 file hiện diện và2 deletion; tar SHA `f28ba62f08b32ec33c8375bf09a910961b478bb9614e9e47cc7ad7b3eeec669b`, manifest SHA `ed689f80eadd7ef600fdd5f8651116f90e5290c68cd97df3fae57625ff8e81e5`. |

Controller production **chưa được viết**: builder mới khảo sát đọc và đề xuất interface, không tạo file hoặc để lại code WIP cho phần này. `scripts/permission-release-cutover.mjs` là tên dự kiến, chưa phải công cụ có thể chạy. Shared activation đã tách xong, wrapper synthetic vẫn giữ guard.

## Những gì đã kiểm chứng và giới hạn

| Phần | Kết quả đã có | Giới hạn còn lại |
| --- | --- | --- |
| Backup/restore | Backup logic62 bảng/3 sequence; restore cục bộ74/74 phép đối chiếu đạt; schema/roles/ACL supplement được review. Hai ảnh814.829 byte đã restore/readback API khớp. | Không phải PITR hoặc chứng minh toàn bộ dịch vụ Supabase; proof/credential giữ ngoài Git. |
| Cleanup77 quán trên bản sao | Xóa đúng closure2.801 dòng rồi rollback;74/74 postflight khớp;66 Auth users ngoài scope và toàn bộ Storage metadata giữ nguyên. Reviewer APPROVE đúng phạm vi rehearsal này. | Đã dùng restore_operator superuser; chưa chứng minh controller chạy bằng `postgres` NOSUPERUSER của production. Chưa xóa live. |
| Unit/build | Candidate41d85576 chạy1.139 test PASS, build PASS; evidence strict có source/profile. | Không gán kết quả này cho toàn candidate9ea58 hoặc source tương lai. Full aggregate vẫn chưa đạt. |
| TC44 concurrency | Bốn ca clear/seed đối đầu financial takeover PASS trên41d, run2 có guard full-row opaque + byte proof sau cleanup đạt. | Review run1 chỉ duyệt kết quả bốn ca, không duyệt guard cũ thiếu full-row credential proof. Run2 còn chờ verdict độc lập; giữ nguyên lịch sử lần guard trước bị lỗi. |
| Shared activation | Hai file extraction được reviewer APPROVE source-only;17 tooling tests PASS. | Chưa có release controller hoặc rehearsal kết hợp cleanup→activation. |
| Images fixture teardown | Sửa cleanup/retry/đối chiếu payload; tsc/diff-check PASS và reviewer APPROVE source-only. | Focused service trên9ea58 **NOT RUN**: pre-guard báo `FIXTURE_AUTH_IDENTITY_REQUIRED` do JWT fixture hết hạn, dừng trước kết nối DB. Không refresh/reset để chạy tiếp sau yêu cầu dừng. |
| UI và forced owner PIN | Code candidate đã nối UI và có bằng chứng từng slice/browser trước đó. | Cần gate tổng trên source cuối; không coi lịch sử từng slice là nghiệm thu bản phát hành. Các lỗi bố cục/checkbox/font/contrast đã được chủ dự án tách sang task UI sau. |

## Đích live và công cụ

- Đích đã duyệt: `https://pos-cafe-azure.vercel.app`, Supabase `kfqjdfwxhkdwihjobpny`. Kiểm DB đọc gần nhất:77 stores/143 Auth users/3 objects; dữ liệu chưa bị dọn, chưa activation/deploy mới trong đợt này.
- Supabase MCP có cấu hình enabled đúng project nhưng catalog công cụ của chat trống. Probe app-server riêng báo `notLoggedIn`; không đủ kết luận phiên OAuth của ứng dụng lỗi. Proxy điều khiển không khả dụng, nạp lại chat có active writer bị từ chối và đã dừng. Chưa khắc phục được kênh Edge/Storage qua MCP. Yêu cầu thao tác Restart MCP được hoãn cùng phiên; không cần chủ dự án tiếp tục thao tác ngay.
- Credential PostgreSQL đã được lưu qua helper ẩn, kết nối TLS dùng được. Không đổi password nữa hoặc yêu cầu gửi token vào chat. Backup và helper nằm trong `C:/Users/nguye/AppData/Local/pos-cafe-release`, không commit nội dung bảo vệ.
- T04 đã trả lease, không có suite đang dùng fixture. Trạng thái DB kiểm gần nhất sau TC44run2 là clean legacy, marker proof `6baa2ae9cd77a92b96847018042e1f9b9e5ac9d7834995771cbbc8aac0d089a4`; lần images sau đó không kết nối/mutation DB. Lần tiếp theo phải kiểm marker/control rồi refresh JWT bằng công cụ fixture, không reset tùy ý.

## Các phần tiếp theo, thực hiện riêng khi được chọn

1. **Khôi phục kênh Supabase MCP.** Chỉ xác minh trạng thái kết nối/tool và chạy đọc thử đúng project. Đầu ra: kênh Edge/Storage dùng được hoặc lỗi cụ thể; không đụng dữ liệu và không deploy trong phần này.
2. **Hoàn thiện controller phát hành.** Tạo controller/test mới dựa trên shared activation; bind source/bundle/inventory/backup/restore proof, chuẩn bị hook với provenance, cleanup và empty activation cùng transaction READ COMMITTED, mặc định rollback. Không khóa bảng provider mà actor production không có quyền. Review rồi diễn tập riêng dưới `postgres` NOSUPERUSER, gồm legacy bootstrap đã được nhận trước cutover và fault rollback. Xử lý restore hook/ACL sau rehearsal phải được chứng minh, không bỏ drift check. [Thiết kế §8.2.1](../../openspec/changes/redesign-permission-model/design.md).
3. **Đóng gate kiểm thử.** Refresh đúng fixture identity rồi chạy images/cleanup guard; hoàn tất review TC44run2; freeze source cuối sau controller, chạy các stage bắt buộc cùng source/profile, forced-PIN, Realtime/Storage/browser, build và hai review cuối khác scope. Không tự nhận các kết quả lịch sử khác fingerprint thành full PASS.
4. **Phát hành riêng sau khi phần2–3 đạt và kênh triển khai sẵn sàng.** Fresh locked recheck đúng77 UUID, backup/proof còn phù hợp; atomic cleanup+activation; Storage API xóa đúng hai object theo journal sau DB commit, giữ object/Auth ngoài scope; deploy Edge/frontend phối hợp và kiểm sau phát hành. Dừng khi có dữ liệu/scope drift; không tự mở rộng tập xóa.

Phần2 có thể làm trong khi phần1 còn vướng. Không bắt chủ dự án chốt lại nghiệp vụ Q1–Q15 hoặc quyền deploy đã được ghi; chỉ hỏi nếu phát sinh quyết định mới làm đổi scope/dữ liệu/quyền. Lần giải thích code/nhận nghiệm thu của chủ dự án chưa thực hiện.

## Review checkpoint

Checkpoint chỉ bàn giao trạng thái và việc còn lại, không tuyên bố toàn bộ code an toàn để phát hành. Hai reviewer độc lập đã **APPROVE checkpoint**: `backup_restore_review_resume` kiểm backup/restore/quyền/live/MCP và không nhận quá bằng chứng; `owner_pin_browser_resume` kiểm source/snapshot/images NOT RUN/fixture/gate và con trỏ trạng thái. Bản nội dung được review trước khi ghi mục kết quả này có SHA `01c85224bb2f2c74a2fe8f52f4c29e2e2525bc3b49af2df4b66d330c368003a6`. Hai con trỏ index đã sửa và được reviewer xác nhận lại. Approval này không thay review release cuối.

Khi đóng phiên, không còn Vitest/Playwright/permission runner đang chạy. Đã dừng hai process Windows của keepalive WSL do root mở; session50751 đã kết thúc. Không xóa file/volume/container hoặc tự restart/stop project Supabase. Các dịch vụ Docker local có thể còn chạy; lần sau kiểm readiness trước khi dùng, không suy trạng thái từ checkpoint.
