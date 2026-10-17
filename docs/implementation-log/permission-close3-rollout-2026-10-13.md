# CLOSE-3 quyền/cấu hình rollout — bằng chứng 13/10/2026

Kết quả **PARTIAL/BLOCKED** trong phạm vi [bàn giao](../workflow/tasks/permission-close3-rollout-2026-10-13.md). Tất cả hosted actions chỉ đọc; compile/package chỉ local. [Runbook mới](../runbooks/permission-controlled-rollout-2026-10-13.md) bổ sung runbook08/10; không sửa lịch sử proof FAIL hoặc cấp quyền release.

## Quan sát mới

Artifact root `D:/Workspace/pos-cafe/artifacts/permission-close3-rollout-20261013` (gọi tắt A). Mỗi AX receipt có `observedUtc` riêng và raw private tương ứng; không gán cùng thời điểm cho mọi trang. Emails được thay bằng `[REDACTED_EMAIL]` trong A. Không đọc browser cookies/storage/hidden app state; UI có session IAB sẵn. Chrome mở thử bị chuyển login và đã đóng, không tạo credential. Không có connector Vercel/Supabase callable trong inventory tool hiện tại. File auth CLI ở các vị trí Windows chuẩn đã kiểm không tồn tại; process không có env tên bắt đầu VERCEL/SUPABASE; không suy toàn máy không có credential từ khảo sát hữu hạn này. DB dùng đúng CLIXML/helper đã định danh, không đọc `.env.local`.

