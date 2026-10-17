# Runbook, kiểm local và sửa lỗi ảnh mock — 08/10/2026

## Phạm vi và quyết định

Chủ dự án đồng ý làm slice runbook/gate mapping sau inventory Vercel, yêu cầu **auto test, UI test và subagent chọn model theo công việc**. Khi hai smoke cùng lỗi, chủ dự án trả lời **“Sửa lỗi mock và kiểm lại (khuyên dùng)”** cho câu hỏi mở scope sửa mock, regression và kiểm lại. Đây là nguồn ủy quyền trực tiếp trong chat; không suy quyền từ handoff.

- Main `D:/Workspace/pos-cafe`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`; docs `D:/Workspace/pos-cafe-docs`, HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, đều có thay đổi chưa commit từ trước. Chỉ sửa hai file mock/test trong slice ứng dụng; giữ nguyên phần dirty khác và lockfile.
- Runbook là [bản nháp cho T17](../runbooks/permission-release-runbook-2026-10-08.md). Không đóng T15/T16/PIN-T06/T17/T18 hay task sản phẩm; chưa kiểm service/hosted, cleanup hoặc phát hành trong lượt này.
- UI layout/checkbox/font/contrast vẫn thuộc phần đã hoãn theo [closeout 05/10](../workflow/tasks/permission-closeout-review-2026-10-05.md). Giữ report FAIL và phân loại, không sửa UI hoặc chấp nhận baseline. Bằng chứng mobile có tác động chức năng cần đưa vào scope UI kế tiếp.
- Subagent Luna/medium khảo sát test và phân loại UI; Sol/high đối chiếu release gates; Sol/medium sửa hai file và viết runbook. Hai reviewer không tham gia viết kiểm candidate cuối, với scope nguồn/quyền và hồ sơ/evidence. Chi phí được cân bằng theo độ khó, không phải theo số agent.

## Lỗi, thiết kế sửa và hệ quả kỹ thuật

Smoke desktop “employee permission editor gates payment after re-login” không thấy drawer sau login cashier; demo 14 bước timeout khi gọi món. Cả hai có cùng stack `FORBIDDEN`: [OrderDrawer:278](../../../pos-cafe/src/app/drawers/pos/OrderDrawer.tsx:278) gọi getter ảnh trong render, trong khi mock getter yêu cầu `menu.manage` cả với khóa ảnh null. Cashier có quyền gọi món nhưng không có quyền quản lý thực đơn; lỗi đồng bộ làm vỡ render. Đây là lỗi ứng dụng mock, không phải assertion cũ hoặc thiếu món Americano. Stack/log trước sửa được giữ trong [smoke.log](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/smoke.log).

Spec đã phân biệt [ảnh published và staging](../../openspec/changes/redesign-permission-model/specs/access-control/spec.md:228): ảnh đã công bố có đường phục vụ public; staging/registry/ghi cần quyền quản lý thực đơn. [Adapter Supabase:91](../../../pos-cafe/src/adapters/supabase/permissionMenuImagePort.ts:91) dựng URL published/legacy theo cơ chế riêng. Sửa lần này chỉ áp cho mock dùng trong ứng dụng, không chứng nhận hành vi Storage/Supabase.

**Quyết định kỹ thuật PRR-D01 (08/10, AI chọn chi tiết trong scope sửa đã duyệt):** [getter mock:163](../../../pos-cafe/src/adapters/mock/permissionRuntime.ts:163) dùng `currentActor` thay kiểm `menu.manage`. Getter chỉ đọc map published, không công bố staging; closure `menu.manage` cho stage/read/discard và quyền save menu giữ nguyên. [Normal actor guard:73](../../../pos-cafe/src/adapters/mock/permissionIdentityRepo.ts:73) tiếp tục kiểm phiên hợp lệ, nhân viên/role và `PIN_CHANGE_REQUIRED`. Mock runtime vẫn cần phiên nhân viên; không nhận nó tương đương anonymous HTTP của backend public.

Phương án bỏ toàn bộ guard getter không được chọn vì sẽ bỏ bất biến phiên restricted/revoked đã có. Phương án cấp `menu.manage` cho cashier không phù hợp quyền nghiệp vụ. Không bắt lỗi rồi trả null để che authorization sai. Hệ quả: tách quyền đọc ảnh phục vụ gọi món khỏi quyền quản trị, đồng thời giữ lỗi phiên có chủ đích và các quyền ghi ảnh.

[Regression:46](../../../pos-cafe/src/adapters/mock/permissionRuntime.test.ts:46) kiểm owner publish → cashier đọc đúng URL; null/undefined/unknown/staged trả null; cashier stage/read/discard/save bị `FORBIDDEN`, ảnh menu không bị đổi; revoked trả `EMPLOYEE_SESSION_REQUIRED`; restricted PIN cả khóa/null vẫn bị chặn. Builder chạy test mới trước sửa: **FAIL đúng `FORBIDDEN`**; sau sửa hai file **9/9 PASS**. [Receipt builder](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/builder-evidence.json) và hai log là transcript tool được lưu sau chạy, không giả raw redirect. Focused test không thay gate toàn sản phẩm.

## Source và môi trường kiểm

Artifact gốc: [permission-runbook-readiness-20261008](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008). Trước sửa fingerprint `30dd5664e47f670e1c208151407c58b5dbb71943ca30d8a57f17de49051c1bad`; sau sửa **`5f78d8692604e0a38d0b3be477a980d895cf268a4c6888d58cdb4fe6e9ed1bf2`**. Bản hai file ngay trước sửa được giữ trong `pre-fix-source/`; delta slice được đóng vào candidate cùng source snapshot đầy đủ, gồm tests/file mới/lock và marker file đã xóa. Manifest/snapshot/review ở [biên bản review](../reviews/2026-10-08-permission-runbook-readiness.md).

Windows, Node **24.16.0**, npm **11.13.0**, Vitest thực chạy **4.1.10**, Vite thực chạy **8.2.1**. Version chạy thực khác một số package range; lock/source được giữ, chưa làm clean dependency reinstall nên khả năng tái hiện còn phụ thuộc dependency đã cài. Không coi bản build mock này là bundle Production.

Mọi test mới là local: process con đặt `VITE_DATA_MODE=mock`, Supabase URL loopback không dùng được và anon key giả; loại biến PAT/IDEM_ENV_FILE khỏi process con. Playwright/audit ép mock, URL/key rỗng và chạy dev server local. Không đọc token, env secret, config auth hay mở Dashboard trong slice này. [Runner local](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/Run-LocalCheck.ps1) và execution receipts ghi command, UTC, exit, fingerprint trước/sau. Fingerprint không đổi trong cả sáu lượt kiểm sau sửa.

## Kết quả auto test — giữ cả lỗi trước sửa

| Kiểm | Trước sửa | Sau sửa, source `5f78…` | Evidence/giới hạn |
| --- | --- | --- | --- |
| Unit/component | 106 files / 1.139 PASS | **106 files / 1.140 PASS**, exit0 | [unit JSON](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/unit-results.json); config chỉ gồm `src` tests, không SQL/service |
| Tooling chọn lọc | 3 files / 70 PASS | **3 files / 70 PASS**, exit0 | [tooling JSON](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/tooling-results.json); cutover17/rehearsal10/provider43, fixture/fault harness, không DB/hosted runtime |
| Typecheck + build | PASS | **PASS**, exit0 | [build log](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/build.log); bundle lớn >500KB là warning hiện hữu |
| Full mock smoke | 33 PASS / 31 skip / 2 FAIL | **35 PASS / 31 skip / 0 FAIL**, exit0; retry0 | [smoke JSON](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/smoke-results.json); desktop cashier và demo14 bước đều đạt |
| UI detector selftest | 23 findings, selftest OK | **23 findings, selftest OK**, exit0 | [selftest log](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/selftest.log); chứng minh detector phát hiện seeded defects |
| Rendered UI audit | 48 trạng thái/viewport, 69 nhóm; 33 ngoài baseline | **FAIL**, 48 trạng thái/viewport, 69 nhóm; 33 ngoài baseline, setup failures0, exit1 | [report](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/ui-audit/report.md), [phân loại](permission-ui-audit-triage-2026-10-08.md); baseline giữ nguyên |

31 skip là guard viewport có sẵn: portrait-only, landscape-only và desktop-only. Chúng không phải 31 lỗi được waive, cũng không được dùng để tuyên bố strict T15/PIN gate không có skip. React `act` warnings trong một số component test và chunk warning không đổi exit PASS; giữ log để truy vết.

Chạy lại từ cwd main bằng `Run-LocalCheck.ps1 -Check unit|tooling|build|smoke|selftest|audit`, từng giá trị riêng. Selftest phải chạy trước audit; kiểm ports5175/5178 trống trước chạy. Runner chỉ dựng môi trường mock; không thêm lệnh SQL/service hoặc target live vào runner này. Mỗi receipt có argv thực: unit `--maxWorkers=2`; tooling config riêng và ba testfiles; smoke `--workers=2 --retries=0`. Rerun tạo evidence mới, không tự dùng nó làm candidate frozen cũ.

## Kiểm UI trực tiếp

CUA trên `http://127.0.0.1:5181`, mock/synthetic, không credentials thật. [Receipt + hashes](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/manual-execution.json):

