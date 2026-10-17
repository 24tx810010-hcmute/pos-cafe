# Implementation Log

Review CLOSE-3 bước1: SEC/EVC cùng APPROVE candidate-01 cho tính chính xác hồ sơ PARTIAL/BLOCKED; [biên bản](../reviews/2026-10-13-permission-close3-step1.md). Không mở quyền bước kế tiếp.

Checkpoint13/10: [CLOSE-3 bước1](permission-close3-step1-2026-10-13.md) đã backup bảo toàn và restore cô lập; strict74/75 và2 store ngoài allowlist77 giữ gate PARTIAL/BLOCKED. Chưa cleanup/activation/release.

## Quy trình task và hồ sơ từ 2026-09-16

[Gói quy trình AI](workflow-adoption-2026-09-16.md) ghi thay đổi hướng dẫn và cách kiểm tra tài liệu. Dùng [mẫu nghiệm thu](../workflow/templates.md#nghiem-thu) cho log mới và [bàn giao theo task](../workflow/tasks/README.md) để tiếp tục phiên sau. Không thay kết quả lịch sử của các phase bằng kết quả của task mới.

## Folder Này Chứa Gì

Folder này ghi nhật ký implement theo phase. Mục tiêu là track nhanh nhánh/commit/tính năng/test/gap mà không phải đọc code hoặc lần lại toàn bộ lịch sử Git trước.

## Baseline Hiện Hành

13/10/2026: [CLOSE-2 source-31](permission-close2-source31-2026-10-13.md) có PIN19 và PERM60 strict cùng fingerprint (`60 TC/726 variants/27 stage`), TC47 Storage/RPC fault và browser ảnh lỗi→thanh toán PASS trên target local cô lập. Restore DB/K/Storage là proof lịch sử source25 với giới hạn riêng; [SEC/EVC](../reviews/2026-10-13-permission-close2-source31.md) APPROVE candidate-final-03, CLOSE-2 local readiness hoàn tất. CLOSE-3, hosted release và owner acceptance chưa chạy.

13/10/2026: [TC47 fault fix source-26](permission-close2-source26-tc47-2026-10-13.md) sau EVC `CHANGES_REQUESTED` source25: browser image503→payment1/1, Edge fault thường/conditional503 no-store và mốc59/60/61, unit1.173/build PASS, target stopped. Strict aggregate source26 và hai review cuối chưa có; CLOSE-2 chưa đóng.

13/10/2026: [CLOSE-2 source-25](permission-close2-source25-2026-10-13.md) có restore DB lịch sử74/74, restore K fixture và payload Storage, đo image gateway local, teardown targets; chờ hai review độc lập đúng candidate. [PIN19/PERM60 cùng nguồn](permission-pin19-perm60-source25-2026-10-13.md) đã hai review APPROVE. CLOSE-3/owner acceptance chưa làm.

12/10/2026: [CLOSE-2 checkpoint TC-PIN-01–09](permission-pin-tc01-09-closeout-2026-10-12.md) trên main snapshot source-09: SQL41/41, browser Auth/REST/Storage10/10, unit1.173, build/audit PASS; hai target local đã dừng. [Hai review](../reviews/2026-10-12-permission-pin-tc01-09-closeout.md) APPROVE lát này; giới hạn URL/response cũ ghi trong biên bản. PERM60, toàn CLOSE-2 và release chưa chạy/đóng.

11/10/2026: [TC-PIN-10 input/bootstrap/Store Key](permission-pin-tc10-closeout-2026-10-11.md) có browser Auth/REST9/9, unit61/61, typecheck/build, pre/postflight PASS trên candidate local `bd49595e…`; hai review độc lập APPROVE đúng scope. TC11 và aggregate/release còn mở.

10/10/2026: [TC-PIN-14 ba stage trên cùng candidate local](permission-pin-tc14-closeout-2026-10-10.md) 3/3 PASS trên manifest v3 `138a2e90…`, fixture và binding postflight sạch, hai review độc lập APPROVE đúng scope. [Actor tombstone](permission-tombstone-actor-closeout-2026-10-10.md) đã sửa và kiểm riêng trước đó. Các TC PIN khác, gate19PIN/PERM60 cùng nguồn và release chưa hoàn tất.

09/10/2026: [kiểm G2c/sửa UI trước closeout](permission-ui-closeout-2026-10-09.md), [kế hoạch ba mốc đóng task](../workflow/tasks/permission-closeout-execution-2026-10-09.md). G2c exact candidate đã đối chiếu; UI6/unit1.140/build/smoke35PASS31skip, audit rawFAIL26new đã phân loại; hai reviewer APPROVE candidate-01, scope UI/closeout hoàn tất kỹ thuật. Full PIN/PERM/deploy vẫn mở, không ghép source các slice thành PASS tổng.

G2b 09/10/2026: [forced PIN race hai thiết bị](permission-pin-completion-race-2026-10-09.md) có target local riêng, wait graph chứng minh hai backend đồng thời ở cả A/B và B/A, Chromium Auth/REST 2/2, tooling 12/12, repo+targeted typecheck và preservation G1/G2a PASS trên source-02. Candidate-01 bị yêu cầu sửa cleanup; finding đã đóng, hai reviewer APPROVE candidate-02; toàn TC08/full PIN/release vẫn mở.

G2a 09/10/2026: [lost ACK forced completion](permission-pin-ack-loss-2026-10-09.md) có target local riêng, source-07 auto4/4 + Chromium Auth/REST2/2 với pending K, kiểm sau login và G1 preservation PASS. Hai review candidate-03 APPROVE; G2/full PIN gate/release vẫn mở.

Oracle TC03 09/10/2026: [log kỹ thuật](permission-pin-oracle-2026-10-09.md) ghi source08 auto 70/70, UI mock 1/1, typecheck/preservation PASS; review exact candidate theo link trong log. Full forced-PIN gate còn mở.

- **2026-10-08, forced-PIN inventory:** [matrix19TC/executable/gaps](permission-pin-gate-inventory-2026-10-08.md) thay checkpoint stale bằng source/test paths thực, giữ expected. Current66 chưa PIN-wide evidence; d1/4ab PASS là lịch sử. Ưu tiên oracle TC03 trước rollback, real completion lostACK, canary/empty preservation rồi full source gate. Slice chỉ phân tích/docs, không runtime/auto/UI run mới.

- **2026-10-08, chuẩn bị Realtime:** [inventory/gate và session kế tiếp](permission-realtime-preparation-2026-10-08.md) đối chiếu60REQUIRED/27stages, focused receipts thiếu aggregate attestation, Realtime freshlegacy/probe contract2 và Auth refresh/failure artifact risks. Scope tiếp TC55 thật hai client; lượt chuẩn bị chỉ offline, không runtime/reset/UI hoặc đóng full gate. Review/dispatch theo hồ sơ.

- **2026-10-08, isolated:** [full-stack gates/cleanup diagnostic](permission-isolated-gates-2026-10-08.md) có identity42/images1+1variant/PIN31+44/TC44four/tooling34/UI9 PASS trên source cuối d1; guarded recovery theo user approval giữ6 Storage bytes/metadata, reporter hook diagnostics không lộ secret. Incident FAIL đầu chưa có nguyên nhân cụ thể; fixture cuối candidate activated, full gates/release/UI audit vẫn mở. Review theo hồ sơ.

- **2026-10-08:** [runbook/readiness local](permission-runbook-readiness-2026-10-08.md) sửa mock getter ảnh theo quyền đã duyệt, regression và unit1.140/tooling70/build PASS; mock smoke35PASS/31viewport skip/0FAIL. [UI audit](permission-ui-audit-triage-2026-10-08.md) vẫn FAIL33 nhóm ngoài baseline; có bằng chứng mobile bị che. Runbook nháp và review theo hồ sơ; full services/T15/T16/PIN-T06/T17/T18 và phát hành chưa đạt.

- **2026-10-07, Vercel:** [Production inventory](vercel-binding-inventory-2026-10-07.md) đã đọc Dashboard xác thực: đúng repo/project/domain, main tracking + auto-assign bật, Production ef2c372 Ready; build overrides phù hợp source, ba env Secret có mặt. Values/compiled mode/Supabase binding chưa kiểm; không push/deploy hoặc đóng release gate. Review theo biên bản trong log.

- **2026-10-07, Edge/Storage:** [inventory Dashboard](supabase-edge-storage-inventory-2026-10-07.md) qua phiên đã xác thực: functions list empty; chỉ bucket legacy public,4 policies; staging candidate absent. Đã đọc predicates/broad SELECT warning, không raw API response hoặc mutation; release gaps/T09/Vercel còn pending. Review theo biên bản trong log.

- **2026-10-07, fresh Codex MCP:** [host mới](supabase-fresh-host-2026-10-07.md) app-server connected/bearerToken + SELECT1 PASS,13 guard checks đạt; không model turn, global config không đổi. Desktop đang mở/Edge/Storage/Vercel/release chưa kiểm; review theo biên bản trong log.

- **2026-10-07, Supabase chỉ đọc:** [setup cục bộ](supabase-local-mcp-setup-2026-10-07.md) có token DB-only/24h lưu DPAPI/private ACL, direct MCP SELECT1 PASS; token cũ42Read đã thu hồi theo xác nhận.41 synthetic security +11 parser checks đạt. Fresh CLI/Desktop còn chờ; không bảo đảm privacy/email/phát hành. Review theo biên bản trong log.

- **2026-10-06, Supabase MCP cục bộ:** [xác minh tính khả thi](supabase-local-mcp-feasibility-2026-10-06.md) xác nhận tài liệu scoped PAT/HTTP MCP và schema CLI; sửa các bảo đảm quá mức về env, Remote, sync/email. Chưa tạo token/cài/chỉnh config hoặc thử kết nối thật; không chứng minh riêng tư hay sẵn sàng phát hành. Review theo biên bản trong hồ sơ.

- **2026-10-06, kênh triển khai:** [khảo sát](permission-deployment-channels-2026-10-06.md) đọc metadata GitHub, deployment lịch sử, HTTP công khai và config local. Management Supabase/Edge/Storage/Vercel chờ kênh xác thực đáp ứng ràng buộc email Codex; chưa login/consent/deploy, source không đổi. Review/giới hạn theo biên bản trong hồ sơ; sản phẩm chưa phát hành.

- **2026-10-06, guard provider:** [implementation/rehearsal](permission-provider-capability-guard-2026-10-06.md) theo PGCG-D01 có full-profile fallback, 77 tooling/7 runtime PASS trên source mới và clone pin binary/profile; review theo biên bản. Không native grants live/cleanup/deploy; hosted/channels/full product gate còn pending, proofs controller 01/10 là lịch sử theo source cũ.

- **2026-10-06, khảo sát chỉ đọc:** [quyền và kênh phát hành](permission-release-capabilities-2026-10-06.md) ghi live DB/TLS thành công, guard native không đạt trong khi supautils có capability provider cần kiểm chứng. Chưa đổi code/grant, thử DDL live hoặc phát hành; kênh quản trị và rehearsal provider còn pending. Có hồ sơ kỹ thuật, phương án/trade-off và nguồn cho báo cáo; review theo biên bản liên kết.

- **2026-10-01, chỉ controller:** [handoff cập nhật](permission-release-controller-2026-09-30.md) ghi recovery và runtime thật:34 tooling, 15 fault cases, legacy/cancel/ACK diagnostic PASS trên clone có quyền bổ sung; actor gốc fail-fast, quyền production/release BLOCKED. Giữ lịch sử source-only 30/09 và clone lỗi đã commit; 2 review hiện hành APPROVE local handoff. Không cleanup live, gate tổng, phát hành.

- **2026-09-28:** [Chốt phiên phân quyền](permission-release-stop-2026-09-28.md) theo yêu cầu chủ dự án. Code/UI candidate và bằng chứng được giữ local; chưa qua gate tổng, chưa cleanup live hoặc phát hành. Các phần còn lại sẽ làm riêng khi chủ dự án chọn; đây là trạng thái hiện hành thay các mốc lịch sử bên dưới.

- **2026-09-17, trạng thái sản phẩm:** phân quyền chưa nối UI/chưa phát hành. Chủ dự án đã xác nhận đích triển khai và giữ dữ liệu; [bàn giao hiện hành](../workflow/tasks/redesign-permission-model.md) thay cách gọi các mốc backend local là sản phẩm hoàn tất. Kết quả kỹ thuật dưới đây là lịch sử theo candidate, không phải kiểm chứng bản đang chạy.

- **2026-09-16:** [PERM-T07: projection đọc theo mục đích](permission-t07-read-projections-2026-09-16.md) hoàn tất local; 919 unit/component, 120 SQL/Auth/REST, build và regression T01–T06 cùng source. T08–T18 chưa bắt đầu; UI chưa activate.

- **2026-09-16:** [PERM-T06: quyền financial sau khóa](permission-t06-financial-authority-2026-09-16.md) hoàn tất local; 815 unit/component, 44 SQL/Auth/REST, build và regression T01–T05 cùng source. T07–T18 chưa bắt đầu; UI chưa activate.

- **2026-09-16:** [PERM-T05: quản trị nhân viên/audit](permission-t05-employee-administration-audit-2026-09-16.md) hoàn tất local; 815 unit/component, 55 SQL/Auth/REST, build và regression T01–T04 cùng source. T06–T18 chưa bắt đầu; UI chưa activate.

- **2026-09-16:** [PERM-T04: identity/owner/session](permission-t04-identity-owner-sessions-2026-09-16.md) hoàn tất local;788 unit/component, 42 SQL/Auth/REST, build và regression T01–T03 cùng source. T05–T18 chưa bắt đầu; UI chưa activate.

- **2026-09-15:** [PERM-T03: domain/core/ports/mock](permission-t03-domain-ports-mock-2026-09-15.md) hoàn tất local;761 unit/component, 4 SQL test/1.280 tổ hợp, build và regression T01/T02 cùng source. T04–T18 chưa bắt đầu, UI chưa activate.

- **2026-09-15:** [PERM-T02: catalog/bridge](permission-t02-catalog-bridge-2026-09-15.md) hoàn tất local: 52 test, 6.144 comparison, regression T01 152 tool + 30 DB, 637 unit/component và build cùng source. Đây là checkpoint T02 trước kết quả T03 ở trên; chưa đổi UI hoặc activate mô hình mới.
- **2026-09-15, mốc trước T02:** [PERM-T01: baseline/preflight/oracle](permission-t01-preflight-2026-09-15.md) ghi lần nghiệm thu đầu trên legacy fixture và 6.144 expected; lịch sử này không thay bằng kết quả ở fingerprint T02.

- Current truth bổ sung ngày **2026-09-10** theo `main@3ada48c`; các audit nền cũ có ngày riêng trong phase log.
- Phase log là evidence lịch sử tại checkpoint. Test failure, TODO hoặc giới hạn trong phase cũ có thể đã được phase sau supersede; dùng root docs và [../testing.md](../testing.md) để kết luận trạng thái hiện tại.
- Không đổi chữ “pass/fail” lịch sử thành current truth. Khi cần làm rõ, thêm ghi chú “đã được phase sau supersede”.
- Tên file, symbol, commit, migration và lệnh trong phase log chỉ phục vụ truy vết kỹ thuật. AI viết báo cáo phải chuyển chúng thành mô tả mục tiêu, cách tiếp cận, quyết định và kết quả; không sao chép artefact triển khai vào nội dung chính.

## Khi Nào Nên Đọc

- Khi cần biết phase nào đã xong, phase nào còn gap.
- Khi viết báo cáo tiểu luận và cần timeline implement.
- Khi chuẩn bị làm tiếp một phase mới.
- Khi cần đối chiếu docs với `main`.

## Cách Đọc

1. Đọc [../phase-scope.md](../phase-scope.md) để biết scope.
2. Đọc phase log tương ứng bên dưới.
3. Nếu cần kiểm chứng sâu, mở commit/branch trong Git hoặc đọc archive spec được link.

## Phase 27 — Đã nghiệm thu code ngày 2026-09-10

- [Ghi POS chống trùng và khôi phục](phase-27-idempotent-write-operations.md): thiết kế đã hiện thực, bằng chứng test và các lỗi review đã sửa.
- [Rollout](phase-27-idempotency-rollout.md): DB/app, backup và xử lý lỗi; chưa deploy môi trường thật.

Các phase trước là biên bản theo checkpoint, không viết lại để tạo cảm giác đã có giao thức mới từ trước.

## Phase Logs

- [phase-01-foundation.md](phase-01-foundation.md): nền schema, session, ports/adapters, seed.
- [phase-02-product-tracks.md](phase-02-product-tracks.md): POS/admin product tracks.
- [phase-03-integration.md](phase-03-integration.md): nối UI với logic/adapters, Supabase/realtime.
- [phase-04-demo-hardening.md](phase-04-demo-hardening.md): hardening demo, loading/error/empty/stale states.
- [phase-05-ui-redesign.md](phase-05-ui-redesign.md): Tailwind-first UI rework và shared portal primitives.
- [phase-06-architecture-ui-hardening.md](phase-06-architecture-ui-hardening.md): architecture boundary guard, adapter split và drawer overlay/motion.
- [phase-07-shell-floor-cleanup.md](phase-07-shell-floor-cleanup.md): `LeftNav` extraction/redesign, workspace overlay offsets và floor toolbar cleanup.
- [phase-08-payment-cashier-redesign.md](phase-08-payment-cashier-redesign.md): Payment Drawer redesign cho thu ngân, responsive landscape và tùy chọn in hóa đơn.
- [phase-09-menu-image-upload.md](phase-09-menu-image-upload.md): Menu Editor redesign và upload ảnh món qua Supabase Storage.
- [phase-10-order-history-responsive.md](phase-10-order-history-responsive.md): Order History redesign 2 cột responsive và payment snapshot cho tiền khách đưa/tiền thừa.
- [phase-11-blank-store-optional-seed.md](phase-11-blank-store-optional-seed.md): store trống mặc định, seed dữ liệu mẫu tùy chọn (checkbox lúc tạo + Settings) và dọn dữ liệu giả hardcode.
- [phase-12-report-redesign.md](phase-12-report-redesign.md): Report redesign sang dashboard master/detail (rail trái doanh thu + nav, pane phải chi tiết), look Tremor dựng bằng Tailwind/Recharts.
- [phase-13-receipt-print-popup.md](phase-13-receipt-print-popup.md): giả lập in đơn bằng popup (phiếu tạm tính + hoá đơn, template 80mm dùng chung), in lại từ Lịch sử; UI-only, giữ seam IPrintPort.
- [phase-14-kitchen-ticket-optimistic-print.md](phase-14-kitchen-ticket-optimistic-print.md): "Gửi đơn" in phiếu gửi bếp các món mới thêm (diff theo nội dung), bỏ window.open, in từ dữ liệu local + invalidate fire-and-forget.
- [phase-15-realtime-hardening.md](phase-15-realtime-hardening.md): chốt accuracy-first online-only/refetch-only (ADR), realtime tự lành khi reconnect và polling 5s làm lưới an toàn, không phải SLA cứng.
- [phase-16-shared-modifiers.md](phase-16-shared-modifiers.md): modifier (size/topping) dùng chung nhiều-nhiều + popup chọn ở màn order + số lượng modifier; bảng nối `menu_item_option_groups`, `order_item_options.quantity`, migration wipe + rework.
- [phase-17-floor-editor-transform-handles.md](phase-17-floor-editor-transform-handles.md): Floor Editor thêm handle kéo trực tiếp để resize/xoay object đang chọn (bàn + decor); handle nằm ngang dưới object, không xoay theo object, giữ changeset layout hiện có.
- [phase-18-instant-pay.md](phase-18-instant-pay.md): instant pay — chọn món/số lượng để TÁCH thành đơn mới độc lập và thanh toán ngay (`Chọn tất cả` mặc định = trả cả bàn); bill trả trước mang số nhỏ hơn (đơn tách kế thừa order_no, đơn gốc nhận số mới); RPC `pay_order_items` (migration 010, thay mô hình partial-cùng-đơn của 009).
- [phase-19-void-paid-order.md](phase-19-void-paid-order.md): hủy đơn đã thanh toán từ Lịch sử với quyền `order.voidPaid`, lý do/audit, optimistic lock; đơn void bị loại khỏi doanh thu nhưng giữ payment để đối soát, Report có `voidCount`/`voidAmount` (migration 011).
- [phase-20-employee-permissions.md](phase-20-employee-permissions.md): editor quyền hiệu lực theo từng nhân viên; enforce 5 quyền tạo/sửa/hủy đơn mở, thanh toán và hủy đơn paid ở flow/UI/RPC guardrail (migration 012).
- [phase-21-floor-decor-assets.md](phase-21-floor-decor-assets.md): đưa catalog 9 texture tường + 131 ảnh trang trí vào Floor Editor/POS, có popup chọn/đổi mẫu và fallback cho asset key legacy.
- [phase-22-kitchen-future-scope-doc-sync.md](phase-22-kitchen-future-scope-doc-sync.md): redesign Employees Drawer hai pane, ẩn kitchen khỏi mọi entry point UI và giữ seam schema/code cho tương lai.
- [phase-23-table-background-assets.md](phase-23-table-background-assets.md): thêm 11 nền bàn built-in + nền trắng mặc định, persist bằng `tables.background_asset_key` (migration 013) và render đồng nhất trong Floor Editor/POS.
- [phase-24-report-readiness-sync.md](phase-24-report-readiness-sync.md): audit `main@3d9b64a`, sửa stale/overclaim và chuẩn hóa requirements/testing/limitations/source map cho báo cáo.
- [phase-25-unused-dependency-cleanup.md](phase-25-unused-dependency-cleanup.md): gỡ ba thư viện form/validation không dùng, xác minh lại test/build/smoke và đồng bộ baseline tài liệu.
- [phase-26-history-recent-listing.md](phase-26-history-recent-listing.md): lịch sử đơn mặc định liệt kê gần đây không giới hạn ngày, thay số bill bằng số thứ tự theo bộ lọc, gỡ ô tìm kiếm khỏi UI.

## Template Duy Trì

- [permission-close2-source31-2026-10-13.md](permission-close2-source31-2026-10-13.md): source31 PIN19/PERM60, TC47 origin và browser, lịch sử attempt, bảo toàn và giới hạn local; chờ review CLOSE-2.
- [permission-pin-tc18-closeout-2026-10-11.md](permission-pin-tc18-closeout-2026-10-11.md): canary runtime/audit projection TC18, operator local-only, message contexts, lệnh/receipt và giới hạn full-file timeout.
- [permission-pin-tc18-review-2026-10-11.md](permission-pin-tc18-review-2026-10-11.md): hai review độc lập, finding vòng đầu và xử lý trước xác nhận vòng 2.

Mỗi phase log dùng cùng cấu trúc:

- Mục tiêu phase.
- Branch/commit liên quan.
- Feature đã implement.
- Test/build/smoke đã chạy.
- Quyết định kỹ thuật phát sinh.
- Gap còn lại.
- Link docs/spec liên quan.

## Quy Tắc Duy Trì

- Cập nhật log khi merge/pull một phase lớn vào `main`.
- Không ghi phỏng đoán; nếu chưa kiểm chứng thì ghi là gap/rủi ro.
- Code là source-of-truth cuối cùng; log giúp định hướng và truy vết.

Checkpoint NEW79 ngày13/10: [bằng chứng scope79](permission-close3-scope79-2026-10-13.md) bổ sung đúng2 quán TEST, giữ backup74/75FAIL và Storage allowlist2; chưa phát hành.


**Metadata review NEW79 ngày13/10/2026:** SEC rồi EVC cùng APPROVE exact candidate-01 SHA `d4ac17c0be198bd2725a9afb9e1ab183d83622995c4acfd156b09fbb373823de`; [verdict](D:/Workspace/pos-cafe-docs/docs/reviews/2026-10-13-permission-close3-scope79.md). Gate bàn giao scope79 đạt; các dòng/checklist chờ review là trạng thái lúc khóa snapshot. Chỉ bổ sung metadata review, không đổi candidate; release vẫn BLOCKED và STOP trước quyền/cấu hình deployment.
