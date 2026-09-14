# Review bảo mật độc lập bản sửa F1

Ngày: 2026-09-10. Reviewer: subagent `cache_security_review`. Base code: `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`; bản sửa chưa commit.

## Kết luận

Không còn finding F1 chưa xử lý trong phạm vi đã kiểm của snapshot cuối. Kết luận này chỉ dành cho cô lập dữ liệu Tra cứu thao tác theo cửa hàng/nhân viên/phiên và phản hồi reprint đi qua các ranh giới đó; không phải kết luận nghiệm thu toàn phase27 hoặc F2–F5.

Đã đọc AGENTS.md, CLAUDE.md, SPEC-STANDARD.md tại worktree docs, spec quyền/session, diff app và các regression/gate được thêm. Không dùng số test hoặc kết luận của parent làm oracle.

## Finding đã phát hiện trong vòng review, đã được sửa

**P1 — callback reprint nằm ngoài Query vẫn đưa receipt của A sang phiên C.** Ở snapshot ban đầu `WriteRecoveryDrawer.tsx` SHA256 `AB539D41BF4CE0D338DAC8DD70710CCEC68E4205BA083335BDC4751FE4EC6298`, reprint chỉ kiểm `drawer === writeRecovery` sau khi nhận receipt (dòng 87–89). A mở K1 đã paid150k rồi yêu cầu in lại; giữ response getReceipt đã được A xác thực. Khóa A, đăng nhập C không quyền và mở lại Tra cứu; C gọi get(K1) thực sự bị mock adapter trả FORBIDDEN. Thả response của A: actual `receiptPreview` chứa snapshot150k, expected null. Đây là dữ liệu đi qua phiên, dù cache list/detail mới đã được cô lập đúng. Một oracle khác giữ response rồi để cùng phiên nhận FORBIDDEN cũng tái hiện preview trái expected.

Parent đã sửa sau khi nhận bằng chứng. Snapshot cuối `WriteRecoveryDrawer.tsx:89–104` kiểm vòng đời màn hình và thế hệ truy cập sau từng await, bỏ cả error muộn. Hai oracle thất bại ban đầu giữ nguyên assertion và đạt sau sửa. Bằng chứng trước sửa: `before-reprint-guard-results.json` và `before-reprint-guard.log`.

## Oracle độc lập đã chạy

Lệnh: `node node_modules/vitest/vitest.mjs run --config artifacts/cache-fix-security-review/vitest.config.ts` tại `D:/Workspace/pos-cafe`.

Node24.16.0; Vitest4.1.11; jsdom; mock adapter thật của repo cho phiên, quyền, ledger và receipt, chỉ giữ/giải phóng Promise ở ranh giới đọc để điều khiển race. Không gọi DB, không reset fixture ngoài bộ nhớ.

Kết quả cuối **7/7 pass**, không skip/retry/expected-failure, exit0; xem `results.json` và `final-oracles.log`:

1. Receipt được xác thực dưới A không mở preview sau C đăng nhập.
2. Receipt muộn không mở preview sau phiên hiện tại nhận FORBIDDEN.
3. List response muộn của A không tái đưa dữ liệu vào cache/DOM của C.
4. Receipt muộn bị bỏ sau cùng nhân viên đăng nhập lại.
5. Receipt muộn bị bỏ khi đổi scope cửa hàng.
6. Deny rồi chủ động Tải lại trước response cũ không khôi phục receipt cũ.
7. Error receipt muộn của A không tạo toast ở phiên C.

Lần chạy ban đầu do config merge cộng include đã chạy thêm toàn bộ src unit: tổng561 test,559 pass/2 fail; hai fail chính là oracle1/2 ở trên, không phải lỗi setup. Config sau đó được sửa chỉ include artifact oracle. Log cuối còn một React act warning trong oracle list muộn; không đổi assertion thành skip, không retry để che warning. Tất cả assertion cuối đều được thực thi.

## Snapshot cuối đã kiểm

| File | SHA256 |
| --- | --- |
| src/app/useAppStore.ts | DCCD4E1C0E4D11E4EDC0C47BF8642FEBF825B298CFF364C43E58A87C79ACA1EF |
| src/app/WriteLifecycle.tsx | AF2976DDAA9D22F76AA30C00D17F4A88C37C7B12101F833FDBA3E7877C997D04 |
| src/app/drawers/pos/WriteRecoveryDrawer.tsx | A8F612189297EE2C1D9CE7A2BF3C9C852EC75F5273FAD79EBCD70BDCF7F0A89F |
| Oracle session-oracles.test.tsx | 89EF62CA9184372734AFD145631377D0466364F1A6EF40B06B068031FD49C407 |

Mã hiện tại cô lập Query theo storeId/employeeId/sessionVersion (`WriteRecoveryDrawer.tsx:20–33`), bỏ dữ liệu ngay khi endpoint từ chối quyền/phiên (`:36–54`,`:70–76`), và remove/cancel query khi phiên đổi (`WriteLifecycle.tsx:15–17`). Cơ chế không phụ thuộc employeeId khác nhau: đăng nhập lại cùng người vẫn tăng sessionVersion.

Chỉ viết artifact trong thư mục review này. Không sửa app, tracked tests, docs, DB hoặc migration; không commit/push/deploy. `pnpm-lock.yaml` SHA256 vẫn `86D9C74541D33C1880970534486202DD0307C9A92BAF8E6D9CF1D02A246F6996`.

Giới hạn: reviewer này không chạy browser/REST/Auth/DB thật; kết luận oracle mô tả component với adapter bộ nhớ, không dùng để thay bằng chứng backend. Các lỗi khác ngoài F1 chưa được nghiệm thu ở đây.
