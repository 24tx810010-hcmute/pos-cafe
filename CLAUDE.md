<!--
  BẢN GỐC. File này sống trên nhánh `docs`, worktree `D:/Workspace/pos-cafe-docs`.
  Từ 2026-09-07, hướng dẫn cho agent không còn đặt trên nhánh `main` nữa.
  Bản trên `main` chỉ là con trỏ và không được sửa.
-->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`pos-cafe` is a tablet-first, multi-device point-of-sale web app for a single cafe (store pairing + employee PIN login, dine-in floor plan, dine-in/takeaway ordering, cash payment, order history, kitchen seam, basic reports, and admin editors for menu/floor/employees/settings). It is an academic (TLCN) project.

- **UI language is Vietnamese** — keep new user-facing strings and error messages in Vietnamese.
- **Phase constraints (intentional scope limits):** online-only (no offline), cash-only payment, browser print preview only (no native/ESC-POS printer), kitchen queue is a UI-only seam. These are deliberate; preserve the extension seams rather than removing them.

## Documentation knowledge base

There is a **standalone `docs` branch** (not merged into `main`, Markdown only) that is the project's knowledge base — the "why" behind decisions. Read it when you need background that isn't in the code:

```bash
git show docs:docs/architecture.md      # layers, RPC/transaction boundary, realtime, permissions
git show docs:docs/data-model.md        # tables, enums, RPC behavior
git show docs:docs/tech-stack.md        # decision record (why each tech, tradeoffs)
git show docs:docs/features.md          # per-module feature scope
git show docs:pos-cafe-context.md       # dense single-file project context
git ls-tree -r --name-only docs         # full doc index (incl. archive/, implementation-log/)
```

Code is the final source of truth; docs describe verified state and may lag slightly.

## Current write protocol (2026-09-10)

The approved implementation is described in `docs/implementation-log/phase-27-idempotent-write-operations.md` on this branch. Migrations 014–016 implement employee sessions and write protocol v1; deployment status and final evidence are recorded in that phase log. Use `IWriteOperationRepo` for production order/payment/void flows. Register immutable K/payload before execute; retries preserve them, server recovery is independent of local memory, and terminal R1 is historical. Pending TTL 24h never expires the order. Online only, no automatic replay on reconnect.

Retained lines keep source IDs and historical prices/options; additions use current confirmed component prices. Employee tokens stay memory-only for 12h and SQL verifies current permissions. Old write RPC overloads and client financial DML are revoked. Do not restore legacy grants to make an old client work. See `src/adapters/supabase/writeOperationRepo.ts:31`, `014_write_identity_and_ledger.sql:162`, `016_activate_write_protocol.sql:258`.

For isolated integration testing use the dedicated `test:idempotency:*` scripts and `IDEM_ENV_FILE`; never run `smoke:supabase` against a real store as a substitute. Unit, contract, tooling and browser results must match one candidate fingerprint, with no required skip/retry/expected-failure. The native Auth/REST runtime omits Storage API and Realtime.

## Commands

```bash
npm run dev            # Vite dev server on http://127.0.0.1:5173
npm run build          # tsc -b && vite build  — this is also the typecheck (no separate lint/typecheck script)
npm test               # Vitest unit/component tests (run once)
npm run test:watch     # Vitest watch mode
npm run smoke          # Playwright smoke tests (mock data mode; auto-starts a dev server)
npm run smoke:supabase # Playwright E2E against a real Supabase project (needs .env / .env.local)
```

Run a single unit test:

```bash
npx vitest run src/features/pos/orderFlow.test.ts   # one file
npx vitest run -t "submits order changes"           # by test name (substring)
```

Run a single smoke project/test:

```bash
npx playwright test --project=desktop   # one viewport project
npx playwright test -g "create order"   # by title
```

There is **no ESLint config**; type safety comes from `tsc` (strict mode) via `npm run build`. The build emits a known Vite chunk-size warning.

## Data mode (mock vs Supabase)

The app runs against either an in-memory mock backend or Supabase, selected at runtime by `src/app/runtimePorts.ts`:

- `VITE_DATA_MODE=mock` → mock adapter (default for dev, all unit tests, and `npm run smoke`).
- `VITE_DATA_MODE=supabase` (or omitted but `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` present) → Supabase adapter.

Copy `.env.example` to `.env.local` to configure. You can develop the entire UI without Supabase. (Supabase free tier pauses after ~7 days — wake it before a live demo.)

## Architecture

### Ports & Adapters (the core pattern)

Everything above the data layer depends only on the interfaces in `src/ports/index.ts`. `AppPorts` bundles all repository/port interfaces (`auth`, `employee`, `write`, `menu`, `menuImages`, `floorPlan`, `order`, `payment`, `report`, `settings`, `seed`, `print`, `realtime`). Two interchangeable implementations:

- `src/adapters/mock/` — `createMockPorts(state)` over an in-memory `MockState`.
- `src/adapters/supabase/` — `createSupabasePorts(client)` over Supabase. Reads use `.from(...).select(...)` filtering `deleted_at is null`; writes use `repoShared.ts` helpers (`insertRows`, `updateRow`, `tombstoneRow`) and SQL RPC. `src/adapters/browser/printPort.ts` supplies the real print port here.

