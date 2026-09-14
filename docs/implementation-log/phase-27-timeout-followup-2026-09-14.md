# Phase 27 — Điều tra timeout E2E và xác minh frontend

Ngày 2026-09-14, sau commit code `8ed7418573fe88e27796d3b09807a3c55db4d0d6` và docs `011e2151d8911f21800e01f6252d686c437634ee`. Chủ dự án yêu cầu xử lý hai giới hạn của báo cáo trước: timeout TC068/rejected và chưa xác minh app đang phục vụ bản mới.

Bản sửa test đã commit thành `ef2c372aec60d8362549e47b7aedb27126129479`. Không đổi byte ứng dụng hoặc migration so với bản frontend đã xác minh dưới đây.

## Frontend đang phục vụ

Kiểm tra chỉ đọc GitHub/Vercel metadata và HTTP GET public xác minh:

- Domain: <https://pos-cafe-azure.vercel.app>, lấy từ homepage của repository.
- GitHub deployment Production `6430265353` gắn SHA `8ed7418573fe88e27796d3b09807a3c55db4d0d6`; Vercel báo success `2026-09-14T04:07:43Z`.
- HTML, JavaScript và CSS trả HTTP 200. `/assets/index-CfdNnUcO.js` SHA256 `74bc45fea095942a74ca64f31ddd8712ed3143d04b1ad9c7ec25d6eeeb073eac`, CSS SHA256 `dc620fc7ac27e80232623c6175381544966f20923b935767027c27b56909cf5d`, đều khớp từng byte với artifact build local đã kiểm.
- Bundle dùng đúng backend `kfqjdfwxhkdwihjobpny.supabase.co`, có session-generation và giao thức register/execute. Không in hoặc lưu giá trị key nằm trong bundle.
- URL deployment bất biến chuyển tới Vercel SSO; không đăng nhập hoặc vượt bảo vệ. Kết luận dựa trên metadata deployment và byte của domain production public.

Giới hạn “chưa biết app đang phục vụ bản mới” đã có bằng chứng giải quyết. Điều này không thay thế kiểm nghiệp vụ bằng tài khoản cửa hàng hoặc kiểm trạng thái một tab đang giữ bundle cũ. Không thực hiện đăng nhập, RPC nghiệp vụ, migration hay deploy trong lượt xác minh này.

## Timeout: điều đã chứng minh và điều chưa biết

Report lỗi gốc có timeout 45.043 ms và lỗi `browserContext.close` tại `finally`; không có step history/trace xác định thao tác bị kẹt. Do đó không thể khôi phục chắc chắn nguyên nhân lần timeout đó chỉ từ report cũ.

Hai điểm yếu của harness đã được chứng minh độc lập:

1. Test cũ đặt `committed=true` trước khi `route.abort()` hoàn tất, rồi chỉ đợi cờ này trước khi đổi đồng hồ dùng chung thêm ba ngày. Đây là thứ tự có thể để việc ngắt ACK và polling từ máy cũ chạy qua mốc clock mới; chưa chứng minh đây là nguyên nhân timeout lịch sử.
2. `finally { await fresh.close(); }` có thể thay lỗi của bước login/list/detail bằng lỗi cleanup. Oracle Playwright/Chromium thực dùng trang HTML rỗng cho thấy manual finally chỉ còn lỗi cleanup, còn fixture teardown giữ lỗi body đầu tiên và báo cleanup riêng. Một body thành công nhưng cleanup lỗi vẫn làm test fail; không nuốt lỗi để tạo PASS.

Đính chính cách diễn giải snapshot trước: artifact không ghi context/page ID. Thông báo phiên hết hạn có thể đến từ máy cũ sau clock jump, hoặc từ máy mới sau `afterEach` trả clock về giờ thật khi timeout. Không đủ bằng chứng kết luận chắc chắn snapshot thuộc máy cũ hoặc thông báo đó gây timeout.

## Sửa harness

Chỉ sửa test, không đổi logic ứng dụng hoặc SQL:

- `tests/supabase/idempotencyTest.ts` cấp factory tạo browser context mới đúng lúc test yêu cầu, nhưng đóng context ở fixture teardown. Cleanup failure vẫn được báo, không che lỗi body.
- TC068 trong `tests/supabase/idempotencyRecovery.spec.ts` đợi cả `route.abort` hoàn tất và browser phát `requestfailed`; đóng page cũ trước khi đổi clock. Đây là kịch bản mất máy/local rồi khôi phục; các oracle phản hồi muộn vẫn ở TC053/054 riêng.
- Chia các bước chuẩn bị, quan sát commit/ngắt ACK, đăng nhập máy mới và tra cứu quyết định thành named steps. Ba bước sau có deadline 15 giây; timeout tổng vẫn 45 giây, retry 0.
- Giữ đủ bốn trạng thái applied/rejected/cancelled/expired và toàn bộ oracle cũ; thêm kiểm đúng một ledger row, đúng terminal state, một request ghi từ máy cũ và không phát request ghi khi máy mới chỉ tra cứu.

