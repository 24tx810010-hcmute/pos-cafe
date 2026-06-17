# Testing Checklist

Chay checklist nay truoc khi noi da xong.

## Required Commands

```powershell
npm run test
npm run build
git diff --check
```

Expected:

- Vitest: all tests pass.
- Build: `tsc -b && vite build` pass.
- `git diff --check`: no whitespace errors. CRLF warnings on Windows are acceptable if no actual diff-check errors.

## UI Copy Guard

```powershell
npm run test -- demoCopyPolish
```

Expected:

- No visible implementation/dev copy in tested screens.

If this fails, do not delete the test. Fix the UI copy or update the test only if the new copy is intentionally user-facing.

## POS Flow Smoke

```powershell
VITE_DATA_MODE=mock npm run smoke
```

Run when touching:

- App shell
- POS floor
- Order drawer
- Payment drawer
- Takeaway
- History

## Visual Verification

Use local app:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Capture or inspect:

- Desktop `1440x900`
- Tablet landscape `1024x600`
- Phone landscape `844x390`
- Phone portrait should show rotate guidance only

For every touched screen, verify:

- No overlapping text.
- Primary CTA visible without scrolling where expected.
- Header actions do not wrap badly.
- Table/list rows fit and remain scannable.
- Dialogs fit viewport.

## Secret/Private Data Scan

Before committing docs/screenshots:

```powershell
rg -n "sb_|SUPABASE|password|secret|REAL_STORE_KEY|REAL_ADMIN_PIN" .
```

Expected:

- No real key/secret in committed docs/screenshots.
- Generic labels like "Store Key" are OK, but no real user/store key.
