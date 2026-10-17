# EVC — checkpoint transport của probe, 2026-10-16

**Verdict: APPROVE** cho checkpoint dừng/chẩn đoán, đúng manifest SHA256 `8ae45dd05899bcb037fac9b401cdbe139539e263665f2c6ac9b52692922f1f79`.

Phạm vi duyệt là tính nhất quán của source công khai, provenance, receipt và kết luận của checkpoint. Đây không phải quyền chạy lại parent/launcher hay chứng nhận kết nối, actor, scope hoặc khả năng tương thích database.

## Định danh và phép kiểm độc lập

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-launch-transport-checkpoint-01/candidate-01/manifest.json`.

- Đối chiếu đủ 11 file live/snapshot: tổng 101.427 bytes; size và SHA256 khớp manifest, không drift.
- Đối chiếu đủ 6 external prerequisite bằng pin công khai: helper, runtime manifest, integrity proof, package lock và hai bản module probe. Không đọc private input.
- Đọc nguyên parent command lưu trữ, source launcher/module, intent, hai receipt transport/post-stop, future recipe và báo cáo/index trong snapshot.
- Parent command lưu trữ: 9.270 bytes, SHA256 `1ef326d25c3ccd5e80aa8eb101d14a4034e2dbf0aa5c14427f252502917caf34`. Tự extract body 9.085 ký tự, parse PowerShell 0 lỗi, encode UTF-16LE thành argument Base64 24.228 ký tự rồi decode so ordinal khớp. Chỉ parse/encode; không thực thi body hoặc transport child.
- Kiểm dung lượng logic công khai: checkpoint 18 files/123.965 bytes cộng hai tài liệu đầy đủ 40.169 bytes = 164.134 bytes trước các biên bản review, dưới trần phase 262.144 bytes. Đây không phải quota hệ điều hành.

## Dispatch, control flow và giới hạn chứng cứ

Intent ghi đúng một dispatch được chủ máy cho phép tại `call_f16bf4f90f4f493d88891a904a741453`. Tool chunk `c04651` trả shell exit 0, output rỗng, wall time 0,5783667 giây. Không có cặp UTC before/after được lấy tại dispatch; mốc post-stop 13:57:20.7631164Z không được dùng làm thời gian bắt đầu/kết thúc hồi cứu.

Trong exact parent body, public pin/read-lock và reserve checks đứng trước việc tạo execution directory. Marker `single-invocation.json` dùng CreateNew sau khi tạo directory; lời gọi launcher chỉ nằm sau marker. Không có nhánh xóa directory/marker trong body. Receipt sau dừng ghi execution directory vắng và không có matching probe process.

Tổ hợp receipt hiện trạng và control flow hỗ trợ kết luận **0 lời gọi reviewed launcher từ dispatch này**, do đó không có private-input/DPAPI/protected Node-pg/DB action qua nhánh launcher đó. Đây là suy luận từ control flow và các quan sát được ghi lại, không phải trace trực tiếp từng stage hay network/DPAPI audit. Không suy kết luận này từ exit 0 hoặc thời lượng ngắn. Một số public preflight có chạy hay chưa không được xác định chính xác.

Báo cáo giữ đúng phạm vi: transport dispatch không tạo bằng chứng SQL/TLS/credential failure, cũng không tạo probe PASS. Không có retry sau khi kết quả không như dự kiến.

## Chẩn đoán và khả năng tái hiện

Receipt `transport-verification.json` ghi hai child **synthetic công khai**: stdin `-Command -` tái hiện exit 0/output rỗng; `-EncodedCommand` chạy fixture trả giá trị 18 cùng các cờ không đọc private input/không DB. Fixture không chứa thao tác file, credential hay network. Hai child này không chạy parent thật và không được cộng thành probe/application/backend tests.

Các hàng LTC-01 đến LTC-05 lần lượt mô tả synthetic transport, static parse/roundtrip, post-attempt pins và stop witnesses. Chúng không phải năm database tests. Bộ 11 launcher tests của gói preparation trước là lịch sử riêng; EVC không chạy lại hoặc cộng thành tổng mới.

Tám pin trong post-attempt receipt khớp source đã duyệt. Chúng là phép đo sau dispatch; hồ sơ không giả chúng thành before-dispatch sample. Future recipe chỉ đề xuất truyền exact body bằng UTF-16LE EncodedCommand; encoding không bảo vệ bí mật và synthetic success không chứng minh full parent/probe sẽ chạy thành công.

## Findings và quyết định tiếp theo

Không có finding blocking về độ trung thực của checkpoint, binding source/evidence hoặc phạm vi kết luận. Source launcher/module và prerequisite vẫn thuộc phiên bản đã duyệt; checkpoint không sửa launcher để suy ra kết quả mới.

Future recipe ở trạng thái `PREPARED_NOT_AUTHORIZED_TO_EXECUTE`. Cần quyết định mới của chủ máy trước bất kỳ invocation thật nào; phải cập nhật approval reference, ghi pin/body tương ứng, giữ guard/reserve/CreateNew marker và quy tắc một lần, dừng khi lỗi. APPROVE này không cấp quyền thực thi, không đóng online actor/scope, application compatibility, cutover, CI, push hoặc deploy gates.

EVC chỉ đọc/hash/parse/encode source và evidence công khai. Không chạy parent/launcher, synthetic child, suite cũ, protected Node-pg hoặc probe; không đọc metadata/bytes private input, DPAPI, network, DB; không install/copy runtime, sửa candidate/index, push, deploy hoặc xóa dữ liệu.

