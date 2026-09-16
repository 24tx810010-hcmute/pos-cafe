# Review review_gate_evidence — cổng reviewer, vòng 1 và xác nhận v2

- Vai trò: subagent độc lập, không tham gia viết candidate; không sửa file repo, không commit/push, không gọi reviewer lồng nhau.
- Ngày: 2026-09-16, múi giờ +07:00.
- Phạm vi: tính thực thi; ràng buộc evidence/candidate; quyền reviewer; xử lý finding và review lại; thiếu công cụ/bế tắc; tránh review đệ quy; kiểm cấu trúc, liên kết và cấu hình trong 13 file của candidate.
- Yêu cầu gốc được cung cấp khi giao review: trước bước verify cuối để bàn giao phải gọi một hoặc nhiều subagent khác kiểm độc lập, các bên đồng ý hết mới bàn giao.
- Candidate: `25496be810acffe6082a2903563890f96d9fface218fe514f9100c5ee8481664`.
- Baseline/HEAD được tự xác minh: `9937f1f005f1569b0e348374b37cc95d8b490ca5`.
- Nguồn: `work/reviewer-gate-candidate/manifest.json`, snapshot đủ 13 file và `candidate.patch`; bản tương ứng tại `D:/Workspace/pos-cafe-docs`. Đã tự đọc AGENTS, workflow, chuẩn spec, mẫu, prompt, các artifact của change và phần thay đổi CLAUDE/config. Không dùng kết luận tác giả hoặc reviewer khác làm bằng chứng.

## Kiểm tra tự thực hiện

Các lệnh OpenSpec/Git bên dưới chạy tại `D:/Workspace/pos-cafe-docs`; không chạy test ứng dụng hoặc DB.

| Phép kiểm | Kết quả thực tế |
| --- | --- |
| SHA-256 của từng file worktree và snapshot so với manifest | 26/26 khớp: 13 file tại mỗi nơi |
| So sánh `git diff --no-ext-diff --binary <baseline> -- <13 file>` với `candidate.patch` | Khớp sau chuẩn hóa CRLF/LF; file ngoài manifest không bị gộp vào phép so sánh |
| `git apply --reverse --check --ignore-space-change <candidate.patch>` | Exit 0; chỉ kiểm, không áp patch |
| `git diff --check -- <phạm vi candidate>` | Exit 0; chỉ có cảnh báo chuyển LF/CRLF theo `core.autocrlf=true`, không có lỗi whitespace |
| `openspec context` | Root thực tế là `D:/Workspace/pos-cafe-docs`, không có reference root ngoài |
| `openspec validate adopt-ai-task-workflow --strict --no-interactive` | Exit 0, `Change 'adopt-ai-task-workflow' is valid`; OpenSpec 1.10.0 |
| `openspec instructions tasks --change adopt-ai-task-workflow --json` | Exit 0; rule mới ở `openspec/config.yaml:60` xuất hiện trong `rules` CLI đã resolve, gồm ngưỡng 1/2 reviewer và APPROVE candidate cuối |
| Script riêng kiểm Markdown nội bộ trên 12 file Markdown trong manifest | 31 link/anchor hợp lệ; không có target hoặc anchor thiếu |

Script tái kiểm ở workspace của task: `work/review_gate_evidence_checks.py`; kết quả chi tiết candidate cuối tại `work/reviewer-gate-candidate-v2-evidence-checks.json`. Script xác minh hash, diff có đúng phạm vi và link/anchor; không ghi vào repo. Một thử nghiệm ban đầu ép `core.autocrlf=false` tạo chênh lệch giả trong diff; đã xác định cấu hình repo là `true`, sửa phép kiểm để dùng cấu hình thật và chạy lại thành công. Không coi chênh lệch thử nghiệm đó là lỗi candidate. Khi tác giả chuyển worktree sang v2, lần đối chiếu lại worktree với v1 phát hiện đúng hai file khác hash; snapshot v1 nguyên vẹn. Kết quả v1 là lịch sử và không được dùng để tự nhận worktree v2 đã đạt trước khi kiểm delta bên dưới.

## Đối chiếu kịch bản và evidence

Các vị trí dưới đây tính từ root `D:/Workspace/pos-cafe-docs`, trên candidate đã nêu.

