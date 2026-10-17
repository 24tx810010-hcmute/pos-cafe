# UI Audit

A deterministic detector for rendered-UI defects that code review does not catch:
a button that is 16px tall, an icon that renders as an empty box, a transparent
overlay that swallows clicks, `undefined` leaking into visible text.

It runs against the real rendered page, inspects the live DOM and computed
styles, and reports every anomaly with a CSS selector and a measurement. There
is no model in the loop, so the same page always produces the same output.

## Install

```
npm i -D playwright
npx playwright install chromium
```

Copy the `ui-audit/` directory into the project and edit `config.json`
(`baseUrl`, `routes`, `viewports`).

## Run

```
node ui-audit/run.mjs              # audit every configured route
node ui-audit/run.mjs --update     # accept the current findings as the baseline
node ui-audit/run.mjs --route /menu
```

Output:

- `ui-audit/report.json` — every finding, machine readable
- `ui-audit/out/*.png` — full-page screenshots with the new findings outlined
- exit code 1 when a finding appears that is not in `ui-audit/baseline.json`

## Adopting it on an existing codebase

The first run on a mature app will report a lot. Do not try to fix it all at
once:

1. Run `node ui-audit/run.mjs --update` once and commit `baseline.json`. Every
   current finding is now accepted and the build is green.
2. From then on, only *new* findings fail the build, so no new UI defect of
   these classes can land.
3. Burn down the baseline over time. Each entry you fix is one line removed.

A finding is keyed by route + viewport + rule + CSS selector, never by pixels,
so unrelated layout changes do not churn the baseline the way screenshot
diffing does.

## Rules

| Rule | Severity | What it means |
| --- | --- | --- |
| `hit-blocked` | error | The element's own centre point resolves to a different element. Something is covering the control — a transparent overlay, a stray `z-index`, a modal backdrop that was never unmounted. The control looks fine and does not respond to clicks. |
| `zero-size-interactive` | error | A clickable element laid out at 0x0. Usually a flex child with no content or a collapsed icon wrapper. |
| `no-accessible-name` | error | A button or link with no text, `aria-label`, `title`, or `alt`. Icon-only buttons hit this constantly; it also breaks every automated test that selects by name. |
| `overlapping-controls` | error | Two interactive elements overlap by more than 35%. One of them is partly unclickable. |
| `placeholder-leak` | error | Visible text contains `undefined`, `NaN`, `[object Object]`, `{{...}}`, or `${...}`. A formatting or data-binding bug that reached the screen. |
| `bad-class-token` | error | `class` attribute contains the literal token `undefined`/`null`/`NaN` — a `clsx`/template-literal bug that silently drops styling. |
| `bad-inline-style` | error | Inline `style` contains `NaN` or `undefined`, so that declaration is being ignored. |
| `broken-image` | error | `<img>` finished loading with `naturalWidth === 0`. Dead `src`. |
| `empty-icon` | error | An icon element rendered at 0x0 while declaring a font size. Icon font never loaded, or the ligature name is wrong. |
| `tiny-target` | warn | Clickable box smaller than `minTarget` (default 24px). Hard to hit, especially on the tablet a POS runs on. |
| `overflow-x` | warn | An element extends past the viewport and is not inside a deliberate horizontal scroller, so the whole page scrolls sideways. |
| `clipped-text` | warn | Content is wider than its box, `overflow` is hidden, and there is no `text-overflow: ellipsis`. Text is cut off with no visual hint. |
| `clipped-text-vertical` | info | Same, vertically. |
| `tiny-font` | warn | `font-size` below `minFont` (default 10px). |
| `low-contrast` | warn | Text/background contrast below WCAG AA for that size and weight. |
| `offscreen-interactive` | warn | A sizeable control positioned outside the viewport but still focusable. |
| `disabled-but-pointer` | info | Disabled control still shows a pointer cursor. |
| `image-no-alt` | info | Visible `<img>` with no `alt`. |

Add `data-ui-audit-skip` to any subtree you want excluded, or list a selector in
`config.ignore` (canvas charts, third-party embeds, map widgets).

## Interactive states

`run.mjs` audits each route in its default state. State-dependent screens —
an open modal, an expanded dropdown, a populated cart, an error banner — need a
step that reaches the state first. Add a `steps` entry per route and drive it
with Playwright before calling `window.__uiAudit()`; the auditor is already
installed on the page via `addInitScript`, so it survives client-side
navigation and can be called at any point:

```js
await page.click('[data-testid="cart-open"]');
const findings = await page.evaluate(() => window.__uiAudit());
```

Most high-value defects live in exactly these states, so it is worth writing
the steps for the handful of screens that matter most.

## Using it from the browser console

Paste `audit.js` into the devtools console on any page, then:

```js
window.__uiAuditMark(window.__uiAudit());
```

Findings are outlined in place — red for errors, orange for warnings.

## CI

```yaml
- run: npm ci && npx playwright install --with-deps chromium
- run: npm run build && npm run preview &
- run: npx wait-on http://localhost:4173
- run: node ui-audit/run.mjs
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: ui-audit-screenshots
    path: ui-audit/out/
```
