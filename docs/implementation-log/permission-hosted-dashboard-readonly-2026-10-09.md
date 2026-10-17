# Metadata Dashboard của đích phát hành — 09/10/2026

## Phạm vi

Chủ dự án cho tiếp tục công việc và sẽ kiểm hai Dashboard sau. Phiên trình duyệt Codex đã mở đúng [Supabase project `kfqjdfwxhkdwihjobpny`](https://supabase.com/dashboard/project/kfqjdfwxhkdwihjobpny) và [Vercel project `pos-cafe`](https://vercel.com/24tx810010-hcmutes-projects/pos-cafe) bằng phiên đăng nhập sẵn. Chỉ đọc UI metadata; không mở giá trị biến môi trường, API key, token hoặc OTP; không sửa cấu hình, tạo backup, deploy hay chạm dữ liệu hosted. Hai tab được giữ mở để chủ dự án kiểm.

## Quan sát trực tiếp

| Kênh | Metadata hiển thị | Giới hạn kết luận |
| --- | --- | --- |
| Supabase overview | Project `pos-cafe-demo`, ID trong URL đúng `kfqjdfwxhkdwihjobpny`, hostname `kfqjdfwxhkdwihjobpny.supabase.co`, trạng thái **Healthy**, compute NANO tại Sydney. | Đây là project UI thật, chưa là proof DDL/Storage API hoặc quyền release. |
| Supabase Edge Functions | Trang `/functions` hiện **Deploy your first Edge Function**, tức chưa có function được deploy trong project ở thời điểm đọc. | Backend candidate cần deploy theo runbook trước frontend; chưa chạy function/JWT thật trên hosted. |
| Supabase Storage | Trang `/storage/files` có một bucket `menu-item-images`, PUBLIC, bốn policies, giới hạn 5 MB, MIME `image/jpeg`, `image/png`, `image/webp`. | UI bucket metadata chưa xác minh quyền/API/bytes của ba object hiện có hoặc journal cleanup hai object. |
| Supabase backups | Trang `/database/backups/scheduled` ghi Free Plan không có project backups; overview ghi Last Backup: No backups. | Release gate backup/restore phải dùng bản backup tự tạo và chứng minh phục hồi theo runbook; không suy có scheduled backup. |
| Vercel overview | Team `24tx810010-hcmutes-projects`, project `pos-cafe`, Production domain `pos-cafe-azure.vercel.app`; deployment **Ready**, nguồn `main` commit `ef2c372aec60d8362549e47b7aedb27126129479` ngày14/09. | Production đang ở HEAD cũ, chưa chứa candidate dirty hiện tại. |
| Vercel Environment Variables | Có đúng ba tên project variable `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, mỗi biến scope **Production and Preview**, loại Secret. | Không mở giá trị; tên/scope không tự chứng minh URL/key đúng. Public bundle probe riêng thấy literal hostname đích, chưa chứng minh key hay runtime binding. |
| Vercel Git/build | Repository kết nối `github.com/24tx810010-hcmute/pos-cafe`; overview ghi push `main` cập nhật Production. Build page cho Vite/dist/Node24.x, production override hiển thị `npm run build` và `npm ci`; trang cảnh báo settings deployment hiện khác project settings. | Auto-deploy/branch cần canh trong cutover; chưa thử push/deploy hoặc kiểm source cuối trên Vercel. |

Đọc UI sau khi trang tải xong, không suy từ placeholder lúc loading. Bằng chứng quan sát là trạng thái accessibility của hai tab trong phiên Codex này; chưa có receipt Dashboard độc lập/screenshot lưu vào artifact. [Read-only DB receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-canary-close1-20261009/hosted-db-readonly-receipt.json) bổ sung 77 stores/143 Auth/3 Storage, profile provider matcher true tại snapshot khác; không gộp hai kênh thành actual release proof. Trạng thái source/binding/release cuối: **NOT VERIFIED**.
