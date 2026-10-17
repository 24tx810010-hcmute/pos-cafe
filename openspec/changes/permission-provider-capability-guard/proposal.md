# Guard quyền phát hành theo capability của Supabase

Change công cụ nhạy cảm; bỏ `usecases.md` theo ngoại lệ của SPEC-STANDARD vì không sinh thao tác hoặc thông báo UI mới. Kịch bản vận hành và I/O được ghi trong spec/testplan.

## Vấn đề và bằng chứng

[Khảo sát 06/10](../../../docs/implementation-log/permission-release-capabilities-2026-10-06.md) cho thấy hai predicate native false, trong khi live nạp supautils, actor kế thừa privileged role và có whitelist cấu hình/policy grant. Guard tại `D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:345` hiện chỉ nhận predicate native; được gọi trước prepare, và trong cutover transaction/rehearsal. Clone 01/10 không có profile provider, từng dùng native grants bổ sung. Các kết quả đó giữ nguyên phạm vi lịch sử.

## Quyết định và ủy quyền

**PGCG-D01, 06/10/2026, đã chấp nhận:** sau đề xuất “kiểm thử cơ chế quyền sẵn có của Supabase trên clone, rồi điều chỉnh guard theo kết quả”, chủ dự án trả lời **“ok”** trong chat hiện tại. Đây là ủy quyền kiểm thử cách ly và thay guard trong slice này; không mở cleanup/deploy live, cấp quyền live, UI hoặc gate tổng.

Lựa chọn A: dùng capability provider đang có sau khi chứng minh DDL cần thiết trên clone, giữ fail-closed và đường native. Lý do: tránh kết luận thiếu quyền từ profile mô phỏng chưa đủ. B giữ native grants: clone đã có diagnostic nhưng chưa chứng minh hosted hỗ trợ, membership rộng hơn thao tác cần dùng. C giữ chặn: an toàn nhưng không giải quyết khác biệt môi trường. DDL hosted vẫn chưa chứng minh chỉ bằng clone.

## Phạm vi/ảnh hưởng

- Shared guard, tests của guard và runner rehearsal capability riêng có profile/isolation tường minh.
- Native role invariants/error codes và cleanup/activation/recovery/journal/target/source gates giữ nguyên yêu cầu. Không nhận SQL, role hay relation tùy ý để nâng quyền.
- Docs ghi lý do, cách dựng profile, kết quả/giới hạn, evidence fingerprint và nguồn cho báo cáo.
- Hai review spec trước implementation; hai review candidate code/evidence/docs cuối. Walkthrough sẽ được cung cấp, không tự nhận chủ dự án đã hiểu code.

Không có câu hỏi nghiệp vụ đang chặn slice đã chọn. Chi tiết dựng clone và parser là lựa chọn kỹ thuật trong scope này; nếu không dựng được profile có bằng chứng tương đương, ghi blocker, không hạ gate.
