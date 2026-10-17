# Thesis Report Source Map

Nhánh `docs` là **nguồn dữ liệu để viết báo cáo**, không phải bản Word hoàn chỉnh. Baseline current-truth được audit ngày **2026-08-21** theo `main@c7f2f4e`.

## Nguồn kỹ thuật bổ sung — 2026-10-06

[Đối chiếu forced-PIN ngày08/10](implementation-log/permission-pin-gate-inventory-2026-10-08.md) bổ sung matrix19TC→executable/assertions→gap→evidence/source. Nêu oracle sau rollback có thể che side effect, khác biệt mock/directSQL với real transport/barriers/canary và yêu cầu gate cùng source. Slice phân tích không có test run mới, chưa PIN-T06/full product PASS; dùng làm phương pháp/khó khăn kỹ thuật và hạn chế, không chép credential/code/hash vào báo cáo chính. [Slice sửa oracle09/10](implementation-log/permission-pin-oracle-2026-10-09.md) ghi negative control/phase guard/preservation và kết quả thực chạy riêng khi hoàn tất, không lấy review inventory làm review implementation.

[Chuẩn bị Realtime ngày08/10](implementation-log/permission-realtime-preparation-2026-10-08.md) bổ sung đối chiếu gate với executable variants, khác biệt focused PASS/attested aggregate, phase legacy/candidate và contract marker, credential refresh và privacy failure evidence. Lần này chỉ inventory offline, chưa có runtime/auto/UI run mới. Dùng cho phương pháp kiểm thử/truy vết, khó khăn kỹ thuật và quyết định chia scope/context; không diễn đạt như TC55/full aggregate đã đạt.

[Full-stack isolated gates ngày08/10](implementation-log/permission-isolated-gates-2026-10-08.md) bổ sung phương pháp kiểm source/lock/fixture/service thật, phân biệt body PASS với cleanup/hook FAIL, diagnostic có whitelist, backup DB và bytes Storage riêng, reset synthetic với preservation và hậu kiểm đúng phase strict. Kết quả focused identity/images/PIN/TC44/UI đạt trên source cuối; nguyên nhân incident đầu chưa biết và gate tổng/release còn mở. Dùng cho thiết kế kiểm chứng, khó khăn kỹ thuật, trade-off và hạn chế trong rubric; không đưa credential/raw backup/IDs hoặc claim đã phát hành vào báo cáo chính.

[Runbook/readiness ngày08/10](implementation-log/permission-runbook-readiness-2026-10-08.md) bổ sung lỗi kiểm quyền quản lý khi đọc ảnh phục vụ gọi món, lựa chọn giữ guard phiên/PIN và quyền ghi, regression thất bại trước sửa/đạt sau sửa; phân biệt unit/mock/UI với integration service. [Phân loại UI](implementation-log/permission-ui-audit-triage-2026-10-08.md) giữ FAIL, ảnh/DOM mobile và false positive về vùng label. [Runbook](runbooks/permission-release-runbook-2026-10-08.md) ghi cổng dừng, unknown COMMIT/Storage pending, rollout backend trước frontend. Dùng cho phương pháp kiểm chứng, thiết kế phân quyền, trade-off và hạn chế; không nhận local PASS là đã phát hành hoặc UI sạch. Khi viết báo cáo chính, diễn đạt ở mức kiến trúc/nghiệp vụ/kết quả, không chép code/hash/commands nội bộ.

[Inventory Vercel ngày07/10](implementation-log/vercel-binding-inventory-2026-10-07.md) bổ sung binding repo/branch/domain/deployment, project settings khác overrides theo deployment và rủi ro thứ tự khi push main tự cập nhật Production. Env Secret chỉ xác minh tên/phạm vi, không đọc lại values hay suy compiled mode/backend binding. Dùng cho phương pháp, trade-off và giới hạn triển khai nhiều dịch vụ; không nhận Ready là nghiệm thu sản phẩm. Ảnh/account/ID chỉ là evidence nội bộ, không đưa nguyên trạng vào báo cáo chính.

[Inventory Edge/Storage ngày07/10](implementation-log/supabase-edge-storage-inventory-2026-10-07.md) bổ sung đối chiếu hosted legacy với image candidate: functions/staging chưa xuất hiện trong Dashboard list, public bucket và bốn predicates đã đọc. Dùng để giải thích metadata khác runtime gate, public serving khác SELECT/list hoặc mutation RLS, JWT riêng và rollout phối hợp. Không coi là direct API proof, Storage behavior/cleanup/deploy hoặc bảo đảm privacy/email; ảnh có account/identifier chỉ dùng nội bộ.

