# PROPOSED — quyết định sau diễn tập local, 13/10/2026

**Chưa owner acceptance; không là hosted recipe hay permission.** [Bằng chứng/giới hạn](../implementation-log/permission-backup-lab-2026-10-13.md), [matrix](../implementation-log/permission-backup-lab-matrix-2026-10-13.md). Chưa đủ đóng whole rehearsal coverage; không sửa normative spec/helper/controller trong phiên này.

| Option | Kết quả thực nghiệm | Điều kiện còn thiếu | Đề xuất |
| --- | --- | --- | --- |
| A — online logical B/I, semantic split | Full schema/63tables restore khớp dù sequence327→archive334→389; stable branch cũng khớp; Q sau snapshot bị loại đúng | Exhaustive known/unknown consumer discovery, exact proof version/loader, catalog boundaries; Storage capture riêng vẫn blocked | Tiếp tục hoàn thiện A trong lab. Có căn cứ trình nguyên tắc tách fidelity khỏi no-drift; chưa nhận helper/gate production |
| B — control hẹp cho C/Storage | Scoped locks cho reader, latest recheck bắt Auth outside drift; inflight bootstrap và payload-before-metadata là counterexamples thật | Supported admission+drain của writers ảnh hưởng closure/outsideAuth và Storage; handling K nonempty; conditional deletion/fence/retention | Kết hợp A+B nếu có capability thật. Không mặc định stop mọi provider writer, cũng không hạ full-row equality |
| C — giữ strict stability hiện hành | Lịch sử74/75FAIL giữ; lab chứng minh table locks không freeze sequence và readonly default không là fence | Provider control sequence writers, Storage writers/workers và reader-compatible window chưa có | Giữ BLOCKED nếu owner chọn giữ invariant; không thử grant/ownership/workaround |

Khuyến nghị kỹ thuật hiện tại: **A cho B/I + B cho C/Storage**, nhưng chỉ sau đóng các nghĩa vụ matrix còn thiếu và owner duyệt đổi criteria. Không khuyến nghị mở hosted backup/cutover chỉ từ các kết quả này. L luôn yêu cầu quiescence và reconciliation không mất post-backup transactions; không có “restore cũ để undo” khi Q/K khác.

## Delta tiêu chí để owner xem xét, chưa áp dụng

1. Tách B/I/C/L trong design8.2.1/8.3 và TC53 operating gate. Với B/I, thay **“before=after sequence bắt buộc”** bằng hai điều kiện độc lập: (a) restored value/is_called bằng **SEQUENCE SET lấy từ archive đã hash-bound**, (b) allocation an toàn với **toàn bộ consumers/casts/ranges/constraints đã khám phá và bound**, reject cycle/cache/shared/unknown nếu chưa hỗ trợ. Probe before/after giữ diagnostic; nếu owner vẫn yêu cầu no-drift như policy riêng thì giữ blocker ấy. Không sửa dump/setval để chữa proof.
2. B/I mandatory coverage: exact table/partition/TOC identities; đủ full-row count+digest; roles/ACL/database/extensions/largeobjects và catalog provenance; import cùng exported snapshot; actual clean restore receipt; reject missing/extra/skip/partial/fake/mismatched evidence. Schema/catalog bổ sung ngoài snapshot phải gắn interval riêng và kiểm drift, không gán là cùng snapshot.
3. Storage: cần bytes SHA/size/MIME + metadata identity + version read contract/retention **thực sự có**, hoặc fence/drain đã được chứng minh xuyên capture→recheck→delete. Metadata endpoints, ETag, bucket policy hoặc DB lock riêng không đủ. Original DB metadata và new API metadata phải báo riêng, không claim atomic restore toàn bộ hai target.
4. **Không đổi C**: cleanup+activation cùng TX READ COMMITTED, scoped locks/FK/catalog/latest full-row recheck, giữ66outside và object3. K nonempty đang bị FK chặn; không bypass/delete ledger để có positive. Nếu state sau snapshot thay đổi, abort rồi reconcile/forward-fix trong phạm vi owner giao.
5. **Không đổi L**: `writesQuiesced=true` và no post-backup transaction loss/reconciliation đầy đủ payload/R1/receipt. Canonical assessor chỉ đưa OPERATOR_REVIEW_REQUIRED cho equal observations; không tự grant execution.

## Delta helper/proof cụ thể nếu được giao thực hiện sau này

- New immutable helper/proof version, giữ nguyên helpers/manifest/history cũ. Fields riêng: `archiveFidelity`, `allocationSafety`, `concurrencyObservations`, `coverageComplete`, `catalogProvenance`, `storageCaptureBoundary`; scope79 kèm original77/approved2 provenance và exact hashes. Không thay toàn77 thành79 trong lịch sử.
- Archive reader: TOC identity allowlist, BigInt grammar, exact unique sequence set, type/increment/start/min/max/cache/cycle/owner/default/dependency/function/consumer definitions. Test unknown consumers và cached-session semantics trước khi nhận allocationSafety.
- Loader phải check đúng version, source/runtime/target/input hashes, exact mandatory identity set và actual execution receipts, không chỉ `checks.length>0/all matched`; missing/skip/unsupported không thành PASS. Shadow validator trong lab **không** được import vào controller như production proof.
- Giữ canonical C `verifyBackupDigests` full-row semantics và L private-integrity observer. R/design/R/TC53/traceability/T17–18/F/PIN-T07 references cần thay đồng bộ sau quyết định; không đổi scope60TC/19PIN/forced PIN/DELIVERY03 hoặc tổng lịch sử để nhận PASS.
- Fresh full gates/reviews theo source mới; không tận dụng1173unit/306+110tooling/55PIN/60PERM của source34 làm evidence cho helper mới. Không retro-PASS backup old74/75.

## Quyết định/control cần owner, chưa hỏi window lúc này

1. Có chọn **nguyên tắc split B/I khỏi no-drift** để hoàn thiện spec/helper version mới, hay giữ strict C? Điều này là thay acceptance, không được suy từ “làm local”.
2. Nếu chọn A+B: cơ chế/actor nào thật sự chặn request mới và drain inflight Auth/bootstrap/background Storage, vẫn cho reader? C full-table equality có tác động outside66. Chỉ thu hẹp control khi dependency/impact đã chứng minh; cần object/bucket/project scope được provider hỗ trợ, không giả một kích thước downtime.
3. Nếu baseline hoặc giao dịch mới có K: chọn forward-fix/reconcile và ranh giới dữ liệu cần giữ. Fail-closed FK là evidence, không là quyền xóa immutable ledger. Không thực hiện xử lý dữ liệu live trong phiên này.

**Chưa có duration window đề xuất:** runtime acquisition/drain hosted chưa đo được. Cần receipt cho acquisition, request rejection, inflight/background drained, bounded abort/reopen, lost-ACK reconciliation; sau đó mới đề xuất duration và impacts cụ thể. Không pause project làm mất reader, ALTER provider/terminate sessions, mua dịch vụ hoặc contact provider.

Điểm dừng: owner review proposal → nếu đồng ý thì chốt normative delta và phạm vi hoàn thiện còn thiếu → implementation/review/fresh local proof → chỉ xét hosted backup/cutover khi có quyền/control riêng. Phase2 hosted vẫn BLOCKED và 7 vấn đề upstream vẫn độc lập. Có thể walkthrough sequence timeline → cutover/inflight → Storage → choices; chưa nhận owner đã đọc hoặc chấp thuận.