| Kịch bản | Nguồn tự đối chiếu | Kết luận trong phạm vi review |
| --- | --- | --- |
| Task nhẹ chỉ có tác giả tự rà; task nhạy cảm phải có nhiều góc kiểm | `docs/workflow/README.md:91`, `:92`, `:99`; `AGENTS.md:24` | Không có đường tự miễn task nhỏ; tác động vào cổng đóng task được xếp nhạy cảm; hợp scope phải phủ tiêu chí |
| Reviewer cần kiểm source/evidence, không chỉ nghe báo cáo tác giả | `docs/workflow/README.md:95`, `:99`, `:100`; `docs/workflow/templates.md:161` | Đầu vào có yêu cầu/spec, snapshot/diff và vị trí evidence; reviewer tự đọc, tự kiểm; missing evidence thiết yếu dẫn tới BLOCKED |
| Reviewer chạy kiểm tra hoặc muốn sửa expected/candidate | `docs/workflow/README.md:94`; `:101`; `:102` | Reviewer không sửa candidate/test/expected hoặc commit/deploy; kiểm có ghi dữ liệu chỉ trong môi trường test cách ly được giao; tác giả sửa và reviewer xác nhận |
| Tác giả không đồng ý finding; một trong các reviewer chưa đồng ý | `docs/workflow/README.md:93`, `:102`, `:104` | Có đường phản biện bằng nguồn; không lấy đa số, gỡ người bất đồng hoặc tự đóng finding; bất đồng nghiệp vụ trả chủ dự án quyết định, phần phụ thuộc chưa hoàn tất |
| Reviewer A duyệt X, nội dung thay thành Y | `docs/workflow/README.md:79`, `:103`; `openspec/changes/adopt-ai-task-workflow/specs/ai-task-workflow/spec.md:90` | Evidence cũ không tự chứng minh source mới; phần ảnh hưởng được kiểm lại; reviewer không bị ảnh hưởng vẫn phải đối chiếu delta và xác nhận candidate cuối |
| Reviewer lỗi/timeout, thiếu công cụ hoặc không gọi được subagent | `docs/workflow/README.md:100`, `:106`; `openspec/changes/adopt-ai-task-workflow/specs/ai-task-workflow/spec.md:95` | Không nhận APPROVE ngầm hoặc tự review thay thế; báo BLOCKED/tiến độ với nguyên nhân; user vẫn nhận được thông tin |
| Sửa và review không tạo tiến triển | `docs/workflow/README.md:112`, `:114`; `openspec/changes/adopt-ai-task-workflow/proposal.md:76` | Chuyển sang chẩn đoán, nêu phần cần quyết định; không lặp sửa phỏng đoán hoặc đạt quota vòng là tự PASS |
| Thêm báo cáo/verdict sau khi candidate đã được duyệt | `docs/workflow/README.md:87`, `:103`; `docs/workflow/templates.md:175`; `openspec/changes/adopt-ai-task-workflow/design.md:39` | Có miễn review báo cáo đệ quy và metadata ghi sự kiện; không cho thay finding/verdict/candidate hoặc lén đổi nội dung/kết luận |
| Có đồng thuận nhưng test/permission/gate feature chưa đạt | `docs/workflow/README.md:104`; `openspec/changes/adopt-ai-task-workflow/tasks.md:22` | Đồng thuận không thay test, tiêu chí hay thẩm quyền; không tạo quyền code, push, deploy |

Đã rà TC-WF-09 và TC-WF-10 theo nghĩa kiểm tài liệu/tình huống tại `openspec/changes/adopt-ai-task-workflow/testplan.md:15` và `:16`. Các đường xử lý cần thiết có trong quy tắc và mẫu; không nhận đây là kiểm thử runtime hoặc pilot với task ứng dụng.

## Findings và verdict

Không phát hiện finding chặn hoặc đề xuất cần ghi thành finding trong phạm vi được giao.

- **Verdict: APPROVE.** Candidate có ràng buộc thực thi và evidence đủ rõ; hash/snapshot/diff và phép kiểm cấu trúc tự thực hiện đều đạt. Không thiếu công cụ hoặc nguồn thiết yếu đối với phạm vi tài liệu này.
- Candidate của verdict vòng 1: `25496be810acffe6082a2903563890f96d9fface218fe514f9100c5ee8481664`; xem xác nhận candidate cuối v2 bên dưới.
- Giới hạn: không kiểm source/hành vi POS, DB, CI, deployment, URL tham khảo ngoài hoặc sửa dở khác; không chứng minh năng suất hay tỷ lệ giảm lỗi. Phép kiểm link chỉ xác nhận đường nội bộ/anchor, không xác minh nội dung ngoài phạm vi. Chưa đánh giá commit/báo cáo/handoff được tạo sau snapshot. Nếu nội dung candidate thay đổi, cần đối chiếu delta và xác nhận lại; việc ghi nguyên báo cáo/verdict và metadata sự kiện không cần review đệ quy.
- APPROVE này là kết luận riêng cho phạm vi review được giao; không thay verdict reviewer khác, bước đối chiếu cuối của AI điều phối hoặc nghiệm thu của chủ dự án.

## Xác nhận candidate cuối v2

- Candidate cuối: **`9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af`** tại `work/reviewer-gate-candidate-v2/`.
- Đã tự chạy `git diff --no-index` giữa hai thư mục snapshot và đọc delta. Chỉ hai file nội dung đổi: `openspec/changes/adopt-ai-task-workflow/design.md:3` sửa dải DEC-WF-01–08 thành DEC-WF-01–09; `openspec/changes/adopt-ai-task-workflow/proposal.md:23` sửa dải WF-01–08 thành WF-01–09. Manifest/hash và patch đổi tương ứng; 11 file nội dung còn lại không đổi. Exit 1 của `git diff --no-index` biểu thị có delta, không phải lỗi kiểm tra.
- Tự chạy lại script trên v2: 26/26 SHA-256 của snapshot/worktree khớp manifest; patch khớp scoped diff từ baseline; 31 link/anchor nội bộ đạt, danh sách lỗi rỗng, script exit 0.
- Tự chạy lại `openspec validate adopt-ai-task-workflow --type change --strict --no-interactive` và `git diff --check` trong phạm vi: đều exit 0. Validation trả change hợp lệ. Việc CLI resolve rule và các kịch bản review dùng kết quả đã tự kiểm trên file nội dung không đổi; delta không thay cấu hình, quy tắc, mẫu, testplan hoặc tiêu chí.
- Không có finding mới hoặc chưa giải quyết trong phạm vi review. Hai sửa dải mã khớp requirement/quyết định WF-09/DEC-WF-09 đã tồn tại trong candidate.
- **Verdict cuối: APPROVE candidate `9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af` trong phạm vi được giao.** Các giới hạn ở trên tiếp tục áp dụng. Báo cáo review/checklist metadata chỉ được ghi đúng sự kiện và giữ nguyên verdict, candidate, finding; nội dung mới ngoài ngoại lệ đó cần review lại.
