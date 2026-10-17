# CLOSE-3 bước 1 — binding và backup mới, 13/10/2026

**Addendum review:** SEC rồi EVC cùng APPROVE candidate-01 SHA `30fd08622c79528ca77579d9b30f3ac86e2ecba78dcda1784259e8a506d25ad4`; [verdict](../../reviews/2026-10-13-permission-close3-step1.md). Hồ sơ bước1 đã qua review, kết quả PARTIAL/BLOCKED và STOP giữ nguyên. “Chờ review” bên dưới là trạng thái khi khóa snapshot, không phải trạng thái hiện tại.

## Đề bài và quyền thực hiện

Nguồn: người dùng giao “bắt đầu CLOSE3 … kiểm binding và backup mới trước, làm tuần tự, xong báo tôi rồi mới sang phần tiếp theo”, chuyển tiếp từ chat `01a11fff-6130-7de2-aa08-8b42afd1a543`. Chỉ đọc hosted Supabase `kfqjdfwxhkdwihjobpny`/Vercel `pos-cafe`, backup mới vào vùng local private và verification/restore vào target mới cô lập. Không cleanup, activation, Storage deletion, deploy, frontend hay postflight live. Không stage/commit/push/reset/stash/switch; giữ thay đổi hiện hữu.

Task nhạy cảm. Binding trước backup; báo checkpoint binding trước khi chạy backup. Hai reviewer không phải tác giả, read-only và tuần tự: authority/binding/security, rồi backup/restore/provenance. Không gọi toàn CLOSE-3 hoặc owner acceptance hoàn tất.

## Đầu vào đã kiểm

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. [Handoff CLOSE-2](permission-close2-source31-2026-10-13.md), [review](../../reviews/2026-10-13-permission-close2-source31.md), [runbook nháp](../../runbooks/permission-release-runbook-2026-10-08.md) là đầu vào. Runbook và inventory ngày 07–09/10 là lịch sử.

Đối chiếu đầu phiên: candidate-final-03 SHA `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492`; 50 absolute references không mismatch; 812 source31 entries không drift. Source fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`. Hai review CLOSE-2 APPROVE exact candidate chỉ chứng minh local readiness.

## Acceptance và tiến độ

1. Fresh target/account/org/project/Production/repo/branch/domain/env/runtime binding, actor/catalog/version/provider capability; xác minh kênh điều khiển auto-deploy nhưng không đổi settings. Tách PASS/FAIL/BLOCKED, không coi presence của env là actual binding.
2. Khi binding phù hợp, dump mới DB/schema/catalog/roles/grants/Auth/sequence/full-row digest và payload/metadata Storage. Exact77 UUID/FK closure và exact2 objects theo DELIVERY03; ngoài scope phải bảo toàn, drift chặn phần phụ thuộc.
3. Backup private có SHA/size/time/source/target, kiểm đọc và restore thật vào target mới; đối chiếu DB/Auth/ACL/sequence/K/payload/R1/Storage, ghi limitation catalog supplement. Không restore lên live hay bỏ giao dịch sau snapshot.
4. Khóa package/snapshot và hai review exact candidate, báo kết quả rồi dừng trước bước kế tiếp.

## Checkpoint kết quả

**PARTIAL/BLOCKED; dừng sau bước1.** [Log kiểm chứng](../../implementation-log/permission-close3-step1-2026-10-13.md) ghi receipt, hash và giới hạn; [review độc lập](../../reviews/2026-10-13-permission-close3-step1.md) ghi candidate/verdict.

- Fresh binding khớp project Supabase, Vercel Production/main/domain và compiled key được Auth settings endpoint chấp nhận. Write/deploy capability, immutable org ID, env values của deployment tiếp theo và provider runtime chưa được chứng minh.
- Live có79 stores: đủ77 đã duyệt và2 ngoài scope. Backup bảo toàn mới chứa toàn79,145 Auth; manifest `cleanupEligible=false`, không thay allowlist hoặc dùng proof này cho controller cleanup.
- DB restore trên target mới: toàn63 table data/full-row digests khớp,79 stores/145 Auth/83 orders/70 payments. Strict comparison74/75: Auth sequence đổi327→328 trong cửa sổ backup. Supplemental chứng minh clone bằng archive và không trùng ID snapshot, không override strictFAIL. K/write_operations có0 row nên không có K recovery mới để chứng minh.
- Storage backup và actual API restore/readback3/3 objects,912.478byte khớp;2 object gốc và1 ngoài scope đều bảo toàn. Metadata gốc được đối chiếu riêng qua DB clone.
-14 owned containers và keepalive đã dừng, volumes giữ local; task browser tabs đã đóng. Không cleanup/activation/deletion/deploy/frontend/postflight live hoặc Git mutation.

Artifact sanitized `D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013`; raw/backup private dưới `C:/Users/nguye/AppData/Local/pos-cafe-release/`. Gate bàn giao hồ sơ đang chờ SEC rồi EVC review exact candidate. Approval hồ sơ PARTIAL không phải release approval. Trước phần phụ thuộc cần quyết định của owner về2 store mới và proof backup ổn định phù hợp cutover; không tự tiến hành phần tiếp theo.
