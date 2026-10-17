# Danh Mục Tài Liệu Tham Khảo Học Thuật

Lập ngày 2026-09-12 theo yêu cầu của chủ dự án, sau nhận xét của giảng viên phản biện: 17 nguồn của bản báo cáo cũ được trích đúng chỗ và nhất quán với nội dung kỹ thuật, nhưng **toàn bộ đều là tài liệu chính thức của framework và thư viện cùng trang giới thiệu sản phẩm cạnh tranh**, không có sách chuyên khảo hay bài báo học thuật nào về kiến trúc phần mềm, cơ sở dữ liệu hay bảo mật.

## Cách Dùng Tài Liệu Này

Đây là **danh mục đề xuất**, không phải danh mục cuối cùng. Nguyên tắc:

1. **Chỉ trích nguồn đã thực sự đọc phần liên quan.** Nhồi nguồn cho đủ số lượng là thứ hội đồng phát hiện được bằng đúng một câu hỏi.
2. **Mỗi nguồn phải gắn với một khẳng định cụ thể trong báo cáo.** Cột "Dùng ở đâu" dưới đây ghi sẵn chỗ trích dự kiến; nếu chỗ đó bị bỏ khi viết thì bỏ luôn nguồn.
3. **Giữ nguyên các nguồn chính thức đang có.** Tài liệu của React, TypeScript, PostgreSQL và nền tảng backend vẫn là nguồn đúng cho các khẳng định về hành vi công cụ. Danh mục này bổ sung tầng nguyên lý, không thay thế tầng công cụ.
4. **Kiểm lại lần xuất bản và số trang trước khi trích.** Năm và lần tái bản ghi ở đây là để tra cứu, chưa được đối chiếu với bản in tại thư viện.

## Nhóm 1 — Kiến Trúc Phần Mềm

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Cockburn, A. *Hexagonal Architecture* (bài viết gốc, 2005) | Chương kiến trúc: nguồn gốc của mô hình cổng và bộ điều hợp, thay cho việc chỉ dẫn blog |
| Martin, R. C. *Clean Architecture: A Craftsman Guide to Software Structure and Design*. Prentice Hall, 2017 | Chương kiến trúc: quy tắc phụ thuộc hướng vào trong, lý do tầng nghiệp vụ không được biết tới hạ tầng |
| Evans, E. *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley, 2003 | Chương kiến trúc và chương thiết kế: khái niệm tầng miền, mô hình nghiệp vụ tách khỏi kỹ thuật |
| Fowler, M. *Patterns of Enterprise Application Architecture*. Addison-Wesley, 2002 | Chương thiết kế: mẫu kho dữ liệu, ánh xạ dữ liệu, khóa lạc quan |
| Ford, N.; Parsons, R.; Kua, P. *Building Evolutionary Architectures*. O'Reilly, 2017 | Chương kiến trúc: khái niệm **hàm kiểm định kiến trúc**, đúng thứ mà việc kiểm tra ranh giới phụ thuộc bằng phân tích cấu trúc import đang hiện thực. Phản biện đánh giá đây là điểm mạnh nổi bật, nên nó xứng đáng có nền lý thuyết |
| Bass, L.; Clements, P.; Kazman, R. *Software Architecture in Practice*. 4th ed., Addison-Wesley, 2021 | Chương kiến trúc: thuộc tính chất lượng và đánh đổi kiến trúc |
| Larman, C. *Applying UML and Patterns*. 3rd ed., Prentice Hall, 2004 | Chương phân tích thiết kế: sách này dùng **chính một hệ thống điểm bán hàng làm ví dụ xuyên suốt**, nên đối chiếu use case, sơ đồ tuần tự và sơ đồ lớp của đồ án với chuẩn trong sách là so sánh cùng loại bài toán |

