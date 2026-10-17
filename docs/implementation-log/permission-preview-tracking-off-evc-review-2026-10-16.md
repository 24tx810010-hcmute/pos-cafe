# EVC — actual Preview Branch Tracking OFF, 2026-10-16

**Verdict: APPROVE** checkpoint đúng candidate SHA256 `b7ddc871cf4562d095a9bdc0b77a6c88aca8e791881b9296444d178fdce03919`. Không có finding blocking trong phạm vi thao tác Preview đã được owner cho phép. Không phải publication/release approval.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-git-milestone-20261016/preview-tracking-off-01/candidate-01/manifest.json`.

## Kiểm độc lập và kết quả

EVC đối chiếu đủ **8 original/snapshot files, 101.095 bytes**, mọi size/SHA256 khớp, không drift. Previous proposal manifest vẫn đúng SHA `62bf3101f518962e18b7ba986e39ae04bb7c9fd0d26243306017c0f31966bf0b`. Đã đọc authorization/receipt/report, accessibility evidence trước–sau/Production/overview và trực tiếp xem JPG sau reload; không mở browser/provider mới.

Owner `call_be33cd11bcb8463e90c03060b324d81c` ghi “Cho phép tắt auto Preview, chưa push”. Baseline giới hạn đúng Preview OFF → Save → readback và giữ OFF tới lệnh sau; không tạo quyền Git, Production, DB hoặc deploy.

| Evidence đã lưu | Kết quả EVC đối chiếu |
| --- | --- |
| before-accessibility.txt:1,66,73 | Đúng Preview URL của project; Branch Tracking=1, All unassigned branches |
| after-reload-accessibility.txt:1,66,70 | Cùng Preview URL; Branch Tracking=0 và Save disabled |
| preview-off-after-reload.jpg | Công tắc OFF và Save disabled hiển thị, khớp accessibility snapshot |
| production-settings-after.txt:63,71,77,81 | Production main; Auto-assign Custom Production Domains=1; Save disabled |
| production-overview-after.txt:66,79,91–93 | Deployment DqnFhDaswqUcqiryL6A2XwDfMmHY, Ready, main/source5156820 vẫn được dashboard hiển thị |

Đối chiếu thêm normalized provider observation của proposal trước: Production branch/auto-assign/deployment/source nêu trên khớp record trước thao tác. Kết luận đúng là **displayed Production metadata giữ nguyên**, không phải kiểm toàn aliases, routing, site nghiệp vụ hoặc database.

Receipt giữ sự kiện đầu tiên: uncheck input sr-only thất bại, observedStillOn=true và saved=false. Sau đó click nhãn hiển thị, một Save click, rồi reload đọc lại OFF. Hai snapshot trạng thái và JPG hỗ trợ kết luận persisted readback; số lần click và chuỗi hành động là provenance do receipt ghi, EVC không replay thao tác hay tự dựng tool transcript. Báo cáo không giấu lỗi đầu hoặc nhận trạng thái unsaved là kết quả cuối.

## Git, tài nguyên và boundaries

Tự so baseline/receipt cho cả hai worktrees: branch, HEAD và staged-entry SHA giống nhau; stagedPaths trước/sau đều0. Đây là hash staged entries, không phải hash raw physical .git/index hoặc toàn working tree. EVC kiểm records, không chạy Git/source audit toàn bộ trong lượt nhỏ này.

Receipt ghi source application không sửa và temporary tab đã đóng. Không suy từ tab closure hoặc dashboard Ready thành test/application PASS. Không mở env values, private inputs/credential, runtime hay DB; evidence chỉ có tên biến/metadata UI, không có secret values được hiển thị.

Scope evidence 101.095 bytes/snapshot cùng bản gốc nhỏ hơn allocation1MiB cho bước này; baseline C/D còn201.519.562.752/102.733.381.632 bytes, trên reserve30GiB. Allocation nằm trong budget8MiB task chuẩn bị; không cài/tải/copy runtime. Hồ sơ ghi đúng operational budget, không tuyên bố OS quota.

## Findings và ý nghĩa verdict

Không có finding chặn còn mở. Hồ sơ khép thao tác được duyệt theo **UI Save/reload evidence**, không giả rằng EVC đã gọi API độc lập hoặc test push để chứng minh trigger.

Preview OFF áp dụng mọi unassigned branches của đúng project này; giữ OFF tới lệnh owner bật lại. Main Production push, manual CLI/API deploy và project/provider khác vẫn có thể có đường thực thi riêng; setting này không khóa chúng và không tạo quyền dùng chúng. Existing Preview không bị xóa.

publicationReady=false và NOT_READY_FOR_DEPLOY còn nguyên. Exact payload/history privacy, commit/refspec, backend/cutover/full gates và lệnh push riêng chưa được cấp bởi việc toggle. Proposal trước là lịch sử; actual checkpoint này ghi trạng thái mới mà không đổi các PASS/FAIL/UNKNOWN khác.

EVC chỉ đọc/hash saved artifacts và xem ảnh local. Không provider/DB/browser calls, actual tests/push/deploy, project-module import, branch/stage/commit/push/settings/CI, install hoặc delete. Không mở audit toàn application/publication ngoài phạm vi.

