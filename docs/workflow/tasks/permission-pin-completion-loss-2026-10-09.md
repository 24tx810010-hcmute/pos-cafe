# G2a — Mất phản hồi khi hoàn tất đổi PIN

## Trạng thái và quyền

- Cập nhật 09/10/2026, session nguồn `01a10b60-e6db-7692-831c-584eee63cda3`. **Hai ca G2a đã chạy PASS trên target riêng với pending K; candidate-03 có hai APPROVE độc lập. Chưa được chủ dự án nghiệm thu/release.** [Log kỹ thuật và lịch sử lần chạy](../../implementation-log/permission-pin-ack-loss-2026-10-09.md).
- Người dùng trả lời **“ok”** sau đề nghị tiếp tục G2 từ G1; các yêu cầu còn hiệu lực: chia scope nhỏ, auto test và UI thật, subagent cân bằng chi phí, lưu vấn đề kỹ thuật trên nhánh docs. Người dùng đã dặn **“nếu cần thì phải tạo session mới nhé (tôi muốn ưu tiên kết quả và độ chính xác)”**. Hồ sơ ghi quyền đã có, không mở rộng quyền.
- Phần đầu G2a chỉ kiểm hai tình huống lost ACK của forced completion trong [TC-PIN-09](../../../openspec/changes/force-default-pin-change/testplan.md:85), sử dụng yêu cầu thành công/session của [TC-PIN-06](../../../openspec/changes/force-default-pin-change/testplan.md:58). Các race, fault SQL, denied reuse và recovery → actual complete → historical replay thuộc phần tiếp theo; G2a không đóng toàn bộ TC06/09 hoặc 19TC.
- Được thực hiện test/tooling/harness, fixture tổng hợp local riêng, auto/UI và hồ sơ liên quan. Không đổi requirement/expected, ứng dụng `src/`, candidate SQL hoặc grants để làm test xanh. Nếu phát hiện lỗi cần sửa ngoài phạm vi tooling, báo bằng chứng và xin đúng scope bị ảnh hưởng. Không tác động hosted Supabase/Vercel, email, credential thật hoặc dịch vụ tính phí.

## Đầu vào và baseline