## Nhóm 2 — Cơ Sở Dữ Liệu Và Giao Dịch

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Gray, J.; Reuter, A. *Transaction Processing: Concepts and Techniques*. Morgan Kaufmann, 1993 | Chương thiết kế cơ sở dữ liệu: tính chất giao dịch, lý do đặt nghiệp vụ tiền trong thủ tục giao dịch thay vì xử lý rời rạc phía client |
| Bernstein, P. A.; Newcomer, E. *Principles of Transaction Processing*. 2nd ed., Morgan Kaufmann, 2009 | Chương thiết kế: hàng đợi, thử lại và ranh giới giao dịch |
| Kleppmann, M. *Designing Data-Intensive Applications*. O'Reilly, 2017 | Chương thiết kế và chương hạn chế: nhất quán, đồng thời, và ranh giới của mô hình nhiều thiết bị cùng ghi |
| Kung, H. T.; Robinson, J. T. "On Optimistic Methods for Concurrency Control". *ACM TODS*, 6(2), 1981 | Chương thiết kế: nền lý thuyết của **khóa lạc quan** đang dùng để phát hiện xung đột khi hai thiết bị cùng sửa một đơn |
| Berenson, H. và cộng sự. "A Critique of ANSI SQL Isolation Levels". *SIGMOD*, 1995 | Chương thiết kế: vì sao chọn mức cô lập đang dùng và hiện tượng nào bị loại trừ |
| Hellerstein, J. M.; Stonebraker, M.; Hamilton, J. "Architecture of a Database System". *Foundations and Trends in Databases*, 1(2), 2007 | Chương cơ sở lý thuyết: cấu trúc bên trong hệ quản trị, phục vụ phần giải thích chi phí truy vấn |
| Ramakrishnan, R.; Gehrke, J. *Database Management Systems*. 3rd ed., McGraw-Hill, 2003 | Chương thiết kế cơ sở dữ liệu: chuẩn hóa, khóa ngoại, ràng buộc toàn vẹn |

## Nhóm 3 — Chống Trùng, Thử Lại Và Hệ Phân Tán

Nhóm này phục vụ trực tiếp phần chống trùng và khôi phục lệnh ghi.

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Helland, P. "Idempotence Is Not a Medical Condition". *ACM Queue*, 10(4), 2012 | Chương thiết kế: định nghĩa tính lũy đẳng trong hệ thật, vì sao "gửi đúng một lần" là bất khả và phải thay bằng "áp dụng đúng một lần" |
| Helland, P. "Life beyond Distributed Transactions: an Apostate Opinion". *CIDR*, 2007 | Chương thiết kế: khóa nghiệp vụ và định danh do client sinh |
| Nygard, M. T. *Release It! Design and Deploy Production-Ready Software*. 2nd ed., Pragmatic Bookshelf, 2018 | Chương thiết kế và chương hạn chế: mẫu thử lại, hết giờ, và phản hồi không rõ kết quả |
| Gray, J. "The Transaction Concept: Virtues and Limitations". *VLDB*, 1981 | Chương cơ sở lý thuyết: giới hạn của khái niệm giao dịch |
| Tanenbaum, A. S.; Van Steen, M. *Distributed Systems*. 3rd hoặc 4th ed. | Chương cơ sở lý thuyết: ngữ nghĩa gọi từ xa, vì sao mất phản hồi không đồng nghĩa lệnh chưa chạy |

## Nhóm 4 — Bảo Mật Và Phân Quyền

