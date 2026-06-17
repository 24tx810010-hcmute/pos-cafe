# 16 - Clear Demo / Reset Sample Data Dialog

Screenshot audit: [23-clear-demo-dialog-blocked.png](../../../ui-audit/2026-06-16-desktop/screenshots/23-clear-demo-dialog-blocked.png)

## Goal

Let admin reset sample data safely, without exposing implementation details.

## Current Problems

- Audit version had seed/tombstone/deactivate language; copy polish has already cleaned this, but dialog still needs visual polish.
- Blocked state should guide user to close open orders.
- Confirmation text "CLEAR" is functional but can feel technical; acceptable if clearly explained.

## Redesign Requirements

- Title: "Dat lai du lieu mau".
- Body:
  - "Thao tac nay chi dat lai du lieu mau co san, khong xoa du lieu nguoi dung tu tao."
- Safety info:
  - "He thong se chan neu con don dang mo va giu lai tai khoan quan ly hien tai."
- States:
  - Loading: checking open orders.
  - Blocked: show open order count and action "Dong cac don dang mo truoc".
  - Error: retry check.
  - Ready: show checklist and confirmation input.
- Checklist labels:
  - Menu mau
  - So do ban mau
  - Trang tri mau
  - Nhan vien mau
  - Giu lai tai khoan quan ly
- Buttons:
  - Secondary: "Huy"
  - Destructive: "Dat lai du lieu"

## Layout Spec

- Dialog max width around 520-640px.
- On 844x390, dialog body scrolls but buttons remain visible.
- Danger color only on final destructive CTA, not every line.

## Files To Touch

- `src/app/App.tsx`: `ClearDemoDialog`
- `src/styles.css`: `.clear-demo-*`, `.confirm-*`
- Tests: `src/app/demoHardening.test.tsx`, `src/app/demoCopyPolish.test.tsx`

## Acceptance Checklist

- [ ] Cannot confirm while open-order check loading.
- [ ] Cannot confirm when check fails.
- [ ] Cannot confirm when open orders exist.
- [ ] No visible words: seed, tombstone, deactivate, Clear demo.
- [ ] Dialog fits small landscape.

