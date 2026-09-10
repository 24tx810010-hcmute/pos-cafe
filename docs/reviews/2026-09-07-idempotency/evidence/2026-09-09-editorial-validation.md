# Bằng chứng kiểm tra tài liệu sau biên tập

Ngày 2026-09-09. Change: add-idempotent-write-operations. Main: 7183b31a4ca27ed2be3ca7097f391fd2c07f806c. Tài liệu đang ở worktree docs, chưa commit.

## Phạm vi và kết quả

Đã chạy kiểm tra tài liệu, không chạy ứng dụng, migration hoặc 93 testcase mới. Các lệnh dưới đều trả exit code 0 ở lần cuối; không dùng kết quả này làm bằng chứng tính năng hoạt động.

| Kiểm tra | Kết quả |
| --- | --- |
| OpenSpec validate strict | valid = true, không issues |
| Artifact và mã | 13 Markdown, 7 capability, 33 requirement, 12 use case, 93 testcase gốc, 43 task |
| Ma trận phủ | Không requirement, use case hoặc testcase gốc bị bỏ ngoài ma trận |
| Tiêu đề baseline | 11/11 MODIFIED khớp; 22 ADDED |
| Impact | Hợp FR/NFR khớp bảy delta |
| Hỏi–đáp | Bảy câu khôi phục khớp nguyên văn evidence |
| Tổng giờ | 76,5 + 2n; đã gồm 6 giờ reviewer |
| Bảng Markdown | Không hàng lệch số cột trong 13 artifact sau sửa |
| Mã trong inline/code fence | Không đổi so với đầu lượt biên tập, ngoài proposal đã viết lại phần giải thích |
| Proposal lịch sử | SHA-256 giữ nguyên |
| Git diff --check | Exit 0; chỉ có thông báo chuẩn hóa LF/CRLF của môi trường |

## Lệnh và cách đối chiếu

Chạy từ worktree docs:

```powershell
openspec validate add-idempotent-write-operations --strict --json
git diff --check
```

Checker cấu trúc/ma trận sử dụng lại đoạn Node.js read-only đã công bố ở [bằng chứng trước](2026-09-09-spec-validation.md). Lệnh trong phiên này:

```powershell
& 'D:/tools/nodejs/node.exe' 'C:/Users/nguye/AppData/Local/Temp/idem-doc-validate.cjs'
& 'D:/tools/nodejs/node.exe' 'C:/Users/nguye/AppData/Local/Temp/idem-editorial-audit.cjs'
```

File tạm thứ hai kiểm bổ sung: duyệt từng section MODIFIED/ADDED; so tiêu đề MODIFIED với openspec/specs/<capability>/spec.md; cộng giờ từng checkbox, tách task 40; so hợp FR/NFR; đối chiếu bảy câu gạch ngang với evidence; kiểm số cột bảng và các chuỗi định danh đã rà. Kết quả chi tiết ở JSON dưới. Snapshot đầu lượt chỉ dùng để kiểm thay đổi biên tập, không giả là một commit.

Hai trích đoạn sau lấy trực tiếp từ snapshot testplan **trước khi biên tập**, minh họa rằng G và F0 đã có nơi định nghĩa. Giữ nguyên dấu cách ở trích đoạn:

```text
### A3. Oracle chung bắt buộc G
| F0 | S1 chưa có order/payment, B01empty; menuA30k,trà20k,Q5k,Z0, group quan hệ hợp lệ; A/B/C/E/S2X như trên; maxNo0 |
```

Không có checker nào ở đây chứng minh mọi từ đã hết lỗi hoặc mọi câu mô tả đúng nghiệp vụ. Bản văn còn được đọc soát; phép dò dấu cách chỉ là hỗ trợ. Các expected, ma trận tham số và phương pháp quan sát là thiết kế kiểm thử, chưa phải kết quả chạy phần mềm.

## Kết quả OpenSpec

```json
{
  "items": [
    {
      "id": "add-idempotent-write-operations",
      "type": "change",
      "valid": true,
      "issues": [],
      "durationMs": 19
    }
  ],
  "summary": {
    "totals": {
      "items": 1,
      "passed": 1,
      "failed": 0
    },
    "byType": {
      "change": {
        "items": 1,
        "passed": 1,
        "failed": 0
      }
    }
  },
  "version": "1.0",
  "root": {
    "path": "D:\\Workspace\\pos-cafe-docs",
    "source": "nearest"
  }
}
```

## Kết quả cấu trúc, truy vết và hash hiện hành

Hash dưới đây thay thế hash của mốc trước **cho lần biên tập này**; file evidence cũ được giữ nguyên.

