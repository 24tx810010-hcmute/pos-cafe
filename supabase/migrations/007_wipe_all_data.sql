-- 007_wipe_all_data.sql
-- Xoá sạch TOÀN BỘ dữ liệu hiện có (kể cả store cũ) trước khi đổi mô hình modifier.
-- Lý do: tính năng modifier được làm dở dang theo mô hình cũ (option_groups gắn cứng
-- 1 món). Chuyển sang modifier dùng chung nên không migrate dữ liệu cũ — xoá hết để
-- tránh "mirage" dữ liệu. Dev/test chạy mock nên không ảnh hưởng.
--
-- CẢNH BÁO: KHÔNG HỒI PHỤC ĐƯỢC. Chỉ chạy trên project demo.
-- Sau bước này DB về trạng thái chưa có store nào → pair store + seed lại từ UI.

truncate table public.stores cascade;
