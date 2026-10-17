# Bàn giao oracle TC-PIN-03 — 09/10/2026

## Quyền, source và kết quả

Chủ dự án **“ok xử lý giúp tôi”** sau đề nghị G1 trong [inventory19TC](permission-pin-gate-inventory-2026-10-08.md):sửa oracle,regression mutation+denial,kiểm fixture cách ly. Quyền test/tooling/harness,auto/UI liên quan,docs/subagent; không đổi requirement/expected/42business RPC/SQL/grants,không reset fixture activated/hosted/release. Hồ sơ không tạo quyền mới.

Main D:/Workspace/pos-cafe HEAD ef2c372aec60d8362549e47b7aedb27126129479;docs D:/Workspace/pos-cafe-docs HEAD e47862b1dfed68d783dc07a2a1fd51ecdabc1b19,dirty baseline giữ nguyên. [Source08](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/source-08.json) **b927e8bf55a9f75416fa9b67ae16d8cd7471f838c8094133559dfa11ca3e34cf**,713paths/711files/2deletions,archive phục hồi được.7file test/helper/fixture/config/reporter khác baseline66;không app/migration/candidate SQL. [Log kỹ thuật/receipts](../../implementation-log/permission-pin-oracle-2026-10-09.md).

Oracle đọc effects cùng connection trước rollback; finally cleanup,mã hữu hạn.14regression và SQL mutation+denial negative control thật đã đạt. Activated guard strict2/exact2storeAuth/16checksums/marked200-unmarked426,không legacy commit/delete setup. Public/private khóa writer;Auth/Storage read lock theo quyền hiện có,mọi row/catalog vẫn so và drift phải FAIL. Inventory55=42business+13named exceptions,thêm kiểm output/no-effect2metadata functions.

[Run cuối](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/evidence-source-08-attempt-01/execution-summary.json) PASS:oracle14riêng;suite70/70=47SQL+14oracle+9reporter,zero skip/retry/expectedfailure/hook errors;tsc-b app/config exit0;Chromium desktop mock permission editor/re-login/payment denial1/1. Không cộng thành84cases độc lập. Whole rows/catalog/6Storage bytes giữ nguyên,sessions3→3,candidate/activity guard đúng. Run cuối không Auth refresh;attempt cũ refresh bằng existingtoken trước baseline được ghi riêng;không password reset/fixture reset.

Các FAIL health/opaque setup/locks42501/inventory2metadata giữ nguyên và preservation ở run có DB baseline. Driver input hashes cuối có attestation;driver mỗi FAIL chưa snapshot riêng,không nhận replay exact olddriver. Không dùng admin trong suite;không đọc raw/private/credential ra model/chat/docs.

C1 technical review đã yêu cầu sửa F1 precision và F2 catalog; evidence approval C1 không đủ đóng scope. Source08 thêm canonical SQL text và logical metadata, precision SQL cùng5catalog variants đã đạt. Source05 catalog negative-control FAIL giữ riêng, exact cause chưa có chẩn đoán; Source06 PASS trước bổ sung cuối không thay final source08. Chi tiết và reviewers cuối theo log/review.

C2 technical review tiếp tục chặn F3 policy permissive/restrictive; source07 PASS chưa hoàn tất. Source08 thêm full pg_policy metadata và negative control thứ5, giữ70testcases; toàn auto/UI/typecheck/preservation đã chạy lại. Không thay verdict cũ; final candidate phải nhận cảhai APPROVE mới.

## Review và bước kế tiếp

G1 đã kiểm chứng; điều kiện đóng bàn giao là hai reviewer non-author khác scopes oracle/transaction và evidence/authority/docs APPROVE exact candidate+snapshot. [Review metadata](../../reviews/2026-10-09-permission-pin-oracle.md) và finalreceipt ghi candidate/verdict cuối. Chỉ thêm metadata chính review không đổi nội dung candidate. Reviews inventory08 không áp thay.

TC03 còn tokenvariants/directREST/Storage/allowed projections. G2 forced-completion ACKloss/races/faults,G3 canary/empty preservation,19TC/full aggregate/PIN-T05/06/T17/T18/UI audit33/release vẫn mở. UI mock một viewport không thay forced-PIN real browser/audit;không update baseline audit. Scope kế tiếp đề nghị G2,cần giao cụ thể trước mở phạm vi.

Không cần session mới cho G1:source/evidence/context đã giữ đủ. Có thể dùng handoff này vào session mới khi mở scope kế tiếp nếu cần accuracy. Walkthrough đã chuẩn bị;chưa có phản hồi owner xác nhận đọc/hiểu/nghiệm thu.
