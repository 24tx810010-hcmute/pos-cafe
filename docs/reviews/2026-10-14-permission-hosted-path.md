# Review CLOSE3 hosted path — 14/10/2026

Nguồn quyền [task](../workflow/tasks/permission-hosted-path-2026-10-14.md); acceptance/normative [runbook](../runbooks/permission-hosted-path-2026-10-14.md); [evidence/limits](../implementation-log/permission-hosted-path-2026-10-14.md). Sensitive analysis/preparation only; chưa cấp implementation/capture/window/release. Reviewer độc lập không tác giả, chỉ đọc/in-memory/localoffline; không edit/restart/deploy/DB mutation/hosted probe. SEC trước EVC, không đồng thời; cả hai phải APPROVE samefinalSHA. Findings/history giữ nguyên, sửa nội dung phải tạo candidate mới.

| Reviewer | Trọng tâm | Trạng thái trước freeze |
| --- | --- | --- |
| SEC | Authorization, target/scope/privacy, trust/forgeryfailclosed, consumer/C/Storage/lostACK/L controls, privilege/provider claims và action boundaries | Chưa gọi |
| EVC | Năm bước/acceptance, code/spec/currentevidence consistency, official sources, preservation/dependency/replay graph/EVC-R1, portability và claims | Chưa gọi |

Exact manifest/snapshot ở `D:/Workspace/pos-cafe/artifacts/permission-hosted-path-20261014/candidate-01.json` sau freeze. Review APPROVE chỉ hoàn tất khảo sát/thiết kế/gói hành động, không chứng nhận ready hoặc sản phẩm đã phát hành. Metadata verdict sẽ được thêm bên dưới sau review.

## Candidate01 — lịch sử bất biến

SHA256 `351e814e2ea83685f8e2ae25584d86c47814b6c2e11febc2098ea18f0c52e77d`. SEC `/root/sec_hosted_path`: **APPROVE** phạm vi khảo sát/thiết kế/gói bằng chứng. Độc lập rehash1295public+7private, current823source0drift, rawscope79/66/3/33/K0 khớp, frozenofflineverifier1217/2057/10jobs/80commands/34privateargs/64modules0missing; ACLroot và7inputs chỉ currentuser+SYSTEM,27newsupportfiles quét theoactualkey/IDs trongbộnhớ khônghit. Không có finding chặn/khôngchặn SEC. Không DB/browser/network/rehearsal; UI chỉ author-extracted transcript, replay không là fullruntimererun. Không cấp hosted/readiness/release.

EVC `/root/evc_hosted_path`: **CHANGES_REQUESTED**. **EVC-HP-01 (chặn)**: frozen `observe-db.mjs:16` đọc Storagebaseline SHA16961ac9a5e4cc28d155d3599dcad5fec7d5ba3abc40f906141f6820cc3ef60f ngoài1295public/7private và replay02refs. Không tìm thấy equivalent full3metadata baseline trongprivateJSON; hash ngoài gói chưa thay recoverablebytes, nên claim Storageno-drift chưa recompute được từcandidate01alone. EVC đọc gốc/đốichiếu độc lập cho kết quả đúng; finding không phải Storage drift. Scopeapproval SHA362883… **đã recoverable theoSHA** trong2057archive dưới tênkhác.

EVC độc lập kiểm1295/7hashes, replay1217public/2057private/821source+2deletion/10jobs/80commands/34privateargs/64modules0missing;14historicalreceipts tách khỏi80source40/control; rawscope/Auth/Storage/closure/supplement đúng; source8230drift;21officialreceipts200/hash/ranges/patchgraph phùhợp; contract/testmatrix/traceability/HP1–8 giữfailclosed. Không finding chặn khác. Không hostedprobe/runtime/DB/mutation/edit; UI đúng mứcauthor-extraction. Candidate01 chưa qua cổng bàn giao vì EVC-HP-01.

## Xử lý và candidate02 — chờ xác nhận độc lập

Author đã carry exactbaseline+explicitapproval+TLSCA vào privatearchive3inputs/mapSHA; thêm offlinechecker12checks dùng rawobservation+carriedinputs, relocatedPASS và negativesamecountmetadata/forgedhashdrift bị reject. [Biên bản sửa](../implementation-log/permission-hosted-path-2026-10-14.md#candidate01-review-và-sửa-evc-hp-01). Candidate01/oldarchive/source40 khôngđổi. Candidate02 sẽ pin các phần này; SEC rồi EVC phải APPROVE cùngSHA mới và EVC xác nhận CLOSED finding, không dùng verdict candidate01 thay cho candidate02.

## Metadata verdict cuối — candidate02, 14/10/2026

Exact candidate02 SHA256 **`2328fd05976ddf916fc782bf874c42c9720d4c041a7bab4276d80e19911f7013`**, `D:/Workspace/pos-cafe/artifacts/permission-hosted-path-20261014/candidate-02.json`. **SEC và EVC đều APPROVE cùng SHA. EVC-HP-01 CLOSED.** Hoàn tất task khảo sát/thiết kế/gói chuẩn bị được giao; không hoàn tất sản phẩm hoặc cấp quyền bước hosted tiếp theo. Các mục chờ candidate02 ở trên là checkpoint lúc freeze, giữ lịch sử.

SEC `/root/sec_hosted_path` APPROVE candidate02 sau rehash1303public+8private,7privatecũ/candidate01khôngđổi; đọc14filedelta chỉcarry/checker/receipts/docs, khôngđổiscope/gate/source40. Frozenchecker12/12PASS từraw+archive khôngoriginalpaths; archiveexact3input, ACLcurrentuser+SYSTEM. Quét14publicdelta theoactualkey/IDs trongbộnhớ vàmẫucredential khônghit; ràcode/receiptnegative, khôngchạywrapperghi. KhôngfindingSEC. KhôngDB/network/browser/mutation/restart/runtime/payloadvalidation.

EVC `/root/evc_hosted_path` APPROVE toànphạmvi candidate02 và xácnhận **EVC-HP-01 CLOSED**: exactStoragebaselinebytes đãcarryprivate, mapSHA/size, checkerchỉđọcarchive/rawđãghi. Độc lập1303public+8privatehashsizekhớp;14filedelta khôngnớigate/quyền; frozencheckerexit0/12checks; tự chạynegative trongbộnhớ thaymetadata giữcount vàgiảhashrefs/drift=false→RECORDED_OBSERVATION_MISMATCH, khôngghifile. Rawgốc/candidate01/source40/replay/inputscũ khôngđổi, kếtquảreviewvòngtrước cho phần khôngdelta tiếp tụcápdụng. KhôngfindingEVCcònchặn; khônghostedprobe/payload/runtime/DBsuites.

Hai approval chỉ cho **khảo sát/thiết kế/chuẩn bị**. executionReady/cleanupEligible/coverageComplete/productComplete đềufalse; supportedhostedprofile/control vàconsumer/actor/recovery/envEdge/dependency/releasegates cònBLOCKED. STOP báoowner trướcimplementationmới/backup/capture/maintenance/cutover/deploy; no-push giữnguyên. Metadata này được thêm saufreeze theo ngoại lệworkflow, không đổi snapshot/expected/proof hoặc candidate01/02. Walkthrough đãcungcấpđườngđọc, chờowner; chưaxácnhậnđãhiểu/nghiệmthu.
