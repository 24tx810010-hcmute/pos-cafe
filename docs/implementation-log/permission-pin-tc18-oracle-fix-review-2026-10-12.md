# Review sửa oracle TC18 — 12/10/2026

Candidate nguồn source-23 cùng docs/support/evidence snapshot khóa trong `artifacts/permission-pin-tc18-oracle-fix/candidate-01.json`. Phạm vi: SEC-01/02, cold Realtime readiness của harness TC18, đối chứng, TC18 runtime và hồ sơ/bảo toàn target. Không là full PIN19/PERM60 hoặc phát hành.

Hai reviewer không tham gia viết, chạy lần lượt theo AGENTS.md: security/oracle, rồi evidence/preservation/docs. Đang chờ verdict; chưa nhận APPROVE thay reviewer. [Biên bản](permission-pin-tc18-oracle-fix-2026-10-12.md), [finding gốc](permission-pin19-source20-review-2026-10-12.md).

## Vòng 1 — security/oracle: CHANGES_REQUESTED

Reviewer `/root/tc18_fix_security_review`, không tham gia viết; candidate-01 SHA-256 `3168d7785b98153052c489c8f07b831934f86be2d5b9a2f5049af0f43d05941f`, source-23 fingerprint `67f9f3e7042fb5a7e079a6e390d9c26807c531de589b3d7efb5bfeaf32540d1d`.

**SEC-03, chặn:** `permissionCanaryOracle.ts:63` của source-23 bỏ primitive số. Reviewer tái hiện: `{rejectedInput: submittedPin}` bị bắt, nhưng `{rejectedInput: Number(submittedPin)}` trả PASS đủ11 sink, tương tự từng sink. Audit/registry là JSONB object đã parse; PIN plaintext dạng JSON number vẫn vi phạm PIN-07. Đối chứng chỉ string chưa phủ. Cách đóng: xét numeric PIN, thêm đối chứng số và số0 đầu, mã lỗi cố định; kiểm/review lại candidate mới. Không có bằng chứng leak app thực tế.

Reviewer xác nhận sửa SEC-01 quét đúng `TEMP_PIN`; SEC-02 đọc PNG/JSON thực, quét sau child exit/đóng log; readiness chỉ metadata trước credential, assertion sự kiện thật giữ15s/no credential retry; reporter không raw diagnostic, ledger ngoài output và xóa trong finally. Đã đối chiếu main/docs/support/evidence99/current drift0, delta8; tự chạy tooling28/28 và hai typecheck0; đối chiếu48 file scan hash/bytes (49 file sau receipt), đọc browser7/7/no retry/missing/fatal. Không chạy DB/browser hoặc xác nhận full PIN19/PERM60/hosted/restore/release. Verdict **CHANGES_REQUESTED** đúng candidate-01; cần đóng SEC-03 trước khi đóng slice. Reviewer evidence chưa chạy trong vòng này.

## Vòng 2 — security/oracle: APPROVE

Cùng reviewer, candidate-02 SHA-256 `9cef4246364b03c3021080bb3d77665e5815cd10e02c49e2dde6fda68cd0da26`, source-25 fingerprint `45e697906e2b366c011eeeace0b9e160781ce8b3811cf770135de04558d02db4`. SEC-03 đóng: reviewer tự kiểm88 phản ví dụ (4PIN×2kiểu×11sink) đều bị bắt bằng mã đúng/không echo; array rỗng PASS nhưng phần tử0/own property0/object length0/Map/Set0 vẫn bị bắt. Không còn finding chặn hoặc đề xuất không chặn trong scope.

Reviewer tự đối chiếu main/docs/support/evidence214/current main drift0, delta so23 chỉ oracle+đối chứng; tooling40/40/typecheck0; bytes/hash48file attempt06 (49sau receipt), tự quét bằng PIN fixture không thấy chuỗi đó. Receipt7/7/no retry/missing/fatal, matrix20×11+operator/ledgerdeleted, postflight/stop phù hợp. SEC-01/02/privacy/readiness giữ nguyên, event thật15s/no credential retry. Không chạy DB/browser hoặc xác nhận full PIN19/PERM60/hosted/restore/release. Scope TC18 APPROVE trêncandidate02; evidence reviewer chưa chạy.

Candidate-03 sắp khóa giữ nguyên main source-25 và execution; chỉ bổ sung anchor điều hướng checkpoint và metadata verdict vòng2. Cần security xác nhận delta và reviewer evidence/preservation/docs APPROVE exact candidate03 trước bàn giao. Snapshot pre-review giữ trạng thái chờ; metadata verdict cuối được append sau review theo ngoại lệ workflow, không thay expected/evidence hoặc mở full gate.

## Vòng 3 — candidate-03

