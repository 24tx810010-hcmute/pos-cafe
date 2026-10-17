# CLOSE-3 phase2 — checkpoint chẩn đoán, 13/10/2026

**PARTIAL / BLOCKED.** Target/scope đối chiếu được; phương án khóa local đã đo và tìm phản ví dụ, chưa có hosted quiescence đầy đủ. Không tạo fresh eligible backup, không actual restore mới. [Quyền/bàn giao](../workflow/tasks/permission-close3-phase2-2026-10-13.md), [runbook](../runbooks/permission-phase2-quiescence-2026-10-13.md).

## Nguồn và môi trường

Source34 không thay đổi812entries; fingerprint `a711636bf2f9f357d37129603befb6ef388c64b9011156c87705f9c1fe9a2b43`. Manifest source SHA `3053eb5a9bade4b1ee9dca090e473a6c6c82415eab02471874ba910ff5be92c3`; tar gốc SHA `15f349e3414ea9d76884acdd5518559a285233a9a4fcbe27365a85659e1591d7`. Không tái chạy full PIN/PERM vì app/SQL/tests/dependencies không đổi; kết quả source34 trước là historical input, không bao trùm helper mới.

Public artifacts `D:/Workspace/pos-cafe/artifacts/permission-close3-phase2-20261013/` (B); private `C:/Users/nguye/AppData/Local/pos-cafe-release/close3-phase2-20261013/` (P), Windows ACL current user+SYSTEM. Credential Import-Clixml qua child stdin, đúng username project-bound/TLS CA SHA `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`; không `.env.local`, không in password/JWT/UUID rows. Raw catalog/source references giữ private.

WSL Ubuntu24.04 Docker29.1.3. Lab image pin `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`, PG17.6, no network/ports/bind mounts/preload workers. `phase2_bootstrap` chỉ tạo synthetic fixture; mọi thử quyền operator dùng session_user/current_user `postgres` có flags observed NOSUPERUSER/BYPASSRLS và21 memberships. Provider owner role chỉ thử nhánh đối chứng trong local.15 custom roles,64 synthetic tables,3 sequences; realtime.messages là ordinary synthetic table thay partitioned parent, không kiểm partition topology/data. Hosted provider binary bytes, Auth/Storage runtime/version chưa biết; đây chưa phải complete matching-provider rehearsal.

## Kết quả tuần tự

| Milestone | Đã chạy / bằng chứng | Kết luận đúng phạm vi |
| --- | --- | --- |
| Source/approval provenance | phase-inputs đọc pinned scope79, tái derive original77+exact2;812 source entries drift0 | Không đổi source34, không chọn UUID từ count/date |
| Fresh hosted SELECT | `invoke-read-target.ps1`,13:53Z; `invoke-read-target-complete.ps1`,13:55Z; exit0 | Exact79,145 Auth/66 preserved,3objects,33closure, storeAuthFK validated; không whole-data full-row/hash/payload proof |
| Complete catalog/capability | `target-complete-safe.json`, P/target-complete.json SHA `5dfc57d9ba33f0f7d3ed09c41d807341bd12ea6296cfa64b641c5fc15adfc8db` | inventory catalog `f331650154b5109790626fb9343fca0de5d081f41b42110b666df975193ff13c`; release catalog `7781f5fb0b4c2c2cbcdd7c02f1ffd71fcedc6d1593a6d39519adaa880ea8c84d`; provider matchertrue không thay write proof |
| New isolated lab | `prepare-quiescence-lab.mjs`,exit0; `lab-ready.json` | New container/volume `pos-cafe-phase2-quiescence-aa68aa73`;64 effective table privileges/owners đối chiếu đúng; không restore dữ liệu thật |
| Concurrency/fault diagnostics | `test-quiescence-lab.mjs`,14:00Z,exit0; `lab-tests-2026-10-13T14-00-09-933Z.json`:29/29 | Expected diagnostics đạt, **quiescence không đạt**. Auth/business/Storage metadata waits, read-only dump compatibility, direct-nextval bypass, privilege denials, MVCC sequence drift, inflight/idle/hard deadline/EOF/rollback |
| Preparation-only backup79 contract | `backup79-plan.mjs`, `test-backup79-plan.mjs`,exit0; `plan-tests.json`:29/29 | Missing/extra/replaced UUID, outsideAuth/object3, source/target/TLS/FK/catalog/hash, fake proof/eligibility/sequence bypass bị từ chối; actual source34 loader vẫn từ chối old backup/restoreFAIL |
| Fresh backup/actual restore/proof | NOT RUN | Capability và maintenance window chưa đủ; không chuyển partial thànhPASS hoặc lặp preservation backup để giả sequence stability |
| Full phase3 provider/controller, cutover, cleanup, activation, Storage delete, publish | NOT RUN | Ngoài phase2, no-push/releaseblock còn hiệu lực |

