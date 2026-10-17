# Minh chứng tiến độ phân quyền có thể công khai — 16/10/2026

Đây là bản tóm tắt kết quả thực tế đã có, chuẩn bị cho một mốc lưu tiến độ trên Git. **Chưa push, chưa chạy CI-1 và chưa đủ điều kiện deploy.** Các kết quả bên dưới có phạm vi và nguồn riêng; không cộng chúng thành một full-gate PASS.

## Nguồn và cách kiểm

Code nền: `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs local: `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Cả hai còn thay đổi chưa commit. Manifest kiểm Windows có SHA256 `6cf658ef39fa739f9cf1825f36cb731000839182effef7feee85ef932f9ea2bb`; fingerprint nội dung `8d6704883d7c4c2deb14bb5d97a29fc2f4ac925d9de3059f4df0df16cbd7acf4`.

Ngày 16/10 đã đối chiếu 834 mục của manifest đó: 832 file hiện hữu và 2 deletion markers đều khớp; 1 file `.env.example` không mở nội dung trong lượt này. File mới ngoài manifest không thuộc phép đối chiếu. Đây là kiểm hash/trạng thái tồn tại, **không phải chạy lại test hoặc full-source acceptance**. Nội dung source tương ứng được giữ local; public summary không thay cho raw replay hay backup database.

## Kết quả Windows đã chạy ngày 15/10

Môi trường cách ly Windows, Node 24.16.0/npm 11.13.0, dependency theo npm lock, backend mock. CWD chạy tương đối: bản source kiểm thử. Bảng ghi lệnh thực tế theo receipt, chỉ chuẩn hóa đường dẫn Node/npm đã cài thành tên công cụ.

| Kiểm | Lệnh/điểm vào | Kết quả |
| --- | --- | --- |
| Unit/component | `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | 110 files; 1.173 PASS, 0 FAIL, 0 SKIP; exit 0 |
| Permission tooling | `node node_modules/vitest/vitest.mjs run --config vitest.permission-tooling.config.ts` | 25 files; 489 PASS, 0 FAIL, 0 SKIP; exit 0. Tooling dùng mock, không phải DB thật |
| TypeScript | `node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit --incremental false`; `node node_modules/typescript/bin/tsc --project tsconfig.node.json --noEmit --composite false --incremental false` | Cả hai exit 0 |
| Build mock | `npm run build` | exit 0; cảnh báo kích thước chunk được giữ |
| Smoke mock | `node node_modules/@playwright/test/cli.js test --workers=2 --retries=0` | 81 discovered; 44 PASS, 37 SKIP theo applicability viewport; 0 FAIL, retry 0 |
| UI selftest | `npm run ui-audit:selftest`, trước audit | 23 findings đúng kỳ vọng, `selftest OK`, exit 0 |
| UI audit | `npm run ui-audit`; 16 states × 3 viewports | 0 setup failure; 6 baseline findings được xem ảnh và phân loại false positive; 0 finding mới |

37 smoke skips được công bố nguyên trạng, không nhận 81/81 PASS. Chưa kiểm mọi thiết bị thật/Safari và không suy kết quả mock sang Supabase. [Hồ sơ Windows](permission-windows-verification-2026-10-15.md) giữ giải thích nguồn, lệnh, lỗi trước sửa và giới hạn.

Receipt summary Windows SHA256 `1136a5bcefa62ed12800b009651ee94d4f8a6cee71e20640ea9dbfc69dcef294`. Lượt chuẩn bị tính lại hash của receipt và đối chiếu fields trong bản trích đã lọc. Log SHA được chép từ receipt lịch sử; không đọc/hash lại raw logs trong lượt này. Không đưa raw log hoặc thông tin môi trường bí mật lên Git.

## Worker CI-1 mới ở mức local

Candidate worker `5280f61e419a84a1a0f16f8b79fac5559e3a32529b64c6d8ce04b2482001b327` đã được hai reviewer SEC/EVC duyệt. Lệnh thật: `node --max-old-space-size=512 --test --test-concurrency=8 --test-reporter=tap` với 5 file test intake/worker/source/harness/evidence. Kết quả **33 PASS, 0 FAIL, 0 SKIP**, gồm 15 ca cũ; không cộng thành 48.

Chưa thực thi Linux worker, tải CLI/cache, dựng stack hoặc chạy 4 backend cases T09/T10. Trần Linux 3 CPU/10 GiB RAM/swap 0/2.048 PIDs/volume 18 GiB/30 phút vẫn là cấu hình dự kiến, chưa được quan sát áp dụng trong CI-1 thật. [Hồ sơ worker](permission-ci1-worker-local-2026-10-16.md).

## Supabase — một lượt probe chỉ đọc ngày 16/10

Launcher v2 có **13/13 kiểm local PASS, 0 FAIL, 0 SKIP**, được SEC/EVC duyệt trước lượt online có điều kiện. Probe thật chạy 14:44:14.999–14:44:26.431 UTC, kết quả `ACTOR_SCOPE_METADATA_MATCH`:

| Nội dung đối chiếu | Kết quả |
| --- | --- |
| Store IDs | 79 khớp scope đã duyệt; 0 ngoài scope |
| Auth IDs | 145 = 79 thuộc scope + 66 phải giữ; khớp chính xác; 0 ngoài scope |
| Storage ID/metadata | 3 = 2 thuộc scope + 1 phải giữ; khớp chính xác; 0 ngoài scope |
| Kết nối/giao dịch | TLS xác thực; READ ONLY, REPEATABLE READ; rollback và đóng kết nối được xác nhận |

Candidate actual đã review: `5e32f57857341652da8724322a01eb11e97a0b5f422bde1e917b60e8da3382a9`; receipt actual SHA256 `8b60e08e89f88cf2682aac1c02ddb5c7b6122de9fbb45aabe0f1c2bbae328ba2`. Probe không đọc PIN/token/nội dung đơn hàng hoặc bytes file Storage. Public summary chỉ giữ counts, trạng thái và hashes; không công khai UUID/path/email hay credential.

**Không có DB mutation.** `cleanupEligible`, `fullRowProof`, `payloadProof`, `freshBackupProof`, `liveMutation` đều false. Probe không kiểm lại schema/contract2 và không chứng minh code phân quyền mới đã tương thích online. Lượt probe được cấp đã dùng; bản tóm tắt này không chạy lại. [Hồ sơ actual](permission-protected-runtime-v2-execution-2026-10-16.md) giữ lịch sử, các kết quả UNKNOWN trước đó và hai review.

## Giới hạn và việc tiếp theo

Giữ Tailwind 3; cảnh báo thuộc chuỗi Tailwind 3 không chặn theo quyết định owner, chưa được vá và không phải audit 0. Chưa hoàn tất Linux/full backend gates, chứng nhận hosted profile/control/backup/restore, cutover, hai Edge functions, Storage/Realtime và binding môi trường Production. Trạng thái phát hành: **NOT_READY_FOR_DEPLOY**.

Mốc Git chỉ lưu code/tests/specs và kết quả đúng phạm vi. Nhánh code minh chứng cần được merge vào `main` sau khi đủ gate và có lệnh owner. Nhánh kiến thức `docs` giữ riêng, không merge vào `main`. Chưa tạo nhánh, commit, push, CI, DB write, deploy hoặc xóa dữ liệu trong lượt chuẩn bị này.
