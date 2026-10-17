# Review CI-1 reporter local — 15/10/2026

Phạm vi [PLAN-D12](../workflow/tasks/permission-ci1-reporter-local-2026-10-15.md): đúng2file pure Node module/test, verification thật ở local và docs; không CI/runtime/DB/deploy. Gói sẽ freeze dưới `D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/candidate-01.json`, kèm snapshot source/test/docs/evidence; không dùng approval khảo sát D11 thay approval implementation.

| Reviewer bắt buộc | Phạm vi | Trạng thái |
| --- | --- | --- |
| SEC |Public serializer/key-value allowlist/no-reflection, secret/scope/caller limits |PENDING |
| EVC |Status/count/time/source consistency, tests/reproduction/source preservation/evidence |PENDING |

Reviewer chỉ đọc và có thể chạy lại đúng test thuần Node đã giao (không IO của module/DB/CI/install), không chỉnh source/test/candidate. Mọi finding chặn phải đóng và cả hai APPROVE đúng final candidate; cập nhật verdict sau freeze là metadata, giữ snapshot gốc. Walkthrough owner chưa thực hiện.

## Candidate01 — vòng đầu

SHA256 `46e33dfc32fa6f46789b2372b6ac30f2946b8ae7002ba0fc7f3a807e5dd40aa9`,21files/290764bytes; snapshot01 giữ nguyên. SEC **APPROVE** đúng hash:21file khớp; tự chạy lại6PASS/0FAIL/0SKIP; không finding public serializer/scope/caller limits. EVC **CHANGES_REQUESTED** đúng hash:21files/42hash-size khớp, tự chạy lại6PASS/0FAIL/0SKIP và10kiểm in-memory,8anchors khớp; chỉ một finding về số liệu hồ sơ.

| Finding chặn | Bằng chứng | Xử lý tác giả | Trạng thái |
| --- | --- | --- | --- |
| EVC-REP-01 |Task ghi baseline C207212310528B, receipt ghi207212412928B; lệch102400B, reserve vẫn đủ |Sửa đúng số task khớp receipt; không sửa baseline, source/test hoặc snapshot01, không cần chạy lại unit |Đã sửa; chờ EVC xác nhận candidate02 |

Candidate02 khóa delta docs và lịch sử review; cần SEC/EVC cùng APPROVE final hash. Không chuyển SEC approval01 thành final02 nếu chưa xác nhận delta. [Receipt EVC](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/EVC-unit-review-01.json). Cả hai không kiểm runtime/backend/CI/publish và không cấp quyền phát hành.

## Verdict cuối — candidate02

[Manifest](D:/Workspace/pos-cafe/artifacts/permission-ci1-reporter-20261015/candidate-02.json), SHA256 `3bfe93403a693654919f165867027db79cba45f6a3c585528ba292db7e6cf43e`,21files/291987bytes. Snapshot02 giữ nội dung trước verdict; phần này chỉ ghi metadata review sau freeze.

| Reviewer | Verdict final02 | Đã kiểm và giới hạn |
| --- | --- | --- |
| SEC |APPROVE |21live/snapshot hashes/bytes khớp,291987B; delta chỉ số C và review history. Source/test/evidence không đổi, không cần chạy lại Node; không finding mới. Approval giới hạn public serializer D12 |
| EVC |APPROVE |21files/42hash-size khớp,291987B; EVC-REP-01 đóng. Candidate01/snapshot01 còn nguyên; source/test/contract/expected/evidence không đổi nên6PASS và10checks in-memory vòng đầu vẫn áp dụng. Không finding mới |

Tất cả finding chặn đã đóng. Mỗi reviewer đã tự reproduce6PASS/0FAIL/0SKIP trên cùng source ở vòng đầu; re-review chỉ đọc delta tài liệu, không chạy thừa unit. Không có xác minh caller/harness/backend/CI/Vercel/Supabase mới. Review không cấp quyền install/push/CI/DB/deploy/xóa. Hướng dẫn đọc3phần code đã gửi owner trong commentary và lưu trong implementation log; chưa có xác nhận owner đã đọc/hiểu hoặc nghiệm thu.
