# Review và trạng thái cuối TC-PIN-19 — 11/10/2026

## Candidate đã review

- Main HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, dirty snapshot 456 file + 2 tracked deletion: manifest SHA-256 `4b2f089884f253b272b8332e02b5ae615450400d15172177369c2e409553d708`, tar `f6b782ff3f55acb51a2f5d1bc2563210255dc2796068b916bda57d5614661a4c`.
- Docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, pre-review-metadata snapshot 209 file: manifest SHA-256 `19b96f6b30e36b790f84478f1990f7291f83f00649a20e9c76844fb1bef80300`, tar `7cad465938c50eb0295057d749ebb46d5bd538f6d7d9dd25c8c6fd33c88d9ed2`.
- [Runtime safe receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-tc19-close1/runtime-safe.json) SHA-256 `f8fad512c39530ce8c329440de91ebdedced36114cf7701c0c34a76012fb4234`; attempt05 1/1 PASS exit0, source fingerprint `68311a0f085bd83401ffafe6b5af9100bc092c78bafea18802e16b9f0c703c86`, bundle `36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70`.

## Hai review độc lập, read-only

| Reviewer và scope | Finding vòng đầu | Xử lý và verdict candidate cuối |
| --- | --- | --- |
| `tc19_oracle_review`: PIN-06/07, UC-PIN-04, error oracle, race, fault rollback, preservation | `CHANGES_REQUESTED`: digest thiếu ACL schema/cột; preflight count có thể rỗng mà PASS; thiếu evidence count dưới khóa; chưa assert 66 identities tồn tại. | Thêm namespace/column ACL vào digest, assert exact 18 relation/count trước và trong khóa qua programmatic hook, assert identities66; fresh reset attempt05 PASS. Reviewer đọc hash/source/docs delta và **APPROVE** main/docs/receipt SHA ở trên. Không chạy DB mutation. |
| `tc19_evidence_review`: snapshot/receipt/backup/scope/target guard và docs status | `CHANGES_REQUESTED`: `tasks.md` PIN-T05 còn ghi TC19 phủ một phần, trái testplan/log. | Cập nhật chỉ PIN-T05 rehearsal local `[x]`, giữ T06 aggregate và T07 hosted `[ ]`; reviewer kiểm lại tar/manifest/live 456+209, backup private, source/receipt hashes và **APPROVE** đúng main/docs/receipt SHA ở trên. Không sửa/DB mutation. |

Không có finding chặn còn lại trong phạm vi TC19 local. Hai reviewer không nhận cleanup live, restore thực tế, full CLOSE-2/PERM60 hoặc phát hành. Mọi nhận xét trên là review độc lập nguồn và bằng chứng; runtime pass do runner thực chạy, không do reviewer tự tạo.

## Hậu kiểm và shutdown sau review

Trước stop kiểm đúng 12 container `com.supabase.cli.project=pos-cafe-perm-canary-20261009`, loopback ports và DB volume/network riêng. `docker stop` chỉ 12 tên của 598xx exit0. Sau stop: **12 stopped, 0 running, 0 bad label**, 3 volume canary còn, network `supabase_network_pos-cafe-perm-canary-20261009` loopback `127.0.0.1` và 0 attachment, config SHA-256 `3243f97f5d2080b9d8c2e07888da876e14e51054c64ceddf7b553c44d1bdd8f8`. WSL keepalive riêng PID `32508` được kiểm command line `wsl.exe --exec sleep 3600` rồi tắt, process không còn. Không tác động 599xx, 600xx, G1/G2a/G2b/G2c hoặc hosted. Private dump/tar vẫn lưu ở target WSL; restore chưa thử.

**Kết luận: TC-PIN-19 local rehearsal đã đóng kỹ thuật**, có hai `APPROVE` exact candidate và post-review stop được kiểm. Chủ dự án chưa xác nhận walkthrough/acceptance. Mục kế tiếp là CLOSE-2 same-source aggregate, chưa bắt đầu trong session TC19.
