# Review độc lập full PIN19 source-20 — 12/10/2026

## Candidate được review

Hai reviewer chỉ đọc cùng [candidate-01](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/candidate-01.json), SHA-256 `df07e2bce273bd22db09dc44826fd79f56332105605268b79b5e82e4fe68c89d`. Candidate khóa main source-20, docs/support snapshot và evidence index 76 mục. Các sửa hồ sơ sau verdict là **disposition của tác giả**, không thay đổi candidate hoặc làm reviewer đã chấp thuận source mới.

## Reviewer security/oracle — `CHANGES_REQUESTED`

Reviewer tự đối chiếu PIN-01–07, use cases, design, testplan, traceability, executable browser/SQL/canary, reporter, ma trận và receipt. Hash candidate/manifest/index khớp; `verify-source.mjs` drift 0 cho main 810 entry, docs 637, support 12. Browser PIN-only 54/54, SQL 41/41, canary 1/1, không skip/retry theo receipt. Không chạy lại DB/browser, không xác nhận hosted/restore/release.

| ID | Mức | Bằng chứng | Tác động và cách đóng |
| --- | --- | --- | --- |
| SEC-01 | **Chặn** | [`complete:denial` gửi `TEMP_PIN`](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:3490), nhưng [capture](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:3508) chỉ quét `canaryPin` chưa gửi, Key/token/hash. | Leak PIN bị từ chối có thể lọt qua oracle. Quét chính PIN đã gửi, thêm đối chứng âm chèn PIN đó vào từng sink, chạy lại suite liên quan trên candidate mới. |
| SEC-02 | **Chặn** | [`captureTc18Scenario`](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:94) ghi PNG/JSON nhưng sink `artifact` quét `safeArtifact` tự dựng; [matrix](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:4291) chỉ đếm scenario/sink đã gắn `captured`. | Claim quét log/artifact chưa có phép đọc nội dung artifact đã ghi. Đọc/quét file và output runner theo phạm vi, thêm đối chứng âm artifact rồi chạy lại. |

Reviewer **không thấy bằng chứng leak thực tế**. Verdict `CHANGES_REQUESTED` vì thiếu phép kiểm thiết yếu của PIN-07/TC18, ngăn full PIN19 source-20 APPROVE.

## Reviewer coverage/evidence/preservation — `APPROVE` trong phạm vi riêng

Reviewer độc lập đối chiếu 54 variant với TC01–19 và executable, gồm direct REST/SQL/Storage, lost ACK giữ edit, TC19 race/rollback; hash candidate và 76 evidence mục khớp; source main 810 entry, docs 637, support 12 khớp. Receipt browser 54/54 một attempt, SQL 41/41, canary 1/1, retry/fails 0. Ba target dừng, volume/network giữ theo receipt. Không chạy lại DB/browser, không kiểm private dump hoặc chứng minh hosted/restore/release. Không có finding chặn trong **phạm vi coverage/evidence/preservation**. Ghi chú không chặn: các dòng “phủ một phần” cũ trong testplan là checkpoint lịch sử, đã được phần cập nhật mới dẫn tới ma trận.

## Disposition

Tác giả xác nhận SEC-01 và SEC-02 bằng mã nguồn, đánh dấu 18.A `GATE FAIL` trong [ma trận](permission-pin19-source20-matrix-2026-10-12.md) và cập nhật [biên bản execution](permission-pin19-source20-2026-10-12.md), testplan, traceability, tasks và handoff. Source-20 không sửa. Theo [cổng review](../workflow/README.md#review-doc-lap), một `APPROVE` riêng không vượt `CHANGES_REQUESTED`: **full PIN19 source-20 chưa hoàn tất**. Việc sửa oracle cần candidate nguồn mới do chủ dự án quyết định; phải kiểm lại phạm vi ảnh hưởng và nhận hai review trên candidate cuối trước khi tuyên bố đạt.
