> Bản sao báo cáo độc lập, giữ nội dung/kết luận; thay tiền tố đường dẫn máy bằng nhãn worktree để đọc ngoài máy tác giả. SHA-256 file gốc: `a7e099aa4910aae0d9de28c659a8c0c6ae233161269d3d85aec34018cd9d84b8`. Lệnh và artifact được ghi như bằng chứng lịch sử; summary không thay full manifest tại [verification](verification.md).

# Reviewer 3 — kiểm độc lập harness/gate/oracle

Ngày 2026-09-10. Review chỉ đọc source chính, không commit/push/deploy. Báo cáo này và các bản sao chạy test thuộc `D:/Workspace/pos-cafe-review-harness-final`. Không đọc `.env.local`, không gọi remote database. Môi trường: Windows, Node v24.16.0.

## Candidate ban đầu

HEAD main `7183b31a4ca27ed2be3ca7097f391fd2c07f806c`; worktree chưa commit là candidate. Snapshot 449 files, fingerprint trước/sau copy đều `98162096a4ba33b3a280f0e147c3d22a28471c656a7e335c3db6b053af65f259`. Metadata: `snapshot.json`; bản sao source: `snapshot/`. Fingerprint snapshot độc lập bằng source chính. Không sao chép credential/application environment.

Đã đọc AGENTS.md, CLAUDE.md, SPEC-STANDARD.md ở worktree docs, cùng testplan/traceability/tasks của change. Đã đọc reporter, discovery, verifier, manifest/catalog, preflight, harness, actual tool/mutation tests và oracle DB/core/mock liên quan.

## Finding tái hiện — đã sửa và xác minh độc lập

**P2 đã đóng: `.only` từng được attestation coi là ordinary pass.** `scripts/idempotency-vitest-reporter.mjs:6` lấy `test.options.mode`; Vitest 4 chuẩn hóa `test.only` và child của `describe.only` thành `run`. `tests/contracts/resultVerifier.ts:39` vì thế không phát hiện focused test. Repro runner thật trong `repro-options.mjs` cho cả hai trường hợp: exit 0, `checkResults.valid=true`, `checkExecutionOptions.valid=true`. Positive ordinary pass cũng true. Evidence gốc: `options-repros/only/options.json`, `options-repros/suite_only/options.json`, `options-repros/summary.json`. Không thấy source test candidate sử dụng `.only`; đây là lỗi kiểm soát gate, không phải bằng chứng test hiện tại đã bị chọn lọc. Tác giả đã sửa policy ở runner/config; kết quả xác minh final ghi bên dưới.

## Kiểm đã thực hiện trên candidate ban đầu

- `node scripts/idempotency-run.mjs tools --testNamePattern '^(?!.*TC-IDEM-087)'` trong snapshot: **35 passed, 1 intentionally pending, 0 failed**, exit 0. TC087 chưa chạy ở lượt này vì reviewer DB đang sở hữu fixture. Không gọi partial suite là nghiệm thu đầy đủ. Actual TC086 di chuyển file ngoài include và mất suffix fail đúng, positive phục hồi pass. Report: `snapshot/artifacts/idempotency-tools.json` và provenance/options.
- Sáu source mutants thật: `always_pending`, `always_reject`, `duplicate_payment`, `reprice_old`, `drop_option_qty`, `replay_current`. Mỗi unchanged baseline pass đúng một oracle; mỗi mutant exit 1 bởi đúng assertion, không tính compile/missing test là kill. Kết quả **6/6 killed**; backend `memory-adapter`, không suy rộng thành SQL mutation test. `mutation-summary.json` và mỗi `snapshot/artifacts/mutations/*/{baseline,mutant,mutation-result}.json`.
- `node .../repro-options.mjs`: ordinary pass được nhận; `test.fails`, thực sự fail-first/pass-retry, configured retry, repeats, inherited suite retry, skip đều bị từ chối. `.only`/`describe.only` là finding nêu trên. Playwright parser độc lập từ chối actual retry attempts, unexpected pass, expected failure và skip; ordinary single attempt được nhận.
- `node .../repro-preflight.mjs`: **7/7 negative fail-closed**, exit nonzero trước `SUITE_ENTERED`: missing URL/key/observer, mode mock, URL remote, database không có prefix test, loopback database/API unavailable. Không in dummy password/JWT. Script cố tình dùng endpoint loopback không tồn tại và không truy cập shared DB. `preflight-repros/summary.json`.
- Unit list: 548 discovered, 212 required core/mock; tools list: 36 discovered, 8 required. **0 missing/duplicate/wrongBackend** trong hai stage này. `partial-discovery.json`; actual lists ở `snapshot/artifacts/reviewer-list-{unit,tools}.json`. Chưa suy luận DB/E2E discovery từ regex source.
- `node scripts/idempotency-verify-results.mjs` trên bản sao chỉ có partial tools: exit 1, valid false, required 669, missing 661, notPassed 1; từ chối missing unit/contracts/E2E provenance và TC087 pending. `snapshot/artifacts/idempotency-verification.json`.

## Đối chiếu oracle và finding cũ

