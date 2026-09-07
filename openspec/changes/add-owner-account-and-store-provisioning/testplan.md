# Kế hoạch kiểm thử

> **Chưa viết.** File này được tạo khung ngày 2026-09-07 khi chuẩn bảy artifact
> (`openspec/SPEC-STANDARD.md`) được áp cho toàn dự án. Change này đã có
> `proposal.md`, `specs/`, `design.md` và `tasks.md` viết theo chuẩn cũ bốn file.
>
> Nội dung sẽ được bổ sung **khi bắt đầu thực hiện change này**, không viết trước.
> Lý do hoãn: viết use case và test case trước khi vào việc thì chúng dễ lệch với
> quyết định phát sinh lúc làm, và phải sửa lại hai lần.
>
> Quy cách bắt buộc xem `openspec/SPEC-STANDARD.md`, mục 5.

## Danh sách test case

Chưa có. Bộ test phải phủ đủ bốn nhóm: luồng chính, mọi luồng ngoại lệ, giá trị biên,
và quyền cùng bảo mật kể cả khi gọi thẳng vào tầng dữ liệu bỏ qua giao diện.
