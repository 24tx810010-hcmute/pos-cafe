# Kiểm tra điều hướng và mô hình lịch ngày 2026-09-10

Phạm vi thay đổi: hai README điều hướng, roadmap, phần phân tích lịch của proposal và mục bổ sung có ngày trong tài liệu 15. Không sửa code ứng dụng, không sửa requirement/use case/testcase nghiệp vụ. Không commit/push.

Chủ dự án cho biết không có giờ cố định nhưng làm hằng ngày. Các mức 20/40 giờ chỉ dùng để tính kịch bản; không phải cam kết. Tính từ 2026-09-11, n = 1; làm tròn mục 2 lên khối tuần; giữ thời lượng cũ mục 3–6/9/10 để khảo sát tác động, chưa xác nhận các thời lượng đó phù hợp quỹ giờ thực tế. Ba tuần offline đã hoãn được thử dùng để hấp thụ dịch chuyển; bốn ngày đệm cuối vẫn được bảo vệ.

## Kiểm tra cấu trúc và OpenSpec

Lệnh chạy ở worktree docs:

```powershell
openspec validate add-idempotent-write-operations --strict --json
git diff --check
```

Checker cấu trúc dùng cùng thuật toán đã lưu trong [bằng chứng trước](2026-09-09-spec-validation.md), chỉ cập nhật ngày kiểm thành 2026-09-10. Đây là kiểm tài liệu; 93 testcase tính năng mới vẫn chưa hiện thực/chưa chạy.

