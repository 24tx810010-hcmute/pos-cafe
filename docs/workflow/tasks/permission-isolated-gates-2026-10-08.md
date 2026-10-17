# Bàn giao — isolated gates và cleanup diagnostic, 08/10/2026

## Kết quả và quyền

User **“ok tiếp tục đi”** cho scope full-stack readiness/gates cách ly; khi cleanup ảnh FAIL, user chọn **“Cho phép phục hồi fixture và sửa cleanup (khuyên dùng)”**: diagnostic an toàn, reset đúng2 cửa hàng/Auth giả, giữ Storage và kiểm lại auto/UI. Quyền trực tiếp trong chat, không suy từ handoff. Main HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, dirty baseline giữ nguyên.

Source cuối **`d1a0e9ac8e6f941738e3325522e4f686bb606921e8ae162a0ce6a75b1bc1541e`**,707paths/705files/2deletions, frozen snapshot có mọi test/file mới/locks. Chỉ đổi reporter+fixture diagnostic và thêm5 regression; không đổi SQL nghiệp vụ/UI. Source5f/reportFAIL giữ riêng.

| Gate source cuối | Kết quả |
| --- | --- |
| Full-stack readiness | 12services/config/volume/loopback/control/16checksums/API↔DB PASS |
| Identity | 42/42 PASS, legacy cleanup |
| Images | 1/1 clean +1/1 controlled remnant PASS cả body/hook, legacy cleanup |
| PIN server | 31/31 PASS =22 behavioral SQL +9 static |
| PIN surface | 44/44 PASS =42 RPC +inventory/raw ACL |
| TC44 | 4/4 seed/clear ordering PASS |
| Reporter/evidence tooling | 34/34 PASS ở3files, gồm5 regression mới |
| Owner PIN browser | 9/9 PASS/exit0, no skip/retry/expected failure, Chromium1366×768; fresh candidate postflight PASS |

[Log kỹ thuật/commands/rubric](../../implementation-log/permission-isolated-gates-2026-10-08.md) · [review candidate](../../reviews/2026-10-08-permission-isolated-gates.md) · [evidence](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/evidence-diagnostics-01).

## Incident và giới hạn

Lần ảnh đầu source5f: body1passed nhưng runfailed/wrapperexit1/phase mismatch. Mất TEMP/worker và reporter bỏ hook cause nên **nguyên nhân SQL/checksum cụ thể chưa biết**. Đã phục hồi fixture và kiểm hai baseline mới đạt; không gọi đó là semantic bug đã được giải thích/sửa. Diagnostic mới dùng mã/phase/step/SQLSTATE whitelist, không đưa raw error/secret ra evidence; hookerror chặn success. Giữ FAIL/unknown child-exit/time và đính chính metadata storeIds trong incident.

Backup private DB/roles và6 Storage bytes đã hash/TOC/byte-check; **chưa rehearsal restore**, backup incident là state thất bại. Reset bootstrap tái tạo4 policy legacy; root phục hồi exact empty policy baseline, metadata/catalog/6bytes đều khớp. Original reset wrappers BLOCKED và receipt phục hồi riêng được giữ. Original incident whole-row integrity hashes chuyển private, public chỉ row counts có projectionCorrection.

UI wrapper hậu kiểm sai phase bằng unmarked fixture identity đã FAIL dù9UIpass; giữ receipt ấy. Fresh hậu kiểm candidate dùng marked store-session200/storeId đúng, unmarked426, runtime/control/16checksums/IDs/gates đúng,6bytes khớp; không nới legacy guard hoặc rerun browser vô cớ.

## Trạng thái cuối và bước tiếp

Project local `pos-cafe-perm-t04-20260916`, API59421/DB59422/database `postgres`; fixture mới native private `.../isolated-gates-20261008/private/fixture-restored-01`, dùng env/control mới, không dùng marker/env cũ. Sau browser: **candidate activated**, stricttrue/contract2, đúng2stores/2Auth, không pending/prepared/idle transaction. Cooperative lease không chặn mọi API writer; runtime proofs theo thời điểm ghi.

Không gọi legacy suites trực tiếp trên phase hiện tại; cần guarded reset với preservation khi scope kế tiếp đòi legacy. Không reset vì JWT hết hạn: refresh đúng control/phase trước. Có thể tiếp tục chat này, chưa cần session mới.

Scope tiếp đề nghị: đối chiếu thiếu gate tổng theo cùng source/profile, Realtime hai client và PIN completion inventory/aggregate; sau đó rehearsal runbook/controller/provider/backup và coordinated release nếu được giao. Full T15/T16/PIN-T06/T17/T18/task sản phẩm và UI audit FAIL33/layout hoãn còn mở. Chưa commit/push/deploy, chưa tự nhận owner nghiệm thu/walkthrough. Hai review độc lập chỉ áp candidate/phạm vi trong biên bản.
