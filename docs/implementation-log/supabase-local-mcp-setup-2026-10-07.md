# Kênh Supabase chỉ đọc cục bộ — 07/10/2026

## Đề bài, phạm vi và nguồn ủy quyền

Chủ dự án yêu cầu tiến hành sau [đánh giá khả thi ngày06/10](supabase-local-mcp-feasibility-2026-10-06.md): “ok vậy ta tiến hành xử lý thôi”; khi hỏi đã có scoped PAT, trả lời “tôi không rõ, bạn check hộ”. Phạm vi của slice này là chuẩn bị nhập credential riêng trên Windows và kênh **Database Read** cho project `kfqjdfwxhkdwihjobpny`. Không nhận ủy quyền này là đã hoàn tất sản phẩm hoặc mở quyền ghi. Đây là bước công cụ trong dependency kênh triển khai đã có; ghi yêu cầu, thiết kế và kiểm chứng tại checkpoint này, không tạo change nghiệp vụ POS mới.

Code worktree `D:/Workspace/pos-cafe`, `main@ef2c372aec60d8362549e47b7aedb27126129479`; docs worktree `D:/Workspace/pos-cafe-docs`, `docs@e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Cả hai có nhiều thay đổi chưa commit từ task khác; giữ nguyên, không switch/reset/stash hoặc commit chung. Không sửa application trong slice này. Source ứng dụng đã có thay đổi ngoài slice kể từ fingerprint06/10; không dùng fingerprint cũ làm bằng chứng current candidate.

## Trạng thái tại checkpoint

| Phần | Kết quả / giới hạn |
| --- | --- |
| Dashboard | Token1 do người dùng tạo thực tế có42 capability Read/7ngày, rộng hơn slice; không dùng để kết nối. Sau xác nhận cụ thể “Thu hồi token cũ 42 Read”, agent Delete đúng `pos-cafe-local-db-readonly-20261007`; danh sách chỉ còn token2. [Bằng chứng thu hồi](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/token1-revoked.jpg). |
| Token2 | Người dùng tự Create `pos-cafe-db-only-24h-20261007-v2`, tự nhập ẩn rồi đóng popup secret. View permissions actual xác nhận scoped,1 capability/1project, Database6 endpoints READ, resource `pos-cafe-demo`, hết hạn08/10/2026. [Metadata actual](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/token-v2-permissions.jpg); không đọc clipboard hoặc giá trị token. |
| Lưu credential | Sau hai failure local và sửa validator, lần3 **TOKEN_SAVED_ENCRYPTED**; kiểm file-presence/ACL/type/decrypt-and-syntax đạt. Credential ngoài repo, DPAPI Windows user, không có PAT env User/Machine. Không lấy thất bại local làm chứng cứ loại token/provider deny. |
| Config | Đã backup trong thư mục riêng; disable block `supabase` cũ, thêm `pos_cafe_supabase_ro` mặc định disabled, URL cố định/read-only/features DB+docs, bearer env name, prompt và allowlist 4 tools. Không xóa stored OAuth. |
| Kiểm chứng cục bộ | **41/41** synthetic security checks PASS trước khi lưu token thật; config/launcher parser exit0. Sau sửa helper đọc phản hồi,11/11 isolated parser cases PASS, không đọc credential/gọi mạng. Constructor WPF là phép kiểm layout lịch sử; lần3 là nhập thật do người dùng thực hiện. |
| Runtime | **Direct HTTP MCP PASS**: initialize, tools/list có đúng1 `execute_sql`, `select 1 as pos_cafe_mcp_check` trả1; exit0 lúc08:16:26 UTC ngày07/10. Đây là transport probe, chưa phải fresh CLI hoặc Desktop MCP. App Desktop hiện tại không nhận Process env từ terminal khác; launcher dành cho **CLI mới**, chưa phải launcher Desktop. |
| Phát hành | Không thuộc slice; không migration/cleanup/deploy. Edge/Storage, Vercel và gate ứng dụng còn theo task chính. |

Phạm vi bàn giao là lưu PAT cục bộ, cấu hình/launcher đã chuẩn bị và direct MCP tối thiểu đã kiểm chứng; không nhận fresh CLI/Desktop hay sản phẩm đã kết nối/phát hành. Verdict của hai reviewer trên manifest cuối nằm ở [biên bản review](../reviews/2026-10-07-supabase-local-mcp-setup.md).

## Quyết định kỹ thuật và đánh đổi

Ngày07/10 chọn `PSCredential` xuất CLIXML trên Windows: password dùng DPAPI của Windows user; thư mục `C:/Users/nguye/AppData/Local/pos-cafe-mcp` ngoài repo, bỏ ACL inheritance, chỉ SID hiện tại và SYSTEM có Allow. Kiểm owner, ACL và reparse point trước đọc/ghi. Không lưu PAT vào env User/Machine vì các scope đó lưu chuỗi trong Registry. [Microsoft Export-Clixml](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-clixml?view=powershell-7.6)

Người dùng nhập trực tiếp bằng PowerShell7 hoặc WPF PasswordBox (`-STA`, console hidden); PasswordBox trả SecurePassword, sao chép rồi xóa control, không đọc `.Password` plaintext từ UI. Agent không truyền token qua tool arguments/chat. Save từ chối file đã có, ghi bản mã tạm, đọc kiểm rồi Move không overwrite sang tên đích. Receipt chỉ fixed status/code, được ghi trước MessageBox để không phải đợi người dùng đóng popup mới đọc được kết quả; secret disposed trước MessageBox.

Validator cuối dùng `\A...\z`, prefix `sbp_fc`, ít nhất1 suffix theo Bearer alphabet ASCII `A-Za-z0-9._~+/-`, dấu `=` chỉ cuối, tổng dài7–4096. Đây là kiểm cú pháp transport và giới hạn tài nguyên local, **không chứng minh loại/scopes/expiry/quyền PAT**. Bỏ guard loại exact hex40 vì scoped có thể trùng grammar đó; không phân loại Legacy bằng regex. [Supabase PAT](https://supabase.com/docs/guides/platform/personal-access-tokens), [RFC6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1)

Launcher đọc kho mã hóa trước khi mở Codex, chỉ set `POS_CAFE_SUPABASE_PAT_EPHEMERAL` ở Process, truyền cho CLI con và khôi phục env launcher trong finally. Pin binary CLI `0.162.0-alpha.2` tại `979a96ce184041d1/codex.exe`, SHA256 `97c57e4eb64257bcd7a470757950886f2c59eec4aa8537908979c6475d41cc08`. Pin **toàn bộ** block HTTP bằng `-c`, để thay đổi config global hoặc repo không đổi đích/read-only/credential/allowlist của lần mở này. CLI/app cập nhật thì phải kiểm lại launcher, không tự bỏ pin.

Không chọn `http_headers_helper`: stored OAuth hoặc explicit bearer có ưu tiên hơn Authorization từ helper. Tên alias mới chỉ tách cấu hình/hiển thị, không tự chứng minh cache OAuth cách ly. Route đã chọn dùng explicit nonempty bearer trong process mới; không chạy `mcp login` hoặc đọc/xóa cache OAuth. [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)

Default disabled ngăn host thông thường bật kênh PAT khi không được khởi chạy qua launcher. Allowlist chỉ `execute_sql`, `list_tables`, `list_extensions`, `search_docs`; URL có `read_only=true&features=database,docs`. Approval `prompt` là lớp client theo chính sách tool; không thay giới hạn PAT/server. [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp)

Plaintext vẫn tồn tại tạm trong bộ nhớ/Authorization/process env và được process con kế thừa. Process hoặc Remote cùng Windows user có thể dùng quyền này; DPAPI có ngoại lệ roaming profile. Không bảo đảm người sở hữu tài khoản dùng chung không thấy hội thoại, hoạt động, email hay metadata; vị trí local không có nghĩa dữ liệu cần cho model không ra dịch vụ. Không cài plugin/skills, đổi Remote hoặc xóa lịch sử để che hoạt động. [Microsoft DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata), [Codex Remote](https://learn.chatgpt.com/docs/remote-connections), [local security](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-local-security)

## Yêu cầu và cách kiểm

| Mã | Bất biến của slice | Bằng chứng / còn chờ |
| --- | --- | --- |
| LMCP-01 | Secret do người dùng nhập ẩn, không ở command line/chat, không có User/Machine env | Review Read-Host/PasswordBox; nhập thật lần3 và receipt env absence |
| LMCP-02 | Kho ngoài repo, DPAPI Windows user, owner/ACL hẹp, không reparse, không overwrite file có sẵn | Synthetic roundtrip/no plaintext/ACL/junction/owner guards; Move 2 arguments; actual encrypted store/ACL/type/decrypt-and-syntax đạt |
| LMCP-03 | Rỗng, whitespace, CR/LF, prefix khác/API key, store hỏng/sai marker/sai type bị từ chối trước auth | Format boundaries/RFC alphabet/rejection tests; hex40 có prefixfc được nhận cú pháp, type/quyền phải kiểm provider; missing-token CLI/probe exit1 trước host/request |
| LMCP-04 | Project/read-only/features/explicit bearer được pin cho host mới, không dùng config OAuth cũ | Config receipt + full override parser; live CLI chưa chạy |
| LMCP-05 | Probe chỉ fixed HTTPS, không redirect; initialize → tools/list → constant SELECT1; output whitelist | Direct live PASS; isolated parser11 cases đạt. `toolsChecked` chỉ execute_sql hiện diện đúng1, không xác minh toàn catalog hoặc annotation |
| LMCP-06 | Hồ sơ phân biệt preparation, auth runtime, Desktop reload và product release | Log/handoff này và hai review scope khác nhau; không lấy parser làm kết nối |

Local error codes ở module/scripts: `WINDOWS_PS7_REQUIRED`, `PRIVATE_PATH_OUTSIDE_ROOT`, `PRIVATE_PATH_MISSING`, `REPARSE_PATH_REJECTED`, `PRIVATE_OWNER_REJECTED`, `PRIVATE_INHERITANCE_REJECTED`, `PRIVATE_ACL_REJECTED`, `TOKEN_DECRYPT_FAILED`, `TOKEN_STORE_INVALID`, `SCOPED_PAT_REQUIRED`, `TOKEN_ALREADY_EXISTS`, `TOKEN_ENTRY_CANCELLED`, `TOKEN_PREFIX_REQUIRED`, `TOKEN_LENGTH_REJECTED`, `TOKEN_CHARACTERS_REJECTED`, `LOCAL_IO_FAILED`, `CODEX_VERSION_PATH_CHANGED`. Save hiện fixed status + whitelist reason; launcher `CODEX_NOT_STARTED`; probe chỉ stage/status/boolean/whitelist code hoặc HTTP integer code. `TOKEN_CLASSIC_REJECTED` chỉ là mã của lỗi validator đã bỏ, không còn phân loại type. Không xuất exception/provider body, Authorization hoặc credential. Đây là lỗi công cụ local, không bổ sung `AppErrorCode` ứng dụng.

## Lệnh, bằng chứng và sự cố đã sửa

Artifact root: `D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007`.

| Thực chạy | Exit / kết quả |
| --- | --- |
| PowerShell7 `check-local-security.ps1` bản cuối | 0; [local-security-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/local-security-check.json),41 passed/0 failed. Dùng credential giả; xóa riêng file thử, không tạo token thật hoặc request mạng. |
| PowerShell7 `configure-local-mcp.ps1` | Lượt1 exit1, `CONFIG_WRITE_ROLLED_BACK`; kiểm hash cũ còn nguyên. Lượt2 sau sửa exit0, [config-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/config-check.json). |
| CLI `mcp get` 2 server đã ghi | Exit0/0; enabledfalse/false, ref/URL/env/4tools khớp. Đây là parse, không initialize. Giữ nội dung các section MCP khác; updater `TrimEnd()` có thể chuẩn hóa whitespace cuối file, không chứng minh byte equality tuyệt đối. Playwright4 không bị sửa. |
| CLI `-c` full object + old disabled, `mcp get` | Exit0; [launcher-config-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/launcher-config-check.json). Không khởi chạy host/chat, không live request. |
| Save WPF nhập thật1/2 | Fail local: [attempt1](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/intake-attempt1.json) `SCOPED_PAT_REQUIRED` (chưa biết nguyên nhân riêng); [attempt2](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/intake-attempt2.json) `TOKEN_CLASSIC_REJECTED`, false-positive. Không lưu/call mạng; token1 còn rộng hơn scope đã chọn. |
| Save WPF nhập thật3 | [intake-attempt3.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/intake-attempt3.json): TOKEN_SAVED_ENCRYPTED; actual path/ACL/type/decrypt-and-syntax đạt; không export token/ciphertext. |
| Live HTTP probe lần1 | Exit1, initialize/tools-list true nhưng SELECT1_UNCONFIRMED. [Receipt dựng lại từ tool output](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/live-mcp-attempt1.json): receipt gốc bị lần2 ghi đè, không giữ timestamp/hash lần1; không giả là receipt đo nguyên bản. |
| Live HTTP probe lần2 | Exit0, [live-mcp-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/live-mcp-check.json) PASS; [source binding](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/live-mcp-source-binding.json) do tác giả ghi sau run, không phải hash do provider chứng thực. |
| Isolated helper parser | Exit0; [constant-parser-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/constant-parser-check.json),11 passed/0 failed, hash exact probe. Chỉ AST-extract helper từ trusted local source; không chạy probe, không đọc PAT/network. |
| Provider scope/thu hồi | [Receipt curated](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-setup-20261007/provider-scope-and-revocation.json) đối chiếu metadata actual và list sau Delete. Chỉ token cũ đã được xác nhận bị thu hồi; không dùng token cũ thử API. |
| Fresh CLI / Desktop | **Chưa chạy/chưa kiểm chứng**; config parser và direct transport không thay bằng chứng host thật. |

Sự cố triển khai: cộng hai byte-array trong PowerShell tạo `System.Object[]`, không khớp overload Stream.Write; catch đã rollback raw bytes và hash `9fb82b1b...` khớp. Sửa ép kiểu `[byte[]]`; config sau thành công SHA `b91ed051bb9995d96e81317fb0a86a7f2fbbd1783022def44302c0988057757b`. Hash toàn config chỉ là thời điểm receipt, không yêu cầu app giữ nguyên mãi.

Các finding đã sửa: regex `$` nhận LF cuối → `\A...\z` và LF/CR tests; launcher chỉ override enabled → pin full block; alphabet đoán quá hẹp/min16 chưa có căn cứ → RFC Bearer grammar/min1; guard hex40 → bỏ vì có thể trùng scoped, xác minh metadata thay thế. Reviewer rút khuyến nghị guard hex40 sau phản ví dụ provider. Không kết luận token1 Legacy từ code lỗi. Metadata token1 cho thấy42Read/7ngày khác draft1; không suy draft là PAT đã tạo. Review còn kiểm full object loại header/helper cạnh tranh bằng synthetic disabled parser. Không chạy application build/test/UI-audit vì không đổi UI/code POS; các checks local không phải gate sản phẩm.

Probe lần1 không nhận được kết quả do tool text bọc JSON; không phải bằng chứng authentication fail. Helper cuối đọc JSON text/nested structured data tới depth6, hoặc trích đúng array constant một trường từ text, không thực thi nội dung phản hồi.11 cases gồm plain/nested/wrapped/structured đúng1, sai2/11/key, chỉ nhắc query, thêm trường, null và quá depth. Helper chỉ xác nhận mẫu constant trong response của request; không phải bộ kiểm SQL tổng quát hoặc xác thực mọi lời văn của provider. Không mở quyền hay đổi OAuth để sửa lỗi parse.

Snapshot/manifest chỉ gồm script không có secret, config subset và docs/receipts. Không đưa raw global config, backup hoặc CLIXML credential vào artifacts/repo. Backup gốc chỉ ở thư mục private; không restore toàn file khi có thay đổi sau checkpoint. Nếu rollback cần đối chiếu current config rồi hoàn tác đúng hai section để giữ thay đổi của công việc khác. Thu hồi credential phải thực hiện tại Supabase; xóa file local hoặc disable server không tự thu hồi PAT hay OAuth độc lập.

## Bước tiếp theo và nguyên liệu báo cáo

1. Scope này đã có token2 actual DB-only/1project/hết hạn08/10, encrypted store và direct MCP PASS. Người dùng tự Create/input; agent kiểm metadata khi popup secret đóng. Token1 đã Delete sau xác nhận đúng tên/quyền/thời hạn; giữ evidence thay vì thử dùng credential cũ.
2. Scope nhỏ kế tiếp: kiểm fresh Codex host bằng launcher đã pin; ưu tiên phân biệt CLI với Desktop. Không cần tạo chat mới chỉ để đọc tiếp tài liệu; fresh process/reload để nạp env là vấn đề runtime khác. Không force-kill Desktop đang dùng. Token24h có thể hết hạn trước bước tiếp; cần người dùng tự cấp/nhập bản tương đương khi cần, không tự kéo dài scope.
3. Edge/Storage inventory và Vercel cần phạm vi đọc riêng, không mở write để khảo sát. Gate tổng, fingerprint source hiện hành và phát hành tiếp tục theo task chính; chưa đóng task sản phẩm.

Đường đọc để giải thích: module giữ kiểm đường dẫn/kho/format → Save nhập ẩn và Move → launcher pin endpoint/bearer → probe whitelist kết quả. Walkthrough đã ghi để chủ dự án đọc, **chưa xác nhận chủ dự án đã đọc/hiểu**. Với rubric, diễn giải vấn đề quyền tối thiểu, lưu secret, process inheritance, fail trước kết nối và phân biệt cấu hình hợp lệ với runtime; bỏ dữ liệu tài khoản cá nhân/đường dẫn/secret khỏi nội dung chính báo cáo. Tài liệu trên worktree `docs` còn chưa commit/publish.

| Nguồn thực thi hiện tại | Điểm đọc |
| --- | --- |
| [PosCafePat.psm1:7](C:/Users/nguye/AppData/Local/pos-cafe-mcp/PosCafePat.psm1:7) | Path/ACL/reparse guards; format dòng32, đọc kho dòng37 |
| [Save-PosCafeSupabasePat.ps1:21](C:/Users/nguye/AppData/Local/pos-cafe-mcp/Save-PosCafeSupabasePat.ps1:21) | PasswordBox; Export-Clixml dòng48, Move không overwrite dòng51 |
| [Start-PosCafeCodexCli.ps1:17](C:/Users/nguye/AppData/Local/pos-cafe-mcp/Start-PosCafeCodexCli.ps1:17) | Full block override cho CLI mới |
| [Test-PosCafeSupabaseConnection.ps1:21](C:/Users/nguye/AppData/Local/pos-cafe-mcp/Test-PosCafeSupabaseConnection.ps1:21) | Helper parser; fixed HTTP dòng43, query hằng số dòng105 |
