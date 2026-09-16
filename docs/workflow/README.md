# Quy trình task với AI cho POS-cafe

Hiệu lực: **2026-09-16**. Chủ dự án yêu cầu áp dụng cho task mới sau khi thảo luận và phản biện quy trình. Hai mục tiêu cùng tồn tại: sản phẩm kiểm chứng được và hồ sơ có thể dùng để viết/bảo vệ đồ án.

[Dùng ngay ở task mới](start-task.md) · [Các mẫu](templates.md) · [Bàn giao theo task](tasks/README.md) · [Chuẩn spec](../../openspec/SPEC-STANDARD.md) · [Quyết định áp dụng](../../openspec/changes/adopt-ai-task-workflow/proposal.md)

## Đầu ra và vị trí lưu

| Nội dung | Nơi lưu và trách nhiệm |
| --- | --- |
| Code ứng dụng, test, công cụ kiểm chứng, CI | Nhánh `main`; chạy thật theo phạm vi được giao |
| Đặc tả, thiết kế, câu hỏi và quyết định của feature | Nhánh `docs`, trong change OpenSpec tương ứng |
| Quy trình và mẫu dùng chung | Thư mục này trên nhánh `docs` |
| Bàn giao ngắn của từng task | `docs/workflow/tasks/<task-id>.md`, được chỉ mục trong `tasks/README.md` |
| Bằng chứng và giải thích kết quả | Biên bản dưới `docs/implementation-log/`; liên kết log/report/ảnh được lưu ở nơi phù hợp, không đưa bí mật vào docs |
| Quyết định dùng chung nhiều feature | Một hồ sơ quyết định trên `docs`, được liên kết từ các change dùng nó; không sao chép nhiều bản có thể lệch |

`main` và `docs` là hai nhánh của cùng repo, có worktree riêng. Tài liệu ở `docs` không có nghĩa thay đổi chưa commit đã có trong ref `docs`. Luôn nhận diện worktree, HEAD và phần chưa commit khi dùng tài liệu/code làm đầu vào. Giữ các con trỏ hướng dẫn hiện có trên `main`; không nhân đôi toàn bộ quy trình vào code.

Task phân tích chỉ cần đầu ra phân tích/spec trong phạm vi được yêu cầu. Task triển khai cần cả phần mềm và hồ sơ. Hoàn thành việc code không tự có nghĩa đã được chủ dự án nghiệm thu hoặc đã phát hành.

## Khởi động và tiếp tục một task

1. Đọc `AGENTS.md`, chuẩn spec và tài liệu này từ worktree `docs` đã xác minh bằng Git. Nếu đang ở checkout thiếu con trỏ hướng dẫn, làm theo [câu mở đầu](start-task.md).
2. Đọc chỉ mục bàn giao, chọn đúng task; đọc đề bài, quyết định còn hiệu lực và các nguồn được liên kết. Nếu chưa có bàn giao, lập từ nguồn thực tế và đánh dấu điều chưa xác minh.
3. Kiểm tra nhánh/HEAD/trạng thái thay đổi của code và docs. Chỉ khảo sát code, tests, migrations và tài liệu liên quan. Bàn giao là chỉ dẫn, không thay việc kiểm tra phần đã thay đổi từ lần trước.
4. Tóm tắt kết quả cần tạo, phạm vi được giao, điều đã biết/chưa biết, dependency và tiêu chí hoàn thành. Dùng mẫu đề bài; người dùng không phải tự điền mọi trường.
5. Ghi trạng thái task và tiếp tục bước phù hợp bên dưới. Không buộc task đang làm quay lại từ đầu; chỉ bổ sung khoảng trống cần thiết cho phần tiếp theo.

Code là bằng chứng về hành vi đang có; spec đã duyệt là chuẩn cho hành vi mong muốn. Khi chúng khác nhau, xác định đó là lỗi, spec cũ hay thay đổi chưa được duyệt; không tự sửa yêu cầu để hợp thức hóa code. Những nhận định về hành vi hiện tại phải có nguồn file/dòng. Với câu hỏi kỹ thuật chưa chắc, tra tài liệu gốc hoặc thực nghiệm có kiểm soát; phân biệt bằng chứng với giả thuyết.

<a id="phan-muc"></a>
## Phân mức theo tác động