## Kiểm thử trong lượt điều tra

Harness Node 24.16.0; PostgreSQL 16.15 / PostgREST 16.2 / GoTrue v2.197.0 thật trên WSL. DB mới `pos_cafe_idem_test_auth_239f6c7c6f18`; preflight `2026-09-14T04:11:52.883Z` kiểm marker, API/observer, caller và đủ 16 migration checksum. Không dùng `.env.local`, mock DB hoặc Supabase cửa hàng. Các suite có reset fixture chạy tuần tự.

Baseline nguyên source `69ffe20542536cab0a2c162807fc12e7a143e5aa104b620ba0eeac065d4cb1f6`: TC068 bốn trạng thái × 10 lượt, **40 PASS**, retry 0, không skip/expected-failure. Đây là lượt chẩn đoán có `--repeat-each=10`, không cộng 40 vào tổng gate hoặc gọi là 40 test nghiệp vụ mới. Chưa tái hiện timeout cũ.

Oracle error-precedence riêng: 1 PASS và 3 lỗi cố ý, checker PASS; không `test.fail`, skip hoặc retry, không DB/HTTP app. Năm oracle điều khiển Promise/exception cũng kiểm được thiếu barrier và thứ tự lỗi. Tất cả nằm ngoài gate nghiệp vụ.

Candidate sửa `493c2af03222deefed6ab679fabd9fba352b79e9938b16ba21e1fd0e2a6f7b84`: TC068 bốn trạng thái × 10 lượt, **40 PASS**, retry 0. Giữ riêng hai report/metadata của baseline và fixed; không cộng các lượt lặp vào gate.

Oracle ACK trên DB thật: bọc riêng `route.abort` để trì hoãn 750 ms và đọc `private.write_clock()` trước/sau. Bản copy test gốc từ `8ed7418` thất bại đúng `ACK_CLOCK_CHANGED_BEFORE_ABORT`, clock đổi từ 08/09 sang 11/09 trước abort. Bản copy candidate mới với cùng hook PASS, clock vẫn ở 08/09 tới khi abort xong. Hai bản copy chỉ đổi đường dẫn import để cài hook; không đổi source ứng dụng, kỳ vọng nghiệp vụ hoặc DB clock trong hook. Đây là một lỗi cố ý và một PASS của oracle, không thuộc gate. Lượt này chứng minh race và độ nhạy bản sửa, không chứng minh hồi tố nguyên nhân timeout cũ.

Oracle dùng trực tiếp fixture mới do reviewer chạy: 1 PASS / 5 lỗi cố ý, checker PASS. Kiểm lỗi body là lỗi đầu, cleanup error vẫn xuất hiện; body tốt/cleanup lỗi vẫn fail; hai context đều được đóng khi một cleanup lỗi. Negative control đưa cleanup vào body lại che lỗi gốc.

Lưu ý provenance: runner gate tự redact mọi artifact local. Hai ACK report có một anon JWT trong config Playwright đã đổi thành `[REDACTED_JWT]`, làm hash khác hash ghi ngay sau chạy. Giữ cả hash trước và sau redaction; root và reviewer tự khôi phục placeholder chỉ trong bộ nhớ bằng credential test để kiểm hash ban đầu khớp chính xác, không in hoặc lưu credential. `redaction-attestation.json` cùng `ack-audit.json` phân biệt rõ biến đổi này; không âm thầm sửa metadata để giả report chưa đổi.

## Gate mới và source được bàn giao

Các lệnh chạy tuần tự từ `2026-09-14T04:22:54.897Z` tới `04:27:54.092Z`, trên cùng candidate `493c2af…` và Node 24.16.0:

| Lệnh | Kết quả thực chạy |
| --- | --- |
| `npm run test:idempotency:discover` | 93 TC, 818 required, 1.183 discovered |
| `npm run test:idempotency:unit` | 637 PASS |
| `npm run test:contracts` | 462 PASS |
| `npm run test:idempotency:tools` | 37 PASS |
| `npm run test:idempotency:e2e` | 47 PASS, đúng một attempt/case, không filter/repeat/skip/xfail/retry |
| `npm run test:idempotency:verify-results` | valid, 818/818 |
| `npm run build` | PASS; JS/CSS vẫn cùng byte với bản ứng dụng trước |

