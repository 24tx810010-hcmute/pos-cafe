# PERM60 cùng candidate — 12/10/2026

Người dùng giao: **“ok vậy chạy PERM60 trên cùng candidate đi, làm tuần tự, xong báo tôi. Cần thì tạo session mới nhé”**. Phạm vi là 27 stage, aggregate `--mode full`, 60 TC và 726 biến thể theo manifest hiện hành; local SQL/Auth/REST/Storage/Edge/Realtime/browser. CLOSE-3 và phát hành nằm ngoài task này.

Main: `D:/Workspace/pos-cafe`, nhánh `main`, HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, có thay đổi chưa commit từ trước. Docs: worktree riêng `D:/Workspace/pos-cafe-docs`, nhánh `docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cũng có thay đổi chưa commit. Giữ các thay đổi đó; không reset/stash/switch/commit/push/deploy.

## Trạng thái hiện tại

**PERM60 source-20 hoàn tất kỹ thuật; SEC và EVC APPROVE.** Fingerprint `00cac9604b03e94b7d20cb34206901c99f30c35ea7ba21119be04c4ef615d412`; [snapshot phục hồi](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-20.json) gồm 808 file và hai deletion markers. Tar SHA-256 `c4428fa7f8298b5ba6cc8c41822a4a2527067663f612d5388d22f15a4546f51d`.

Source-09 là đầu vào đã review TC-PIN-01–09. Delta source-09→20 chỉ ở test/fixture/config và công cụ binding; không đổi `src/` hoặc SQL ứng dụng. [Danh sách 21 file](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source20/source-delta.json) ghi hash trước/sau. Các điều chỉnh khôi phục ACL, precision/timestamp của fixture, parse policy roles, header contract2, role E2E setup và quan sát catalog đúng phase thuộc phạm vi test/tooling được giao.

Source-17 từng có aggregate kiểm hình thức đạt, nhưng candidate DB runner ghi catalog trước setup thay vì catalog đang kiểm. [Receipt đính chính](D:/Workspace/pos-cafe/artifacts/permission-perm60-20261012/source17/provenance-correction.json) loại bộ đó khỏi kết quả cuối. Source-18 gọi observer trên connection fixture sau DDL, gồm transaction chưa commit của clear-demo; kiểm marker/API và hash catalog thực. Đủ 27 stage đã chạy lại cùng source-20; collector xác nhận các suite service không chồng thời gian.

## Bằng chứng và bước tiếp

- [Biên bản execution](../../implementation-log/permission-perm60-2026-10-12.md) ghi stage, source, runtime, lịch sử lỗi, preservation và cách chạy lại.
- T01 legacy database 30/30, bốn stage static/unit 34+4+112+210 và full unit 1.173/build đã PASS source-20. T02/T04 và toàn27 stage đã đạt; aggregate full60TC/726variants exit0. Không dùng source-17 để đủ số.
- Đã thu 27 receipt bằng `collectVerifiedExecution`, kiểm hash observation của candidate DB, kiểm các khoảng thời gian service không chồng nhau, aggregate full chính thức valid=true, errors=[].
- Đã dừng đúng T01 native cluster và 12 container mỗi target T02/T04; giữ volumes/network và bản backup T04 trước PERM60. Metadata3buckets/6objects và bytes18files trùng backup gốc; running0/volumes+networks retained.
- Hai reviewer độc lập, tuần tự đã explicit APPROVE exact candidate-01 SHA-256 `dbfb3f4fe50a6dd44c85b9c8c7468e27419c2642eb824c842d4e215c40e08e83`: SEC contract/security/phase và EVC evidence/coverage/preservation/docs. Không có finding chặn; [báo cáo đầy đủ](../../reviews/2026-10-12-permission-perm60.md). Chỉ metadata review được cập nhật sau approval.
- Walkthrough đã chuẩn bị theo đường manifest → fixture observer → attestation → collector → aggregate; chờ chủ dự án đọc/nghiệm thu. Full PIN19 cùng nguồn, CLOSE-2 cuối và CLOSE-3 còn mở.
