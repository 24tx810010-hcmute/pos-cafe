# Review UI blockers và lộ trình đóng task — 09/10/2026

## Candidate và tiêu chí

[Candidate-01](D:/Workspace/pos-cafe/artifacts/permission-ui-closeout-20261009/candidate-01.json) đóng băng source-after756 entries cùng source tar, finite checks, diagnostic scripts/receipts, docs snapshot và audit artifacts. Phạm vi giao: kiểm G2c, sửa tối thiểu UI đã được user giao, phân loại audit và ghi lộ trình để đóng permission/PIN trước chia việc nhóm. Không duyệt phát hành hoặc thay DELIVERY/PIN acceptance.

Candidate-01 SHA-256 **`e0d263c396d8ec415e016577c166f2172d7d015dd323c43c81a42ffb188ec7a5`**; hai non-author review bên dưới đều APPROVE exact hash này. Snapshot docs trong candidate giữ bản trước verdict; cập nhật sau review chỉ ghi metadata verdict/trạng thái, không đổi source/expected/evidence.

Đối chiếu source-before→source-after cho hai file payment; kiểm guards/callbacks/số tiền/K không bị đổi, layout thấp cuộn được, checkbox label/name/disabled đúng. Coverage:6UI ba viewport, unit/build/typecheck, smoke35PASS31skip, audit rawFAIL/26nhóm được phân loại có ảnh+normal/manual click. Không ghép G2c hay các slice với current source thành gate19PIN/60PERM. Handoff không tạo quyền sửa nghiệp vụ, credential hoặc hosted ngoài scope được giao.

## Reviewer độc lập

| Reviewer | Phạm vi | Verdict |
| --- | --- | --- |
| SEC-UI-CLOSE | Diff ứng dụng, quyền/tiền/handlers, layout/click safety, scope/điều kiện đóng/deploy | **APPROVE** candidate-01 exact hash trên; không có blocker trong scope; read-only, không rerun runtime/deploy |
| COV-UI-CLOSE | Regression/UI/diagnostic, runtime/lock/source provenance, audit classification, docs/links/evidence | **APPROVE** candidate-01 exact hash trên; không có blocker; read-only, không rerun runtime/đọc private data |

Reviewer không là tác giả hoặc investigator; không sửa candidate hoặc deploy. Reviewer coverage có thể chạy lại config mock riêng sau kiểm port, không dùng hosted/Supabase suites. Findings/verdict sẽ ghi nguyên nghĩa và hash candidate cuối. Thay đổi nội dung sau freeze cần review lại; cập nhật metadata verdict không review đệ quy.

SEC đã đối chiếu source/archive/53proofs/8docs, diff hai file UI, guards/callbacks/K và layout/click diagnostics; giữ DELIVERY-01/full19PIN/full60PERM/release mở. COV đối chiếu756entries/live+snapshot, links, regression/oracles, dependency locks, riêng các attempts FAIL/PASS, report và ảnh annotated/classification26nhóm. Cả hai giới hạn APPROVE ở gói UI/closeout, không owner acceptance, release approval hoặc waiver warnings. Parent đối chiếu lại manifest/proofs/snapshots và metadata delta trước chuyển session.

## Giới hạn bàn giao

G2c và scope UI có thể hoàn tất kỹ thuật theo bằng chứng của từng bản. Task permission/PIN sản phẩm chỉ hoàn tất sau full same-source gates và release/postflight theo CLOSE-1→3. Audit vẫn FAIL,11warning thật không tự được waive; chưa owner acceptance. Walkthrough chuẩn bị ở [log](../implementation-log/permission-ui-closeout-2026-10-09.md).
