# CLOSE-3 — backup v2 LOCAL, 14/10/2026

Trạng thái: hoàn tất slice LOCAL; SEC và EVC APPROVE candidate02 (xem metadata đóng task cuối file). Task nhạy cảm. Main `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, shared dirty checkout; giữ mọi thay đổi có trước.

## Quyết định BACKUP-AB-14 — đã chấp nhận

Nguồn: chủ dự án tại chat `01a11fff-6130-7de2-aa08-8b42afd1a543`, ngày14/10/2026: **“ok vậy áp dụng phương án backup bạn đề xuất, sửa spec/helper rồi kiểm lại tuần tự. Xong báo tôi trước khi sang phần tiếp theo, không push nhé. Cần thì tạo session mới.”** Handoff chuyển tiếp quyền, không mở rộng quyền.

Áp dụng A cho B/I và B cho C/Storage theo [delta F](../../runbooks/permission-backup-step2-proposal-2026-10-13.md) và [options14Oct](../../runbooks/permission-backup-lab-options-2026-10-14.md). Lý do: lab chứng minh sequence ngoài MVCC không làm archive sai; cached/shared/dynamic consumers và Storage bypass bác các giả định an toàn rộng. Chọn fidelity riêng + contract allocation hẹp có provenance; loại phương án mặc định freeze mọi64 relation/sequence chỉ để dump. Không hạ coverage/full-row/C/L. Các proposal cũ và74/75FAIL là lịch sử bất biến.

Được sửa spec/helper/loader/test và kiểm LOCAL tuần tự; không implementation subagents. Review read-only SEC rồi EVC cùng final candidate theo AGENTS. Không stage/commit/push/reset/stash/switch/clean/deploy, hosted probe/write, provider contact, dependencies hoặc business/app/SQL changes. Không maintenance window mới. Scope EXACT79 vẫn là original77+exact2 được pin private; preserve66Auth và object3; delete allowlist exact2. Knonempty chặn empty-target cleanup, không tự quyết forward-fix/reconcile.

## Kế hoạch trước implementation

1. Spec PERM-06/30, UC14, design8.2.1, TC53 subcases, traceability, T17/T18; tham chiếu PIN-T07, không đổi60TC/19PIN.
2. Helper v2 đầu-cuối: guarded new local target → shared exported snapshot/dynamic exact inventory/canonical digests/custom dump → pinned TOC SEQUENCE SET parse → empty isolated restore → full compare → allocation trên clone khác. Immutable v2 manifest/report + loader dispatch; old format giữ nguyên, không alias thành v2.
3. Negative controls: schema/status/check identities/hash/source, snapshot/importer, TOC missing/extra/duplicate/BigInt/is_called, same-count row/catalog/LO corruption, unsupported consumer/cache/cycle/cast/range, Storage unsupported controls. Required skip/retry không PASS.
4. Fresh richer fixture35/63, ghi runtime/input/archive/command UTC/exit và giữ failures. Tạo source mới, gates npm theo configured recipe trên source/dependencies cách ly; evidence cũ không tự chứng nhận helper mới.
5. Freeze exact candidate code/tests/spec/evidence → SEC → sửa/check → EVC → cả hai APPROVE exact final SHA. Teardown đúng owned targets; giữ archives/volumes.

Hosted phase2 vẫn BLOCKED; executionReady/cleanupEligible false nếu thiếu allocation, C, Storage hoặc actual actor/provider control.7 dependency findings vẫn chặn release. Dừng sau slice và báo owner trước bước tiếp. Walkthrough sẽ được cung cấp; chưa ghi owner đã đọc/hiểu.

## Checkpoint lịch sử — source39

Ở checkpoint này, source đang kiểm:39, manifestfb0d9d5611ebecf57893219cd74f6cf9bd3c8c2bf9e350afeaa210418be7aedc, permissionFingerprint b9555ff76807a7673166b49c6f64e75c5a1657b542d02f911f76ed2ab7f9f17a. Code13delta trong phạm vi; complete-schema so nguyên SQL dùng cùng per-run random restrict key, không lọc dòng. Runtime backup28/28, B/I91/91 và Storage8/8 đạt; toolkit344. Core/UI đang hoàn tất; full gate39 chưa chạy. Source37 full gate dừng ở T02 transport PATH, source38 schema framing FAIL; giữ lịch sử, không ghép PASS. Xem implementation-log để có chronology và một historical snapshot lệch hash do marker redaction chưa xác lập nguyên nhân.

Tiếp: core39 → fresh offline preservation5fixtures → PIN19/PERM60 source39 tuần tự → strict aggregate/extra proof negatives → exact final candidate → SEC → EVC. Hai reviewer phải APPROVE cùng candidate; tại checkpoint39 này chưa gọi. Dừng trước hosted phase2, không push.

## Kết quả kiểm chứng cuối trước review

Source39 hoàn tất core +fresh helper/Storage +full PIN19/PERM60 tuần tự. Strict aggregate:60cases/27stages/726variants,0errors; PIN55browser/41SQL/1canary/2operator/110tooling,0skip/retry. Core1173unit/344tooling/build/2typecheck/UI16×3 đạt, UI0real defects/6false positives đã xem ảnh. Ma trận/source/environment/failures/historical mismatch được ghi tại [implementation-log](../../implementation-log/permission-backup-v2-2026-10-14.md). Đã dừng41v2 targets và5test stacks/T01, giữ volumes/archives.

Phần còn lại trước bàn giao: final candidate và hai verdict SEC→EVC cùngSHA tại [review](../../reviews/2026-10-14-permission-backup-v2.md). Không chuyển sang hosted phase2 hoặc push. Backup v2 LOCAL không mở C/L, Storage global control/provider vẫn BLOCKED và7dependency findings vẫn chặn release. Walkthrough đã cung cấp trong runbook, owner chưa xác nhận.

### SEC-01 — bổ sung oracle globals (14/10/2026, đang kiểm)

Candidate01/source39 bị SEC yêu cầu sửa: projection roles thiếu expiration/comment/security labels. Source40 đã bổ sung `rolvaliduntil`, shared comment/security-label catalog, cùng bốn bản `pg_dumpall --roles-only --no-role-passwords` từ source trước capture, source cuối cửa sổ, pristine và allocation clone. Cùng binary/flags/restrict-key ngẫu nhiên cho một run; so toàn văn, không bỏ dòng. Mọi artifact/command được pin và loader tự recompute ba check bắt buộc `catalog:complete-roles`, `catalog:probe-roles`, `catalog:roles-window`. Cửa sổ source lệch phải refuse `BACKUP_V2_CATALOG_WINDOW_DRIFT`. Password vẫn ngoài profile đã ghi; không suy ra hosted global actor control. Positive fixture có expiration/comment; negative sửa riêng từng thuộc tính trên clone mới và trong source window, cộng forged PASS proof. Đây là sửa completeness trong phạm vi backup được ủy quyền, không đổi nghiệp vụ hoặc mở phase2. Source39 và candidate01 giữ nguyên, không tái gán PASS.


## Checkpoint hiện tại — source40

Source40 đã xong fresh helper36/94fidelity/3allocation,Storage8,core/PIN19/fullPERM60 tuần tự; mọi số liệu và giới hạn ở [biên bản](../../implementation-log/permission-backup-v2-2026-10-14.md#candidate-cuối-source40--local-đã-kiểm-chờ-secevc). SEC-01 chờ reviewer kiểm lại; EVC chưa có verdict. Cả hai phải APPROVE exact candidate. Dừng trước hosted phase2, không push.

## Metadata đóng slice LOCAL sau review — 14/10/2026

SEC và EVC đã **APPROVE** cùng candidate02 SHA `1109d6efe26070ff6c26305eebc1c3bb118b59c19563c939c4702c0d6eaca13f`; SEC-01 CLOSED, EVC không có finding chặn. [Verdict/phạm vi/giới hạn và ghi chú tái hiện EVC-R1](../../reviews/2026-10-14-permission-backup-v2.md). Hoàn tất spec/helper/loader và kiểm LOCAL theo ủy quyền. Không stage/commit/push, không hosted phase2/provider action;7dependency findings và hosted C/Storage/L gates vẫn chặn.53v2targets,5teststacks,T01 và keeper đã dừng; giữ volumes/archives, không Playwright MCP process. Walkthrough đã cung cấp, chưa có xác nhận owner hiểu. Các checkpoint trước vẫn là lịch sử; chỉ metadata review/status này bổ sung sau freeze, không thay source/expected/evidence.
