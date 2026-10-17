# CLOSE3 — chốt đường chạy hosted, 14/10/2026

Trạng thái lúc mở: đang khảo sát/thiết kế; hosted backup/cutover và sản phẩm vẫn BLOCKED. Mức nhạy cảm vì hồ sơ định nghĩa gate dữ liệu/quyền.

## Nguồn quyền và đầu ra

User tại chat cha `01a1393e-c03e-79a2-a20e-3ecfaaf241ad`, ngày14/10/2026 Asia/Bangkok: **“ok làm task CLOSE3 chốt đường chạy hosted theo đề bài đi, làm tuần tự và không push nhé. Xong báo tôi trước khi sang backup/cutover, cần thì tạo session mới.”** Chat thực hiện `01a13953-8244-7461-9ccb-a48d5031a5e8` được tạo từ ủy quyền đó. [Đề bài đã review](permission-closeout-next-task-2026-10-14.md#task-đề-nghị-tiếp-theo), candidate02 SHA `c273f7826ac8dd512b70d1881ed0545aeeee4e752862ecddb36f7e2233af8dbf`, là authority về năm bước/acceptance. Hồ sơ đề bài cũ giữ lịch sử “chưa giao”; yêu cầu mới này giao phần khảo sát và chuẩn bị.

Được đọc hosted qua kênh xác thực hiện có, SELECT/metadata GET có target guard; đọc code/spec/provider docs; viết spec, support read-only và gói replay LOCAL. Không sửa producer/executable application, SQL/dependencies hoặc triển khai adapter; không backup/dump/download payload hosted mới. Không stage/commit/push/reset/stash/switch/clean cả hai worktree, không deploy/publish, hosted settings/roles/grants/LOCK/API write, cleanup/activation/Storage delete hoặc contact provider/mua gói/tạo automation. Tuần tự, reviewer SEC rồi EVC chỉ đọc và không tác giả.

Giữ A+B, exact79=77+2, preserve66 Auth/object3, delete exact2; giữ Tailwind3 và gate dependency, C full-row/actual actor, L complete current equality. DEC-PHASE2-02 vẫn chặn maintenance/backup/cutover, không chặn khảo sát được giao mới. Không hỏi lại các quyết định này.

Main `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, dirty dùng chung. Source40/candidate02 backup-v2 giữ nguyên; không nhận kết quả runtime cũ là fresh. Private raw ở `%LOCALAPPDATA%/pos-cafe-release/hosted-path-20261014` ACL current user+SYSTEM, public chỉ hash/count/capability.

## Thứ tự và acceptance

1. Precheck nguồn/target và matrix trước probe; quan sát read-only mới, phân loại DECLARED / OBSERVED / SUPPORTED_NOT_OBSERVED / UNAVAILABLE.
2. Contract successor hosted profile/capture/eligibility có schema, trust anchor, mandatory checks, errors/negative matrix; LOCAL v2 không nới.
3. Action plan C/Storage/deployment có actor/ingress/drain/window/abort/reopen/unknown ACK; quyết định còn thiếu gắn mechanism/impact.
4. Gói replay độc lập mang historical recipe EVC-R1 và dependency graph; fresh official advisory evidence. Không rerun DB/full gates khi không source change.
5. Freeze snapshot → SEC → xử lý → EVC → cả hai APPROVE final SHA. Báo owner và STOP trước implementation mới/backup/cutover; offered walkthrough chưa là owner acceptance.

Matrix trước probe ở [runbook](../../runbooks/permission-hosted-path-2026-10-14.md); receipts/support tại `D:/Workspace/pos-cafe/artifacts/permission-hosted-path-20261014`. Kết quả/giới hạn và trạng thái sau review sẽ được cập nhật vào hồ sơ hiện hành, không sửa candidate cũ.

## Kết quả chuẩn bị trước review

Đã làm đủ năm phần khảo sát/thiết kế/package trong [biên bản](../../implementation-log/permission-hosted-path-2026-10-14.md): fresh exact79/66/3/K0/closure33, actual actor/catalog và authenticated UI/currentfrontend GET; official upstream21/21; contract successor schema3 reserve, check/error/testmatrix, C/Storage/window/unknownACK/L/deployment action plan HP1–8 và decisions HP-Q1–4. Registry supported hosted profiles vẫn rỗng; chưa producer implementation hoặc controlS1 thực. Scope/source40 không đổi.

Offline package `replay02` xử lý carry của EVC-R1 bằng historical recipe+exact source40 receipts/config/tests; private archive là bản sao2057pinned inputs cũ, không backup mới. Final relocated verifier07:55:45–51Z exit0,1217public/2057private/821source/2deletions/10focusedjobs/80commands/34privateargs/64literalmodules0missing. Không rerun DB/fulltests hoặc nhận historical runs thành mới. Final-check01:0source/snapshot/preservation/link drift; cleanup/ACL receipt:protectedroot/currentuser+SYSTEM,0PlaywrightMCPprocesses,3createdtabsclosed,khôngDocker/restart/WSLshutdown.

Đang freeze candidate01 và chờ SEC→EVC ở [review](../../reviews/2026-10-14-permission-hosted-path.md). Khi đủ hai APPROVE chỉ hoàn tất **task khảo sát/thiết kế/gói hành động**. Hosted backup/capture, maintenance, cutover/deploy và product vẫn BLOCKED; source-backed blockers và nextactions trong runbook. Dừng báo owner tại đây trước phần mới. Walkthrough ngắn đã chuẩn bị/được cung cấp đường đọc; chưa owner acceptance hoặc xác nhận hiểu.

## Checkpoint sửa review — candidate02

Candidate01 SHA351e814e2ea83685f8e2ae25584d86c47814b6c2e11febc2098ea18f0c52e77d được SEC APPROVE, EVC CHANGES_REQUESTED vì EVC-HP-01: baseline Storage của phép so mới chỉ pinSHA ngoài gói, thiếubytes có thể phục hồi. Reviewer đối chiếu gốc xác nhận metadata khôngdrift; đây không phải lỗi quan sát. Scopeapproval đã recoverable dưới tên khác trong2057oldinputs.

Đã bổ sung privatearchive input3(scopeapproval,Storagebaseline,TLSCA), explicitmap và checker12checks recompute từ bytes carried, relocatedPASS08:09:30Z; negative08:10:34Z sửa1metadata giữcount và giảrawhash/drift=false bị reject. Không hostedprobe/payloaddownload hoặc sourcechange mới. Candidate01/oldprivatearchive/source40 giữ nguyên. Candidate02 sẽ freeze/review SEC→EVC cùngSHA; chỉ sau cảhai APPROVE mới hoàn tất task này. Finding/history ở review, mọi product/hostedflags vẫnfalse.

## Metadata bàn giao cuối — hoàn tất khảo sát/thiết kế/chuẩn bị

Ngày14/10/2026, SEC rồi EVC đều **APPROVE** candidate02 SHA `2328fd05976ddf916fc782bf874c42c9720d4c041a7bab4276d80e19911f7013`; **EVC-HP-01 CLOSED**. [Verdict/checks/giới hạn](../../reviews/2026-10-14-permission-hosted-path.md#metadata-verdict-cuối--candidate02-14102026). Đã hoàn tất task được giao trong phạm vi khảo sát và gói hành động, cósource-backedBLOCKED outcomes; không gọiđãđóngsảnphẩm hoặc hostedready.

Đã dừng trước implementationmới/backup/capture/maintenance/cutover/deploy. Không push/stage/commit hoặc thaycodeapp/SQL/deps; source40/oldcandidate/volumes/archives bảo toàn. Bước kế tiếp theo HP1–8 cần giao implementationLOCAL riêng và cóprofile/consumer/actualactor/StoragecontrolS1+drain thực, rồi exactenv/Edge/rollback/dependency/releaseactionwindow; currentK0/metadataequality khôngthayfreshlockedproof. Không hỏi lại A+B/scope79/Tailwind3/no-push. Walkthrough ngắn đã chuẩn bị và được cung cấp đường đọc; có thể đi cùng owner khi muốn, chưaownerxácnhậnđãđọc/hiểu/nghiệmthu.

Đoạn này chỉ là metadata status/verdict saufreeze; các checkpoint chờreview bêntrên giữ lịch sử, candidate02/snapshots/proof khôngthayđổi.