| Mức | Điều kiện | Cách thực hiện |
| --- | --- | --- |
| Nhẹ | Phạm vi xác định; không đổi nghiệp vụ/hợp đồng dữ liệu/quyền; dễ kiểm và hoàn tác. Ví dụ sửa chính tả không đổi nghĩa | Đề bài, lý do, kiểm tra phù hợp và bàn giao có thể là một mục ngắn trong hồ sơ đang có; cập nhật docs bị ảnh hưởng |
| Thông thường | Có hành vi mới/thay đổi nhưng phạm vi và dependency rõ, không chạm các nhóm nhạy cảm dưới đây | Hoàn thiện bộ spec của change; nội dung ngắn hoặc tham chiếu khi đủ; kiểm luồng, lỗi, biên và hồi quy liên quan |
| Nhạy cảm | Tiền, quyền/danh tính, cô lập cửa hàng, migration/mất dữ liệu, giao dịch đồng thời, hoặc thay đổi khó hoàn tác | Làm rõ bất biến và thất bại; kiểm ở tầng thực thi thật phù hợp; thêm rà soát trọng điểm và kế hoạch triển khai/khôi phục khi có phát hành |

Phạm vi chưa rõ thì chưa xếp nhẹ. "Sửa lỗi", "UI" hay ít dòng code không quyết định mức. Phát hiện tác động lớn hơn thì nâng mức trước phần bị ảnh hưởng. Công việc nhiều phần có thể chia slice, nhưng không tách bỏ bảo vệ dữ liệu cần thiết để làm một slice trông đơn giản.

Mỗi **change chính thức** vẫn theo bộ bảy phần trong chuẩn spec, với ngoại lệ quy trình/công cụ đã ghi ở đó. Mỗi bước/task không tạo lại bảy tài liệu. Bảo trì nhẹ không tạo requirement mới có thể cập nhật change/hồ sơ sẵn có; không dùng nhãn nhẹ để bỏ một gate của feature. Không hoàn thiện hàng loạt proposal xa lịch triển khai.

## Sáu bước và đầu ra

| Bước | AI thực hiện | Đầu ra / điều kiện chuyển tiếp |
| --- | --- | --- |
| 1. Tiếp nhận, khảo sát | Đọc brief/handoff và nguồn liên quan; phân mức; đối chiếu hiện trạng, dependency và quyền thực hiện | Đề bài có kết quả mong muốn, phạm vi, nguồn hiện trạng và câu hỏi thiếu; đủ để thảo luận |
| 2. Làm rõ, quyết định | Hỏi theo tình huống, so sánh phương án, khuyến nghị có căn cứ; đo thử nếu cần và được phép | Quyết định có lý do, phạm vi làm/hoãn, tiêu chí thành công; hết câu hỏi chặn phần sẽ làm |
| 3. Spec, kế hoạch | Viết requirement → use case → design → test plan → traceability → tasks; rà tính nhất quán | Spec của phạm vi được duyệt, dependency có cách đáp ứng, task có đầu vào/đầu ra và cách kiểm chứng; chỉ code khi được giao |
| 4. Thực hiện từng phần | Code và kiểm thử cùng từng slice; sửa theo bằng chứng; cập nhật quyết định mới và bàn giao | Mỗi slice có kết quả và bằng chứng riêng; điều chưa làm ghi rõ, không nhận thành tích của slice sau |
| 5. Kiểm chứng, nghiệm thu | Kiểm tích hợp/hồi quy còn lại, rà bằng chứng/requirement, review trọng điểm và hướng dẫn đọc code | Ma trận đạt/chưa đạt/chưa chạy; bản dùng thử hoặc kết quả tương ứng; chủ dự án có đủ thông tin để nghiệm thu |
| 6. Bàn giao | Đồng bộ spec, decisions, hiện trạng, kết quả, giới hạn; ghi việc tiếp theo; phát hành chỉ trong phạm vi được giao | Hồ sơ gắn đúng source và môi trường; trạng thái kỹ thuật, nghiệm thu và phát hành tách biệt |

Đây là vòng lặp. Câu hỏi mới mở lại phần tương ứng, không xóa quyết định cũ và không làm lại mọi tài liệu vô cớ. Triển khai vẫn được tiếp tục ở phần độc lập đã có đủ thông tin và thẩm quyền.

## Cách hỏi và cách hỗ trợ quyết định

- Mỗi lượt thường 3–5 câu cùng chủ đề; ít hơn nếu một câu quyết định các câu sau. Không đặt trần tổng hoặc giới hạn người dùng chỉ được chốt năm quyết định.
- Mỗi câu có tình huống, điểm chưa rõ, lựa chọn, đánh đổi, khuyến nghị và tác động của việc chốt. Không đẩy câu hỏi thuần kỹ thuật về người dùng trước khi tự đọc nguồn liên quan.
- Người dùng có thể trả lời "chưa biết, phân tích giúp". AI tiếp tục phân tích/tra nguồn/đề xuất đo thử thay vì tự xem đó là lựa chọn hay sự đồng ý.
- Ưu tiên phạm vi, nghiệp vụ, quyền, dữ liệu, kết quả cần đúng trước chi tiết triển khai. Thông tin tìm được trong code/docs thì tự khảo sát; nhu cầu của chủ dự án thì hỏi; điều cần thực nghiệm thì nêu cách kiểm chứng và giới hạn hiện có.
- Ghi rõ câu hỏi nào chặn phần nào. Không dùng im lặng, hết thời gian hoặc file bàn giao do AI viết làm sự chấp thuận.
- Nếu cần đổi hành vi, dữ liệu, quyền, chi phí, phạm vi hoặc nghiệm thu đã duyệt, nêu bằng chứng và xin quyết định trước phần phụ thuộc. Chi tiết thực thi theo quy ước đã duyệt và sửa lỗi trong task được giao có thể tự làm; không hỏi lại quyền cho từng thao tác.

