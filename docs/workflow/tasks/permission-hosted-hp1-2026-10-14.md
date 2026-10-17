# HP1 — adapter hosted successor, kiểm LOCAL, 14/10/2026

**Cập nhật khảo sát 15/10:** [audit mới](permission-progress-audit-2026-10-15.md) tìm thấy receipt/log actual LOCAL nguồn 58 exit 0/75 PASS, hash manifest/tar/log khớp và 835/835 entry source hiện tại khớp. Các câu bên dưới “fresh capture75checks chưa chạy” là checkpoint trước receipt 58. Chưa có full gate 58/review SEC→EVC cuối hoặc hosted readiness. Kiểm metadata mới không còn archive `C:/Users/nguye/AppData/Local/pos-cafe-release/hosted-hp1-20261014/hp1-source56-private-package-01.tar`; đoạn nói archive từng được rehash là lịch sử, không chứng minh hiện còn. Không suy source58 tar chứa raw private hoặc khôi phục runtime. Online 15/10 vẫn legacy/chưa permission contract 2. Không push, xóa, sửa database hoặc dựng WSL/Docker.

Trạng thái hiện tại: SEC candidate01 CHANGES_REQUESTED; preliminary57 phát hiện tiếp exporter identity chưa gắn actual log, đang sửa/kiểm nguồn58. Execution56/57 giữ lịch sử, chưa đạt review gate hoặc bàn giao hoàn tất. Hosted certification/release BLOCKED; EVC chưa bắt đầu.

## Quyền và phạm vi

Chat cha `01a1393e-c03e-79a2-a20e-3ecfaaf241ad`, ngày 14/10/2026 Asia/Bangkok: assistant đề nghị HP1 (producer/loader/schema/profile, kiểm evidence thiếu/giả/sai nguồn, giữ BLOCKED khi thiếu capability thật, kiểm cách ly và gate source mới, SEC→EVC, không push/chưa backup/cutover). Chủ dự án trả lời: **“vậy tiến hành làm giúp tôi. vẫn như các yêu cầu trước đây”**. Chat thực hiện này nhận bàn giao qua `codex_delegation`; nguồn cho phép tạo session khi cần: **“ok làm task CLOSE3 chốt đường chạy hosted theo đề bài đi, làm tuần tự và không push nhé. Xong báo tôi trước khi sang backup/cutover, cần thì tạo session mới.”**

