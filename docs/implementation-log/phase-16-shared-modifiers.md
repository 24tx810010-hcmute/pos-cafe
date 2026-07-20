# Phase 16 - Shared Modifiers (tuỳ chọn món dùng chung)

## Mục tiêu

- Làm lại tính năng modifier (size/topping) cho đúng nghiệp vụ: nhóm tuỳ chọn **dùng chung** cho mọi món, món nào cần thì gắn vào (nhiều-nhiều) — thay vì mô hình cũ gắn cứng mỗi nhóm vào đúng 1 món.
- Bổ sung **mắt xích còn thiếu**: popup chọn modifier khi gọi món ở màn order (trước đây bấm món là thêm thẳng với `options: []`, không có chỗ chọn size/topping).
- Cho **số lượng** từng modifier (nhóm chọn-nhiều), mặc định 1.

## Branch/Commit

- Code commit: `a85e606` (`feat(menu): shared modifiers with order picker and quantity`).
- Docs commit: `95c31e7`.

## Bối cảnh / khảo sát

- Tính năng được Codex làm dở theo mô hình sai: `option_groups.menu_item_id` gắn 1 nhóm vào 1 món; toàn bộ pipeline (tính giá, snapshot, RPC, in) đã hỗ trợ options nhưng **không bao giờ được kích hoạt** vì màn order không có UI chọn.
- Quyết định sản phẩm đã chốt với người dùng: (1) quantity chỉ cho nhóm chọn-nhiều; (2) ràng buộc đơn giản — chỉ `select_type` + `is_required`, **bỏ** `min_select`/`max_select`; (3) **wipe sạch** dữ liệu Supabase (kể cả store cũ) thay vì migrate.

## Đã implement

### Data model (domain/core)
- `OptionGroup`: bỏ `menuItemId`, `minSelect`, `maxSelect`. Thêm `MenuItemOptionGroup` (bảng nối) + `menuItemOptionGroups` trong `MenuCatalog`.
- `SubmitOrderDraftOption` + `OrderItemOptionSnapshot`: thêm `quantity`.
- `core/orderDraft.ts`: giá nhân `priceDelta × quantity`; validate option qua liên kết `menuItemOptionGroups`; thêm `validateModifierSelection`/`isGroupSelectionValid`.
- `features/pos/orderFlow.ts`: `addDraftMenuItem(options)`, `getItemModifierGroups`, cart line `×N`, signature gồm quantity. Hook `useOrderModifierPicker` điều phối popup vs thêm thẳng.

### Adapters + DB
- Mock: `mockState`/`menuRepo` xử lý link changeset; seed `menuItemOptionGroups`; ticket/receipt hiển thị `×N`.
- Supabase: `mappers`/`menuRepo`/`orderRepo`/`seedBundle` theo schema mới.
- Migrations: `007_wipe_all_data.sql` (`truncate stores cascade`), `008_modifier_rework.sql` (bảng nối + drop cột + cột `quantity` + RLS/realtime + `submit_order_changes`/`pay_order`/`clear_demo_data` cập nhật validate qua bảng nối và nhân/hiển thị quantity).

### Admin editor
- Nhóm tuỳ chọn thành **thư viện dùng chung**: `useMenuModifierDrafts` (state + ops cho group/value/link), popup `ModifierGroupEditor` (sửa nhóm + giá trị), panel chi tiết món dùng **checkbox** gắn/bỏ nhóm.

### Order
- `ModifierPickerPopup`: single = radio, multi = checkbox + stepper số lượng, hiển thị giá tạm tính, nút `Thêm vào đơn` khoá đến khi hợp lệ. Món không có nhóm → thêm thẳng như cũ.

## Quyết định kỹ thuật

- Modifier là thư viện dùng chung (nhiều-nhiều) thay vì gắn cứng — sửa nhóm một nơi áp cho mọi món.
- Bỏ `min/max_select`, chỉ giữ single/multi + required cho gọn UI (khớp app tham khảo).
- Quantity chỉ cho nhóm multi; single luôn 1.
- Wipe data sạch (không migrate) vì đang giai đoạn dev và mô hình đổi căn bản.
- Tách logic ra hook (`useMenuModifierDrafts`, `useOrderModifierPicker`) để giữ drawer dưới ngưỡng line-count guard.

## Verification

- `npx tsc -b` + `npm run build`: passed.
- `npm test`: 192/192 passed (thêm `modifier.test.ts`, `ModifierPickerPopup.test.tsx`; cập nhật test cũ).
- `npm run smoke` (desktop): flow chính + test mới "ordering an item with modifiers opens the picker" passed.
- Tại checkpoint phase 16 chưa chạy Supabase thật. Trạng thái này đã được supersede: chuỗi migration 007/008 đã có trên cloud trước các validation phase 18/19 (009→011), và các E2E Supabase sau đó đã pass.

## Known Gaps/Risks

- Migration 007 xoá **toàn bộ** dữ liệu Supabase — không hồi phục, chỉ chạy trên project demo.
- Chưa hỗ trợ sửa lại modifier của một dòng giỏ đã thêm (phải xoá rồi thêm lại) — để lại nếu cần.
- `pay_order`/`submit_order_changes` được `create or replace` lại trọn trong 008; nếu sửa RPC sau này nhớ đồng bộ.

## Liên quan

- [../data-model.md](../data-model.md) — nhóm Menu/Order (bảng nối + quantity).
- [../features.md](../features.md) — POS ordering + Admin menu editor.
