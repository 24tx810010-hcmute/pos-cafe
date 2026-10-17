# SEC — source57 preliminary, 14/10/2026

**Chỉ preliminary trong lúc full gates còn chạy. Chưa có verdict APPROVE hoặc final candidate acceptance.** Báo cáo [candidate01](permission-hosted-hp1-sec-2026-10-14.md) và verdict CHANGES_REQUESTED của candidate01 được giữ nguyên.

- Source57 manifest tự hash: `1ec6dd8d4281e9e91ea6a4923dc925f9812d8f86bcc02fd7c4d35a061733e471`; permission fingerprint `0975ed573fa2a9b6731816d8bbad03722b2fc3cce108a05c527aab1a5694b7ea`.
- Đã đọc diff3files so frozen01: permission-hosted-compare.mjs, permissionHostedBackup.tool.test.ts và hosted-backup/local-run.mjs. Không sửa source/tests/expected, không DB/API/network hoặc khởi động fixture/daemon.
- Private review root mới `/var/tmp/pos-cafe-hp1-sec57-4wc9i1_f`, source copy835entries/0mismatch với manifest57, root0700/file0600. Source không lấy từ working main đang thay đổi.

## Kiểm tự chạy

1. Node24.16.0, private clone/cache/TMPDIR, focused hosted+cutover+rehearsal tooling: **160/160 PASS** (133hosted+27controllers),3files, exit0. Run đầu thiếu Git metadata của private clone gây14prerequisitefail; giữ `focused-private.log`. Run sau theo recipe `GIT_DIR=/mnt/d/Workspace/pos-cafe/.git`, `GIT_WORK_TREE=<private>/source`, `GIT_OPTIONAL_LOCKS=0`, cachefalse: `focused-rerun-private.log`. Không đổi test để pass.
2. Baseline capture và B/I-only57 load được95B/IchecksPASS, allocation lần lượt LOCAL_PASS/BLOCKED, trust BLOCKED_TRUST, eligibilityfalse.
3. Tự viết và chạy27mutations qua loader, mỗi case có positive cloned baseline, rehash evidence refs+manifest và proposed report tương ứng95/94checks. Các old table/sequence omission, sequence definition drift, exporter PID string/range/alias với từng4importer, inventory/importer binding, duplicate importer PID, extra/missing từng3sequencevectors, unexecuted value, B/I-only executedprobe, unknown occupied sequence/table và hidden materialized/extension unsupported đều bị từ chối đúng expected HOSTED_* code. Không chỉ dựa catch-any hoặc stale digest/report mismatch. Script `adversarial57.mjs`, kết quả `adversarial57-results.json` trong private root.

Các sửa correlate canonical catalog và typed/disjoint backend identity đã xử lý phản ví dụ cụ thể của candidate01. Tuy nhiên còn continuation dưới đây trước khi đóng SEC-02.

## Finding preliminary — SEC-02 continuation

**Chặn về consistency của exporter evidence:** [compare:54](D:/Workspace/pos-cafe/scripts/permission-hosted-compare.mjs:54) chỉ so identity và distinct PID; [compare:62](D:/Workspace/pos-cafe/scripts/permission-hosted-compare.mjs:62) đọc postgres.log để kiểm importer, chưa ràng exporter PID với log verification thực.

Từ B/I-only positive baseline95checks, đổi duy nhất captureExecution.exporter.pid thành2147483647 (safe positive integer, khác mọi importer), cập nhật captureExecution ref và manifest SHA/bytes. Proposed report giữ nguyên vì PID không thuộc report output. `readHostedBackup` nhận **PASS95**. Log không có bất kỳ line với claimed PID; log verification `app=hp1_exporter` vẫn chỉ original PID. Trust/cleanup/execution tiếp tục BLOCKED/false, nên không có hosted cutover bypass; nhưng graph self-contradictory vẫn được nhận làm actual exporter proof.

Repro private: `/var/tmp/pos-cafe-hp1-sec57-4wc9i1_f/exporter-positive-unobserved.mjs`; sanitized result `exporter-positive-unobserved-result.json`. Script đã dùng output directory mới; muốn chạy lại phải đổi root/label sang private temp mới, không ghi đè original57 hoặc artifact cũ.

Expected sửa: correlate exporter verification/close với đúng PID/application trong carried raw log và lifetime tương ứng; không coi mọi positive distinct PID là identity đã quan sát. Thêm negatives positive PID không có log, missing/renamed/mismatched exporter verification/close log; vẫn giữ positive actual capture. Cần xác nhận thiết kế log thực (prefix app trước/sau SET, framing của close) trước chọn matcher để không giả ACK.

## Phần còn chờ

Chờ tác giả xử lý/giải trình continuation, source mới nếu sửa, full gates và package/candidate02 được khóa. Chưa kiểm SHA candidate02, package57 cuối, preservation/teardown cuối hoặc full PIN/PERM hoàn tất; không suy final acceptance từ slice này. Không chứng nhận hosted capability/external release trust hoặc cấp HP2/deploy.
