# Đối chiếu review ngoài và biên tập bộ spec

Ngày 2026-09-09. Phạm vi: 13 file của add-idempotent-write-operations, đối chiếu chuẩn spec, baseline, roadmap và main@7183b31. Đây là kiểm tra tài liệu, không phải kiểm thử implementation.

## Kết luận

Review ngoài phát hiện đúng vấn đề chính: bản spec có lỗi dấu cách trên diện rộng, thiếu một bảng thuật ngữ chung, mất phần hỏi–đáp ở proposal và chưa làm rõ khối lượng so với lịch. Analyst nhận trách nhiệm về chất lượng trình bày; kết luận trước đó rằng tài liệu đã sẵn sàng dùng cho báo cáo là quá sớm.

Tuy nhiên, cần sửa ba điểm trong chính review: G và F0 đã được định nghĩa trong testplan; có 11 requirement MODIFIED; tổng 78,5 giờ đã tính ba lượt reviewer và một đơn vị sửa lỗi. Những đính chính này không làm mất giá trị của các góp ý còn lại.

## Kiểm từng nhận xét

| Nhận xét | Kết quả đối chiếu | Xử lý |
| --- | --- | --- |
| 1. Mất dấu cách có hệ thống | Đúng. Có lỗi trong proposal, design, use case, testcase và scenario. Không xác nhận các số 27/88/119/793 như số đo tái lập, vì review không cung cấp quy tắc đếm. | Biên tập cả bộ, tách từ/số/đơn vị, trình bày lại fixture và giữ nguyên các bảo đảm nghiệp vụ. |
| 2. K/R1/G/F0 không có định nghĩa | Đúng về việc thiếu điểm tra cứu chung, nhưng khẳng định “không có trong cả 13 file” quá rộng: testplan A3 đã mô tả G; A5 đã có bảng F0–F7. K/R1 được dùng rải rác, chưa có định nghĩa tập trung. | Thêm bảng thuật ngữ ở đầu proposal, giải thích K/R1/G/F0 và trỏ từ các artifact còn lại. |
| 3. Không làm rõ xung đột lịch | Đúng. Roadmap đã cảnh báo cần rà lịch, nhưng proposal chưa đưa ra khối lượng để duyệt. Phần phiên/quyền được kéo vào sớm hơn lịch mục 4. | Thêm phép tính 76,5 + 2n giờ, phần review đã nằm trong tổng, và 12 giờ task 09–14. Ghi rõ lịch/phạm vi chưa chốt; chưa đổi ngày hay cắt bảo đảm. |
| 4. Trích dẫn không nguyên văn | Đúng. “hai đơn chỉ cùng bàn” là diễn giải, không phải câu nguyên văn baseline. | Dùng đúng câu: “Hai đơn sau khi tách MUST độc lập với nhau, chỉ cùng nhãn bàn.” |
| 5. Mất chuỗi hỏi–đáp | Đúng. Chỉ dẫn tới evidence không thay được dấu vết phân tích ngay trong proposal. | Khôi phục nguyên văn bảy câu hỏi, gạch câu đã giải quyết, nối với câu trả lời và bảng quyết định hiện hành. Giữ 32 PRE-IDEM ở bản evidence nguyên vẹn. Đây là khôi phục thông tin đã có, không cần chủ dự án quyết lại nghiệp vụ. |
| 6. Ngày không nhất quán | Đúng về tính nhất quán. SPEC-STANDARD yêu cầu ghi ngày quyết định; không quy định riêng rằng chỉ ISO mới hợp lệ. | Dùng YYYY-MM-DD cho ngày biên tập và quyết định của bộ hiện hành. Các mốc trong evidence cũ giữ nguyên. |
| 7. define-test-strategy đã archive | Đúng; thư mục archive tồn tại. | Ghi “đã archive” và dẫn đúng proposal trong archive. |
| 8. Đường dẫn riêng của máy | Góp ý hợp lý cho tài liệu báo cáo; không phải lỗi nghiệp vụ. | Trong proposal/design dùng worktree main và worktree docs; bằng chứng kiểm tra kỹ thuật có thể vẫn ghi đường dẫn môi trường. |

## Đính chính số lượng và cách tính

