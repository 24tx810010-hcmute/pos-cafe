# Tailwind-First Styling Rules

Read this file before changing any POS Cafe UI.

## Non-Negotiable Styling Policy

- POS Cafe is a Tailwind CSS project. Do not rebuild screens with plain hand-written CSS.
- New or changed layout should use Tailwind utility classes in JSX whenever practical.
- For reusable semantic classes that already exist, use Tailwind `@apply` in `src/styles.css`.
- Do not add raw CSS declarations such as `display:`, `grid-template-columns:`, `padding:`, `border:`, `background:`, `font-size:`, or `box-shadow:` for normal UI layout.
- Do not introduce a new long custom stylesheet for a screen or drawer.
- Do not add Tailwind-like custom class names that are backed by plain CSS declarations.

## Allowed CSS Exceptions

Raw CSS is allowed only when Tailwind cannot safely express the behavior:

- `@tailwind` directives.
- `:root` design tokens and global app font/color defaults.
- `html`, `body`, `#root` baseline reset if needed.
- `@keyframes` definitions.
- Orientation and viewport guard wrappers.
- MUI descendant overrides that cannot be placed on a JSX element.
- Floor-plan stage/node behavior where coordinates, transforms, drag cursors, z-index, or logical scale are driven by runtime style objects.

If you add one of these exceptions, keep it small and explain it in the final report.

## Preferred Patterns

Use JSX utilities for one-off screen layout:

```tsx
<section className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-3">
```

Use `@apply` only for shared or legacy selectors:

```css
.drawer-overlay {
  @apply fixed inset-0 z-30 grid bg-pos-bg;
}
```

Use arbitrary Tailwind values instead of raw CSS when exact legacy sizing must be preserved:

```css
.floor-shell {
  @apply grid grid-cols-[minmax(320px,1fr)_320px] gap-3;
}
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
rg -n "^[ \t]*(display|width|height|padding|margin|border|background|color|font|grid|flex|position|top|right|bottom|left|box-shadow|text-|line-height|overflow|opacity|cursor|transition|align|justify|gap|z-index|transform|outline|min-|max-|place-|white-space|vertical-align|border-radius|border-color|border-style|border-width|box-sizing|resize|pointer-events|object-fit|letter-spacing):" src/styles.css
```

Expected result: no matches except the approved exception area such as `:root` or a documented floor-stage/runtime exception.

Also run:

```powershell
rg -n "@apply" src/styles.css
```

Expected result: shared CSS rules should be Tailwind `@apply`, not raw layout declarations.

## Review Standard

Reject the implementation if it only changes visual design by adding more custom CSS. The purpose of this handoff is two-column UI polish with Tailwind-first styling, not another custom stylesheet.
