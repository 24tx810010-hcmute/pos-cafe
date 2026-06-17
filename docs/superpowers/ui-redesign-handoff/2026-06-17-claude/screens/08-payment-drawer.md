# 08 - Payment Drawer

Screenshots:

- [10-payment-drawer-normal.png](../../../ui-audit/2026-06-16-desktop/screenshots/10-payment-drawer-normal.png)
- [11-payment-drawer-insufficient.png](../../../ui-audit/2026-06-16-desktop/screenshots/11-payment-drawer-insufficient.png)

## Goal

Payment should feel decisive and trustworthy. Cashier needs total, received amount, change, and finish button.

## Current Problems

- Flow is fairly strong, but blank receipt/summary areas can feel under-designed.
- Completion CTA can compete between header and body.
- Non-cash methods should be hidden/disabled cleanly if not ready.

## Redesign Requirements

### Header

- Title: "Thanh toan - Don #123".
- Subtitle: table/order type + short instruction.
- Primary CTA: "Hoan tat thanh toan".
- If insufficient cash, CTA disabled and amount warning visible.

### Main Body

- Left: order summary
  - Table/type
  - Order number
  - Item count
  - Total
  - Status if stale/closed
- Center: cash input
  - Received amount field
  - Quick cash buttons
  - Change/remaining amount very prominent
- Right: receipt preview or payment confirmation summary
  - Only show useful receipt preview; no empty decorative blank.

### Insufficient Cash

- Show warning near received amount:
  - "Khach dua chua du. Con thieu X."
- Disable finish button.
- Button text should not turn into error label; keep disabled CTA plus warning.

### Stale/Closed State

- If order was paid/closed by another device:
  - Show blocked state.
  - CTA disabled.
  - Provide "Tai lai don" or "Quay lai so do".

## Layout Spec

- Desktop: 3 columns possible.
- Small landscape: order summary can collapse; cash input must remain primary.
- Numeric input must not be tiny.

## Files To Touch

- `src/app/App.tsx`: `PaymentDrawer`
- `src/styles.css`: `.payment-*`
- Tests/smoke: payment flow and stale/insufficient states.

## Acceptance Checklist

- [ ] Cash exact amount completes payment.
- [ ] Insufficient cash blocks payment and explains why.
- [ ] Change amount is visually obvious.
- [ ] Non-cash unavailable state does not say mock/MVP/placeholder.
- [ ] Closed/stale state looks intentional.