```json
{
  "kind": "DOCUMENT_VALIDATION_ONLY",
  "date": "2026-09-09",
  "counts": {
    "artifactTypes": 7,
    "markdownFiles": 13,
    "capabilities": 7,
    "requirements": 33,
    "usecases": 12,
    "testcases": 93,
    "errorCodes": 24,
    "localLinksChecked": 121,
    "tasks": 43
  },
  "uncovered": {
    "requirements": [],
    "usecases": [],
    "testcases": []
  },
  "issues": [],
  "snapshots": [
    {
      "file": "design.md",
      "sha256": "ebfc6ea77741e051b1a6b38f4037b3400600ef687ce63670bbfea3edcf9ab2ce",
      "lines": 297
    },
    {
      "file": "proposal.md",
      "sha256": "0295d686145fcaa8a3cb6dde996017566f92438bfc2bfb5c941d2b792ffb67bb",
      "lines": 131
    },
    {
      "file": "specs/access-control/spec.md",
      "sha256": "78e0ff241ddc567b9e77262d9dd5fe26d0a8f4c9bee8c67dc7726278184ddb76",
      "lines": 36
    },
    {
      "file": "specs/employee-session/spec.md",
      "sha256": "b59eeb9141d58de3679c49460dfeee909730927fd330c5b451bd15ae9c316f7b",
      "lines": 32
    },
    {
      "file": "specs/order-management/spec.md",
      "sha256": "97c2916946289faad2969ef43d363422c62d166cc7140a85697c8a0c03e29377",
      "lines": 48
    },
    {
      "file": "specs/order-void/spec.md",
      "sha256": "69d1607bb07f4894dd6da4d8527dd72cf4093b2ec17ebd756ec573981dc16f9e",
      "lines": 20
    },
    {
      "file": "specs/payment/spec.md",
      "sha256": "ee4e5e187b474aee9117273eb50821652e143995422e9fcf6721699744df56ed",
      "lines": 82
    },
    {
      "file": "specs/receipt-printing/spec.md",
      "sha256": "6c2a1ea04ed0cd4c986fd8598ba9ecbe09a549cff03ebf9d76b961b3e140990f",
      "lines": 42
    },
    {
      "file": "specs/write-idempotency/spec.md",
      "sha256": "e687cd9930eb983f886ed23a6487320215233b862deecb77130ee832a57e03ff",
      "lines": 246
    },
    {
      "file": "tasks.md",
      "sha256": "5a235ee95a8d5d629d3b9dc087df9b43b1e9459482827dbef453d3919f9ebdfb",
      "lines": 96
    },
    {
      "file": "testplan.md",
      "sha256": "0235610c50c891e84bad471d6ec568c126480d6bea31714dcfb5977b727701f7",
      "lines": 1126
    },
    {
      "file": "traceability.md",
      "sha256": "d266ef9b7d2b2c9cb6dc56e3aca625c0c02b88f8c77c581e804fb947bbfe2549",
      "lines": 50
    },
    {
      "file": "usecases.md",
      "sha256": "94195ed47deaead1fdb7cc20ca14acbacd5836e9d815c5ede3d25633ccd823bd",
      "lines": 639
    }
  ]
}
```

## Kết quả đối chiếu bổ sung

```json
{
  "kind": "EDITORIAL_DOCUMENT_AUDIT_ONLY",
  "modified": 11,
  "added": 22,
  "changedTitles": [
    {
      "capability": "access-control",
      "title": "Chốt quyền ở luồng nghiệp vụ và guardrail phía database",
      "baselineMatch": true
    },
    {
      "capability": "access-control",
      "title": "Giới hạn đã biết của mô hình quyền hiện tại",
      "baselineMatch": true
    },
    {
      "capability": "employee-session",
      "title": "Chọn nhân viên và xác minh PIN",
      "baselineMatch": true
    },
    {
      "capability": "order-management",
      "title": "Gửi đơn và chốt giá phía database",
      "baselineMatch": true
    },
    {
      "capability": "order-management",
      "title": "Bảo vệ chỉnh sửa đơn",
      "baselineMatch": true
    },
    {
      "capability": "order-void",
      "title": "Chống xung đột khi hủy đơn",
      "baselineMatch": true
    },
    {
      "capability": "payment",
      "title": "Thanh toán toàn bộ đơn bằng tiền mặt",
      "baselineMatch": true
    },
    {
      "capability": "payment",
      "title": "Thanh toán một phần bằng cách tách đơn độc lập",
      "baselineMatch": true
    },
    {
      "capability": "payment",
      "title": "Chọn món để thanh toán",
      "baselineMatch": true
    },
    {
      "capability": "receipt-printing",
      "title": "Phiếu tạm tính và hóa đơn",
      "baselineMatch": true
    },
    {
      "capability": "receipt-printing",
      "title": "In lại hóa đơn",
      "baselineMatch": true
    }
  ],
  "termsAlreadyInInput": {
    "G": true,
    "F0": true
  },
  "questionsRestoredVerbatim": 7,
  "originalProposalSHA256": "1C6AD6EE2651540540DBBF74AE01E2F52DF49CA075BCB699851C2084EF3D75C5",
  "tasks": {
    "count": 43,
    "fixedHours": 76.5,
    "reviewerHoursAlreadyIncluded": 6,
    "fixTaskHours": 2,
    "formula": "76.5 + 2n",
    "ifOneFixTask": 78.5
  },
  "impact": {
    "FR": [
      "FR-03",
      "FR-04",
      "FR-07",
      "FR-09",
      "FR-11",
      "FR-12",
      "FR-13",
      "FR-14",
      "FR-15"
    ],
    "NFR": [
      "NFR-01",
      "NFR-02",
      "NFR-03",
      "NFR-05",
      "NFR-07"
    ]
  },
  "tableColumnIssues": [],
  "splitWordIssues": [],
  "identifierIssues": [],
  "issues": []
}
```
