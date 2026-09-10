# Bằng chứng nghiệm thu phase 27

Ngày 2026-09-10. Code: main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9. Docs phê duyệt trước code: 0ecf84deef9477b6c13716cc3aa972973a0c8e0b.

Fingerprint bytes nguồn đã test: `f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915`. Git commit và push không đổi fingerprint; verifier đã chạy lại sau commit. Hash dùng bytes worktree, đường dẫn và dấu phân cách, loại artifact/build/pnpm-lock.yaml có sẵn. Checkout Git khác cấu hình LF/CRLF có thể có fingerprint bytes khác; cần chạy lại gate khi tái lập, không tự sửa metadata.

## Kết quả tổng

| Stage | Thực chạy | Kết quả |
| --- | ---: | --- |
| unit | 548 | PASS, không fail/skip |
| contracts | 415 | PASS, không fail/skip |
| tools | 37 | PASS, không fail/skip |
| e2e | 34 | PASS, không fail/skip |

Tổng 1034; 669 execution bắt buộc từ 93 TC gốc, 33 requirement và 12 UC. Test bổ sung không được dùng để thay execution bị thiếu. E2E không retry/flaky. Discovery không thiếu/trùng/sai backend.

Bổ sung: build TypeScript/Vite PASS; coverage nghiệp vụ dòng 92,53% (744/804), câu lệnh 88,85% (909/1023), nhánh 83,14% (651/783), hàm 95,07% (251/264). Mock smoke 35 pass, 31 tổ hợp viewport bị loại theo thiết kế của suite nền, 0 fail/flaky. Các skip viewport ấy không thuộc manifest chống trùng. Build còn cảnh báo chunk >500 KB.

Backend DB/E2E: PostgreSQL 16.15 + PostgREST 16.2 + GoTrue thật v2.197.0 trên loopback, hai Store JWT và employee token. Không gọi cloud, không có Storage API/Realtime service. Unit/mock và native SQL reviewer không được gộp thành bằng chứng gateway/Auth thật. [Tái dựng runtime](../phase-27-test-runtime.md).

## Gate máy đọc được

```json
{
  "candidateFingerprint": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
  "generatedAt": "2026-09-10T05:05:11.557Z",
  "valid": true,
  "missing": [],
  "duplicated": [],
  "wrongBackend": [],
  "notPassed": [],
  "errors": [],
  "requiredCount": 669
}
```

## Provenance bốn stage

Mỗi metadata dưới đây đi cùng report gốc ở artifacts trên máy kiểm thử; chỉ sao chép các trường trạng thái/hash, không credential. Báo cáo này chứa bảng execution đã đối chiếu nguyên vẹn bên dưới.

```json
[
  {
    "stage": "unit",
    "startedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "finishedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "exitCode": 0,
    "signal": null,
    "reportSha256": "771347d979e8004f84552b58066cd5cdaa18279c546be7ed55d6f62ecc6e8d5f",
    "optionsSha256": "e673577945d0220a665c50a6a3bb83fa246f304fbc79c141a08684c4522827e8",
    "finishedAt": "2026-09-10T04:59:50.087Z"
  },
  {
    "stage": "contracts",
    "startedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "finishedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "exitCode": 0,
    "signal": null,
    "reportSha256": "9c8e6e78f88d06e8979d2c8472fd10afc0b309de89eee3e5ea1dfc39ac4906f1",
    "optionsSha256": "6fee5e59e0d5be6679daef75e4a1b0cb495c90c5db9663f8088586528d67e00f",
    "finishedAt": "2026-09-10T05:01:18.910Z"
  },
  {
    "stage": "tools",
    "startedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "finishedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "exitCode": 0,
    "signal": null,
    "reportSha256": "e5656ea9625422da33061ccf82a1761fd7db5795963331a09f1509f700c30aba",
    "optionsSha256": "c7ece741b6798656468a7af4ab088e5fb1262f47f68979eb44d7f83feb0d77dc",
    "finishedAt": "2026-09-10T05:01:41.225Z"
  },
  {
    "stage": "e2e",
    "startedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "finishedCandidate": "f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915",
    "exitCode": 0,
    "signal": null,
    "reportSha256": "8659fb7c0cef2f4fc3b6ad642e009b8b4ffafcaad40a78fabc21ede12e924189",
    "optionsSha256": null,
    "finishedAt": "2026-09-10T05:04:02.938Z"
  }
]
```

## Ba review độc lập

