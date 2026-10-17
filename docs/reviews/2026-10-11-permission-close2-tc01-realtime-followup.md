# CLOSE-2 — rà soát lát TC01 và Realtime/PERM29, 11/10/2026

## Candidate và phạm vi

- Main HEAD `ef2c372aec60d8362549e47b7aedb27126129479` cộng working tree chưa commit; `permissionFingerprint()` `e381326feee264bf7fcb326ddd3f71534ffd75db28e628591138e5057fbf541a`.
- Snapshot main: manifest SHA-256 `4a270445af6da0d68dcb3c895bd24441737e8fe048bd2397822c01c7057a016a`, tar `a57f786a60203acf2506647d5a3600d8c3a372a5ce481ee0c3774cfc315b1ec1` tại `D:/Workspace/pos-cafe/artifacts/permission-close2-20261011/`.
- Reviewer Realtime kiểm adapter metadata, ứng dụng, unit và PERM29 browser; reviewer TC01 kiểm contract Auth/REST/SQL, traceability và ledger. Cả hai chỉ đọc, không sửa candidate hay chạy mutation fixture đồng thời.

## Findings và xử lý

Reviewer Realtime trả `CHANGES_REQUESTED` ở fingerprint `8dcfc1…`: callback adapter có thể tăng do `SUBSCRIBED` resync, và app chỉ ghi request RPC mà chưa kiểm response/credential. Test hiện tại kiểm counter không liên quan đứng yên theo topic; response phát sinh sau signal phải HTTP 200, `ok:true`, có Bearer/employee token/contract 2. Lượt cold sau đó vẫn FAIL vì store channel `postgres_changes:ok` nhưng không nhận frame; thêm protocol `broadcast.replication_ready`. Hai lượt focused cold PASS khi chờ replication-ready từ một trong hai metadata channel. Sau đó oracle được siết để yêu cầu event `system:ok` trên **đúng store channel** trước mutation; focused warm 1/1 và full cold 46/46 PASS trên candidate cuối. App invalidate toàn bộ protected query cache khi reconnect. FAIL cũ vẫn giữ trong [ledger](../implementation-log/permission-close2-evidence-2026-10-11.md).

Reviewer TC01 phát hiện link testplan cũ trỏ sang PERM29 sau khi thêm code, đã sửa sang dòng 980. Contract hai lớp theo quyết định người dùng: direct SQL thiếu Auth `AUTH_REQUIRED`, REST anonymous HTTP 401/`42501`; test có exact restricted DTO/TTL/invalid PIN/session checks. Đây mới là một biến thể TC01.

## Verdict theo scope

- Realtime/PERM29: **APPROVE** trên main fingerprint `e381326f…`, manifest `4a270445…`; reviewer xác nhận hai oracle gap đã đóng và receipt full 46/46 đúng hash. Verdict không bao gồm 27 stage PERM60 hoặc hosted release.
- TC01/testplan/ledger: **APPROVE** trên cùng main fingerprint và docs manifest `d20a3f48c80ad0c946ae299cfb63cb8c69c095990e4538f1c45c3fe69d2ae937` sau sửa link. Verdict không nhận TC01 toàn bộ hoặc 19 PIN là hoàn tất.

Hai verdict này là rà soát lát cắt, **không phải hai APPROVE cho toàn candidate CLOSE-2**. Các gate còn mở được liệt kê trong ledger; chưa phát hành và chưa ghi chủ dự án đã walkthrough/nghiệm thu.