[Fresh Codex MCP host ngày07/10](implementation-log/supabase-fresh-host-2026-10-07.md) bổ sung kiểm chứng tầng host thật, cách tách PAT khỏi prompt/model turn và lỗi merge/transport của cấu hình. App-server constant1 PASS,13 guard checks đạt; Desktop/model-driven call/product gate chưa được chứng nhận. Dùng cho phương pháp kiểm chứng/quyền tối thiểu và giới hạn, không nhận zero logging hoặc toàn sản phẩm đã phát hành.

[Kênh Supabase chỉ đọc ngày07/10](implementation-log/supabase-local-mcp-setup-2026-10-07.md) ghi DPAPI/ACL/WPF input, pin Process bearer/fresh host và lỗi rollback/regex/config precedence/type-guard/response parser đã sửa.41 security +11 parser checks dùng dữ liệu giả; metadata actual chứng minh DB-only/1project/24h, direct MCP SELECT1 PASS và token cũ rộng quyền đã thu hồi. Fresh CLI/Desktop/product rollout chưa kiểm chứng. Dùng làm phương pháp/giới hạn và bằng chứng transport tối thiểu; không đưa tài khoản cá nhân/secret/đường dẫn vào báo cáo chính.

[Đánh giá Supabase MCP cục bộ](implementation-log/supabase-local-mcp-feasibility-2026-10-06.md) bổ sung vấn đề authorization tách khỏi tài khoản model, quyền tối thiểu và lưu credential, giới hạn approval theo annotation, Remote và dữ liệu đưa vào model. Đây là xác minh tài liệu/cấu hình/schema, chưa phải PAT runtime hoặc bảo đảm không lộ hoạt động/không email. Không đưa lịch sử tài khoản cá nhân hoặc config/secret vào phần chính báo cáo; review theo biên bản trong hồ sơ.

[Khảo sát kênh triển khai](implementation-log/permission-deployment-channels-2026-10-06.md) bổ sung nguyên liệu về triển khai nhiều dịch vụ, cấu hình JWT riêng, binding frontend/backend và kiểm auto-deploy trước phát hành phối hợp. Có response GitHub/HTTP mới và giới hạn bản ghi deployment lịch sử; management còn chờ kênh xác thực phù hợp yêu cầu email. Không dùng thành bằng chứng đã deploy, đã xác minh mọi kênh hoặc bảo đảm không gửi email; review theo biên bản trong hồ sơ.

**Checkpoint sau khảo sát:** chủ dự án chọn PGCG-D01 và [slice guard provider](implementation-log/permission-provider-capability-guard-2026-10-06.md) đã có implementation và kiểm chứng local 77 tooling/7 runtime scenarios; review theo biên bản trong log. Dùng làm nguyên liệu về lựa chọn thiết kế, cơ chế kiểm quyền, môi trường thử và xử lý lỗi harness. Đây là kết quả trên clone pin binary/profile, chưa là hosted DDL hoặc rollout sản phẩm. Đoạn khảo sát phía dưới giữ checkpoint trước quyết định/implementation.

[Khảo sát quyền/kênh phát hành phân quyền](implementation-log/permission-release-capabilities-2026-10-06.md) bổ sung nguyên liệu cho phần khó khăn kỹ thuật, phương pháp kiểm chứng và giới hạn triển khai: quyền PostgreSQL chuẩn có thể khác capability do extension của nhà cung cấp ủy quyền; clone thiếu profile provider không đủ để kết luận live cần thêm quyền. Hồ sơ có snapshot live chỉ đọc, source/evidence binding, tài liệu chính thức, phương án và trade-off. Phương án điều chỉnh guard mới được đề xuất, chưa được duyệt/hiện thực; DDL hosted và các kênh deployment chưa được kiểm chứng. Không dùng khảo sát này làm kết quả phát hành, cleanup hoặc gate ứng dụng đã pass.

Khi viết báo cáo, diễn giải thành bài toán, cách khảo sát, lập luận thiết kế và giới hạn bằng chứng. Các đường dẫn, code, hash và tên công cụ chẩn đoán trong log chỉ phục vụ truy vết nội bộ; tiếp tục áp dụng quy tắc bên dưới. Không thay baseline lịch sử bằng kết quả của một probe.

## Quy Tắc Cứng Cho AI Tổng Hợp Báo Cáo

**Nguồn thiết kế ngày 2026-09-15:** [permission model](../openspec/changes/redesign-permission-model/proposal.md) cung cấp yêu cầu, use case, thiết kế và 60 ca nghiệm thu dự kiến cho catalog 15 quyền. Dùng ở phần phân tích/thiết kế; chưa dùng làm kết quả triển khai hoặc số test đã chạy. [Traceability](../openspec/changes/redesign-permission-model/traceability.md) chứng minh độ phủ kế hoạch, không chứng minh gate runtime đã đạt. Các quy tắc trình bày dưới đây vẫn áp dụng.

