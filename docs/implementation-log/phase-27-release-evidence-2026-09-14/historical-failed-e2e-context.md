# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: idempotencyRecovery.spec.ts >> TC-IDEM-068/e2e/terminal=rejected recovers its durable decision after the browser loses an observed committed ACK
- Location: tests\supabase\idempotencyRecovery.spec.ts:85:68

# Error details

```
Test timeout of 45000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - complementary [ref=e4]:
      - 'generic "Đang đăng nhập: A · Quản lý" [ref=e6]':
        - generic [ref=e7]: A
        - generic [ref=e8]:
          - generic [ref=e9]: Đang đăng nhập
          - strong [ref=e10]: A
          - generic [ref=e11]: Quản lý
      - navigation "POS modules" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Vận hành
          - button "Bàn" [ref=e15] [cursor=pointer]:
            - img [ref=e17]
            - generic [ref=e22]: Bàn
          - button "Tra cứu thao tác" [ref=e23] [cursor=pointer]:
            - img [ref=e25]
            - generic [ref=e28]: Tra cứu thao tác
          - button "Mang đi" [ref=e29] [cursor=pointer]:
            - img [ref=e31]
            - generic [ref=e34]: Mang đi
          - button "Lịch sử" [ref=e35] [cursor=pointer]:
            - img [ref=e37]
            - generic [ref=e39]: Lịch sử
        - generic [ref=e40]:
          - generic [ref=e41]: Quản trị
          - button "Nhân viên" [ref=e42] [cursor=pointer]:
            - img [ref=e44]
            - generic [ref=e49]: Nhân viên
          - button "Menu" [ref=e50] [cursor=pointer]:
            - img [ref=e52]
            - generic [ref=e54]: Menu
          - button "Sơ đồ" [ref=e55] [cursor=pointer]:
            - img [ref=e57]
            - generic [ref=e62]: Sơ đồ
          - button "Báo cáo" [ref=e63] [cursor=pointer]:
            - img [ref=e65]
            - generic [ref=e67]: Báo cáo
          - button "Thanh toán" [ref=e68] [cursor=pointer]:
            - img [ref=e70]
            - generic [ref=e76]: Thanh toán
          - button "Cài đặt" [ref=e77] [cursor=pointer]:
            - img [ref=e79]
            - generic [ref=e82]: Cài đặt
      - button "Khoá" [ref=e84] [cursor=pointer]:
        - img [ref=e86]
        - generic [ref=e89]: Khoá
    - generic [ref=e91]:
      - generic [ref=e92]:
        - generic [ref=e93]:
          - button "Khu A" [ref=e95] [cursor=pointer]
          - button "Làm mới" [ref=e96] [cursor=pointer]:
            - img [ref=e97]
            - text: Làm mới
          - generic [ref=e102]:
            - button "Tất cả" [ref=e103] [cursor=pointer]
            - button "Trống" [ref=e104] [cursor=pointer]
            - button "Đang phục vụ" [ref=e105] [cursor=pointer]
        - button "B01 150K" [ref=e110] [cursor=pointer]:
          - generic [ref=e111]:
            - strong [ref=e112]: B01
            - generic [ref=e113]: 150K
      - complementary [ref=e114]:
        - generic [ref=e115]: Đơn đang mở · 1
        - 'button "B01 #12 Đang phục vụ 150K" [ref=e117] [cursor=pointer]':
          - generic [ref=e118]:
            - strong [ref=e119]: B01
            - generic [ref=e120]: "#12"
          - generic [ref=e121]:
            - generic [ref=e122]: Đang phục vụ
            - generic [ref=e123]: 150K
  - generic [ref=e125]:
    - generic [ref=e126]:
      - heading "Tra cứu thao tác trên server" [level=2] [ref=e127]
      - button "Đóng" [ref=e128] [cursor=pointer]: Đóng
    - generic [ref=e129]:
      - paragraph [ref=e130]: Đóng màn hình hoặc mất kết nối không hủy lệnh. Chỉ tiếp tục đúng thao tác đã chọn sau khi kiểm tra nội dung.
      - generic [ref=e131]:
        - generic [ref=e132]:
          - text: Trạng thái
          - combobox "Trạng thái thao tác" [ref=e133]:
            - option "Tất cả" [selected]
            - option "Chưa thực hiện"
            - option "Đã ghi thành công"
            - option "Đã từ chối"
            - option "Đã hủy lệnh"
            - option "Lệnh hết hạn"
        - generic [ref=e134]:
          - text: Mã đơn
          - textbox "Mã đơn" [ref=e135]
        - generic [ref=e136]:
          - text: Loại thao tác
          - combobox "Loại thao tác" [ref=e137]:
            - option "Tất cả" [selected]
            - option "Tạo / sửa / hủy đơn mở"
            - option "Thanh toán toàn bộ"
            - option "Thanh toán phần chọn"
            - option "Hủy đơn đã thanh toán"
        - generic [ref=e138]:
          - text: Từ
          - textbox "Đăng ký từ" [ref=e139]
        - generic [ref=e140]:
          - text: Đến
          - textbox "Đăng ký đến" [ref=e141]
        - button "Tải lại" [ref=e142] [cursor=pointer]: Tải lại
      - alert [ref=e143]: Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN.
      - generic [ref=e144]:
        - region "Danh sách thao tác" [ref=e145]:
          - button "Trang đầu" [disabled]
          - button "Trang tiếp" [disabled]
        - region "Chi tiết thao tác" [ref=e146]:
          - paragraph [ref=e147]: Chọn một thao tác để xem nội dung đã lưu.
```