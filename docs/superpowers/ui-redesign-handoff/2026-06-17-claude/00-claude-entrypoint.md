# Claude Entrypoint

Ban la AI implementer duoc giao polish/redesign UI cho POS Cafe. Hay doc file nay truoc khi lam.

## Bat Buoc Lam Truoc Khi Sua Code

Chay trong code worktree, khong chay trong docs worktree:

```powershell
cd D:\Workspace\pos-cafe
git status --short --branch
git branch --show-current
git log --oneline -5
npm run test
npm run build
```

Neu branch hien tai khong phai branch UI rieng hoac worktree dang dirty voi thay doi khong phai cua ban, dung lai va bao user. Khong reset, khong checkout force, khong discard thay doi cua nguoi khac.

## Cach Doc Tai Lieu

1. Doc `README.md`.
2. Doc `01-global-redesign-rules.md`.
3. Doc `02-implementation-map.md`.
4. Doc file screen dang lam trong `screens/`.
5. Sau moi screen hoac nhom screen, doc lai `implementation/02-testing-checklist.md`.

## Scope Dung

Ban chi lam UI/UX polish:

- Re-layout panes, headers, tables, cards, drawers, dialogs.
- Doi copy, CTA, hierarchy, spacing, responsive constraints.
- Them small UI helpers/components neu giam lap code that su.
- Them/update tests cho UI visible copy, render state, dirty dialog, va critical flow.

Ban khong lam:

- Khong doi schema database.
- Khong doi Supabase RPC, migrations, RLS.
- Khong doi domain model neu chi de dep UI.
- Khong lam mock-only behavior chen vao Supabase flow.
- Khong them route moi.
- Khong dua docs folder vao code branch/main.

## Output Format Khi Bao Ket Qua

Moi lan ket thuc mot nhom viec, bao:

- Screens da polish.
- Files da sua.
- Screenshots/viewport da verify.
- Commands da chay va ket qua.
- Risk con lai.

Khong noi "xong" neu chua chay verification.