1. Owner bỏ `payment.take` của cashier, lưu → khóa → cashier login lại → mở B02. **Drawer gọi món visible; nút thanh toán0; payment drawer0.** [Ảnh](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/manual-cashier-order.jpg) cùng AX. Menu fixture có khóa ảnh null; ảnh published được chứng minh bằng regression, không suy từ screenshot.
2. Payment mobile **844×390**: DOM hit-test chỉ ra checkbox và nút cộng nằm sau summary/footer. Normal click checkbox đầu trả về nhưng lựa chọn vẫn2/2,1/1,1/1. [DOM receipt](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/manual-payment-mobile-hits.json) và [ảnh](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/manual-payment-mobile.jpg). Không submit thanh toán trong lượt kiểm trực tiếp; các nút khác chưa được click để chứng minh từng hành vi.
3. Component đổi PIN bắt buộc trong audit fixture: PIN5 chữ số báo **“PIN mới phải gồm 6 chữ số.”**, xác nhận khác báo **“Hai lần nhập PIN mới chưa khớp.”** [Ảnh form](D:/Workspace/pos-cafe/artifacts/permission-runbook-readiness-20261008/postfix/manual-pin-validation.jpg). Port hoàn tất của fixture chủ động từ chối submit; chỉ chứng minh validation UI, không chứng minh đổi PIN service thành công. Không đổi credential thật.

