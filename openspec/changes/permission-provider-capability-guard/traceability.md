# Traceability

Tooling-only, không có use case UI. Scenario vận hành ở testplan và I/O ở spec thay usecases theo ngoại lệ đã ghi proposal.

| Requirement | Use case | Test case | Evidence cần có |
| --- | --- | --- | --- |
| PGCG-01 | Không có use case — công cụ vận hành | PGCG-T01, PGCG-T03, PGCG-T05 | Actor native attributes và negative assertions |
| PGCG-02 | Không có use case — công cụ vận hành | PGCG-T01, PGCG-T02, PGCG-T04, PGCG-T05 | Native/provider/partial path, error codes, guard thật |
| PGCG-03 | Không có use case — công cụ vận hành | PGCG-T02, PGCG-T03, PGCG-T04, PGCG-T06 | Typed GUC/profile và per-variant deny |
| PGCG-04 | Không có use case — công cụ vận hành | PGCG-T01, PGCG-T02, PGCG-T03, PGCG-T04, PGCG-T06, PGCG-T07 | Query log/orchestration, guard không effects |
| PGCG-05 | Không có use case — công cụ vận hành | PGCG-T05, PGCG-T06 | DDL thật prepare/restore/images rollback, baseline comparisons |
| PGCG-06 | Không có use case — công cụ vận hành | PGCG-T07, PGCG-T08 | Source/runtime/profile/snapshot/isolation/hashes/reviews/docs |

## Tổng kết độ phủ kế hoạch

- Requirement thiếu test: **0/6**.
- Use case thiếu test: **0/0** (không tạo use case UI).
- Requirement không có use case: **6/6**, giải trình tooling-only như proposal; các scenario vận hành và input/output đã có ở testplan/spec.

Hiện chưa có test result trên implementation mới; bảng này là kế hoạch phủ, không phải PASS. Cập nhật evidence links sau chạy.

Checkpoint implementation 06/10: [log/evidence](../../../docs/implementation-log/permission-provider-capability-guard-2026-10-06.md) có PGCG-T01–T04/T07 tooling và PGCG-T05/T06 runtime tại source riêng; PGCG-T08 final review theo biên bản. Câu phía trên giữ trạng thái lúc lập spec; không gán proof này cho hosted hoặc full product gate.
