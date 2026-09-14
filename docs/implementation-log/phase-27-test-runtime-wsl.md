# Runtime kiểm thử WSL — 2026-09-14

Runtime Linux thay cho PostgreSQL Windows bị Smart App Control chặn ngày 13/09. Không tắt hoặc vượt chính sách Windows. Windows chạy harness Node 24.16.0 và browser trên chính worktree candidate; Ubuntu WSL2 chạy PostgreSQL, PostgREST và GoTrue thật. Không gọi Supabase thật hoặc đọc `.env.local` để chạy test.

## Phiên bản và nguồn

| Thành phần | Phiên bản đã dùng |
| --- | --- |
| Windows | Windows 11 Home, build 26200.9445 |
| WSL / Ubuntu | WSL 2.7.14.0; Ubuntu 24.04.4 LTS, kernel 6.18.33.2 |
| PostgreSQL | 16.15, gói `16.15-1.pgdg24.04+2`, PGDG noble signed APT |
| PostgREST | 16.2, bản Linux static x86-64 chính thức |
| GoTrue | upstream v2.197.0, commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`, không patch |
| Go build | 1.27.1 Linux amd64, `CGO_ENABLED=0` |
| Node | 24.16.0 Windows cho gate; 24.16.0 Linux cho bootstrap |
| Time zones | `tzdata` và `tzdata-legacy`, cùng phiên bản `2026c-0ubuntu0.24.04.1` |

Archive được đối chiếu SHA-256 trước giải nén/thực thi:

| Archive | SHA-256 |
| --- | --- |
| [Node Linux x64 24.16.0](https://nodejs.org/dist/v24.16.0/node-v24.16.0-linux-x64.tar.xz) | `d804845d34eddc21dc1092b519d643ef40b1f58ec5dec5c22b1f4bd8fabde6c9` |
| [PostgREST Linux static 16.2](https://github.com/PostgREST/postgrest/releases/download/v16.2/postgrest-v16.2-linux-static-x86-64.tar.xz) | `4712595baae0f5d84a527d55a11166d6bf4d9b0f1d102505c5e9d59219787f08` |
| [Go Linux amd64 1.27.1](https://go.dev/dl/go1.27.1.linux-amd64.tar.gz) | `63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445` |

Hash binary thực chạy: PostgreSQL `3a089a86625851a42ea1561dcdffa30569c24879c4eb6eb7be9055a72172e431`; PostgREST `35048dacdab509e9233d5abe2f99f6a2ba9e653088b3522e5f0eaefed20c1766`; GoTrue `fc8dca6af8ccb99a816bd5e9085dfdbda741cf0ccedccc5ff4cc455460e668e7`; Node Linux `b2959781cc5a74c357ffa02367efa8a0330cbb1c9cb347732fdfaaaca381cbcd`. Build GoTrue không cam kết tái lập từng byte; cần kiểm commit, source archive, build options và chạy gate lại trên binary mới.

## Tái dựng trên Ubuntu mới

1. Cài WSL và Ubuntu 24.04 bằng `wsl --install -d Ubuntu-24.04 --no-launch`; khởi động lại Windows nếu trình cài yêu cầu. Các lệnh Linux sau chạy trong distro chuyên dụng bằng root. Không tái dùng cluster hoặc chiếm port của dịch vụ khác.
2. Theo [hướng dẫn PGDG Ubuntu](https://www.postgresql.org/download/linux/ubuntu/), thêm signed repository cho `noble-pgdg`. Cài `ca-certificates curl xz-utils git postgresql-common`. Trong `/etc/postgresql-common/createcluster.conf`, đặt `create_main_cluster = false` trước khi cài `postgresql-16 postgresql-client-16`, tránh tạo cluster mặc định. Cài thêm `tzdata tzdata-legacy`. Kiểm `postgres --version` đúng 16.15; nếu gói này không còn sẵn, ghi phiên bản mới và chạy lại toàn bộ gate, không gắn kết quả cũ cho binary khác.
3. Dùng thư mục mới, ví dụ `/var/tmp/pos-cafe-idem-release-20260914`, không có `data/PG_VERSION`. Tải ba archive ở bảng trên, dùng `sha256sum -c`, rồi giải nén. Lấy `git archive 4eee58f296d9698a1c2c0ae14d7a0b379c7622d3` từ checkout `supabase/auth` vào thư mục source mới. Archive phải bỏ qua mọi sửa chưa commit của checkout cũ, đặc biệt patch listener Windows.
4. Trong source GoTrue mới: đặt Go 1.27.1 vừa giải nén vào PATH, `CGO_ENABLED=0`, cache/GOPATH riêng trong runtime; chạy `go build -o ../gotrue .` và `go version -m ../gotrue`. Không áp patch Windows trong [runtime cũ](phase-27-test-runtime.md).
5. Tạo data/socket/log thuộc user `postgres`, mode 700, rồi chạy các lệnh dưới bằng `runuser -u postgres --`. Parent runtime phải cho postgres quyền đi qua thư mục.

```bash
task_runtime=/var/tmp/pos-cafe-idem-release-20260914
install -d -o postgres -g postgres -m 700 \
  "$task_runtime/data" "$task_runtime/socket" "$task_runtime/pglog"
runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb \
  -D "$task_runtime/data" -U postgres --auth-local=trust \
  --auth-host=trust --encoding=UTF8 --no-locale
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl \
  -D "$task_runtime/data" -l "$task_runtime/pglog/server.log" \
  -o "-h 127.0.0.1 -p 55439 -k $task_runtime/socket" -w start
```

Trust chỉ dùng trong cluster test bind loopback. Không dùng cấu hình này cho server phục vụ cửa hàng.

6. Đặt `umask 077`; tạo hai thư mục credential mode 700, `role-bootstrap` và `gotrue-stack`. Tại `/mnt/d/Workspace/pos-cafe`, dùng Node Linux 24.16.0 chạy hai script sau. Script đầu tạo roles và một DB shim riêng; không khởi chạy API hoặc dùng DB shim làm bằng chứng browser. Script thứ hai tạo DB mới có 27 Auth tables, hai tài khoản qua Auth API/password login và 16 migration app.

```bash
IDEM_RUNTIME_DIR="$task_runtime/role-bootstrap" \
  "$task_runtime/node-v24.16.0-linux-x64/bin/node" \
  scripts/idempotency-local-bootstrap.mjs
IDEM_AUTH_RUNTIME_DIR="$task_runtime/gotrue-stack" \
  IDEM_GOTRUE_BINARY="$task_runtime/gotrue" \
  "$task_runtime/node-v24.16.0-linux-x64/bin/node" \
  scripts/idempotency-auth-bootstrap.mjs
```

7. Bootstrap có nhãn provenance lịch sử “Windows single-listener patch”. Với binary Linux sạch này, sửa **artifact runtime** `provenance.json`: `auth.patch=null`, ghi build Linux, exact source commit và lý do sửa nhãn. Không sửa source application chỉ để thay nhãn, và không giữ mô tả patch sai trong báo cáo.
8. Khởi động PostgREST bằng `gotrue-stack/postgrest.conf`, lưu PID/log trong runtime. GoTrue đã do bootstrap chạy tại 55442; PostgREST tại 55443. Kiểm `ss -ltnp` cho ba port PostgreSQL/Auth/REST đều bind `127.0.0.1`.
9. Windows chạy `node scripts/idempotency-local-proxy.mjs 55444 55443 55442` bằng process ẩn, lưu PID/log. WSL localhost forwarding nối proxy tới Auth/REST Linux. Sao chép riêng `gotrue-stack/idempotency.env` vào TEMP của tài khoản Windows, không in hoặc commit nội dung. Đặt `IDEM_ENV_FILE` tới file này và kiểm Auth health qua `http://127.0.0.1:55444/auth/v1/health`.
10. Chạy preflight với `requireBrowserStack:true`, rồi gate theo các lệnh trong runtime cũ. Các suite reset fixture chạy tuần tự. Sau gate, chạy preflight lần nữa, ghi migration checksums, engine, DB name và fingerprint. Chỉ dừng những PID/cluster đã ghi nhận thuộc runtime này; không dừng WSL toàn cục hoặc dịch vụ không liên quan.

## Lỗi môi trường thực gặp và oracle

Lượt contracts đầu ngày 14/09: 427 PASS, 35 FAIL, 0 skipped. PostgreSQL log ghi `time zone "Asia/Saigon" not recognized` (SQLSTATE 22023). Ubuntu mới có `Asia/Ho_Chi_Minh` nhưng thiếu alias `Asia/Saigon`; chưa cài `tzdata-legacy`. Đây là dependency còn thiếu, không sửa timezone fixture hoặc SQL để ép test xanh. [Gói Ubuntu tzdata-legacy](https://packages.ubuntu.com/noble/tzdata-legacy).

Oracle SQL độc lập trước cài tái hiện đúng 22023. Sau cài `tzdata` + `tzdata-legacy` 2026c, query cùng hai instant `2026-09-13 16:59:59+00` và `17:00:00+00` cho cả hai timezone lần lượt trả `2026-09-13 23:59:59` và `2026-09-14 00:00:00`. Không đổi code hoặc fixture giữa hai lần. Giữ raw report lỗi, metadata/options và command log ở `artifacts/release-wsl/failed-attempt-1`; đây là một lượt chạy thất bại có chẩn đoán, không phải test retry được tính pass.

## Giới hạn

DB gate thật: `pos_cafe_idem_test_auth_c5b5ce76d5d3`, engine `postgres-postgrest-gotrue`, API localhost 55444, observer localhost 55439. Storage chỉ có catalog shell để áp baseline migration; không có Storage API hoặc Realtime. Browser dùng print preview; không kiểm máy in vật lý. Runtime WSL không thay bằng chứng sau phát hành trên Supabase managed. Credential test hữu hạn; sau hết hạn cần bootstrap/login mới và preflight lại.
