# Kiểm tra quyền và kênh phát hành phân quyền — 2026-10-06

> **Checkpoint sau khảo sát:** chủ dự án đã chọn phương án A bằng câu “ok”; PGCG-D01, implementation và rehearsal local ở [slice guard provider](permission-provider-capability-guard-2026-10-06.md). Nội dung dưới đây giữ kết quả/giới hạn tại thời điểm khảo sát trước thay code, không dùng approval khảo sát cho implementation mới.

## Phạm vi và ủy quyền

Ngày 05/10, chủ dự án yêu cầu đọc hai chat “Hoàn thiện và triển khai phân quyền POS Cafe” và “Đọc yêu cầu đồ án”, xác định việc còn lại để đóng task trước khi chuyển sang cách chia việc nhóm. Sau đề xuất bắt đầu bằng kiểm tra quyền/kênh phát hành chỉ đọc, ngày 06/10 chủ dự án trả lời: “được, bạn xem giúp tôi luôn là có cần tạo session mới cho phần này không nhé. nhớ lưu ý cần viết lại các vấn đề kĩ thuật liên quan của task vào nhánh docs vì cái này cần thiêt (có trong rubik chấm điểm). có câu hỏi không”.

Lượt này chỉ khảo sát kết nối, catalog/quyền/cấu hình và metadata công cụ; ghi hồ sơ kỹ thuật và đề xuất. Không thay application/controller, thử DDL live, cấp quyền, đổi owner bảng, cleanup, push, deploy hoặc tạo chat mới. Helper chẩn đoán được lưu ngoài source ứng dụng và snapshot trong artifacts. Quyền phát hành/cleanup đã ghi ở [bàn giao](../workflow/tasks/redesign-permission-model.md) vẫn còn; chưa đến bước thực hiện và chưa thỏa gate.

**Trạng thái:** kết quả khảo sát được ghi dưới đây; trạng thái review ở [biên bản review](../reviews/2026-10-06-permission-release-capabilities.md). Phát hành vẫn BLOCKED/PENDING_VERIFICATION; khảo sát này không đóng task sản phẩm và không thay các kết quả test lịch sử.

## Source và môi trường