- **33 requirement, 12 use case, 93 testcase gốc, 13 file Markdown, 7 capability:** khớp. Đây là số thiết kế; số execution còn phụ thuộc các biến thể bắt buộc.
- **11 MODIFIED**, gồm employee-session 1, access-control 2, order-management 2, payment 3, order-void 1, receipt-printing 2. Thêm 22 requirement mới bằng 33. Các tiêu đề được so với baseline, không chỉ so tổng.
- **43 đầu mục:** 42 mục ngoài task 40 cộng 76,5 giờ. Ba reviewer ở task 37–39 chiếm 6 giờ trong số đó. Task 40 là 2 giờ cho mỗi task sửa lỗi; tổng là 76,5 + 2n, bằng 78,5 khi n = 1.
- “2–3 tuần” cần giả định quỹ giờ. Riêng 76,5 giờ tương đương 1,9 tuần nếu tập trung 40 giờ/tuần, hoặc 3,8 tuần nếu 20 giờ/tuần, chưa tính chờ môi trường và sửa lỗi. Không thể chuyển thẳng giờ công thành lịch cam kết.

Mức ước lượng từng task không quá 2 giờ còn phải được kiểm lại khi triển khai. Nếu tách thêm task hoặc gặp công việc chưa tính, tổng phải cập nhật; phép cộng đúng không chứng minh ước lượng đã chính xác.

## Kiểm các dẫn chứng code

Bốn điểm review nêu đều khớp baseline main@7183b31:

| Đường dẫn từ gốc main | Điều kiểm được |
| --- | --- |
| src/features/pos/orderFlow.ts:66 | snapshotToDraft tạo client ID mới cho draft. |
| src/features/pos/orderFlow.ts:241 | normalizedDraft không giữ ID và giá trong biểu diễn dùng so sánh. |
| src/app/components/ReceiptPreview.tsx:14 | Phép cộng priceDelta không nhân option.quantity ở chỗ review chỉ ra. |
| supabase/migrations/011_void_paid_order.sql:83,158 | expected lock version là tham số integer có thể NULL; phép so sánh <> không tự loại NULL. |

Đây là kết luận từ đọc mã, không phải bằng chứng đã tái hiện sự cố thực tế. Các đoạn nguyên văn và diễn giải đầy đủ nằm ở [review 12](12-chuan-bi-ra-cuoi-truoc-code.md) và [design hiện hành](../../../openspec/changes/add-idempotent-write-operations/design.md).

## Nội dung đã cập nhật và giới hạn

[Proposal](../../../openspec/changes/add-idempotent-write-operations/proposal.md) có thuật ngữ, chuỗi hỏi–đáp, nguồn/ngày quyết định và phân tích lịch. [Tasks](../../../openspec/changes/add-idempotent-write-operations/tasks.md) có bảng cộng giờ và cổng chốt lịch/phạm vi. [Roadmap](../../roadmap.md) ghi khối lượng mới và sự thay đổi phụ thuộc, giữ các mốc cũ để chủ dự án quyết.

Không bỏ testcase, không giảm phạm vi giá/quyền/khôi phục, không sửa ứng dụng. Bản proposal trước bộ spec và các báo cáo reviewer cũ không bị viết lại; hash/lời kết luận của chúng chỉ đại diện cho mốc đã đọc. Lần đối chiếu này do analyst thực hiện, không gán thành một vòng chạy lại của ba reviewer độc lập.

[Bằng chứng kiểm tra sau biên tập](evidence/2026-09-09-editorial-validation.md) ghi lệnh, kết quả và hash hiện hành. Kiểm cấu trúc/ma trận/liên kết không chứng minh mọi câu văn đã hoàn hảo hoặc phần mềm hoạt động đúng. 93 testcase mới vẫn chưa hiện thực/chưa chạy; test DB chưa được preflight trong lượt này. Chưa commit/push.

## Đề xuất để chủ dự án cân nhắc

Giữ các bảo đảm đã thống nhất và rà lại lịch theo quỹ giờ thực tế là phương án analyst khuyến nghị. Ưu điểm: giữ được tính nhất quán giữa quyền, chống trùng và phục hồi; tránh cắt phần cần thiết rồi tuyên bố bảo đảm quá mức. Nhược điểm: mục 2 chiếm thời gian nhiều hơn lịch gốc và có thể làm các mục sau phải dời hoặc thu hẹp.

Nếu quỹ giờ không đủ, cần một phương án phạm vi nhỏ hơn với danh sách bảo đảm, luồng và testcase thay đổi để duyệt lại. Không tự chọn cắt giảm trong lượt kiểm review này.

## Bổ sung 2026-09-10: phạm vi biên tập và ảnh hưởng lịch

