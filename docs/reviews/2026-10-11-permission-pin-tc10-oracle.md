# Review độc lập TC-PIN-10 — oracle và quyền, 11/10/2026

- Reviewer: subagent `/root/tc10_oracle_review`, chỉ đọc; không sửa candidate hoặc ghi DB.
- Phạm vi: [TC-PIN-10 testplan](../../openspec/changes/force-default-pin-change/testplan.md), [UC-PIN-03](../../openspec/changes/force-default-pin-change/usecases.md), browser/unit oracle, adapter và SQL bootstrap. Không review full release.
- Candidate main: [manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc10-close1/source-manifest.json) SHA-256 `bd49595ee7367bd202c33bcee2662a38ccc304e03be7bb6ffdffd2fb1df72933`; tar SHA-256 `f41acdf996440cf570d0bf1247767ec09f6d290b16b58fdf7198c3d538671eec`. Docs slice trước metadata review: manifest SHA-256 `f9636f784e9d7de92c345b20598539355eea1dec842ca97b8ba63d390044b45e`.

Reviewer đối chiếu UI invalid/no-network và adapter validation, graph DB vẫn rỗng sau từng DTO sai, canonical trim/replay và payload conflict, foreign Auth/tenant, response shape không chứa PIN/Key, bốn biên Store Key pair cùng `storeId/storeNo`, parser invalid key trước Auth. [Receipt browser](D:/Workspace/pos-cafe/artifacts/permission-pin-tc10-close1/tc10-safe.json) 9/9 PASS; pre/postflight PASS. Reviewer chỉ đọc source và receipt, không tự chạy runtime.

- **Finding chặn:** không có.
- **Đề xuất không chặn:** browser hiện đo “không Auth/REST” trực tiếp cho một dạng Key 11 chữ số; parser unit phủ các dạng sai khác và `pairStore` gọi parser trước Auth. Có thể mở rộng browser matrix khi hữu ích, không làm thay kết luận TC10 local.

**Verdict: APPROVE** oracle TC-PIN-10 trên exact candidate main nêu trên; không suy rộng sang aggregate hoặc production.