Bản sau review ngoài áp Q15, tách quyền xem/in, sửa hợp đồng T01 và evidence theo source/profile. Trạng thái hiện hành theo [quyết định bỏ Kế toán](reviews/2026-09-14-permission-model/11-bo-ke-toan-chuan-bi-t02-2026-09-15.md) và [biên bản T07](implementation-log/permission-t07-read-projections-2026-09-16.md); các bàn giao06–08 là lịch sử. Kết quả đã có gồm catalog SQL/bridge, core/DTO/ports/mock, identity/owner/session/bootstrap, quản trị/audit/ACL, financial authority/read projection candidate và kiểm thử cách ly. Chưa dùng làm bằng chứng UI mới, server bảo vệ đủ15 quyền hoặc rollout hoàn tất.

Khi dùng nhánh này để viết báo cáo tiểu luận, AI **không được sao chép hoặc đưa trực tiếp artefact triển khai vào nội dung báo cáo**, gồm:

- Source code hoặc code snippet.
- Tên/đường dẫn file, folder và test file trong repository.
- Tên class, function, hook, component hoặc biến nội bộ.
- Commit hash, branch, pull request hoặc lịch sử Git.
- Tên/số từng migration như `001`–`013`, nội dung SQL hoặc migration ledger.
- Lệnh terminal, package config, environment variable hoặc chi tiết setup nội bộ.

Các artefact trên chỉ được dùng nội bộ để:

- Kiểm chứng một claim là đúng với code hiện hành.
- Suy ra bảng, trường, kiểu dữ liệu, PK/FK, quan hệ và constraint cuối cùng.
- Hiểu luồng nghiệp vụ, transaction, phân quyền, kiểm thử và giới hạn.
- Hỗ trợ triển khai hoặc bảo trì dự án, không phải làm nội dung báo cáo.

Khi chuyển thông tin sang báo cáo, AI phải diễn đạt ở mức **bài toán, yêu cầu, thiết kế, kiến trúc, mô hình dữ liệu, thuật toán/luồng nghiệp vụ và kết quả kiểm thử**. Dùng văn xuôi, bảng, ERD, flowchart hoặc pseudocode khái quát; không thay bằng code thật.

Riêng chương cơ sở dữ liệu:

- Trình bày trạng thái schema cuối cùng, không kể lịch sử từng migration.
- Nêu bảng, trường quan trọng, kiểu dữ liệu, PK/FK, cardinality, constraint và quy tắc nghiệp vụ.
- Có thể nói một câu rằng schema được quản lý bằng SQL migration có phiên bản; không liệt kê tên/số/file migration.

Chỉ được đưa code/file/migration vào **phụ lục** khi người dùng yêu cầu rõ hoặc mẫu báo cáo bắt buộc. Trước khi làm vậy phải hỏi lại người dùng và chỉ trích phần tối thiểu cần thiết.

## Thứ Tự Tin Cậy

1. Code, tests và SQL migrations trên `main`.
2. Root docs trong thư mục `docs/` — trạng thái hiện hành đã tổng hợp.
3. `implementation-log/` — bằng chứng lịch sử theo checkpoint.
4. `archive/` — spec/audit cũ để truy vết, không phải current truth.

Nếu có mâu thuẫn, kiểm tra code/migration trước rồi cập nhật root docs. Không lấy kết quả test hoặc gap trong phase cũ làm trạng thái hiện hành khi phase sau đã supersede.

## Ánh Xạ Sang Cấu Trúc Báo Cáo

| Phần báo cáo gợi ý | Nguồn chính |
| --- | --- |
| Mở đầu, bài toán, mục tiêu | [project-overview.md](project-overview.md) |
| Phạm vi và đối tượng sử dụng | [requirements.md](requirements.md), [phase-scope.md](phase-scope.md) |
| Khảo sát/chức năng hệ thống | [features.md](features.md), [screens.md](screens.md) |
| Phân tích yêu cầu và traceability | [requirements.md](requirements.md) |
| Thiết kế kiến trúc | [architecture.md](architecture.md), [tech-stack.md](tech-stack.md) |
| Thiết kế cơ sở dữ liệu | [data-model.md](data-model.md) |
| Cài đặt và quyết định kỹ thuật | [implementation-log/README.md](implementation-log/README.md) |
| Kiểm thử và đánh giá | [testing.md](testing.md), [demo-runbook.md](demo-runbook.md) |
| Kế hoạch và trình tự thực hiện | [roadmap.md](roadmap.md) |
| Hạn chế và hướng phát triển | [limitations.md](limitations.md), [roadmap.md](roadmap.md) giai đoạn 2 |
| Phụ lục/demo | [demo-runbook.md](demo-runbook.md), [screenshots/README.md](screenshots/README.md) |

## Cách Dùng Phase Log

