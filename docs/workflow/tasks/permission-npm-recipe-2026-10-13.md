# Mục1 — tái hiện npm recipe và khóa local config (13/10/2026)

Trạng thái: **local npm recipe + config candidate đã tái hiện; readiness tổng PARTIAL/BLOCKED**. Chờ SEC→EVC đúng final candidate trước bàn giao hồ sơ. Kế thừa [CLOSE3 rollout](permission-close3-rollout-2026-10-13.md), không thay trạng thái phát hành. [Bằng chứng và giới hạn](../../implementation-log/permission-npm-recipe-2026-10-13.md).

## Phạm vi đã giao

Theo brief chat nguồn `01a11fff-6130-7de2-aa08-8b42afd1a543`, người dùng “ok vậy làm đi” cho mục1, tuần tự và báo trước mục2. Tái hiện thật `npm ci` → `npm run build` trên bản sao mới source31, khóa cấu hình public đúng target bằng provenance private, kiểm tra cần thiết, SEC rồi EVC cùng candidate cuối. Không push main/docs, Git mutation, deploy/upload/promote, provider/env/domain/settings mutation, backup/quiescence/rehearsal/cutover/cleanup/activation/Storage delete.

Không tạo requirement mới; slice verification dùng spec/gate permission hiện hành và hồ sơ CLOSE2/CLOSE3. Không viết app, không thay lock/expected/baseline. Lựa chọn kỹ thuật của AI: Ubuntu24.04 WSL, Node24.16.0/npm11.13.0, cache và config npm trống riêng, source từ archive đã pin. Exact cloud runtime và next-cloud Secret env UNKNOWN.

## Acceptance

1. Archive/source31/HEAD/locks/recipe xác minh; bản sao không có/shared pnpm node_modules.
2. Actual npm ci và configured build có UTC/exits/log/hash, dependency graph, lock/source không drift.
3. Local config đúng target/mode/key được GET read-only kiểm, binding compiled xác minh; giữ rõ cloud secret equality UNKNOWN.
4. Typecheck/unit/tooling và UI selftest→audit→đọc report→xem ảnh cho graph mới; không nhận lại PIN19/PERM60 của graph pnpm.
5. Shared source và node_modules nguyên vẹn; toàn gói recoverable, safe evidence, SEC/EVC review độc lập cùng hash.

Artifact: `D:/Workspace/pos-cafe/artifacts/permission-npm-recipe-20261013`. Bản sao chính: `/var/tmp/pos-cafe-npm-recipe-20261013-03/source`. Giữ lần chuẩn bị01/02 lỗi hạ tầng; không dùng làm PASS. Bản03 `npm ci` exit0 lúc09:55:39–09:55:48Z, 353 package; `npm run build` exit0, source/lock unchanged. Unit1173, trọng điểm tooling110, hai typecheck, UI selftest23 và audit48 tổ hợp/0 mới đạt. Bộ tooling mở rộng **305/306, FAIL** tại test inventory kỳ vọng Realtime cũ. npm audit **12 findings (10 high/2 moderate)** trong dependency dev/build theo lock, chưa sửa hay được owner chấp nhận. Không coi đây là all-gates PASS.

Local release-input candidate dùng exact tuple public từ frontend hiện hành, trích trước đó và kiểm hash, fresh GET Auth settings200, compiled composition match. Đây là lựa chọn local của AI trong mục1, không là owner cho đổi Secret settings và không chứng minh next-cloud env. Dist private đã lưu archive/hash; chưa upload eligible.

Shared source812 drift0, shared node_modules39.329 entries hash trước/sau giống nhau; main/docs HEAD giữ nguyên. 11 direct dependency khác pnpm, gồm Supabase SDK: PIN19/PERM60 cũ chỉ lịch sử và full integration trên npm graph **NOT_RUN**. Không sửa source31 để che test inventory, không đổi lock để né audit.

Việc còn mở trước phát hành: xử lý test inventory bám contract signals hiện hành và audit dependency theo một candidate mới có gate phù hợp, quyết định pipeline/config phát hành và xác minh cloud runtime/env thật; không chuyển bước2 tự động. Walkthrough có trong biên bản; owner chưa xác nhận đọc/hiểu hoặc nghiệm thu.

STOP trước mục2. Backup lịch sử vẫn74/75, cleanupEligible=false. Review chờ lúc freeze; metadata verdict sẽ bổ sung riêng sau. Owner acceptance/release chưa có.

**Metadata review cuối13/10/2026:** SEC rồi EVC cùng APPROVE candidate01 SHA `e0cce54023a6e8e4e43491e381bcf00ee79a0d693b6dc5bc8201f30cba160fcd` cho hồ sơ LOCAL REPRODUCTION/PARTIAL READINESS. [Verdict](../../reviews/2026-10-13-permission-npm-recipe.md). Những dòng chờ review phía trên là trạng thái khi freeze; core snapshot không thay đổi. Hoàn tất bàn giao kết quả tái hiện local; không all-gates PASS, không release, STOP giữ nguyên.
