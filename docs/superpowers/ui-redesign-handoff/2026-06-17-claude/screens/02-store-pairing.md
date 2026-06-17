# 02 - Store Pairing

Screenshot audit: [02-store-pairing.png](../../../ui-audit/2026-06-16-desktop/screenshots/02-store-pairing.png)

## Goal

Let a device join an existing store with minimal friction. This screen should feel secure and operational, not technical.

## Current Problems

- The form is clear but visually generic.
- Supporting notes are useful but can be tighter.
- Store Key helper must never mention raw key storage or internal session behavior.

## Redesign Requirements

- Main form area:
  - Title: "Ghép thiết bị với quán"
  - Short help: "Nhập Store Key do quản lý cung cấp."
  - Input label: "Store Key"
  - Placeholder must be generic sample, not a real store key.
  - Primary CTA: "Ghép thiết bị"
- Side/support area:
  - Show 2-3 concise facts: multiple devices, staff PIN login, and change-store support.
  - Use icons and short text.
- Error state:
  - Invalid format: clear example.
  - Backend/session error: show retry-friendly message, no stack/internal code.

## Layout Spec

- Desktop: form and notes can be two columns inside one preauth shell.
- Phone landscape: form first, notes below or hidden behind compact info row.
- Button must remain full width in form column.

## Files To Touch

- `src/app/App.tsx`: `StorePairingScreen`
- `src/styles.css`: `.preauth-*`
- Tests: session flow tests if behavior changes; copy test if visible copy changes.

## Acceptance Checklist

- [ ] No visible "raw Store Key", "session", "auth", "DB", "Supabase".
- [ ] Error message is user-actionable.
- [ ] CTA disabled/loading state is clear.
- [ ] Screen fits in 844x390 without important controls below fold.
