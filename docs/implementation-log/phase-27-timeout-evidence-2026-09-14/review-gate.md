# Independent timeout follow-up and new gate audit — 2026-09-14

## Conclusion

The new gate evidence is **PASS: 637 unit/component + 462 DB contract + 37 tooling + 47 E2E = 1,183 successful executions**, covering **818 required executions from 93 original TC**. Candidate is `493c2af03222deefed6ab679fabd9fba352b79e9938b16ba21e1fd0e2a6f7b84`, based on code HEAD `8ed7418573fe88e27796d3b09807a3c55db4d0d6`. This audit reads every raw assertion/attempt/options record and does not use the repository verifier's PASS as its evidence.

Independent source mapping confirms exactly two source changes relative to the prior audited candidate69ffe: added `tests/supabase/idempotencyTest.ts`, changed `tests/supabase/idempotencyRecovery.spec.ts`. Application files, migrations and `pnpm-lock.yaml` are byte-identical. The implemented harness now awaits ACK loss before the clock jump and uses fixture-owned fresh-context cleanup. Controlled evidence validates both changes.

The historical uninstrumented 45-second timeout's original trigger is still **not conclusively identified**. The new evidence establishes a real harness race and its removal, error-masking prevention, and successful current runs. It must not be described as reconstructing every event in that historical failure. No new application defect was proved by this investigation; deployment identity is outside this reviewer's scope.

## Accepted gate

Command:

```text
node artifacts/timeout-followup/reviewer-gate/audit.mjs artifacts/timeout-followup/gate 493c2af03222deefed6ab679fabd9fba352b79e9938b16ba21e1fd0e2a6f7b84 818
```

Root ran the following commands sequentially on Node24.16.0; all seven completed with exit0 and unchanged start/end candidate hashes:

| Command | Independently read outcome |
| --- | --- |
| npm run test:idempotency:discover | 1,183 discovered; exact required mapping 818/93 |
| npm run test:idempotency:unit | 637 passed; 637 valid options records |
| npm run test:contracts | 462 passed; 462 valid options records |
| npm run test:idempotency:tools | 37 passed; 37 valid options records |
| npm run test:idempotency:e2e | 47 passed, one attempt each; default45 seconds, existing TC011 exception120 seconds, all unchanged |
| npm run test:idempotency:verify-results | exit0, independently cross-checked above |
| npm run build | exit0 |

The audit verifies every tagged and untagged assertion, durations/timestamps, discovery names/files, required execution uniqueness/backend mapping, stage metadata/report/options hashes, actual command sequence and source hashes. No missing/duplicate required execution, skipped/todo/expected-failure/only/automatic-retry/repeat/global-error entry is accepted. Historical plannedFiles mismatches remain the previously documented 497 expanded planning labels; exact current source/discovery mappings are checked, and these are not 497 missing tests.

Backend: `postgres-postgrest-gotrue`, database `pos_cafe_idem_test_auth_239f6c7c6f18`; PostgreSQL16.15 / PostgREST16.2 / unmodified Linux GoTrue2.197.0 on Ubuntu24.04.4 WSL2. API is loopback55444, DB loopback55439, real Supabase browser mode, reuseExistingServer=false, one worker. New postflight at04:28:03 validates candidate493c2a, isolation binding and all16 migration checksums. Reviewer cross-checks root-produced postflight/runtime/report records; reviewer did not independently connect to DB or reset fixtures. Realtime and Storage API remain omitted.

Raw report SHA256 values:

| Stage | SHA256 |
| --- | --- |
| unit | ca2a014247570ac45bb1e46a772f68f80f305e36f33f30b13b919c82ef81794f |
| contracts | 6d49489ac21ab98d7f6ecaf254648664c96630d0e1d918edd7649e1cdbcee48c |
| tools | 29825612a52a2e9a4439bb3b48cd49071ba2859b5c91cd739c213ebf9aeb68f5 |
| e2e | 8915d150151e94cd4d72ffdb078f693c0796f8ab646a85fe62cd96beaac53f2f |

Details: `audit.json`, `gate-audit.log`, `source-delta.json`. The copied independent auditor and its15 explicit path/provenance/timeout adaptations are recorded in `auditor-adaptation.json`; original final-gate-audit files were not overwritten.

The reviewer initially added an incorrect unconditional45-second assertion; its resulting audit FAIL is preserved in `audit.invalid-timeout-assumption.json`. This was an auditor assumption error, not a new test failure. Source `tests/supabase/idempotencyBootstrap.spec.ts:6` already sets TC011 to120 seconds, and its bytes plus the previous report prove that exception is unchanged. Corrected audit binds the previous report and exact source hash: TC011120 seconds, all other cases45 seconds; TC068's new named phases use15-second limits within its unchanged45-second test budget.

