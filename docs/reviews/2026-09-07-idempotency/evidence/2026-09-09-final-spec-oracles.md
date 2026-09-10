# Rà độc lập cuối — fixture, oracle và khả năng tự chạy

Ngày 09/09/2026. Bộ spec `add-idempotent-write-operations`, bản có 93 TC gốc. Không đọc báo cáo reviewer khác, không sửa input, không chạy ứng dụng hoặc DB. Phần formatting, OpenSpec scenario và mở rộng manifest tự động do agent chính xử lý riêng.

**Kết luận:** runner, preflight, raw observer, mutation sensitivity và phân biệt mock/DB đã rõ hơn bản trước. Còn **5 finding** dưới đây cần chỉnh fixture hoặc bổ sung oracle trước khi giao người triển khai. Không cần hỏi lại nghiệp vụ modifier.

## FIN-ORA-01 — P1: C trong TC056 không thể replay chỉ bằng thêm grant

**Vị trí:** [testplan.md:49](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:49) định nghĩa C là cashier `denyall`; [TC056:699](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:699) chỉ nói C được `grantpay` để replay, nhưng expected tại dòng 703 là replay thành công, không thay actor/time. [design.md:65](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:65) quy định deny thắng grant.

**Tác động:** fixture theo đúng văn bản trả `FORBIDDEN`, không đi vào nhánh replay. Nếu người viết sửa guard để grant thắng deny nhằm làm TC056 xanh thì phá chính mô hình quyền. Ma trận TC006 có thể phát hiện mâu thuẫn, nhưng không làm fixture TC056 hợp lệ.

**Sửa cụ thể:** trong setup biến thể replay của TC056, bỏ `payment.take` khỏi denies của C, thêm grant `payment.take`, giữ denies của bốn quyền còn lại; assert quyền hiệu lực đúng trước replay. C dùng phiên hợp lệ riêng. Expected: replay trả R1; counter tăng 1; creator A, lastModified E, initiator A, executor/payment B và timestamps giữ nguyên. Giữ biến thể `grant + deny payment.take` làm negative riêng: `FORBIDDEN`, counter/ledger/business giữ nguyên. Áp dụng cùng fixture rõ nghĩa cho scenario A/E/A/B/C trong requirement dấu vết người thực hiện.

## FIN-ORA-02 — P1: ca TTL/retention chưa bảo đảm phiên 12 giờ còn hợp lệ khi kiểm lệnh 24–48 giờ

**Vị trí:** [design.md:42](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:42) đặt hạn phiên 12 giờ; auth được kiểm trước TTL ở design §5.1/§7. [TC013:226](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:226) dịch clock tới T+25h; [TC062:765](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:765), TC063/065 dùng gần T+24h; TC067/068 dùng T+48h; TC082 dùng T+30 ngày. A5 chưa định nghĩa issuedAt của session cho những fixture này và các bước chưa cấp phiên mới sau dịch thời gian.

**Tác động:** nếu giữ token được cấp lúc T, lời gọi bị `EMPLOYEE_SESSION_REQUIRED` trước khi vào expired/replay/retention. Người triển khai có thể làm test đi qua bằng cách bỏ auth trong harness hoặc chỉ fake riêng đồng hồ lệnh, khiến test không chứng minh hai vòng đời phối hợp đúng. Đây là khoảng trống tiền điều kiện, không phải kết quả chạy đã tái hiện.

**Sửa cụ thể:** ghi rõ đồng hồ điều khiển có tác động đến helper nào; trong các ca kiểm K, luôn dùng Store JWT và employee session còn hợp lệ tại checkpoint, không tắt auth. Ví dụ K register ở T; cấp lại phiên tại T+23h, rồi chạy ba ca T+24h−1ms/0/+1ms. Ca replay T+48h dùng phiên cấp tại T+47h. Cấp lại phiên chỉ thay credential, không đổi K/payload/registeredAt/expiresAt/initiator. Expected: trước hạn K applied; đúng/sau hạn K expired; K terminal ở 48 giờ vẫn terminal/R1 cũ. Giữ token T hết hạn thành một negative riêng theo TC005: `EMPLOYEE_SESSION_REQUIRED`, K không bị terminal hóa chỉ vì auth thất bại.

## FIN-ORA-03 — P2: positive quantity boundary của TC077 dùng quote 0 trái giá F0

