# Worktree Handoff

> Đọc file này đầu tiên khi mở session mới từ nhánh `docs`.

## Mục tiêu

Repo này đang tách **planning docs** và **code thực tế** bằng `git worktree`.

- Session chính thường mở ở docs branch để đọc/ra quyết định.
- Khi cần implement code, session vẫn đọc docs tại worktree này nhưng sửa code ở worktree code riêng.
- Không copy toàn bộ docs/spec private sang branch code.

## Worktree hiện tại

| Vai trò | Path | Branch | Nội dung |
|---|---|---|---|
| Docs/planning | `D:\Workspace\pos-cafe` | `docs` | Specs, context, UI reference docs/assets |
| Code thực tế | `D:\Workspace\pos-cafe-code` | `codex/code-foundation` | App code, migrations, tests |

Branch code `codex/code-foundation` được tạo từ `main` và cherry-pick code scaffold, **không chứa history docs**.

Branch cũ `codex/code-kickoff-foundation` được tạo từ `docs`, không dùng cho code mới vì có history docs.

## Quy ước prompt

Người dùng có thể dùng prefix ngắn:

- `update docs:` → làm ở `D:\Workspace\pos-cafe`, commit vào `docs`.
- `implement code:` → đọc docs ở `D:\Workspace\pos-cafe`, sửa code ở `D:\Workspace\pos-cafe-code`, commit vào code branch.
- `docs + code:` → làm cả hai worktree, nhưng commit riêng từng branch.

Nếu không có prefix:

- Câu hỏi/ra quyết định/planning → xử lý ở docs worktree.
- Coding/bugfix/test/build → xử lý ở code worktree, vẫn đọc docs worktree làm reference.

## Quy tắc bắt buộc

- Không commit `docs/`, `pos-cafe-context.md`, hoặc spec private vào code branch.
- Không cherry-pick docs commits sang code branch.
- Không merge `docs` vào code branch.
- Code worktree chỉ được chứa code app, migrations, tests, config, lockfile.
- Nếu code cần thông tin spec, đọc trực tiếp từ docs worktree:
  - `D:\Workspace\pos-cafe\pos-cafe-context.md`
  - `D:\Workspace\pos-cafe\docs\superpowers\specs\*.md`
- Nếu thay đổi quyết định product/architecture, update docs branch trước hoặc cùng lượt, rồi implement code theo quyết định mới.

## Kiểm tra nhanh cho session mới

Chạy ở docs worktree:

```powershell
git status --short --branch
git worktree list
```

Kỳ vọng:

```text
D:/Workspace/pos-cafe       [docs]
D:/Workspace/pos-cafe-code  [codex/code-foundation]
```

Chạy ở code worktree nếu chuẩn bị code:

```powershell
git status --short --branch
git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\.md)"
```

Lệnh `rg` trên không được trả kết quả. Nếu có kết quả, code branch đã bị lẫn docs.

## Verify code worktree

Khi chạm code:

```powershell
npm run build
npm run test
npm run smoke
```

Tùy phạm vi:

- Chỉ chạm SQL/docs code comments: tối thiểu `npm run build`.
- Chạm core/mock/domain: thêm `npm run test`.
- Chạm UI/layout: thêm `npm run smoke`.

## Push policy

- Push docs branch khi update docs cần chia sẻ cho session khác.
- Push code branch khi milestone code cần chia sẻ hoặc tạo PR.
- Có thể push cả hai, nhưng luôn push đúng branch từ đúng worktree.
