# Review PIN19 + PERM60 source25 — 13/10/2026

## Candidate và phạm vi

[Candidate lock](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/candidate-01.json) SHA-256 `25d887e38411d7a600ec934ff04bcfe3332949a7b5d4e41a35452e168b3c5dd4`, source fingerprint `45e697906e2b366c011eeeace0b9e160781ce8b3811cf770135de04558d02db4`. Main/docs/support/evidence snapshots là phần review; review file này được ghi **sau khi khóa candidate**, không thay đổi candidate. Phạm vi là local PIN19 + PERM60, không gồm CLOSE2 physical restore/metrics, CLOSE3, hosted mutation hoặc release.

## SEC — APPROVE

Reviewer SEC thực hiện trước, chỉ đọc, không chạy suite hoặc sửa candidate. Đã đối chiếu component hashes, 307 evidence index files, fingerprint Windows/WSL; PIN TC18 7/7 với 20 scenario × 11 sink và negative control; PERM60 60 TC/726 mapping/27 run, 23 service intervals không chồng và 13 candidate service cùng binding. T04 reset `--workdir` exit1 và signals attempt1 exit1 được giữ là thất bại, loại khỏi aggregate. Backup, Storage 3 bucket/6 object/18 file và stop proof được kiểm. Signals final fixture40c có 3/3 và hook sạch. Raw `aclHash` của `public.get_next_store_no()` khác giữa attempt lỗi và fixture mới, trong khi observed grants bằng nhau; ghi chú không chặn vì attempt đó bị loại. **Không finding chặn.**

## EVC — APPROVE

Reviewer EVC bắt đầu sau khi SEC kết thúc, kiểm độc lập cùng candidate SHA, chỉ đọc và không sửa candidate. Đã kiểm 16 reference hashes, evidence index307/307, byte từng file trong main/docs/support tar (810/644/48 file; main có 2 deletion markers), source Windows/WSL drift0. Chạy lại aggregate CLI chỉ đọc exit0: 60/60 TC, 726/726 mapping, 27 unique stage, 794 actual tests, không fail/skip/retry/hook; 13 candidate service một binding, intervals không chồng. PIN browser54/54, SQL41/41, TC19 1/1, unit1.173, tooling110, UI16×3 không finding mới và matrix54 rows. T04 reset lỗi và signals attempt1 không có trong 27 stage cuối; reset guard 40b→40c trước candidate service final. Backup dump/tar còn đúng hash; Storage metadata3/6 và 18 payload file khớp; T01 dừng, T02/T04 và ba target PIN stopped12/running0. **Không finding chặn.**

## Kết luận và bàn giao

Hai verdict `APPROVE` áp dụng đúng candidate local đã khóa, thứ tự SEC → EVC. [Execution log](../implementation-log/permission-pin19-perm60-source25-2026-10-13.md) và [task brief](../workflow/tasks/permission-pin19-perm60-source25-2026-10-13.md) chứa walkthrough. Chủ dự án chưa xác nhận đã đọc/nghiệm thu; không suy phê duyệt CLOSE2/CLOSE3/hosted/release từ hai review này.
