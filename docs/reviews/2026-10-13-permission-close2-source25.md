# Review CLOSE-2 source-25 candidate-04 — 13/10/2026

Candidate [candidate-04.json](D:/Workspace/pos-cafe/artifacts/permission-close2-source25/candidate-04.json) SHA-256 `451a10c77b1b59839aaf1e929596e814c70cbd5bfadb5540c8067949f84bb270`. Hai reviewer độc lập, tuần tự; không sửa candidate. Kết quả này là lịch sử và **không đóng CLOSE-2**.

| Reviewer | Phạm vi | Verdict |
| --- | --- | --- |
| SEC | Restore DB lịch sử, ACL/actor, K, Storage payload, preservation, release boundary | `APPROVE` candidate-04; 33 evidence references,28 support,6 docs rehash không mismatch. Restore74/74 sau ACL, K2/2, Storage2 object/814.829B, targets dừng. Không chạy lại stateful/hosted. |
| EVC | Source binding, TC47/cache/consumer, coverage và claims | `CHANGES_REQUESTED` candidate-04; hash source/docs/support/evidence khớp, nhưng ba finding chặn TC47 dưới đây. Không chạy stateful/hosted. |

EVC-01: [testplan TC47](../../openspec/changes/redesign-permission-model/testplan.md) yêu cầu ảnh GET lỗi vẫn đặt món/payment; unit placeholder→onAddItem và E2E payment thường tách rời không chứng minh luồng ghép. EVC-02: chưa inject gateway/DB fault runtime và kiểm 503/no-store/stale cache. EVC-03: thiếu quan sát biên59/60/61s. Khi sửa EVC-02, fault Storage trên code nguồn25 còn bộc lộ conditional304 trước Storage download, trái design no-store khi lỗi. Không hạ gate; [source26](../implementation-log/permission-close2-source26-tc47-2026-10-13.md) chứa fix/evidence mới.

SEC đề xuất không chặn: gọi rõ đây là phục hồi archive logic bằng `pg_restore`; DB backup 28/09 và Storage backup 22/09 không phải một snapshot đồng thời. Không suy proof local thành quyền actor/cleanup hosted.
