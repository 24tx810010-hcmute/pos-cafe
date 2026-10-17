# SEC — checkpoint Preview Branch Tracking OFF, 16/10/2026

**APPROVE** candidate SHA256 `b7ddc871cf4562d095a9bdc0b77a6c88aca8e791881b9296444d178fdce03919`, chỉ cho hồ sơ thao tác Preview OFF/Save/reload đã được owner cho phép. Không có finding chặn checkpoint. Không cấp quyền publication, branch/stage/commit/push, CI/DB/deploy/delete hoặc bật lại setting.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/preview-tracking-off-01/candidate-01/manifest.json`; 8 snapshots/101.095 B. Reviewer độc lập `/root/ci1_worker_sec`; chỉ tạo báo cáo này, không sửa candidate/source/report khác hoặc gọi browser/provider.

## Kiểm độc lập

Tự đối chiếu SHA/kích thước toàn bộ 8 originals +8 frozen snapshots: 0 sai khác. Previous proposal reference vẫn khớp SHA `62bf3101f518962e18b7ba986e39ae04bb7c9fd0d26243306017c0f31966bf0b`. Đọc authorization/receipt/report và cả bốn AX records; đã xem ảnh sau reload. Không có tests/project-module import, Git actions, credential/private inputs/runtime, DB/network/provider requests hoặc install/delete trong lượt review.

SEC đánh giá evidence đã lưu, không đo lại live setting sau freeze. Số Save và thao tác UI đến từ execution receipt/tác giả; before/after AX và ảnh độc lập về hình thức xác nhận trạng thái cuối phù hợp, không phải audit log mọi request của provider.

## Quyền và thao tác đã ghi

`snapshot/01-authorization-baseline.json` bind owner answer `call_be33cd11bcb8463e90c03060b324d81c`: “Cho phép tắt auto Preview, chưa push”, đúng project `24tx810010-hcmutes-projects/pos-cafe`, phạm vi đã review. Owner cho thay setting cụ thể, không phải chỉ hỏi ý kiến; không cần xin lại quyền cho việc click label để đạt cùng thao tác đã cho phép.

`07-execution-receipt.json` và báo cáo `08-permission-preview-tracking-off-2026-10-16.md:7` phân biệt lần uncheck `sr-only` không đổi state/chưa Save với lần click associated label chuyển OFF rồi Save đúng1lần. Không nhận thao tác UI thất bại thành kết quả đã lưu. Record cuối có reload, không chỉ unsaved toggle; không có evidence trong gói cho thấy đã đổi Production, env/domain/integration hoặc Supabase.

## Bằng chứng trạng thái và privacy

| Nguồn frozen | Điều xác nhận được |
| --- | --- |
| `02-before-accessibility.txt:1,66,73,77` | Đúng Preview URL, checkbox=1, all unassigned branches, Save disabled trước sửa |
| `03-after-reload-accessibility.txt:1,63,66,70` | Cùng Preview URL, checkbox=0, Save disabled; UI vẫn nói CLI/API deploy được khi tắt |
| `04-preview-off-after-reload.jpg` | Project/Preview context, công tắc OFF và Save disabled nhìn thấy rõ, nhất quán AX |
| `05-production-settings-after.txt:62`–81 | Production vẫn theo main, Auto-Assign Custom Production Domains=1, Save disabled |
| `06-production-overview-after.txt:66,78,91,93` | Dashboard vẫn hiển thị deployment `DqnFhDaswqUcqiryL6A2XwDfMmHY`, Ready, main/commit `5156820f7d6679cd6f8051bdc38419737ffa0c7e` như proposal trước |

Đây là Production dashboard metadata, không phải kiểm toàn aliases, business behavior hoặc chứng nhận không có mọi provider event. Không dùng Ready của deployment nền làm release PASS cho code đang chuẩn bị. Snapshot có tên env variables và metadata project/account; không có env values/PIN/token/DB credential/private bytes được mở hoặc lưu trong chứng cứ đã xem. Chưa cấp quyền công khai toàn bộ ảnh/AX hay toàn payload từ review này.

Authorization baseline và execution receipt có HEAD/staged-entry hashes main/docs giống nhau, stagedPaths=0; consistent với không branch/stage/commit/push. Không thực hiện fresh Git query trong review; không nhận metadata đó thành full working-tree/content audit. Tab đóng được ghi trong receipt, SEC không mở tab để tái xác minh.

## Giới hạn còn giữ

Báo cáo tác giả dòng 15–19 nêu đúng phạm vi: OFF cho **mọi nhánh chưa gán môi trường của project này**, không riêng nhánh evidence/docs; Preview cũ không bị xóa. Giữ OFF đến lệnh owner; không tự bật lại sau push hoặc tự khôi phục theo lịch. Main pushes, manual CLI/API deploy và project/provider khác vẫn có thể deploy; không thử push/deploy để xác minh bằng tác động thật.

`publicationReady=false` và `NOT_READY_FOR_DEPLOY` vẫn nguyên. Exact payload/history privacy, refs/commit package, backend/cutover và lệnh push riêng còn mở; setting OFF chỉ khép đường auto Preview đã biết. Không mở rộng verdict sang whole-payload audit hay release acceptance. Ngân sách1MiB của bước này nằm trong8MiB operational budget đã ghi; không có quota OS hoặc môi trường nặng mới được chứng minh.

Không có actionable finding cần sửa trong candidate. Giữ **APPROVE checkpoint thực thi setting** đúng hash trên; chỉ owner mới cấp quyền bật lại hoặc thực hiện bước Git/provider tiếp theo.
