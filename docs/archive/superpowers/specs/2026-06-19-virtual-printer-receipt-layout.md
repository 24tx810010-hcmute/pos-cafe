# Virtual Printer + Receipt Layout

> **Ngày:** 2026-06-19
> **Phạm vi:** docs branch `D:\Workspace\pos-cafe-docs` trên branch `docs`. Branch này phải giữ riêng để ghi handoff/spec và **không merge vào `main`**.

## Mục tiêu

- Hoàn thiện layout phiếu tạm và hóa đơn cuối cho MVP bằng `IPrintPort`.
- `PrintPort` vẫn là browser HTML print-preview, mở template HTML để preview/in qua trình duyệt. Không tích hợp native printer, driver, USB, ESC/POS hoặc service máy in thật trong phase này.

## Boundary kiến trúc

- Luồng đúng: `UI/features -> AppPorts/IPrintPort -> print adapter`.
- UI/features chỉ gọi port và truyền DTO/payload đã chuẩn hóa.
- Print adapter chịu trách nhiệm render HTML/template preview.
- Không để Supabase lọt vào `UI`, `features`, `core`, `domain`, hoặc `ports`.
- Không import `@supabase/*`, Supabase client, URL/key, row type, RPC shape hoặc adapter detail ngoài tầng adapter.

## Payload phiếu/hóa đơn

Planned/implemented payload cần ghi đủ các trường sau:

- Dòng món: tên món, số lượng, đơn giá, `lineTotal`, ghi chú món (`item note`), option/topping nếu có.
- Thông tin quán: tên quán, địa chỉ, footer hóa đơn.
- Nhân sự: nhân viên/cashier thao tác.
- Thời điểm: `printedAt` cho phiếu tạm, `paidAt` cho hóa đơn đã thanh toán.
- Thanh toán: `paymentMethod`.

## Migration

- Nếu cần đổi schema/RPC để lưu hoặc trả thêm field phục vụ receipt, tạo migration mới `supabase/migrations/005_*`.
- Không sửa migration `003` đã apply/được xem là live history. Sửa `003` chỉ phù hợp trước khi apply live, không dùng cho phase này.

## Ghi chú triển khai

- Giữ format tiền integer VND.
- Receipt layout không được làm thay đổi source of truth tính tiền: DB/RPC vẫn là nguồn snapshot giá/tên và tổng.
- Nếu UI cần thêm field hiển thị, cập nhật domain/port DTO trước, adapter map sau; không shortcut bằng cách truyền raw Supabase row vào print layer.
