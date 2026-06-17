# 01 - Landing / Start Screen

Screenshot audit: [01-landing.png](../../../ui-audit/2026-06-16-desktop/screenshots/01-landing.png)

## Goal

First screen must make the user choose one of two real tasks: pair an existing store or create a new store. It must not feel like a marketing page or internal deployment page.

## Current Problems

- Layout is acceptable but visually plain.
- First impression lacks product confidence.
- Copy was already cleaned after audit, but still check for any dev/internal wording after redesign.
- The two main choices need stronger hierarchy and clearer consequences.

## Redesign Requirements

- Keep first viewport focused on action, not long explanation.
- Use a compact brand header: logo/wordmark + one sentence.
- Two large action tiles:
  - "Da co quan" / pair device.
  - "Tao quan moi" / create store.
- Each tile needs icon, title, one-line benefit, and clear hover/focus state.
- Add a small reassurance row below choices:
  - "Dung cho nhieu thiet bi"
  - "Nhan vien dang nhap bang PIN"
  - "Du lieu dong bo theo cua hang"
- Do not mention data mode, backend, Supabase, mock, config, DB.

## Layout Spec

- Desktop: centered content, max width around 900-1040px.
- Tile grid: 2 columns on desktop/tablet landscape, 1 column on phone landscape if needed.
- Avoid full hero/marketing layout. No decorative hero image needed.
- Background should be quiet neutral with enough contrast.

## Files To Touch

- `src/app/App.tsx`: `LandingScreen`
- `src/styles.css`: `.landing-*`, `.preauth-*`
- Test if copy changes: `src/app/demoCopyPolish.test.tsx`

## Acceptance Checklist

- [ ] User can understand next action in under 3 seconds.
- [ ] No internal/dev words appear.
- [ ] Both action tiles are keyboard accessible.
- [ ] Desktop and phone landscape have no clipped text.
- [ ] `npm run test -- demoCopyPolish` passes.

