# Claude Entrypoint

Bạn là AI implementer được giao polish/redesign UI cho POS Cafe. Hãy đọc file này trước khi làm.

## Bắt Buộc Làm Trước Khi Sửa Code

Chạy trong code worktree, không chạy trong docs worktree:

```powershell
cd D:\Workspace\pos-cafe
git status --short --branch
git branch --show-current
git log --oneline -5
npm run test
npm run build
```

Nếu branch hiện tại không phải branch UI riêng hoặc worktree đang dirty với thay đổi không phải của bạn, dừng lại và báo user. Không reset, không checkout force, không discard thay đổi của người khác.

## Branch Policy Bắt Buộc

Trước khi implement UI, tạo branch riêng từ `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c ui-redesign-<scope>
```

Quy tắc:

- Không sửa trực tiếp trên `main`.
- Không sửa UI trên `docs`.
- Không tạo branch có chữ `codex`.
- Không merge vào `main`; chủ dự án sẽ tự merge sau.
- Khi xong, push branch UI và báo commit/branch/test result.

## Cách Đọc Tài Liệu

1. Đọc `README.md`.
2. Đọc `01-global-redesign-rules.md`.
3. Đọc `02-implementation-map.md`.
4. Đọc file screen đang làm trong `screens/`.
5. Sau mỗi screen hoặc nhóm screen, đọc lại `implementation/02-testing-checklist.md`.

## Scope Đúng

Bạn chỉ làm UI/UX polish:

- Re-layout panes, headers, tables, cards, drawers, dialogs.
- Đổi copy, CTA, hierarchy, spacing, responsive constraints.
- Thêm small UI helpers/components nếu giảm lặp code thật sự.
- Thêm/update tests cho UI visible copy, render state, dirty dialog, và critical flow.

Bạn không làm:

- Không đổi schema database.
- Không đổi Supabase RPC, migrations, RLS.
- Không đổi domain model nếu chỉ để đẹp UI.
- Không làm mock-only behavior chèn vào Supabase flow.
- Không thêm route mới.
- Không đưa docs folder vào code branch/main.

## Output Format Khi Báo Kết Quả

Mỗi lần kết thúc một nhóm việc, báo:

- Screens đã polish.
- Files đã sửa.
- Screenshots/viewport đã verify.
- Commands đã chạy và kết quả.
- Risk còn lại.

Không nói "xong" nếu chưa chạy verification.
