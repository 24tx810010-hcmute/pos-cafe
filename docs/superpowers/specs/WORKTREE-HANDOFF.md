# Worktree Handoff

> Đọc file này khi cần làm song song docs/code sau khi `main` đã nhận đủ code + docs.

## Mục tiêu

Repo này có thể tiếp tục tách **planning docs** và **code thực tế** bằng `git worktree`, nhưng `main` hiện đã chứa cả app code và docs đã merge.

- Session chính hiện mở ở `main` để kiểm tra bản tích hợp cuối.
- Khi cần update docs song song, dùng worktree `docs`.
- Khi cần implement code dài hơi, dùng worktree code riêng rồi merge về `main` khi đã xanh.

## Worktree hiện tại

| Vai trò | Path | Branch | Nội dung |
|---|---|---|---|
| Main/integration | `D:\Workspace\pos-cafe` | `main` | App code + docs đã merge |
| Docs/planning | `D:\Workspace\pos-cafe-docs` | `docs` | Specs, context, UI reference docs/assets |
| Code stream | `D:\Workspace\pos-cafe-code` | `ui-logic-integration` | App code, migrations, tests |

Code stream hiện là mốc integration trước khi merge `main`; nếu mở phase mới, có thể tạo branch mới từ `main` hoặc tiếp tục từ branch code hiện tại tùy phạm vi.

## Quy ước prompt

Người dùng có thể dùng prefix ngắn:

- `update docs:` → làm ở `D:\Workspace\pos-cafe-docs`, commit vào `docs`, rồi merge/cherry-pick docs cần thiết về `main` khi chốt.
- `implement code:` → đọc docs ở `D:\Workspace\pos-cafe-docs` hoặc `main`, sửa code ở `D:\Workspace\pos-cafe-code`, commit vào code branch.
- `docs + code:` → làm cả hai worktree, nhưng commit riêng từng branch.

Nếu không có prefix:

- Câu hỏi/ra quyết định/planning → xử lý ở `main` hoặc docs worktree tùy nội dung.
- Coding/bugfix/test/build → xử lý ở code worktree, vẫn đọc docs worktree làm reference.
- Mỗi coding session phải đọc file này trước, rồi mới đọc `pos-cafe-context.md`, implementation contract, và task phase liên quan.

## Quy tắc bắt buộc

- Không commit `docs/`, `pos-cafe-context.md`, hoặc spec private vào code stream nếu branch đó dùng để làm code-only.
- Không cherry-pick docs commits sang code branch.
- Không merge `docs` vào code branch.
- Code worktree chỉ được chứa code app, migrations, tests, config, lockfile.
- Nếu code cần thông tin spec, đọc trực tiếp từ docs worktree:
  - `D:\Workspace\pos-cafe-docs\pos-cafe-context.md`
  - `D:\Workspace\pos-cafe-docs\docs\superpowers\specs\*.md`
- Nếu thay đổi quyết định product/architecture, update docs branch trước hoặc cùng lượt, rồi implement code theo quyết định mới.

## Kiểm tra nhanh cho session mới

Chạy ở docs worktree:

```powershell
git status --short --branch
git worktree list
```

Kỳ vọng:

```text
D:/Workspace/pos-cafe       [main]
D:/Workspace/pos-cafe-docs  [docs]
D:/Workspace/pos-cafe-code  [ui-logic-integration]
```

Chạy ở code worktree nếu chuẩn bị code:

```powershell
git status --short --branch
git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\.md)"
```

Lệnh `rg` trên không được trả kết quả. Nếu có kết quả, code branch đã bị lẫn docs.
Trước khi tạo branch code mới, tạo từ `main` hoặc branch code hiện tại đã được user chọn; không tạo từ docs branch.

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