Ports are provided through React context (`PortsContext` in `src/features/shared/portsContext.tsx`, wired in `src/app/AppProviders.tsx`) and consumed with `usePorts()`. **Add a backend capability by extending `AppPorts` first, then implementing it in both adapters.** Only `src/app/runtimePorts.ts` is allowed to compose concrete adapters.

### Architecture boundary guard

`src/architectureBoundaries.test.ts` is a Vitest test that walks the source tree with a TypeScript AST import scanner and **fails the test suite on layer violations**. Enforced rules:

- `domain` / `core` / `ports` must not import React, `app`, `features`, or `adapters`.
- `features` must not import `app` or `adapters`.
- `adapters` must not import `app` or `features`.
- Only `src/app/runtimePorts.ts` may import concrete adapters.
- `src/ports` is interface/type-only; the React ports context lives in `src/features/shared/portsContext.tsx`.
- `src/seed` is a shared fixture layer used only by the mock adapter and the Supabase seed bundle.

If you move files between layers, run `npm test` — this guard will catch illegal imports.

### State: two distinct stores

- **Server/async state → TanStack Query.** Query keys are centralized (`src/features/shared/queryKeys.ts` `posQueryKeys`, plus per-feature `*QueryKeys.ts`). Defaults: `staleTime: 30s`, `retry: false`. Floor plan, open orders, and order detail also poll with `refetchInterval: 5000` to recover from missed realtime events. Mutations invalidate/refetch by query key — **never patch the cache manually.**
- **Client/UI state → Zustand** (`src/app/useAppStore.ts`): current `screen`, `currentEmployee`, active area/category, which `drawer` is open, order/payment context, and the in-progress `draftItems` cart.

### Navigation (single URL)

No router. The whole app is one URL; navigation is internal state. Pre-login screens (`landing`, `storePairing`, `createStore`, `passcode`) and the logged-in `drawer` are driven by Zustand and routed in `src/app/App.tsx` → `shell/AppShell.tsx`. Browser back/forward is not a workflow; mutations happen only via explicit buttons. Refresh is safe: not paired → pairing, paired → passcode (current employee is memory-only). Landscape-first; phone portrait shows a rotate-guidance screen.

### Layers

- `src/domain/` — pure types only, no logic. `models.ts` (entities), `inputs.ts` (input DTOs), `changes.ts`. **Changeset pattern:** editor drawers accumulate a `Changeset<Create, Update, Delete>` (with tombstone deletes) and save it in one call; start from `emptyChangeset()` / `createEmpty*Changes()`.
- `src/core/` — cross-cutting primitives: `appError.ts` (`AppError` + typed `AppErrorCode`, `isAppError`), `guards.ts` (permissions), `money.ts`, `orderDraft.ts`.
- `src/features/<feature>/` — business logic as **pure flow functions** (`orderFlow.ts`, `adminFlow.ts`, `sessionFlow.ts`, … — the main unit-test targets), **React hooks** wrapping queries/mutations (`usePosData.ts`, `useAdminData.ts`, `useAdminMutations.ts`, `useOrderPaymentFlow.ts`), and **invalidation** modules. Features: `pos`, `admin`, `session`, `integration` (realtime invalidation, dirty-exit guards, UI error mapping).
- `src/app/` — UI. `shell/` (`AppShell` = `LeftNav` left rail + `FloorWorkspace` + drawers), `drawers/pos/` + `drawers/admin/` (slide-overs rendered by `useAppStore().drawer`), `screens/` (pre-auth), `components/` (shared, incl. portal primitives).

### RPC & transaction boundary

Business-critical mutations use protocol v1 in migrations 014–016. The public endpoints are register/execute/get/list/cancel and capabilities; protected receipt reads use `get_payment_receipt`. Private helpers implement submit, pay, split and void. Every successful execute commits business rows, an audit event and immutable terminal result atomically. Known business errors roll back business effects before persisting rejected; infrastructure failures roll back the entire transaction.

Store-level POS serialization remains, with a consistent K/order/table/numbering/catalog lock order and session/permission/TTL checks after waiting. OCC rejects null/mismatched expectedVersion. Old adapter methods remain for compatibility tests but are not a fallback for UI writes; SQL activation revokes every old overload and financial DML.

### Auth & permissions

Two levels: **store pairing** (Store Key `STORE_NO-SECRET`, e.g. `0001-X8F3QA` → `StoreSession`, secret never persisted raw) then **employee PIN** → `currentEmployee` with a role.

