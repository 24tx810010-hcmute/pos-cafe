# Review độc lập — CLOSE-2 TC-PIN-01–09, 12/10/2026

## Candidate được duyệt

- Main `source-09`: manifest SHA-256 `5a8d067c309553dc040ccde43a2de414eb6d981ecf74c162982e7cf0210a8107`; tar SHA-256 `9c8c18be929e89fa2cd668f62ec538874dedde6f86ef58f8d384b8cc7660a5cf` (806 file hiện có, 2 deletion markers).
- Docs `source-03`: manifest SHA-256 `f22743c3cf691e0c86816de42b80e728e3ce1afd01816e7960ccf7cb27b1c13e`; tar SHA-256 `927d3c84e0e616a6aea5f13d0c85099139533f541b9fcb5635709cfe92cdb740` (630 file).
- Browser safe receipt SHA-256 `6706c1275372faccac64b70512b9212cd0328e9c48c212c4c423189a8677d2a8`: TC01–09 **10/10**, 0 fail/retry/missing/fatal. SQL safe receipt SHA-256 `d14e196a04a0be4124ed3625919962db1f3160747ec9d9a10dff8f0bdb1cf645`: **41/41**, 0 error/hook error. SQL actual-options SHA-256 `288e6e6e121e49c8e1185d16bbc3161519efb8d9a4ad65986c5a98e0b630a9f4`: 41 `run/passed`, retry0/repeats0/fails0.

## Reviewer, phạm vi và verdict

| Reviewer | Phạm vi độc lập | Verdict trên main source-09/docs source-03 |
| --- | --- | --- |
| `pin_security_review` | SQL race/authorization, server invariant, TC02 cache transition và xử lý các blocker đã báo | **APPROVE**; không còn finding chặn. Không tự rerun DB/browser. |
| `pin_evidence_review` | Ma trận TC01–09, traceability, tính toàn vẹn snapshot/receipt, độ chính xác của lời kết luận và giới hạn | **APPROVE**; không còn finding chặn. Kiểm đủ manifest/tar/current entries, receipt/options; không xem raw/private hay review server security. |

## Findings đã xử lý

1. **Chặn, TC08 hai completion ordering:** source-08 thả hai waiter cùng lúc, chỉ chấp nhận một winner bất kỳ. Source-09 queue `first` rồi `second` và chiều ngược lại với barrier, assert winner/loser/session/audit/registry/signal; cả hai case thực thi PASS trong SQL41.
2. **Chặn, TC02 normal cache→recovery:** source-08 dựa vào TC16 lịch sử, không có exact-source scenario; TC16 cũng reload trước restricted login nên không chứng minh cache trong memory. Source-09 có browser scenario normal floor loaded → recovery thật → login restricted, request observer đặt trước recovery, assert AppShell/floor vắng và không có RPC dữ liệu/quyền được theo dõi.
3. **Chặn bằng chứng, late S1:** vòng `requestAnimationFrame` không xác nhận route cũ kết thúc. Source-09 đợi route settle; docs ghi rõ request có thể bị hủy khi đổi quán, còn unit generation kiểm callback thực sự đến muộn. Lượt đầu dùng `waitForResponse` bị timeout và browser safe FAIL 3/10; kết quả này giữ trong lịch sử, không ghép vào PASS cuối.
4. **Chặn tính chính xác tài liệu, URL probes:** reviewer bằng chứng ban đầu không thấy vòng lặp động. Sau đối chiếu source-09, reviewer xác nhận vòng lặp `pos/admin/report/print` có URL/back assertions và rút finding. Docs nói rõ app không có URL router, nên probe chỉ kiểm gate chứ không chứng minh route độc lập.
5. **Đề xuất không chặn, tên bộ đếm RPC:** docs source-02 ghi “protected RPC count0” trong khi observer không đếm revision revalidation. Docs source-03 sửa thành “RPC dữ liệu/quyền được theo dõi count0”, ghi rõ loại trừ revision; reviewer bảo mật xác nhận lại **APPROVE**.

Hai review chỉ duyệt lát TC01–09. PERM60, aggregate 19 PIN, CLOSE-3, hosted/release và xác nhận walkthrough của chủ dự án vẫn mở. Bản ghi này là metadata kết quả review sau docs source-03, không thay code/expected/kết luận đã được review.
