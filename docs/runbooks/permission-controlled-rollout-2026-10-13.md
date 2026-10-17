# Controlled rollout CLOSE-3 — chuẩn bị, không thực thi (13/10/2026)

**Tất cả thao tác hosted dưới đây NOT RUN và ngoài quyền thực thi của lượt này. Không push, deploy hoặc promote.** [Handoff/quyết định](../workflow/tasks/permission-close3-rollout-2026-10-13.md), [bằng chứng](../implementation-log/permission-close3-rollout-2026-10-13.md). Tài liệu này bổ sung [runbook08/10](permission-release-runbook-2026-10-08.md), kế thừa STOP/unknown-outcome/rollback; exact scope79 thay scope77 chỉ theo DELIVERY03NEW79, không dùng ngày/count để chọn tenant.

## Đích và profile phải khớp

- Vercel: `team_HzAjrBEEto8cMc6YCvJPaJcm` / `prj_7xwZL8MUEccVL2o0EvxoCtIYJ1en`, repo `24tx810010-hcmute/pos-cafe`; Production main; domain `pos-cafe-azure.vercel.app`. Auto-assign đang bật; Preview tracking đang bật cho branches khác, không push docs.
- Supabase: project `kfqjdfwxhkdwihjobpny`, backend `https://kfqjdfwxhkdwihjobpny.supabase.co`; org slug `eyuomtfcfhfpayzuefyt`, immutable API id chưa đọc. DB credential username project-bound, TLS CA pinned; actor/session_user postgres PG17.6 provider profile trong private receipt. Không dùng native flags false làm lý do grant/đổi owner provider.
- Source31 fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`, activation bundle `36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70`, permission contract2/write protocol1. Frontend đang live là code commit cũ, không chứa dirty source31; frontend candidate SHA khác được pin trong receipt.
- Env next deployment UNKNOWN. Gói `private/close3-rollout-20261013/prepared-prebuilt` là **local proposal**, Vite output từ exact compiled-derived config; chưa được chọn làm release input, chưa provider validated. Không ghi nội dung config/key trên command line, logs, repo hoặc chat.
- Dependency local: pnpm11.6.0, Vite8.2.1/plugin-react6.0.5, pnpm lock pin trong supplement. `vercel.json` hiện dùng npm-ci/npm lock8.0.16/6.0.2; không coi hai recipe tương đương. Trước release phải chọn pipeline tái hiện được: prebuilt exact reviewed bytes, hoặc giải quyết/review dependency parity của cloud build trong slice riêng. Không thay lock/installCommand trong lượt này; không chạy npm-ci trên shared checkout.

## Trình tự tương lai và chứng cứ phải thu

| Bước | Thao tác cụ thể sau khi được phép | Điều kiện đủ để đi tiếp / STOP |
| --- | --- | --- |
| 0. Chốt release input và kênh | Lấy immutable org id qua Management GET được xác thực; đối chiếu role/target. Chọn explicit private env provenance hoặc owner duyệt compiled-derived tuple; cấu hình CLI auth vào đúng team/project an toàn nếu dùng CLI | Missing auth/input vẫn BLOCKED; không tạo token rộng, không trích browser cookies. Role declaration không thay write execution. Không gọi local prebuilt là nextenv proof |
| 1. Khóa kênh phát hành | Chỉ chọn và ghi cơ chế A (Git + tắt auto-assignment trước push trong cửa sổ được duyệt) hoặc B (production prebuilt + `--skip-domain`, tiếp tục không push). Freeze các kênh Git/CLI/hook/other operator; **không upload, push hoặc tạo deployment ở bước1**. Cấu hình control chỉ thay khi đã có quyền riêng; cả hai hiện NOT RUN | A chỉ chặn domain assignment, không chặn deployment creation/URL. B vẫn tạo deployment/public surface và chỉ được upload tại bước5 sau bước2–4, exact candidate và ủy quyền; không lách no-publish. Kiểm mọi production alias, không chỉ main domain. Chặn Git autobuild là setting change riêng cần phạm vi duyệt |
| 2. Quiescence và backup79 | Chốt maintenance/window, chặn đầy đủ legacy client, Auth bootstrap/refresh writer và Storage replacement; chứng minh inflight kết thúc. Backup/restore strict75/75 mới, toàn79 stores/145 Auth theo fresh inventory; Storage payload/metadata3/3 bảo toàn; proof exact79, Auth ngoài scope và exact2 delete journal | Chưa có cơ chế quiescence diễn tập/được phép → STOP trước hosted control. Backup74/75 cũ không hợp lệ. Rehearsal provider đúng binary/profile/NOSUPERUSER và reload/recovery phải đạt. Không bắt đầu trong slice này |
| 3. Review release candidate | Pin exact inventory79/backup/restore/full-row/catalog/config/source/frontend/Edge/JWT/prepare-fixed-restore SQL/time/profile. Hai reviewer phù hợp và owner xét cửa sổ/thao tác | Current candidate chỉ là hồ sơ preparation; không dùng review của nó làm human acceptance hoặc release authorization |
| 4. Backend trước frontend | Theo controller: prepare+proof+REST reload; locked recheck79/FK/full-row/catalog/Storage; cleanup+activation chung transaction; chứng minh commit; Storage API journal exact2; giữ object3/66 Auth; Edge/config/Realtime/private staging sau đó | COMMIT/prepare UNKNOWN → maintenance, read-only reconcile; không retry mù. DB rollback không khôi phục Storage đã xóa. Không direct DELETE metadata. Không mở frontend khi Storage pending, contracts/deny/PIN/recovery chưa đạt |
| 5. Candidate frontend chưa promote | **Chỉ sau bước2–4** và exact candidate được duyệt: nhánh B upload/deploy prebuilt Production + skip-domain; nhánh A chỉ được push khi no-push đã được owner thay thế rõ và auto-assignment đã được kiểm soát. Kiểm provider ID, source/bundle hash, output bytes/binding, deployment protection và domain set vẫn trỏ old deployment. Test candidate trong maintenance theo quyền riêng | ACK deploy không chứng minh domain-control hiệu lực. URL tạo ra có thể truy cập, cần scope/test-access cụ thể. Preview env không được dùng thay Production rồi giả promote đã đổi các giá trị compile. Trong scope hiện tại cả hai nhánh vẫn bị cấm thực thi |
| 6. Promote và postflight | Sau candidate backend/client postflight, promote **exact deployment ID** trong đúng team/project; xác minh domain chuyển đúng asset hash, contract2/write1; PIN/permission/payment K/R1/receipt/realtime/image/cache và preservation | Không promote “latest” không pin. Chưa live tests/human print/owner acceptance → task sản phẩm chưa đóng. Tất cả mutation/live business-flow phải thuộc ủy quyền riêng |

[Vercel deploy](https://vercel.com/docs/cli/deploy) quy định `--prebuilt` dùng `.vercel/output`; `--prod --skip-domain` bỏ auto-promotion dù setting project bật. [Promote](https://vercel.com/docs/deployments/promoting-a-deployment) cần kiểm exact target trước khi gán domain. Cờ này không hủy Git auto-deploy và không làm việc upload trở thành read-only. [Build Output config](https://vercel.com/docs/build-output-api/configuration) và [static primitives](https://vercel.com/docs/build-output-api/primitives) là cơ sở gói local version3, filesystem rồi SPA index; routing provider chưa test. Không lưu một script tự deploy/push trong gói.

Mẫu command **chỉ để review**, chưa chạy; CLI version/auth/target/output metadata cần chốt trước khi biến thành lệnh thật:

```text
NOT RUN: vercel deploy --prebuilt --prod --skip-domain --scope team_HzAjrBEEto8cMc6YCvJPaJcm --cwd <EXACT_REVIEWED_PRIVATE_PACKAGE>
NOT RUN: vercel promote <EXACT_VERIFIED_DEPLOYMENT_ID> --scope team_HzAjrBEEto8cMc6YCvJPaJcm
```

## Edge/JWT: exact source, khác trách nhiệm

| Function | Profile dự kiến cần rehearsal/runtime proof | Secret/backend binding chưa chứng minh |
| --- | --- | --- |
| `menu-image-gateway` | `verify_jwt=true`; Authorization user JWT, employee token và contract2. Handler vẫn `getUser` và RPC permissions, không tin riêng platform flag | Runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` phải cùng project; không thay service role bằng public publishable key |
| `menu-image-public` | `verify_jwt=false` vì GET ảnh published không có user Authorization; lookup published asset trước304, staging private | Runtime URL/service role cùng project; exact paths/version/hash journal; không biến bucket public để thay handler |

