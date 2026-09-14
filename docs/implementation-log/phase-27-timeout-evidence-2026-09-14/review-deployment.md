# Xác minh frontend deployment — 2026-09-14

Kết luận: frontend công khai **https://pos-cafe-azure.vercel.app** đang phục vụ JavaScript/CSS khớp từng byte với bản build local của đợt sửa đã push. GitHub/Vercel ghi một Production deployment thành công cho **main@8ed7418573fe88e27796d3b09807a3c55db4d0d6**. Đây là bằng chứng deployment/static artifact, không phải nghiệm thu giao dịch trên môi trường thật.

## Chuỗi bằng chứng

1. GitHub repository metadata trả `homepage=https://pos-cafe-azure.vercel.app`; không suy ra frontend từ hostname Supabase. Cấu hình `vercel.json:3` dùng Vite, `npm ci`, `npm run build`, publish `dist`, SPA rewrite.
2. `git rev-parse HEAD` và `git ls-remote origin refs/heads/main` cùng trả `8ed7418573fe88e27796d3b09807a3c55db4d0d6`.
3. Commit combined status có context `Vercel`, state `success`, mô tả `Deployment has completed`, lúc **2026-09-14T04:07:42Z**.
4. Production deployment **6430265353** gắn chính SHA đó, status success lúc **2026-09-14T04:07:43Z**. URL bất biến do provider trả là `https://pos-cafe-cwg8w40vf-24tx810010-hcmutes-projects.vercel.app`.
5. GET không đăng nhập tới domain public trả HTTP **200** và HTML trỏ hai assets dưới đây. Cả hai trả HTTP **200**, đúng content type và khớp SHA256 với `dist` local.

| Asset | Bytes | SHA256 cả remote và local |
|---|---:|---|
| `/assets/index-CfdNnUcO.js` | 1.405.737 | `74bc45fea095942a74ca64f31ddd8712ed3143d04b1ad9c7ec25d6eeeb073eac` |
| `/assets/index-Bvfd3nWs.css` | 63.283 | `dc620fc7ac27e80232623c6175381544966f20923b935767027c27b56909cf5d` |

Build log `artifacts/release-final-20260914/build.log` ghi đúng hai asset filenames đó. Summary của đợt build/gate ghi source fingerprint `69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6`. Không có diff hiện tại dưới `src`, `vite.config.ts`, `package.json`, `package-lock.json` tại thời điểm kiểm.

Bundle có marker `employeeSessionVersion` của bản sửa, các endpoint `register_write_operation`/`execute_write_operation` và hostname backend `https://kfqjdfwxhkdwihjobpny.supabase.co`. Chỉ lưu kết quả marker, không lưu hoặc xuất giá trị anon key trong bundle. Phép dò static object-literal runtime mode không thu được literal vì minification; không dựa vào nó để khẳng định mode đang chạy.

## Giới hạn

- URL deployment bất biến trả **302** tới Vercel SSO; không đăng nhập hay vượt protection. Không tuyên bố đã so trực tiếp assets public alias với immutable URL. Chứng cứ nối version gồm provider deployment metadata và byte equality với local build đã biết.
- Không thấy cơ chế build SHA hiển thị trong app từ source đã đọc. Không dùng tên bundle đơn thuần làm bằng chứng: đã hash toàn bộ bytes.
- Đây là request mới không có cookie. Không chứng minh một tab người dùng đã mở từ trước tự tải code mới; tab đó cần reload để lấy HTML/assets mới.
- Không đọc dữ liệu cửa hàng, không login, không gửi RPC, không tạo transaction, không áp migration, không deploy/push.
- Listener local `127.0.0.1:5176` xuất hiện trong lúc root chạy harness; đó không phải URL production. Không dừng hay đổi process.
- E2E timeout còn lại do root điều tra riêng trên DB cách ly. Kết quả này không thay thế E2E hoặc smoke nghiệp vụ production.

## Lệnh và tài liệu máy đọc

```powershell
gh api repos/24tx810010-hcmute/pos-cafe
gh api repos/24tx810010-hcmute/pos-cafe/commits/8ed7418573fe88e27796d3b09807a3c55db4d0d6/status
gh api 'repos/24tx810010-hcmute/pos-cafe/deployments?per_page=20'
gh api repos/24tx810010-hcmute/pos-cafe/deployments/6430265353/statuses
git ls-remote origin refs/heads/main
node artifacts/timeout-followup/reviewer-deployment/audit.mjs
```

`result.json` giữ thời điểm, metadata đã chọn, HTTP headers, asset sizes và hashes. Script chỉ GitHub GET/HTML/static GET; không giữ body bundle. `runtime-markers.json` ghi rõ phép dò runtime-mode không kết luận được.

Nguồn trực tiếp: [frontend](https://pos-cafe-azure.vercel.app), [Vercel deployment](https://vercel.com/24tx810010-hcmutes-projects/pos-cafe/5EPbnzi9DedaLbrjEpmvLbND8tug), [commit](https://github.com/24tx810010-hcmute/pos-cafe/commit/8ed7418573fe88e27796d3b09807a3c55db4d0d6), [GitHub deployment status API](https://api.github.com/repos/24tx810010-hcmute/pos-cafe/deployments/6430265353/statuses).
