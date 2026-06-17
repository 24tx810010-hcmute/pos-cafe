# 18 - Payment Settings Drawer

Screenshot audit: [25-payment-settings-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/25-payment-settings-drawer.png)

## Goal

Payment settings should not expose unfinished features as prototype labels. It should either configure real supported methods or clearly show unavailable methods without lowering confidence.

## Current Problems

- Audit version had "QR/CK mock", "Lưu mock", "Sau MVP", placeholder language. Copy polish cleaned this, but layout still needs product framing.
- Cash method is always on, but currently consumes too much configuration space.
- QR/bank fields may suggest real integration when not fully supported.

## Redesign Requirements

- Header:
  - Title: "Cài đặt thanh toán"
  - Subtitle: "Phương thức thanh toán"
  - Actions: "Hủy", "Lưu cài đặt"
- Method list:
  - Tiền mặt: always available, active.
  - QR: if not fully real, show "Chưa kích hoạt" or hide behind disabled card.
  - Chuyển khoản: same.
  - Khác: hide unless there is a user reason to show.
- Cash panel:
  - Simple info: "Tiền mặt là phương thức mặc định và luôn khả dụng."
  - No toggle.
- QR/bank panel:
  - If editable, label fields as receipt display info only.
  - If not supported, show compact unavailable state:
    - "Phương thức này chưa được kích hoạt cho thanh toán thực tế."
    - No fake JSON/placeholder wording.
- Preview:
  - Only show if fields affect receipt.

## Layout Spec

- Two panes enough: method list + method detail.
- Preview can be below detail or collapsed.
- Avoid huge receipt preview if settings are mostly disabled.

## Files To Touch

- `src/app/App.tsx`: `PaymentSettingsDrawer`
- `src/styles.css`: `.pay-*`, `.set-receipt-*`
- Tests: `src/app/demoCopyPolish.test.tsx`

## Acceptance Checklist

- [ ] No "mock", "MVP", "placeholder", "Optional".
- [ ] Unsupported methods look intentionally unavailable.
- [ ] Save button label is "Lưu cài đặt".
- [ ] Cash method cannot be disabled accidentally.