## Quyết định phải lưu được để bảo vệ đồ án

Dùng [mẫu quyết định](templates.md#quyet-dinh). Quyết định riêng feature nằm trong mục quyết định của proposal; design tham chiếu mã để giải thích cách hiện thực. Quyết định chung có một hồ sơ chính được liên kết. Với quyết định quan trọng phải có: vấn đề, phương án thật sự đã cân nhắc, lựa chọn/lý do, nguồn bằng chứng hoặc giả thuyết, hệ quả, trạng thái, ngày và người/nguồn chốt.

`Đề xuất` khác `Đã chấp nhận`. Quyết định kỹ thuật AI tự chọn trong phạm vi được giao phải ghi đúng người chọn và căn cứ ủy quyền; không viết thành "chủ dự án đã duyệt". Khi thay thế, tạo bản ghi mới có liên kết hai chiều và giữ lịch sử. Lý do ghi lúc chốt; nếu bổ sung hồi cứu, ghi rõ là hồi cứu và phần nào chưa có bằng chứng, không giả ngày hoặc dựng lý do sau code.

## Bằng chứng và kiểm chứng

- Định nghĩa expected result từ yêu cầu trước khi dùng test làm bằng chứng. Mọi thay đổi giảm tiêu chí/ngưỡng hoặc bỏ case cần lý do rõ; nếu đổi yêu cầu hoặc gate đã duyệt thì phải được chốt. Test chạy trên CI vẫn có thể hiểu sai yêu cầu.
- Dùng lại runner/checker hiện có khi phù hợp. Trước chạy, đọc cấu hình thực tế để biết lệnh phủ gì; không mặc định `npm test` bao gồm SQL, browser, Realtime hoặc Storage. Công cụ được docs nhắc tới nhưng không có ở checkout là một chênh lệch phải báo và xử lý, không tự nhận PASS hoặc âm thầm bỏ gate.
- Ghi lệnh, thư mục chạy, thời điểm, exit code, số ca bắt buộc/đã chạy/skip/fail, đường dẫn báo cáo và source. Source có thể là commit sạch hoặc baseline commit + fingerprint cùng snapshot/patch có thể phục hồi **gồm cả file mới và code test**. Hash nhận diện nội dung nhưng không thay cho việc lưu nội dung để tái hiện.
- Ghi runtime/dependency lock, backend, migration/schema và fixture cần cho lần kiểm. Dữ liệu thử xác định trên backend thật không phải dữ liệu kinh doanh thật; môi trường nào chưa kiểm phải ghi tên. Không dùng dữ liệu thật mặc định để chứng minh test tích hợp.
- Source đổi sau kiểm tra thì bằng chứng cũ là lịch sử. Chạy lại phần bị ảnh hưởng và các gate bắt buộc; tái dùng phần độc lập chỉ khi chứng minh phạm vi phù hợp và gate hiện hành cho phép. Không ghép báo cáo từ các fingerprint khác nhau để tạo PASS chung.
- Gói nghiệm thu phải có cách chạy lại (lệnh và điều kiện dựng môi trường). Một lệnh tổng hợp là tiện ích có thể bổ sung, không yêu cầu tạo runner mới cho mỗi task. CI sớm là hướng ưu tiên; không coi tài liệu này là việc đã dựng CI.
- Với phần nhạy cảm, có lượt rà soát riêng về yêu cầu/expected result và các trường hợp thất bại. Có thể do người hoặc phiên review riêng thực hiện; nếu vẫn là cùng AI, ghi đúng giới hạn độc lập. Agent bổ sung chỉ dùng khi người dùng yêu cầu hoặc quy tắc áp dụng cho phép. Negative control/mutation chỉ dùng khi giúp kiểm chứng cơ chế quan trọng, không bắt mọi sửa chữ phải làm.
- Ảnh/video chứng minh giao diện ở trạng thái đã chụp; không thay thế test về quyền, tiền hoặc giao dịch. Hồ sơ `docs` giữ liên kết, ý nghĩa và giới hạn bằng chứng; tệp nhị phân/raw log ở vị trí artifact phù hợp, không ghi credential/token/dữ liệu nhạy cảm.

## Khi sửa lỗi không tiến triển

Khi các lần sửa liên tiếp không tạo thêm bằng chứng hay không làm rõ nguyên nhân, dừng sửa theo phỏng đoán và lập bản chẩn đoán: triệu chứng tái hiện, giả thuyết, thử nghiệm/kết quả, điều đã loại trừ, phép thử tiếp theo. Ba lần thử thất bại có thể dùng làm nhắc kiểm tra cách tiếp cận, không phải quy luật buộc đổi design hay kết thúc task.

Phân biệt lỗi requirement, code, test, môi trường và thiết kế. Mở lại đúng phần, tiếp tục điều tra độc lập được phép. Không sửa test cho xanh hoặc mở rộng phạm vi mà không giải trình. Nếu cần chủ dự án quyết định, đưa phương án và khuyến nghị cụ thể.

## Hiểu code, nghiệm thu và trạng thái

Với tính năng/thiết kế quan trọng, AI cung cấp đường đọc code ngắn: điểm vào → xử lý → dữ liệu; hàm giữ tính đúng; quyết định và phương án bị loại; lỗi điển hình và test liên quan. Chủ dự án có thể đánh dấu đoạn chưa hiểu để AI giải thích. Lưu phần giải thích hữu ích cho đồ án và phản hồi thật, không bắt đọc mọi dòng mã lặp hoặc tự đánh dấu đã hiểu.

| Trạng thái cần phân biệt | Ý nghĩa |
| --- | --- |
| Đã hiện thực | Có thay đổi code/tài liệu trong phạm vi; chưa đủ để kết luận đạt |
| Đã kiểm chứng | Các kiểm tra yêu cầu của phạm vi đạt trên source/môi trường được chỉ rõ |
| Sẵn sàng nghiệm thu / đã nghiệm thu | Phân biệt đã có gói bàn giao với việc chủ dự án thực sự chấp nhận |
| Phát hành | Ghi riêng chưa phát hành / không thuộc phạm vi / đã phát hành kèm môi trường và phiên bản |

Task kỹ thuật có thể đã hoàn tất và bàn giao trong khi chờ chủ dự án đọc code/nghiệm thu. Ghi đúng hai trạng thái; không giữ AI chạy chỉ để chờ một phản hồi không cần cho công việc độc lập. Không hạ một lỗi bắt buộc thành "giới hạn đã biết" để đóng task.

## Bàn giao giữa các phiên

Mỗi task hoạt động có một bản bàn giao ngắn và một dòng trong chỉ mục. Cập nhật khi chốt quyết định, đổi bước, có kết quả kiểm chứng quan trọng hoặc trước khi tạm dừng/bàn giao. Chỉ mục trỏ tới trạng thái, không chép lại toàn bộ hồ sơ; task khác nhau không dùng chung một file trạng thái duy nhất.

Bàn giao ghi source/spec, phạm vi đã được giao cùng nguồn xác nhận, quyết định/câu hỏi còn hiệu lực, phần đã làm/chưa làm, evidence, lỗi, bước tiếp theo và quyền còn thiếu. Không ghi bí mật. Nếu các nguồn ủy quyền xung đột, kiểm tra nguồn và thời điểm; hỏi đúng phần chưa thể xác định, không dùng việc này để hỏi lại mọi quyền.

## Áp dụng và giới hạn

- Áp dụng từ task mới; task đang làm tiếp tục từ checkpoint thực tế, giữ các gate cụ thể nghiêm ngặt hơn. Không đổi trạng thái hay viết lại lịch sử của feature khác.
- Pilot chọn việc nhỏ có giá trị, ít dependency và đầu ra rõ. Chuyển bàn không được mặc nhiên chọn làm pilot đầu; nếu làm, bảo vệ xung đột dữ liệu cần thiết thuộc tính đúng của v1, không hoãn chỉ để đơn giản hóa quy trình.
- Quy trình này đã được đóng gói thành hướng dẫn và mẫu; hiệu quả về thời gian, số câu hỏi hoặc lỗi phải đo qua task áp dụng thực tế. Không tuyên bố đã chứng minh năng suất tăng.

## Căn cứ tham khảo

- [DORA: Continuous integration](https://dora.dev/capabilities/continuous-integration/) và [Test automation](https://dora.dev/capabilities/test-automation/): phản hồi sớm, test trong quá trình làm; không chứng minh test nào cũng đúng.
- [AWS: Architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html): bối cảnh, lựa chọn, hệ quả và giữ lịch sử quyết định.
- [PostgreSQL 16: Data consistency checks](https://www.postgresql.org/docs/16/applevel-consistency.html): các quy tắc dữ liệu cần cơ chế phù hợp khi có thao tác đồng thời; không suy an toàn chỉ từ một thông báo lỗi UI.
