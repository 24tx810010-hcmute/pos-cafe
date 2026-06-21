# Main Flow Snapshot - 2026-06-20

Source of truth checked from `main` worktree at commit `ef3ecdb`.
Docs worktree was pulled/rebased to `docs` commit `1334372` before writing this note.

This file records where the app currently is before any new visual-first POS redesign work starts.

## Current App Shape

The app is still a single URL React/Vite POS. Navigation is internal state plus drawers; it is not route-based.

Pre-login screens:

- `landing`: start screen with actions to pair an existing store or create a new store.
- `storePairing`: accepts Store Key and moves to passcode on success.
- `createStore`: create-store form plus success state showing Store Key and Admin PIN.
- `passcode`: employee picker, numeric PIN pad, unlock into app shell.
- `rotateGuidance`: shown for portrait orientation while landscape app screens are hidden.

Logged-in shell:

- Left rail modules: table floor, takeaway, order history, employees, menu, floor editor, reports, kitchen, payment settings, general settings, lock.
- Guarded admin modules use `canAccessModule`; unauthorized access shows disabled buttons or forbidden states.
- Current employee and role remain visible in the rail.

Core POS drawers/state:

- `order`: order drawer for dine-in or takeaway, new draft or existing order.
- `payment`: payment drawer for an open order.
- `takeaway`: takeaway list/detail/action drawer.

Admin drawers/state:

- `orderHistory`, `employees`, `menuEditor`, `floorEditor`, `reportSettings`, `settings`, `kitchen`, `paymentSettings`.

## What Main Has Already Reached

The main branch has already moved beyond the old three-pane POS prototype for the most important core screens.

POS floor:

- Current layout is already two primary regions under the toolbar: floor canvas plus open-order queue.
- Area selector and table filters are compact toolbar controls.
- Header actions are `Mang di`, refresh, and quick takeaway order.
- Tables show status with color, order number, and compact total where available.

Order drawer:

- Current layout is menu/catalog plus cart.
- Existing and new draft orders use the same drawer.
- New unsent draft has dirty close confirm.
- Existing open order can transition to payment when unchanged.
- Order error and closed/stale states are represented.

Payment drawer:

- Current layout is bill/receipt summary plus payment controls.
- Cash amount input, quick cash buttons, change/remaining amount, and complete action are visible.
- Loading, error, insufficient cash, and closed/stale states exist.
- Business logic is still cash-focused; non-cash methods are not a real payment flow.

Takeaway drawer:

- Current layout is order list plus detail/action.
- Filters include open, paid, today.
- Open takeaway orders come from order data; paid takeaway examples are currently UI-side sample data in `MOCK_PAID_TAKEAWAY`.
- Open order, payment, create takeaway, and reprint-like paid action surfaces exist.

Admin/ops:

- Order history has date/status/type/search filters, list plus detail, and auto-select behavior.
- Report drawer uses report/history data, metrics, charts, sections, and custom ranges.
- Kitchen drawer is currently UI-side ticket data with local done/undo state, not a backend kitchen queue.
- Payment settings includes QR/bank/cash configuration UI and QR receipt preview, but this is settings/UI behavior rather than payment processing.
- Clear demo dialog blocks while open orders exist.

## Remaining Gap For New UI Work

Main is functionally organized, but it is not yet the final aesthetic redesign.

The current UI is still utilitarian:

- Mostly teal/slate operational styling.
- Many drawer headers and panel shells share the same visual pattern.
- Several screens are dense but not visually polished.
- Payment and order flows work, but the payment screen does not yet look like a high-end touch POS.
- Some optional/admin screens are useful but still feel like internal tools.

The next redesign should treat main as a functional base, not as a visual target.

Recommended visual direction for the next phase:

- Use current workflows and selectors as the contract.
- Re-skin and re-compose POS core first: floor view, order drawer, payment drawer, takeaway drawer.
- Keep at most two primary content regions per screen.
- Make payment the most polished touch-first screen.
- Do not add dashboard top navigation or product-category rail concepts from external mockups.
- Keep Vietnamese product copy and avoid internal terms.

## Current Screenshot References

Fresh screenshots restored into the docs worktree at root-level folder:

`ui-screenshots-stitch-2026-06-20/`

Most relevant POS-core images:

- `07-pos-floor-view.png`
- `08-order-drawer-new-draft.png`
- `09-order-dirty-close-confirm.png`
- `10-order-drawer-existing-order.png`
- `11-payment-drawer-normal-cash.png`
- `12-payment-drawer-insufficient-cash.png`
- `13-takeaway-drawer.png`

The full folder has 26 PNGs covering pre-login, core POS, admin drawers, settings, kitchen, payment QR, and important dirty/blocked states.

## Implementation Notes For Future UI Agents

- Preserve Zustand app state shape in `src/app/useAppStore.ts`.
- Preserve ports/hooks in `src/features/*`; do not redesign by changing data contracts first.
- Use Tailwind utilities in TSX. Do not bring back `src/styles.css`.
- Shared tokens live in `tailwind.posCafeStyles.ts` and `tailwind.config.ts`.
- Existing smoke tests use data-testid heavily; keep stable test IDs unless intentionally updating tests.
- Do not expose terms such as mock, seed, DB, MVP, Draft, tombstone, Supabase, or void in user-facing UI.

## Known Documentation State

The pulled two-column docs are still useful as structural rules, but some wording says "old/current problem" because they were written as instructions for an implementation agent.

When planning the next visual redesign, read this snapshot first, then read:

1. `2026-06-19-two-column/01-core-pos-entrypoint.md`
2. `2026-06-19-two-column/core/02-pos-floor.md`
3. `2026-06-19-two-column/core/03-order-drawer.md`
4. `2026-06-19-two-column/core/04-payment-drawer.md`
5. `2026-06-19-two-column/core/05-takeaway.md`

Interpret those files as layout constraints already mostly satisfied by `main`, not as proof that visual polish is complete.
