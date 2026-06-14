# POS Cafe Integration Checklist

> Vai trò: checklist cho phase nối nhánh UI với nhánh logic/adapters. File này dùng sau khi UI mock/production component split đã ổn, không dùng để merge trực tiếp vào `codex/code-foundation`.
> Trạng thái 2026-06-14: UI checkpoint `codex/code-foundation` đã push tới `6009b47`; branch tích hợp `codex/ui-logic-integration` đã merge `codex/stream-db-rpc`, push merge commit `1c420d9`, push binding nền UI thật `47f17f6`, push Employees slice `4d7d1ae`, rồi implement local Menu/Floor editor changeset save và Report/History polish.

---

## 1. Mục tiêu

- Tạo một nhánh integration riêng từ UI branch đã xong.
- Merge logic branch `codex/stream-db-rpc` vào integration branch, không merge ngược vào `codex/code-foundation`.
- Bind UI thật vào hooks/services/`AppPorts`, không gọi Supabase/RPC trực tiếp từ component.
- Chạy đủ automated tests + manual smoke trước khi quyết định merge tiếp.

Status 2026-06-13:

- Đã tạo `codex/ui-logic-integration` từ `codex/code-foundation` sau UI spacing fix `6009b47`.
- Đã merge `codex/stream-db-rpc` vào integration branch bằng merge commit `1c420d9`.
- Đã push `origin/codex/ui-logic-integration`.
- Validation đã pass: `npm run build`, `npm run test` (16 files/60 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, scan conflict marker/import `portsContext` cũ.
- Binding nền UI thật đã push commit `47f17f6`: session bootstrap/pair/create/passcode, realtime invalidation, POS floor/takeaway/order/payment/settings/clear-demo dùng feature hooks/AppPorts; `App.tsx` không còn gọi `usePorts()` trực tiếp; mock session mặc định unpaired.
- Validation sau binding nền đã pass: `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (16 files/60 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep Supabase/UI.
- Employees binding slice đã push commit `4d7d1ae`: thêm `employee.listEmployees()` cho admin, giữ `listActiveEmployees()` cho passcode, bind Employees drawer qua admin query/mutations, thêm component tests và khóa inactive visibility.
- Validation sau Employees slice đã pass: `npm run test -- employeeDrawer`, `npm run test` (17 files/65 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep Supabase/UI.
- Menu editor changeset save đã implement local: draft UI build `MenuChanges` từ snapshot gốc, sinh UUID client cho rows mới, gửi `created/updated/deleted` qua `useSaveMenuMutation` -> `menu.saveMenuChanges`, refetch menu sau save, và test component cover create item + tombstone category.
- Validation sau Menu editor slice đã pass: `npm run test -- menuEditorDrawer`, `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (18 files/67 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep Supabase/UI.
- Floor editor changeset save đã implement local: draft UI build `FloorPlanChanges` từ snapshot gốc, sinh UUID client cho area/table/decor mới, gửi `areas/tables/decorItems.created/updated/deleted` qua `useSaveFloorPlanMutation` -> `floorPlan.saveFloorPlan`, refetch floor plan sau save, giữ coordinates theo logical stage `1600x900` scale-to-fit, và không gửi/ghi đè `tables.status`.
- Validation sau Floor editor slice đã pass: `npm run test -- floorEditorDrawer`, `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `npm run test` (19 files/71 tests), `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep Supabase/UI.
- Report/History polish đã implement local: Order History drawer query qua `order.listOrderHistory(filter)`, detail qua `order.getOrder`, custom date range + pagination; Report drawer aggregate nhiều daily `report.getCoreReport({ businessDate })` qua `useCoreReportsQuery`, dùng history query cho recent paid orders, và mock report repo lọc đúng `businessDate`.
- Validation sau Report/History polish đã pass: `npm run test -- reportHistoryDrawer`, `npm run test` (20 files/75 tests), `npm run build`, `VITE_DATA_MODE=supabase npm run build`, `VITE_DATA_MODE=mock npm run smoke` (13 passed/7 skipped), `git diff --check`, boundary grep Supabase/UI.
- Việc còn lại của phase này: chạy Supabase-mode UI E2E có Store Key/test account rõ ràng.

---

## 2. Preflight bắt buộc

Chạy trong code worktree `D:\Workspace\pos-cafe-code`:

```powershell
git worktree list
git status --short --branch
git branch --show-current
git fetch origin
```

Điều kiện trước khi làm:

- Worktree sạch. Nếu có thay đổi chưa commit, dừng và báo user, không discard.
- Không đang ở branch `docs`.
- Không merge vào `codex/code-foundation` khi UI branch vẫn đang dùng branch này làm nền cố định.
- Integration branch phải được tạo từ UI branch đã xong, ví dụ:

```powershell
git switch <ui-branch-da-xong>
git pull --ff-only
git switch -c codex/integration-ui-logic
git merge origin/codex/stream-db-rpc
```

Nếu user chỉ định tên branch integration khác, dùng tên đó.

---

## 3. Boundary không được phá

Data flow bắt buộc:

```text
UI component
  -> feature hooks/services
  -> AppPorts
  -> adapters/mock hoặc adapters/supabase
  -> Supabase/RPC
```

Không được:

- Import `@supabase/supabase-js` trong `src/app`, `src/features`, `src/components`, `src/core`, `src/domain`, `src/ports`.
- Gọi `supabase.rpc`, `supabase.from`, `createClient` trong UI/hooks feature.
- Parse raw SQL/Supabase error string trong UI.
- Lưu raw Store Key/secret trong Zustand/session DTO/localStorage sau pairing/create.
- Hard-delete menu/floor/editor data từ UI.
- Rải realtime subscribe trong component hoặc từng repo domain.
- Ghi đè `tables.status` khi save floor-plan editor.

Được phép:

- UI gọi hooks/services đã có trong `src/features/*`.
- Hooks dùng `usePorts()` từ `src/ports/portsContext.tsx`.
- Query invalidation dùng shared keys từ `src/features/shared/queryKeys.ts`.
- Mock mode dùng `src/adapters/mock/*`; Supabase mode dùng runtime factory.

---

## 4. Merge conflict zones

Các vùng có khả năng conflict cao:

- `src/app/App.tsx`: UI branch có thể đã tách component, logic branch hiện còn mock monolith cũ.
- `src/app/AppProviders.tsx`: cần giữ `PortsContext` import từ `@/ports/portsContext`.
- `src/features/*`: UI branch có thể thêm hooks/components; logic branch có POS/admin/session/integration hooks.
- `src/adapters/mock/mockData.ts`: logic branch đã re-export demo seed data từ `src/seed/demoSeedData.ts`.
- `src/styles.css`: UI branch có thể chỉnh layout; logic branch gần đây không nên chạm UI style.

Cách xử lý:

- Ưu tiên giữ UI component split của UI branch.
- Giữ logic services/hooks/adapters của `codex/stream-db-rpc`.
- Nếu `App.tsx` conflict lớn, không copy nguyên mock monolith từ logic branch đè UI branch; chỉ lấy import/provider/hook binding cần thiết.
- Nếu query keys conflict, dùng `src/features/shared/queryKeys.ts` làm source chung; `src/features/pos/posQueryKeys.ts` chỉ là compatibility re-export.

---

## 5. Screen-to-logic binding checklist

| Màn/UI | Binding đúng | Kiểm tra |
|---|---|---|
| Landing | app state chọn pairing/create | Không gọi backend khi chỉ render landing |
| Store pairing | session flow hook/service -> `ports.auth.pairStore` | Không persist raw Store Key sau success |
| Create store | session flow -> `ports.auth.createStore` + seed retry state | `CreateStoreResult.storeKey` chỉ hiện một lần |
| Passcode | employee query + `verifyPin` | Current employee memory-only |
| App shell | Zustand UI state + role guard | Browser URL không đổi theo drawer |
| POS floor | `useFloorPlanQuery`, `useOpenOrdersQuery` | Table status lấy từ server/mock state |
| Order drawer | POS order draft helpers + submit service | Bàn trống chưa tạo DB trước khi submit |
| Payment drawer | payment flow service | Block thiếu tiền, complete trước receipt |
| Takeaway | takeaway open orders query + order drawer | Không gắn `tableId` cho takeaway |
| History | order history query có filter/page | Không load toàn bộ lịch sử khi app start |
| Employees | admin query/mutation hooks | Role guard ở UI/Core |
| Menu editor | draft changeset -> `menu.saveMenuChanges` | Deleted dùng tombstone |
| Floor editor | draft changeset -> `floorPlan.saveFloorPlan` | Save không ghi `tables.status` |
| Report | report query theo business date | Chỉ tính paid, loại void/open |
| Settings | settings mutation + clear demo flow | Clear demo block open orders |
| Realtime | `useRealtimeInvalidation` | Event chỉ invalidate/refetch, không patch state thủ công |

---

## 6. Error mapping bắt buộc

UI hiển thị thông báo thân thiện qua error mapper, nhưng giữ code gốc để debug:

| Error code | UI behavior |
|---|---|
| `ORDER_VERSION_CONFLICT` | Toast báo đơn đã thay đổi ở máy khác, refetch order/open orders/floor |
| `MENU_ITEM_UNAVAILABLE` | Toast món đã tạm ngưng, refetch menu, giữ draft để user sửa |
| `OPTION_VALUE_UNAVAILABLE` | Toast option/topping đã tạm ngưng, refetch menu |
| `PAYMENT_AMOUNT_TOO_LOW` | Báo thiếu tiền trong payment drawer, không gọi print receipt |
| `OPEN_ORDERS_BLOCK_CLEAR_DEMO` | Dialog clear demo báo còn đơn mở, không clear |
| `PIN_INVALID` hoặc auth error | Báo sai PIN/Store Key, không leak raw backend message |

Không parse raw SQL text trong component. Adapter/core map về `AppError` trước.

---

## 7. Automated checks sau merge

Chạy trong `D:\Workspace\pos-cafe-code`:

```powershell
npm run build
npm run test
npm run smoke
git diff --check
```

Structural grep:

```powershell
rg -n "@supabase/supabase-js|supabase\\.rpc|supabase\\.from|createClient\\(" src\\app src\\features
if (Test-Path src\\components) { rg -n "@supabase/supabase-js|supabase\\.rpc|supabase\\.from|createClient\\(" src\\components }
rg -n -F '@/app/portsContext' src
rg -n -F 'from "./portsContext"' src
rg -n -F "from './portsContext'" src
rg -n "@/features/pos/posQueryKeys" src\\features\\admin src\\features\\integration
rg -n "@/adapters/mock/mockData" src\\adapters\\supabase src\\app src\\core src\\domain src\\ports
git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\\.md)"
```

Expected:

- `npm run build`, `npm run test`, `npm run smoke` pass.
- Các grep boundary không trả kết quả.
- Code branch không chứa `docs/` hoặc `pos-cafe-context.md`.

---

## 8. Manual smoke sau automated checks

Mock mode:

- Landing -> pairing/create mock -> passcode -> POS floor.
- Mở bàn trống, thêm món, submit mock, thấy ticket/print preview.
- Mở bàn có order, payment cash đủ tiền, complete, thấy receipt.
- Mở takeaway list/order.
- Mở history/report/settings/employees/menu editor/floor editor.
- Editor dirty confirm hoạt động khi đổi drawer.
- Phone landscape vẫn thấy action chính; portrait hiện hướng dẫn xoay.

Supabase mode sau khi cloud setup xong:

- Pair Store Key thật.
- Verify PIN admin/cashier demo.
- 2 browser cùng store: submit order ở browser A, browser B refetch/table status cập nhật qua realtime invalidation.
- Payment ở browser B, browser A thấy table release/report cập nhật.
- Clear demo blocked khi còn open orders; clear được sau khi paid/void hết open orders.

---

## 9. Merge quyết định cuối

Chỉ merge integration branch tiếp khi:

- Automated checks pass.
- Manual smoke pass tối thiểu mock mode.
- Nếu đang chuẩn bị demo cloud, Supabase mode smoke pass.
- Không có regression UI layout nghiêm trọng trên desktop/tablet/phone landscape.
- User xác nhận merge target cuối cùng.

Không tự merge vào `codex/code-foundation` nếu branch đó vẫn là nền cố định cho UI work.
