# Nhật ký CLOSE-2 source-31 — 13/10/2026

## Dữ liệu và phép đo

- Snapshot source31 `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`, 810 file hiện diện + 2 deletion marker, main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`.
- Test T09 trên nguồn trước có hai lỗi đo lường: 401 do platform chặn thiếu JWT không có `no-store`; function public local mặc định yêu cầu JWT. Chuyển probe 401 sang JWT hợp lệ/thiếu employee token, khai báo `verify_jwt=false` cho public function trong `tests/permissions/runtime/identity.toml`. T09 trên T04 source31 PASS, gồm missing Storage thường/conditional 503/no-store. App/SQL/Edge giữ nguyên so với source26.
- Tạo T04 `pos-cafe-perm-s31-t04-20261013` (62421/62422), T02 `pos-cafe-perm-s31-t02-20261013` (63421/63422), T01 PostgreSQL native port 55460 trong root mới. Các target cũ source28 giữ volume; không reset chúng. T04 seed 3 bucket/6 object qua Storage API, đọc lại 6/6, lưu dump `pg_dump -Fc` và tar Storage trước PERM60 (2 Auth/2 store/3 bucket/6 object).
- PERM60 27 report cùng nguồn: 8 stage Windows, 19 stage WSL; 60 case/726 variant strict PASS. T01 legacy 30/30 đọc không đổi bảng/catalog; T02 52/52 + 52/52 + 4/4; T04 candidate, Realtime, E2E, rollback, transition, compatibility PASS. `aggregate-result.json` SHA-256 `3a966577895c7da013de7d2566ce5a3090e6671264fb515cd40563f4442d9e5d`, 27 report copy từ WSL/Windows đều khớp SHA. Bảo toàn Storage metadata 3/6 và payload 6/6 byte-hash. Edge runtime ba file khớp nguồn.
- Focused TC47 origin: revoke/grant `service_role EXECUTE` trên lookup RPC trong T04; GET và conditional 503/no-store `IMAGE_GATEWAY_UNAVAILABLE`, trước/sau 404, ACL và ảnh/rows không đổi. Receipt `gateway-fault-01.json` SHA-256 `6d4b46c04d33d689c4ab81e4df08dbfa6d4fd01260318ed217363063348b27dd`.

## Attempt và sửa bằng chứng

1. Source28 T09 dừng ở 401 platform; source29 dừng ở 401 public function. Hai attempt không PASS; source31 sửa test/config rồi T09 1/1 trên runtime thật.
2. T04 source31 đầu tiên: Realtime 3 assertion PASS nhưng cleanup catalog drift; reset fixture mới thì stage PASS. Aggregate từ hai fixture candidate bị `CANDIDATE_BACKEND_MIXED`; giữ các report trong `private/mixed-binding-attempt01`, chạy lại đủ 19 stage T04 trên một fixture candidate thống nhất, reset chỉ sau candidate cho rollback/transition.
3. Aggregate lần sau phát hiện interval transition kéo dài giả do runner đọc `birthtime` của `run.stdout` cũ. Giữ log/report cũ, chạy lại transition database trên fixture mới với file log mới và attestation interval thật. Aggregate cuối `valid=true`, service suite không overlap. T01 đã chạy lại trên cùng DB chỉ đọc sau T02/T04 lần đầu để loại overlap của attempt trước; snapshot trước/sau exact.

## PIN19 và TC47 browser nguồn cuối

- Browser onboarding 48/48 trên target `pos-cafe-perm-s31-onboard-20261013` (gồm 47 ca gốc và thêm PERM29), không skipped/retry/expected failure. Verifier ban đầu khóa 47 nên tạo receipt `valid=false` dù raw 48 PASS; verifier sau kiểm đúng 48, giữ cả hai receipt. TC18 wrapper 7/7, 20 scenario, 48 artifact đã quét, control file xóa.
- SQL identity target riêng: lần đầu 41 assertion PASS nhưng hook `IDENTITY_CATALOG_DRIFT`; lần hai 41/41 với hook 0, không skip/retry. Canary target mới từ DB 17 migration/0 tenant được đưa về baseline16 trước phép thử, TC19 1/1 PASS. Backup sau test đọc được: 67 Auth, 1 store, 1 object, `pg_dump -Fc` và Storage tar SHA giữ. Cả onboarding, identity và canary dừng, volume còn.
- Unit1173/1173, tooling 10 nhóm/110 test, build, hai typecheck, operator browser2/2. UI selftest OK rồi audit16 trạng thái ×3 viewport: 6 finding cũ rail mobile (đã mở ảnh chú thích), 0 mới, màn PIN 0.
- TC47 mock browser source31 1/1: GET ảnh 503/no-store → placeholder nhưng giỏ, gửi đơn, thanh toán và receipt vẫn hoạt động. TTL 59/60/61 nguồn26 là bằng chứng lịch sử; Edge public source31 có cùng SHA `65111eb092aa247413389631c2a862c8404a73774f9d6bee0d74f81c9587cf3e`. Không suy kết quả này thành CDN/provider hosted.

## Provenance restore tái dùng

Candidate source31 dẫn [candidate-04 CLOSE-2 source25](../workflow/tasks/permission-close2-source25-2026-10-13.md) làm bằng chứng **lịch sử** cho restore thực: `pg_restore` backup hosted 28/09 vào clone mới và so 74/74, `pg_dump -Fc`/`pg_restore` K/payload/result fixture T04 nguồn25 sang DB cô lập khác (2/2), Storage API restore/readback 2/2 object 814.829 byte rồi cleanup bucket tạm; metadata/payload ngoài scope được đối chiếu. [Log nguồn25](permission-close2-source25-2026-10-13.md) giữ các hash và FAIL trước khi sửa ACL/socket. Đây không phải phép restore source31 hoặc backup live fresh; hai phép DB và Storage chạy trên runtime khác nhau, không chứng minh phục hồi toàn bộ hosted Supabase trong một lần. Không dùng proof nguồn25 thay cho PIN19/PERM60 source31 hoặc quyền release/controller exact77 ở CLOSE-3.

Không có lệnh stage/commit/push/deploy/reset/stash/switch nhánh trên checkout. Các PG/Docker target source31 là mục tiêu test mới có tên/port riêng. T04, T02, T01 và ba target PIN đã dừng sau phép đo, DB/Storage volume giữ. CLOSE-3 chưa bắt đầu.

## Addendum review cuối

SEC và EVC `APPROVE` cùng `candidate-final-03.json` SHA-256 `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492`, theo [biên bản](../reviews/2026-10-13-permission-close2-source31.md). SEC-01 về hash TC18 và EVC-01 về checkpoint/provenance tài liệu đã đóng qua candidate-final-02 rồi -03. Snapshot docs trong candidate giữ trạng thái trước verdict; phần này chỉ ghi metadata review. CLOSE-2 local readiness đã qua cổng; hosted/release/owner acceptance và CLOSE-3 chưa làm.
