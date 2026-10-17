# Xác minh phương án Supabase MCP cục bộ — 2026-10-06

## Phạm vi và kết luận

Chủ dự án gửi phương án dùng PAT riêng, cấu hình MCP và skills cục bộ, rồi yêu cầu “xác mình giúp tôi, sau khi xác mình rồi đưa tôi tính khả thi”. Đây là khảo sát tiếp của [kênh triển khai phân quyền](permission-deployment-channels-2026-10-06.md). Người dùng đang dùng chung tài khoản Codex/ChatGPT và muốn hạn chế liên kết dịch vụ cũng như việc người khác biết hoạt động Supabase. Phạm vi hiện tại là đối chiếu tài liệu và kiểm tra cục bộ; chưa được coi là chọn hoặc triển khai phương án.

**Khả thi về cơ chế kết nối:** Supabase hỗ trợ scoped PAT; Codex hỗ trợ HTTP MCP lấy bearer token từ biến môi trường. Có thể cấu hình mà không cần cài plugin Supabase hoặc dùng Sign in with ChatGPT để cấp credential Supabase. Chưa thử PAT thật hoặc initialize MCP trong scope này.

**Có điều kiện về tách quyền giữa các máy:** đăng nhập cùng ChatGPT tự nó không phải credential Supabase. Suy luận này chỉ áp dụng nếu PAT thực sự được giữ riêng, không sao chép, không có đường điều khiển host hoặc quyền Windows dùng chung, và không có kết nối Supabase độc lập khác. Chưa kiểm chứng trạng thái cụ thể của các máy/tài khoản đó.

**Không đáp ứng bảo đảm “không ai biết” hoặc “không email”:** credential cục bộ không giữ toàn bộ dữ liệu công việc trên máy. Kết quả công cụ, file hoặc browser content dùng làm đầu vào model có thể được gửi tới dịch vụ OpenAI. Lịch sử/sync/Remote/quyền hệ điều hành và thông báo của nhà cung cấp cần được xét riêng. Không xác minh hộp thư, không có nguồn cam kết không gửi email, không khẳng định chủ tài khoản có thể xem mọi chat cục bộ.

## Môi trường và bằng chứng

