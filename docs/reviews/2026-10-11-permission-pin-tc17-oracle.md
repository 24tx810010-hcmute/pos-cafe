# Review độc lập TC-PIN-17 — oracle và nghiệp vụ, 11/10/2026

- Reviewer: subagent `/root/tc17_oracle_review`, chỉ đọc, không sửa candidate hoặc chạy DB/browser suite.
- Phạm vi: normal owner PIN, cashier create/reset, tập quyền cố định và manager ceiling, fail-closed client/server contract trên [browser oracle](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts) so với [TC17 testplan](../../openspec/changes/force-default-pin-change/testplan.md).
- Candidate cuối: [main manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc17-close3/source-manifest.json) SHA-256 `8ad2d2442903e51494f64753f96be064bb96d1f76c5ff23eca36e0c093fad510`, source tar `8c68ca64d27b28bf3a373631b685b2578d14d8233f96fc6305b954210df02010`; docs pre-review manifest `1dc69437c43b5e5878590fe678ed5986b35aa2dc8a5641ae192483ab93a8e2c9`.

Vòng đầu trên close1 `872e5231…` **CHANGES_REQUESTED**: oracle cashier tự đối chiếu với output server, thiếu kiểm contract current và hồi quy PERM. Tác giả sửa thành exact 15 mã catalog/7 mã cashier độc lập, bổ sung denial ceiling trên target, old client read/write HTTP426, old server gate SQL rollback và PERM client/core 63/63; chạy lại browser TC17 1/1 PASS. Reviewer kiểm lại close3 và **APPROVE** oracle trên exact main candidate.

Sau khi bổ sung receipt, ảnh baseline và provenance, reviewer rà delta read-only trên docs pre-review manifest mới `1dc69437…`, xác nhận expected/oracle không đổi, năm verification receipt exit0/hash nguồn/log khớp và 13 ảnh hash khớp. **Verdict cuối: APPROVE** phạm vi oracle/nghiệp vụ TC17 local. Không suy rộng sang full PERM60, CLOSE-2/CLOSE-3 hoặc hosted.
