# Bằng chứng candidate khắc phục F2–F5

Ngày 2026-09-11T02:49:09.027Z; base code 3ada48c0c9c494d9b34838fd3739bda6091e0bb9, working changes.

Fingerprint: 35c5f9485b42056303e63a688b8d4a711e0603161a77028e659313796028ea51. Node v24.16.0, backend postgres-postgrest-gotrue, DB pos_cafe_idem_test_auth_938220e75d16. Preflight cuối đạt.

1123 gate tests passed; 758/758 required; không thiếu/trùng/sai backend/non-pass. 577 unit/component +462 DB +37 tooling +47 browser. Build PASS; coverage92.78% (746/804); smoke mock35passed/31skipped, không cộng vào gate.

Các stage đều có metadata before/after bằng fingerprint trên và report/options hash hợp lệ. Raw JSON, logs và SHA256SUMS ở [gói evidence](D:/Workspace/pos-cafe/artifacts/p2-final/summary.json). Không có credentials trong gói docs.

| File nguồn | SHA256 |
| --- | --- |
| src/app/WriteLifecycle.tsx | 6a1598201bab7d98c085795398566ca2e7338c51f309f7ac399714ccf9b88fb9 |
| src/app/components/ReceiptPreview.tsx | a15a19b1ba1e0a3a67d78ef8b66de655d266be54a71ad07b1f2260b0c147a9be |
| src/app/useViewLifetime.ts | 1beeb0a97d96493fa4bac4ddf4df27f48dc9e1bb4eb2abf111a87dab72f5e457 |
| src/app/drawers/pos/WriteAttemptNotice.tsx | fdb21073ac0f3bd795876a2157370aa485e9112dcb06c9e096ec069ab2fac014 |
| src/app/drawers/pos/OrderDrawer.tsx | d39a559aef737f064fadd1824549f4c252fa22fe2e70701c537d658d057029b1 |
| supabase/migrations/014_write_identity_and_ledger.sql | 148491449485efed645814223adf89026e08d6a263f1365b917bd1d7f92b5747 |
| supabase/migrations/015_write_business_helpers.sql | 043fbfd50223e5aa056edbce24995efd9a5e52ab6dc15e8213dd7b30df0e5623 |
| supabase/migrations/016_activate_write_protocol.sql | 3267239282a699551d067d38944069a166c476bcbf340c26e89fcbf79344edf9 |

pnpm-lock.yaml giữ nguyên 86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996. Không deploy/migration production.
