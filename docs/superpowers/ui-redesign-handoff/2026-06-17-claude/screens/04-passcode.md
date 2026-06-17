# 04 - Passcode

Screenshot audit: [05-passcode.png](../../../ui-audit/2026-06-16-desktop/screenshots/05-passcode.png)

## Goal

Staff should choose their name and enter PIN quickly. This is one of the stronger screens; polish without over-redesigning.

## Current Problems

- Role/status chips không nên dùng English/internal role names.
- Employee grid is functional but can be more scan-friendly for cashier use.
- Rotate guidance copy previously mentioned editor; keep product language only.

## Redesign Requirements

- Employee cards:
  - Name prominent.
  - Role in Vietnamese: "Quản lý", "Thu ngân", "Bếp".
  - Active status can be omitted unless inactive staff are shown.
- PIN keypad:
  - Large touch targets.
  - Clear disabled/enabled state for unlock.
  - Error message near PIN display, not as random toast only.
- Store/change-store action:
  - Keep "Đổi quán / Gỡ ghép" visible but low priority.

## Layout Spec

- Desktop: brand/time column left, employee/PIN panel right.
- Phone landscape: keep two columns if possible, reduce whitespace.
- Portrait: show rotate guidance only.

## Files To Touch

- `src/app/App.tsx`: `PasscodeScreen`, rotate guidance around app root.
- `src/styles.css`: `.passcode-*`, `.rotate-*`
- Tests: add/update if role labels change queried text.

## Acceptance Checklist

- [ ] Nhân viên có thể mở khóa bằng mouse/touch mà không gặp vấn đề target quá nhỏ.
- [ ] No English role labels in visible UI unless intentional.
- [ ] Rotate guidance says "màn hình ngang", not technical layout/editor words.
- [ ] No overflow on 844x390.
