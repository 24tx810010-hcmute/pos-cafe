# Review G2b — forced PIN completion race hai thiết bị

Ngày 09/10/2026. Phạm vi: hai ordering complete/complete trong bước 1 TC-PIN-08, trên target local tổng hợp G2b. [Implementation log](../implementation-log/permission-pin-completion-race-2026-10-09.md) và [handoff](../workflow/tasks/permission-pin-completion-race-2026-10-09.md) ghi quyền, expected và giới hạn.

## Candidate-01 bị yêu cầu sửa

Candidate-01 SHA-256 `B646D195660B093AA1B45E7A0A371BB58B3ECF8027D0E21552BB8F58E5CB7C0B`, source-01, UI attempt01 2/2, lock tooling8/8, reporter tooling4/4, preservation G1/G2a PASS. Hai reviewer độc lập đã đối chiếu source/docs/archive hashes và tự chạy tooling; cả hai trả **CHANGES_REQUESTED candidate-01** cho cùng finding chặn:

- `CompletionGate.cleanup()` tại [source-01 browser spec:222](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/source-01/tests/supabase/permissionPinCompletionRace.spec.ts:222) chỉ đợi promise `forwarded`, được resolve trước ACK và `route.fulfill`. `finally` có thể đóng context khi handler còn chạy; lỗi fulfill/abort sau đó không được phản ánh vào kết quả cleanup. Điều này trái yêu cầu phải đợi request settle và giữ cleanup failure thành FAIL. Log source-01 đã mô tả cleanup mạnh hơn code thực tế.
- Reviewer coverage ghi thêm giới hạn evidence: `tsc -b` repo không include harness G2b. Parent đã chạy targeted strict/noEmit tsc trên toàn bộ TS/config G2b exit 0 sau candidate-01 freeze; cần ghi rõ trong candidate mới.

Candidate-01 giữ nguyên làm lịch sử, không chuyển verdict thành APPROVE. Source-02 sửa gate theo dõi handler settled sau `route.fulfill` hoặc abort, cleanup chờ settled với deadline và báo FAIL nếu handler lỗi/duplicate. [Source-02 archive](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/source-02.tar) SHA-256 `d37d28add5b914777c7675690981f4b7c5997441e880ba7ce73857d8ad3d6e57`; trên DB G2b dựng sạch lại, [UI attempt02](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/ui-attempt-02-safe.json) 2/2 PASS. Repo typecheck, targeted strict G2b typecheck, lock8/8, reporter4/4 và [G1/G2a preservation](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/old-postflight-source02-safe.json) PASS. Final candidate-02 còn cần freeze/review lại.

## Gate candidate mới đang chờ

[Candidate-01 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/candidate-01.json) khóa lịch sử source-01. [Candidate-02 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/candidate-02.json) khóa source-02, bản sao docs/spec có thể phục hồi, kết quả browser/tooling/typecheck, preservation của cả hai target cũ và attestation runtime. Hai reviewer **không tham gia tạo candidate** sẽ kiểm riêng (1) authority/transaction/fixture/privacy, (2) coverage/UI/evidence/authorization/docs. Mỗi người phải ghi `APPROVE` đúng candidate cuối; im lặng hoặc PASS của G1/G2a không thay thế.

## Verdict candidate-02 — metadata sau freeze

Ghi lúc 07:42 UTC ngày 09/10/2026 sau freeze; chỉ thêm verdict vào hồ sơ review, không đổi source, requirement, expected, evidence hay docs kỹ thuật của candidate-02 SHA-256 `FF3DB5AFC074342CE1CC0B7FEBCA88000426903DF4F05CDEA4E4D45B828F99D1`.

- Reviewer `review_security` (non-author) — **APPROVE candidate-02** trong scope security/transaction/fixture/privacy. Đã đối chiếu 740 source entries, 19 artifact hashes, sáu docs hashes, archive bytes 738/738 + 6/6, tự chạy targeted strict TypeScript exit 0; SEC-01 đóng bởi settlement sau fulfill/abort và cleanup bounded. Không còn finding chặn.
- Reviewer `review_coverage` (non-author) — **APPROVE candidate-02** trong scope coverage/UI/evidence/authorization/docs. Đã đối chiếu source/docs/archive/evidence không drift, tự chạy targeted strict TypeScript exit 0; xác nhận attempt02 2/2, ACK/authority/financial/print và history candidate-01 đúng scope. Không còn finding chặn.

Hai reviewer không tham gia tạo candidate. Họ không chạy lại suite DB/browser có mutation; fault injection riêng vào lỗi fulfill/abort chưa có runtime evidence và đã ghi là giới hạn. Gate review độc lập của **G2b hai complete ordering** đã qua; không đồng nghĩa owner acceptance, toàn TC08/19TC hoặc release.
