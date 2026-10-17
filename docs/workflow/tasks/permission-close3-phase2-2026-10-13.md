# CLOSE-3 phase 2 — quiescence, backup79 và restore

Ngày 13/10/2026. **PARTIAL / BLOCKED trước fresh backup và actual restore.** Đã khảo sát hosted chỉ đọc, dựng đích local mới và kiểm phản ví dụ cho phương án khóa. Không coi hồ sơ chẩn đoán là phase2 hoàn tất. [Biên bản](../../implementation-log/permission-close3-phase2-2026-10-13.md), [runbook/điểm cần quyết định](../../runbooks/permission-phase2-quiescence-2026-10-13.md), [review](../../reviews/2026-10-13-permission-close3-phase2.md).

## Quyền và đầu vào

Đã đọc lại nguồn trực tiếp bằng `read_thread`: chat `01a11fff-6130-7de2-aa08-8b42afd1a543`, turn `01a13582-7134-7243-ba88-f6f74e319407`, user message `01a13582-716c-7c81-a36f-9084a9c875c7`: **“tiếp tục phase tiếp theo trong close3 đi”**. Chat nguồn chuyển phase2 tới chat `01a13587-9dc4-7e10-bac3-ff55e41ec2f6`, yêu cầu tuần tự quiescence → fresh backup exact79 → actual isolated DB/Storage restore → fresh proof, báo trước cutover. Đây là quyền làm phần read-only, backup/private download và isolated verification. Chưa có quyết định về cơ chế/window hosted ảnh hưởng Auth ngoài79 hoặc quyền đổi settings/roles/provider; bàn giao không tự tạo quyền đó.

Giữ no-push cả main/docs; không commit/stage/reset/stash/switch, không publish bằng kênh khác. Không hosted prepare, cleanup, activation, Storage delete, deploy/promote/frontend/live business postflight. Giữ quyết định owner về Tailwind3/chờ upstream và release BLOCKED. Không mở lại scope79 đã duyệt hoặc scope xóa Storage exact2.

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai dirty. Source34 SHA `3053eb5a9bade4b1ee9dca090e473a6c6c82415eab02471874ba910ff5be92c3`, fingerprint `a711636bf2f9f357d37129603befb6ef388c64b9011156c87705f9c1fe9a2b43`,812 entries; không đổi app/test/controller/dependencies. Support scripts mới chỉ dưới `artifacts/permission-close3-phase2-20261013`, có hash/snapshot riêng; không nhận PASS full PIN/PERM cho chúng.

## Checkpoint và bàn giao

- Fresh complete observation **13:55:03Z / 20:55:03 Bangkok**: đúng79 UUID,145 Auth,66 Auth ngoài scope khớp exact IDs;3 Storage metadata khớp, FK/closure33 và catalog không drift. TLS CA pin, project-bound username, READ ONLY, actor/session_user postgres PG17.6 NOSUPERUSER/BYPASSRLS. Chưa đọc lại full-row mọi bảng hoặc payload lần này.
- Quan sát toàn bộ schema ngoài hệ thống cho64 relations/3 sequences: năm bảng thiếu quyền SHARE; Auth và Realtime sequences không thuộc quyền owner/SET ROLE của postgres. Không thử LOCK/ALTER/grant trên hosted.
- Lab mới network none/port0, không dùng lại retained restore target. Actor flags/memberships và64 effective table privileges/owners khớp; bảng/rows synthetic, không phải hosted binary/profile hoàn chỉnh.29/29 phép kiểm chẩn đoán cuối đạt; phương án quiescence vẫn **không đạt** vì phản ví dụ `nextval` và quyền provider, chưa chứng minh Storage payload/workers.
- Preparation contract exact79 pin scope/source/target/catalog/FK,29/29 guard checks; `executionReady=false`, `cleanupEligible=false`. Đây chưa là executable backup helper hoặc controller inventory/proof.
- Không fresh DB/Storage backup, không actual restore75/75, không fresh full-row/catalog-supplement package. Bản bảo toàn cũ và strict74/75 vẫn nguyên trạng FAIL, không được nâng eligibility. Không tạo K live; K0 của backup cũ chỉ là lịch sử.
- Chờ review SEC rồi EVC exact candidate cho **tính đúng của hồ sơ PARTIAL**, không phải approval quiescence/release. Teardown chỉ đích/PID của phiên; giữ volume và toàn bộ archives.

