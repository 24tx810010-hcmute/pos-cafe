# Review phân quyền — Windows LOCAL,15/10/2026

**SEC và EVC cùng APPROVE** [Windows candidate-01](D:/Workspace/pos-cafe/artifacts/permission-windows-verify-20261015/candidate-01.json), SHA256 `b4f98aa87914b5f5ec980ced0e6cba56c7da79ecac37eb4842940cd762b6129c`,124files/9.866.782bytes, private snapshot tại `D:/Workspace/pos-cafe-permission-verify/review-candidate-01`. Chỉ scope D07/D08: bản cài cách ly, một file smoke test, kiểm LOCAL và báo cáo read-only Supabase. Không full backend/CI/hosted/deployment approval. Metadata verdict dưới đây bổ sung sau freeze, không đổi snapshot.

## SEC — `/root/review_plan_sec`

**APPROVE** đúng SHA trên. Không finding chặn/không chặn. Reviewer kiểm124/124live/snapshot hash/bytes/base/archive;835source entries/canonical/copy và đúng1file test đổi theo D08. Đối chiếu8final receipts cùng manifest/lock, log SHA/counts1173/489/44PASS37SKIP/selftest23; assertions nghiệp vụ giữ nguyên, viewport applicability và portrait regression đúng D08. Đọc UI report/mở4ảnh, đối chiếu sr-only/accessible names. Kiểm allowlistenv/mock/output riêng, NTFS ACL user+SYSTEM, secret-pattern sample;6SELECT là metadata RO và kết luận legacy phù hợp sourcecontract2. Các lỗi setup/monitor và giới hạn dung lượng/quota được trình bày đúng; D06 không bị khôi phục blocker.

Giới hạn SEC: không rerun suite/browser/network/DB/install/mutation; không chứng nhận vắng mọi dạng secret hoặc phép đo shared modules trước chạy bằng một phép đo trước mới. Không full PIN/PERM/HP1/hosted/Vercel hoặc quyền phát hành/cleanup.

## EVC — `/root/review_plan_evc`

**APPROVE** đúng SHA trên. Không finding chặn/đề xuất sửa. Reviewer kiểm124/124hash/bytes,base/HEAD; stream độc lập833/833tar members SHA/bytes, không member thừa/trùng/đặc biệt. Canonical/copy835entries đúng,1file test khác nguồn đầu;38.434files+895links shared modules không drift. Độc lập xác minh30direct và3internal version relations,8final receipts/log/helper revisions và same-source binding. Discovery81/skip rules đúng44PASS37applicabilitySKIP (31cũ+2businessportrait+4rotationlandscape), không xóa business assertions. Đọc report/mở4ảnh,6FP đúng source; giải mã6SELECT raw receipts khớp actorRO/0routines/18tables/10columns/1bucket/12publication. Kiểm158local links tồn tại; lịch sử lỗi/phần chưa chạy rõ.

Giới hạn EVC: không rerun test/browser/install/network/DB/push; không chứng nhận full PIN19/PERM60/HP1/service/CI/hosted hoặc quyền phát hành.

## Kết luận scope

Windows LOCAL được bàn giao; mục tiêu deploy/Supabase đồng bộ chưa đạt. Supabase/Edge/CI/full backend vẫn cần các gate và quyền riêng. Sau hai verdict chỉ đổi metadata status trong log/task/index/kế hoạch và hồ sơ này; source/test/expected/receipts/candidate snapshot giữ nguyên.
