# Review recipe/harness Linux CI-1 local — 15/10/2026

[D13 scope](../workflow/tasks/permission-ci1-linux-harness-local-2026-10-15.md): source/recipe + local Node fake-adapter verification only, hardware guard bắt buộc; không actual Linux provisioning/runtime/CI/DB/deploy. Recipe còn chưa có full setup worker/intake; không tự nhận ready-to-run. Source/runtime business assertions không được giảm để qua budget.

Candidate01 `D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/candidate-01.json`, SHA256 `434fa7a11d2c9b2c6d5a4b064f5bf70677b12d72dfc2d8f1207599159e16d3cd`,38files/463791B, giữ nguyên snapshot01. Approval D11/D12 không thay review implementation D13. SEC và EVC đều CHANGES_REQUESTED cho candidate01; từng reviewer tự reproduce14PASS/0FAIL/0SKIP, không nhận fake proof là enforcement thật.

| Finding vòng01 | Nội dung | Trạng thái tác giả trước freeze02 |
| --- | --- | --- |
| SEC-HAR-01 / EVC-HAR-02 |Actual HOME/TMP/cache, runtime mount, daemon exec-root chưa bind đủ vào loop |Đã sửa, chờ reviewer xác nhận |
| SEC-HAR-02 |Không đọc actual StandardOutput/StandardError=null |Đã sửa, chờ reviewer xác nhận |
| EVC-HAR-01 |Observation configId thiếu/sai vẫn nhậnPASS |Đã sửa, chờ reviewer xác nhận |

Candidate02 sẽ khóa tại `D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/candidate-02.json`, snapshot02 gồm source/docs/evidence và14anchors.15NodePASS attempt05 là pure fake-adapter/boundary tests; parse/plan-only đạt. Không có actual kernel/image/cache/backend proof. Bổ sung actual path facts/daemon flags, hardcoded child env và negative controls; giữ nguyên4cases/quotas/lock/D12.

| Reviewer bắt buộc | Trọng tâm | Trạng thái |
| --- | --- | --- |
| SEC |Secrets/raw/private-output/owned paths/DB scope/resource escape/claims |CHANGES_REQUESTED01; PENDING02 |
| EVC |Hardware readback/count+hook+source/stage binding/preservation/recipe/test/evidence |CHANGES_REQUESTED01; PENDING02 |

Reviewer read-only, có thể reproduce đúng Node test/check hoặc in-memory checks, chỉ lưu receipt/log trong D:/Workspace/taskroot. Không sửa candidate/code/docs, không network/secret/installer/DB/Linuxscope/CI/push. Cần cả hai APPROVE final candidate và mọi finding chặn đóng. Phạm vi không bao gồm chứng minh limits đã apply, imagepull/cache fit hay4cases đã chạy; không yêu cầu gọi CI trái owner để duyệt local preparation. Review không cho phép publication/execution.

## Metadata kết thúc sau freeze02

**SEC và EVC cùng APPROVE candidate02**, SHA256 `cf2678553403c2b918df36306c11d18c416e1ec00afc51b77a69c8c331e1e504`,51files/514869B. Các dòng PENDING phía trên phản ánh thời điểm khóa snapshot02. Chỉ bổ sung metadata review/bàn giao; source/recipe/tests/limits của candidate không đổi.

| Reviewer | Verdict cuối | Finding vòng01 |
| --- | --- | --- |
| SEC `/root/review_plan_sec` |APPROVE exact candidate02; tự reproduce15PASS/0FAIL/0SKIP và kiểm51file live/snapshot |SEC-HAR-01 và02 CLOSED; không có finding mới |
| EVC `/root/ci0_execution_evc` |APPROVE exact candidate02; tự reproduce15PASS/0FAIL/0SKIP, parse-only và counterexample configId |EVC-HAR-01 và02 CLOSED; không có finding mới |

[Receipt EVC02](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/EVC-unit-review-02.json), [candidate02](D:/Workspace/pos-cafe/artifacts/permission-ci1-harness-20261015/candidate-02.json). SEC verdict lưu từ message của reviewer trong closeout metadata; không tự nhận là log test do tác giả chạy thay SEC.

Review gate bàn giao **local preparation D13** đạt. Không chứng nhận setup worker/intake hoàn chỉnh, kernel enforcement, cache/image fit,4backend cases hoặc đủ deploy. Không có quyền install/push/runCI/DB/deploy mới, không xóa dữ liệu. Owner chưa nghiệm thu hoặc xác nhận đã đọc code.
