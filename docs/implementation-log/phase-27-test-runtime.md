# Tái dựng môi trường kiểm thử cục bộ

Ngày 2026-09-10. Phạm vi: Windows x64, PostgreSQL + PostgREST + GoTrue thật. Môi trường này phục vụ các test của phase 27, không phải cấu hình triển khai cửa hàng.

## Thành phần đã dùng

| Thành phần | Phiên bản / nguồn |
| --- | --- |
| Node | 24.16.0; dependencies theo `package-lock.json` của code candidate |
| PostgreSQL | 16.15, cổng 55439, chỉ bind `127.0.0.1` |
| PostgREST | 16.2, cổng 55443; binary SHA-256 `3b407139d0f5ed223bed5cb1a161d27efed6f0fb04705fa9507249a989f7143a` |
| GoTrue | v2.197.0, repository `supabase/auth`, commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`, cổng 55442 |
| Go | 1.27.1, `CGO_ENABLED=0`, Windows/amd64 |
| Proxy test | `scripts/idempotency-local-proxy.mjs`, cổng 55444, chuyển tiếp Auth/REST và CORS cho browser |

GoTrue binary đã chạy suite có SHA-256 `6a6442fd59912419509d8d6e929b487446f218e329428198ab81d5a783747a1e`. Đã build lại thành công từ checkout đã kiểm bằng lệnh bên dưới; binary build lại có SHA khác (`812c5bf7d78860bd60f3f27a2f54a83f14349e0f38476eee6507f571094e45c4`). Không tuyên bố build tái lập từng byte: build có metadata/path/cache của môi trường. Xác minh provenance bằng commit, diff duy nhất, `go version -m`, rồi chạy lại suite trên binary mới.

## Patch duy nhất của GoTrue

`git diff --stat` của checkout upstream chỉ có `cmd/serve_cmd.go`: 3 dòng thêm, 13 dòng xóa. API, JWT, Auth schema và migrations không sửa. Windows dùng một listener; không dùng tùy chọn Unix `SO_REUSEPORT`.

```diff
diff --git a/cmd/serve_cmd.go b/cmd/serve_cmd.go
index bad35b7..21857b9 100644
--- a/cmd/serve_cmd.go
+++ b/cmd/serve_cmd.go
@@ -8 +7,0 @@ import (
-	"syscall"
@@ -11 +9,0 @@ import (
-	"golang.org/x/sys/unix"
@@ -186,11 +184,3 @@ func serve(ctx context.Context) {
-	lc := net.ListenConfig{
-		Control: func(network, address string, c syscall.RawConn) error {
-			var serr error
-			if err := c.Control(func(fd uintptr) {
-				serr = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1) // #nosec G115
-			}); err != nil {
-				return err
-			}
-			return serr
-		},
-	}
+	// Local Windows test build: one listener, without Unix SO_REUSEPORT.
+	// Authentication, signing and migrations are the upstream release code.
+	lc := net.ListenConfig{}
```

Lưu diff này thành `windows-listener.patch`, checkout đúng commit upstream rồi `git apply --unidiff-zero --check` và `git apply --unidiff-zero` (diff không có dòng context). Không áp patch vào một phiên bản khác rồi coi là cùng bằng chứng.

```powershell
# Chạy trong checkout supabase/auth đã ghim đúng commit và áp patch trên.
$env:CGO_ENABLED = '0'
$env:GOOS = 'windows'
$env:GOARCH = 'amd64'
go build -o ../gotrue-v2.197.0.exe .
go version -m ../gotrue-v2.197.0.exe
Get-FileHash -Algorithm SHA256 ../gotrue-v2.197.0.exe
```

## Chuẩn bị database và dịch vụ

1. Dùng một thư mục runtime mới, tách khỏi repo và dữ liệu PostgreSQL có sẵn. Đặt PostgreSQL portable vào `postgresql/pgsql`, PostgREST vào `postgrest`, GoTrue đã build ở thư mục gốc. Khởi tạo cluster mới bằng `initdb`, user `postgres`, locale `C`, encoding UTF8. Chỉ dùng trust auth cho cluster test bind loopback; không dùng cấu hình này cho máy phục vụ thật.
2. Khởi động cluster trên `127.0.0.1:55439`; kiểm port đang dùng đúng cluster riêng trước khi tiếp tục. Thêm `postgresql/pgsql/bin` vào PATH để PostgREST nạp `libpq.dll`.
3. Trong worktree code candidate, đặt `IDEM_RUNTIME_DIR` tới runtime mới và chạy `node scripts/idempotency-local-bootstrap.mjs`. Script tạo DB tên ngẫu nhiên có tiền tố test, cài các role test và môi trường SQL/API có Auth shim. **DB này chỉ dùng kiểm SQL, không dùng làm bằng chứng E2E.**
4. Đặt `IDEM_AUTH_RUNTIME_DIR` tới một thư mục mới như `gotrue-stack`, `IDEM_GOTRUE_BINARY` tới binary đã xác minh; chạy `node scripts/idempotency-auth-bootstrap.mjs`. Script tạo một DB test khác, chạy migrations GoTrue thật + 16 migrations app, tạo hai user bằng Auth API và xác minh password login, rồi sinh `idempotency.env`, `postgrest.conf`, `provenance.json`. Script tự từ chối nếu GoTrue cổng 55442 đã chạy; không dừng process lạ để chiếm port.
5. Khởi động PostgREST bằng file config vừa sinh, sau đó proxy với đối số `55444 55443 55442`. Dùng `Start-Process -WindowStyle Hidden` khi chạy nền Windows và lưu PID/log vào thư mục runtime để quản lý đúng process. Không in nội dung env/config: chúng chứa credential test.
6. Đặt `IDEM_ENV_FILE` tới `gotrue-stack/idempotency.env`. Chạy các lệnh bên dưới tuần tự. DB contracts, tools và E2E cùng reset hai fixture nên không được chạy đồng thời trên cùng instance.

```powershell
npm run test:idempotency:discover
npm run test:idempotency:unit
npm run test:contracts
npm run test:idempotency:tools
npm run test:idempotency:e2e
npm run test:idempotency:verify-results
npm run build
npm run test:coverage
npm run smoke
```

Preflight phải kiểm tên DB, loopback, marker, mọi migration checksum, caller role, quyền hook và bằng chứng API/observer cùng instance bằng employee token hash cấp/thu hồi thật. Lỗi preflight không được bỏ qua bằng đổi sang mock hoặc bỏ testcase. `smoke` cuối là suite hồi quy mock riêng, không thay các lượt DB/E2E phía trên.

## Giới hạn tái lập

Binary/hệ điều hành và dữ liệu fixture phải được ghi lại cho mỗi lần chạy. Các lệnh bootstrap luôn tạo DB mới; không cung cấp bước dọn tự động hoặc sửa DB thực. Credential test chỉ có hiệu lực hữu hạn; cần bootstrap/login mới khi hết hạn, không nới kiểm tra phiên để tái dùng report cũ.

Runtime native không có Storage API hoặc Realtime service. Schema storage tối thiểu chỉ giúp áp migrations nền; không giả đây là một bộ Supabase cloud hoàn chỉnh. Native SQL reviewer dùng Auth shim được báo tách khỏi browser E2E qua GoTrue thật. Các test delay/clock/fault có seam riêng chỉ trong DB đánh dấu test, không cung cấp RPC chỉnh giờ/gây lỗi cho ứng dụng.
