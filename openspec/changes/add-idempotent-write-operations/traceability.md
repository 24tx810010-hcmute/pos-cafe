# Truy vết requirement ↔ use case ↔ testcase

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](proposal.md#thuat-ngu).

Ngày 2026-09-09. Phủ ở **mức thiết kế**, không phải số test đã chạy. Mỗi biến thể phải có ID suffix trong manifest theo testplan, mục B. Mã FR/NFR nằm tại requirement. Test đa lớp báo từng backend, không suy rộng mock thành DB.

Cập nhật F1 ngày 2026-09-10: TC006 giữ 102 cell DB và thêm 12 core/component + 3 E2E về cách ly cache/receipt giữa phiên và khi bị từ chối quyền. Vẫn 33 requirement, 12 UC, 93 TC gốc; manifest tăng từ 669 lên 684 execution bắt buộc. Kết quả kiểm chứng bản sửa F1 được ghi riêng; không coi kết quả đó là đóng các finding khác.

| Requirement | Use case | Test case |
| --- | --- | --- |
| [IDEM-01 — Danh tính nhân viên được server xác minh](specs/write-idempotency/spec.md) | UC-IDEM-01, UC-IDEM-08 | TC-IDEM-001, TC-IDEM-002, TC-IDEM-003, TC-IDEM-004, TC-IDEM-005, TC-IDEM-090 |
| [IDEM-02 — Quyền hiện hành và tiếp quản](specs/write-idempotency/spec.md) | UC-IDEM-01, UC-IDEM-07, UC-IDEM-08, UC-IDEM-09 | TC-IDEM-006, TC-IDEM-007, TC-IDEM-056, TC-IDEM-093 |
| [IDEM-03 — Đóng đường ghi vượt giao thức](specs/write-idempotency/spec.md) | UC-IDEM-01, UC-IDEM-08 | TC-IDEM-003, TC-IDEM-004, TC-IDEM-008, TC-IDEM-009, TC-IDEM-010, TC-IDEM-011, TC-IDEM-085 |
| [IDEM-04 — Payload có hợp đồng bất biến](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06 | TC-IDEM-013, TC-IDEM-015, TC-IDEM-016, TC-IDEM-017, TC-IDEM-018, TC-IDEM-020, TC-IDEM-033, TC-IDEM-036, TC-IDEM-047, TC-IDEM-074, TC-IDEM-075, TC-IDEM-076, TC-IDEM-077, TC-IDEM-078, TC-IDEM-079, TC-IDEM-080, TC-IDEM-081, TC-IDEM-090, TC-IDEM-093 |
| [IDEM-05 — Đăng ký trước thực hiện](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-07 | TC-IDEM-012, TC-IDEM-013, TC-IDEM-014, TC-IDEM-019, TC-IDEM-020, TC-IDEM-022, TC-IDEM-053, TC-IDEM-058 |
| [IDEM-06 — Trả kết quả lịch sử khi thử lại](specs/write-idempotency/spec.md) | UC-IDEM-04, UC-IDEM-05, UC-IDEM-07, UC-IDEM-08 | TC-IDEM-014, TC-IDEM-015, TC-IDEM-018, TC-IDEM-019, TC-IDEM-038, TC-IDEM-040, TC-IDEM-044, TC-IDEM-045, TC-IDEM-046, TC-IDEM-052, TC-IDEM-055, TC-IDEM-067, TC-IDEM-068, TC-IDEM-073, TC-IDEM-083, TC-IDEM-093 |
| [IDEM-07 — Atomicity của hiệu ứng và kết quả](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06 | TC-IDEM-014, TC-IDEM-019, TC-IDEM-023, TC-IDEM-037, TC-IDEM-052, TC-IDEM-060, TC-IDEM-065, TC-IDEM-068, TC-IDEM-069, TC-IDEM-070, TC-IDEM-071, TC-IDEM-072, TC-IDEM-075, TC-IDEM-076 |
| [IDEM-08 — Khóa lạc quan phối hợp chống trùng](specs/write-idempotency/spec.md) | UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06 | TC-IDEM-021, TC-IDEM-022, TC-IDEM-023, TC-IDEM-024, TC-IDEM-047, TC-IDEM-048, TC-IDEM-080 |
| [IDEM-09 — Khôi phục dựa trên server](specs/write-idempotency/spec.md) | UC-IDEM-07, UC-IDEM-08 | TC-IDEM-055, TC-IDEM-056, TC-IDEM-057, TC-IDEM-058, TC-IDEM-080, TC-IDEM-083, TC-IDEM-090 |
| [IDEM-10 — Hủy lệnh chờ trên server](specs/write-idempotency/spec.md) | UC-IDEM-09 | TC-IDEM-058, TC-IDEM-059, TC-IDEM-060, TC-IDEM-061, TC-IDEM-065, TC-IDEM-068 |
| [IDEM-11 — Thời hạn lệnh khác tuổi đơn](specs/write-idempotency/spec.md) | UC-IDEM-10, UC-IDEM-07 | TC-IDEM-061, TC-IDEM-062, TC-IDEM-063, TC-IDEM-064, TC-IDEM-065, TC-IDEM-066, TC-IDEM-067 |
| [IDEM-12 — Giữ dữ liệu lệnh trong bản đồ án](specs/write-idempotency/spec.md) | UC-IDEM-07, UC-IDEM-10 | TC-IDEM-013, TC-IDEM-057, TC-IDEM-066, TC-IDEM-067, TC-IDEM-068, TC-IDEM-082, TC-IDEM-093 |
| [IDEM-13 — Dấu vết người thực hiện](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-03, UC-IDEM-04, UC-IDEM-05, UC-IDEM-06, UC-IDEM-08 | TC-IDEM-014, TC-IDEM-037, TC-IDEM-038, TC-IDEM-040, TC-IDEM-046, TC-IDEM-055, TC-IDEM-056, TC-IDEM-082, TC-IDEM-090 |
| [IDEM-14 — Online và kết quả chưa rõ](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-04, UC-IDEM-07, UC-IDEM-09 | TC-IDEM-044, TC-IDEM-045, TC-IDEM-051, TC-IDEM-052, TC-IDEM-053, TC-IDEM-054, TC-IDEM-072, TC-IDEM-090 |
| [IDEM-15 — Giá giữ theo từng phần đã ghi](specs/write-idempotency/spec.md) | UC-IDEM-02, UC-IDEM-03, UC-IDEM-11 | TC-IDEM-025, TC-IDEM-026, TC-IDEM-028, TC-IDEM-029, TC-IDEM-030, TC-IDEM-031 |
| [IDEM-16 — Nguồn gốc dòng cũ và ghi chú](specs/write-idempotency/spec.md) | UC-IDEM-03 | TC-IDEM-025, TC-IDEM-026, TC-IDEM-027, TC-IDEM-028, TC-IDEM-029, TC-IDEM-031, TC-IDEM-032, TC-IDEM-033 |
| [IDEM-17 — Xác nhận lại khi giá phần mới đổi](specs/write-idempotency/spec.md) | UC-IDEM-11 | TC-IDEM-034, TC-IDEM-035, TC-IDEM-071 |
| [IDEM-18 — Lựa chọn thanh toán cố định theo lệnh](specs/write-idempotency/spec.md) | UC-IDEM-04, UC-IDEM-05, UC-IDEM-07 | TC-IDEM-018, TC-IDEM-040, TC-IDEM-042, TC-IDEM-043, TC-IDEM-044, TC-IDEM-045 |
| [IDEM-19 — Hóa đơn theo snapshot chuẩn](specs/write-idempotency/spec.md) | UC-IDEM-04, UC-IDEM-05, UC-IDEM-12 | TC-IDEM-038, TC-IDEM-050, TC-IDEM-051, TC-IDEM-083 |
| [IDEM-20 — Bộ đếm replay](specs/write-idempotency/spec.md) | UC-IDEM-07 | TC-IDEM-019, TC-IDEM-073, TC-IDEM-093 |
| [IDEM-21 — Tương thích giao thức và migration](specs/write-idempotency/spec.md) | UC-IDEM-01, UC-IDEM-07 | TC-IDEM-009, TC-IDEM-011, TC-IDEM-082, TC-IDEM-084, TC-IDEM-085, TC-IDEM-087, TC-IDEM-089 |
| [IDEM-22 — Kiểm chứng có thể tái lập](specs/write-idempotency/spec.md) | UC-IDEM-07 | TC-IDEM-064, TC-IDEM-086, TC-IDEM-087, TC-IDEM-088, TC-IDEM-089 |
| [IDEM-23 — Chọn nhân viên và xác minh PIN](specs/employee-session/spec.md) | UC-IDEM-01 | TC-IDEM-001, TC-IDEM-002, TC-IDEM-005, TC-IDEM-089 |
| [IDEM-24 — Chốt quyền ở luồng nghiệp vụ và guardrail phía database](specs/access-control/spec.md) | UC-IDEM-01, UC-IDEM-08 | TC-IDEM-006, TC-IDEM-007, TC-IDEM-008, TC-IDEM-056 |
| [IDEM-25 — Giới hạn đã biết của mô hình quyền hiện tại](specs/access-control/spec.md) | UC-IDEM-01, UC-IDEM-08 | TC-IDEM-006, TC-IDEM-007, TC-IDEM-089 |
| [IDEM-26 — Gửi đơn và chốt giá phía database](specs/order-management/spec.md) | UC-IDEM-02, UC-IDEM-03, UC-IDEM-11 | TC-IDEM-025, TC-IDEM-026, TC-IDEM-029, TC-IDEM-030, TC-IDEM-032, TC-IDEM-034, TC-IDEM-035, TC-IDEM-036, TC-IDEM-077, TC-IDEM-089, TC-IDEM-091 |
| [IDEM-27 — Bảo vệ chỉnh sửa đơn](specs/order-management/spec.md) | UC-IDEM-03 | TC-IDEM-025, TC-IDEM-027, TC-IDEM-028, TC-IDEM-037 |
| [IDEM-28 — Thanh toán toàn bộ đơn bằng tiền mặt](specs/payment/spec.md) | UC-IDEM-04 | TC-IDEM-038, TC-IDEM-039, TC-IDEM-066, TC-IDEM-081, TC-IDEM-089, TC-IDEM-092 |
| [IDEM-29 — Thanh toán một phần bằng cách tách đơn độc lập](specs/payment/spec.md) | UC-IDEM-05 | TC-IDEM-040, TC-IDEM-041, TC-IDEM-043, TC-IDEM-083, TC-IDEM-089, TC-IDEM-092 |
| [IDEM-30 — Chọn món để thanh toán](specs/payment/spec.md) | UC-IDEM-04, UC-IDEM-05, UC-IDEM-07 | TC-IDEM-042, TC-IDEM-043, TC-IDEM-044, TC-IDEM-045 |
| [IDEM-31 — Chống xung đột khi hủy đơn](specs/order-void/spec.md) | UC-IDEM-06 | TC-IDEM-046, TC-IDEM-047, TC-IDEM-048, TC-IDEM-049, TC-IDEM-079, TC-IDEM-089 |
| [IDEM-32 — Phiếu tạm tính và hóa đơn](specs/receipt-printing/spec.md) | UC-IDEM-04, UC-IDEM-05, UC-IDEM-12 | TC-IDEM-038, TC-IDEM-050, TC-IDEM-051, TC-IDEM-089 |
| [IDEM-33 — In lại hóa đơn](specs/receipt-printing/spec.md) | UC-IDEM-12 | TC-IDEM-050, TC-IDEM-051, TC-IDEM-083, TC-IDEM-089 |

| Chỉ số | Kết quả thiết kế / ngưỡng |
| --- | --- |
| Requirement chưa có TC | 0 / phải 0 |
| Use case chưa có TC | 0 / phải 0 |
| Requirement chưa có UC | 0 / nên 0 |

33 requirement, 12 UC, 93 TC gốc. Invariant về runner/kiến trúc được kiểm trong ngữ cảnh phục hồi UC 07; không tạo UC giả riêng cho công cụ. Có execution cho các TC, nhưng hậu kiểm F5 còn chỉ ra oracle chưa phủ hết expected; kết quả thực chạy được chốt riêng tại [phase 27](../../../docs/implementation-log/phase-27-idempotent-write-operations.md). Ma trận này chứng minh truy vết thiết kế, không tự chứng minh code đã đúng.


## Truy vết hồi quy F2–F5 (2026-09-11)

Bảng requirement/UC/TC hiện có giữ nguyên; bổ sung assertion và required executions của TC015/074 (IDEM-04), TC051 (IDEM-14/19, UC12), TC052 (IDEM-05/14, UC02/07), TC030 (IDEM-15/19, UC05/11), TC066 (IDEM-11/12/28, UC10), TC085 (IDEM-21, nâng cấp). Không thêm requirement/UC thiếu testcase. Manifest mở rộng từ684 lên758 execution; gate cuối đã xác nhận758/758required; xem log khắc phục P2 để biết fingerprint và giới hạn.

TC053/core/session=same_employee bổ sung oracle IDEM-01/14: thế hệ phiên đổi vô hiệu hóa coordinator ngay cả khi object nhân viên giữ nguyên. Baseline controlled setter mở phiếu bếp từ ACK cũ; fixed không mở. Luồng PIN hiện tại qua null/object mới nên chưa chứng minh exploit qua UI thật.


## Hậu kiểm trước push ngày 2026-09-13

Bổ sung TC053/054 cho IDEM-14 trong UC07/09 và positive TC006 cho IDEM-02/24. Vẫn 93 TC gốc; manifest có 770 required execution (758 cũ + 12 mới). Đây chưa phải số đạt gate: chỉ unit/component 589 PASS trên candidate mới; DB/E2E bị chặn và các report cũ sai fingerprint.


## Truy vết hồi quy 14/09

| Requirement | Use case | Execution bổ sung |
| --- | --- | --- |
| IDEM-14/19 | UC02, UC04, UC05, UC06, UC12 | TC051/053/054 trong ba file writeInitialSubmitLifetime, writePaymentLifetime, writeHistoryLifetime |
| IDEM-02/24 | UC01 và các luồng trên | TC006 positive auth errors hiện hành, không bỏ xử lý lỗi để đạt stale-response oracle |
| IDEM-22 | UC07 | Discovery/gate đòi đủ 818 execution; nhóm cache TC006/core vẫn đủ 12, recovery current 4, initial current 2, payment current 4, history current 4 |

48 execution mới không thêm requirement/UC/TC gốc. plannedFiles trong caseCatalog gốc là vị trí dự kiến lịch sử; actual discovery và testplan là nguồn xác minh file đã thực hiện, không suy missing test chỉ từ tên file dự kiến cũ. Review executions mới ghi đúng file actual.