P/backup79-plan.json SHA `a155a985781a41975d609ea2da36ef7e847c553f8b14c671b25e31bbd5affbdb`, scope-only preparation `executionReady=false`, `cleanupEligible=false`; không gọi là controller inventory hoặc executable backup helper.29 guard cases kiểm contract và actual source34 file-only loader negatives; không kết luận runtime backup/restoration từ JSON tests. Synthetic envelopes riêng P/plan-negative-inputs chỉ đi tới nhánh rejection của loader.

## Những thử chưa đạt được giữ nguyên

1. Probe13:53 chỉ bốn schema app/Auth/Storage và không xét MAINTAIN. Đã bổ sung probe13:55 toàn non-system schemas + MAINTAIN: **năm** bảng thiếu SHARE (thêm realtime.schema_migrations), **ba** sequences (thêm Realtime). Không dùng báo cáo đầu làm full coverage; cả source/report giữ nguyên.
2. Lab run13:58 exit1:25/29. Bốn lỗi ở phép đo/giả thuyết chẩn đoán, không phải gate restore75 bị thay: so toàn cấu trúc partition của synthetic table; giả SHARE bị cấm READ ONLY (thực tế được phép); nhìn riêng last_value ban đầu1 mà không is_called; đọc stderr timeout trước lúc psql nhận server error.
3. Lab run13:59 exit1:10/11 rồi dừng. `row_to_json(sequence_record)` trả42809 do sequence không là composite relation phù hợp. Chuyển sang `json_build_object(last_value,is_called)` rõ cột; không đổi semantics strict verifier. Chụp nguyên `test-quiescence-lab-v1.mjs`, `-v2.mjs`; hashes khớp script refs của hai failed reports mặc dù path report chỉ tên current lúc chạy.
4. Lab run14:00 exit0:29/29. Chỉ so64 effective privileges/owners, ghi rõ topology không tương đương; observation nextval so last_value+is_called, buộc psql nhận lỗi sau idle timeout. Báo cáo vẫn `liveQuiescenceReady=false`. Chưa có full provider runtime simulation, không coi29 là75checks backup.

Không sửa/xóa backup13/10 cũ, comparison72→74/75 hoặc eligibilityfalse. Strict75/75 mới chưa chạy. K0/Storage3/3 trước là lịch sử; không claim K recovery hay payload backup mới. Schema/rows synthetic không có PIN/token thật; source Auth/storage metadata trong P không dùng làm fixture ở lab.

## Kết luận và bước cần owner/provider

Postgres actor hiện có không chứng minh được full writer/sequence freeze;5 bảng provider không có SHARE,2 sequence provider không có owner/SET ROLE, Storage byte/background work ngoài chứng minh của table lock. Cần control provider cụ thể giữ DB/Storage GET trong khi drain/block writers; không thể chỉ xin “cho khóa20 phút” rồi làm một cơ chế đã biết thiếu scope. Window20 phút, acquire5s, backup abort18phút/reopen2phút là đề xuất chưa được duyệt/chưa diễn tập duration này. Chi tiết request và undo ở runbook.

Teardown theo `teardown-safe.json`/`keepalive-stopped.json` sau đối chiếu identity, giữ volume. Không dùng browser/Playwright MCP; không có browser của task cần đóng. Không broadkill/WSL shutdown hoặc đụng retained targets. Source/main/docs HEAD giữ nguyên; chỉ artifacts mới và tài liệu liên quan thay đổi.

Hai review bắt buộc SEC → EVC sẽ đánh giá exact snapshot **hồ sơ PARTIAL/BLOCKED**, authority/outside preservation/lock limits và evidence/provenance/semantics. Verdict ở [review](../reviews/2026-10-13-permission-close3-phase2.md). Chưa owner acceptance. Đường walkthrough: phase-inputs → complete target → lab denials/concurrency → blocked backup79 contract; đã chuẩn bị, chưa owner xác nhận đã hiểu. Khi unblock vẫn phải hoàn thành phần backup/restore còn thiếu rồi mới phase3, không bỏ gate để chuyển bước.

**Metadata review sau freeze:** SEC rồi EVC đã APPROVE cùng candidate-01 SHA256 `eb30c03577b312f5c810caa5ce48443b3d2c3e95ebbf0416946bd2f3a20fb3ad`; [verdict/giới hạn](../reviews/2026-10-13-permission-close3-phase2.md). Chỉ hồ sơ checkpoint qua gate review, không fresh backup/restore hoặc release. EVC-N1 không chặn: bổ sung receipt Node/runtime/dependency cho executable helper kế tiếp. Snapshot candidate và toàn FAIL cũ không sửa.
