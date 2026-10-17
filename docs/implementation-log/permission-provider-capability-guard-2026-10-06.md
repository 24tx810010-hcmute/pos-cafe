# Guard quyền phát hành theo Supabase — 2026-10-06

## Mục tiêu, quyết định và phạm vi

Chủ dự án trả lời **“ok”** cho phương án kiểm thử cơ chế quyền sẵn có của Supabase trên clone rồi điều chỉnh guard theo bằng chứng. Quyết định PGCG-D01 và [bộ spec của slice](../../openspec/changes/permission-provider-capability-guard/proposal.md) ghi lý do, phương án thay thế, ràng buộc và testplan. Hai reviewer đã APPROVE spec round 2 trước implementation; [biên bản](../reviews/2026-10-06-permission-provider-capability-guard.md) giữ findings và verdict từng vòng.

Phạm vi là công cụ phát hành và rehearsal capability cách ly. Không đổi UI/nghiệp vụ, cleanup hoặc deploy live, native grants live, owner bảng provider hay kênh quản trị. Code và tests trên `main`; hồ sơ này/spec/handoff trên worktree `docs`; các thay đổi vẫn chưa commit. Giữ các dirty changes khác và `pnpm-lock.yaml`, không reset/stash/chuyển nhánh.

**Kết quả local:** guard đã nhận profile Supabase đầy đủ và giữ chặn profile thiếu/sai; 77/77 tooling, 7/7 runtime scenarios PASS, 0 fail/pending ở lượt cuối. Trạng thái final review theo biên bản liên kết. Kết quả này chỉ cho slice local, không phải full product gate, hosted DDL hoặc phát hành. Sau thay source, các proof controller 01/10 là lịch sử; gate/release proofs bị ảnh hưởng cần được dựng lại trước phát hành.

## Vì sao phải sửa

[Khảo sát live chỉ đọc](permission-release-capabilities-2026-10-06.md) quan sát actor không SUPERUSER; native parameter SET và owner-role USAGE đều false, nhưng supautils được nạp, có privileged role/whitelist/reserved role/policy grant. Guard cũ chỉ dùng hai predicate native nên chặn trước prepare. Clone cũ không nạp cơ chế provider và từng dùng native grants bổ sung; không thể suy từ clone đó rằng live phải cấp cùng grants.

