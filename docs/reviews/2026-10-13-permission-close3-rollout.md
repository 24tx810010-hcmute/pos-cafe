# Review CLOSE-3 rollout preparation, 13/10/2026

Phạm vi: hồ sơ read-only capability/binding/env blocker, local compile/package và controlled-rollout proposal. Không phải release approval, owner acceptance hay CLOSE3 closed.

Candidate manifest/snapshot hiện khóa lại tại `D:/Workspace/pos-cafe/artifacts/permission-close3-rollout-20261013/candidate-03.json`. Reviewer không sửa file hoặc deploy; SEC rồi EVC tuần tự, cả hai phải APPROVE exact final candidate. Findings/verdict được lưu nguyên nghĩa trong metadata addendum sau khi review.

- SEC: authority, exact target, secrecy, no-push/no-publish, rollout ordering và rollback boundary.
- EVC: evidence thật, provenance/time/source/runtime/hash/compile, nhận diện nextenv UNKNOWN và giới hạn proof.

Trạng thái lúc khóa: chờ review. Metadata verdict sau khóa không thay content snapshot; mọi thay đổi substantive sẽ tạo candidate mới và xin review lại.

## Lịch sử candidate01

SEC **CHANGES_REQUESTED** trên SHA `44841ab5f44d5b72404c9b922e15e808fe1cf084bd0058e338fb19c01abe4ebf`.

**SEC-01, chặn:** runbook bước1 nhánhB nói upload sau quyền publish chung trước backup/review/backend, mâu thuẫn bước5 yêu cầu backend trước deploy. Skip-domain vẫn tạo public surface. Sửa bước1 chỉ chọn/ghi cơ chế, freeze kênh, cấm push/upload/deploy; toàn bộ upload chuyển bước5 sau bước2–4 và đúng candidate/quyền. NhánhA cũng phải có quyết định owner thay thế no-push trước push. Chờ SEC recheck candidate02; compile/source không đổi.

SEC đã tự kiểm candidate hash,30 snapshot/336 referenced hashes/source812 khớp; scope79/Auth66/Storage2+1; TLS READ ONLY/GET-only/scripts local; secrecy scan; role/env/control evidence; rollback và STOP. Chưa hosted mutation/backup/Edge/runtime/CLI/domain-control/provider rehearsal/release. Reviewer không edit hoặc mutation.

## Lịch sử candidate02

SHA `3e8a27f52f4af74ba15d6e57f571a7934e007ec580d52c35e71601a3656b3d5e`. SEC **APPROVE**, SEC-01 đóng: bước1 cấm upload/push/deploy, bước5 chỉ sau2–4 và đúng candidate/quyền; nhánhGit phải có owner thay thế no-push. Delta runbook/review history,30 snapshots/336 refs/812source khớp, scan0; không mutation/rebuild.

EVC **CHANGES_REQUESTED**, một finding chặn **EVC-01**: receipt/script/log pin npm package-lock như dependency binding nhưng compile dùng installed pnpm Vite8.2.1/plugin-react6.0.5, npm lock8.0.16/6.0.2. Yêu cầu supplement read-only pnpm lock/installed lock/.modules và actual package paths/versions; ghi hồi cứu, tái hiện pnpm trên copy cách ly; không cần rerun build/hosted hoặc đổi source31.

EVC đã kiểm561 hash/size mismatch0; source812/archive810 live+2deleted,HEAD/bundle;16AX khớp raw đã redact;live/candidate/config tuple khớp;154static/156package/2HTML refs;provider declarations;scope79/Auth66/Storage2+1;restore vẫn74/75 cleanupEligiblefalse;scan0. Chưa compile/typecheck/suites/hosted/mutation/nextenv/domain/runtime/owner acceptance.

Tác giả xử lý EVC-01 bằng dependency-provenance.mjs và receipt hồi cứu09:26:20.043Z, pin metadata/30 direct package manifests, giải thích npm lock lịch sử và provider recipe parity còn mở. Original build receipt/scripts/bytes giữ nguyên để không dựng lại lịch sử. Candidate03 chờ SEC rồi EVC recheck same exact candidate; không đổi app/source31.

## Metadata kết quả cuối — 13/10/2026, sau khóa

**SEC rồi EVC cùng APPROVE candidate03 SHA `d1a6fdeb1d79a87bda8adae0c5a5c7d74af91fd1844b26d2a82a454c6df72a78`.** Đây chỉ là metadata verdict; snapshot candidate03 vẫn giữ nguyên. Các câu chờ review ở trên là thời điểm khóa.

- **SEC APPROVE:** delta dependency script chỉ đọc/copy metadata local, không network/install/build/push/hosted mutation.32 snapshots/371 referenced hashes/source812 khớp;35 private files mới là dependency metadata, phần cũ không đổi; scan0. SEC-01 đóng, authority/target/scope79/order/rollback/STOP giữ nguyên. Không còn finding chặn trong SEC. Không chứng minh runtime/reproduction/hosted execution; không sửa file.
- **EVC APPROVE:** EVC-01 đóng; hồi cứu đúng09:26:20.043Z, pnpm11.6.0 và hai lock cùng SHA;30 manifests/resolved paths+Vite entry/chunk.502 hash/size checks mismatch0,source812 drift0;330 private refs cũ/original compile receipt/config/dist/prebuilt giữ nguyên. Vite8.2.1/plugin6.0.5 thực so với npm-lock8.0.16/6.0.2 được giải thích đúng; reproduction NOT RUN/cloud parity còn mở. Không còn finding chặn EVC; không hosted/reinstall/build/historical gate/mutation.

Hợp hai phạm vi đủ bàn giao **hồ sơ read-only và local preparation**, không chứng minh release gate đạt. CLOSE3 vẫn PARTIAL/BLOCKED, STOP trước backup mới/cutover; không owner acceptance, không quyền push/deploy mới. Tác giả không thay nội dung substantive sau hai verdict.