Giao HP1 và HP-Q2 trong [contract đã review](../../runbooks/permission-hosted-path-2026-10-14.md#contract-successor-hosted--thiết-kế-chưa-hiện-thực), candidate02 SHA `2328fd05976ddf916fc782bf874c42c9720d4c041a7bab4276d80e19911f7013`. Quyền mới thay ranh giới “implementation chưa giao” của hồ sơ khảo sát cũ, không thay các quyền ngoài HP1.

Được sửa producer/schema/profile/comparator/loader/dispatch/tool tests trên main và hồ sơ/spec tương ứng trên docs; chỉ thực thi LOCAL synthetic có identity/image/volume/label guard. Không stage/commit/push/reset/stash/switch/clean, không đổi UI/nghiệp vụ/SQL/dependencies/Tailwind, không sửa frozen artifacts/scripts của candidate cũ. Không hosted DB/API/browser probe/capture/backup/download payload, grant/lock/settings/cleanup/deploy; không contact provider hoặc tạo automation. STOP báo owner trước HP2 hoặc bất kỳ hosted action mới nào.

Registry certified hosted giữ RỖNG. Synthetic runtime và trust inputs chỉ chứng minh đường thực thi LOCAL, không cấp certification/hosted eligibility. Giữ exact79/66Auth/3objects/delete2, C full-row và L assessor, 60TC/19PIN cùng ngưỡng hiện hành.

## Trình tự và điều kiện nghiệm thu

1. Precheck HEAD/dirty/preservation và khóa [matrix](../../implementation-log/permission-hosted-hp1-2026-10-14.md) trước code/run.
2. Schema3 đóng, strict parser/ref/private/trust/source guards → producer RR snapshot/importer ACK/archive → independent comparator → loader/report recompute → dispatch từ chối trước controller connect; kiểm từng slice.
3. Fresh owned local PostgreSQL fixture ≥35/63 nonempty; dump/restore pristine và allocation clone riêng, giữ archive/volumes; negatives row/catalog/LO/roles/ACL/schema/TOC/source/trust/profile/control/Storage/auth.
4. Snapshot source mới có tar phục hồi, fresh isolated native Linux npm recipe; full unit/tooling/build/2tsc và mandatory PIN19/PERM60 cùng fingerprint, UI selftest→audit→read report→ảnh→phân loại theo gate. Không ghép source40.
5. Package recoverable source/runtime/raw refs/trust inputs/recipe, privacy/ACL/link/preservation/owned teardown → freeze → SEC→EVC cùng SHA → handoff và code walkthrough. Chưa owner xác nhận hiểu/nghiệm thu.

## Nguồn

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`. Pre-run preservation: `D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/precheck.json`. Source40 và mọi FAIL/history giữ nguyên; source kế tiếp chọn sau khi kiểm số thực tế. Private raw chỉ `%LOCALAPPDATA%/pos-cafe-release` ACL current user+SYSTEM hoặc Linux0700/0600.

## Kiểm chứng nguồn56 và ranh giới bàn giao

Nguồn cuối hiện tại: [manifest835entries](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/source-56.json), SHA `f5f24d5a4b396ed1fdb2fda036c6ec2e16b7a96db25e30be88dc4d4efdb4a21d`; fingerprint `58115a0068838b0ab380f5dcf08230acc0e4eee493bab8a426c941447e3c1976`. Có14 main delta, không sửa `src/`, migrations, dependencies hoặc Tailwind;2deletion markers là thay đổi có trước task.

Đã kiểm actual HP1 harness52/52 (hai capture B/I95checks,63tables/35nonempty; clone allocation riêng; faults và controller preconnect),1173unit,459tooling,build,2tsc,selftest23/UI16×3. [PIN19](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/pin-summary.json) đầy đủ55browser/41SQL/1canary/2operator/110focused checks; [PERM60](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/perm60-aggregate.json) đủ60cases/726variants/27stage tuần tự. Không required skip/retry. [Storage preservation](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/t04-storage-preservation.log) giữ nguyên full metadata3buckets/6objects và6payloads; Edge binding PASS. UI0real/6false positives đã đọc report và mở ảnh, không baseline update.

Nguồn41–55 và mọi FAIL/UNKNOWN giữ lịch sử, không trộn vào aggregate56. Chi tiết fixture prerequisites, lỗi và bằng chứng trong [biên bản](../../implementation-log/permission-hosted-hp1-2026-10-14.md); [đường đọc code và replay](../../runbooks/permission-hosted-hp1-2026-10-14.md#đường-đọc-code-và-tái-kiểm-hp1). Chủ dự án chưa phản hồi đã đọc/hiểu hoặc nghiệm thu.

Vẫn BLOCKED: certified hosted registry rỗng; matching provider/StorageS1/C controls/L protected assessor/deployment và external release trust/action/window chưa có. Fresh npm audit7findings (5high/2moderate), giữ quyết định chờ upstream tương thích Tailwind3; không override/Tailwind4/risk acceptance. Exact79/66Auth/3objects/delete2 và old74/75FAIL giữ nguyên. Không push hoặc hosted action; STOP trước HP2/backup thật/cutover/deploy.

[Private package](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/private-package-01.json) mang5.440files/4.327.352.320bytes, SHA `b3a93b54d2b84cb5d41e234c0785bc6d82f53296a12f9092cea3ab27e820b52f`; raw chỉ nằm Linux0700/0600 và Windows ACL current user+SYSTEM. [Replay từ tar](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/carried-package-replay56.json) lấy source và66members cần thiết vào private root mới, kiểm hash độc lập và hai B/I95checks PASS,0DB/network connections; trust vẫn BLOCKED, eligibilityfalse.

[Owned target archive](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-gates-source56-20261014/final-owned-targets.json) giữ11archives/60containers/T01; [final runtime](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/final-runtime56.json) xác nhận6capture targets và104v2-labelled targets cũ/mới đều dừng,0owned namespace helper còn chạy, T01gốc dừng, volumes giữ. Keeper của task đã đóng đúng identity; không WSLshutdown hoặc service restart. [Preservation](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/preservation-final-03.json) giữ769prior paths/bytes/deletion markers,1303frozen snapshots vàsource40 snapshot,0unexpecteddrift; HEAD giữ nguyên. Source56 tar vàspec bytes lúc capture giữ nguyên; docs hiện tại chỉ bổ sung kết quả/giải thích, không đổi acceptance.

## SEC candidate01 và lượt sửa tiếp theo

[SEC độc lập](../../reviews/permission-hosted-hp1-sec-2026-10-14.md) trả CHANGES_REQUESTED cho candidate01 SHA `88eab04901b435dbe66ea6dd71a32145d8105efefad92257923d53c964b50224`: SEC-01 có thể bỏ bảng/sequence hoặc sửa sequence definition khỏi descriptors trong khi catalog canonical giữ nguyên rồi rehash/propose PASS; SEC-02 exporterPID sai kiểu hoặc alias importer chưa bị từ chối. Đây là lỗi implementation chặn, không nhận thành giới hạn để đóng HP1. Candidate01 và private package56 giữ nguyên; EVC chưa gọi.

Tác giả sửa comparator để đối chiếu exact canonical relations/sequences với descriptors, giữ unsupported relations, exact vector denominator và backend identity typed/distinct/bound. Thêm18 pure cases và12 actual B/I-only graph forgeries có positive baseline, rehash refs/proposed report94/95, đòi đúng rejection code. Windows160/160 slice PASS; nguồn57 phải chạy actual harness và toàn mandatory gates/package mới. Không trộn execution56 thành final57 hoặc đổi acceptance.

[Preliminary57](../../reviews/permission-hosted-hp1-sec-source57-preliminary-2026-10-14.md) độc lập có160tests/27mutation rejections nhưng phát hiện exporterPID dương hợp lệ, khác importer và không có trong raw log vẫn PASS95. Tác giả nhận continuation SEC-02 là blocker, không hạ thành limitation. Nguồn57 đã strict PIN19/PERM60 PASS rồi đóng60applicationcontainers/T01,11archives và6capture targets/110v2-labelledtargets stopped, volumes giữ; không tạo package/candidate cuối57.

Sửa tiếp nguồn58: mang raw `exporterStartRef`/`exporterVerifiedRef`, loader đối chiếu backend/token/visible/read-only/isolation; correlate raw server log exact6SQL mở RR READ ONLY, application/timeout/export, verify và rollback, thứ tự mọi importerACK nằm giữa export vàverify, không extra exporterSQL; log UTF8fatal và session closeexit0. Slice172/172 PASS;11 actual forged graph cases mới phải chạy cùng fresh capture75checks vàfullgates nguồn58, chưa claim PASS khi chưa chạy. Không đổi60TC/19PIN, scope hoặc hosted authority.

## Môi trường WSL đã xóa — ưu tiên dung lượng của owner, 15/10/2026

Bản ghi này thay trạng thái live runtime ở các checkpoint lịch sử trên. Trong chat điều tra
ngày 15/10/2026, owner nói: “không quan trọng phần dữ liệu tạo ra,
tôi ưu tiên lấy lại 170gb bị chiếm dụng”, sau đó yêu cầu tìm nguyên nhân và tránh tái diễn.
Đã unregister đúng Ubuntu-24.04; exit0, tệp ext4.vhdx 186.749.288.448 bytes bị xóa và danh
sách distro trống. C thu hồi 173,924 GiB, free tăng từ 15,790 lên 189,713 GiB tại thời điểm kiểm.

Các target/volumes/private raw/runtime chỉ trong distro đã bị xóa; không dùng những receipt
lịch sử làm bằng chứng chúng hiện còn. Code/docs tại hai worktree Windows vẫn tồn tại.
Package source56 `C:/Users/nguye/AppData/Local/pos-cafe-release/hosted-hp1-20261014/hp1-source56-private-package-01.tar`
đã được đọc lại trên Windows, SHA256 khớp `b3a93b54d2b84cb5d41e234c0785bc6d82f53296a12f9092cea3ab27e820b52f`.
Package đó không phải backup toàn distro hoặc toàn checkpoint58. HP1 vẫn chưa hoàn tất;
không đánh dấu final gate/review/hosted readiness PASS từ việc giải phóng ổ đĩa.

Không tự cài lại WSL/Docker hoặc chạy các recipe cũ khi resume. Ưu tiên mới của owner cho
dữ liệu kiểm thử sinh ra có hiệu lực hơn cách giữ mọi runtime ở checkpoint cũ. Trước khi
được phép dựng lại môi trường phải áp dụng ngân sách và cleanup trong
`C:/Users/nguye/.codex/AGENTS.md`, đồng thời giữ nguyên tiêu chí kiểm chứng/privacy/ACL.
Quy tắc agent đã được lưu; chưa có runner guard hoặc quota WSL kỹ thuật được triển khai.
Nguyên nhân và bằng chứng: [biên bản sự cố](../../implementation-log/permission-hosted-hp1-2026-10-14.md#sự-cố-dung-lượng-wsl-và-phòng-ngừa-15102026).
