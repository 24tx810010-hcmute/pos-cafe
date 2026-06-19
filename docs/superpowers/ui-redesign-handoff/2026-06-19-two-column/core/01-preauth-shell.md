# Core 01 - Preauth And App Shell

## Screens

- Landing / start screen.
- Store pairing.
- Create store form.
- Create store success.
- Passcode.
- App shell / left rail.

## Intent

The user should immediately understand how to start using the POS: pair an existing store, create a new store, then choose employee and enter PIN. These screens should be operational and trustworthy, not a marketing page and not a backend/config page.

## Required Layout

- Landing: one focused start area with two action cards: `Đã có quán` and `Tạo quán mới`.
- Store pairing: one form column plus one concise help/status column at most.
- Create store: one form column plus one concise result/help column at most.
- Create success: credential handoff must be clear, compact, and not look like accidental secret leakage.
- Passcode: employee selection and PIN keypad/status fit in one or two focused regions; no third panel.
- App shell: keep rail compact. Rail is navigation, not a content pane. Content beside the rail still follows max two content regions.

## Required Copy Cleanup

- Do not mention data mode, backend, Supabase, mock, config, DB, seed, or raw Store Key.
- Use `Store Key` only as the user-facing pairing credential label.
- Role labels: `Quản lý`, `Thu ngân`, `Bếp`.
- Lock/back action should read like returning to employee login, not a technical reset.

## Acceptance

- A new user can identify the next action in under 3 seconds.
- No disabled/read-only internal fields are shown unless needed for pairing/login.
- Buttons are large enough for touch and text does not wrap awkwardly at 844x390.