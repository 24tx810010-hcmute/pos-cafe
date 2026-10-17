# Review G2a — forced PIN completion mất ACK

Ngày 09/10/2026. Phạm vi: hai thứ tự lost ACK trong TC-PIN-09 trên target local tổng hợp riêng. Chủ dự án chưa xác nhận walkthrough hoặc nghiệm thu. G2 rộng hơn, toàn TC06/09, 19 TC và release vẫn mở.

## Candidate-02 đã bị yêu cầu sửa

- Candidate-02 SHA-256 `112012AE85458DE4F584478F1001E9E4556E63652BBCC4C10BFAACC1A6B8BB4C`, source-06 và UI attempt05 2/2 PASS với pending K.
- Reviewer coverage/UI/docs độc lập kết luận **APPROVE candidate-02** trong scope của mình.
- Reviewer authority/transaction/privacy độc lập kết luận **CHANGES_REQUESTED candidate-02**: sau fresh normal login chỉ kiểm pending K ở DB và shell; chưa quan sát RPC receipt lookup, payment hoặc lệnh in trong giai đoạn ấy. K còn pending không đủ bác bỏ receipt lookup/print tự động. Nhận xét phụ: config nên khóa port Vite chính xác.
- Candidate-02 không được tính là final approval. Không đổi nhãn kết quả lần chạy hay xóa bằng chứng cũ.

## Cách xử lý và bằng chứng mới

- Source-07 thêm `assertNoAutomaticFinancialActivity` sau normal shell với barrier hai animation frame. Assertion quan sát forbidden K/payment/receipt RPC và `window.print`, yêu cầu số lần bằng 0. Playwright config từ chối port khác 5179.
- [Source-07 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/source-07.json) và [archive phục hồi](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/source-07.tar), archive SHA-256 `09a2cbf73cf45783ab454351c4bb71c9220db2c197e19fff858f93a14a81c91b`.
- Native typecheck exit 0; observer/reporter Vitest 4/4 PASS; browser discovery 2; [UI attempt06 safe report](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/ui-attempt-06-safe.json) 2/2 PASS, 0 skip/retry/expected failure/hook failure, UTC 04:02:59–04:03:11. [G1 preservation](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/g1-postflight-safe.json) và [G2a postflight](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/g2a-postflight-safe.json) PASS.
- [Candidate-03 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/candidate-03.json) đóng băng source-07, sáu file docs/spec/review, receipts, code/test/config và thông tin runtime. Cần hai reviewer non-author scope khác nhau **APPROVE đúng candidate-03**. Chỉ thêm metadata verdict bên dưới sau khi họ trả lời; nếu sửa nội dung kỹ thuật, freeze/review lại.

## Verdict candidate-03

Metadata review ghi lúc 04:06 UTC ngày 09/10/2026, sau khi freeze; không thay đổi source, requirement, test hoặc expected của candidate-03 (SHA-256 `13F98A1387A1B626FA14A98D86E15BED50F38BC675401120EE7C7701F9D1C149`).

- Reviewer `review_coverage` — **APPROVE candidate-03** trong scope coverage/UI/evidence/authorization/docs; đã đối chiếu manifest/archive/source/docs hash, source delta, assertion sau shell, attempt06. Không có finding.
- Reviewer `review_security` — **APPROVE candidate-03** trong scope authority/transaction/fixture/privacy; finding chặn candidate-02 đã đóng, đã đối chiếu hash/source delta/attempt06. Không có finding.

Hai reviewer không tham gia tạo candidate. Gate review G2a đã qua trong đúng scope hai thứ tự lost ACK; chưa phải chủ dự án nghiệm thu, G2 rộng hơn hoặc release.
