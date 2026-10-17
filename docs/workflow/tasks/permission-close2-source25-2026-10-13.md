# CLOSE-2 phân quyền trên source-25 — 13/10/2026

## Phạm vi được giao

Chủ dự án yêu cầu tiếp tục tuần tự sau PIN19→PERM60 source-25, hoàn thiện CLOSE-2, báo từng phần và dừng trước CLOSE-3. Bàn giao phiên trước khóa [PIN19/PERM60](permission-pin19-perm60-source25-2026-10-13.md). Không reset/stash/switch/stage/commit/push/deploy, không mutation hosted, không ghi đè dataset local giữ lại. Review độc lập hai phạm vi, tuần tự.

## Acceptance và trạng thái trước review

| Cổng | Kết quả có căn cứ | Giới hạn |
| --- | --- | --- |
| Cùng nguồn PIN19/PERM60 | Source-25 fingerprint `45e69790…`, PIN browser54/54, SQL41/41, canary1/1, unit1.173, tooling110, build/typecheck, UI selftest23/audit16×3/0 mới; PERM60 27 stage,60/60 TC,726/726 variants. Hai review trước APPROVE đúng candidate PIN/PERM. | Dùng lại đúng source-25, không chạy lại full suite để tạo số mới. |
| Restore DB thực | Backup hosted 28/09 được nạp vào **container mới** network-none/không port; ACL supplement đã được review áp trên bản restore; so74/74 dữ liệu/catalog/sequence/metadata đạt. 77 stores,143 Auth users,3 Storage metadata; `postgres` NOSUPERUSER/BYPASSRLS. | Backup lịch sử, không phải backup fresh live; lượt trước supplement 72/74 FAIL giữ nguyên. |
| Restore K/payload/result | Fixture T04 source-25 được `pg_dump -Fc` rồi restore sang container mới khác; 2 write operations với K/payload/result,4 orders,2 payments và full-row hashes của bốn bảng khớp. | Restore fixture này dùng `--no-owner --no-acl`; quyền/ACL do phép restore 77-store kiểm riêng. Không suy phục hồi giao dịch live phát sinh sau backup. TC53 source-25 chặn restore cũ khi có Q mới và diễn tập forward fix. |
| Storage payload | Hai object backup814.829 byte upload/download qua Storage API vào bucket rehearsal mới, SHA/MIME/size khớp; đã xóa đúng bucket tạm. Ba bucket/sáu object và18 file payload ngoài scope khớp baseline. | Metadata gốc đối chiếu ở DB restore; bucket rehearsal có metadata mới trong thời gian thử. Không phải cleanup hai object hosted. |
| Gateway/cache | Edge ba file bytehash khớp source-25; GET200/conditional304/404 và browser fresh/fresh-cache/quá TTL đã đo HTTP local. Cache private60s+ETag; lỗi404 no-store. Hai browser cache hit; revalidation sau TTL có network event. | Provider invocation/quota/CDN/SLA/cost không quan sát được từ local; không hứa giới hạn lưu lượng. Browser nhận byte cache trong TTL sau unlink là hành vi thiết kế. UI placeholder/add-item unit đạt; payment flow đạt ở test khác, chưa có một browser case ghép ảnh lỗi→payment. |
| Bảo toàn/teardown | Binding tạm đã gỡ; T04 12 container và ba restore targets dừng; volumes giữ, network T04 attachments0; WSL keepalive riêng dừng đúng PID. | Lượt T09 fixture từ pha44 bị từ chối; hai lượt metric đầu lỗi được giữ, không tính PASS. |

## Ranh giới và bước tiếp

CLOSE-2 là kiểm chứng kỹ thuật cách ly, chưa phải phát hành. [Biên bản](../../implementation-log/permission-close2-source25-2026-10-13.md) và candidate lock chứa đường dẫn/hash receipt. Hai reviewer SEC và EVC phải APPROVE đúng candidate cuối trước khi gọi CLOSE-2 hoàn tất kỹ thuật; chưa có owner acceptance. CLOSE-3 còn fresh hosted binding/capability/backup, exact77 locked cleanup+empty activation, Storage API journal đúng hai object hosted, backend/Edge/config→frontend, postflight live và owner walkthrough/acceptance. Controller exact77 đã có runtime diagnostic lịch sử trên clone với hai augmentation quyền; source-25 thêm provider guard, nên không dùng diagnostic đó để chứng minh hosted actor hoặc source-25 live controller. Nếu rehearsal exact source-25 trở thành điều kiện release, làm trong CLOSE-3 trước mutation live.

Không thay requirement hay expected. Không gọi archive listing/logical snapshot là physical restore; hai restore DB ở trên có `pg_restore` thực và so dữ liệu trên đích mới. Không restore backup cũ lên nơi có Q mới. Dừng tại đây sau review CLOSE-2, báo chủ dự án rồi mới sang CLOSE-3 theo yêu cầu.

## Kết quả review candidate-04 và chuyển source

SEC `APPROVE` candidate-04 source25 SHA-256 `451a10c77b1b59839aaf1e929596e814c70cbd5bfadb5540c8067949f84bb270` cho restore/K/Storage/preservation. EVC `CHANGES_REQUESTED`: thiếu browser flow ảnh lỗi→payment, origin fault/biên TTL và phát hiện conditional304 khi Storage lỗi. Vì vậy candidate này **không đóng CLOSE-2**. [Bàn giao source26](permission-close2-source26-tc47-2026-10-13.md) ghi sửa code và evidence mới; các kết quả trên giữ đúng lịch sử source25.
