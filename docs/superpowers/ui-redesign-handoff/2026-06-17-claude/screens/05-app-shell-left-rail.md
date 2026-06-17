# 05 - App Shell And Left Rail

Screenshot context: [06-pos-floor.png](../../../ui-audit/2026-06-16-desktop/screenshots/06-pos-floor.png)

## Goal

Make navigation predictable and professional. The shell must support fast cashier work without cryptic labels.

## Current Problems

- Rail is compact but some labels were too abbreviated; copy polish already improved several labels.
- The rail competes visually with the workspace due to repeated low-contrast surfaces.
- Permissions-disabled items need clearer disabled affordance if shown.

## Redesign Requirements

- Rail items:
  - Ban
  - Mang di
  - Lich su
  - Nhan vien
  - Menu
  - So do
  - Bao cao
  - Bep
  - Thanh toan
  - Cai dat
  - Khoa
- Use icon + text. Do not use icon-only rail on desktop.
- Active item must be obvious.
- Disabled item:
  - Keep visible only if useful for admin demo.
  - Add tooltip/title: "Can quyen quan ly" if disabled.
- Employee badge:
  - Show employee name/role compactly, not only initials if space allows.

## Layout Spec

- Desktop rail width can be 92-116px if labels fit.
- Phone landscape: rail can become icon-only with tooltips only if labels would break; otherwise keep short labels.
- Rail bottom lock action must not be mistaken for logout/destructive action; use "Khoa" with lock icon.

## Files To Touch

- `src/app/App.tsx`: `AppShell`, `RailButton`
- `src/styles.css`: `.app-shell`, `.left-rail`, `.rail-*`

## Acceptance Checklist

- [ ] All rail labels fit at desktop and 844x390.
- [ ] Active state clear.
- [ ] Disabled state readable and not broken-looking.
- [ ] Opening/closing drawers does not shift rail layout.