[Supautils 3.4.0](https://github.com/supabase/supautils/blob/v3.4.0/README.md) hỗ trợ thay cấu hình và quản lý policy qua quyền provider. Trước thay điều kiện accept của guard, chạy exact compatibility prepare/fixed restore và exact image fragment/rollback trên clone có profile tương ứng live. Actor postgres NOSUPERUSER chạy DDL thành công trong khi hai native flags false và owner bảng Storage giữ nguyên. Đây là bằng chứng runtime của binary local đã pin, chưa chứng minh binary/config/hành vi hosted giống hệt.

## Thiết kế đã hiện thực

| Phần | Cách xử lý và lý do |
| --- | --- |
| Actor invariant | Giữ actor=config, NOSUPERUSER, BYPASSRLS, CREATEROLE và bốn error codes hiện có |
| Native path | Native parameter/owner capability đủ vẫn được nhận; không dùng quyền DML thay policy capability |
| Provider path | Một full supported profile supplement các native capability thiếu: preload token supautils, bốn GUC đăng ký/context sighup/nguồn trusted/không pending restart, exact privileged role và effective inherited USAGE, exact whitelist/reserved role token, JSON grant đúng actor và storage.objects |
| Parser | Trim token đơn giản, exact match; JSON kiểm object/array/string/own key; malformed/near match không mở fallback. Profile hẹp phù hợp đích đã khảo sát, không nhận mọi cấu hình hợp lệ của provider |
| Query | Chỉ SELECT catalog trên connection hiện tại; không SET ROLE, grant, owner transfer, DDL thử hoặc nội suy config thành SQL trong preflight |
| Thứ tự | Shared guard vẫn chạy trước prepare và trong cutover/rehearsal. Cleanup atomicity/default rollback/commit unknown/journal/locked recheck/source/target gates giữ nguyên yêu cầu |

Full-profile fallback là điều kiện chung. Nếu native cả hai false, thiếu bất kỳ phần nào trong profile sẽ báo mã missing hook trước; mã này không khẳng định chỉ thiếu whitelist. Guard là preflight bảo thủ, không bảo đảm mọi DDL/rollout sẽ thành công. Drift sau guard có thể làm thao tác thật fail; transaction/recovery hiện hành vẫn phải xử lý.

## Source và đường đọc code

- `D:/Workspace/pos-cafe`, main HEAD `ef2c372aec60d8362549e47b7aedb27126129479` cộng working tree; source fingerprint cuối `30dd5664e47f670e1c208151407c58b5dbb71943ca30d8a57f17de49051c1bad`.
- Thay ba file trong slice: `D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:345` (profile parser), dòng 371 (catalog reader), dòng 386 (shared guard); `D:/Workspace/pos-cafe/scripts/permission-provider-capability-rehearsal.mjs:56` (worker) và dòng 172 (clone runner); `D:/Workspace/pos-cafe/tests/contracts/permissionProviderCapabilities.tool.test.ts:1` (negative/mixed/actor tests).
- [Manifest source](D:/Workspace/pos-cafe/artifacts/permission-provider-guard-20261006/source-manifest.json) và `source-snapshot/` chứa 706 paths cùng deletion marker; [verification](D:/Workspace/pos-cafe/artifacts/permission-provider-guard-20261006/verification.json) bind source/report/runtime. Snapshot trước sửa preload được giữ riêng, không thay proof cũ.
- Docs trên `D:/Workspace/pos-cafe-docs`, nhánh docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19` cùng dirty changes có sẵn và cập nhật slice này.

Walkthrough được cung cấp theo thứ tự: native predicates → typed provider catalog → full profile matcher → hai capability OR → runtime prepare/restore/rollback → negative profile cases. Chủ dự án chưa phản hồi lượt walkthrough; không tự ghi đã đọc/hiểu hoặc nghiệm thu code.

## Môi trường và bảo vệ dữ liệu

- Windows/WSL Ubuntu-24.04; host Node v24.16.0, worker Node v24.16.0, pg 8.23.0. Không đổi dependency/lockfile.
- Image DB PG17.6 pin `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`; derivation supautils version 3.4.0, binary SHA-256 `8226c53a3025eb377de2194e93cd36da328f1b678e33a567ffb1fa2c289a737d` được kiểm trước chạy. Node sidecar image pin trong runner.
- Nguồn `pos-cafe-restore-1790593558895-4c7ba556` phải stopped/image/volume/network đúng. Volume nguồn chỉ mount read-only khi copy offline sang volume mới; nguồn không start/sửa.
- Clone mới network none, không publish ports, PostgreSQL listen_addresses rỗng, Unix socket /restore. Sidecar dùng namespace clone, source/Node/dependencies mount read-only. Không truyền DSN/password live vào runner.
- Setup actor supabase_admin chỉ dựng profile local và membership privileged role tương ứng live. Guard/DDL chạy actor postgres. Không thêm parameter SET grant hoặc membership supabase_storage_admin; native flags false được kiểm thật.
- Baseline sau setup so toàn bộ dữ liệu 53 bảng public/private/auth/storage, prepare state/catalog/settings/owner và native ACL/membership trước/sau DDL hoặc guard. Không gọi Storage API, không cleanup test stores. Đây là scope so baseline của slice; không thay 74-check restore proof lịch sử hoặc toàn bộ gate dữ liệu phát hành.
- Các clone/sidecar owned của slice đã stop sau mỗi lượt; volume/failure/proof giữ để truy vết. Không dừng dịch vụ khác, không dùng Playwright/browser.

## Kiểm chứng cuối và cách chạy lại

Thư mục chạy `D:/Workspace/pos-cafe`. Syntax checks hai script exit 0. Focused tooling cuối exit 0:

```text
node node_modules/vitest/vitest.mjs run --config vitest.permission-tooling.config.ts tests/contracts/permissionProviderCapabilities.tool.test.ts tests/contracts/permissionReleaseCutover.tool.test.ts tests/contracts/permissionReleaseRehearsal.tool.test.ts tests/contracts/permissionEmptyActivation.tool.test.ts --reporter=json --outputFile=artifacts/permission-provider-guard-20261006/focused-tooling-round2.json
```

77 tests PASS: provider guard mới 43, existing cutover/rehearsal/empty activation 34; 0 fail/pending, config retry=0. Lượt cuối runtime exit 0:

```text
node scripts/permission-provider-capability-rehearsal.mjs --source-container pos-cafe-restore-1790593558895-4c7ba556 --profile artifacts/permission-release-capabilities-20261006/live-capabilities-1791256482447.json --profile-sha256 69107619ad9a71330620d0fe603554ee083b0f5cb5c7116902f40366a0f700ba --output artifacts/permission-provider-guard-20261006/provider-runtime-round2.json
```

Runner yêu cầu output chưa tồn tại; khi tái chạy, chọn tên artifact mới. Phải có đúng image/source volume stopped, Linux Node/dependency paths trong runner và Docker/WSL sẵn có. Source/profile/binary/isolation được recheck; source fingerprint trước/sau phải khớp. Output giữ per-case proof và các clone name, không chỉ tổng PASS.

| Runtime case | Kết quả |
| --- | --- |
| prepare-fixed-restore | Guard pass; exact prepare COMMIT rồi fixed restore COMMIT; singleton false/version 2 và authenticator hook đúng; baseline catalog/data/settings/grants/membership khớp |
| images-rollback | Exact fragment chạy, staging bucket đúng, bốn policy legacy bị drop, owner không đổi; ROLLBACK về baseline |
| RT01 | Không nạp supautils → guard chặn trước effect |
| RT02 | Không inherited privileged role → guard chặn trước effect |
| RT03 | Không có pgrst whitelist → guard chặn trước effect |
| RT04 | Reserved authenticator không có hậu tố configurable → guard chặn trước effect |
| RT05 | Không grant policy trên storage.objects → guard chặn trước effect |

RT01–05 đều trả `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` theo full-profile/error ordering đã đặc tả; baseline quanh guard không đổi. Sau phục hồi profile, guard pass và final baseline khớp. Negative guard denial không tự chứng minh DB cũng từ chối mọi câu DDL tương ứng.

| Evidence cuối | SHA-256 |
| --- | --- |
| `focused-tooling-round2.json` | `c799679d85d4815dc3c030e93e44dcbabf655cc2c6b2d0a5e3450d4424b8a560` |
| `provider-runtime-round2.json` | `d937b13af43f842afa1884c1aa75dbde24292605e4a1227ce7acbf9d81c7b3c8` |
| `source-manifest.json` | `2da41ef5533a3e40425d00b6f38b9e82647f5054c7e65db8785048652a980c7a` |

Các artifact trên nằm trong `D:/Workspace/pos-cafe/artifacts/permission-provider-guard-20261006/`, giữ local, chưa commit/publish. Không đưa raw credentials hoặc dữ liệu hàng vào docs. Verification metadata ghi timestamp, source binding và giới hạn.

## Lỗi harness đã xử lý và giới hạn

Giữ `ddl-diagnostic-round1.json`: compatibility prepare/restore đã pass, image assertion sai tên staging bucket trong harness; fragment thật đã rollback. Sửa expected từ tên tự đặt sang đúng literal `menu-item-image-staging` trong source. Diagnostic round 2 có hai case PASS trước khi mở đường accept provider trong shared guard; runner cũ được giữ ở artifact lịch sử.

Giữ `provider-runtime-round1.json`: hai DDL case PASS nhưng RT01 setup lỗi SQLSTATE 58P01 khi đặt preload bằng list item rỗng. Sửa setup RT01 dùng ALTER SYSTEM RESET để lấy default rỗng, không tạo tên library rỗng. Source snapshot/fingerprint và focused tooling của lượt trước giữ riêng. Runtime round 2 chứng minh cả bảy scenarios; không sửa failure artifact thành PASS.

Không xác minh hosted binary/hash/DDL/REST reload, Edge/Storage/Vercel management, full cleanup/cutover fault matrix trên source mới, UI hoặc full product gate trong slice này. Các kết quả đó còn pending; không dùng 77/7 làm số test toàn sản phẩm. Chưa cấp thêm quyền live hoặc triển khai.

## Nguyên liệu báo cáo và việc tiếp theo

Nguồn cho phần khó khăn kỹ thuật/thiết kế/kiểm thử: cách nhận diện khác biệt giữa quyền PostgreSQL chuẩn và capability provider; lựa chọn profile bảo thủ có kiểm chứng, xử lý cú pháp cấu hình và oracle test theo source; dựng clone không mạng để thử DDL/hoàn tác; giới hạn suy luận từ môi trường mô phỏng. Khi viết báo cáo diễn giải thành bài toán, phương pháp, quyết định và kết quả; paths/code/hash/lệnh chỉ dùng truy vết nội bộ theo [source map](../report-source-map.md).

Tiếp theo trong [bàn giao phân quyền](../workflow/tasks/redesign-permission-model.md): xác minh authenticated management channels, dựng lại release proofs/gates cần thiết cùng candidate cuối, final implementation review tổng, backup/recheck exact allowlist và coordinated release/postflight trong phạm vi đã giao. Slice này không tự nối các phần đó, owner-account/recovery/UI redesign hoặc pattern chia việc nhóm.
