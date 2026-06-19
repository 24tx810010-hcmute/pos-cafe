# Core 04 - Payment Drawer

## Current Problem To Fix

The old payment drawer uses order info + receipt + payment controls as three panes. Redesign it into bill summary plus payment controls.

## Required Layout

Use Pattern A from `two-column-layout-rules.md`:

- Header:
  - Title: `Thanh toán - Đơn #123`.
  - Subtitle: table/order type and short instruction.
  - Primary action: `Hoàn tất thanh toán`.
- Left/main region: bill and receipt summary.
- Right region: payment controls.

Do not keep a separate full-height order metadata pane.

## Bill Summary Region

Fold this information into the bill summary/header:

- Table or `Mang đi`.
- Order number.
- Item count.
- Total.
- Current status if stale/closed.

Receipt preview should show useful content. Do not leave a large decorative blank receipt panel.

## Payment Controls Region

- Cash received input must be large and easy to operate.
- Quick cash buttons should be visible but compact.
- Change amount or remaining amount must be the strongest visual element after total.
- Payment method labels must be Vietnamese.
- Unsupported non-cash methods should be hidden or intentionally unavailable without words like mock/MVP/placeholder.

## Insufficient/Stale States

- Insufficient cash: keep finish button disabled and show `Khách đưa chưa đủ. Còn thiếu X.` near the input.
- Stale/closed order: show blocked state with `Tải lại đơn` or `Quay lại sơ đồ`; do not show a broken or empty layout.

## Acceptance

- Exact cash and overpay cash complete payment.
- Insufficient cash blocks payment and explains why.
- The drawer has only two primary regions: bill summary and payment controls.