# Bằng chứng cuối bản sửa F1

Ngày 2026-09-10T10:40:53.625Z. Base main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9; working tree chưa commit. Fingerprint trước/sau cả bốn stage: `7e006793780d39218b28712db96bbbe62e4d9e4901ac1bb1cc504a1fec9deeca`. Node v24.16.0; backend postgres-postgrest-gotrue, DB `pos_cafe_idem_test_auth_7d0433b504c4`, API loopback http://127.0.0.1:55444.

## Gate tự chạy lại

| Stage | Pass |
| --- | ---: |
| unit | 560 |
| contracts | 415 |
| tools | 37 |
| e2e | 37 |

Tổng 1049 pass; 684/684 required, discovery: 93 TC gốc, 0 missing, verifier valid. Không required skip/retry/expected-failure/flaky. Build PASS (còn cảnh báo chunk lớn). Không chạy lại coverage/mock smoke trong bản sửa này; không dùng số cũ để báo lại chúng là pass mới.

Lệnh: npm run test:idempotency:unit; npm run test:idempotency:discover; npm run test:contracts; npm run test:idempotency:tools; npm run test:idempotency:e2e; npm run test:idempotency:verify-results; npm run build. Các suite DB chạy tuần tự sau preflight và marker.

## 15 hồi quy F1 nằm trong manifest bắt buộc

| Execution | Backend | Actual |
| --- | --- | --- |
| TC-IDEM-006/core/cache=different_employee | core | passed |
| TC-IDEM-006/core/cache=same_employee | core | passed |
| TC-IDEM-006/core/cache=store_change | core | passed |
| TC-IDEM-006/core/cache=late_response | core | passed |
| TC-IDEM-006/core/cache=late_reprint/transition=employee_change | core | passed |
| TC-IDEM-006/core/cache=late_reprint/transition=permission_denied | core | passed |
| TC-IDEM-006/core/cache=list_denied/error=FORBIDDEN | core | passed |
| TC-IDEM-006/core/cache=list_denied/error=AUTH_REQUIRED | core | passed |
| TC-IDEM-006/core/cache=list_denied/error=EMPLOYEE_SESSION_REQUIRED | core | passed |
| TC-IDEM-006/core/cache=detail_denied/error=FORBIDDEN | core | passed |
| TC-IDEM-006/core/cache=detail_denied/error=AUTH_REQUIRED | core | passed |
| TC-IDEM-006/core/cache=detail_denied/error=EMPLOYEE_SESSION_REQUIRED | core | passed |
| TC-IDEM-006/e2e/cache=switch_employee | e2e | passed |
| TC-IDEM-006/e2e/cache=revoked_permission | e2e | passed |
| TC-IDEM-006/e2e/cache=late_response | e2e | passed |

## Snapshot production đã được hai reviewer kiểm

| File | SHA256 |
| --- | --- |
| src/app/useAppStore.ts | dccd4e1c0e4d11e4edc0c47bf8642febf825b298cff364c43e58a87c79aca1ef |
| src/app/WriteLifecycle.tsx | af2976ddaa9d22f76aa30c00d17f4a88c37c7b12101f833fdba3e7877c997d04 |
| src/app/drawers/pos/WriteRecoveryDrawer.tsx | a8f612189297ee2c1d9ce7a2bf3c9c852ec75f5273fad79ebcd70bdcf7f0a89f |

## Report và provenance

- unit: kết thúc 2026-09-10T10:34:35.006Z; report SHA256 `30debf82e93822f303aca4031e8e6c1e16b562c69c9291f9a56957aab06c1d11`.
- contracts: kết thúc 2026-09-10T10:36:25.664Z; report SHA256 `8a0378d2588f9808f3739313e647d8d1becea6611fb922f9f9852debe803b606`.
- tools: kết thúc 2026-09-10T10:36:46.990Z; report SHA256 `3a81a2e1fcfbd543df8cd8d057f8235a60fdd480e9b7ad00b48a8a6a36cb3805`.
- e2e: kết thúc 2026-09-10T10:39:21.540Z; report SHA256 `55e8defd1fd9291c2f072212a52a4f4125dfd5b5beedcfe6780f23bd0de13c5f`.

Bản JSON nguyên gốc, metadata/options và summary được giữ tại D:/Workspace/pos-cafe/artifacts/cache-fix-final. Hai báo cáo độc lập được lưu cùng thư mục docs này: [security](reviewer-security.md), [browser/runtime](reviewer-runtime.md). Security: 7 oracle component PASS; runtime: 3 oracle browser PASS và 3 tracked PASS; negativecontrol đưa source ba file về commit lỗi làm 2 assertion thất bại, sau khôi phục, 3 oracle PASS. Không cộng các oracle độc lập vào 1.049 pass gate.

Kết luận chỉ đóng F1. F2 phần print muộn/F3/F4/F5 còn mở; không đủ kết luận rollout toàn phase27. Không deploy/migration thật; pnpm-lock giữ nguyên.
