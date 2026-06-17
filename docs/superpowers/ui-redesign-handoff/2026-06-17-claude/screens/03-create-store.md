# 03 - Create Store Form And Success

Screenshots:

- [03-create-store-form.png](../../../ui-audit/2026-06-16-desktop/screenshots/03-create-store-form.png)
- [04-create-store-success.png](../../../ui-audit/2026-06-16-desktop/screenshots/04-create-store-success.png)

## Goal

Create a new store and show credentials once in a way that is calm, clear, and not scary.

## Current Problems

- The form has read-only timezone and disabled seed checkbox that does not help the user.
- Success state exposes sensitive-looking data correctly, but visual hierarchy can be improved.
- The disabled "prepare sample data" checkbox should either be hidden or framed as automatic setup, not a fake option.

## Redesign Requirements

### Form State

- Required field: "Tên quán".
- Optional field: "Địa chỉ" only if it affects receipt preview; otherwise keep it compact.
- Hide timezone/currency read-only fields from create flow.
- Do not show a disabled checkbox for sample data. Replace with small note: "Hệ thống sẽ tạo sẵn menu và sơ đồ mẫu để bạn bắt đầu nhanh."
- Primary CTA: "Tạo quán".
- Secondary: "Đã có quán? Ghép thiết bị".

### Success State

- Show success title and concise instruction.
- Credential cards:
  - Store Key
  - Admin PIN
- Each credential card has copy button with clear feedback.
- Warning copy:
  - "Lưu lại Store Key và Admin PIN. Bạn sẽ cần chúng để đăng nhập thiết bị khác."
- Primary CTA: "Vào màn hình PIN".
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