- Đọc tiếp: [quy trình](../README.md), [chuẩn spec](../../../openspec/SPEC-STANDARD.md), [inventory19TC](permission-pin-gate-inventory-2026-10-08.md), [G1 đã kiểm chứng](permission-pin-oracle-2026-10-09.md), và bộ artifact `force-default-pin-change` hiện hành.
- Main `D:/Workspace/pos-cafe`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs `D:/Workspace/pos-cafe-docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Hai worktree có nhiều thay đổi chưa commit từ trước: giữ nguyên, không reset/stash/switch/commit/push/deploy. Kiểm lại status và freeze source khi bắt đầu, không mặc định HEAD mô tả đủ dirty source.
- G1 source08 fingerprint `b927e8bf55a9f75416fa9b67ae16d8cd7471f838c8094133559dfa11ca3e34cf`; [candidate-3](D:/Workspace/pos-cafe/artifacts/permission-pin-oracle-20261009/candidate-3.json) SHA256 `f5af156949e20450795bf96e67f2bcc0cf92e7d02d114cbe3d6ce06547937a3f`, recoverable snapshot cùng thư mục. Hai APPROVE G1 không áp dụng cho G2a.
- G1 auto 70/70, UI mock desktop 1/1, app/config typecheck và whole-row/catalog/6 Storage bytes preservation PASS là bằng chứng lịch sử đúng scope. Không gọi đó là forced-completion lost ACK thật hoặc full gate.

## Khảo sát chỉ đọc đã thực hiện

Hai investigator non-author-of-code đã khảo sát server và UI, dùng Sol/high cho transaction/safety và Sol/medium cho transport/provenance. Họ không sửa file, không chạy mutation và không phải reviewer cuối của G2a. Session mới phải tự đối chiếu các điểm sau với source hiện hành.

| Nguồn | Điểm cần giữ khi dựng test |
| --- | --- |
| [permission-identity.sql](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:346) | Reread authority/TTL/revision sau locks trước receipt lookup; complete đổi credential/cờ/revision, revoke mọi session của owner và ghi evidence một lần. Token restricted đã revoked không được replay receipt completion. |
| [identity fixture](D:/Workspace/pos-cafe/tests/contracts/permissionIdentityFixture.ts:80) | Legacy reset xóa sessions/audit/requests/signals/workflows rồi commit. Không dùng setup/reset/cleanup này trên fixture activated G1. |
| [runtime guard](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs:12) | Project hardcode `pos-cafe-perm-t04-20260916`; endpoint guard ở dòng 49 khóa API59421/DB59422. Đổi env port đơn thuần không tạo target riêng hợp lệ. |
| [surface fixture](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceFixture.ts:130) | G1 dùng outer transaction, locks, rollback và so baseline. HTTP completion đã commit không phù hợp harness này. |
| [browser ACK pattern](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboarding.spec.ts:119) | `route.fetch()` rồi `route.abort()` có thể làm mất response của operation thật; các ca hiện có không chứng minh forced-completion lost ACK. |
| [legacy browser config](D:/Workspace/pos-cafe/playwright.owner-pin-onboarding.config.ts:9) | Global setup legacy activate/seed; cấu hình G2a cần lifecycle riêng và không chạy nó trên G1. |
| [required screen](D:/Workspace/pos-cafe/src/app/screens/RequiredPinChangeScreen.tsx:126), [adapter](D:/Workspace/pos-cafe/src/adapters/supabase/permissionIdentityRepo.ts:82) | Nhánh chưa xác nhận đưa về đăng nhập, clear restricted context và không tự replay completion. Unit mock không thay rendered UI với Auth/REST thật. |

## Quyết định thực thi trong phạm vi đã giao

### DEC-G2a-01 — Target local riêng

Chọn project/container volume/ports/profile mới, guard chặt theo chính target mới; kiểm resources/port/image trước khi tạo. Dựng từ migrations/candidate hiện hành với Auth/store/owner tổng hợp, ưu tiên `seedDemo:false`. G1 project `pos-cafe-perm-t04-20260916`, API59421/DB59422 và dữ liệu/catalog/Storage/roles/control của nó phải giữ nguyên. Không nới guard G1 hoặc dùng reset/restore grants trên G1 làm đường tắt.

Lý do: cần quan sát DB commit từ kết nối độc lập và Auth/REST/browser thật. Phương án rollback G1 không cho HTTP thấy setup chưa commit, còn completion commit lên owner G1 phá preservation. Phương án thêm store vào G1 cũng tăng phạm vi dữ liệu/Auth cần phục hồi. Target mới tốn tài nguyên local và cần lifecycle/guard riêng; không tạo chi phí cloud. Nếu không thể cùng tồn tại mà phải dừng/sửa G1 hoặc thay đổi quyền/phạm vi, hỏi trước phần đó.

### DEC-G2a-02 — Session mới

Mở session local mới vì cần đồng bộ backend commit, UI và transport fault trên source đông thay đổi; dùng hồ sơ này và prompt ban đầu để giữ ranh giới quyền/bằng chứng. Đây là chuyển công việc đang làm, chưa phải bàn giao kết quả hoàn tất.

## Kế hoạch kiểm chứng bắt buộc

| Ca | Thao tác và bằng chứng cần có |
| --- | --- |
| G2a-A — Mất ACK sau commit | Gửi completion thật một lần từ form; intercept RPC, forward request, kiểm response hữu hạn và observer kết nối khác xác nhận commit **trước** abort. So hash bằng boolean kín, cờ false, revision +1, mọi session cũ revoked, đúng một audit/signal/registry. Replay probe có chủ ý dùng token cũ/request gốc phải `EMPLOYEE_SESSION_REQUIRED`, không thêm effects. PIN tạm `INVALID_PIN`; PIN mới fresh normal session 12h và rendered shell mở. |
| G2a-B — Mất ACK trước execute | Abort request không forward. Observer xác nhận credential/cờ/revision/sessions/evidence chưa đổi trước các login có chủ ý. PIN mới không đăng nhập được; PIN tạm vẫn restricted, form chặn shell trở lại. Tách effects của fresh login khỏi snapshot operation. |

Cả hai ca phải thấy đúng DOM đăng nhập và thông báo **“Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.”**, forced form cũ đã rời, không protected shell trước fresh authority. Đếm completion do UI vẫn một lần qua focus/reconnect và barrier quan sát xác định; không dùng sleep đơn thuần làm chứng minh không replay. Tách request replay probe có chủ ý khỏi counter UI. Quan sát không automatic pending K/payment/print/receipt lookup.

- Dùng native Chromium E2E trên local server với Auth/REST thật. Config mới retries0/forbidOnly/workers1, tắt screenshot/trace/video vì form có secret. Native repo Playwright tự thoát; nếu dùng browser MCP phải đóng và dừng đúng process MCP sau dùng, giữ config.
- Auto test cho guard/diagnostics/observer/transport và regression liên quan, typecheck cần thiết; không sửa test expected để nhận PASS. Nếu sửa interface thật, áp dụng UI-audit theo AGENTS, không tự update baseline.
- Guard bind project/config/volume/localhost endpoints/marker/migrations/Auth-store identity/required services; baseline và postflight riêng chứng minh G1 giữ nguyên. Target đã chọn: `pos-cafe-perm-g2a-20261009`, API59521/DB59522, Vite5179.
- Freeze actual source và package-lock, discovery/options, lệnh/UTC/exit code, body và hooks, test counts/skip/retry/expected failure, driver/reporter hashes. Giữ mọi FAIL, không relabel. Snapshot phục hồi gồm file mới/tests/config/deletion markers; không chỉ HEAD/hash thiếu bytes.
- Không model-read private env/control/raw logs/backups/token/PIN/hash/Storage URLs. Script có thể đọc kín và chỉ xuất boolean/count/finite error code. Reporter phải an toàn cả body/hook FAIL, không raw response/error/diff. Không đặt dữ liệu nhạy cảm vào docs/chat.

## Đầu ra, review và bước tiếp theo

Session mới thực hiện target/harness/tests, chạy auto/UI, cập nhật log kỹ thuật và hồ sơ này trên docs; chỉ cập nhật implementation pointers trong spec khi có bằng chứng, giữ requirement/steps/expected. Chuẩn bị walkthrough điểm vào → adapter → RPC → commit → observer → DOM, ghi rõ owner chưa xác nhận đọc/hiểu/nghiệm thu.

Trước khi nhận **G2a hoàn tất**, freeze final manifest và recoverable snapshot gồm code/test/docs; hai reviewer không tham gia tạo candidate kiểm riêng (1) authority/transaction/fixture/privacy và (2) coverage/UI/evidence/authorization/docs. Cả hai phải explicit APPROVE chính final candidate; sửa nội dung cần review lại. Hồ sơ review metadata được bổ sung sau verdict theo quy trình, không biến APPROVE G1 thành APPROVE G2a.

Đã có runtime G2a source-07: native typecheck exit0, observer/reporter tooling 4/4, Chromium/Auth/REST hai ca 2/2 không skip/retry với kiểm không auto K/payment/receipt/print cả sau login, G1 independent preservation PASS; chi tiết target, lỗi các attempt và receipt trong log trên. [Final candidate-03](D:/Workspace/pos-cafe/artifacts/permission-pin-ack-loss/candidate-03.json) gồm source/docs snapshot có thể phục hồi. Candidate-02 từng bị security reviewer yêu cầu sửa vì thiếu assertion sau normal shell; source-07/attempt06 đã bổ sung, [hồ sơ review](../../reviews/2026-10-09-permission-pin-ack-loss.md) ghi lịch sử. Metadata sau freeze: hai reviewer non-author khác scope đã explicit **APPROVE candidate-03**. Không có blocker cần người dùng hiện tại. Phần G2 rộng hơn, G3/full19TC/UI audit33/release vẫn mở.
