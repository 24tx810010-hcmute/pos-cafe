# Independent verification of the actual newRecoveryPage fixture

The oracle imports `test` directly from `tests/supabase/idempotencyTest.ts`. It does not copy the fixture implementation. No tracked source was edited. No database, app URL, HTTP app or production environment was accessed: real Chromium loads only blank documents with `setContent`.

Actual fixture SHA256: `b9131bf49b7aaef10c7755b40f6b65a446eafe6236ce8e0dbd85ba32b2c74287`. Node24.16.0; Playwright1.60.0. Source hashes, modification timestamps, raw report hash and command are recorded in `actual-fixture-check.json`. Source timestamps precede the run, but this is not a cryptographic attestation against change-and-revert.

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'D:/Workspace/pos-cafe/artifacts/timeout-followup/reviewer-gate/actual-fixture-results.json'
node node_modules/@playwright/test/cli.js test --config=artifacts/timeout-followup/reviewer-gate/actual-fixture.config.ts --reporter=json
node artifacts/timeout-followup/reviewer-gate/check-actual-fixture.mjs
```

Raw runner: **1 passed / 5 deliberately failed**, exit1, zero skipped/retried. All six tests are configured to expect success; none uses expected-failure annotations. The independent checker returns **PASS** because the exact deliberately induced error sequences satisfy these oracles:

| Scenario | Result |
| --- | --- |
| Manual baseline: locator fails, body finally cleanup fails | Only cleanup survives; primary locator error is lost |
| Actual fixture: locator fails, fixture cleanup fails | Locator error remains first; cleanup AggregateError follows |
| Actual fixture: body passes, cleanup fails | Cleanup AggregateError fails the test |
| Actual fixture: body passes, cleanup passes | Test passes |
| Negative ownership control: actual factory, first close moved into body finally | Primary locator failure is hidden again |
| Actual factory creates two contexts, one close rejects | Both context-closed attachments are present; AggregateError still fails test |

Fault injection wraps each actual BrowserContext.close. It executes the real close first and then deliberately throws the controlled cleanup error. The ownership mutation changes where the first close is awaited in the artifact testcase; the imported fixture and tracked source remain untouched. This demonstrates why fixture-owned cleanup matters without relying on a naturally flaky close failure.

The actual tracked fixture meets the intended error-precedence and all-context-cleanup behavior. These six controlled executions are separate from the business gate, and they do not establish the historical 45-second timeout's original trigger. The previous `NOTES.md` continues to distinguish observed behavior from hypotheses.