```json
{
  "items": [
    {
      "id": "add-idempotent-write-operations",
      "type": "change",
      "valid": true,
      "issues": [],
      "durationMs": 23
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

## Mô hình ngày được tính bằng chương trình

```json
{
  "startConvention": "2026-09-11, blocks of seven calendar days, no work credited before start",
  "scenarios": [
    {
      "hoursPerWeek": 40,
      "fixTasks": 1,
      "hours": 78.5,
      "weeksExact": 1.9625,
      "weeksRounded": 2,
      "phases": [
        {
          "id": 2,
          "weeks": 2,
          "start": "2026-09-11",
          "end": "2026-09-24"
        },
        {
          "id": 3,
          "weeks": 3,
          "start": "2026-09-25",
          "end": "2026-10-15"
        },
        {
          "id": 4,
          "weeks": 1,
          "start": "2026-10-16",
          "end": "2026-10-22"
        },
        {
          "id": 5,
          "weeks": 3,
          "start": "2026-10-23",
          "end": "2026-11-12"
        },
        {
          "id": 6,
          "weeks": 1,
          "start": "2026-11-13",
          "end": "2026-11-19"
        }
      ],
      "phase9": {
        "start": "2026-11-27",
        "end": "2026-12-03"
      },
      "phase10IfTwoWeeksAfter9": {
        "start": "2026-12-04",
        "end": "2026-12-17"
      },
      "gapToOriginalPhase9Days": 7
    },
    {
      "hoursPerWeek": 20,
      "fixTasks": 1,
      "hours": 78.5,
      "weeksExact": 3.925,
      "weeksRounded": 4,
      "phases": [
        {
          "id": 2,
          "weeks": 4,
          "start": "2026-09-11",
          "end": "2026-10-08"
        },
        {
          "id": 3,
          "weeks": 3,
          "start": "2026-10-09",
          "end": "2026-10-29"
        },
        {
          "id": 4,
          "weeks": 1,
          "start": "2026-10-30",
          "end": "2026-11-05"
        },
        {
          "id": 5,
          "weeks": 3,
          "start": "2026-11-06",
          "end": "2026-11-26"
        },
        {
          "id": 6,
          "weeks": 1,
          "start": "2026-11-27",
          "end": "2026-12-03"
        }
      ],
      "phase9": {
        "start": "2026-12-04",
        "end": "2026-12-10"
      },
      "phase10IfTwoWeeksAfter9": {
        "start": "2026-12-11",
        "end": "2026-12-24"
      },
      "gapToOriginalPhase9Days": -7
    }
  ],
  "thresholdForPhase2Within3Weeks": {
    "n0": 25.5,
    "n1": 26.166666666666668,
    "n4": 28.166666666666668
  }
}
```

Mốc báo cáo 2026-12-24 là kết quả dự báo nếu không điều chỉnh kịch bản 20 giờ, không phải ngày được duyệt. Ngưỡng khoảng 26,2 giờ/tuần chỉ áp dụng cho mục 2 trong các giả định này, không đủ để khẳng định toàn dự án đúng hạn.

## Đối chiếu điều hướng và bảo toàn lịch sử

Lần kiểm bổ sung so 10 hàng phân bổ chính thức của roadmap trước/sau khi quy đổi ngày về ISO; các khoảng lịch giữ nguyên. Đối chiếu từng khoảng ngày tính từ mô hình với bảng trong proposal; kiểm các mẫu dấu cách đã được reviewer chỉ ra, ngày trong tài liệu điều hướng và liên kết tương đối của 18 file. Không dùng các biểu thức dò từ để khẳng định mọi câu văn đều hoàn hảo.

Tài liệu 14 và hai evidence được kiểm hash không đổi; cả 12 artifact ngoài proposal cũng giữ nguyên hash so với mốc 2026-09-09. Các báo cáo reviewer cũ không được sửa. Git diff --check trả exit code 0, chỉ có thông báo chuẩn hóa LF/CRLF của môi trường.

```json
{
  "date": "2026-09-10",
  "type": "DOCUMENT_AND_SCHEDULE_CHECK_ONLY",
  "history": [
    {
      "path": "docs/reviews/2026-09-07-idempotency/14-bo-spec-hoan-chinh-va-ra-cuoi.md",
      "sha256": "f17aa3a1d180d1583acef88369d301bc2d9a75a4287188ccb020f0f925e2b7e3",
      "unchanged": true
    },
    {
      "path": "docs/reviews/2026-09-07-idempotency/evidence/2026-09-09-editorial-validation.md",
      "sha256": "70cd2684a2035554d0eaf2f1d9d56da353a9bf64c677569fc6cddb89dc942baf",
      "unchanged": true
    },
    {
      "path": "docs/reviews/2026-09-07-idempotency/evidence/2026-09-09-proposal-truoc-bo-spec.md",
      "sha256": "1c6ad6ee2651540540dbbf74ae01e2f52df49ca075bcb699851c2084ef3d75c5",
      "unchanged": true
    }
  ],
  "nonProposalArtifacts": [
    {
      "file": "design.md",
      "unchanged": true
    },
    {
      "file": "specs/access-control/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/employee-session/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/order-management/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/order-void/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/payment/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/receipt-printing/spec.md",
      "unchanged": true
    },
    {
      "file": "specs/write-idempotency/spec.md",
      "unchanged": true
    },
    {
      "file": "tasks.md",
      "unchanged": true
    },
    {
      "file": "testplan.md",
      "unchanged": true
    },
    {
      "file": "traceability.md",
      "unchanged": true
    },
    {
      "file": "usecases.md",
      "unchanged": true
    }
  ],
  "officialRoadmapRowsUnchanged": 10,
  "filesWithLinksChecked": 18,
  "localLinksChecked": 123,
  "issues": []
}
```

Trạng thái main sau kiểm tra: chỉ có pnpm-lock.yaml untracked đã có từ trước. Chưa triển khai code hoặc chạy test tính năng mới.

## Truy vết và hash của bộ 13 artifact tại lần kiểm này

Chỉ proposal đổi trong bộ 13 artifact so với bằng chứng ngày 2026-09-09; báo cáo/hash cũ vẫn giữ mốc cũ.

```json
{
  "kind": "DOCUMENT_VALIDATION_ONLY",
  "date": "2026-09-10",
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
      "sha256": "51cb866a450fc54572c35a82ba5cdac5efbef94538adc077d759397121c21c6b",
      "lines": 160
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