Nhóm này trả lời trực tiếp hai khuyết điểm bảo mật mà phản biện nêu.

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Saltzer, J. H.; Schroeder, M. D. "The Protection of Information in Computer Systems". *Proceedings of the IEEE*, 63(9), 1975 | Chương bảo mật: nguyên tắc **đặc quyền tối thiểu** và **mặc định an toàn**. Đây là khung lý thuyết đúng để tự phê bình việc cấp PIN mặc định giống nhau cho mọi cửa hàng |
| NIST SP 800-63B. *Digital Identity Guidelines: Authentication and Lifecycle Management* | Chương bảo mật: yêu cầu về bí mật ghi nhớ được, cách xử lý bí mật cấp ban đầu, và chống thử sai nhiều lần. Nguồn chuẩn mực để bảo vệ quyết định ép đổi PIN ở lần đăng nhập đầu |
| Sandhu, R. và cộng sự. "Role-Based Access Control Models". *IEEE Computer*, 29(2), 1996 | Chương phân quyền: nền lý thuyết của mô hình vai trò và quyền đang được tổ chức lại |
| Ferraiolo, D.; Kuhn, R. "Role-Based Access Controls". *15th NIST-NCSC National Computer Security Conference*, 1992 | Chương phân quyền: bài gốc của mô hình vai trò |
| OWASP *Application Security Verification Standard* (ASVS), phiên bản 4.x | Chương bảo mật: danh mục kiểm tra xác thực và kiểm soát truy cập, dùng làm thước đo tự đánh giá |

## Nhóm 5 — Kiểm Thử Và Chất Lượng

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Meszaros, G. *xUnit Test Patterns: Refactoring Test Code*. Addison-Wesley, 2007 | Chương kiểm thử: phân loại vật thế thân, nền lý thuyết cho bộ điều hợp giả lập chạy song song bộ điều hợp thật |
| Beck, K. *Test-Driven Development: By Example*. Addison-Wesley, 2002 | Chương kiểm thử: viết kỳ vọng trước khi viết mã |
| Inozemtseva, L.; Holmes, R. "Coverage Is Not Strongly Correlated with Test Suite Effectiveness". *ICSE*, 2014 | Chương kiểm thử: nguồn để trình bày độ phủ một cách trung thực, giải thích vì sao con số độ phủ phải đi kèm phạm vi đo chứ không đứng một mình |
| Myers, G. J.; Sandler, C.; Badgett, T. *The Art of Software Testing*. 3rd ed., Wiley, 2011 | Chương kiểm thử: phân loại ca kiểm thử, giá trị biên |
| Sommerville, I. *Software Engineering*. 10th ed., Pearson, 2015 | Chương phương pháp: quy trình phát triển và quản lý phạm vi |

## Nhóm 6 — Hướng Phát Triển

Dùng cho chương hạn chế và hướng phát triển, để mỗi hướng đề xuất có một nguồn thay vì chỉ là ý định.

| Nguồn | Dùng ở đâu trong báo cáo |
| --- | --- |
| Kleppmann, M. và cộng sự. "Local-First Software: You Own Your Data, in Spite of the Cloud". *Onward!*, 2019 | Hướng phát triển ngoại tuyến: đặt nhóm offline đang hoãn vào một khung khái niệm có tên gọi |
| Shapiro, M. và cộng sự. "Conflict-Free Replicated Data Types". *SSS*, 2011 | Hướng phát triển ngoại tuyến: cơ sở của việc hòa giải xung đột sau khi có mạng trở lại |
| Fielding, R. T. *Architectural Styles and the Design of Network-based Software Architectures*. Luận án tiến sĩ, UC Irvine, 2000 | Chương kiến trúc: nền của kiểu giao tiếp giữa client và máy chủ |

## Việc Còn Phải Làm

| Việc | Ghi chú |
| --- | --- |
| Chốt quy cách trích dẫn | Trường yêu cầu IEEE, APA hay kiểu riêng? Toàn bộ danh mục phải định dạng lại theo đúng một kiểu |
| Đối chiếu bản in | Kiểm lần xuất bản, năm và nhà xuất bản tại thư viện trước khi đưa vào danh mục cuối |
| Bổ sung nguồn tiếng Việt | Chưa có giáo trình hoặc bài báo tiếng Việt nào trong danh mục. Nếu khoa yêu cầu thì cần tìm bổ sung, ưu tiên giáo trình cơ sở dữ liệu và công nghệ phần mềm đang dùng trong chương trình |
| Cắt bớt sau khi viết xong | Danh mục này rộng hơn mức một khóa luận cần. Sau khi viết xong các chương, bỏ mọi nguồn không còn chỗ trích |
