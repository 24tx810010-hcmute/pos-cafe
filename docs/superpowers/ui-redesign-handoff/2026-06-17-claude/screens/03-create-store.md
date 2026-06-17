# 03 - Create Store Form And Success

Screenshots:

- [03-create-store-form.png](../../../ui-audit/2026-06-16-desktop/screenshots/03-create-store-form.png)
- [04-create-store-success.png](../../../ui-audit/2026-06-16-desktop/screenshots/04-create-store-success.png)

## Goal

Create a new store and show credentials once in a way that is calm, clear, and not scary.

## Current Problems

- The form has read-only timezone and disabled seed checkbox that do not help the user.
- Success state exposes sensitive-looking data correctly, but visual hierarchy can be improved.
- The disabled "prepare sample data" checkbox should either be hidden or framed as automatic setup, not a fake option.

## Redesign Requirements

### Form State

- Required field: "Ten quan".
- Optional field: "Dia chi" only if it affects receipt preview; otherwise keep it compact.
- Hide timezone/currency read-only fields from create flow.
- Do not show a disabled checkbox for sample data. Replace with small note: "He thong se tao san menu va so do mau de ban bat dau nhanh."
- Primary CTA: "Tao quan".
- Secondary: "Da co quan? Ghep thiet bi".

### Success State

- Show success title and concise instruction.
- Credential cards:
  - Store Key
  - Admin PIN
- Each credential card has copy button with clear feedback.
- Warning copy:
  - "Luu lai Store Key va Admin PIN. Ban se can chung de dang nhap thiet bi khac."
- Primary CTA: "Vao man hinh PIN".
- Do not use warning icon if it makes state feel dangerous; use info style.

## Layout Spec

- Desktop: form centered with side note or receipt preview only if useful.
- Success: two credential cards in one row desktop, stacked on small landscape.
- Credentials must not overflow container.

## Files To Touch

- `src/app/App.tsx`: `CreateStoreScreen`
- `src/styles.css`: `.create-store-*`, `.preauth-*`
- Tests: `src/app/demoCopyPolish.test.tsx` if placeholder/copy changes.

## Acceptance Checklist

- [ ] No disabled fake options.
- [ ] No internal words: seed, raw Store Key, app state.
- [ ] Copy buttons are visible and not cramped.
- [ ] Success screen can be screenshotted for demo without looking like secrets leaked accidentally.

