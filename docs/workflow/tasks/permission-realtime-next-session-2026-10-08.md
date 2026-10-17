# Bàn giao session mới — Realtime hai client, 08/10/2026

## Đề bài và ủy quyền

User yêu cầu tiếp scope nhỏ sau isolated gates: **“ok tiếp tục giúp tôi. lưu ý nếu cần thì phải tạo session mới nhé (tôi muốn ưu tiên kết quả và độ chính xác)”**. Được tiếp kiểm Realtime/đối chiếu gate, dùng subagent có model phù hợp và auto/UI thật, giữ hồ sơ kỹ thuật trên `docs`. Scope này kiểm **TC55 Realtime hai client** và evidence đúng stage; full aggregate/PIN inventory/TC29 còn thiếu là bước sau. Không tạo quyền hosted mutation hoặc thêm business requirement từ handoff.

## Nguồn hiện hành

- Main `D:/Workspace/pos-cafe` HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs `D:/Workspace/pos-cafe-docs` HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty từ trước, giữ nguyên. Main fingerprint đọc lại **`d1a0e9ac8e6f941738e3325522e4f686bb606921e8ae162a0ce6a75b1bc1541e`**.
- Authoritative instructions: docs `AGENTS.md`, `CLAUDE.md`, `docs/workflow/README.md`, `openspec/SPEC-STANDARD.md`; main AGENTS chỉ con trỏ. Spec [TC55](../../../openspec/changes/redesign-permission-model/testplan.md); PIN dependency giữ riêng.
- [Log chuẩn bị và nguồn file/dòng](../../implementation-log/permission-realtime-preparation-2026-10-08.md) · [review của lần chuẩn bị](../../reviews/2026-10-08-permission-realtime-preparation.md) · [inventory offline](D:/Workspace/pos-cafe/artifacts/permission-realtime-preparation-20261008/static-gate-inventory.json).
- [C1 trước](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/candidate-1.json), SHA256 `07ccb0ffa8ed37509edaa7d85a1512a5d31399678d5296e6d52627af31160439`; source/snapshot `snapshot-candidate-1/main` đầy đủ707paths/705files/2deletions. [Review receipt trước](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/final-review-receipt.json). Approval áp slice trước và snapshot của nó; các cập nhật docs lần này được review riêng.

## Kết quả đã có và trạng thái fixture

Focused d1: identity42, images clean1/remnant1, PIN server31/surface44, TC44four, reporter/tooling34, owner PIN Chromium9 đều PASS trong phạm vi cũ; hai reviewer APPROVE C1. Wrapper UI sai hậu kiểm FAIL vẫn giữ, fresh correct candidate postflight PASS riêng. Đây chưa phải aggregate report/attestation. Original cleanup cause unknown; backup chưa rehearsal restore; UI audit FAIL33 đã tách.

Hậu kiểm **2026-10-08T04:20:43.509Z**: full local project `pos-cafe-perm-t04-20260916`, API127.0.0.1:59421/DB127.0.0.1:59422/database `postgres`, 12requiredservices, fixture **activated candidate / stricttrue / contract2**, đúng2syntheticstores/Auth và6Storagebytefiles. Chưa kiểm lại runtime/credential ở lượt chuẩn bị này. [Cleanup cuối](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/final-runtime-cleanup.json): own lease released, UI5178listeners0, Playwright MCP16→0/config giữ nguyên; WSL có thể idle.

Hai synthetic store/Auth UUID đã biết: `10000000-0000-4000-8000-000000000001`, `10000000-0000-4000-8000-000000000002`. Không dùng env/marker cũ đã retired. Native root `/var/tmp/pos-cafe-perm-t08-20260922/isolated-gates-20261008`; frozen source `source-diagnostics-01`, private fixture hiện `private/fixture-restored-01/bridge.env` và control liên quan. **Không đọc giá trị các file private vào model/chat**; helper chạy trên máy sử dụng credential kín, output chỉ projection đã chốt. NativeNode `/var/tmp/pos-cafe-idem-release-20260914/node-v24.16.0-linux-x64/bin/node`, SupabaseCLI2.117.0/Docker29.1.3; lock/deps theo [receipt](D:/Workspace/pos-cafe/artifacts/permission-isolated-gates-20261008/evidence-diagnostics-01/dependencies.json).

## Blocker đã đọc, chưa thực nghiệm mới

1. Realtime config kế thừa candidate global setup, yêu cầu fresh legacy; không chạy lên activated fixture. Reset legacy đơn thuần chưa đủ: identity POST trong test sau activation thiếu contract2 marker và strict hook trả426 theo source. Sửa test/tooling đúng contract/phase, không tắt guard.
2. `installStoreSession` refresh token, hai page login đồng thời; phải quản lý refresh reuse/rotation kín, không mặc định credential còn hợp lệ. JSON/trace/screenshot/failure attachments có thể chứa dữ liệu; runner cần safe reporters/raw logs private.
3. Test ghi overrides/default/revisions/signals/audit và owner session. Cleanup hiện chỉ restores overrides/default; record/treat remaining effects chính xác, không gọi clean baseline nếu không chứng minh.
4. Permission aggregate có60REQUIRED/27stages; focused receipt chưa schema/profile/serviceBinding/attestation. Không đổi nhãn report cũ hoặc hạ status required. Forced-PIN chưa map; TC29 topic/join-only/manual-refresh còn thiếu; không gọi scope TC55 là toàn TC29/full gate.

## Trình tự và tiêu chí đóng slice

Đọc brief/spec/code → safe runtime/control/phase preflight dưới lease → sửa harness/safe evidence/regression phù hợp → freeze source mới → preservation state hiện tại nếu cần guarded legacy reset → signals hiện có/legacy cleanup → Chromium Realtime hai contexts/two pages/20changes/catalog/lost-signal/reconnect → correct candidate postflight/storage/cleanup → `docs` +2reviewer APPROVE cuối. DB suites tuần tự, strict options/no requiredskip/retry/expectedfailure. Giữ các thresholds TC55 hiện hành5s/30s/35s và không giả physical commit timestamp.

Trước reset mới phải chốt exact target/phạm vi/preservation từ evidence hiện tại, dùng2UUIDfixture đã được giao; câu trả lời recovery trước là nguồn scope cũ, không mở quyền xóa dữ liệu mới hoặc hosted. Drift ngoài phạm vi hoặc thay nghiệp vụ/quyền/chi phí/nghiệm thu cần hỏi đúng phần theo AGENTS; phần độc lập tiếp tục. Backup incident cũ không phải backup activated hiện tại. Kiểm6Storagebytes/metadata/policies/catalog trước/sau; reset không vì JWT expired.

Executable entrypoints đọc tại log; **chưa chạy trong lượt chuẩn bị**. Không chạy bare command trước khi cấu hình safe reporters/actual-options/profile attestation và đúng fixture. Dùng lại helper guard/preservation đã có khi phù hợp; nếu sửa source, kết quả d1 là lịch sử và full gate phải theo source mới. Không chạy suite local trên hosted; không commit/push/deploy trong slice TC55 này.

Session mới dùng local project cùng checkout, không worktree remote default hoặc fork toàn lịch sử. Lý do/quyết định đã ghi trong log. Session ID/dispatch và review verdict cập nhật dưới dạng metadata sau freeze. Lần giải thích code/walkthrough sẽ chuẩn bị, chưa nhận owner đã nghiệm thu. Chưa có auto/UI/Realtime/aggregate run mới của slice kế tiếp.
