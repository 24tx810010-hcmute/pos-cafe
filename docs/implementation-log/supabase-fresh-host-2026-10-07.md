# Xác minh MCP trong host Codex mới — 07/10/2026

## Đề bài và phạm vi

Nguồn ủy quyền: sau bàn giao [local PAT/direct transport](supabase-local-mcp-setup-2026-10-07.md), chủ dự án giao “ok xác minh và xử lý bước tiếp theo”. Scope này kiểm host Codex mới sử dụng PAT hiện có, Database Read cho `kfqjdfwxhkdwihjobpny`; không tạo credential/tăng quyền, đổi cấu hình mặc định, thực thi SQL nghiệp vụ hoặc phát hành POS. Code `main@ef2c372...`, docs `docs@e47862b...` đều có dirty work sẵn; giữ nguyên, không commit/switch/reset.

## Thiết kế đã chọn trước khi chạy

CLI0.162.0-alpha.2 có app-server stdio và stable protocol `mcpServer/tool/call`. Chọn fresh app-server → initialize/initialized → thread/start với ephemeral true → MCP status → tool call; không `turn/start`, không đưa PAT vào prompt/model. Đây là thread test in-memory trong host kiểm chứng, không tạo chat công việc riêng trong app. Desktop đang mở vẫn là host khác. [OpenAI app-server](https://learn.chatgpt.com/docs/app-server)

CLI binary pin SHA256 `97c57e4eb64257bcd7a470757950886f2c59eec4aa8537908979c6475d41cc08`; explicit bearer từ encrypted store chỉ đặt trong child `ProcessStartInfo.Environment`. Không set env parent/User/Machine, không token trong argv/RPC/receipt. Raw config/auth/backup không đưa vào artifact. Thư mục làm việc test rỗng trong Temp, ngoài cây repo/private credential root, từ chối reparse point; child tắt hooks/plugins/apps/shell snapshot/shell tool bằng invocation config, kiểm effective config của host, không sửa settings đang dùng. [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference)

Phép đo parser đầu cho thấy top-level inline `mcp_servers={singleAlias...}` **vẫn list11 servers**: override map hợp nhất với config hiện có, không tự cô lập host. Chọn disable từng server khác trong invocation, pin full alias target, parser assert chỉ1 enabled trước load PAT/start host; không sửa/xóa Playwright config. `httpOrigin` của runtime bỏ query nên không chứng minh project/read-only; kết hợp endpoint pin/parser receipt với tool call thật. Prefix/scopes của PAT đã có provider evidence từ scope trước; không đọc lại UI/token.

## Yêu cầu và tiêu chí kiểm

| Mã | Bất biến / kiểm |
| --- | --- |
| FH-01 | Binary pin; offline parser chỉ alias target enabled; runtime MCP target connected/bearerToken, không host khác hoạt động |
| FH-02 | PAT chỉ child env, không argv/RPC/output/prompt; không model turn; không thay env persistent/global config |
| FH-03 | Direct tool call qua Codex host chỉ `execute_sql` + `select 1 as pos_cafe_mcp_check`; đúng constant1, RPC/error/elicitation bất ngờ không nhận là PASS |
| FH-04 | Deadline/size guards, output whitelist, đóng child process riêng trong finally; không kill Desktop/Playwright khác |
| FH-05 | Receipt/source/protocol hash + snapshot; ghi đúng chưa kiểm Desktop/model-driven call/product release; hai reviewer độc lập APPROVE candidate cuối |

Các lỗi công cụ khai báo: `CODEX_BINARY_CHANGED`, `CONFIG_PARSE_FAILED`, `CONFIG_ISOLATION_FAILED`, `APP_SERVER_START_FAILED`, `RPC_TIMEOUT`, `RPC_STREAM_ENDED`, `RPC_RESPONSE_REJECTED`, `RPC_RESPONSE_TOO_LARGE`, `UNEXPECTED_SERVER_REQUEST`, `THREAD_ID_MISSING`, `MCP_RUNTIME_UNCONFIRMED`, `OTHER_MCP_ACTIVE`, `SQL_TOOL_MISSING`, `SQL_TOOL_FAILED`, `SELECT1_UNCONFIRMED`, `LOCAL_CHECK_FAILED`; các lỗi load PAT được module local giữ riêng. Receipt chỉ fixed stage/booleans/count/error code; không provider error text/body hoặc stderr.

## Kết quả thực chạy

- **Fresh app-server MCP PASS**, command exit0; receipt `timeUtc`08:58:48 UTC (15:58:48 giờ Bangkok),07/10/2026 là lúc bắt đầu run, không phải timestamp hoàn tất. Không giữ timestamp kết thúc nguyên bản. Schema local/stable và RPC response xác nhận thread ephemeral. Host báo target connected/bearerToken, tool `execute_sql` hiện diện; call hằng số trả1. Không `turn/start` hoặc direct provider HTTP từ harness.
- Preflight cuối command exit0: parser chỉ target enabled; host effective hooks/plugins/apps/shell snapshot/shell tool đều false, URL/env name/approval/tool set đúng; preflight không nạp PAT, host preflight đã đóng. Live lặp lại effective-config assertion trước thread/start.
- Cleanup xác nhận các app-server child do harness tạo đã dừng; không nhận là mọi descendant/log đã xóa. Không xóa/sửa global config, Playwright, encrypted store hoặc auth/cache. Không chứng nhận Desktop hiện tại hoặc lời gọi MCP do model điều khiển.
-13/13 isolated checks PASS trên exact source: lấy AST predicate thật cho env/tool set và compile bounded stream class; kiểm lower/mixed-case debug env, các tên biến Supabase đã liệt kê, duplicate/missing/extra tool, multiple lines/EOF và quá2.097.152 ký tự UTF-16. Không đọc credential/gọi mạng/start host khi test.

Artifact root `D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007`:

| Bằng chứng | Kết quả / giới hạn |
| --- | --- |
| [preflight-check.json](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/preflight-check.json), [attempt2](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/preflight-check-attempt2.json), [attempt3](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/preflight-check-attempt3.json) | Historical source hash riêng; CONFIG_ISOLATION_FAILED trước PAT load/host start. Không suy token fail |
| [preflight-check-attempt4.json](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/preflight-check-attempt4.json) | PREFLIGHT_PASS, exact harness source hash `972d7a14bd8277a38b019eb7e99e0cd489262fbe07ac31011260dfa050480f11`, binary/module/helper pin |
| [live-host-check.json](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/live-host-check.json) | PASS, cùng exact source; connected/bearer/constant true, childStopped true. Booleans env/global-config/model-turn là bất biến của đường thực thi source, không phải giám sát toàn hệ điều hành |
| [host-guards-check.json](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/host-guards-check.json) |13 passed/0 failed, source hash cùng live; credentialRead false, hostStarts0/networkRequests0. Timeout/RPC error/approval paths được static review; không nhận test này đã chạy hết mọi lỗi |
| [bootstrap-diagnosis.json](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/bootstrap-diagnosis.json) | Curated từ tool outputs, ghi nguồn/giới hạn; không giả timestamp đo nguyên bản cho các phép chẩn đoán |

Không chạy whole security test cũ vì real credential đang có; không application build/test/UI-audit do không sửa POS. Phát hành sản phẩm ngoài scope.

## Sự cố và thay đổi kỹ thuật

Leaf override `mcp_servers.<name>.enabled=false` gây `invalid transport` với built-in stdio aliases trong bootstrap; dùng URL stub cho mọi server thì stdio Playwright báo `url is not supported for stdio`. Sửa bằng block disabled **đúng loại transport**: stdio có command stub `cmd.exe`, HTTP có loopback URL stub; đều enabled false, chỉ invocation. Các stub không được gọi. Parser/effective config rồi runtime status kiểm lại, không giả việc truyền `-c` đã thành công. Đây là hành vi đo trên binary đã pin, không khái quát mọi bản Codex.

Review trước live đã sửa: hash module/helper và parse/extract helper trước credential load; env filter case-insensitive theo Windows; gỡ `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, biến bearer alias có sẵn và các tên tracing/debug được liệt kê khỏi child env trước khi đặt PAT riêng. Các biến môi trường khác vẫn được kế thừa, không chứng nhận đã loại mọi bearer có thể tồn tại. Bỏ PAT khỏi ProcessStartInfo.Environment ngay sau Start; exact sorted tool set loại duplicate; server khác chỉ được absent/disabled; cwd canonical ngoài repo/docs/private root và từ chối reparse. Stderr được drain vào Stream.Null với buffer giới hạn; stdout JSONL giới hạn2.097.152 ký tự UTF-16/dòng và45s/RPC (giới hạn ký tự, không phải byte), raw config/body/ID không persist. Lỗi test synthetic đầu là chưa khai báo envName trong test, đã sửa test input, không đổi expected hoặc harness.

## Đường đọc để giải thích

- [Test-PosCafeFreshHost.ps1:161](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:161): binary/module/helper pin và offline preflight; module/helper là bốn-script candidate trước, không chứa credential.
- [Test-PosCafeFreshHost.ps1:116](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:116): tạo child, env bearer riêng, tắt debug, stdio; [dòng142](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:142) kiểm effective config.
- [Test-PosCafeFreshHost.ps1:211](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:211): ephemeral thread → status → [tool call dòng228](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:228) → unsubscribe; [dòng100](D:/Workspace/pos-cafe/artifacts/supabase-fresh-host-20261007/Test-PosCafeFreshHost.ps1:100) đóng child riêng.

Walkthrough đã cung cấp bằng đường đọc, chưa có xác nhận chủ dự án đã đọc/hiểu. Review cuối theo [biên bản](../reviews/2026-10-07-supabase-fresh-host.md), candidate/manifest riêng; candidate scope trước giữ snapshot lịch sử khi chỉ mục/handoff mới cập nhật.

## Bàn giao và nguyên liệu rubric

Với báo cáo, dùng để giải thích khác biệt giữa config parse, direct provider transport và host runtime; cấu hình hợp nhất cần kiểm bằng thực nghiệm, credential Process có thể bị process cùng Windows user/Remote dùng. Không bảo đảm email/visibility hoặc bí mật với chủ tài khoản dùng chung. Ephemeral không bảo đảm mọi log nội bộ/vết hoạt động không tồn tại. Không đưa secret/tài khoản cá nhân vào báo cáo chính. Docs chưa commit/publish.

Scope nhỏ tiếp theo là inventory Edge/Storage trên Dashboard đã đăng nhập hoặc kênh đọc phù hợp; PAT hiện chỉ DB Read nên không tự tăng quyền hoặc nhận là đã khảo sát Edge/Storage. Vercel/gate tổng/source fingerprint/phát hành vẫn theo task chính. Không cần chat công việc mới chỉ để tiếp tục; Desktop hiện tại chưa nạp route MCP này, cần xử lý runtime riêng nếu chọn dùng trực tiếp trong chat.
