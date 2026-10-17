# Phân quyền — kiểm chứng Windows và đối chiếu Supabase, 15/10/2026

**Windows LOCAL đã được SEC và EVC APPROVE candidate-01; dòng này là metadata review sau freeze. Chưa đủ kết luận push/deploy hoặc Supabase hoạt động đúng code mới.**

## Quyền và thay đổi

[D05/D06/D07/D08](../workflow/tasks/permission-vercel-readiness-plan-2026-10-15.md#plan-d05): giữ Tailwind3/hoãn4, bỏ qua cảnh báo3 khi xét release; giao bản cài/kiểm nhẹ cách ly và sửa riêng [permission-ui-closeout.spec.ts](D:/Workspace/pos-cafe/tests/smoke/permission-ui-closeout.spec.ts:13). Không push/commit/stage, DB mutation, deploy, CI, WSL/Docker hoặc cleanup. Source ứng dụng, SQL, Edge và hai lockfile không sửa; shared node_modules không thay.

Node24.16.0/npm11.13.0 có sẵn; npmci trong `D:/Workspace/pos-cafe-permission-verify/source`, config/cache/temp/evidence riêng, env allowlist mock và không có hosted credentials. Không copy `.env.local`/private raw. Root NTFS private chỉ current user+SYSTEM, không đổi ACL dữ liệu online. Chromium có sẵn được dùng chạy smoke/UI, không tải browser. [Recipe/estimate](../workflow/tasks/permission-deployment-preparation-2026-10-15.md) trình trước cài đỉnh2,5GiB, free≥30GiB C/D và task≤20GiB.

## Source và phục hồi

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; vẫn dirty. Source sau D08 có833file+2deletion markers. [Manifest](D:/Workspace/pos-cafe-permission-verify/source-manifest.json) SHA `6cf658ef39fa739f9cf1825f36cb731000839182effef7feee85ef932f9ea2bb`, content fingerprint `8d6704883d7c4c2deb14bb5d97a29fc2f4ac925d9de3059f4df0df16cbd7acf4`. Khác source đầu đúng1file test; app code không đổi. Source58 cũ là lịch sử, không nhận final tests mới là full source58/backend proof.

[Source archive](D:/Workspace/pos-cafe-permission-verify/evidence/source-final.tar)13.968.384bytes, SHA `db6900407c841d0bbb0382d5802dbfca7fc5a09573dfd6d53baec1fb3ee1d031`; manifest giữ hai deletion markers. Có source cũ/test cũ và log lỗi để phục hồi/đối chiếu. Không coi archive source là raw backup database. [Preservation](D:/Workspace/pos-cafe-permission-verify/evidence/preservation.json) xác nhận main/copy không drift ngoài source D08, HEAD không đổi và39329entries shared modules có fingerprint trước/sau trùng `b03ffa76f22d89c6255f2e8cb0414a8d378633072186d3c11bae0f5b9bf805f2`.

## Kết quả cuối trên source D08

[Summary](D:/Workspace/pos-cafe-permission-verify/evidence/windows-summary.json); các receipt `final-*.json` chứa command/cwd/UTC/exit/source/lock/log SHA. Không gộp với lần fail trước.

| Kiểm | Kết quả |
| --- | --- |
| npmci | exit0,351added/352audited; install trước D08, cùng exact locks/graph, D08 chỉ đổi test không ảnh hưởng install |
| Dependency parity |30/30direct đúng npm lock; Vite8.0.16→rolldown1.0.3, Playwright1.60.0→playwright1.60.0, coverage4.1.11→Vitest4.1.11 đều đúng metadata. Chỉ bản cách ly được sửa môi trường; shared checkout vẫn graph cũ |
| Unit |110files/1173PASS/0FAIL/0SKIP, exit0 |
| Permission tooling |25files/489PASS/0FAIL/0SKIP, exit0; mocked tooling, không DB/WSL/Docker thật |
| TypeScript | app noEmit/incrementalfalse và node noEmit/compositefalse/incrementalfalse đều exit0 |
| Build | npmrunbuild=`tsc -b && vite build`, exit0; mode mock. Chunk1,51MB warning giữ nguyên, không gọi thành build failure hoặc production binding |
| Mock smoke |81discovered,44PASS/37SKIP/0FAIL, retry0, exit0. Skips là applicability theo viewport, không skip lỗi để gọi đủ backend gates |
| UI selftest |23findings,`selftest OK`, exit0 trước audit |
| UI audit |16states×3viewports,0setup failures,6baseline findings/0mới, exit0; đã đọc report và mở4ảnh |

37smoke skips gồm31applicability cũ +2ca nghiệp vụ không chạy ở portrait +4ca rotate riêng portrait không chạy ở landscape. Hai ca employee/payment vẫn giữ toàn assertions trên4viewport ngang; thêm một ca portrait chuyển ngang→dọc→ngang, xác nhận guidance hiện/POSẩn rồi POS hiện/guidanceẩn. Thiết kế landscape-first/portrait rotate đã có tại [docs context:17](../ui-redesign-context.md:17), [AppShell:42](D:/Workspace/pos-cafe/src/app/shell/AppShell.tsx:42); không đổi support contract hoặc tự nhận thiết bị thật/Safari đã kiểm. [Discovery81cases](D:/Workspace/pos-cafe-permission-verify/evidence/final-smoke-discovery.json) giữ test/project list.

Audit npmci vẫn báo7package findings/2root advisories Tailwind3, không auditfix/override/nâng4 hoặc che báo cáo. Theo D06 chúng không chặn phát hành; không nhận audit0/đã vá. Không tạo lịch tự nâng/monitor.

## UI findings đã phân loại

[Report](D:/Workspace/pos-cafe-permission-verify/source/ui-audit/report.md), [ảnh annotated](D:/Workspace/pos-cafe-permission-verify/source/ui-audit/out/floor__mobile.png). Cả6 ở state `floor`, viewport mobile. **0real defect,6false positive**: compact rail chủ đích dùng `sr-only` cho chữ, icon/accessible labels còn; [LeftNav:49](D:/Workspace/pos-cafe/src/app/shell/LeftNav.tsx:49) và [RailButton](D:/Workspace/pos-cafe/src/app/shell/RailButton.tsx) là nguồn style/accessible name. Không chỉ suy từ baseline; đã mở ảnh đo và3ảnh forced-PIN không finding. Không update baseline.

| Selector/nhãn trong report | Đo | Phân loại |
| --- | --- | --- |
| nav group span,`VẬN HÀNH` clipped-text |61px→1px,rect1×1 |FP: sr-only heading |
| session strong,`Chủ quán` |17px→0px tall |FP: sr-only employee detail |
| session span,`CHỦ QUÁN` |15px→0px tall |FP: sr-only role detail |
| nav group span,`VẬN HÀNH` vertical |15px→1px tall |FP: cùng heading |
| RailButton text span,`Bàn` |17px→1px tall |FP: compact icon label |
| lock RailButton text span,`Khoá` |17px→1px tall |FP: compact icon label |

## Lịch sử lỗi và sửa thực tế

- Tooling đầu475PASS/14FAIL vì task runner trỏ Git tới đường dẫn không tồn tại. Sửa PATH sang Git sẵn có `D:/Git/cmd`, full rerun489PASS. Không sửa test/app cho lỗi setup đó; raw log/receipt đầu giữ nguyên.
- Smoke đầu43PASS/2FAIL/31SKIP vì beforeEach đòi floor visible ở portrait, trong khi app đúng contract hiển thị rotate guidance. D08 cho sửa1file và thêm portrait regression. Giữ source/test/log lỗi trước; không ghép counts giữa hai source. Artifact test-results có thể được Playwright thay ở lần chạy tiếp; không claim giữ toàn bộ artifact per-test cũ.
- Lần `final-ui-audit` bị runner ENOENT khi monitor đọc thư mục profile vừa được Chromium dọn, không có final receipt, không nhận PASS. Dừng đúng VitePID45368 thuộc owned root/port5178 còn sót; sửa monitor chỉ bỏ ENOENT của thư mục/file biến mất và giữ thresholds. `final-ui-audit-recheck` chạy đầy đủ cùng source đạt; [failure record](D:/Workspace/pos-cafe-permission-verify/evidence/runner-monitor-failure.json) và partial log giữ nguyên. Các helper revisions đã lưu; receipt mỗi bước có helper SHA khi đã hỗ trợ, không giả một helper duy nhất.

## Supabase mới qua MCP chỉ đọc

[Query file](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/online-contract-queries.json), [receipt](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/online-contract-readonly.json), [summary](D:/Workspace/pos-cafe/artifacts/permission-readiness-plan-20261015/next-local-slice/online-contract-summary.json). Lượt bắt đầu03:24:50UTC15/10:6SELECT, target `kfqjdfwxhkdwihjobpny`, actor `supabase_read_only_user`, transaction_read_onlyon. Dùng MCP RO đã cấu hình/DPAPI credential sẵn có, không in token. Query chỉ metadata, không gọi routine nghiệp vụ hoặc đọc row payload.

Kết quả:0routine `permission_*`,18app/private tables legacy; employees chưa các cột PIN/revision mới; chỉ bucket public `menu-item-images`, chưa staging; publication12bảng legacy, chưa2signals. Do [authRepo:29](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:29) yêu cầu permissioncontract2/write1, **backend hiện chưa đáp ứng frontend mới**. Không claim migration history/Edge/settings/full-row equality/backup đã kiểm trong6SELECT này. Parser summary đã phải sửa để unwrap JSON result và lấy data boundary đúng; các lỗi parse local không là query fail hoặc lần probe mới.

Gói backend input vẫn là prepare riêng +017/10activation fragments +2Edge/shared +Storage/signals, không chỉ017. No-DB ngăn apply trong phạm vi hiện tại; chưa có quyền capture/backup/cutover/deploy.

## Dung lượng, tiến trình và phần chưa làm

Install peak rounded file bytes336.261.120; peak quan sát lớn nhất các lượt Windows440.123.392 (~420MiB), thấp hơn estimate2,5GiB; đây là file lengths rounded4096, không phải allocated bytes/hardlink/OSquota. Free checkpoint sau chạy: C205.707.984.896bytes/D103.676.628.992bytes, vẫn≥30GiB; không quy mọi delta ổ cho task. Timer kiểm mỗi3s/free30GiB, dừng install2,5GiB/other steps3GiB là guard tiến trình, không quota kỹ thuật. Source archive14MB đã tính trong owned data sau checkpoint.

Không có server nghe5175/5178 hoặc process node/chrome command line thuộc owned root tại kiểm sau cùng. Project Playwright tự đóng; chưa dùng Playwright MCP. Runtime/source/evidence giữ private để review/tái kiểm, chưa dọn/xóa. Không tạo môi trường thứ hai hoặc cài Node/browser/WSL/Docker.

**Chưa chạy:** full PIN19/PERM60 service/SQL/browser, HP1 actual fresh/full gates, CI Linux, hosted C/Storage/L/backup/restore/cutover, Edge deploy và Vercel env/build/deploy/postflight. Windows PASS không đóng các gate đó. Bước tiếp theo là chuẩn bị fresh Linux/profile/bootstrap/private retention và hosted capability/release package; mọi push/hosted mutation cần exact scope/lệnh riêng. [Review Windows](../reviews/2026-10-15-permission-windows-verification.md) chỉ duyệt slice này; walkthrough test/contract đã giải thích, chưa nhận owner đã nghiệm thu toàn sản phẩm.