**Vị trí:** [F0:53](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:53) có catalog A=30000, Q=5000; [TC077:930](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:930) đặt `quotedprice0` để tránh overflow rồi yêu cầu validate/register/**execute**, với positive quantities 1/999 và 1/99. [design.md:119](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:119) và dòng 124 yêu cầu quote so với giá catalog thực.

**Tác động:** positive case register được nhưng execute trả `PRICE_CHANGED`; nó chưa chứng minh quantity max thực hiện được. Chỉ hạ quote không hạ giá mà server dùng tính tiền.

**Sửa cụ thể:** tạo biến thể F0-QTY có **catalog base=0 và option delta=0** được admin setup trước register, quote cũng bằng 0, group multi hợp lệ, đủ linked IDs. Expected ở quantity 1/999 và option 1/99: pending rồi applied; quantity lưu đúng literal, tổng 0, không payment do đây là submit. 0 và max+1 bị `INVALID_WRITE_REQUEST` trước ledger. Cách khác là giữ giá F0 và quote đúng 30000/5000; `(30000 + 99×5000)×999 = 524475000`, vẫn trong Money range, nhưng không trộn hai cách setup trong cùng ca.

## FIN-ORA-04 — P2: “multiple vượt limit” của TC036 chưa có ràng buộc nghiệp vụ để dựng fixture

**Vị trí:** [TC036:479](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:479) liệt kê `multiple vượt limit`, expected `OPTION_VALUE_UNAVAILABLE`/rejected tại dòng 483. [design.md:98](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/design.md:98) nói multi theo constraints hiện hành, đồng thời array options tối đa 20. Model hiện hành [models.ts:70](D:/Workspace/pos-cafe/src/domain/models.ts:70) chỉ có `selectType`, `isRequired`, không có min/max số lựa chọn của group; [orderDraft.ts:76](D:/Workspace/pos-cafe/src/core/orderDraft.ts:76) chỉ kiểm quantity dương, single ≤1 và required có lựa chọn.

**Tác động:** không thể biết “vượt limit” là trường nào. Nếu chọn 21 option, schema phải trả `INVALID_WRITE_REQUEST` trước register, mâu thuẫn expected business `OPTION_VALUE_UNAVAILABLE`. Thêm max-per-group chỉ để dựng ca này sẽ vô tình bổ sung yêu cầu sản phẩm chưa có.

**Sửa cụ thể:** bỏ nhãn business “multiple vượt limit” khỏi TC036; đưa max 20/21 vào suffix của TC078 với mã schema đã chốt. Giữ TC036 kiểm required thiếu, single có 2 **optionValueId khác nhau hợp lệ**, option/group không liên kết/deleted/cross-store; mỗi fixture có quote đúng và chỉ một lỗi, expected `OPTION_VALUE_UNAVAILABLE`/rejected/0 business delta. Nếu muốn negative multi khác, dùng 2 lựa chọn có một option thuộc group không linked, không gọi đó là vượt số lượng group.

## FIN-ORA-05 — P1: các ca chênh giá chưa bắt implementation chỉ so tổng tiền

**Vị trí:** [requirement IDEM-17:183](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/specs/write-idempotency/spec.md:183) yêu cầu so base và **từng option**, không chỉ tổng. [TC034:457](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:457) đổi riêng base; [TC035:468](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:468) đổi riêng option. Cả hai đều làm tổng quote khác tổng hiện hành.

**Lỗi có thể lọt:** code chỉ so `quotedNewLinesTotal === currentNewLinesTotal` sẽ vẫn vượt qua hai TC chênh giá hiện có; nó âm thầm chấp nhận base/option đã thay đổi khi hai chênh lệch bù nhau, trái contract so từng component. Literal total và raw DB không phát hiện lỗi này nếu fixture không tạo trường hợp bằng tổng.

**Ca bổ sung:** suffix riêng cho TC035 hoặc TC034: phần cũ F3 tổng 80000 giữ nguyên. Phần mới quote base=35000, Q=7000, option quantity=2, item quantity=1, tổng phần mới 49000. Sau register, đổi catalog base=37000 và Q=6000, giữ order version=5; tổng mới vẫn `37000 + 2×6000 = 49000`.

Expected execute K1: **rejected PRICE_CHANGED**, details base 35000→37000, option 7000→6000, proposedNewLinesTotal=49000; đơn vẫn 80000/version5, không new item/payment/event. K1 replay vẫn rejected. Chỉ sau xác nhận K2 với quote mới mới applied tổng129000/version6. Mutation “chỉ so tổng” phải làm ca này đỏ. Không liên quan sửa modifier món cũ: modifier nằm trên phần mới đang đăng ký.

## Những điểm đã kiểm và không ghi thành finding

- **§B đúng mã gốc:** 006, 020, 023, 032, 047, 063, 068, 069, 074, 078, 079 đều trỏ đúng heading và đúng chủ đề TC chi tiết. Không thấy lỗi đánh nhầm số trong 11 hàng này. Manifest cuối vẫn cần mở rộng suffix/backend theo phần việc agent chính đang thực hiện; không coi 93 là tổng execution.
- **Runner/preflight đã xử lý rủi ro trước:** testplan §A2 có contract config riêng, discovery/verify-results, backend marker, observer DSN và required-skip làm fail. TC086/087 kiểm chính gate, không chỉ ghi một lời nhắc. Script chưa được tạo/chạy là trạng thái được ghi đúng trong spec.
- **Oracle G có giá trị:** raw observer sau commit, đếm toàn fixture store, kiểm R1 bằng literal trước replay, timeout race là fail, đếm request/preview/print và không dùng helper SUT tính expected. TC047 đã dùng paid fixture cho void NULL và positive twin phù hợp; không còn dùng đơn mở để che nhánh NULL.
- **Biên payload 262144/262145 có thể dựng trong schema.** Một recipe độc lập: create takeaway, 200 newLines; mỗi line quantity1, quote base0, note rỗng và 8 option với quantity1/quote0; tất cả UUID chuẩn dài36, option snapshot IDs khác nhau, catalog/group thật có đủ linked options và giá0. Với tên field đúng design và JSONB text có khoảng trắng chuẩn sau dấu phẩy/dấu hai chấm, mô hình serialization độc lập cho 261804 byte. Thêm 340 ký tự ASCII vào note đầu cho 262144; thêm341 cho262145; mỗi note vẫn ≤500 và mỗi line chỉ8 options. Khi triển khai **phải xác nhận lại `octet_length(payload::text)` bằng PostgreSQL observer**, không lấy phép tính này làm kết quả DB đã chạy. Không padding bằng `name` trong payload vì NewLine không cho field đó; không dùng `pg_column_size` thay contract byte-text. Ca max-array200/max-options20 nên có fixture riêng, không mặc nhiên ghép mọi biên vào một payload vượt byte limit trước nhánh cần kiểm.

## Mốc kiểm và phần việc tiếp theo

Đã đọc design, toàn bộ dữ liệu/bước/expected của TC001–093, §A/§B/§D, traceability, tasks và các requirement tương ứng. Không kiểm formatting hoặc sửa scenario gốc thay agent chính. Mọi phát hiện trên là thiết kế test/fixture, không phải tuyên bố app/DB đã fail thực tế.

SHA-256 bản đọc trước khi agent chính áp sửa:

| File | SHA-256 |
| --- | --- |
| testplan.md | `D4593F8B280FD2681372A2B722E290B9AEF29E49B9B4F5291EB35DC8BD6E22F4` |
| design.md | `D66D436DE9125927F722F6E6437A7D32A3DBEDF424C9A467EEA1CAF6E8B37C3F` |
| traceability.md | `3BCE1FF4EB693DB72B9393348B94147B117146CC7E34FE1AD9C0342FC7B07131` |

Analyst sửa các fixture và thêm suffix/expected ở trên, rồi cập nhật manifest/truy vết của chính TC bị ảnh hưởng. Không có finding nào cần người dùng chọn thêm chính sách giá/quyền/modifier. Sau duyệt triển khai mới tạo harness và chạy suite; bản review này không thay bằng chứng thực thi.

## Kiểm lại sau sửa — 09/09/2026

Chỉ đối chiếu lại đúng 5 FIN-ORA trên theo yêu cầu; không mở rộng phạm vi, không đọc báo cáo khác, không sửa input hoặc chạy app/DB. **Cả 5 finding đã đóng ở mức thiết kế tài liệu.** Trạng thái này thay cho nhận xét “còn 5 finding” của lần đọc đầu, không có nghĩa TC đã được hiện thực hoặc chạy đạt.

Bản `testplan.md` khi kiểm lại có SHA-256 `D4EAABA0F348EDB6755528E597081BA9CF1E61B312E5C90F067DD8C4BCD4EAC2`.

| Finding | Trạng thái | Bằng chứng kiểm lại |
| --- | --- | --- |
| FIN-ORA-01 | Đóng | [A5:49](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:49) và [TC056:701](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:701) cùng ghi bỏ deny `payment.take` rồi grant, assert quyền hiệu lực trước request. Expected actor/time vẫn được giữ tại dòng705; negative deny thắng grant tiếp tục nằm ở TC006. |
| FIN-ORA-02 | Đóng | [A5:64](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:64) áp quy tắc cho mọi TC dịch clock ≥12h: cấp phiên mới hợp lệ/re-PIN, assert `token.expiresAt > checkpoint`, không tạo lại/gia hạn K; TC005 giữ trường hợp cố ý token hết hạn. Tiền điều kiện giờ không để auth che nhánh TTL/retention. |
| FIN-ORA-03 | Đóng | [TC077:932](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:932) đặt actual catalog base/option=0 và quote=0. Positive quantities không còn bị chênh quote trước khi kiểm thực thi; đây vẫn là ca submit, không dùng nó để suy chính sách payment tổng0. |
| FIN-ORA-04 | Đóng | [TC036:481](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:481) thay “multi vượt limit” bằng required multi thiếu lựa chọn; [expected:485](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:485) tách negative khỏi positive A30000+Q5000+Z0=35000, hai option snapshots cùng group multi hợp lệ. Không còn đòi ràng buộc max-per-group chưa tồn tại. |
| FIN-ORA-05 | Đóng | [TC035:470](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:470) có variant quote35000+2×7000=49000 so với actual37000+2×6000=49000. [Expected:474](D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/testplan.md:474) vẫn đòi `PRICE_CHANGED`, details từng component và chỉ K mới sau xác nhận được áp dụng; comparator chỉ so tổng sẽ bị ca này phát hiện. |

Không còn FIN-ORA mở trong phạm vi kiểm lại này. Việc materialize suffix/manifest và thực thi harness vẫn thuộc cổng triển khai/nghiệm thu đã ghi trong testplan.
