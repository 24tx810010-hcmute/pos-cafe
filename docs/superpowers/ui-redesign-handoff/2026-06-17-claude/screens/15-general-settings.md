# 15 - General Settings Drawer

Screenshot audit: [22-general-settings-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/22-general-settings-drawer.png)

## Goal

Let admin update store display info and receipt footer. Hide technical/read-only fields unless they help.

## Current Problems

- System/read-only fields are too prominent.
- Three-pane layout may be overkill for few settings.
- Demo/data reset section needs to feel like maintenance, not debug tooling.

## Redesign Requirements

- Header:
  - Title: "Cai dat chung"
  - Dirty badge
  - Actions: "Huy", "Luu cai dat"
- Sections:
  - Thong tin quan
  - Hoa don
  - Bao tri du lieu
- Hide or collapse:
  - timezone
  - currency
  - realtime/internal status
- Receipt preview:
  - Useful if editing receipt fields.
  - Should not take huge space if only one field.
- Maintenance:
  - "Du lieu mau" section should be lower priority and visually separated.
  - Destructive action uses danger style.

## Layout Spec

- Desktop: two panes likely enough: nav + form/preview.
- If keeping three panes, preview must justify space.
- Small landscape: section tabs.

## Files To Touch

- `src/app/App.tsx`: `GeneralSettingsDrawer`
- `src/styles.css`: `.set-*`, `.menu-*`
- Tests: `src/app/demoHardening.test.tsx`, `src/app/demoCopyPolish.test.tsx`

## Acceptance Checklist

- [ ] Only editable/useful settings are prominent.
- [ ] Save disabled when not dirty.
- [ ] Maintenance action clearly destructive.
- [ ] No "config", "demo data", "seed" copy.