## Việc tiếp theo và câu hỏi còn thiếu

**Q-PHASE2-01:** cần một kênh maintenance thực sự dừng Auth/Realtime sequence writers và Storage upload/replacement/delete/background work trong khi DB vẫn đọc được. Phương án chỉ khóa bảng/đổi frontend banner/network restrictions không đủ. Owner cần xác nhận có thể cung cấp/phối hợp kênh provider này hay giữ phase2 tại checkpoint chẩn đoán; chưa có cơ chế khả thi để xin duyệt “khóa hosted ngay”. [Runbook](../../runbooks/permission-phase2-quiescence-2026-10-13.md) ghi yêu cầu cụ thể, tác động145 Auth, dự kiến ceiling20 phút, rollback/reopen và gói thông tin cần có. Chưa liên hệ/gửi ticket cho provider.

Khi có control cụ thể: diễn tập runtime tương ứng, chứng minh scope/drain/fault-cleanup/backup-reader, review helper exact79 và xin owner chốt đúng action/window. Sau đó mới backup mới và restore thật; khi phase2 đủ gate mới xem phase3 provider/controller rehearsal và release review. Không sang actual cutover chỉ vì phase2 được phép. Walkthrough đã chuẩn bị theo target → quyền → phản ví dụ → plan guard; chưa owner acceptance hoặc phản hồi đã đọc/hiểu.

**Metadata review sau freeze:** SEC rồi EVC cùng APPROVE candidate-01 SHA256 `eb30c03577b312f5c810caa5ce48443b3d2c3e95ebbf0416946bd2f3a20fb3ad` trong phạm vi hồ sơ PARTIAL/BLOCKED; [verdict](../../reviews/2026-10-13-permission-close3-phase2.md). Không thay snapshot hoặc mở quyền hosted. Phase2 tổng thể chưa hoàn tất; những dòng chờ review ở trên phản ánh thời điểm freeze. EVC-N1 là đề xuất không chặn cho receipt runtime của executable helper tương lai.

## Quyết định owner — giữ BLOCKED, 13/10/2026

**DEC-PHASE2-02 — đã chấp nhận.** Người dùng trả lời trực tiếp trong chat này: **“Chưa có; giữ phase2 tại checkpoint BLOCKED”**, cho câu hỏi Q-PHASE2-01 về kênh/quyền maintenance Supabase (question call `call_e3dc011ab7a84ee583373eda6a2c347e`). Câu hỏi đã nêu phương án khóa bảng không phủ đủ và tác động tới66 Auth ngoài cleanup scope.

Kết quả: Q-PHASE2-01 đã có câu trả lời; hiện chưa có kênh maintenance, giữ phase2 **PARTIAL/BLOCKED_PRE_BACKUP**. Dừng công việc thực thi phase2 tại checkpoint này, không tiếp tục backup/restore mới, hosted maintenance hoặc phase3. Không liên hệ provider, tạo lịch tự theo dõi, push, deploy hay cleanup từ quyết định này. Giữ nguyên backup/volume/evidence và releaseblock hiện hữu. Đây không phải nghiệm thu phase2 hoặc cấp quyền thực thi mới.

Chỉ mở lại khi người dùng yêu cầu tiếp tục và có thông tin/cơ chế đáp ứng gate còn thiếu; quyền action/window cụ thể vẫn phải được chốt theo runbook. Các snapshot và verdict candidate-01 giữ nguyên; bản ghi này bổ sung quyết định owner sau checkpoint.

## Successor LOCAL đã giao14/10
[BACKUP-AB-14](permission-backup-v2-2026-10-14.md) cho phép spec/helper/loader và kiểm LOCAL A cho B/I + B cho C/Storage. Thay normative global-sequence freeze bằng [contract v2](../../runbooks/permission-backup-v2-2026-10-14.md); hosted phase2 vẫn BLOCKED, chưa control/window. Không thay candidate lịch sử.
