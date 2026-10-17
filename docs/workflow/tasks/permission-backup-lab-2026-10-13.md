# Diễn tập backup local — bước 2, 13/10/2026

Trạng thái: **LOCAL EVIDENCE CANDIDATE / chờ SEC→EVC**; chưa đủ đóng toàn bộ bước2 (`coverageComplete=false`). Phase2 hosted vẫn **BLOCKED_PRE_BACKUP**; backup cũ strict **74/75 FAIL**, eligibility false.

Nguồn giao việc: chat `01a11fff-6130-7de2-aa08-8b42afd1a543`, kế hoạch owner “ok làm lần lượt từng cái, cứ làm như trước”, chuyển sau bước1 audit. Phạm vi phiên này: standalone lab/support harness mới, docs/evidence; local rehearsal đã được giao. Không suy thành quyền hosted maintenance, backup, cutover hoặc đổi criteria.

Đầu vào: [proposal A–F](../../runbooks/permission-backup-step2-proposal-2026-10-13.md), candidate audit02 SHA `05d906c8157b5f914017f94b5b55a62aec0043a2d805f79503131adb78e526c2`. Manifest mới nằm tại `D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261013/inputs.json`. Schema đầy đủ lấy từ archive lịch sử; dữ liệu mới synthetic79/145Auth/66outside, không phải inventory hoặc bản sao dữ liệu hosted.

Thứ tự: khóa inputs/matrix → H1 snapshot/dump/restore/sequence/Q → H2 cutover/fault → H3 HTTP Storage/races → khóa candidate → SEC rồi EVC độc lập → trình proposal owner. Giữ mọi thất bại và ca chưa chạy; không dùng số lượng test để lấp thiếu coverage. Review theo AGENTS/workflow, chỉ đọc, không sửa/deploy.

Ranh giới: không app/test/config/lockfile/verifier/spec normative/proof cũ; không commit/stage/push/reset/stash/switch/deploy/upload/promote. Không khởi động retained target, không hosted credentials/connections, không grant/owner change trên hosted. Thay role/bootstrap chỉ trong target local mới. H1 không mở C/L; release còn 7 vấn đề upstream chưa được owner nhận rủi ro.

Checkpoint ban đầu: source34 812 entries có 2 drift tại hai file `useRealtimeInvalidation`; được ghi trong `source-start.json`, không can thiệp task khác. Docker PG image SHA `694296…4f1bb` đã có sẵn; nguồn DB mới network none/không port, socket `/lab`, không preload workers. Private originals ở thư mục mới chỉ current-user+SYSTEM.

## Handoff sau thực nghiệm

- [Biên bản thực chạy](../../implementation-log/permission-backup-lab-2026-10-13.md), [matrix35 nghĩa vụ](../../implementation-log/permission-backup-lab-matrix-2026-10-13.md), [options/criteria/helper delta PROPOSED](../../runbooks/permission-backup-lab-options-2026-10-13.md), [review](../../reviews/2026-10-13-permission-backup-lab.md).
- H1: online exported snapshot/full63table restore và stable branch đạt trong profile; sequence327/archive334/after389. Proof clone nguyên; actual nextval dùng probe khác. Consumer discovery chưa tổng quát, whole-H1 chưa nhận PASS.
- H2: outside Auth drift và pre-admitted bootstrap phá giả định ổn định; nonempty K khiến canonical DELETE order bị FK23503 chặn, rollback bảo toàn. Không production cleanup+activation positive; shadow TX/fault không thay gate.
- H3: actual HTTP/TUS/S3/3payload restore; payload ghi trước metadata commit; worker xóa old version; metadata ABA không bảo đảm bytes; journal exact2 giữ3 trong bucket quiet. Chưa retention/fence/drain supported. Không hosted proof.
- Preserved failed attempts, matrix còn nghĩa vụ BLOCKED/NOT_EXERCISED/NOT_AUTHORIZED. Pre-run whole executable matrix chưa khóa trước run; per-harness assertions và proposal D có trước từng nhóm, consolidated matrix là hồi tố. Không che thiếu sót quy trình.
- Source34 drift2 cuối kiểm; không broad reinstall/retest/shared edits. Container/volume teardown và recoverability ghi `teardown.json`; private archive/candidate snapshot giữ cho review. Không khởi động retained targets.
- Bước kế tiếp: review đúng candidate; chỉ trình owner proposal. Dừng trước criteria acceptance/normative/helper change/hosted backup/cutover. Thực nghiệm chưa tự cấp permission hoặc làm risk acceptance. Walkthrough đã đề nghị, chưa owner phản hồi.

## Metadata review sau khóa candidate

SEC rồi EVC đã **APPROVE** độc lập candidate01 SHA256 `9b6c1705bdd4e85d891bb74201768d8549b45d3ad1b1a0a2c5a40eb5e8307832` cho checkpoint bằng chứng local/proposal; xem [verdict và findings không chặn](../../reviews/2026-10-13-permission-backup-lab.md). Dòng “chờ SEC→EVC” phía trên là trạng thái lúc khóa snapshot, nay được metadata này cập nhật. Không đóng toàn bước2: `coverageComplete=false`, eligibility false; hosted BLOCKED, old74/75 FAIL,7 upstream issues giữ nguyên. Bước kế tiếp là owner xem proposal/criteria; không tự chuyển normative/helper/hosted scope. EVC ghi rõ9/63 bảng có dữ liệu,54 bảng rỗng và còn biến thể restore failure chưa chạy. Các8 target đã dừng, volumes/proof giữ để phục hồi; review không restart.
