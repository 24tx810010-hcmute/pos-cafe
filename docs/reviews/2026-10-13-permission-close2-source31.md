# Review CLOSE-2 source-31 — 13/10/2026

Candidate cuối `artifacts/permission-close2-source31/candidate-final-03.json`, SHA-256 `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492`; source fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`. Hai subagent độc lập, read-only, kiểm tuần tự SEC rồi EVC. Không reviewer nào sửa candidate, chạy mutation stateful/hosted hoặc deploy.

## SEC — auth, TC47, bảo toàn dữ liệu và ranh giới release

SEC `CHANGES_REQUESTED` candidate-final-01 SHA `3d7ee2faf523098a642979e31f88986c4714f959d6d61b5986e56587cf3477f8`: SEC-01 là manifest thiếu hash của `tc18-attempt-01/artifact-scan-safe.json` và `browser-safe.json`; summary PIN19 đã đọc hai file này nhưng chưa khóa nguồn quyết định. Tác giả tạo candidate-final-02 SHA `77a72cb27f03365966002dc907181035a9162306c810cb004ac6023fa5f08d95`, pin path/bytes/SHA hai receipt và kiểm lại 48 artifact indexed. SEC kiểm 49 reference candidate, 62 support, 12 docs và 48 artifact, không mismatch; `APPROVE` candidate-final-02.

Sau delta tài liệu, SEC kiểm candidate-final-03: 55 reference trực tiếp, 12 tài liệu live và trong tar đều khớp; đúng năm tài liệu thay đổi, source/receipt/support/historical không đổi. SEC `APPROVE` exact SHA cuối. Không có finding chặn mới về T09, TC47 `503/no-store` thường/conditional, ACL/data hồi phục, Storage preservation hoặc teardown. Reviewer không chạy lại suite stateful/hosted. Hosted release và owner acceptance thuộc CLOSE-3.

## EVC — tính đủ và nguồn gốc chứng cứ

EVC `CHANGES_REQUESTED` candidate-final-02: ba đầu mối hiện hành (implementation-log README, hai OpenSpec tasks) còn để source26 ở đầu; handoff/log source31 chưa ghi rõ restore DB74/74, K/payload2/2, Storage2/2 là proof lịch sử source25 trên runtime riêng. Tác giả cập nhật đúng năm file docs và khóa snapshot tài liệu r2 trong candidate-final-03; không đổi source, support hoặc test receipts.

EVC kiểm candidate-final-03: manifest/tar docs 12 file khớp, năm delta đúng size/hash, 108 liên kết tương đối tồn tại, source31 810 file và hai deletion marker khớp. Trước đó EVC đã đối chiếu 27 report, raw 60 TC/726 variant PASS không skip/retry/xfail, service suite tuần tự; PIN browser48/48, TC18 7/7, SQL41/41 attempt sạch, canary/operator/unit/tooling/build/typecheck; T01/T02/T04 preservation và stop. EVC xác nhận finding docs đã đóng và `APPROVE` exact SHA cuối. Reviewer không chạy lại suite stateful, hosted mutation hay tự xem từng ảnh UI audit.

## Xử lý finding và kết luận

| Finding | Cách xử lý | Reviewer xác nhận |
| --- | --- | --- |
| SEC-01: TC18 safe receipts chưa khóa | Candidate-final-02 pin hai SHA và scan 48/48 raw artifact hash; candidate-final-03 giữ nguyên | SEC `APPROVE` candidate-final-02 và -03 |
| EVC-01: checkpoint tài liệu/source25 restore provenance chưa rõ | Candidate-final-03 cập nhật ba đầu mối, handoff và log; docsDelta đúng năm file | EVC `APPROVE` candidate-final-03 |

**Verdict cuối: SEC `APPROVE`, EVC `APPROVE` exact candidate-final-03.** CLOSE-2 hoàn tất kiểm chứng kỹ thuật **local readiness** trong phạm vi đã giao. TTL 59/60/61 là bằng chứng lịch sử nguồn26/runtime hỗn hợp; browser ảnh lỗi→payment chạy mock, còn Storage/RPC origin fault chạy runtime T04. Restore source25 là proof lịch sử trên các runtime cách ly, không phải backup fresh hoặc restore source31. Provider invocation/quota/CDN/cost, hosted binding/cleanup/activation, exact77 release controller và owner acceptance chưa thực hiện; CLOSE-3 chưa bắt đầu. Không suy kết luận local thành phát hành.
