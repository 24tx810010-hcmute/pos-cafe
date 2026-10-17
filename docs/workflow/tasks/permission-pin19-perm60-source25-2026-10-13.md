# PIN19 rồi PERM60 trên source-25 — 13/10/2026

## Giao việc và giới hạn

Chủ dự án giao “ok tiếp tục đi. cần cứ tạo session mới” sau bàn giao sửa TC18, với bước tiếp là full PIN19 rồi PERM60 trên cùng source-25. Thực hiện tuần tự, báo PIN19 trước khi bắt đầu PERM60. Không làm CLOSE2 restore/metrics, CLOSE3, hosted mutation hoặc release. Không reset/stash/switch/stage/commit/push/deploy. Hai review độc lập làm tuần tự, chỉ review chứ không sửa candidate.

Nguồn yêu cầu: [testplan PIN](../../../openspec/changes/force-default-pin-change/testplan.md), [matrix source20](../../implementation-log/permission-pin19-source20-matrix-2026-10-12.md), [testplan permission](../../../openspec/changes/redesign-permission-model/testplan.md), [task PERM60 trước](permission-perm60-2026-10-12.md). Kết quả source20 là lịch sử, không ghép thành source25. Source25 đã đạt riêng TC18 và hai review [tại đây](../../implementation-log/permission-pin-tc18-oracle-fix-review-2026-10-12.md).

## Source và kế hoạch

Main `D:/Workspace/pos-cafe`, `main` HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e` và docs `D:/Workspace/pos-cafe-docs`, `docs` HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, đều dirty sẵn. Source25: manifest SHA-256 `51dad91ead2a94d8d1204bd6ace0f2fc5e1800e75a4113ed4148d2dbc7c1c547`, tar SHA-256 `cbd1a9cca1d6d18fc32b6ec786628a9aafa3f0652006b9b50a5a5d21ae719ebb`, 810 file + 2 deletion markers, fingerprint `45e697906e2b366c011eeeace0b9e160781ce8b3811cf770135de04558d02db4`.

1. Xác minh source/runtime/target; PIN19 đủ browser 47 ca khác TC18, TC18 wrapper 7 ca, SQL41, canary TC19 1, unit/build/typecheck/tooling/UI. Mỗi suite stateful chạy tuần tự. Bảo toàn fixture và lưu fail history.
2. Báo kết quả PIN19 cho chủ dự án trước khi bắt đầu PERM60.
3. PERM60 đủ 27 stage, 60 TC/726 required mappings và aggregate full chính thức; quan sát phase trên cùng connection, attestation/discovery/options/counters, không chồng service intervals. Bảo toàn target và storage.
4. Khóa candidate gồm main/docs/support/evidence recoverable; hai reviewer SEC và EVC lần lượt `APPROVE` đúng candidate cuối. Chuẩn bị walkthrough, chờ owner xác nhận đọc/nghiệm thu.

## Trạng thái

PIN19 execution source25 đã PASS và đã báo chủ dự án trong chat trước PERM60: browser54/54 (47+TC18 wrapper7), SQL41/41, canary1/1, operator2/2, unit1.173, tooling110, build/typecheck, UI selftest23/audit16×3. Ba target PIN stopped12/running0 và backup canary giữ.

PERM60 execution source25 đã PASS aggregate full: 27 run, 60/60 TC, 726/726 required variant mappings; 8 Windows và 19 WSL stage. T01 PostgreSQL riêng đã dừng; T02/T04 mỗi target12 container dừng, network/volume giữ. T04 Storage 3 bucket/6 object/18 file đối chiếu hash bằng nhau; Auth2/store2 cuối. Bằng chứng và các thất bại cần giữ lịch sử ở [execution log](../../implementation-log/permission-pin19-perm60-source25-2026-10-13.md). Hai review độc lập tuần tự SEC → EVC đều `APPROVE` đúng [candidate source25](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/candidate-01.json), SHA-256 `25d887e38411d7a600ec934ff04bcfe3332949a7b5d4e41a35452e168b3c5dd4`; [biên bản](../../reviews/2026-10-13-permission-pin19-perm60-source25.md) ghi sau candidate lock. Owner chưa xác nhận đọc/nghiệm thu.
