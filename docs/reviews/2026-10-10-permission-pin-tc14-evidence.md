# Review độc lập TC-PIN-14 — bằng chứng và fixture, 10/10/2026

- Reviewer: subagent `/root/tc14_evidence_review`, không tham gia sửa candidate; chỉ đọc.
- Phạm vi: tính khôi phục của source snapshot, độ khớp manifest/tar/reporter, pre/postflight và scope của [biên bản TC14](../implementation-log/permission-pin-tc14-closeout-2026-10-10.md). Không review oracle nghiệp vụ hay full release.
- Candidate cuối: manifest v3 SHA-256 `138a2e906ff2733b51a638aa608e7ad5dc3b64598be1e466513eb7da5ca4b74c`; tar SHA-256 `a4de4a2d7880a4e57e8439e5e2897446a45703d5d0eec6784a3aefa52fba81ca`.

## Finding và xử lý

- Vòng đầu **CHANGES_REQUESTED, chặn hồ sơ**: biên bản thiếu UTC/exit code theo workflow; raw reporter chỉ nằm ở đường dẫn có thể bị ghi đè và chứa trường anon key. Tác giả thêm reporter start `2026-10-10T14:46:40.922Z`, shell exit0 và giữ bản raw nguyên byte ở vùng private local `/var/tmp/pos-cafe-perm-pin-onboard-20261009/private/reports/tc14-v3-raw.json`, quyền `0600`, SHA-256 `115123b9bc702e24f4d4d90d032f3d6e81739f05855c20ac2f7f88e4927fb0c0`. Không đổi test/source hay chạy lại sau chỉnh metadata.

## Kiểm lại candidate cuối

Reviewer kiểm manifest/tar có đúng 782 path duy nhất, hash từng byte archive khớp manifest và source hiện hành drift0; base HEAD khớp. Raw reporter có đúng ba test employee/menu/floor PASS, expected3/unexpected0/skipped0/flaky0, worker1/retry0; bản private 17.529 byte, SHA khớp receipt, quyền `0600`. Preflight kiểm project/marker/config/migrations/contract/API↔DB; postflight kiểm fixture graph 0 và binding. Đúng 12 container target 599xx running0, volume/network còn. Reviewer không sửa file hoặc ghi DB.

**Verdict cuối: APPROVE** cho tính xác thực của bằng chứng TC-PIN-14 v3 local. Không xác nhận gate tổng hợp hoặc phát hành.
