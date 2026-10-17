# Sửa oracle TC18 sau review source-20 — 12/10/2026

## Phạm vi được giao

Chủ dự án trả lời **“ok làm đi”** sau báo cáo hai finding SEC-01/SEC-02 và đề xuất sửa trên candidate mới, thêm đối chứng, chạy và review tuần tự. Giữ source-20 snapshot và kết quả FAIL lịch sử. Không phát hành hoặc sang CLOSE2 trong task này.

Đầu vào: [review source-20](../../implementation-log/permission-pin19-source20-review-2026-10-12.md), [handoff](permission-pin19-source20-2026-10-12.md), [testplan](../../../openspec/changes/force-default-pin-change/testplan.md). Main tại HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs tại `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; cả hai dirty sẵn. Đã đối chiếu 810 entry source-20: drift 0 trước sửa. Không switch/reset/stash/commit/push.

## Thứ tự và tiêu chí

1. SEC-01: quét chính PIN đã gửi trong ca `complete:denial`; đối chứng chèn PIN đó vào từng sink phải bị từ chối bằng mã cố định.
2. SEC-02: đọc và quét bytes/nội dung các file artifact đã ghi; quét log và reporter sau khi runner kết thúc; missing/unreadable phải FAIL. Đối chứng artifact thực có PIN phải bị bắt, không in PIN hoặc payload ra báo cáo.
3. Khóa candidate mới; chạy TC18 trên target local 599xx đã guard, một worker/no retry; postflight/stop giữ volume và network. Chạy typecheck và tooling liên quan. Không gắn receipt source-20 thành kết quả chạy của source mới.
4. Hai reviewer không tham gia viết, lần lượt security/oracle và evidence/preservation/docs, cùng candidate cuối. Chỉ báo slice hoàn tất khi cả hai APPROVE; tình trạng full PIN19/PERM60 và phần chưa chạy phải tách rõ.

## Trạng thái

Đã sửa SEC-01/02. Source-21/22 giữ ba lượt FAIL chờ applied-event. Source-23 thêm probe direct-client metadata trước credential mutation: TC18 **7/7**, matrix20×11, scan48, tooling28/28 và hai typecheck PASS; postflight zero, ba target stopped12/running0 giữ volume/network. Không đổi `src/`/SQL; snapshot source-20 giữ nguyên. [Biên bản/source/evidence/lịch sử](../../implementation-log/permission-pin-tc18-oracle-fix-2026-10-12.md). Đang chờ hai review tuần tự cùng candidate cuối. Đây là slice TC18; full PIN19/PERM60 source mới chưa chạy, không ghép kết quả source-20. Walkthrough đã chuẩn bị, owner chưa xác nhận đã đọc/hiểu hoặc nghiệm thu.

**Checkpoint hiện hành:** security candidate-01 CHANGES_REQUESTED với SEC-03 numeric PIN. Source-24 tooling FAIL array length (browser riêng PASS) giữ lịch sử; source-25 sửa numeric/BigInt/leading-zero và bỏ array length nội bộ, tooling40/40/typechecks0/browser7/7/matrix20×11/scan48/postflightzero/stop0. [Checkpoint cuối](../../implementation-log/permission-pin-tc18-oracle-fix-2026-10-12.md#checkpoint-cuoi-sau-sec-03--source-25) là nguồn hiện hành; đang chờ security re-review rồi evidence trên candidate-02. Chưa full PIN19/PERM60 source-25, CLOSE2 hoặc release.

**Review hiện hành:** security APPROVE candidate02/03; evidence candidate03 CHANGES_REQUESTED duy nhất EVC-01 anchor. Đã thêm anchor cho link findings source20, không đổi kết luận FAIL lịch sử, main25/receipts giữ nguyên. Chờ hai reviewer xác nhận candidate04; [ledger](../../implementation-log/permission-pin-tc18-oracle-fix-review-2026-10-12.md) giữ verdict/giới hạn từng vòng.

**Metadata review cuối:** security/oracle và evidence/preservation/docs đều **APPROVE candidate04**, SHA-256 `8b3c3b362a3cba278abaa005c187341cb48255db3ea9c07f6c95e311727f46ad`; SEC-01/02/03/EVC-01 đóng trong scope. [Verdict/kiểm/giới hạn](../../implementation-log/permission-pin-tc18-oracle-fix-review-2026-10-12.md). Owner chưa xác nhận walkthrough/nghiệm thu. Full PIN19/PERM60 source25, CLOSE2/CLOSE3/release chưa được verdict này đóng; báo kết quả TC18 trước bước tiếp theo.
