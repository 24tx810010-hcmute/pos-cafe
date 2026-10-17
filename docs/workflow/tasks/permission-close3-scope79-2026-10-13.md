# CLOSE-3 — chốt phạm vi 79 quán, 13/10/2026

**Phạm vi đã khóa; chờ hai review độc lập. Release vẫn BLOCKED.** Task nhạy cảm, chỉ giải quyết điểm chặn phân loại hai quán mới. Kết quả, giới hạn và cách kiểm lại: [biên bản](../../implementation-log/permission-close3-scope79-2026-10-13.md); [review](../../reviews/2026-10-13-permission-close3-scope79.md).

## Quyền và quyết định

**DELIVERY-03-NEW79 — chấp nhận ngày 13/10/2026.** Nguồn trực tiếp là câu trả lời người dùng **“Cả hai là quán test có thể cleanup”**, cho câu hỏi nêu rõ hai quán ngày10/10 và12/10 ngoài77 UUID. Đã đọc lại bằng `read_thread` trong chat `01a11fff-6130-7de2-aa08-8b42afd1a543`, turn `01a13459-7e6f-7752-a8cf-289bdcacd2cc`, user message `01a13459-7e96-7ca1-b564-d4928a34414d`, question `call_l3yio6yIqYvxPa7ROhCoxOL8`. Handoff chuyển tiếp ghi nhận quyền này, không tạo quyền mới.

Quyết định bổ sung **đúng hai UUID** trong `outside` của checkpoint private SHA `1d3378aba00bf468d4a771eff2e4fd124599e205a47cf62d1b2311fe16f0032b`; ngày tạo chỉ giúp người dùng nhận diện, không dùng chọn UUID. Hợp với77 UUID từ inventory gốc SHA `f231f4bc811d2d0551a2e3f4c23ff87696f9e9ede832c2c2f162073ee8a15af0` thành79. Giữ DELIVERY-03 ngày22/09 như lịch sử; không đổi receipt đã FAIL. Lý do: người dùng phân loại hai quán là TEST và quy trình activation yêu cầu tenant rỗng. Hệ quả sau cleanup được phép trong phiên phát hành riêng: dữ liệu test thuộc closure được xác minh của hai quán cũng bị xóa. Không cấp quyền với quán mới khác,66 Auth ngoài scope, project/schema/provider settings hoặc object thứ ba.

Phương án đã cân nhắc: giữ phạm vi77 sẽ còn hai tenant và không đáp ứng activation rỗng; mở scope theo live count sẽ xóa vượt quyền; chọn exact77+exact2 bảo đảm quyết định có provenance và có thể kiểm lại. Owner không được hỏi lại quyết định đã chốt. Phiên này chỉ lập phạm vi, đọc target và kiểm local; **dừng trước kiểm quyền/cấu hình deployment và controlled rollout**, không backup mới hoặc hosted cleanup/prepare/DDL/DML/Auth mutation/Storage delete.

## Đầu vào và acceptance

- Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. Không reset/stash/switch/stage/commit/push/deploy.
- Source31 có812 entries, fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`, bundle `36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70`. Không đổi source ứng dụng/test/controller/config; support scripts riêng có snapshot/hash riêng, không nhận PASS PIN19/PERM60 thay chúng.
- Acceptance: exact union77+2; Auth/FK xác minh, ngoài scope giữ; Storage chỉ exact2 gốc; manifest có provenance và validation local/negative; old backup/sequenceFAIL vẫn bị từ chối; hai reviewer SEC rồi EVC APPROVE exact candidate. Không yêu cầu provider rehearsal trong slice này.

## Kết quả và bàn giao

Manifest private `C:/Users/nguye/AppData/Local/pos-cafe-release/close3-scope79-20261013/scope79-approval.json`, SHA `362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8`. Đây là **scope approval only**, không phải inventory/proof/config controller. [Receipt an toàn](D:/Workspace/pos-cafe/artifacts/permission-close3-scope79-20261013/scope79-safe.json).

Read-only lúc **08:28:33Z (15:28:33 Bangkok)**:79 stores/145 Auth, đủ79 Auth gắn store qua FK validated `stores.id→auth.users.id ON DELETE CASCADE`;66 Auth còn lại giữ ngoài scope.33 closure relations/FK hash và count11 bảng của hai quán khớp checkpoint.3 object metadata khớp; object thứ ba có prefix/owner/owner_id ngoài79, không có FK tới Auth/store. Giữ nguyên object đó; hai object lịch sử giữ exact bucket/path/version/size/SHA. Không tải payload lần này, không đo full-row drift lần này.

Local validation **18/18**: union đúng chỉ qua scope gate; thiếu/thêm/đổi UUID, path/hash/provenance, gốc77, Auth ngoài79, object3 và đổi eligibility đều bị từ chối. Actual source31 loader từ chối scope-only manifest, backup bảo toàn thật và comparison sequenceFAIL thật (ca cuối dùng envelope synthetic để tới nhánh restore; không tạo proof thật).812 source entries drift0.

**Các gate còn mở:** quyền deploy, env của deployment tiếp theo, controlled Vercel rollout; quiescence/backup mới strict75/75; fresh full-row/catalog và locked recheck79; helper backup mới pin manifest79; provider/NOSUPERUSER rehearsal và recovery; release review; hosted postflight; owner acceptance. Không dùng backup13/10 `cleanupEligible=false` cho cleanup, không nâng74/75 thànhPASS. Không chạy full suite lại chỉ để đổi scope docs. Phiên không khởi động Docker/WSL/browser; không có tài nguyên mới cần teardown.

Sau review, báo đã chốt phạm vi rồi **STOP trước bước quyền/cấu hình deployment**. Hướng dẫn đọc đã cung cấp theo chuỗi authorization→manifest→negative guards→gate còn mở; chưa có phản hồi owner xác nhận đã đọc/hiểu hoặc nghiệm thu.


**Metadata review NEW79 ngày13/10/2026:** SEC rồi EVC cùng APPROVE exact candidate-01 SHA `d4ac17c0be198bd2725a9afb9e1ab183d83622995c4acfd156b09fbb373823de`; [verdict](D:/Workspace/pos-cafe-docs/docs/reviews/2026-10-13-permission-close3-scope79.md). Gate bàn giao scope79 đạt; các dòng/checklist chờ review là trạng thái lúc khóa snapshot. Chỉ bổ sung metadata review, không đổi candidate; release vẫn BLOCKED và STOP trước quyền/cấu hình deployment.