- TC025/db hiện kiểm literal R1 total100000, hai phần60000/40000; observer raw orders/items/options/events cũng kiểm literal trước replay equality: `tests/contracts/writeOperations.contract.test.ts:63`.
- TC038/db hiện kiểm literal raw payment150000/200000/50000, paid order/version6/subtotal/total, line quantity5×30000, options0, events1, bàn empty trước replay equality: `tests/contracts/writeOperations.contract.test.ts:104`.
- TC092/db hiện có mixed order [zero,20000], zero-only split rejected và full pay20000 positive; raw business unchanged cho rejected rồi payment literal20000, hai lines, paid source. `tests/contracts/writeRecovery.contract.test.ts:102`. Việc chọn cả mixed order dùng pay_order là hợp đồng đúng cho toàn bộ lựa chọn.
- TC093/db hiện thực sự dựng cả applied/rejected/cancelled/expired, phủ unauthorized execute/get/cancel và payload mismatch, raw full snapshot giữ: `tests/contracts/writePermissions.contract.test.ts:72`.
- Harness observer tạo connection mới mỗi call, snapshot mọi financial row của cả hai fixture stores, gồm removed items. Bằng chứng chờ khóa được ghi JSONL với backend PID, blockers, virtual_transaction; backend_xid nullable có giải thích. `tests/contracts/harness.ts:101`, `:110`, `:119`. Races kiểm observed locks, không lấy Promise.all đơn thuần làm chứng cứ.
- Schema byte boundaries tính `octet_length` ở SQL, fixture dựng độc lập; mutation oracles không import helper SUT làm expected. Catalog đối chiếu các TC có mức DB+mock không thiếu required mock backend.

## Final candidate và kiểm lại

Snapshot final được tạo lúc `2026-09-10T04:57:26.563Z`: **`f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915`**, main HEAD vẫn `7183b31a4ca27ed2be3ca7097f391fd2c07f806c`. Hash source trước/sau copy và sau kiểm đều giữ nguyên. `snapshot-final.json`, `snapshot-final/`. So với snapshot đầu chỉ đổi 6 file config/gate/runner, không đổi nghiệp vụ, SQL hoặc mutation oracle: `final-source-delta.json`.

1. `node scripts/idempotency-run.mjs tools --testNamePattern TC-IDEM-087`, cwd `snapshot-final`, `IDEM_ENV_FILE` trỏ private local runtime dưới TEMP do tác giả cung cấp. **1 passed, 36 intentionally filtered, exit0**. Đây là test TC087 thực hiện negative preflight marker/checksum/config và positive Auth/RPC/observer write; không chỉ parse environment. Báo cáo giữ riêng ở `preflight-positive/idempotency-tools.json` cùng metadata/options. Chạy trong cửa sổ DB đã được reviewer DB bàn giao, đã trả DB ngay sau discovery.
2. `node scripts/idempotency-discover.mjs` với cùng local env: **valid true, 93 TC gốc, 669 required, 1034 discovered; 0 missing, 0 duplicate, 0 wrongBackend, 0 runner errors**. Required: core199/mock13/db415/tool8/e2e34. Actual discovered: core496/mock52/db415/tool37/e2e34. Report `snapshot-final/artifacts/idempotency-manifest.json`, các actual runner list cùng thư mục. Discovery là bằng chứng hiện diện, không phải business pass.
3. `node scripts/idempotency-run.mjs tools --testNamePattern '^(?!.*TC-IDEM-087)'`, cwd `snapshot-final`, sau khi trả DB: **36 passed, 1 intentionally filtered, exit0**, gồm actual focused-test negative regression và 6 mutant baseline/kill. `snapshot-final/artifacts/idempotency-tools.json` cùng metadata/options. Hai lượt tools độc lập kiểm đủ37 tests nhưng không ghép/fabricate chúng thành một stage report toàn bộ.
4. `node reviewer-workspace/repro-final-only.mjs`: dùng bản copy **không sửa** của final runner/reporter/preflight/artifact helper trong fixture repo độc lập. Fixture config cố tình `allowOnly:true`; final wrapper thêm `--allowOnly=false`. Ordinary positive pass1, `.only` exit1/fail1, `describe.only` exit1/failing suites và skipped child, bỏ `.only` positive pass1. Thử user CLI `--allowOnly=true` cũng exit1 vì Vitest từ chối duplicate option true/false; không override được policy. **5/5 kiểm đúng expected**. `final-only-repros/summary.json`; individual JSON/provenance/options/log được giữ.
5. `node reviewer-workspace/repro-final-playwright-only.mjs`: final wrapper E2E chạy fixture Playwright độc lập, không browser fixture/DB. Config cố tình `forbidOnly:false`; wrapper áp `--forbid-only`. Ordinary positive1; `test.only` và `test.describe.only` exit1 với lỗi explicit `--forbid-only`; bỏ `.only` positive1. **4/4 kiểm đúng expected**. `final-playwright-only-repros/summary.json`, individual reports/logs.

## Kết luận và giới hạn

**Reviewer3 chấp nhận phạm vi harness/gate/oracle trên final fingerprint f9eaf52a…4915; không còn finding mở trong phạm vi đã kiểm.** Finding `.only` đã được tái hiện trước sửa và xác minh bị từ chối sau sửa. Các finding cũ về duplicate/backend, raw money TC025/038, mixed-zero TC092 và terminal TC093 đã được đối chiếu source/discovery hiện tại.

Reviewer này tự chạy discovery đầy đủ, mọi tooling test qua hai lượt có phối hợp DB, actual negative/positive runner controls và sáu source mutants. Không tự chạy toàn bộ415 DB contracts hay34 browser E2E; không thay báo cáo reviewer nghiệp vụ/DB hoặc final four-stage execution của tác giả. Mutation sensitivity chỉ chứng minh memory adapter; preflight positive và contract discovery chứng minh local Auth/REST/observer môi trường thật, không chứng minh Supabase cloud, Storage hay Realtime. Không sửa source chính, không giảm assertion/expected để pass và không commit/push/deploy.