- Dùng để lấy timeline, commit, mục tiêu, cách triển khai, test tại thời điểm đó và quyết định phát sinh.
- Khi trích số liệu test, ghi rõ đó là checkpoint lịch sử hay baseline hiện tại.
- Nếu phase cũ ghi failure/gap đã được phase sau sửa, trình bày như diễn biến phát triển, không ghi thành lỗi hiện hành.
- Phase 09–23 phù hợp làm case study feature; phase 24 mô tả lần audit tài liệu report-ready, không phải feature code mới.

## Các Claim An Toàn

- Có thể claim app có 15 bảng nghiệp vụ ở trạng thái schema cuối cùng, schema được quản lý bằng migration có phiên bản và order/payment dùng transaction phía database; không liệt kê migration cụ thể trong báo cáo.
- Có thể claim local baseline ngày 2026-08-21 trên `main@c7f2f4e` đạt 260/260 test (49 test files) và production build pass. Mock smoke 34 pass là kết quả ngày 2026-08-12; phải ghi đúng ngày và giữ riêng evidence cloud.
- Có thể claim áp dụng Ports & Adapters theo hướng Hexagonal Architecture; không nên claim textbook hexagonal tuyệt đối.
- Có thể claim RLS cô lập store; không claim employee PIN là DB identity hoặc quyền per-employee chống client độc hại.
- Có thể claim online realtime invalidate/refetch; không claim offline hoặc SLA cứng ≤5 giây.
- Có thể claim cash payment và browser print preview; không claim QR processing hoặc máy in POS thật.
- Có thể claim mutation order/payment chạy trong transaction phía database, có khóa chống tranh chấp giữa nhiều thiết bị và optimistic locking chống ghi đè; **không** liệt kê tên hàm khóa, tên RPC hay số migration trong báo cáo. Có thể nêu như một hạn chế rằng phạm vi khóa hiện ở mức cửa hàng nên ghi POS trong cùng một cửa hàng là tuần tự.
- Có thể claim đồng bộ đa thiết bị dùng kênh thời gian thực trên nền WebSocket do nền tảng backend cung cấp, kết hợp tải lại theo chu kỳ làm lưới an toàn; **không** claim đã tự hiện thực giao thức WebSocket, và **không** claim kiểm soát được backoff/heartbeat của kết nối.
- **Không claim seam là tính năng.** Danh sách đầy đủ các phần có code hoặc schema nhưng chưa có entry point trên UI nằm ở mục "Seam: Có Code Nhưng CHƯA Dùng Trên UI" trong [features.md](features.md). Khi nhắc tới chúng phải dùng đúng chữ **chưa dùng trên UI** hoặc **chưa có entry point**, đưa vào chương hạn chế và hướng phát triển; không viết "đã hỗ trợ", "đã có" hay liệt kê trong bảng chức năng.
- Có thể claim màn lịch sử đơn hiển thị số thứ tự theo bộ lọc và **cố ý không hiển thị số bill**, vì số bill chỉ duy nhất trong phạm vi một ngày kinh doanh; trình bày đây là quyết định thiết kế, không phải hạn chế.

## Artefact Còn Cần Bổ Sung Ngoài Nhánh Docs

- File Word theo mẫu của trường, trang bìa, thông tin sinh viên/giảng viên và quy định định dạng.
- Screenshot mới từ `main@c7f2f4e`, sơ đồ kiến trúc/ERD đã render và hình minh họa demo.
- URL deployment live, ngày kiểm tra, cấu hình môi trường đã che secret.
- Tài liệu tham khảo. Nguồn chính thức của React, PostgreSQL, Supabase, realtime và RLS vẫn dùng cho các khẳng định về hành vi công cụ. Nguồn học thuật cho kiến trúc, giao dịch, chống trùng, phân quyền và kiểm thử: danh mục đề xuất kèm chỗ trích dự kiến ở [references.md](references.md), lập 2026-09-12 sau nhận xét phản biện. Danh mục đó chưa được đối chiếu bản in và chưa chốt quy cách trích dẫn.
- Kết quả khảo sát người dùng hoặc benchmark nếu báo cáo yêu cầu; repository hiện chưa có dữ liệu này.

## Checklist Trước Khi Viết Word

- Chốt baseline main/docs và ghi ngày.
- Chỉ đưa tính năng `Đã triển khai` từ [requirements.md](requirements.md).
- Dẫn các tính năng hoãn sang chương hướng phát triển, không mô tả như chức năng hiện có.
- Dùng [testing.md](testing.md) làm nguồn duy nhất cho số liệu baseline kiểm thử.
- Chuyển evidence kỹ thuật thành mô tả thiết kế; không sao chép code, đường dẫn file, symbol, commit, migration hoặc lệnh terminal.
- Chụp lại UI/diagram theo checklist và lưu trong artefact báo cáo riêng.
- Rà lại deployment URL và cloud migration trước ngày nộp/bảo vệ.