- Code `D:/Workspace/pos-cafe`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs worktree `D:/Workspace/pos-cafe-docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Giữ nguyên các thay đổi có sẵn, không switch/reset/stash/commit/push.
- Codex CLI trên máy: **0.160.0**. Cấu hình người dùng có SHA256 `5b4087bcad6696258c1b2aa968fed69d402e173b9692c9d77700decfe3152e20` tại phép đọc root `2026-10-06T08:48:59.2169985Z`.
- Receipt [local-presence-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-feasibility-20261006/local-presence-check.json) chỉ chứa whitelist/hash/boolean. Parser khảo sát đúng block Supabase, không xuất raw config hoặc credential; không phải bản export toàn bộ effective configuration.
- Kiểm tra schema/Remote độc lập và nguồn lệnh ở [codex-independent-check.json](D:/Workspace/pos-cafe/artifacts/supabase-local-mcp-feasibility-20261006/codex-independent-check.json). Review candidate/hash và hai verdict ở [biên bản](../reviews/2026-10-06-supabase-local-mcp-feasibility.md).
- Chỉ tra cứu tài liệu công khai và chạy lệnh đọc/parse local. Không tạo PAT, đọc token, đăng nhập, init MCP, cài skills/plugin, sửa config/env, đổi Remote, gọi API quản trị, mutation DB, cleanup hoặc deploy. Không mở/đọc lại Dashboard trong scope này; trạng thái login của các browser profile không được suy ra từ kiểm tra PAT.

## Đối chiếu hướng dẫn được gửi

| Nội dung | Kết quả xác minh / cần sửa |
| --- | --- |
| Tạo token chỉ một project, chỉ quyền cần thiết | **Đúng theo tài liệu hiện tại.** Scoped PAT chỉ thu hẹp quyền tài khoản Supabase đã có. Không thấy yêu cầu nâng gói để tạo PAT trong tài liệu đã đọc; điều này chưa chứng minh UI của tài khoản cụ thể. Không nhầm với project-scoped member role hoặc branching có điều kiện gói khác. |
| `project_ref` giới hạn quyền | Giới hạn phiên/tool MCP tới một project và bỏ account tools. **Phạm vi của credential phải giới hạn ngay lúc tạo PAT**; sửa URL không thay quyền token. |
| `read_only=true`, `features=database,docs` | Đúng về SQL chỉ đọc và lọc nhóm tool. Cấu hình này không cung cấp Edge/Storage, nên chưa giải quyết inventory quản trị còn thiếu của task. |
| `bearer_token_env_var` | Được Codex hỗ trợ. Token được dùng trong Authorization; config chứa tên biến, không cần chứa giá trị token. PAT phải hiện diện trong process thực thi MCP. |
| `default_tools_approval_mode="writes"` | Tài liệu và CLI0.160.0 chấp nhận. Việc hỏi dựa vào annotation chỉ đọc của tool; không phải giới hạn quyền nhà cung cấp hoặc phân tích SQL tuyệt đối. Chính PAT chỉ đọc và server read-only mới hạn chế quyền trong phương án này. |
| PowerShell nhập ẩn rồi lưu env `User` | Nhập ẩn tránh echo token; `.Password` chuyển sang string để lưu. Biến User được lưu Registry và dùng cho process của cùng Windows user; **không phải kho secret mã hóa**. Không chạy lệnh này trong khảo sát. |
| “config trên máy, không đồng bộ lên tài khoản” | Tài liệu xác nhận vị trí cấu hình cục bộ; chưa đủ để cam kết không bao giờ được sao chép, chia sẻ hoặc truy cập qua host. Không suy toàn bộ dữ liệu/hội thoại chỉ ở máy từ vị trí config. |
| Đưa repo config lên Git vẫn an toàn | Không có token không đồng nghĩa giữ kín metadata. Config chứa hostname/project ref; repo skills/config có thể được commit và truyền cho contributors/cloud tasks. Cần đánh giá mục tiêu riêng tư trước khi chia sẻ. |
| `npx skills add supabase/agent-skills` | Lệnh được Supabase tài liệu hóa. **Mặc định scope project**; `--global` đổi phạm vi. Skills là hướng dẫn, không cấp credential và không bắt buộc để MCP kết nối. Codex đọc repo `.agents/skills` và user `~/.agents/skills`; đích installer khác có thể là `~/.codex/skills`. Cần kiểm đích thực tế sau cài, không giả định mọi installer ghi cùng một chỗ. Installer có tải qua mạng/telemetry; không gọi cài local là hoàn toàn không có dấu vết mạng. |
| `codex mcp list` chứng minh kết nối | **Chưa đủ:** liệt kê server cấu hình. `/mcp` là nơi xem trạng thái; cần initialize thành công và một tool chỉ đọc hoạt động ở phiên thực tế mới nhận kênh đã dùng được. |
| Remote hiện có cờ giữ thức `true` | Không xác minh được: exact key `keepRemoteControlAwakeWhilePluggedIn` không xuất hiện trong file trạng thái được kiểm. Cờ giữ thức, nếu có, vẫn không chứng minh Remote bật/đã ghép thiết bị. Trạng thái enablement/pairing **NOT_VERIFIED**. |
| Thu hồi PAT khiến Codex mất quyền ngay | Có thể thu hồi credential này; chưa xác minh độ trễ hay request đang chạy. Không hủy Dashboard session, stored OAuth, DB password hoặc token độc lập khác. Không dùng câu này làm bảo đảm đã ngắt mọi kênh. |

Nguồn theo nhóm: [Supabase PAT](https://supabase.com/docs/guides/platform/personal-access-tokens), [MCP](https://supabase.com/docs/guides/ai-tools/mcp), [skills](https://supabase.com/docs/guides/ai-tools/ai-skills), [installer](https://github.com/vercel-labs/skills#telemetry); [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp), [config](https://learn.chatgpt.com/docs/config-file/config-basic), [Build skills](https://learn.chatgpt.com/docs/build-skills), [Remote](https://learn.chatgpt.com/docs/remote-connections), [local security](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-local-security); [Microsoft env persistence](https://learn.microsoft.com/en-us/dotnet/api/system.environment.setenvironmentvariable?view=net-10.0). Nguồn là tài liệu hiện tại ngày06/10; không phải response của account/project riêng trong scope này.

## Hiện trạng được kiểm trên máy

| Phép đọc | Kết quả và giới hạn |
| --- | --- |
| Exact block `[mcp_servers.supabase]` | Đã có; host `mcp.supabase.com`, project ref khớp đích `kfqjdfwxhkdwihjobpny`. Không thêm block cùng tên thứ hai nếu sau này chỉnh. |
| Các field trong block/URL khảo sát | Chưa có `bearer_token_env_var`, `read_only`, `features`, `default_tools_approval_mode` hoặc hai field headers đã kiểm. Không đọc stored OAuth; không kết luận mọi kênh auth đều thiếu. |
| `SUPABASE_ACCESS_TOKEN` | Không có giá trị ở Process/User/Machine được đọc; không tìm kiếm token ở nơi khác hoặc xác minh tài khoản Supabase sở hữu PAT. |
| Repo config/skills | `D:/Workspace/pos-cafe/.codex/config.toml` và `.agents/skills` chưa tồn tại ở vị trí kiểm; không kết luận không có skill toàn máy. |
| Parse schema độc lập | Server giả bị disabled; override không lưu. `writes` hợp lệ, exit0; `writes_not_valid` bị từ chối, exit1. Không initialize server và không xác minh prompt/runtime bằng phép parse này. |
| Remote | File `C:/Users/nguye/.codex/.codex-global-state.json` tồn tại; receipt lúc `08:53:38Z` có SHA `727f103cc21a83c6e8896de932cea6d1982dba324e32d0317eb31b4c89b2530f`, exact key match0. File trạng thái app có thể tiếp tục thay đổi; không yêu cầu hash giữ nguyên sau đó. Không xuất state/ID/danh tính thiết bị; enablement và pairing chưa kiểm. |

## Phương án khả thi nếu sau này chọn triển khai

1. Giữ credential Supabase riêng và scoped đúng project; dùng account được phép truy cập. Kiểm Remote/Windows ownership trước khi đưa credential vào host; không suy máy an toàn từ một cờ giữ thức.
2. Với scope DB đầu tiên, PAT chỉ **Database Read**, thêm **Migrations Read** nếu đọc migrations. Lấy token bằng cơ chế người dùng nhập trực tiếp và chỉ chuyển tới transport cần nó; bảo vệ lưu trữ/inheritance, không xuất token ra chat/log. Việc chọn cách lưu chưa được thực hiện.
3. Chỉnh **block MCP hiện có** trong config user. Cấu hình tham khảo dưới đây chưa áp dụng; `prompt` yêu cầu review công cụ theo chính sách client, không thay quyền PAT/server. Chưa bảo đảm app/phiên đang mở sẽ nạp ngay hoặc mọi prompt sẽ xuất hiện.

```toml
[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?project_ref=kfqjdfwxhkdwihjobpny&read_only=true&features=database,docs"
bearer_token_env_var = "SUPABASE_ACCESS_TOKEN"
default_tools_approval_mode = "prompt"
```

4. Kiểm process mới thực sự nhận token mà chỉ xuất presence; nạp lại MCP phù hợp app/CLI rồi gọi một tool chỉ đọc tối thiểu. Xác nhận PAT giới hạn project và permission ở provider; không thử write trên live để chứng minh chỉ đọc. Ghi time/target/tool/status, không lưu secret hoặc dữ liệu ngoài nhu cầu.
5. Edge/Storage inventory là scope kế tiếp: cần `functions,storage` và PAT **Edge Functions Read / Storage Read / Storage Config Read** cho list functions/buckets/config. MCP không tự giải quyết mọi object API/bytes gate hoặc Vercel binding/deployment. Không bỏ read-only để mở quyền ghi trong khảo sát.

Mapping permission lấy từ [bảng MCP tools](https://supabase.com/docs/guides/platform/personal-access-tokens#mcp-tools). Không cần API Key Secrets cho các phép đọc nói trên. Skills optional; chưa cài installer và chưa chọn phạm vi cài.

## Trạng thái bàn giao và nguyên liệu đồ án

Đầu ra hiện tại là đánh giá khả thi và các lỗi cần sửa trong hướng dẫn. Runtime PAT/MCP, email, visibility/sync của account và Remote vẫn chưa kiểm chứng. Chưa xác nhận/chọn cách lưu secret hoặc triển khai config; sản phẩm phân quyền chưa phát hành và gate tổng không thay đổi.

Hồ sơ cung cấp nguyên liệu cho vấn đề kỹ thuật: tách nhận diện model với authorization của nhà cung cấp; quyền tối thiểu ở credential/server/client; hạn chế của annotation-based approval; lưu secret cục bộ; Remote và dữ liệu ra dịch vụ model; phân biệt cấu hình hợp lệ với kênh thực sự hoạt động. Khi đưa vào luận văn, chuyển thành bài toán/phương pháp/giới hạn, không sao chép token, config nội bộ, hash hoặc lịch sử cá nhân vào phần chính. Docs còn local trên nhánh `docs`, chưa commit/publish; review theo biên bản liên kết.