- Permission lives in `src/core/guards.ts`: `canAccessModule(employee, module)` and `requireModuleAccess(...)` (throws `AppError("FORBIDDEN", …)`), backed by a `role → modules` map. Roles: `admin` (all), `cashier` (floor/order/payment/orderHistory), `kitchen` (kitchen seam). Admin-only flows also call `requireAdminActor(...)` in `adminFlow.ts` — never rely on a disabled button alone.
- **Security boundary:** store Auth/RLS scopes tenant reads; employee session v1 proves the actor for protected writes, with live permission checks and financial/identity bypass revoked. SELECT remains store-scoped. Do not claim owner provisioning, PIN brute-force controls or complete per-employee read authorization.

### Concurrency

Orders and payments use optimistic locking: callers pass `expectedVersion`; the server returns a new `lockVersion`; a mismatch surfaces as `ORDER_VERSION_CONFLICT`, and the UI refetches. If another device closes/pays an order while a drawer is open, the order-detail refetch flips the UI to a closed/disabled state.

### Floor plan editor

Tables and decor live on a logical stage of **1600×900**, scaled to fit (see `src/app/components/ScaledFloorStage.tsx` and `src/app/floorStage.ts`). Drag/resize mutate the DOM directly via refs + `requestAnimationFrame` and only **commit a draft on pointerup**. The floor editor edits layout only and must **not** overwrite `table.status` (status is owned by the order/payment flow). Decor items render only — they never take orders and have no status.

### UI overlay primitives

Popups/modals use `PortalPopup`; drawers use `PortalDrawer` (`src/app/components/`, both `createPortal` internally). Drawers open in a workspace viewport behind `LeftNav` (desktop offset 176px, compact 68px), with an `rgba(0,0,0,0.2)` overlay, click-overlay-to-close, and a placement-based slide-in.

### Styling

Tailwind is primary, using custom `pos-*` color tokens backed by CSS variables and `rounded-pos` (`tailwind.config.ts` + the `posCafeStyles` plugin in `tailwind.posCafeStyles`). MUI provides the theme, `CssBaseline`, and some controls; `react-hot-toast` handles toasts. A test guards against legacy CSS classes — prefer Tailwind utilities/tokens over new CSS files.

## Non-negotiable rules (offline-extension seams)

These keep the door open for a future offline-first adapter; violating them breaks the seam:

1. Generate UUIDs **on the client** (not via Postgres defaults).
2. **No hard deletes** for sync/editor data — tombstone with `deleted_at` + `deleted_by_employee_id`; orders are voided (`status=void`), order items are removed (`status=removed`). Queries default to `deleted_at is null`.
3. **Supabase/snake_case types never leak into core** — only adapters know them; adapters map to camelCase domain DTOs and map errors to `AppError`.
4. Realtime is centralized in `IRealtimePort` / `useRealtimeInvalidation` and is **signal-only** (invalidate/refetch), never manual cache merging.
5. Order/payment must use `lock_version` / `expectedVersion`.

## Testing conventions

- Unit/component tests are colocated as `*.test.ts(x)`, run under Vitest (jsdom, globals on, `@/` → `src/` alias, setup in `src/test/setup.ts`).
- **Flow functions** are tested directly against `createMockPorts(createMockState())`.
- **Component tests** render the component (often `App`) inside a `PortsContext.Provider` (mock ports, `vi.spyOn` on the relevant repo) plus a fresh `QueryClient`, then drive UI state via `useAppStore.setState(...)`; reset the Zustand store in `afterEach`.
- Smoke tests: `tests/smoke/` (Playwright, mock mode, 5 viewport projects incl. a portrait "rotate" case). Supabase E2E: `tests/supabase/`.

## Supabase backend

SQL lives in `supabase/migrations/`. Apply to a real environment only in an authorized deployment window; phase 27 is tested locally and not deployed. Historical migration roles: `001` schema+enums, `002` indexes+RLS+triggers, `003` RPC functions, `004` realtime publication, `005`–`006` menu item image storage + asset key, `007` full data wipe (pre-modifier-rework), `008` shared-modifier rework, `009` partial payment (superseded), `010` instant-pay split-order (replaces `009`, redefines the order/payment RPCs). Multi-tenant by `store_id` with RLS. `business_date` is computed from the store's timezone (not the device clock); `order_no` is unique per `(store_id, business_date)`. Reports are computed from paid orders only (void excluded), filtered by `business_date`.

## Conventions

- Import via the `@/` alias (→ `src/`), configured in `vite.config.ts`, `vitest.config.ts`, and `tsconfig.app.json`.
- Throw `AppError` with a specific `AppErrorCode` for expected failures; map them to user-facing toasts via `src/app/appErrors.ts` / `src/features/integration/uiError.ts`.
- Seed demo logins: admin PIN `123456`, cashier PIN `111111`.

## Spec standard and assistant role

This project treats the assistant as a **requirements analyst**: read the code, question the user until requirements are unambiguous, write the spec, and implement only when explicitly asked.

Every change needs seven artifacts, not four: `proposal.md`, `specs/`, `design.md`, `usecases.md`, `testplan.md`, `traceability.md`, `tasks.md`.

The authority is `openspec/SPEC-STANDARD.md` on the `docs` branch (worktree at `D:/Workspace/pos-cafe-docs`). Read it before writing or extending any spec. `AGENTS.md` carries a summary.
