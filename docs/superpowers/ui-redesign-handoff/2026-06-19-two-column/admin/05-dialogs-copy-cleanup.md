# Admin 05 - Dialogs And Copy Cleanup

## Scope

Apply this to admin dialogs and any touched dirty/save/confirm state:

- Clear sample data dialog.
- Menu dirty confirm.
- Floor dirty confirm.
- Order dirty confirm if touched indirectly.
- Delete/restore confirmations.
- Save/loading/error states.

## Dialog Layout

Dialogs should be focused, not mini admin pages.

Required structure:

- Clear title.
- One short body paragraph.
- Optional compact checklist if needed.
- Primary/secondary/destructive actions with clear hierarchy.
- No nested cards.
- No large blank body area.

## Clear Sample Data Dialog

Use product framing:

- Title: `Xóa dữ liệu mẫu?`
- Explain impact in plain Vietnamese.
- If blocked by open orders, say: `Cần thanh toán hoặc hủy các đơn đang mở trước khi xóa dữ liệu mẫu.`
- Loading/error states include retry where useful.
- Destructive confirmation should require explicit text only if current behavior already does; do not add new business logic.

Do not use:

- `seed`
- `tombstone`
- `deactivate`
- `mock`
- `demo` as internal explanation

## Dirty Confirm Copy

Menu:

- Title: `Bỏ thay đổi menu?`
- Body: `Các chỉnh sửa chưa lưu sẽ bị hủy.`
- Buttons: `Ở lại`, `Bỏ thay đổi`.

Floor:

- Title: `Bỏ thay đổi sơ đồ?`
- Body: `Các thay đổi chưa lưu sẽ bị hủy.`
- Buttons: `Ở lại`, `Bỏ thay đổi`.

Order:

- Title: `Bỏ đơn chưa gửi?` or `Bỏ thay đổi trong đơn?`
- Body: `Các món vừa chọn sẽ không được lưu.`
- Buttons: `Tiếp tục chỉnh sửa`, `Bỏ đơn` / `Bỏ thay đổi`.

## Copy Scan Checklist

Before reporting done, inspect visible UI and run:

```powershell
rg -n "mock|Supabase|DB|MVP|placeholder|seed|tombstone|config|raw Store Key|paid order|void|Draft|Dine-in|deactivate" src/app src/styles.css
```

Test files may contain banned words for guard tests. User-visible code should not.

## Acceptance

- Confirm dialogs fit desktop and landscape phone.
- Destructive action is clear and not accidentally primary.
- Internal/dev words do not appear in user-visible UI.