Independent negative control `timeout-sensitivity.json` changes only the copied TC068/rejected reported timeout to120 seconds and recomputes the copied report metadata hash. The auditor still rejects it solely for the exact timeout invariant. This confirms acknowledging the existing TC011 exception does not relax TC068. The controlled FAIL is in `tc068-timeout-negative-audit.json`; accepted gate evidence was not overwritten and no browser/DB test was run for this evidence mutation.

## Controlled ACK ordering oracle

Reviewer inspected `ack-oracle/oracle-fixture.ts`, both copied tests, commands/events/raw reports and source hashes. The wrapper only reads database `private.write_clock()` immediately before and after a controlled750ms delay inside route.abort, then invokes the real abort. It does not change the database clock. Test bodies are byte-equivalent after excluding import rewiring: baseline from committed8ed7418 and fixed from current source.

- Baseline: one deliberate failure, `ACK_CLOCK_CHANGED_BEFORE_ABORT`; observer clock changes from08 September to11 September before abort completes. A secondary context-close error is also recorded.
- Fixed: one pass under the same delay; observer clock remains08 September until abort finishes.

`ack-audit.json` is PASS. These two executions are sensitivity evidence outside the business gate. They establish an actual harness race, not the trigger of the historical uninstrumented45-second timeout.

The reviewer initially found an exact-hash mismatch and retained the FAIL evidence in `ack-audit.hash-discrepancy.json`. Subsequent gate artifact sanitization had replaced one `config.webServer.env.VITE_SUPABASE_ANON_KEY` with `[REDACTED_JWT]` in each diagnostic report. Reviewer independently inverted only that placeholder **in memory** using the isolated test env, reconstructing both exact original report hashes. No credential value was printed or persisted. Original/redacted/reconstructed bindings are recorded in `ack-audit.json` and root's redaction-attestation; reports are explicitly treated as redacted derivatives, not falsely claimed to retain their original bytes. Assertions/status/options are unchanged.

## Fixture ownership and repeat evidence

The reviewer independently ran a blank-document Chromium oracle importing the **actual tracked newRecoveryPage fixture**, SHA256 `b9131bf49b7aaef10c7755b40f6b65a446eafe6236ce8e0dbd85ba32b2c74287`. It verifies that an original body locator failure remains first when cleanup also fails, a cleanup failure still fails an otherwise successful test, and both contexts are closed when one close rejects. Moving the first close back into body finally hides the body error again. No tracked source, appURL or database was used by this oracle.

Raw controlled outcome: **1 passed / 5 deliberately failed**, exit1, no skip/retry/expected-failure annotation. Independent checker PASS. These results are not business-gate test passes. See `ACTUAL-FIXTURE.md`, `actual-fixture-check.json` and its raw report for command/source hashes. Earlier standalone control-flow and fixture-concept oracles remain separate artifacts and are not added to the gate.

`repeat-audit.json` independently reads both real-backend diagnostic series: **40/40 baseline** and **40/40 fixed**, four terminal cases ×10 deliberate repetitions, one attempt each, retries0 and45-second timeout. Both series passed; therefore repetition evidence alone cannot prove an original cause or a before/after correction. The controlled ACK/fixture oracles provide the specific sensitivity. Their current redacted-byte hashes are recorded; no unavailable pre-redaction hash is claimed for these repetition reports.

## Evidence limits and publication binding

The old failure has no recorded step history/trace/video to identify its original blocked operation. The error-context artifact has no page/context identity; asserting it definitely belongs to the original page would overstate the evidence. After timeout, Playwright's uncancelled test promise and afterEach clock restoration can also affect a snapshot. `NOTES.md` details established behavior versus hypotheses.

No coverage or mock smoke run was repeated for these test-only changes. Prior application coverage/smoke evidence remains historical and is not relabeled as a fresh run. The new build did pass. Source-start/end hashes detect persisted changes, not an adversarial change-and-revert; no signed runner attestation is claimed.

Current source mapping has460 files,183 CRLF-to-LF normalizations, projected Git clean-content fingerprint `13ba2512152b27cb7fc80930a966d57cdb0fed87f3bfaf9c68fadb73c4c30821`. `audit.json.fileMapping` contains all Git blob OIDs for later index/commit comparison. `pnpm-lock.yaml` remains SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`; it must stay outside the commit.

No production migration, DB test, reset, deployment, commit or push was executed by this reviewer. Parent owns runtime/tests and publication. The harness changes are supported by independent specific oracles and the fresh full gate; historical uncertainty remains disclosed.