Tab test đã đóng, viewport reset, server5181 dừng. Smoke/audit là project E2E tự đóng browser/server, không dùng Playwright MCP hay sửa cấu hình MCP. Báo cáo UI giữ giới hạn và những false positive có thể có; “ngoài baseline” không có nghĩa mới sinh ra bởi bản sửa.

## Gate và việc tiếp theo

Runbook giữ DELIVERY-03 cleanup exact77, profile/provider rehearsal, backup/restore/full-row proofs, durable journal/COMMIT unknown, Storage API riêng và backend trước frontend. Vercel auto-deploy main bật nên phải chốt cách điều khiển rollout trước push. DB marker `PENDING_STORAGE_API` không phải release xong. Metadata Edge absent/env presence không là runtime/capability proof.

**Slice kế tiếp đề nghị:** kiểm/dựng đúng fixture full stack cách ly, identity marker/lease và binding trước reset; chạy images/JWT/TC44 cùng service/PIN gates còn thiếu trên source cuối. Chốt quyền và target riêng trước các hành động đó. Phần UI mới được phân loại là đầu vào scope UI đã hoãn, không tự xóa gate hoặc mở rollout. Không cần session mới chỉ để tiếp tục; handoff đủ để chuyển phiên nếu chủ dự án muốn.

Walkthrough đã cung cấp qua phần nguyên nhân → guard đọc/ghi → regression → bằng chứng ở trên; chủ dự án chưa xác nhận đã đọc/hiểu hoặc nghiệm thu. Trạng thái review ghi tại [biên bản](../reviews/2026-10-08-permission-runbook-readiness.md); approval slice không đồng nghĩa sản phẩm đã phát hành. Docs/code vẫn chưa commit hoặc push.