Tổng gate mới **1.183 = 637 + 462 + 37 + 47**. Hai reviewer kiểm source và bằng chứng độc lập; auditor parse mọi assertion/options/attempt, không lấy verifier của dự án làm oracle duy nhất. Postflight PASS `04:28:03.002Z`, đúng DB `pos_cafe_idem_test_auth_239f6c7c6f18`, marker/backend và 16 migration checksum. Runtime test đã dừng; kiểm lại không còn listener DB/Auth/REST/proxy.

Timeout mặc định E2E là 45 giây. **TC011 bootstrap có timeout 120 giây từ trước**, không thay đổi trong lượt này; TC068 và mọi case còn lại vẫn 45 giây. Auditor từng áp nhầm 45 giây cho TC011; giữ kết quả audit FAIL đó, đối chiếu source/report cũ rồi sửa oracle. Negative control chỉ nâng TC068/rejected lên 120 giây trong bản sao report, tính lại hash metadata, vẫn bị auditor từ chối đúng một lỗi timeout. Không sửa test hoặc nới gate để giải quyết nhầm lẫn của auditor.

[Bundle bằng chứng](phase-27-timeout-evidence-2026-09-14/summary.json) gồm raw report đã redact, commands, metadata, repeat/control results, hai review và [SHA256SUMS](phase-27-timeout-evidence-2026-09-14/SHA256SUMS.txt). Các failure cố ý được đặt tên `controlled-*`; failure do giả định auditor sai được đặt tên `historical-*`, không thuộc gate PASS. Các bản source oracle được lưu dạng `.txt` để đối chiếu/tái dựng dưới đường dẫn artifact tương ứng. Trace attachment riêng tư không được đưa vào bundle.

[Commit binding](phase-27-timeout-evidence-2026-09-14/commit-binding.json) kiểm 460 blob của index và commit `ef2c372aec60d8362549e47b7aedb27126129479` khớp mapping độc lập. Tree Git `1ef7df6b8f0e741ce96b4968edd77d1a28fe6fe4`; projected clean fingerprint `13ba2512152b27cb7fc80930a966d57cdb0fed87f3bfaf9c68fadb73c4c30821`. Raw fingerprint giữ `493c2af…` trước/sau commit; 183 file được Git chuẩn hóa CRLF→LF. `pnpm-lock.yaml` vẫn ngoài commit và nguyên SHA256 `86d9c74541d33c1880970534486202dd0307c9a92baf8e6d9cf1d02a246f6996`. Không tuyên bố một gate mới chạy sau commit.

Không chạy lại coverage hoặc smoke mock vì chỉ đổi test. Kết quả coverage trước thuộc phạm vi pure/core đã công bố, không đổi nhãn thành lượt coverage mới cho candidate này.

## Giới hạn kết luận

Frontend production đã xác minh deployment của `ef2c372` sau push, với byte ứng dụng giống bản `8ed7418`. Hai điểm yếu harness có bằng chứng và đã được sửa trong commit test `ef2c372`; nguyên nhân ban đầu của timeout 45 giây vẫn chưa được chứng minh. Loạt chạy lại PASS là bằng chứng về những lượt đó, không phải bằng chứng hồi tố rằng một giả thuyết đã gây lỗi cũ. Chưa thực hiện business smoke trên dữ liệu cửa hàng, Storage API, Realtime hoặc máy in vật lý.

## Xác nhận sau push

Đã push docs evidence `102a8f9df6d73c0aa1dce3e9ee255e58a611b8ae` trước, rồi main `ef2c372aec60d8362549e47b7aedb27126129479`; `git ls-remote` khớp cả hai. 58 checksum của bundle được kiểm trực tiếp từ Git blobs, 460 source blob khớp candidate và 23 file tài liệu ngoài phạm vi giữ nguyên.

Vercel ban đầu pending, sau đó Production deployment `6430580267` gắn đúng `ef2c372` báo success lúc `2026-09-14T04:40:44Z`. Domain public tiếp tục HTTP 200, JS/CSS giữ nguyên hashes đã xác minh. [Metadata và asset hashes sau push](phase-27-frontend-publication-2026-09-14.json) được kiểm chỉ đọc; evidence của `8ed7418` được giữ nguyên. Bản xác nhận này nằm trong commit docs tiếp theo, không tự gán SHA của chính nó trước khi commit tồn tại. Không thực hiện business smoke hoặc migration trên cửa hàng thật.