SHA-256 `aaf6c31afae9a90307b31142bd9013a6161c3cfbc8f4d8c73fd3588cd44b6e0c`. Security cùng reviewer **APPROVE**: main source25/attempt06 giữ nguyên, current drift0; docs chỉ anchor/metadata; support freeze helpers; 216 evidence/snapshots/archives khớp. Không ảnh hưởng SEC-01/02/03/privacy/artifact/Realtime; không finding chặn/đề xuất. Không rerun suite vì source/evidence giữ nguyên; vòng2 tooling40/40/typechecks0/88 phản ví dụ vẫn áp dụng. Scope TC18, không full gate/release.

Reviewer độc lập `/root/tc18_fix_evidence_review` **CHANGES_REQUESTED**, EVC-01 chặn: testplan.md:172 trỏ ASCII fragment `ket-luan-review-va-gioi-han`, target source20 log:35 chỉ heading có dấu, thiếu explicit anchor. Workflow lỗi đúng-sai trong deliverable chặn; cần anchor đúng hoặc fragment hợp lệ rồi delta review, không stateful rerun.

Reviewer evidence tự kiểm: main812/docs641/support7/live/frozen/tar khớp; fingerprint/runtime/locks và delta8 so20/delta2 so23 đúng; archive20–25 giữ lịch sử FAIL. Evidence216 không trùng/missing/drift; 48file scan/49file sau receipt khớp, tự quét49 bằng hai PIN fixture PASS. Tự chạy tooling40/40/typechecks0; đọc7 test/matrix20×11/220capture/0N/A/operator, lifecycle scan/reporter/no retry/skip/expected failure. Receipt7/7/exit0 UTC16:30:05–16:31:30 cùng25/profile599xxcontract2. Docker metadata tự đọc UTC16:45:46: ba target12/running0/badLabel0/attachments0, volume/network giữ; control dirs0, keepalive không chạy. Rà172links/10hồ sơ chỉ EVC-01; mapping/PIN-D08/lịch sử/giới hạn/walkthrough đúng. Không finding khác hoặc đề xuất; không DB/browser, không tái kiểm dynamic secret đã xóa, không restore/metrics/hosted/owner acceptance/full gate. Không sửa candidate hoặc ghi file.

Candidate-04 sẽ khóa cùng source25/execution, thêm explicit anchor cho EVC-01 và metadata vòng3. Chờ security xác nhận delta rồi evidence re-review exact candidate04.

## Metadata verdict cuối — candidate-04

[Candidate-04](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-oracle-fix/candidate-04.json) SHA-256 `8b3c3b362a3cba278abaa005c187341cb48255db3ea9c07f6c95e311727f46ad`, main source25/fingerprint và attempt06 giữ nguyên. Root đối chiếu trước khi ghi metadata: main/docs/support/archive/evidence218 drift0. Đây chỉ là ghi nhận verdict sau snapshot, theo ngoại lệ metadata của workflow.

| Reviewer / scope | Verdict exact candidate04 | Kiểm và giới hạn |
| --- | --- | --- |
| `/root/tc18_fix_security_review` — security/oracle | **APPROVE** | Main25/attempt06 giữ nguyên/current drift0; docs đúng anchor và metadata, source20 FAIL giữ nguyên; support freeze helpers/evidence218/archives khớp. SEC-01/02/03/privacy/oracle/artifact/Realtime không bị ảnh hưởng; không finding chặn/đề xuất. Không rerun vì delta không executable; tooling40/40/typechecks0/88 đối chứng vòng trước áp dụng. Không DB/browser/commit/deploy hoặc full gate/hosted/restore/release. |
| `/root/tc18_fix_evidence_review` — evidence/preservation/docs | **APPROVE**, EVC-01 đóng | Anchor đúng một lần ngay trước heading, testplan172 tới đúng mục; FAIL source20 nguyên. Main812/docs641/support7 live/frozen/hash/tar khớp; evidence218 không trùng/missing/drift,216 cũ giữ+2 mới;173 links/10hồ sơ hợp lệ. Delta đúng3docs anchor/metadata và freeze helpers, mapping/ủy quyền/lịch sử/giới hạn/walkthrough đúng. Không finding khác/đề xuất. Không rerun suite/stateful vì delta không executable/expected/evidence; tooling40/typechecks0/artifact hashes/Docker preservation vòng trước áp dụng. Không full PIN19/PERM60/CLOSE2/restore/metrics/hosted/release/owner acceptance. |

Tất cả finding chặn SEC-01/02/03 và EVC-01 có xác nhận đóng trong scope; cả hai reviewer bắt buộc APPROVE cùng candidate04. Chỉ slice TC18 được phủ bởi verdict này; không thay scope, expected, receipts hoặc mở full gate source25. Snapshot pre-review giữ các checkpoint chờ để bảo toàn lịch sử.