Review ngoài đã kiểm lại và xác nhận ba đính chính, bộ 13 artifact, dấu cách, ma trận, bảy câu hỏi và phép cộng giờ. Đây là kết quả reviewer báo lại trong hội thoại; không giả là lượt analyst hoặc ba subagent vừa chạy thêm.

Nhận xét còn sót ở tài liệu điều hướng là đúng, kể cả các heading vừa thêm. Đã sửa dấu cách trong openspec/README.md, README của tập review và roadmap; chuẩn hóa ngày của ba tài liệu điều hướng sang YYYY-MM-DD. Việc đổi cách ghi ngày không thay đổi ngày lịch sử, thứ tự ưu tiên hoặc các khoảng lịch đã ghi.

### Nguyên tắc giữ lịch sử và cập nhật điều hướng

- Hai README và roadmap là tài liệu đang cập nhật: sửa lỗi trình bày và thông tin điều hướng ngay khi phát hiện.
- Tài liệu **14** là biên bản của một mốc review. Giữ nguyên thân bài, lỗi dấu cách, các số đo và hash đã ghi; không biên tập lại để làm bản cũ trông sạch hơn. Thông báo đính chính đã có ở đầu file 14 được giữ nguyên. Những lỗi trình bày còn nhìn thấy ở đó là phần lịch sử được giữ có chủ đích.
- Evidence và báo cáo reviewer cũ cũng giữ nguyên. Bổ sung mới ghi ngày riêng tại tài liệu hiện hành và tạo bằng chứng mới; không thay log cũ bằng kết quả mới.
- Tài liệu 15 có thể được bổ sung như mục này, với ngày và phạm vi rõ ràng; phần kết quả ngày 2026-09-09 phía trên vẫn mô tả lần kiểm trước.

### Điều chỉnh kết luận về lịch của review ngoài

Yêu cầu trình bày tác động tới mục 3–10 là hợp lý. Tuy nhiên, phải tính ba tuần của mục 7–8 đã hoãn và không tự dùng bốn ngày đệm cuối. “Gần 40 giờ giữ nguyên, gần 20 giờ buộc cắt” chưa suy ra được từ dữ liệu hiện có.

[Proposal, mục Khối lượng và xung đột lịch](../../../openspec/changes/add-idempotent-write-operations/proposal.md) đã có bảng các mục 2–10, giả định bắt đầu 2026-09-11, n = 1 và tạm giữ tám tuần của mục 3–6:

| Trường hợp | Mục 2 | Mục 6 kết thúc | Hệ quả nếu giữ các giả định |
| --- | --- | --- | --- |
| 40 giờ/tuần cho mục 2 | 2 tuần | 2026-11-19 | Ba tuần hoãn offline hấp thụ được dịch chuyển; giữ lịch mục 9 và hai tuần báo cáo, còn một tuần trước mục 9. |
| 20 giờ/tuần cho mục 2 | 4 tuần | 2026-12-03 | Mục 9 đẩy sang 2026-12-04 đến 2026-12-10; nếu viết đủ hai tuần sau đó thì kết thúc 2026-12-24. Thiếu một tuần để giữ lịch báo cáo cũ, không phải mất toàn bộ cửa sổ. |

Ngưỡng số học riêng của mục 2 là (76,5 + 2n) / 3, khoảng 26,2 giờ/tuần khi n = 1. Không coi đây là bảo đảm toàn dự án: chưa biết tám tuần của mục 3–6 có đủ ở quỹ giờ thực tế, chưa tính lại phần trùng với mục 4 và thời gian chờ.

**Chủ dự án trả lời ngày 2026-09-10:** “tôi không có thời gian cố định, nhưng đảm bảo ngày nào cũng làm”. Ghi nhận việc làm hằng ngày, không tự chuyển thành cam kết 20/40 giờ. Trước mắt chưa chọn lịch hoặc cắt phạm vi; analyst đề xuất lấy dữ liệu giờ thực làm và đầu ra được kiểm chứng trong tuần triển khai đầu để cập nhật dự báo. Nếu thiếu thời gian thì trình phương án điều chỉnh toàn dự án để chủ dự án chọn.

[Bằng chứng kiểm tra bổ sung](evidence/2026-09-10-navigation-and-schedule-validation.md) ghi mô hình ngày, kiểm liên kết, cấu trúc, các file lịch sử giữ nguyên và trạng thái kiểm thử. Chưa triển khai ứng dụng, chưa chạy testcase mới, chưa commit/push.
