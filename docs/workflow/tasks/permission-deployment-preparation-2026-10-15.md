# Chuẩn bị phân quyền cho Supabase và Vercel — 15/10/2026

**Windows L0/L1 đã được SEC/EVC APPROVE theo D07/D08; unit1173/tooling489/2tsc/build đạt, smoke44PASS/37viewportSKIP, UI48checks không lỗi mới. Supabase/Vercel chưa đủ deploy. Recipe/estimate phía dưới giữ mốc trước thực hiện; dòng này là metadata review sau freeze.**

## Mục tiêu, quyết định và quyền

Chủ dự án yêu cầu giữ Tailwind3, hoãn4 và ưu tiên hoàn thành phân quyền đủ deploy Vercel, Supabase chạy đúng code mới. [PLAN-D05/D06](permission-vercel-readiness-plan-2026-10-15.md#plan-d05) giữ nguyên lời xác nhận. Owner cho bỏ qua cảnh báo Tailwind3; hai advisory hiện có/7package findings vẫn báo trung thực nhưng không còn là blocker hoặc lý do chờ upstream. Không biến quyết định này thành audit0 hoặc chứng minh không có exploit. D04 Windows trước + CI có điều kiện/free, coverage/privacy/ngân sách không đổi; chưa biết thiết bị thực cần hỗ trợ.

Giữ no-push, no-hosted-mutation/deploy và no-delete. Sau [D07](permission-vercel-readiness-plan-2026-10-15.md#plan-d07) đã cài/chạy Windows; [D08](permission-vercel-readiness-plan-2026-10-15.md#plan-d08) cho sửa riêng một smoke test, không sửa ứng dụng. Có6SQL metadata SELECT mới qua MCP read-only; không dump/capture payload. Không mở WSL/Docker/CI/nâng4. [Kết quả, lỗi setup đã sửa và phần chưa chạy](../../implementation-log/permission-windows-verification-2026-10-15.md) là nguồn hiện hành, không đọc các câu NOT_RUN trong recipe freeze thành trạng thái hiện tại.

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; worktrees dirty, không stage/commit/reset/stash/switch. Evidence: `D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/`.

## Điều đã xác minh từ source — không viết lại tính năng

| Thành phần | Hiện có / phần còn phải đóng |
| --- | --- |
| Frontend | [authRepo.ts:29](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:29) yêu cầu permissionContractVersion2/writeProtocol1; [client.ts:23](D:/Workspace/pos-cafe/src/adapters/supabase/client.ts:23) gửi marker2. Audit online15/10 thấy backend legacy; đây là quan sát tại mốc audit, chưa probe mới trong lượt này |
| SQL | [activation order:4](D:/Workspace/pos-cafe/scripts/permission-activation-bundle.mjs:4) gồm017+10candidate fragments. Candidate thứ11 là compatibility-prepare chạy riêng trước; [prepare:22](D:/Workspace/pos-cafe/scripts/permission-compatibility-prepare.mjs:22), [hook prerequisite:30](D:/Workspace/pos-cafe/scripts/permission-activation-steps.mjs:30). Chỉ dbpush017 không đủ |
| Images/Storage | Hai Edge Functions + [shared module](D:/Workspace/pos-cafe/supabase/functions/_shared/menuImageHttp.ts), SQL private staging và policies tại [permission-images.sql:4](D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:4). Chưa có production config/binding được chứng minh; không tự suy local test verify_jwt thành deployed config |
| Realtime | [permission-signals.sql:76](D:/Workspace/pos-cafe/supabase/candidate/permission-signals.sql:76) thay raw publication; [permissionSignalPort.ts:59](D:/Workspace/pos-cafe/src/adapters/supabase/permissionSignalPort.ts:59) dùng minimal signals. Cần SQL/service/frontend cùng contract |
| Hosted recovery/control | [certified profiles:6](D:/Workspace/pos-cafe/scripts/permission-hosted-profile.mjs:6) rỗng; [dispatch:18](D:/Workspace/pos-cafe/scripts/permission-backup-dispatch.mjs:18) thiếu external trust và từ chối action. Đây là guard đúng, không xóa/bypass để đạt deploy; cần slice provider/profile/control đủ bằng chứng |
| Vercel | [vercel.json:4](D:/Workspace/pos-cafe/vercel.json:4) là npmci→build→dist. [Inventory07/10](../../implementation-log/vercel-binding-inventory-2026-10-07.md) là lịch sử: Git auto deploy/domain và env Secret có tên nhưng binding giá trị chưa xác minh; cần fresh read-only kiểm trước push. Không coi mock build là build trỏ đúng Supabase |

[deployment-inputs.json](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/deployment-inputs.json) pin25file/552365bytes: prepare1, activation11(kể017), Edge2+shared1, frontend/build references10. Đây là **inventory đầu vào chọn lọc**, không bao gồm toàn bộ source/test, dữ liệu/actor/env/settings/manifest ID và không phải gói release có quyền chạy.

## Tailwind3: cảnh báo được bỏ qua, bằng chứng source có giới hạn

Lock ghi3.4.19→braces3.0.3 và parser6.1.4. [Content config:5](D:/Workspace/pos-cafe/tailwind.config.ts:5) chỉ index.html/src, [PostCSS:3](D:/Workspace/pos-cafe/postcss.config.js:3) dùng build plugins; plugin POS local tĩnh. Không thấy import các parser/glob trong source app/Edge tại lượt đọc này. Chưa có module graph bundle cuối hoặc fresh metadata chính sách PR/fork/secrets; không nhận source search là proof bundle. [Parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) phân biệt trusted-source build và request parsing không tin cậy; [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ghi rủi ro DoS với mẫu sâu. D06 là quyết định của owner cho không chặn, không phải claim đã vá. Không cần tự dựng lại blocker chờ risk acceptance cho cùng cảnh báo đã được owner chốt.

## Recipe Windows đã được giao theo D07 — bản thiết kế trước lượt chạy

### Phạm vi và vị trí

Một bản Windows cách ly tại **`D:/Workspace/pos-cafe-permission-verify`** (chưa tồn tại tại precheck), source/cache/output riêng. Dùng Node24.16.0/npm11.13.0 đã có tại `D:/tools/nodejs`; npm lock SHA `85969c1c161f74e9f68563182d99d1b0ac6fb5f17f5074444f329675ffd34e18`. Không tải Node/npm mới, browser, Docker hoặc WSL. Chromium1223 trên C đã có; existence không thay launch proof. Giữ nguyên shared node_modules hiện có (38434file,422114450bytes logic); không backup thêm bản modules khác, không tạo attempt/runtime thứ hai. Chỉ một môi trường Windows được dùng cho lượt này; kiểm lại budget trước mọi thay thế.

Source copy phải từ allowlist hiện hành có hash/bytes đầy đủ, chứa test/config và deletion markers; không dùng inventory25file làm toàn bộ snapshot. Không copy `.git`, node_modules, artifacts, `.env.local`, credential hoặc private raw. Chỉ `.env.example` là ví dụ công khai. Đặt npm user/global config rỗng và cache riêng trong owned root; dùng exact registry lock, không nâng graph/auditfix/override. Test cần Git metadata thì chỉ đọc Git qua GIT_DIR/GIT_WORK_TREE và GIT_OPTIONAL_LOCKS=0, không dựng commit để giả provenance.

### Ước tính trước cài

**LỚN HƠN 1 GB — đỉnh tăng dự kiến tối đa cho bước cài được lập kế hoạch là2,5GiB (2.684.354.560bytes), trên ổD.** Đây là ước tính thận trọng và điểm dừng vận hành; không phải quota filesystem đã bật.

| Khoản | Ước tính / căn cứ |
| --- | --- |
| Download install mới |150–650MB decimal; chưa tính1.040.373bytes metadata +252.332bytes archive đã đọc trong RAM và ghi receipt nhỏ. Không dựa cache shared để giả không tải |
| Tăng giữ lại sau cài (modules+cache+source) |0,5–1,5GB decimal; số package Windows thường ít hơn tổng all-platform |
| Đỉnh khi tải/cache/giải nén |2,5GiB trên D, gồm source nhỏ, tar/cache/temp và modules, rounding/metadata dự phòng; không bao gồm dựng full stack hoặc tải browser |
| Dữ liệu nguồn để ước tính | Lock382entries/378unique versions. Registry cung cấp size/fileCount cho phần lớn; 19entry thiếu được kiểm bounded trong RAM và đối chiếu lock integrity. Tổng content all-platform đã biết + tar padded của19gói là586.816.744bytes, cố ý tính cả platform không cài Windows;19074files là phần có metadata, không phải tổng số file cài thực |
| Hooks có thể tải thêm | Chỉ hai fsevents install hooks cho macOS theo lock/registry; không eligible trên Windows x64. Nếu phát hiện hook/OS/graph khác dự kiến phải dừng và đánh giá lại, không tải tiếp |
| Free tại checkpoint | C205.877.202.944bytes (~191,74GiB), D104.086.749.184bytes (~96,94GiB), NTFS4096bytes/cluster. Đo lại ngay trước cài; giữ≥30GiB C/runtime, task tổng tăng≤20GiB |

Receipts: [registry metadata](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/registry-size-metadata.json), [19archive check](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/missing-package-size-check.json), [estimate](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/windows-install-estimate.json). HEAD thiếu Content-Length; số0 ban đầu trong HEAD receipt là UNKNOWN đã có correction, không dùng làm archive0bytes. Measurement mới thành công sau một lệnh PowerShell parse lock thiếu -AsHashtable; output lỗi đầu không dùng làm dữ kiện. Inventory deployment thử lần đầu dùng sai tên shared module và thoát ENOENT, chưa ghi inventory; lần sau dùng đúng `menuImageHttp.ts`, không nhận lần lỗi là PASS.

Chưa có enforcement kỹ thuật cho2,5GiB hoặc quota20GiB. Khi thực hiện phải đo trước/sau install và trước từng suite; dừng nếu vượt estimate/guard hoặc xuất hiện download ngoài phạm vi. Build/browser/report growth chưa đo mới: trước bước đó cần dự trù riêng trong20GiB, không mặc nhiên coi2,5GiB cài là tổng full gates. Không auto retry/new runtime. Sau checkpoint hỏi dọn đúng owned temp/cache/output được tái tạo, nêu số đo; chưa có quyền xóa nhóm này hoặc dữ liệu cũ.

### Sau khi có lệnh

1. Kiểm fresh nguồn/lock/disk/đích mới, tạo source snapshot/receipt và env allowlist không chứa hosted secret. npmci đúng lock trong owned root; giữ shared checkout nguyên trạng. Kiểm graph/lock sau cài; audit ghi theo D06.
2. Với budget output đủ, chạy unit/pure tooling/2tsc/build mock và mock smoke. Tooling nào có process/browser/backend dependency phải phân loại trước, không gọi toàn bộ là pure. Build mock chỉ chứng minh frontend cài/build được, không chứng minh Vercel/Supabase binding.
3. UI: selftest23→audit→đọc report→mở ảnh→phân loại; không update baseline. Không giảm expected/coverage để PASS. Bất kỳ sửa ứng dụng hoặc tooling theo finding phải đúng scope phân quyền đã giao; hiện chưa có finding mới hoặc sửa code.
4. Gói source/locks/recipe/receipts theo fingerprint mới, hai review độc lập; không nhận Windows checks thành PIN19/PERM60/full stack hoặc hosted proof.

## Thứ tự để đạt mục tiêu deploy

L0 đã lập input inventory/estimate/recipe. L1 là Windows đúng lock và kiểm nhẹ khi được giao. L2 là CI-0 đo thật rồi CI-1 bootstrap fresh synthetic/portable profile/private retention, sau đó full HP1/PIN19/PERM60 cùng source/backend và27stages theo [kế hoạch](permission-vercel-readiness-plan-2026-10-15.md); giữ CI free/guard, không tự đổi ngưỡng hoặc push workflow. H0 khảo sát chỉ đọc provider/actor/C/Storage/L/Edge/Vercel có thể chạy trước full runs. H1 chỉ implementation certified profile/trust/control khi matching capability đủ và scope được giao; không gỡ guard. R0 là gói backend trước frontend và recovery tương thích để owner duyệt exact actions. No-DB hiện ngăn prepare/activation/schema/grants/publication; no-deploy ngăn Edge/frontend publish; no-push ngăn Git workflow và tránh Vercel tự cập nhật. Chưa chứng nhận live Supabase/Vercel đúng.

## Bước tiếp theo và giới hạn bàn giao

Owner đã giao và Windows đã thực hiện tại đúng owned root, chi phí phần mềm0đồng; kết quả/runs/recovery ở [log Windows](../../implementation-log/permission-windows-verification-2026-10-15.md). Không hỏi lại D06/D07/D08. Phần tiếp theo là chuẩn bị CI/Linux/full backend và hosted capability trong quyền được giao; không dùng quyền Windows hoặc mục tiêu chung làm quyền push/CI/hosted action/cleanup. Shared modules vẫn giữ nguyên; chỉ một file test đã đổi theo D08. Runtime còn được giữ phục vụ review/tái kiểm, chưa có quyền dọn.

Review hiện hành lưu trong [biên bản kế hoạch](../../reviews/2026-10-15-permission-readiness-plan.md), khác product approval. Walkthrough có thể đi theo frontend contract→SQL prepare/order→Edge/Storage→signals→hosted guard; chưa nhận owner đã đọc/hiểu/nghiệm thu.
