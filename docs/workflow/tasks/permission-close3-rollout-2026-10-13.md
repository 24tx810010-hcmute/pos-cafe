# CLOSE-3 — quyền và chuẩn bị rollout, không push (13/10/2026)

**PARTIAL/BLOCKED cho phát hành.** Đã xác minh role Owner qua hai Dashboard, binding hiện hành và compile source31 local. Env kế tiếp là Secret write-only; chưa xác minh giá trị. Không gọi CLOSE-3 hoặc task sản phẩm đã đóng. [Bằng chứng](../../implementation-log/permission-close3-rollout-2026-10-13.md), [phương án thao tác](../../runbooks/permission-controlled-rollout-2026-10-13.md), [review](../../reviews/2026-10-13-permission-close3-rollout.md).

## Quyền và quyết định còn hiệu lực

**C3-ROL-D01, 13/10/2026 — KHÔNG PUSH.** Đã đọc trực tiếp user message `01a13477-82a5-7631-a3d3-26b1583a43ce`, turn `01a13477-827b-7953-91d4-72c1695ef906`, chat `01a11fff-6130-7de2-aa08-8b42afd1a543`: “check thử giúp tôi, ưu tiên đóng task và không push”. Brief giao chat này giới hạn hosted read-only và chuẩn bị local; không push cả main/docs, không tạo deployment/promote/publish bằng kênh khác, không đổi provider/project/env/domain/settings. Không reset/stash/switch/stage/commit. Không cleanup/activation/Storage delete, không backup mới. Báo checkpoint trước phần tiếp theo.

Lý do: Git production/main đang tự deploy và auto-assign; Preview còn theo dõi mọi branch chưa gán, nên push docs cũng không được coi là chỉ lưu hồ sơ. Giữ no-push thay vì thay setting để tìm lối publish khác. Quyết định scope79 ở [hồ sơ riêng](permission-close3-scope79-2026-10-13.md) vẫn có hiệu lực, không hỏi lại. Exact77+2, bảo toàn66 Auth ngoài scope và object thứ ba; Storage delete chỉ exact2 lịch sử.

**C3-ROL-D02 — lựa chọn kỹ thuật của AI trong scope chuẩn bị:** kiểm compile bằng cấu hình public trích từ frontend đang phục vụ và lưu prebuilt local riêng. Không suy nó bằng Secret env project; không chọn cấu hình phát hành thay owner. Quyết định tương lai dùng input này làm cấu hình release, hay cung cấp bản gốc private để đối chiếu/ghi lại env, vẫn chưa được chấp nhận. Không yêu cầu gửi secret qua chat.

## Acceptance và kết quả

| Phần | Trạng thái và giới hạn |
| --- | --- |
| Identity/role | PASS đọc UI: cùng account `24tx810010-hcmute`, Owner tại Supabase org và Vercel team; project IDs khớp. Supabase `eyuomtfcfhfpayzuefyt` là **organization slug** theo nhãn UI; immutable API `id` chưa xác minh |
| Capability | DECLARED theo role + control thật; DB profile matcher true trong TLS READ ONLY. Không có chứng cứ write/deploy/reload thực thi |
| Env Production/Preview | PASS metadata ba `VITE_*` cùng hai scope, loại Secret. BLOCKED actual values/equality/key acceptance của env kế tiếp. UI không cho đọc lại; không phải thiếu role Owner |
| Current frontend và candidate compile | PASS GET Auth settings200 với key public hiện hành; compile source31 local exit0, binding hash và bundle SHA được pin. Không là provider build/deploy/postflight |
| Dependency provenance | Supplement hồi cứu pin pnpm11.6.0/lock/installed metadata: local Vite8.2.1 khác npm-lock8.0.16. Không đổi source31; recipe npm-ci Vercel chưa tương đương local |
| Rollout preparation | Gói local và runbook cụ thể; chưa upload eligible, chưa chứng minh hiệu lực skip-domain/promote, chưa có rollback bundle tương thích đã phát hành |
| Review | Nhạy cảm: SEC rồi EVC không phải tác giả, đọc-only, cùng exact candidate. Chờ tại thời điểm khóa snapshot; metadata kết quả bổ sung sau |

## Bàn giao

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. Source31 vẫn812 entries drift0; fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`. Support scripts/artifacts riêng không đổi source31 và không nhận lại thành tích PIN19/PERM60. Chỉ mục và hồ sơ mới là thay đổi docs của slice này.

Gói an toàn `D:/Workspace/pos-cafe/artifacts/permission-close3-rollout-20261013`; raw/profile/config/bundle private `C:/Users/nguye/AppData/Local/pos-cafe-release/close3-rollout-20261013`. Ba tab được tạo đã đóng; không khởi động Docker/WSL/service/Playwright MCP. Không Git mutation hoặc hosted mutation.

**STOP trước bước kế.** Bước tiếp theo cụ thể để đề nghị là **quiescence79 → backup mới → strict restore75/75 và Storage3/3 → fresh inventory/full-row/catalog/proof79 → rehearsal provider/NOSUPERUSER/recovery**. Phải xác định cơ chế/cửa sổ dừng ghi đã được phép trước khi đụng hosted; quyền scope79 không tự cho thay Auth/provider settings. Backup cũ vẫn74/75 và `cleanupEligible=false`, không dùng làm proof cutover. Deployment env, API org ID/CLI auth, hosted Edge/JWT/secret binding, maintenance và release execution vẫn mở. Không thực thi phần tiếp theo trong chat này trước khi báo checkpoint.

Walkthrough đã cung cấp trong log/runbook theo identity → env provenance → bundle → control/order → gate; chưa có owner acceptance hoặc xác nhận owner đã đọc/hiểu.

**Metadata review cuối 13/10/2026:** SEC rồi EVC cùng APPROVE exact candidate03 SHA `d1a6fdeb1d79a87bda8adae0c5a5c7d74af91fd1844b26d2a82a454c6df72a78`; [verdict](../../reviews/2026-10-13-permission-close3-rollout.md). Gate bàn giao hồ sơ đạt, các dòng chờ review là trạng thái lúc freeze. Không thay snapshot/content; release PARTIAL/BLOCKED và STOP giữ nguyên.
