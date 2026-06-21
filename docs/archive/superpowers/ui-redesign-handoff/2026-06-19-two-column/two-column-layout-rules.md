# Two-Column Layout Rules

Nguyên tắc chính: POS Cafe chỉ dùng tối đa 2 cột/pane nội dung chính. Không dùng layout 3 cột cho các màn demo hoặc drawer vận hành.

This project is a cafe POS. The main UI must be fast to scan and operate. For this redesign, every main screen/drawer must use at most two primary content regions.

## Non-Negotiable Rule

- No desktop screen or drawer may use three primary panes/columns.
- The persistent app rail is navigation and is not counted as a content column, but the content area beside it is still limited to two regions.
- Minor grids inside one region are allowed, such as menu cards, metric cards, quick cash buttons, or table rows.
- A filter, category list, status summary, toolbar, or preview must not become a third primary pane.

## Replace Existing 3-Pane Patterns

The current code has patterns/classes that must not be used for redesigned screens:

- `.three-pane`
- `.payment-three-pane`
- `.menu-three-pane`
- `.rp-three-pane`
- `.fe-three-pane`

For touched screens, replace these with one of the approved patterns below.

## Approved Patterns

### Pattern A: Toolbar + Two Regions

Use when there are filters/categories/status controls plus two real work areas.

- Top: toolbar with filters, area/category tabs, status chips, search, or secondary actions.
- Main left: primary work surface.
- Main right: active order/cart/detail/inspector.

Examples: POS floor, order drawer, floor editor.

### Pattern B: List + Detail

Use for operational lists.

- Left: list/table/cards with search/filter toolbar embedded above the list.
- Right: selected detail/action panel.
- Auto-select the first useful item when data exists so the detail area is not idle.

Examples: takeaway, order history, employees, kitchen queue.

### Pattern C: Section Tabs + Content

Use for settings/report screens where a nav pane would waste space.

- Top: tabs/segmented control for sections.
- Main: content for selected section.
- Optional preview may live inside the selected section, not as a persistent third pane.

Examples: report, general settings, payment settings.

### Pattern D: Single Focused Flow

Use for preauth, dialogs, and small focused tasks.

- One focused card/form or two side-by-side action cards.
- No admin-style panes.
- No marketing hero.

Examples: landing, store pairing, create store, passcode, confirm dialogs.

## Responsive Behavior

- Desktop 1440x900: max two content regions.
- Tablet landscape 1024x600: max two content regions, reduce widths and move optional controls into toolbar/tabs.
- Phone landscape 844x390: prefer tabs/segment switching when two regions become cramped.
- Phone portrait: rotate guidance only.

## What Counts As A Failure

- A screen still visibly has left nav/filter + center content + right detail/cart/preview.
- A third pane is hidden on small screens but still visible on desktop.
- A filter or category column consumes full-height space when it could be a top tab/toolbar.
- The layout looks like a debug/admin shell reused for every workflow.