- [Reviewer 1 nghiệp vụ/giá/receipt/UI](reviewer-1-business.md): 3 lỗi tái hiện rồi sửa; 298 test hiện có +8 oracle riêng đạt; SQL thật dùng Auth shim được báo riêng.
- [Reviewer 2 quyền/race/rollback/TTL](reviewer-2-security.md): 23 oracle SQL +9 barrier, 192 kiểm tra bổ sung, 21 adapter test đạt; giới hạn shim/network fake ghi rõ.
- [Reviewer 3 harness/oracle/gate](reviewer-3-harness.md): actual discovery,37 tooling qua hai lượt,6 mutant bị bắt; finding only sửa và tái hiện độc lập Vitest/Playwright.

Không còn finding mở trong scope. Root đối chiếu lại hash nguồn các reviewer với code trước khi phát hành; các thay đổi docs sau review là cập nhật trạng thái và đường dẫn test, không thay expected nghiệp vụ.

## Execution bắt buộc — expected và actual

Expected mỗi dòng là PASS theo đúng oracle của TC gốc trong [testplan](../../../openspec/changes/add-idempotent-write-operations/testplan.md); suffix xác định backend/nhánh/biên cụ thể trong manifest. Bảng được xuất từ JSON runner, không từ danh sách tên test trong source.

