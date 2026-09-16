# Review độc lập — tính đầy đủ và nhất quán của cổng review

- Reviewer: `/root/review_gate_requirements`.
- Vai trò: reviewer độc lập, không tham gia tạo candidate; không sửa candidate, không sửa dự án, không gọi reviewer lồng nhau.
- Ngày: 2026-09-16.
- Phạm vi: yêu cầu review trước bàn giao; đường đóng task/đồng thuận; tính nhất quán của entrypoint, quy trình, spec, testplan, traceability và template trong 13 file được giao.
- Candidate: `25496be810acffe6082a2903563890f96d9fface218fe514f9100c5ee8481664`.
- Baseline ghi trong manifest: `9937f1f005f1569b0e348374b37cc95d8b490ca5`.
- Snapshot tự đọc: `C:/Users/nguye/Documents/Codex/2026-09-16/1-ph-n-m-m-khi/work/reviewer-gate-candidate/`.
- Các vị trí `file:dòng` dưới đây tính theo snapshot này, không theo working tree đang sửa.

**Verdict: APPROVE trong phạm vi được giao.** Không có finding chặn. Một đề xuất nhỏ về tính nhất quán của phần giới thiệu không làm mất hoặc làm yếu WF-09.

## Nguồn và kiểm tra tự thực hiện

1. Tự đọc `D:/Workspace/pos-cafe-docs/AGENTS.md`, yêu cầu gốc được trích trong nhiệm vụ review, toàn bộ `candidate.patch`, manifest và nội dung liên quan của 13 file snapshot. Không nhận kết luận của reviewer khác làm bằng chứng.
2. Dùng `Get-FileHash -Algorithm SHA256` kiểm từng file so với manifest: **13/13 khớp**. Candidate ID ở trên lấy từ manifest; phép kiểm này xác minh 13 hash nội dung, không tự suy thuật toán tạo trường ID.
3. Dùng `git apply --stat candidate.patch`: **13 file, 117 dòng thêm, 6 dòng bỏ**, chỉ tài liệu Markdown/cấu hình hướng dẫn. Không có code ứng dụng trong patch được giao.
4. Đọc đối chiếu các điểm vào: `AGENTS.md:24`, `CLAUDE.md:241`, `docs/workflow/start-task.md:26`, `openspec/SPEC-STANDARD.md:167`, `openspec/config.yaml:60`; tất cả đều dẫn đến cổng review hoặc nêu điều kiện bắt buộc phù hợp với cổng.
5. Tự kiểm hai anchor `review-doc-lap`: mỗi anchor xuất hiện đúng một lần tại workflow và templates; các file đích của liên kết cổng mới đều có trong snapshot.
6. Rà tình huống TC-WF-09/10 và phản ví dụ dưới đây bằng cách đối chiếu quy tắc, không coi đây là runtime test.

## Đối chiếu yêu cầu và các đường có thể vượt cổng

| Tình huống | Kết quả tự đối chiếu và bằng chứng |
| --- | --- |
| Tác giả tự kiểm hoặc gọi người đã tạo phần được review | Không đủ điều kiện. `docs/workflow/README.md:91` yêu cầu subagent không tham gia tạo phần được giao; `:95` yêu cầu đọc yêu cầu/spec/candidate độc lập; `:100` cấm suy PASS từ lời tác giả. |
| Task tài liệu, spec, sửa nhỏ bị miễn review | Không được miễn. `docs/workflow/README.md:87` nêu rõ cả spec/tài liệu/bảo trì nhỏ; `:91` giữ mức tối thiểu một reviewer. `AGENTS.md:24` và `openspec/SPEC-STANDARD.md:167` lặp lại đúng phạm vi này. |
| Hai reviewer nhưng cùng kiểm phần dễ, bỏ phần nghiệm thu còn lại | Không đủ điều kiện. `docs/workflow/README.md:99` buộc hợp phạm vi phủ toàn bộ tiêu chí nghiệm thu. `docs/workflow/templates.md:107` có trường ghi độ phủ. |
| Một reviewer APPROVE, người khác bất đồng; đổi reviewer hoặc lấy đa số để kết thúc | Không được qua. `docs/workflow/README.md:93`, `:102`, `:104` cấm gỡ reviewer bất đồng, bỏ phiếu và nhận hoàn tất khi chưa đủ APPROVE. WF-09 và scenario tại `openspec/changes/adopt-ai-task-workflow/specs/ai-task-workflow/spec.md:81`, `:85`–`:86` nhất quán. |
| Tác giả tự hạ nhãn hoặc tự đóng finding | Không được qua. `docs/workflow/README.md:101` quy định lỗi đúng-sai, thiếu evidence thiết yếu, sai phạm vi/quyền luôn chặn; `:102` yêu cầu reviewer xác nhận đã giải quyết hoặc không phải lỗi. Template tại `docs/workflow/templates.md:108`, `:175` giữ nguồn xác nhận và cấm tác giả sửa verdict. |
| Review X rồi sửa thành Y, ghép các APPROVE cũ | Không đủ điều kiện. `docs/workflow/README.md:103` yêu cầu mọi reviewer bắt buộc xác nhận candidate cuối; reviewer không bị ảnh hưởng vẫn đối chiếu delta. `:79` cấm ghép báo cáo khác fingerprint. |
| Ghi thay đổi nội dung thành metadata để khỏi review | Bị cấm. `docs/workflow/README.md:103` chỉ miễn metadata ghi chính sự kiện review và buộc giữ finding/verdict/candidate; `openspec/changes/adopt-ai-task-workflow/design.md:39` cấm đổi quy tắc/expected/finding/kết luận trong metadata. |
| Reviewer không có evidence, timeout, lỗi công cụ hoặc hết lượt | Không được suy APPROVE. `docs/workflow/README.md:100`, `:106` quy định BLOCKED và báo rõ chưa qua cổng; vẫn cho gửi tiến độ/câu hỏi/blocker. |
| Hai reviewer cùng đồng ý nhưng test bắt buộc chưa đạt | Không đủ điều kiện. `docs/workflow/README.md:104` giữ riêng điều kiện kiểm tra bắt buộc đạt và AI điều phối đối chiếu evidence cuối. |
| Chính sửa đổi cơ chế đóng task này bị xem là việc nhẹ | Không phù hợp quy tắc. `docs/workflow/README.md:92` xếp thay cơ chế đóng task vào nhạy cảm; `openspec/changes/adopt-ai-task-workflow/design.md:37` và `tasks.md:19` yêu cầu hai reviewer cho candidate này. |
| Báo cáo reviewer tự kéo theo vô hạn reviewer mới | Được giới hạn rõ. `docs/workflow/README.md:87` miễn review lồng nhau cho phiên chỉ kiểm và trả finding/verdict; không miễn review cho tác giả của deliverable. |

