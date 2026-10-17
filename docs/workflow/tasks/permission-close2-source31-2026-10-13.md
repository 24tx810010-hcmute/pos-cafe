# CLOSE-2 source-31 — 13/10/2026

## Phạm vi và ranh giới

Tiếp tục CLOSE-2 theo [handoff source-26](permission-close2-source26-tc47-2026-10-13.md), dừng trước CLOSE-3. SEC đã yêu cầu PIN19 và PERM60 đầy đủ trên cùng fingerprint cuối, cộng phép thử lỗi gateway/RPC cho TC47. Chỉ dùng target local cô lập mới; giữ volume và dataset của các target trước. Không stage/commit/push/deploy, không reset/stash/switch nhánh.

## Nguồn khóa và sửa đo lường

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. Snapshot `source-31` có fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`; manifest SHA-256 `21a1726a8cce20ae692aef895b283032ad46f81f6d5bd3e26188c6bc86ff64cd`, tar SHA-256 `165f9d2edcbed7f9fe8f7aea30ec3c2201b05704e28354479cf79433f721b89f` tại `artifacts/permission-pin-identity-close1/source-31.{json,tar}`.

Sau source-26, T09 được sửa để gửi JWT hợp lệ nhưng thiếu phiên nhân viên khi kiểm 401/no-store: request không JWT bị lớp `verify_jwt` của Supabase chặn trước Edge Function nên không đo được header của ứng dụng. Cấu hình runtime T04 khai báo `[functions.menu-image-public] verify_jwt = false`, khớp thiết kế ảnh công khai ẩn danh; T09 local Storage/Edge PASS 1/1 sau sửa. Các ID/project/port test được đổi sang bộ source31 để không chạm volume đã giữ. Không đổi app/SQL/Edge so với source-26.

## Bằng chứng đang chốt

PERM60 full source31: `artifacts/permission-perm60-source31-20261013/source31/aggregate-result.json` SHA-256 `3a966577895c7da013de7d2566ce5a3090e6671264fb515cd40563f4442d9e5d`: `valid=true`, 60 case, 726 required variant, 27 run, 27 stage report đã kiểm byte SHA, service suite nối tiếp, không lỗi. T04 có 2 Auth, 2 store, 3 Storage bucket, 6 object; dump và tar trước gate đọc được; metadata và payload Storage sau gate khớp trước gate. T01 legacy 30/30 và T02 bridge 52/52 + 52/52 + foundation 4/4 đều trên target riêng. T04 T09 1/1, Realtime và candidate/browser/rollback/transition/compatibility đều có report cùng fingerprint.

TC47 origin fault trên T04 source31: `artifacts/permission-close2-source31/gateway-fault-01.json` SHA-256 `6d4b46c04d33d689c4ab81e4df08dbfa6d4fd01260318ed217363063348b27dd`; tạm thu hồi `service_role EXECUTE` trên lookup RPC, GET thường và conditional trả 503/no-store/`IMAGE_GATEWAY_UNAVAILABLE`, sau đó khôi phục ACL đúng byte và dữ liệu/Storage không đổi. T04/T02/T01 đã dừng, volume giữ.

Lịch sử phép đo: source28 T09 fail vì request bị platform 401; source29 T09 lộ cấu hình public function; source31 lần đầu có Realtime cleanup drift trên fixture cũ, lần kế tiếp trộn marker candidate; aggregate còn phát hiện log transition có `birthtime` lần chạy trước. Mỗi điểm đã được đo/khắc phục bằng fixture và report mới; receipt lỗi được giữ trong private archive, không ghép thành PASS. [Biên bản triển khai](../../implementation-log/permission-close2-source31-2026-10-13.md) ghi chi tiết.

PIN19 source31: `artifacts/permission-pin19-perm60-source31/pin-summary.json` xác nhận browser onboarding 48/48 (47 ca của nguồn trước cùng một ca PERM29 bổ sung), TC18 7/7, SQL 41/41, canary 1/1, operator browser 2/2, unit 1173/1173, tooling 110, build và hai typecheck PASS. TC18 quét 20 scenario/48 artifact, không lộ canary; canary post-test lưu dump/tar đọc được với 67 Auth/1 store/1 Storage object. UI audit 16×3 có 6 cảnh báo cũ ở rail thu gọn, 0 mới, PIN screen 0; ảnh chú thích đã mở kiểm. Ba target PIN dừng, volume giữ. SQL lần đầu 41 assertion PASS nhưng hook cleanup catalog drift; attempt 2 PASS sạch, cả hai receipt giữ.

TC47 browser mock cùng source31 `artifacts/permission-close2-source31/image-payment-browser.json` PASS 1/1: GET ảnh 503/no-store hiển thị placeholder, vẫn xem Latte, thêm giỏ, gửi đơn, thanh toán và thấy receipt. TTL browser t+59/60/61 là phép đo nguồn26 với byte Edge public giống hệt source31 (`65111e…`); đây là bằng chứng lịch sử được gắn nhãn, không gọi là phép đo hosted/source31 mới. T09 source31 và origin fault source31 phủ HTTP conditional/Storage/RPC trực tiếp.

Restore vật lý DB/K/Storage được **tái dùng làm proof lịch sử source25**, không chạy lại trên source31: `candidate-04.json` của CLOSE-2 source25 pin `pg_restore` backup hosted 28/09 vào clone mới và so 74/74, restore K/payload/result 2/2 từ fixture T04 nguồn25 vào DB khác, và restore/readback Storage 2/2 object (814.829 byte) qua API. [Biên bản source25](../../implementation-log/permission-close2-source25-2026-10-13.md) ghi hash, ACL supplement, những lượt FAIL và giới hạn riêng. Các restore này chứng minh khả năng đọc và đối chiếu backup/fixture tại thời điểm đó, không thay thế backup fresh, rehearsal nguồn31 trên hosted, hay proof controller exact77 của CLOSE-3. Candidate source31 khóa tham chiếu lịch sử này riêng với các gate nguồn31.

## Cổng còn lại

Khóa candidate gồm mã nguồn, support, docs và toàn bộ receipt. Hai reviewer độc lập SEC trước, EVC sau phải `APPROVE` exact candidate ở phạm vi riêng. CLOSE-2 chỉ kết luận sau cổng này. CLOSE-3 gồm hosted/provider binding, quota/CDN/cost, exact77 controller, cleanup/activation và owner acceptance vẫn chưa thực hiện.

## Addendum review cuối

[Biên bản review](../../reviews/2026-10-13-permission-close2-source31.md) ghi SEC và EVC đều `APPROVE` exact `candidate-final-03.json` SHA-256 `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492`. Đây là metadata review sau snapshot tài liệu; đoạn “chờ review” phía trên mô tả trạng thái lúc khóa candidate. CLOSE-2 hoàn tất kiểm chứng kỹ thuật local readiness; không phải owner acceptance hoặc phát hành. CLOSE-3 chưa bắt đầu và vẫn dừng theo yêu cầu.

Walkthrough code được cung cấp trong bàn giao cuối theo đường Edge public GET → fallback ảnh ở POS → test runtime/browser. Chưa có phản hồi xác nhận chủ dự án đã đọc hoặc nghiệm thu.