- Main: `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479` cùng working tree hiện có. Fingerprint source: `fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef`, khớp candidate controller 01/10 theo [khảo sát 05/10](../workflow/tasks/permission-closeout-review-2026-10-05.md). Không rerun gate ứng dụng trong lượt này.
- Docs: `D:/Workspace/pos-cafe-docs`, nhánh `docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19` cùng thay đổi chưa commit có sẵn. Bổ sung từng phần, giữ nguyên các thay đổi khác, không switch/reset/stash.
- Đích: Supabase project `kfqjdfwxhkdwihjobpny`; kết nối PostgreSQL qua pooler `aws-1-ap-southeast-2.pooler.supabase.com:5432`, database `postgres`, actor/session user `postgres`, server 17.6. TLS xác minh CA, `rejectUnauthorized: true`.
- Quan sát live chính: `2026-10-06T03:14:42.445Z` (10:14:42 UTC+7). Dùng credential mã hóa đã có trên máy; truyền nội bộ qua stdin, không đưa password vào lệnh, log hay tài liệu.
- Probe dùng `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, các `SELECT` catalog/count, kết thúc `ROLLBACK` và đóng kết nối. Đây là snapshot một thời điểm, không khóa dữ liệu để phát hành.
- Runtime helper: Windows x64, Node `v24.16.0`, package `pg` `8.23.0` từ working tree hiện có. Probe DB được chạy bằng `& 'C:/Users/nguye/AppData/Local/pos-cafe-release/invoke-release-capabilities-20261006.ps1'`; probe proxy bằng `D:/tools/nodejs/node.exe C:/Users/nguye/AppData/Local/pos-cafe-release/read-codex-mcp-status-20261006.mjs`. DB probe exit 0; proxy wrapper ghi failure artifact, subprocess proxy exit 1. Chỉ tái chạy khi cần snapshot mới trong phạm vi chỉ đọc, với helper/credential/CA đã xác minh trên máy này.

## Kết quả chỉ đọc

| Phép kiểm | Kết quả | Ý nghĩa và giới hạn |
| --- | --- | --- |
| Kết nối DB/TLS | Thành công; `transaction_read_only=on` | Có kênh khảo sát DB; không chứng minh có kênh quản trị Edge hoặc frontend |
| Đếm hiện trạng | 77 stores, 143 Auth users, 3 Storage objects | Chỉ số lượng tại snapshot; không chứng minh UUID/nội dung giống allowlist cũ hoặc cho phép xóa dữ liệu mới |
| Actor chuẩn PostgreSQL | Không superuser; có BYPASSRLS/CREATEROLE | BYPASSRLS hoặc quyền DML không thay quyền quản lý policy/cấu hình |
| `has_parameter_privilege(...,'pgrst.db_pre_request','SET')` | `false`; không có parameter grant tương ứng | Predicate thứ nhất của guard hiện tại không đạt |
| `pg_has_role(..., storage.objects owner,'USAGE')` | `false`; owner là `supabase_storage_admin` | Predicate thứ hai không đạt; SELECT/INSERT/UPDATE/DELETE trên bảng đều true nhưng không chứng minh quyền DDL policy |
| Provider role | `postgres` kế thừa `supabase_privileged_role` | Có cơ chế quyền của provider cần xét thêm |
| Provider preload/config | `session_preload_libraries=supautils`; các GUC của supautils có trong `pg_settings`, nguồn configuration file, không pending restart | Bằng chứng cấu hình extension đang được nạp ở session; chưa pin phiên bản binary |
| Cấu hình được ủy quyền | `supautils.privileged_role_allowed_configs` chứa `pgrst.*`; reserved roles chứa `authenticator*` | Tài liệu provider mô tả cơ chế cho privileged role sửa cấu hình; chưa chạy câu DDL cụ thể |
| Policy được ủy quyền | `supautils.policy_grants` liệt kê `postgres` với `storage.objects`, `storage.buckets` | Provider có cơ chế quản lý policy trên bảng không sở hữu; chưa chạy câu DDL cụ thể |
| Hook/compatibility | Không có role setting `pgrst.db_pre_request`; năm đối tượng compatibility được probe đều `null` | Chỉ các đối tượng được liệt kê ở evidence; không suy ra toàn schema sạch hoặc toàn bộ candidate chưa tồn tại |

Năm đối tượng cuối là `private.permission_contract_gate`, `public.permission_contract_pre_request()`, `public.permission_contract_probe()`, `public.employee_admin_audit`, `public.store_change_signals`. Live hiện có bốn policy legacy cho ảnh menu trên `storage.objects`.

## Vấn đề kỹ thuật: guard PostgreSQL và quyền của provider

Source hiện tại `D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:345` kiểm hai predicate native nói trên; dòng 353/354 báo `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` hoặc `STORAGE_OBJECTS_OWNERSHIP_REQUIRED`. Luồng cutover gọi guard ở dòng 588, trước prepare. Với kết quả catalog vừa đọc, **guard hiện tại sẽ từ chối actor này**. Đây là đối chiếu code với dữ liệu, không phải controller đã chạy trên live.

Candidate thực sự cần cấu hình hook của `authenticator` tại `D:/Workspace/pos-cafe/supabase/candidate/permission-compatibility-prepare.sql:86` và sửa policy ảnh tại `D:/Workspace/pos-cafe/supabase/candidate/permission-images.sql:10`. Vì vậy kiểm khả năng thực thi phải bao phủ đúng các thao tác, không chỉ kết nối hoặc quyền DML.

[Tài liệu Supabase về cấu hình PostgreSQL](https://supabase.com/docs/guides/database/custom-postgres-config) mô tả extension supautils và cấu hình `pgrst.*`. [Nguồn supautils](https://github.com/supabase/supautils/blob/master/README.md) mô tả privileged role, whitelist cấu hình, reserved role với hậu tố `*`, và policy grants cho role trên bảng không sở hữu. [Hướng dẫn hook Data API](https://supabase.com/docs/guides/api/securing-your-api) dùng cấu hình trên `authenticator`; hook này chỉ áp dụng Data API, không bao phủ toàn bộ dịch vụ.

**Suy luận cần kiểm chứng:** hai predicate native có thể từ chối một actor được supautils cho phép làm đúng DDL cần thiết. Cấu hình live hỗ trợ giả thuyết đó; chưa chứng minh DDL/reload/controller/deploy thành công. Tài liệu nguồn hiện hành không thay bằng chứng phiên bản binary đang chạy. Không kết luận live thiếu quyền chỉ từ clone PostgreSQL thiếu profile provider.

Kết quả clone 01/10 vẫn có giá trị trong profile đã pin: actor gốc bị chặn, clone bổ sung native grants đã qua diagnostic. Không chuyển kết quả đó thành bằng chứng phải cấp cùng grants lên live. [Supabase yêu cầu giữ owner các bảng dịch vụ](https://supabase.com/docs/guides/platform/permissions); không đề xuất chuyển owner bảng Storage để vượt guard.

## Kênh triển khai và chat mới

| Kênh | Quan sát | Trạng thái |
| --- | --- | --- |
| PostgreSQL | Credential đã lưu kết nối được, TLS được xác minh | READ_ONLY_VERIFIED; khả năng DDL còn pending |
| Supabase MCP | Config bật, đúng project URL; CLI ghi `auth_status=o_auth`; catalog tool của phiên này có 0 tool Supabase | NOT_VERIFIED; nhãn CLI/config không chứng minh một request OAuth thành công |
| Desktop MCP status | Probe chỉ vào proxy app-server có sẵn thất bại exit 1 | Không đọc được trạng thái server; chưa xác định nguyên nhân, không suy ra OAuth hết hạn |
| Edge/Storage management | Chưa có authenticated management call để kiểm kê/deploy functions hoặc kiểm Storage API | NOT_VERIFIED; DB catalog không thay management/API gate |
| Frontend/Vercel | Catalog có 0 tool Vercel; global CLI không thấy trong PATH; không thấy `.vercel/project.json` ở root | NOT_VERIFIED; chưa xác minh build/production target/autodeploy |
| Công cụ shell | Node/Codex/gh có sẵn; global Supabase CLI không thấy trong PATH; các biến token quản trị đã kiểm không có trong process env | Chỉ quan sát PATH/env đã chọn, không kết luận máy không có credential hoặc installation khác |

Không start server độc lập, reload config, OAuth login, resume/start thread hoặc sửa cấu hình MCP trong lượt này. Hai process probe kết thúc và kết nối DB đóng; không dùng Playwright/browser.

Cờ `controlSocketUnavailable` trong artifact proxy là phân loại heuristic bằng regex trên stderr, có thể true chỉ vì chứa từ “proxy”. Raw stderr không được lưu để xác minh riêng nguyên nhân; không dùng cờ này làm bằng chứng control socket bị lỗi. Kết luận có căn cứ ở đây chỉ là không lấy được status qua proxy, subprocess exit 1.

[Tài liệu Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) ghi cấu hình chia sẻ giữa các client. [Tài liệu app-server](https://learn.chatgpt.com/docs/app-server) mô tả API trạng thái MCP. Đây là cơ sở cho kiểm tra config/proxy, không phải bằng chứng deployment.

**Đề xuất:** tiếp tục chat hiện tại để hoàn tất khảo sát và chốt phần tiếp theo vì đã đọc được DB. Chat mới không phải điều kiện của DB probe và không bảo đảm MCP hoạt động. Nếu sau khi sửa kết nối muốn tách phiên triển khai, dùng hồ sơ này và bàn giao hiện hành; xác minh tool có thật ở phiên mới trước khi triển khai. Chủ dự án hỏi có cần tạo chat mới, chưa yêu cầu tạo, nên không tạo.

## Phương án tiếp theo cần chốt

| Phương án | Lợi ích | Chi phí/giới hạn |
| --- | --- | --- |
| A — kiểm chứng capability của provider, rồi điều chỉnh guard nếu được yêu cầu (đề xuất) | Phản ánh cơ chế quyền đang có, tránh giả định phải thêm native grant | Cần pin provider/profile và rehearsal cách ly DDL thật, kiểm fail-closed; source mới phải review và rerun các gate bị ảnh hưởng |
| B — tiếp tục yêu cầu native grants như clone 01/10 | Giữ guard hiện tại và profile native đã kiểm | Chưa chứng minh có quyền/hỗ trợ cấp trên hosted; quyền membership rộng hơn thao tác policy cần dùng; cần quyết định quyền mới và kiểm lại |
| C — giữ controller hiện tại và dừng phát hành | Không thay mô hình kiểm quyền | Hai predicate vẫn chặn actor live; không giải quyết đóng task sản phẩm |

A mới là **đề xuất**, chưa được duyệt/hiện thực. Theo confirmation rule và vai trò analyst của `AGENTS.md`, thay tiêu chí guard liên quan quyền và acceptance cần chốt phần bị ảnh hưởng trước khi viết code. Không hỏi lại đích, cleanup allowlist hay yêu cầu nghiệp vụ đã được xác nhận.

Nếu chọn A, chuẩn bị spec/design/testplan của slice rồi review trước implementation: nhận diện/pin cơ chế provider; rehearsal câu cấu hình hook và policy cần dùng trên môi trường cách ly có supautils; negative cases khi thiếu preload, role, whitelist hoặc policy grant phải chặn; không cho query/config tùy ý đi qua; giữ tính nguyên tử của cleanup/activate và recovery gates. Nếu không tái tạo được profile có bằng chứng tương đương, không tuyên bố đã chứng minh hosted DDL. Không thử DDL trên live trong phạm vi khảo sát hiện tại.

Song song cần khôi phục/xác minh kênh quản trị Supabase/Edge/Storage và xác minh Vercel production/autodeploy. Không có yêu cầu cung cấp password/token trong chat. Gói kiểm quyền/kênh phát hành chưa đủ để chuyển sang cleanup/deploy; các gate tổng, final implementation review, backup/recheck allowlist và postflight trong bàn giao vẫn áp dụng.

## Hồ sơ bằng chứng và tái kiểm

Các đường dẫn artifacts dưới đây nằm tại `D:/Workspace/pos-cafe/`, được giữ local ngoài source ứng dụng. Chỉ mục metadata và snapshot helper không chứa credential; không chép credential vào docs. Artifacts chưa được commit/publish, cần giữ cùng hồ sơ bàn giao.

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/permission-release-capabilities-20261006/live-capabilities-1791256482447.json` — evidence live chính | `69107619ad9a71330620d0fe603554ee083b0f5cb5c7116902f40366a0f700ba` |
| `artifacts/permission-release-capabilities-20261006/codex-mcp-status.json` | `64cd5910000d7407d49a238282d197a79c8161e602f323a337a6ac5e2a6e4dc4` |
| `artifacts/permission-release-capabilities-20261006/probe-source/read-release-capabilities-20261006.mjs` | `9614e6a3f5d774af8758a2697c82f80e1f9ad80397ce3beb535cd34f1c6f0e41` |
| `artifacts/permission-release-capabilities-20261006/probe-source/invoke-release-capabilities-20261006.ps1` | `9207bf7b4229230eb9387b013893db2e9517a608db2dbc605b340e0a2582fbd4` |
| `artifacts/permission-release-capabilities-20261006/probe-source/read-codex-mcp-status-20261006.mjs` | `a760eb251ad98c0462feee55433ad862b3105c40367754a9dd875e64bfe80e36` |

