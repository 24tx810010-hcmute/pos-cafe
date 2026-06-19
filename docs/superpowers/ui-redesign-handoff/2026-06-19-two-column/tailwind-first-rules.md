# Tailwind-First Styling Rules

Read this file before changing any production POS Cafe UI code.

## Non-Negotiable Styling Policy

- POS Cafe is a Tailwind CSS project across the whole production UI, not only selected screens.
- Do not rebuild screens, drawers, dialogs, providers, shared UI helpers, or print-preview UI with plain hand-written CSS.
- New or changed layout should use Tailwind utility classes in JSX whenever practical.
- `src/tailwind.css` is the Tailwind entrypoint. It should contain only `@tailwind base;`, `@tailwind components;`, and `@tailwind utilities;`.
- For reusable semantic classes that already exist and cannot be converted safely in one pass, register them through the Tailwind plugin/config layer, not through a handwritten stylesheet.
- Do not add raw CSS declarations such as `display:`, `grid-template-columns:`, `padding:`, `border:`, `background:`, `font-size:`, or `box-shadow:` for normal UI layout.
- Do not use static React inline `style={{ ... }}` for normal layout, spacing, typography, borders, colors, shadows, or sizing.
- Do not use MUI `sx={{ ... }}` for normal layout or visual styling. Prefer Tailwind `className`; use `!` utilities when overriding MUI defaults.
- Do not introduce a new long custom stylesheet for a screen or drawer.
- Do not add Tailwind-like custom class names that are backed by plain CSS declarations.

## Allowed CSS Exceptions

Raw CSS is allowed only when Tailwind cannot safely express the behavior:

- `@tailwind` directives in `src/tailwind.css`.
- Tailwind plugin/config generated base styles such as `:root`, global app font/color defaults, `html/body/#root`, and `@keyframes`.
- Tailwind plugin/config component styles for legacy semantic selectors that are too risky to inline into TSX in the current task.
- MUI descendant overrides only when they cannot be placed on a JSX element.
- Runtime style objects where the value is data-driven and not knowable to Tailwind at build time: floor/table coordinates, logical scale/zoom, dynamic z-index, category swatch colors, progress widths, chart bars, and print payload values.
- Floor-plan stage/node behavior where coordinates, transforms, drag cursors, z-index, or logical scale are driven by runtime style objects.

If you add one of these exceptions, keep it small and explain it in the final report.

## Preferred Patterns

Use JSX utilities for one-off screen layout:

```tsx
<section className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-3">
```

If a legacy semantic selector must remain, put it in the Tailwind plugin/config layer rather than recreating `src/styles.css`:

```ts
addComponents({
  ".drawer-overlay": {
    position: "absolute",
    inset: "12px 12px 12px auto",
  },
});
```

Use arbitrary Tailwind values instead of raw CSS when exact legacy sizing must be preserved:

```tsx
<section className="grid grid-cols-[minmax(320px,1fr)_320px] gap-3">
```

Use Tailwind theme tokens already defined in `tailwind.config.ts`:

- `bg-pos-bg`
- `bg-pos-surface`
- `bg-pos-surface2`
- `border-pos-line`
- `text-pos-ink`
- `text-pos-muted`
- `text-pos-primary`
- `bg-pos-primarySoft`
- `border-pos-primaryLine`

## Required Static Check

Run this before reporting done:

```powershell
rg -n "^[ \t]*(display|width|height|padding|margin|border|background|color|font|grid|flex|position|top|right|bottom|left|box-shadow|text-|line-height|overflow|opacity|cursor|transition|align|justify|gap|z-index|transform|outline|min-|max-|place-|white-space|vertical-align|border-radius|border-color|border-style|border-width|box-sizing|resize|pointer-events|object-fit|letter-spacing):" src/tailwind.css
Test-Path src/styles.css
Get-Content src/tailwind.css
```

Expected result: no property matches, and `Test-Path src/styles.css` returns `False`. `src/tailwind.css` should only contain the three Tailwind directives.

Also run:

```powershell
rg -n "@apply" src/tailwind.css
rg -n "style=\{\{|sx=\{\{" src/app src/features src/components
```

Expected result: no `@apply` in `src/tailwind.css`.
Expected inline result: no static layout/style usage. Any remaining match must be a documented runtime value that Tailwind cannot precompute.

## Review Standard

Reject the implementation if it recreates `src/styles.css` or expands `src/tailwind.css` beyond Tailwind directives. The purpose of this handoff is Tailwind-first UI polish, not another custom stylesheet.
