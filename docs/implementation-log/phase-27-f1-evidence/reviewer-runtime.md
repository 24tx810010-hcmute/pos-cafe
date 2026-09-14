# Review độc lập F1 — browser/Auth/REST

Ngày kiểm: 2026-09-10. Agent `cache_runtime_review`. Phạm vi: bản sửa cache Tra cứu thao tác trên base `3ada48c0c9c494d9b34838fd3739bda6091e0bb9`, chưa commit. Không sửa tracked code/test/docs, không sửa `pnpm-lock.yaml`, không dùng `.env.local`, không smoke/deploy lên Supabase thật.

## Kết luận trong phạm vi

Không tìm thấy finding mới còn mở trong phần cô lập cache recovery đã kiểm. Kết quả dựa trên đọc diff và browser chạy thật, không dựa vào số pass của parent hay review trước. Ba regression E2E tracked và ba oracle browser độc lập đều đạt. Hai oracle độc lập thật sự phát hiện bản lỗi khi cấp lại source trước sửa cho Vite; quay về source có guard thì ba oracle đều đạt.

Đây không phải nghiệm thu toàn bộ phase 27 hoặc xác nhận rằng các finding P2 khác đã hết. Agent không chạy lại 415 DB contracts, toàn bộ unit/build/coverage hay full gate; parent chịu trách nhiệm gate trên candidate cuối.

## Cơ chế đã đọc

- `src/app/useAppStore.ts:53–56`: mỗi lần set nhân viên tăng phiên bản phiên, kể cả cùng employee ID.
- `src/app/WriteLifecycle.tsx:15–17`: xóa queries thuộc prefix recovery khi nhân viên/phiên thay đổi.
- `src/app/drawers/pos/WriteRecoveryDrawer.tsx:20–28,33`: component/key/query scope gắn store, employee và phiên bản phiên.
- `src/app/drawers/pos/WriteRecoveryDrawer.tsx:36–55,70–76`: signal của query bị hủy ngăn kết quả cũ quay lại; lỗi quyền/session xóa dữ liệu scope; giao diện không render dữ liệu cache sau lỗi đọc.
- `src/app/drawers/pos/WriteRecoveryDrawer.tsx:90–108`: bổ sung guard lifetime + generation cho receipt đang chờ, kiểm sau mỗi await. Agent security khác kiểm nhánh này bằng oracle riêng; agent này không lấy kết quả của họ thay cho bằng chứng browser của mình.
- Manifest `tests/contracts/caseManifest.ts:66–83` thêm đúng 12 core (4 biên session/store/late + 2 receipt late + 6 endpoint×error) và 3 E2E. Các case này giữ `expectedStatus=passed`, không đưa lỗi dự kiến vào gate như pass.

## Backend và nguồn đã kiểm

- Node `v24.16.0`.
- Preflight tự chạy `preflight({requireBrowserStack:true})`: PASS, gồm marker/migration checksum và token API được observer nhìn thấy, Auth health.
- Backend `postgres-postgrest-gotrue`; API `http://127.0.0.1:55444`; DB `pos_cafe_idem_test_auth_7d0433b504c4`.
- Env riêng do parent cấp: `C:/Users/nguye/AppData/Local/Temp/pos-cafe-cache-fix-20260910/gotrue-stack/idempotency.env`. Không ghi credential vào báo cáo.
- Agent giữ độc quyền DB trong tất cả lượt test, chạy suite tuần tự; đã trả lease cho parent lúc hoàn tất. Mỗi reset/clock của harness kiểm marker; mutation fixture chỉ ở DB cô lập.
- Fingerprint nguồn cuối `7e006793780d39218b28712db96bbbe62e4d9e4901ac1bb1cc504a1fec9deeca` đã được quan sát trước negative control/lượt oracle cuối và sau lượt cuối.

SHA256 ba file production đã kiểm ở trạng thái cuối:

| File | SHA256 |
| --- | --- |
| `src/app/WriteLifecycle.tsx` | `af2976ddaa9d22f76aa30c00d17f4a88c37c7b12101f833fdba3e7877c997d04` |
| `src/app/drawers/pos/WriteRecoveryDrawer.tsx` | `a8f612189297ee2c1d9ce7a2bf3c9c852ec75f5273fad79ebcd70bdcf7f0a89f` |
| `src/app/useAppStore.ts` | `dccd4e1c0e4d11e4edc0c47bf8642febf825b298cff364c43e58a87c79aca1ef` |

## Lệnh và kết quả

