# 16 - Clear Demo / Reset Sample Data Dialog

Screenshot audit: [23-clear-demo-dialog-blocked.png](../../../ui-audit/2026-06-16-desktop/screenshots/23-clear-demo-dialog-blocked.png)

## Goal

Let admin reset sample data safely, without exposing implementation details.

## Current Problems

- Audit version had seed/tombstone/deactivate language; copy polish has already cleaned this, but dialog still needs visual polish.
- Blocked state should guide user to close open orders.
- Confirmation text "CLEAR" is functional but can feel technical; acceptable if clearly explained.

## Redesign Requirements

- Title: "Đặt lại dữ liệu mẫu".
- Body:
  - "Thao tác này chỉ đặt lại dữ liệu mẫu có sẵn, không xóa dữ liệu người dùng tự tạo."
- Safety info:
  - "Hệ thống sẽ chặn nếu còn đơn đang mở và giữ lại tài khoản quản lý hiện tại."
- States:
  - Loading: checking open orders.
  - Blocked: show open order count and action "Đóng các đơn đang mở trước".
  - Error: retry check.
  - Ready: show checklist and confirmation input.
- Checklist labels:
  - Menu mẫu
  - Sơ đồ bàn mẫu
  - Trang trí mẫu
  - Nhân viên mẫu
  - Giữ lại tài khoản quản lý
- Buttons:
  - Secondary: "Hủy"
  - Destructive: "Đặt lại dữ liệu"

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