`artifacts/permission-release-capabilities-20261006/investigation-metadata.json` ghi source binding, tool/config observations, đường dẫn/hashes helper và cờ hoạt động. Hai evidence live sơ bộ cùng thư mục được giữ lịch sử; tên đối tượng compatibility đã sửa ở evidence chính, chỉ dùng file chính cho kết luận này.

Tái kiểm khi bắt đầu slice sau: source fingerprint, đúng project/actor/TLS, snapshot catalog/provider, management request có xác thực và evidence bind môi trường. Trước cleanup phải so tập UUID/dữ liệu theo runbook dưới khóa, không dùng số lượng 77 làm điều kiện duy nhất.

## Nguyên liệu báo cáo và bàn giao

Có thể trình bày trong báo cáo: khó khăn triển khai quyền trên PostgreSQL do nhà cung cấp quản lý; khác biệt giữa quyền chuẩn, quyền thao tác dữ liệu và capability được extension ủy quyền; cách khảo sát chỉ đọc; giới hạn mô phỏng; cách giữ quyết định/kiểm thử truy vết tới source/môi trường. Bảng kết quả và phương án A/B/C cung cấp bằng chứng, lý do lựa chọn, trade-off và việc cần kiểm tiếp. Chưa có lựa chọn được duyệt ở lượt này.

Không viết thành “đã sửa lỗi quyền production”, “đã triển khai phân quyền” hoặc “đã hoàn tất cleanup”. Không chuyển các count snapshot thành minh chứng bảo toàn dữ liệu hay số test pass. Tuân thủ [quy tắc tổng hợp báo cáo](../report-source-map.md): chuyển chi tiết nội bộ thành mô tả bài toán/thiết kế/kết quả, không chép lệnh, code hoặc hash vào nội dung chính.

Walkthrough kỹ thuật có thể thực hiện cùng chủ dự án sau khi chốt slice; chưa xác nhận chủ dự án đã đọc/hiểu code. Hồ sơ này bổ sung cho [điều kiện đóng task](../workflow/tasks/permission-closeout-review-2026-10-05.md), không mở owner account/recovery/transfer, UI redesign hay workflow nhóm vào task hiện tại.