| Bằng chứng | Kết quả | Mức kết luận |
| --- | --- | --- |
| A/vercel-members.json, vercel-team.json, vercel-project.json | Account hiển thị `24tx810010-hcmute`, sole listed member Owner; Hobby; team `team_HzAjrBEEto8cMc6YCvJPaJcm`; project `prj_7xwZL8MUEccVL2o0EvxoCtIYJ1en`, `pos-cafe` | Role thực được thấy, không phải deploy thử |
| A/supabase-team.json, supabase-project.json, supabase-org.json | Current member `YOU` Owner trong org FREE; project `kfqjdfwxhkdwihjobpny`, Healthy/Sydney/NANO. Org slug disabled `eyuomtfcfhfpayzuefyt` | Đính chính cập nhật ngắn đầu phiên: UI gọi **slug**, không chứng minh immutable API id. API có trường id riêng, chưa đọc bằng credential Management |
| A/vercel-production.json, vercel-preview.json, vercel-git.json | Main tạo Production, auto-assign checked; Preview Branch Tracking checked cho All unassigned branches; repo `24tx810010-hcmute/pos-cafe`; deploy hooks absent | Control được nhìn thấy, không đổi hoặc thử hiệu lực. Cả main/docs no-push |
| A/vercel-env-list.json, vercel-env-write-only.json | `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Secret, Production and Preview. Edit DATA_MODE hiển thị write-only, Copy disabled; Cancel, không Save | Giá trị chưa đọc được; equality giữa Production/Preview/current bundle đều UNKNOWN. Mở form để đọc không phải env update |
| A/vercel-preview-shared.json | Preview Shared báo No shared variables linked | Giới hạn đúng Preview; không suy đây là toàn bộ team env inventory |
| A/vercel-build-settings.json | Vite, output dist override; root trống, Node24.x, ignored build Automatic; Production Overrides liên kết `DqnFhDaswqUcqiryL6A2XwDfMmHY` | Không đọc build log/runtime exact patch Vercel. Không gọi local Node24.16.0 bằng hosted binary |
| A/supabase-functions.json, supabase-jwt.json | Candidate functions chưa có; deploy control enabled. Current signing key ECC P-256, previous Legacy HS256 | JWT profile mới; không rotate/revoke/create key; không runtime test function |
| A/provider-safe.json | **09:05:38.272Z (16:05:38 Bangkok)**: postgres/database/session_user, PG17.6, READ ONLY, TLS CA verified; matcher true; native SET hook/storage ownership false | Catalog declaration; hosted DDL/reload và matching NOSUPERUSER rehearsal NOT RUN |

[Supabase access control](https://supabase.com/docs/guides/platform/access-control) mô tả Owner ở toàn org/project. [Vercel roles](https://vercel.com/docs/rbac/access-roles) mô tả quyền settings/deployment của Owner; trang role có chú thích Pro/Enterprise, còn UI thật ở đây Hobby/Owner. Vì vậy record **declared capability theo UI+docs**, không suy entitlement của mọi tính năng có phí hay execution thành công. [Supabase API](https://supabase.com/docs/reference/api/v1-get-an-organization) nhận slug và trả id riêng; cần Management API auth được cấu hình an toàn để chốt immutable id. Không yêu cầu mở rộng quyền vì role hiện tại đã Owner.

## Env blocker đã được xác định cụ thể

[Vercel Secret/Config](https://vercel.com/docs/environment-variables/sensitive-environment-variables) xác nhận Secret lưu rồi chỉ ghi, Config mới đọc lại được. Đây là giới hạn sản phẩm, không thiếu một lần login. Không xoay key, ghi lại env, đổi Secret→Config hoặc tạo deployment để dò secret. Không lấy “Added Jul22”, scope giống nhau, hay current asset để chứng minh env kế tiếp chưa đổi.

Để có input release xác định về sau: operator cung cấp bản gốc config qua **file private** đã kiểm provenance, hoặc owner duyệt dùng exact cấu hình public hiện hành làm input build cố định/ghi lại env trong cửa sổ riêng. Cả hai là quyết định/input còn thiếu, không tự được chấp nhận. Gói hiện tại có thể review được nhưng chưa upload eligible; không cần xin lại scope79 và không xin secret qua chat.

## Local compile và package thực chạy

Ba lệnh sau chạy từ `D:/Workspace/pos-cafe`, exit0; output chỉ metadata/hash:

1. `D:/tools/nodejs/node.exe artifacts/permission-close3-rollout-20261013/probe-build.mjs` — 09:04:18.971–09:04:22.326Z. GET frontend và key từ bundle hiện hành; GET đúng `/auth/v1/settings` HTTP200. Raw chỉ private. Compile Vite8.2.1/Node24.16.0 Windows từ installed pnpm tree. Trường `packageLock` trong receipt gốc pin npm lock SHA `fa532f1203f4074fa1a4400f830458e465ba32e13ad39cc44291ae1505a7cc08` **chỉ là repository metadata lịch sử, không điều khiển lần compile này**; xem supplement hồi cứu bên dưới. Explicit defines, empty envDir và loại inherited VITE_* tránh fallback env.
2. `& artifacts/permission-close3-rollout-20261013/invoke-capability.ps1` — wrapper chuyển CLIXML qua stdin, stderr bị giữ, identity guard và TLS/read-only; raw full provider profile private SHA `8b6b4c2f322b0e38b17dff8fc8da3588656ef63b929906e998d679677f622273`.
3. `D:/tools/nodejs/node.exe artifacts/permission-close3-rollout-20261013/package-local.mjs` — tạo156 files Build Output v3/link metadata local;154 static files byte-identical với dist,2 HTML asset references tồn tại. A/prebuilt-safe.json pin toàn gói. Chưa Vercel CLI validation, upload, provider routing hay domain execution.

Các lệnh khám phá file vắng mặt trước đó có diagnostic path-not-found/rg glob không hợp lệ; không dùng làm test PASS. Không có build/probe thất bại bị che. Đây không phải bộ test mới PIN19/PERM60 hoặc UI: không đổi UI/app; không chạy lại huge gates chỉ tăng số. Compile không chạy `tsc` lần này; CLOSE2 giữ evidence lịch sử trên source31.

**Bổ sung hồi cứu EVC-01 lúc09:26:20.043Z:** `D:/tools/nodejs/node.exe artifacts/permission-close3-rollout-20261013/dependency-provenance.mjs`, exit0, chỉ đọc dependency và ghi snapshot local. A/dependency-provenance-safe.json pin `pnpm-lock.yaml` và installed `.pnpm/lock.yaml` cùng SHA `8eea3a22ef3172cd8ef8d260efbd9b0e7c9cd685bcc47f034d775016c1d10143`; `.modules.yaml` ghi pnpm11.6.0/isolated.30 direct package manifests/resolved paths và Vite entrypoint/chunk được pin. Vite thực8.2.1/plugin-react6.0.5, npm lock8.0.16/6.0.2. Giữ nguyên receipt gốc; không giả supplement đã thu trước compile. Không attested install log hoặc full node_modules audit; không rebuild/reinstall/hosted call trong supplement.

Để tái hiện, dùng **bản sao source31 cách ly mới**, Windows Node24.16.0/pnpm11.6.0, `pnpm install --frozen-lockfile` với pnpm lock pinned, rồi cùng explicit private config/empty-envDir compile. pnpm-lock đã ở source31, không sửa lock. Fresh reinstall/reproduction này NOT RUN; không chạy `npm ci` trên checkout chung. Repo [vercel.json:4](D:/Workspace/pos-cafe/vercel.json:4) dùng `npm ci`: dependency parity giữa provider recipe và local compile **chưa đạt**, không dùng bản local làm chứng cứ cloud build tương đương. Prebuilt tránh rebuild nhưng vẫn cần chọn pipeline/input và quyền release riêng.

| Binding | SHA256 |
| --- | --- |
| Source31 manifest / archive | `21a1726a8cce20ae692aef895b283032ad46f81f6d5bd3e26188c6bc86ff64cd` / `165f9d2edcbed7f9fe8f7aea30ec3c2201b05704e28354479cf79433f721b89f` |
| Live `index-CfdNnUcO.js` (1,405,737byte) | `74bc45fea095942a74ca64f31ddd8712ed3143d04b1ad9c7ec25d6eeeb073eac` |
| Candidate `index-CUlgm0d1.js` (1,515,863byte) | `f59368b2553bfcff9a680029032e93fb5b9cfaee453d79ba8379179f8b965dab` |
| Explicit compiled-derived binding tuple | `aa5f72f98e8c92fc0ce63fa99ea8d8177570e5a463b411a516272231932d8d90` |

Candidate có mode/URL/key cùng public live tuple được assert tại chỗ compose ports; không phải chỉ search tên env rời rạc. [runtimePorts.ts:65](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:65) nhận ba VITE vars lúc build. A/probe-build-safe.json pin runtime executable/config/lock/source và thể hiện `nextDeploymentEnvVerified=false`. Toàn dist và prebuilt được pin trong candidate manifest, raw chỉ private. Source31 812 entries trước/sau không drift; activation bundle lịch sử `36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70` cần đối chiếu final check.

## Gate còn mở và handoff

Đã giải quyết khoảng trống role/account/team/slug và xác định nguyên nhân env, có bundle+prebuilt local reviewable. Chưa có immutable Supabase org API id, authenticated CLI deployment scope, actual nextenv, effect proof skip-domain/promote, full secret/backend binding Edge, hosted runtime, maintenance/quiescence, strict backup/proof79, provider/recovery rehearsal, release/postflight/owner acceptance. Không dùng role Owner để đánh execution PASS.

Backup `database-20261013T073030255Z-0c33f5ee` vẫn strict74/75 vì Auth sequence327→328; approval79 không sửa proof. Giữ66 Auth và Storage object3 ngoài scope, deletion exact2. Bước đề nghị tiếp là quiescent backup79+freshproof/rehearsal, nhưng **đã dừng trước bước đó**. [Review](../reviews/2026-10-13-permission-close3-rollout.md) phải xác nhận same final candidate; approval hồ sơ không là release approval.

**Metadata review sau freeze:** SEC rồi EVC cùng APPROVE candidate03 SHA `d1a6fdeb1d79a87bda8adae0c5a5c7d74af91fd1844b26d2a82a454c6df72a78`; findings SEC-01/EVC-01 đã đóng theo [lịch sử review](../reviews/2026-10-13-permission-close3-rollout.md). Chỉ metadata được bổ sung, frozen snapshot vẫn là bản reviewer kiểm; không đồng nhất live docs SHA với snapshot SHA. PARTIAL/BLOCKED/STOP không đổi.