Tất cả lệnh dưới chạy từ `D:/Workspace/pos-cafe` với `IDEM_ENV_FILE` nêu trên; reporter ghi vào thư mục review, không ghi đè report stage chính.

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='D:/Workspace/pos-cafe/artifacts/cache-fix-runtime-review/tracked-e2e.json'
node node_modules/@playwright/test/cli.js test --config playwright.idempotency.config.ts --grep 'TC-IDEM-006/e2e/cache=' --reporter=json
Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_FILE
node node_modules/@playwright/test/cli.js test --config artifacts/cache-fix-runtime-review/playwright.config.ts
```

Tracked: 3 passed, 0 skipped/unexpected/flaky, 1 attempt/test, retry 0, forbidOnly true, workers 1. Kiểm A→C→B, live permission denial khi detail đang mở và detail HTTP 200 bị giữ qua lock/C.

Oracle riêng: 3 passed, 0 skipped/unexpected/flaky, 1 attempt/test, retry 0, forbidOnly true, workers 1. File `independent.spec.ts` không import UI implementation/helpers cache; chỉ tái dùng fixture/server caller và thao tác pairing UI.

| Oracle độc lập | Thao tác/quyền server thật | Expected và actual cuối |
| --- | --- | --- |
| Cùng A đăng nhập lại sau thu hồi quyền | A đọc R1 150.000, khóa; observer deny `payment.take`; A login mới; direct `get_write_operation` trả `FORBIDDEN`; browser list HTTP 200 chứa `items=[]` | Ngay khi drawer hiện: 0 operation row; sau response vẫn không lịch sử/nút in; 0 write RPC mới, DB vẫn 1 payment. Đạt. |
| Server thu hồi employee session đang dùng | A đang xem R1; observer đặt `revoked_at=private.write_clock()` cho phiên A còn sống; browser list trả `EMPLOYEE_SESSION_REQUIRED` | Xóa list/detail/nút in; bấm Tải lại vẫn bị server từ chối và không hồi dữ liệu; 0 write RPC mới, DB vẫn 1 payment. Đạt. |
| List A HTTP 200 được thả sau C tiếp quản | Route fetch thực tế chứng minh response A chứa đúng K1; giữ delivery; khóa, C login/open và nhận list trống; thả response A, đợi body + hai animation frames | Không hồi list/detail/nút in của A; reload vẫn trống; DB vẫn 1 payment. Đạt. |

## Negative control — kiểm độ nhạy oracle

```powershell
node node_modules/@playwright/test/cli.js test --config artifacts/cache-fix-runtime-review/playwright.baseline.config.ts --grep 'same employee A|revoked server employee session'
node node_modules/@playwright/test/cli.js test --config artifacts/cache-fix-runtime-review/playwright.config.ts
```

`vite.baseline.config.ts` dùng `git show 3ada48c:<file>` cho đúng ba file production của bản sửa rồi thay nội dung qua Vite pre-transform. Không đổi file tracked, migration hoặc backend. `baseline-substitution.json` lưu revision và SHA256 các source đã cấp.

- Bản trước sửa: exit 1, **2 failed**, không phải expected-failure. Cùng A login lại: assertion đồng bộ rowcount expected 0, actual 1 (`independent.spec.ts:37`). Thu hồi server session: assertion rowcount expected 0, actual 1 suốt timeout 5 giây (`independent.spec.ts:18,61`). Cả hai thất bại tại oracle hành vi, không phải import/compile/runtime setup.
- Case đầu còn ghi lỗi phụ `page.waitForResponse: Test ended` vì test đã dừng tại assertion leak trước khi promise chờ list hoàn tất. Lỗi phụ này không được tính làm bằng chứng; bằng chứng là expected 0 / actual 1 của assertion trước đó.
- Quay về config Vite thường, cùng source guarded và DB Auth/REST: **3 oracle passed**, exit 0. Đây là kiểm cleanup của override, không tính baseline failures vào pass gate.

## Tính trung thực và giới hạn

- Hai lượt đầu diễn ra trong lúc parent hoàn thiện patch. `before.json`/`after.json` của lượt tracked cuối cho thấy fingerprint toàn candidate thay đổi `d12c...` → `7e00...`; vì vậy không gọi nhóm report đó là full gate cùng fingerprint. Theo diff tiếp theo, thay đổi cuối là assertion inventory tooling; parent đã nhận thông báo và sẽ chạy lại gate cuối. Lượt oracle riêng sau đó có source cuối ổn định.
- Không dùng số pass cũ 1.034 hoặc coverage cũ làm bằng chứng cho bản sửa.
- Ba oracle mới không bao phủ mọi lịch mạng hoặc mọi API callback; không phải chứng minh hình thức về không rò dữ liệu. Phần cache generic ngoài recovery và quyền SELECT store-level không thuộc phạm vi.
- Không kiểm cloud Supabase, Storage/Realtime, mobile viewport, máy in vật lý, tải sản xuất hoặc đầy đủ các vấn đề in muộn đã được ghi riêng trong review phase 27.
- Full gate/release vẫn phải giải quyết các finding ngoài F1 và chạy trên fingerprint cuối, không suy rộng kết quả review này thành chấp thuận rollout.

## Bằng chứng trong thư mục này

- `tracked-e2e.json`, `tracked-e2e.log`: ba regression tracked.
- `independent.spec.ts`, `independent-e2e.json`, `independent-e2e.log`: oracle và kết quả cuối.
- `baseline-e2e.json`, `baseline-e2e.log`, `baseline-substitution.json`: negative control và lỗi assertion thật.
- `before.json`, `after.json`, `negative-control-and-final.json`: SHA/backend/fingerprint/prod hashes và thống kê.
- Các file `progress-*`: lượt trước khi parent hoàn thiện patch; giữ lại để thể hiện lịch sử, không dùng làm final gate.