WF-09 có TC-WF-09/10 tại `openspec/changes/adopt-ai-task-workflow/testplan.md:15`–`:16`; traceability nối requirement với hai case tại `traceability.md:13`, nối DEC-WF-09 tại `:23`. Task 8–9 còn để trống trong candidate (`tasks.md:19`–`:20`), phù hợp việc review và ghi bàn giao đang diễn ra; chưa có tuyên bố giả rằng cổng mới đã hoàn tất.

## Finding

| Finding | Chặn / không chặn và lý do | Vị trí + bằng chứng | Tác động | Cách kiểm lại | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| RQ-N1 | **Đề xuất không chặn**: các đoạn giới thiệu chưa cập nhật dải mã; quy tắc chuẩn WF-09, DEC-WF-09 và traceability vẫn hiện diện rõ, không tạo ngoại lệ đóng task. | `openspec/changes/adopt-ai-task-workflow/proposal.md:23` còn giới thiệu `WF-01`–`WF-08`; `openspec/changes/adopt-ai-task-workflow/design.md:3` còn ghi tham chiếu DEC-WF-01–08, trong khi phần bổ sung đã có WF-09/DEC-WF-09. | Người đọc phần giới thiệu có thể hiểu thiếu một requirement/quyết định mới, nhưng đọc phần quy định vẫn nhận đủ cổng. | Nếu chỉnh, đổi dải hiện hành thành 01–09 hoặc ghi rõ 01–08 là gói ban đầu; kiểm delta theo quy tắc candidate cuối. | Mở ở mức đề xuất; không cản APPROVE. |

## Giới hạn

- Không chạy build/test ứng dụng, DB, UI, kiểm hiệu quả pilot hay đo tỷ lệ giảm lỗi; candidate chỉ đổi hướng dẫn.
- Không chạy OpenSpec CLI/strict trong lượt review này; đó là kiểm cấu trúc thuộc phạm vi kiểm chứng khác. Kết luận này dựa trên việc tự đọc nội dung, hash và kịch bản quy tắc, không khẳng định CLI đã PASS.
- Không kiểm mọi external link, không review sửa dở ngoài manifest, không kiểm commit/push hoặc hồ sơ bàn giao được thêm sau snapshot.
- Chưa đánh giá verdict của reviewer thứ hai; APPROVE này chỉ phủ phạm vi được giao cho reviewer requirements, không tự xác nhận toàn bộ task đã qua cổng.
- Candidate được APPROVE chính là `25496be810acffe6082a2903563890f96d9fface218fe514f9100c5ee8481664`. Nếu nội dung thay đổi, cần xác nhận lại trên candidate mới; metadata chỉ ghi đúng sự kiện review áp dụng ngoại lệ đã nêu.

## Xác nhận lại candidate v2 — 2026-09-16

- Candidate mới: `9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af`.
- Snapshot mới tự kiểm: `C:/Users/nguye/Documents/Codex/2026-09-16/1-ph-n-m-m-khi/work/reviewer-gate-candidate-v2/`.
- Tự tính lại SHA256: **13/13 file khớp manifest v2**; **11/13 file giống byte với v1**, chỉ `proposal.md` và `design.md` đổi nội dung.
- Tự đọc `git diff --no-index` giữa hai thư mục: ngoài manifest/candidate.patch được cập nhật tương ứng, delta nội dung đúng hai thay đổi: `openspec/changes/adopt-ai-task-workflow/proposal.md:23` đổi `WF-08` thành `WF-09`; `openspec/changes/adopt-ai-task-workflow/design.md:3` đổi `DEC-WF-01–08` thành `DEC-WF-01–09`. Exit code 1 của lệnh diff biểu thị có khác biệt như dự kiến.
- **RQ-N1: đã sửa, reviewer xác nhận đóng.** Dải mã giới thiệu nay thống nhất với requirement/quyết định mới; không có thay đổi quy tắc, expected, kết luận hay phạm vi khác.
- Tái dùng lượt review v1 cho 11 file không đổi và toàn bộ nội dung còn nguyên trong hai file được sửa; delta trên đã được kiểm trực tiếp.
- **Verdict cuối: APPROVE** candidate `9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af` trong phạm vi requirements/consistency. Không còn finding mở của reviewer này.
- Giới hạn của lượt review đầu vẫn giữ nguyên. Hồ sơ metadata/checklist/handoff thêm sau chưa được kiểm trong snapshot v2; ngoại lệ chỉ áp dụng khi chúng ghi đúng sự kiện review, giữ nguyên finding/verdict/candidate và không đổi nội dung quy tắc.