| Execution | File đã chạy | Expected | Actual |
| --- | --- | --- | --- |
| `TC-IDEM-001/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-001/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-002/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-003/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-004/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/boundary=equal` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/boundary=minus_1ms` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/boundary=plus_1ms` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/race=reset_first` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/race=start_first` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-005/db/reset_pin` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=create/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=pay/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=split/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=update/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_open/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=cancel/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=cancel/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=cancel/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=execute/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=execute/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=execute/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=get/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=get/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=get/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=list/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=list/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=list/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=register/actor=A` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=register/actor=B` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/endpoint=register/actor=C` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/override=deny_both` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-006/db/action=void_paid/override=grant` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-007/db` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-008/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-009/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-010/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-011/db` | `tests/contracts/writeBootstrap.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-011/e2e` | `tests/supabase/idempotencyBootstrap.spec.ts` | PASS | PASSED |
| `TC-IDEM-012/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-012/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-013/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-013/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-014/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-014/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-015/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-015/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-016/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-016/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-017/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-017/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-018/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-019/db` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-020/db/winner=P1` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-020/db/winner=P2` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-021/db/winner=K1` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-021/db/winner=K2` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-022/db` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=pay_split/winner=left` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=pay_split/winner=right` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_pay/winner=left` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_pay/winner=right` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_split/winner=left` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_split/winner=right` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_voidOpen/winner=left` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=update_voidOpen/winner=right` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=voidPaid_voidPaid/winner=left` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-023/db/pair=voidPaid_voidPaid/winner=right` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-024/db/winner=create` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-024/db/winner=split` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-025/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-025/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-025/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-026/core` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-026/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-026/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-027/core` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-027/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-027/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-028/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-028/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-029/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-030/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-030/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-030/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-031/core` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-031/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=duplicate` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=moved` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=omitted` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=other_order` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=other_store` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=over_quantity` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-032/db/source=removed` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-033/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-033/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-034/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-034/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-035/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-035/e2e` | `tests/supabase/idempotencyPricing.spec.ts` | PASS | PASSED |
| `TC-IDEM-036/db` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-037/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-037/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-038/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-038/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-038/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-039/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-039/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-040/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-040/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-041/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-042/core` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-042/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-043/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-044/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-045/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-046/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-046/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-046/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=pay/version=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=pay/version=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=pay/version=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=split/version=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=split/version=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=split/version=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=update/version=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=update/version=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=update/version=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=void/version=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=void/version=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-047/db/kind=void/version=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-048/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-049/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-049/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-050/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-050/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-051/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-052/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-052/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-053/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-054/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-055/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-055/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-056/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-056/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-057/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-057/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-058/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-058/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-059/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-059/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-060/db/winner=cancel` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-060/db/winner=execute` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-061/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-062/core/boundary=equal` | `src/features/pos/writeClock.test.ts` | PASS | PASSED |
| `TC-IDEM-062/core/boundary=minus_1ms` | `src/features/pos/writeClock.test.ts` | PASS | PASSED |
| `TC-IDEM-062/core/boundary=plus_1ms` | `src/features/pos/writeClock.test.ts` | PASS | PASSED |
| `TC-IDEM-062/core/validation_k_expiry` | `src/features/pos/writeClock.test.ts` | PASS | PASSED |
| `TC-IDEM-062/core/validation_session_expiry` | `src/features/pos/writeClock.test.ts` | PASS | PASSED |
| `TC-IDEM-062/db/boundary=equal` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-062/db/boundary=minus_1ms` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-062/db/boundary=plus_1ms` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-062/db/validation_k_expiry` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-062/db/validation_session_expiry` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-063/db/blocker=operation` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-063/db/blocker=order` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-063/db/blocker=store` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-063/db/blocker=table` | `tests/contracts/writeConcurrency.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-064/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-065/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-066/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-066/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-067/db` | `tests/contracts/writeOperations.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-068/db/terminal=applied` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-068/db/terminal=cancelled` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-068/db/terminal=expired` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-068/db/terminal=rejected` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-068/e2e/terminal=applied` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-068/e2e/terminal=cancelled` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-068/e2e/terminal=expired` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-068/e2e/terminal=rejected` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=pay_order` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=pay_payment` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=pay_table` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=split_copy_option` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=split_move` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=split_number` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=split_payment` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=submit_option` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=submit_removed` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-069/db/point=void_order` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-070/db/kind=pay` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-070/db/kind=split` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-071/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-072/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-072/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-073/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-073/mock` | `src/adapters/mock/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=action/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.kind/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.kind/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.kind/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.kind/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.schemaVersion/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.schemaVersion/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.schemaVersion/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common.schemaVersion/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=common/variant=unknown_field` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.expectedVersion/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.expectedVersion/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.expectedVersion/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.expectedVersion/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.newLines/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.newLines/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.newLines/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.newLines/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.orderType/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.orderType/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.orderType/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.orderType/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.tableId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.tableId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.tableId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=create.tableId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=execute.operationId/variant=missing` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=execute.operationId/variant=null` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=execute.operationId/variant=positive` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=execute.operationId/variant=wrong_type` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=kind/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=method/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.id/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.id/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.id/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.id/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.menuItemId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.menuItemId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.menuItemId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.menuItemId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.options/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.options/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.options/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.options/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quantity/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quantity/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quantity/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quantity/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quotedBasePrice/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quotedBasePrice/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quotedBasePrice/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine.quotedBasePrice/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=newLine/variant=unknown_field` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.id/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.id/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.id/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.id/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.optionValueId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.optionValueId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.optionValueId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.optionValueId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quantity/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quantity/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quantity/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quantity/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quotedPriceDelta/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quotedPriceDelta/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quotedPriceDelta/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option.quotedPriceDelta/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=option/variant=unknown_field` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=orderType/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.expectedVersion/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.expectedVersion/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.expectedVersion/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.expectedVersion/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.method/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.method/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.method/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.method/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.orderId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.orderId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.orderId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.orderId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.paymentId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.paymentId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.paymentId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.paymentId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.receivedAmount/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.receivedAmount/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.receivedAmount/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=pay.receivedAmount/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=reason/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=register.operationId/variant=missing` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=register.operationId/variant=null` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=register.operationId/variant=positive` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=register.operationId/variant=wrong_type` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.quantity/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.quantity/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.quantity/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.quantity/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.sourceItemId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.sourceItemId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.sourceItemId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained.sourceItemId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=retained/variant=unknown_field` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=schemaVersion/variant=invalid_literal` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.lines/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.lines/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.lines/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.lines/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.newOrderId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.newOrderId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.newOrderId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.newOrderId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.orderItemId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.orderItemId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.orderItemId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.orderItemId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.quantity/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.quantity/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.quantity/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.quantity/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.splitItemId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.splitItemId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.splitItemId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=split.splitItemId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.action/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.action/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.action/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.action/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.orderId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.orderId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.orderId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=submit.orderId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=takeaway.tableId/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=takeaway.tableId/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=takeaway.tableId/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=takeaway.tableId/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.expectedVersion/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.expectedVersion/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.expectedVersion/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.expectedVersion/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.newLines/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.newLines/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.newLines/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.newLines/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.retainedLines/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.retainedLines/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.retainedLines/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=update.retainedLines/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.expectedVersion/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.expectedVersion/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.expectedVersion/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.expectedVersion/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.reason/variant=missing` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.reason/variant=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.reason/variant=positive` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/core/field=void.reason/variant=wrong_type` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=action/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.kind/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.kind/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.kind/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.kind/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.schemaVersion/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.schemaVersion/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.schemaVersion/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common.schemaVersion/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=common/variant=unknown_field` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.expectedVersion/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.expectedVersion/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.expectedVersion/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.expectedVersion/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.newLines/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.newLines/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.newLines/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.newLines/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.orderType/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.orderType/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.orderType/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.orderType/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.tableId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.tableId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.tableId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=create.tableId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=execute.operationId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=execute.operationId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=execute.operationId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=execute.operationId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=kind/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=method/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.id/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.id/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.id/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.id/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.menuItemId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.menuItemId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.menuItemId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.menuItemId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.options/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.options/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.options/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.options/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quantity/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quantity/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quantity/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quantity/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quotedBasePrice/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quotedBasePrice/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quotedBasePrice/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine.quotedBasePrice/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=newLine/variant=unknown_field` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.id/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.id/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.id/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.id/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.optionValueId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.optionValueId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.optionValueId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.optionValueId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quantity/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quantity/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quantity/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quantity/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quotedPriceDelta/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quotedPriceDelta/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quotedPriceDelta/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option.quotedPriceDelta/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=option/variant=unknown_field` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=orderType/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.expectedVersion/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.expectedVersion/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.expectedVersion/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.expectedVersion/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.method/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.method/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.method/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.method/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.orderId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.orderId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.orderId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.orderId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.paymentId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.paymentId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.paymentId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.paymentId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.receivedAmount/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.receivedAmount/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.receivedAmount/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=pay.receivedAmount/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=reason/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=register.operationId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=register.operationId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=register.operationId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=register.operationId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.quantity/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.quantity/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.quantity/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.quantity/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.sourceItemId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.sourceItemId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.sourceItemId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained.sourceItemId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=retained/variant=unknown_field` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=schemaVersion/variant=invalid_literal` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.lines/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.lines/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.lines/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.lines/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.newOrderId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.newOrderId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.newOrderId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.newOrderId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.orderItemId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.orderItemId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.orderItemId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.orderItemId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.quantity/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.quantity/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.quantity/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.quantity/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.splitItemId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.splitItemId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.splitItemId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=split.splitItemId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.action/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.action/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.action/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.action/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.orderId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.orderId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.orderId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=submit.orderId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=takeaway.tableId/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=takeaway.tableId/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=takeaway.tableId/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=takeaway.tableId/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.expectedVersion/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.expectedVersion/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.expectedVersion/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.expectedVersion/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.newLines/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.newLines/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.newLines/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.newLines/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.retainedLines/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.retainedLines/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.retainedLines/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=update.retainedLines/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.expectedVersion/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.expectedVersion/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.expectedVersion/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.expectedVersion/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.reason/variant=missing` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.reason/variant=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.reason/variant=positive` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-074/db/field=void.reason/variant=wrong_type` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-075/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-076/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-076/db` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-077/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-077/db` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=create_lines/count=0` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=create_lines/count=1` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=create_lines/count=max` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=create_lines/count=max_plus_1` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=options/count=0` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=options/count=1` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=options/count=max` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/array=options/count=max_plus_1` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/bytes=262144` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/core/bytes=262145` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=create_lines/count=0` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=create_lines/count=1` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=create_lines/count=max` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=create_lines/count=max_plus_1` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=options/count=0` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=options/count=1` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=options/count=max` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/array=options/count=max_plus_1` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/bytes=262144` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-078/db/bytes=262145` | `tests/contracts/writeCatalog.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=500_ascii` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=500_emoji` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=501_ascii` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=501_emoji` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=absent` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=empty` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/note=null` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/reason_other=absent` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/reason_other=empty` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/reason_other=nonblank` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/reason_other=null` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-079/core/reason_other=spaces` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=500_ascii` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=500_emoji` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=501_ascii` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=501_emoji` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=absent` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=empty` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/note=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/reason_other=absent` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/reason_other=empty` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/reason_other=nonblank` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/reason_other=null` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-079/db/reason_other=spaces` | `tests/contracts/writeSchema.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-080/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-081/core` | `src/core/writePayload.test.ts` | PASS | PASSED |
| `TC-IDEM-081/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-082/db` | `tests/contracts/writeBootstrap.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-083/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-083/e2e` | `tests/supabase/idempotencyRecovery.spec.ts` | PASS | PASSED |
| `TC-IDEM-084/core` | `src/adapters/supabase/writeOperationRepo.test.ts` | PASS | PASSED |
| `TC-IDEM-084/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-085/db` | `tests/contracts/writeFaults.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-086/tool` | `tests/contracts/gates.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-087/tool` | `tests/contracts/gates.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/always_pending` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/always_reject` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/drop_option_qty` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/duplicate_payment` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/replay_current` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-088/tool/reprice_old` | `tests/contracts/mutations.tool.test.ts` | PASS | PASSED |
| `TC-IDEM-089/core` | `src/app/writeRecovery.test.tsx` | PASS | PASSED |
| `TC-IDEM-089/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-090/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-090/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-091/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-092/core` | `src/features/pos/writeOperationFlow.test.ts` | PASS | PASSED |
| `TC-IDEM-092/db` | `tests/contracts/writeRecovery.contract.test.ts` | PASS | PASSED |
| `TC-IDEM-092/e2e` | `tests/supabase/idempotency.spec.ts` | PASS | PASSED |
| `TC-IDEM-093/db` | `tests/contracts/writePermissions.contract.test.ts` | PASS | PASSED |
