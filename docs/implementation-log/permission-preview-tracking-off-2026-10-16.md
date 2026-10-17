# Tắt auto Preview của POS — 16/10/2026

Owner đã cho phép qua câu trả lời `call_be33cd11bcb8463e90c03060b324d81c`: “Cho phép tắt auto Preview, chưa push”. Chỉ thực hiện Preview Branch Tracking OFF → Save → xác minh lại, giữ OFF đến lệnh bật lại. [Proposal đã review](permission-git-milestone-preparation-2026-10-16.md) vẫn là checkpoint lịch sử; quyết định này không cấp quyền Git/CI/DB/deploy.

## Kết quả thực hiện

Trên đúng project `24tx810010-hcmutes-projects/pos-cafe`, URL `/settings/environments/preview`: trước thao tác Branch Tracking ON, pattern All unassigned branches. Lệnh uncheck trực tiếp vào input `sr-only` báo không đổi; kiểm UI xác nhận vẫn ON và chưa Save. Đọc DOM thấy nhãn công tắc hiển thị, click đúng nhãn đó chuyển OFF; sau đó click Save đúng một lần. Save chuyển disabled. **Reload trang: Branch Tracking vẫn OFF, Save disabled**. Đã lưu accessibility trước/sau và ảnh sau reload; không dựa vào trạng thái unsaved để kết luận.

Đối chiếu chỉ đọc sau thay đổi: Production vẫn theo `main`, Auto-assign Custom Production Domains ON, Save disabled. Overview vẫn hiển thị deployment `DqnFhDaswqUcqiryL6A2XwDfMmHY`, Ready, source `5156820f7d6679cd6f8051bdc38419737ffa0c7e/main`, domain `pos-cafe-azure.vercel.app`. Không chỉnh Production, env, domain, Git integration hoặc Supabase. Đây là metadata dashboard, không kiểm toàn aliases hay trạng thái nghiệp vụ của site.

Ảnh và receipt được giữ local trong `D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/preview-tracking-off-01/`. Không mở giá trị env/secret, không dùng credential DB hoặc chạy probe mới. Tab agent tạo đã đóng.

## Ý nghĩa và giới hạn

Auto Preview cho **mọi nhánh chưa gán môi trường của project này** đã được tắt theo setting vừa đọc lại; bao gồm nhánh minh chứng/docs và các nhánh khác của nhóm. Preview cũ không bị xóa. Giữ OFF tới khi owner cho bật lại; không tự khôi phục sau lần push sau này.

Main push, manual CLI/API deployment và provider/project khác không bị setting này khóa. Không thử push/deploy để chứng minh trạng thái. Việc tắt auto Preview chỉ khép đường trigger đã biết này, **không làm publicationReady=true hoặc Supabase/Vercel release PASS**. Các gate source/payload/history privacy, gói commit/refspec, backend/cutover và lệnh push riêng vẫn giữ nguyên. Nhớ merge nhánh code minh chứng về main khi đủ gate và có lệnh; docs giữ riêng.

Không tạo branch, stage/commit/push, chạy CI/app tests, kết nối/sửa DB, deploy hoặc xóa file. Chỉ ghi evidence/docs nhỏ trên D; dự trù tối đa1MiB cho gói bước này, nằm trong ngân sách8MiB gói chuẩn bị, không cài/tải/copy runtime. Trước bước này C/D còn201.519.562.752/102.733.381.632B, trên dự trữ30GiB; operational budget không phải quota OS. Source ứng dụng không sửa; HEAD/staged-entry hashes được đối chiếu trước/sau trong receipt.

Chờ SEC/EVC review kết quả và evidence thực thi; approval proposal trước không tự thay cho review checkpoint thực tế.


## Metadata review cuối

SEC và EVC cùng **APPROVE actual checkpoint** SHA256 `b7ddc871cf4562d095a9bdc0b77a6c88aca8e791881b9296444d178fdce03919`, 8 snapshots/101.095B, không findings chặn. [SEC](permission-preview-tracking-off-sec-review-2026-10-16.md), [EVC](permission-preview-tracking-off-evc-review-2026-10-16.md). Root đối chiếu pins/review hashes; chỉ metadata được thêm sau freeze. [Closeout local](D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/preview-tracking-off-01/closeout.json).

Đã hoàn tất đúng setting được owner duyệt: **Preview Branch Tracking OFF, Save và reload đã xác nhận**. Supersede dòng chờ review của checkpoint trên. Giữ OFF đến lệnh bật lại; Production/main và Supabase không chỉnh, không branch/stage/commit/push/CI/deploy/delete. Publication/release chưa ready; bước Git cụ thể còn cần exact payload/ref/commit review và lệnh owner.
