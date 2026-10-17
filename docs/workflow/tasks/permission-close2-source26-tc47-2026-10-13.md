# CLOSE-2 source-26: sửa fault ảnh TC47 — 13/10/2026

## Giao việc và nguồn

Tiếp tục CLOSE-2 sau [source-25 restore/metrics](permission-close2-source25-2026-10-13.md), dừng trước CLOSE-3. Review SEC trên candidate-04 source-25 `APPROVE`, EVC `CHANGES_REQUESTED` vì thiếu browser ảnh lỗi→payment, lỗi origin/TTL và phản ví dụ conditional304 khi Storage lỗi. Không đổi requirement/expected; sửa implementation và bổ sung phép thử. [Biên bản kỹ thuật](../../implementation-log/permission-close2-source26-tc47-2026-10-13.md) ghi attempt lỗi và kết quả mới.

## Source và trạng thái trước review mới

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, đều dirty. Source-26 manifest/tar ở `artifacts/permission-pin-identity-close1/source-26.{json,tar}`, fingerprint `9cf0b0dde7b5b01c6166adeb4deb5f69f6c30b86558959d8d269bb2b6ef64449`. Delta so source-25 đúng hai file: `supabase/functions/menu-image-public/index.ts` chuyển Storage download trước conditional304; `tests/contracts/permissionImagesRuntime.contract.test.ts` thêm fault 503/no-store cho GET thường và conditional. 810 file hiện diện, hai deletion marker như cũ. App/frontend, SQL, PIN và PERM case khác byte-identical theo manifest; không suy điều đó thành aggregate source-26 tự động.

Focused verification: build/typecheck exit0; unit1.173/1.173; browser desktop mock 1/1 với ảnh GET503→placeholder→chọn Latte→gửi đơn→payment/receipt; runtime Edge/Storage local fault 9 response samples, Node thường/conditional503 no-store, browser t0+59/60/61s đều503 no-store và CDP không dùng disk cache sau TTL. Browser t+59 đã revalidate sớm theo HTTP cache, không phải yêu cầu phục vụ 200 đủ chính xác59 giây. Binding fixture hoàn tác, T04 và ba restore target dừng, năm volume giữ. Provider invocation/quota/CDN/cost vẫn không quan sát được local.

Gói full PIN19/PERM60 27 stage/60TC/726 variants đã PASS trên **source-25** và hai review trước APPROVE đúng gói đó. Source-26 chưa có strict aggregate 27 stage trên fingerprint mới; hồ sơ delta và focused verification được gửi reviewer đánh giá phạm vi tái dùng bằng chứng độc lập theo workflow. Nếu gate cùng nguồn bắt buộc chạy lại toàn bộ, CLOSE-2 vẫn mở cho đến khi dựng target mới và chạy, không reset dataset T04 giữ lại để lấy PASS. Source-26 chưa có hosted capability/binding, exact77 controller, cleanup/activation hoặc owner acceptance; đó là CLOSE-3. Không stage/commit/push/deploy.

**Review SEC candidate-01:** `CHANGES_REQUESTED` đúng SHA `f08194f5f936fb995b7d173e833b47eafd0de49a8a0bc3dd0894825fb7a74ea6`. Hai blocker: source-26 thiếu PIN19 và PERM60 full cùng fingerprint cuối; TC47 thiếu runtime RPC/DB fault. Không gửi EVC vòng source-26 trước khi giải quyết SEC. Phép đo bổ sung sau candidate-01 `gateway-fault-01.json`: trên T04 cô lập, tạm thu hồi `EXECUTE` của `service_role` cho lookup RPC, GET thường và conditional đều `503`/`no-store`/`IMAGE_GATEWAY_UNAVAILABLE`; ACL, toàn hàng menu, metadata Storage giữ nguyên, 12 container dừng và Edge source25 được phục hồi. Đây là bằng chứng bổ sung lịch sử, chưa biến candidate-01 thành PASS hoặc thay thế aggregate.

## Việc tiếp

Khóa candidate source-26 gồm app snapshot, delta, docs, support/receipts và kết quả nguồn. Hai reviewer SEC và EVC kiểm tuần tự cùng candidate cuối; chỉ sau hai `APPROVE` và không còn gate bắt buộc thiếu mới gọi CLOSE-2 hoàn tất kỹ thuật. Nếu review xác định strict aggregate source-26 là bắt buộc, tạo target mới cách ly và chạy lại; không sửa/đổi nghĩa gate hay dữ liệu giữ lại.
