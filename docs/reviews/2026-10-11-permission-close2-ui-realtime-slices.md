# Review độc lập — lát UI và Realtime PERM29 trong CLOSE-2, 11/10/2026

- Hai reviewer là subagent không tham gia tạo candidate, chỉ đọc; không sửa source, docs, fixture hoặc chạy DB test.
- Candidate main: `permissionFingerprint()` = `01666b679ba11cc613f4bcf43144a3bdbd5fae47e05e6d83860d20d3d3eb3184`; manifest source main SHA-256 `75ece4c33ded19cd5527be8d0acc0ed6039c19b50979248a9e37cdc9f8f99a50`.
- Ledger đã được hai reviewer đối chiếu ở SHA-256 `2716083fdd6970f648d6a5ea192428b9d719c5f3911d5f5fc19fd439a15ffa73`; các chỉnh sửa tiếp theo ở ledger chỉ ghi metadata verdict này. Snapshot docs cuối có thể đổi do lưu chính biên bản review.
- [Ledger bằng chứng](../implementation-log/permission-close2-evidence-2026-10-11.md) ghi các lệnh chạy, PASS/FAIL lịch sử, safe receipt và giới hạn. Cả hai APPROVE dưới đây chỉ bao phủ lát được giao, **không** phải APPROVE toàn CLOSE-2.

## Reviewer UI/evidence

- Phạm vi: 16 sửa lỗi UI đã được người dùng cho phép; phân loại sáu finding nav mobile; tính đúng của ledger, audit và delta sau sửa Realtime.
- Nguồn tự đọc: năm file UI đã sửa, `ui-audit/report.md`, ảnh chú thích `floor__mobile.png`, ledger; so 796 file main với manifest và đối chiếu hash tài liệu/report.
- Kiểm tra tự thực hiện: xác nhận audit 16 state × 3 viewport, setup0, 0 finding mới; sáu finding là nhãn ẩn có chủ đích ở nav thu gọn, button còn accessible name. UI code không đổi khi test PERM29 được bổ sung. Không chạy lại DB test.
- Finding không chặn: ba PNG của các màn đã sửa vẫn mang timestamp trước sửa vì audit chỉ ghi ảnh cho state còn finding. Ledger cuối đã phân biệt niên đại ảnh; report hiện hành và ảnh `floor__mobile.png` là bằng chứng sau sửa.
- **Verdict: APPROVE** lát UI tại fingerprint main `01666b67…` và ledger SHA-256 `2716083f…`; reviewer xác nhận lại sau delta test và edit trạng thái row16/19.

## Reviewer Realtime/security/evidence

- Phạm vi: publication metadata-only, `SupabaseRealtimePort`, test PERM29, đường signal app hiện hành, tính đúng của receipt/ledger; không duyệt full PERM60/PIN19.
- Nguồn tự đọc: `supabase/candidate/permission-signals.sql`, `src/adapters/supabase/realtimePort.ts`, `realtimePort.test.ts`, `src/adapters/supabase/repos.ts`, `src/adapters/supabase/permissionSignalPort.ts`, `src/app/PermissionLifecycle.tsx`, `tests/supabase/ownerPinOnboardingCloseout.spec.ts`, safe receipt và ledger.
- Kiểm tra tự thực hiện: tính lại fingerprint, receipt SHA-256 `3b446200d352795c2e80bbf8d76fbdc7979b34c3db7c29f0899735b0d7b95b65`, manifest main/docs tại lúc review và đối chiếu test source với app path. Receipt full cuối 45/45 PASS, 0 retry/missing/fatal; postflight PASS được ghi trong transcript/ledger, không nằm trong generic receipt.

| Finding | Phân loại | Vị trí và bằng chứng | Xử lý/xác nhận |
| --- | --- | --- | --- |
| F1: test đầu chỉ dựng `SupabaseRealtimePort` bằng client riêng; app thật dùng `PermissionLifecycle` + `SupabasePermissionSignalPort`, nên claim app invalidation chưa được chứng minh. | Chặn; review đầu `CHANGES_REQUESTED`. | `ownerPinOnboardingCloseout.spec.ts` bản đầu; `repos.ts` và `PermissionLifecycle.tsx`. | Tác giả thêm probe WebSocket/RPC trong browser đang mount, assert signal→protected menu/floor refetch cùng test các topic. Reviewer đọc lại source, đối chiếu full receipt mới và xác nhận F1 đã đóng. |
| S1: join-only negative dùng cửa sổ im lặng 500ms. | Đề xuất không chặn; SQL không có trigger bảng nối và có positive control. | `ownerPinOnboardingCloseout.spec.ts`, `permission-signals.sql`. | Giữ như giới hạn phép đo, không diễn giải thành bảo đảm về mọi thời gian giao nhận. |
| S2: ledger còn câu “full browser đang chạy” sau khi receipt cuối đã PASS. | Biên tập không chặn. | Ledger row16/19 cũ. | Đã sửa row16/19; reviewer xác nhận claim cuối đúng. |

- **Verdict cuối: APPROVE** lát Realtime/PERM29 tại fingerprint main `01666b67…`, ledger SHA-256 `2716083f…`; reviewer xác nhận lại sau F1 và sửa trạng thái. Không có finding chặn còn mở trong phạm vi lát này.

## Cổng vẫn mở

PIN TC01–09 cross-surface, PERM full60 theo 27 profile stage và hai review trên **toàn** candidate cuối chưa đạt. Hai verdict ở đây không miễn các cổng đó, không là phát hành/hosted acceptance hoặc xác nhận chủ dự án đã walkthrough.