Source [gateway:7](D:/Workspace/pos-cafe/supabase/functions/menu-image-gateway/index.ts:7), [authorize:20](D:/Workspace/pos-cafe/supabase/functions/menu-image-gateway/index.ts:20), [public:4](D:/Workspace/pos-cafe/supabase/functions/menu-image-public/index.ts:4), [local public setting:417](D:/Workspace/pos-cafe/tests/permissions/runtime/identity.toml:417). Repo không có production `supabase/config.toml`; chưa tạo nó để tránh thay source31. Hai handler và shared module được source31 pin, không deploy template/new SDK. Profile trên là đề xuất kỹ thuật phù hợp current call contract, không claim hosted settings đã tồn tại.

[Supabase auth headers](https://supabase.com/docs/guides/functions/auth-headers) hiện mô tả platform check chấp nhận JWT asymmetric; caller chỉ có API key vẫn phải bị handler từ chối nếu thiếu user/employee credentials. Current ECC P-256 cần thử fresh Auth JWT hợp lệ/expired/forged/wrong-project, missing employee/revoked/permission deny và public GET no-auth trước frontend. Không tự tắt gateway verification khi gặp401 hoặc thay expected status để đạt test. Docs signing-key migration có cảnh báo tương thích; runtime đúng target là gate, không suy từ docs hay local HS256.

## Rollback và phục hồi

Trước DB commit: chứng minh rollback cả cleanup+activation và exact prepare fixed restore+REST reload; không dùng callback giả làm ACK. Sau commit: old frontend deployment `DqnFhDaswqUcqiryL6A2XwDfMmHY` **không mặc nhiên là rollback tương thích** với contract2/15quyền. Giữ maintenance; dùng forward fix hoặc một bundle tương thích đã được kiểm. Chưa có bundle rollback hosted tương thích nên gate này mở.

Restore backup live chỉ khi quiescence và không bỏ mất writes sau backup hoặc có đối soát phục hồi đủ, giữ K/payload/R1/receipt. Storage API độc lập DB transaction: journal exact2, replacement race check, reconcile ACK unknown trước retry. Object3 và66 Auth giữ ngoài scope. Không mở lại legacy grants/RPC, không hạ schema/role để chiều frontend cũ. Các ca prepare unknown/DB commit unknown/Storage pending và postflight fail theo runbook08/10 cần rehearsal mới gắn profile hiện hành; chưa chạy ở đây.

## Checkpoint phase2 ngày13/10/2026

[Runbook quiescence mới](permission-phase2-quiescence-2026-10-13.md) ghi observation source34 và lab mới: phase2 PARTIAL/BLOCKED trước fresh backup/restore. Actor hosted thiếu full lock/sequence authority; chưa có control Storage payload/workers. Không dùng29/29 diagnostic làm strict75/75 hoặc release approval. Quyết định scope79, no-push và Tailwind3 releaseblock giữ nguyên; các mô tả source31/dependency phía trên là checkpoint lịch sử, source34 hiện hành theo [bàn giao npm](../workflow/tasks/permission-npm-remediation-2026-10-13.md).
