# Mục1 — npm recipe trên source31 và local config candidate, 13/10/2026

**Đã tái hiện recipe local; chưa đạt readiness phát hành.** [Phạm vi và nguồn giao việc](../workflow/tasks/permission-npm-recipe-2026-10-13.md). Không đổi app, tests, lock, recipe hoặc provider. Không push/commit/stage/reset/stash/switch. Không backup/quiescence/rehearsal/cutover/cleanup/activation/Storage delete. Hồ sơ này bổ sung kết quả mới, không sửa lịch sử CLOSE2 hoặc CLOSE3.

## Input, cô lập và khả năng tái hiện

Gọi A là `D:/Workspace/pos-cafe/artifacts/permission-npm-recipe-20261013`; R là `/var/tmp/pos-cafe-npm-recipe-20261013-03` trong WSL Ubuntu-24.04. Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`; docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, hai worktree dirty giữ nguyên. Hướng dẫn từ docs AGENTS/CLAUDE/workflow/SPEC-STANDARD; task verification kế thừa feature hiện hành, không tạo requirement mới.

Source31 manifest SHA `21a1726a8cce20ae692aef895b283032ad46f81f6d5bd3e26188c6bc86ff64cd`; archive SHA `165f9d2edcbed7f9fe8f7aea30ec3c2201b05704e28354479cf79433f721b89f`. Archive phục hồi810 file + manifest2 deletion; xác minh tên canonical, không absolute/.., mọi resolved path trong đích, không link/device/node_modules, directory phải là ancestor của file allowlist. Extract vào đích mới. Source812 mục được kiểm trước/sau mọi run.

R mode0700, config transfer riêng mode0700/file0600. Không copy/link pnpm node_modules. HOME/cache/npmrc riêng trống, network npm default `https://registry.npmjs.org/`, install thật từ cache trống. Env tiến trình dựng bằng allowlist, không kế thừa credential hoặc VITE. Source archive chỉ có `.env.example`, không `.env.local`/production. Build nhận đúng ba VITE qua env riêng; không sửa Vite config hoặc thay build command. Dòng [vercel.json:4](D:/Workspace/pos-cafe/vercel.json:4) quy định `npm ci`; dòng5 `npm run build`; [package.json:8](D:/Workspace/pos-cafe/package.json:8) là `tsc -b && vite build`.

Runtime local: Ubuntu24.04.4 LTS, WSL kernel6.18.33.2, Node24.16.0, npm11.13.0; executable/CLI SHA và realpath trong A/prepare.json. Vercel UI đã quan sát Node24.x ở hồ sơ trước; **exact cloud OS/Node patch/npm UNKNOWN, actual cloud build NOT_RUN**. Không suy tương đương byte với cloud từ cùng major.

Để tái hiện: dùng cùng source archive và Node/npm, một ROOT mới ngoài checkout, kiểm tar/source như A/reproduce.py; chuyển exact config private qua stdin như A/transfer-config.mjs (đổi đích mới và lưu receipt riêng), rồi chạy `npm ci`, `npm run build` trong ROOT/source bằng môi trường allowlist. Script hiện tại cố ý dùng create-new/write-exclusive, không rerun lên đích đã có. A/collect.py khóa graph, binding, output và các run; không gọi API mutation. Source/archive, supporting scripts, logs và docs được pin vào candidate và snapshot; output dist recoverable riêng ở R/npm-dist.tar.gz, hash trong A/private-output-archive.json.

## Kết quả thực chạy

UTC và exits chi tiết ở từng A/<label>.json, log sanitized cùng tên. UTC+7 là giờ Bangkok.

| Phép kiểm | Kết quả mới trên npm graph |
| --- | --- |
| npm ci | 09:55:39.091–09:55:48.066Z, exit0, added353/audited354; không install/legacy-peer-deps/ignore-scripts/force |
| configured npm run build | 09:56:35.332–09:56:43.662Z, exit0; TypeScript + Vite8.0.16/plugin-react6.0.2; warning chunk>500kB giữ nguyên |
| npm ls --all --json | exit0, full resolved graph;30 direct khớp lock;672 package.json manifests pin (bao gồm manifests con, không gọi là672 package cài) |
| Unit | 110 files,1173/1173,exit0; chỉ giảm worker2, không skip/retry |
| Tooling trọng điểm PIN | 10 nhóm/110 test,exit0, cùng danh sách source31 run-tooling.ps1 lịch sử; không DB runtime |
| Typecheck PIN | tsconfig.pin-canary và tsconfig.pin-onboard,2/2 exit0 |
| UI detector | selftest23 finding và `selftest OK` |
| UI audit | 16 states×3 viewport,0 setup failure,6 baseline findings,0 mới,exit0; mở4 ảnh annotated |
| Tooling mở rộng | Lần1 291/306:14 failure vì archive không có Git metadata +1 inventory. Lần2 đọc GIT_DIR của main với GIT_WORK_TREE=copy và GIT_OPTIONAL_LOCKS=0:305/306,exit1; **không all-gates PASS** |
| npm audit --json | exit1,12 dependency findings:10 high/2 moderate,0 critical; tất cả nodes được npm lock đánh dấu dev; không phải chứng minh không thể khai thác |

Tooling mở rộng failure tại [permissionInventory.tool.test.ts:178](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:178) còn chờ `orders`/`floor_decor_items` subscription. Source thực [realtimePort.ts:32](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:32) đăng ký `store_change_signals`, theo comment metadata-only. Đây là chênh lệch test-source có sẵn trong exact source31, chưa khẳng định runtime sai hoặc tự sửa requirement. Giữ FAIL để review; không hạ expected/exclude test. Test fixtures có dòng `PIN_CANARY_FAIL 0/1` là negative-control log trong test đã PASS; kết quả suite được lấy từ exit và summary, không từ tìm từ FAIL đơn lẻ.

A/audit-classification.json liên kết từng advisory từ npm audit, phiên bản/node/dev flag và fixAvailable; một số npm đề xuất major Tailwind4. Không chạy `audit fix` hay nhận rủi ro thay owner. Tái hiện recipe thành công không có nghĩa dependency an toàn phát hành. Cần xử lý findings/acceptance trong candidate riêng trước release; không âm thầm thay npm lock và nhận lại proof cũ.

A/dependency-delta.json ghi11 direct version khác shared pnpm, gồm Supabase2.108.1 so với2.112.3, Playwright1.60.0 so với1.62.1, Vite8.0.16 so với8.2.1. **PIN19/PERM60 full backend/browser trên npm graph chưa chạy**; bằng chứng cũ source31/pnpm giữ nhãn lịch sử. Không gọi local npm result là CLOSE2 được chứng minh lại toàn phần. Đây là input để chọn/verify release pipeline, chưa upload eligible.

## Cấu hình và bundle

Exact config file SHA `5ab7a8c102f02df1caeefdf84c889a5a7493c25083f345c700666ec7c037f030`; tuple compact SHA `aa5f72f98e8c92fc0ce63fa99ea8d8177570e5a463b411a516272231932d8d90`. Nguồn là current compiled frontend được thu ở CLOSE3, pin theo A cũ/probe-build-safe.json; không lấy lại secret write-only. ACL thư mục private Windows cũ được thu hẹp đúng current user+SYSTEM, byte không đổi. WSL không thấy đường dẫn AppData đó, nên chuyển byte qua stdin, kiểm SHA, không đưa key vào command line/chat/log.

AI chọn exact tuple này làm **local release-input candidate** trong phạm vi mục1: mode=supabase, project=kfqjdfwxhkdwihjobpny. A/binding.json ghi fresh read-only GET `/auth/v1/settings` HTTP200 và key SHA; response raw chỉ private. Không gọi Auth signup/signin/token mutation. Kiểm chuỗi composition đủ mode/URL/key trong JS compiled, tương ứng [runtimePorts.ts:65](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:65), không chỉ tìm tên env rời rạc.154 dist files được pin SHA/bytes, output archive mode0600 dưới root0700.

**Không có quyết định đổi provider env:** equality với next Production/Preview Secrets UNKNOWN; owner chưa duyệt ghi lại Secret settings; deploy/promote/upload NOT_RUN. Build đã dùng explicit local candidate, không cần yêu cầu owner gửi secret qua chat. Public key acceptance không phải chứng minh quyền ghi, RLS/Edge runtime hoặc postflight.

## UI phân loại sau mở ảnh

Đã đọc A/ui/report.md và mở A/ui/out/floor__mobile.png cùng ba required_pin_change PNG. Không có defect mới. Sáu findings floor/mobile là dương tính giả theo thiết kế rail thu gọn; không sửa baseline. Selector đầy đủ, text và rectangle trong report đã pin; bảng dùng phần cuối selector để đọc gọn.

| Rule / selector | Measurement | Phân loại |
| --- | --- | --- |
| clipped-text, nav div:first span.px-3.text-[10px]:first |57px→1px,rect1×1| nhãn nhóm ẩn có chủ đích,baseline x2 |
| clipped-text-vertical,strong.overflow-hidden.text-ellipsis |16px→0px,100×0| tên người dùng ẩn trong rail |
| clipped-text-vertical,div.grid.min-w-0 span:nth-of-type(2) |15px→0px,100×0| nhãn role ẩn trong rail |
| clipped-text-vertical,nav span.px-3.text-[10px]:first |15px→1px,1×1| nhãn nhóm ẩn,baseline x2 |
| clipped-text-vertical,button.group.flex span.min-w-0.overflow-hidden:nth-of-type(2) |16px→1px,1×1| nhãn menu ẩn,baseline x10 |
| clipped-text-vertical,aside div.border-t button span.min-w-0.overflow-hidden:nth-of-type(2) |16px→1px,1×1| nhãn Khóa ẩn trong rail |

Ảnh PIN3 viewport không finding. Audit chạy dev/mock trên dependency npm; không phải đo frontend production đã deploy hoặc business/backend acceptance. Browser local/harness đã đóng, không còn listener5178 hay process dùng source copy; không dùng Playwright MCP/browser hosted trong mục1.

## Bảo toàn, lần lỗi và bàn giao

A/shared-before.json và shared-after.json: source812 drift0; main/docs HEAD không đổi;39.329 entries của shared node_modules (file hash và symlink target, không follow link) cùng tree SHA `9a0127e4fce587a6ed771b69f472e6d750b10fc41774101788359c025711097c`. package-lock SHA `fa532f1203f4074fa1a4400f830458e465ba32e13ad39cc44291ae1505a7cc08`; pnpm lock cũng giữ nguyên source31. Không install trong main/docs.

A/attempt-history.json ghi hồi cứu trung thực: attempt01 tar guard không nhận ./directory, chưa extract; attempt02 extract đúng nhưng config path WSL vắng, npm đã in added353 nhưng wrapper lỗi trước ghi exit receipt; không dùng hai lần này làm PASS. Attempt03 cache/source mới có receipt đầy đủ. Các lỗi lệnh khảo sát được ghi riêng, không đổi thành test PASS.

Walkthrough: đọc prepare→npm-ci/npm-build→dependency-delta→binding→UI report/ảnh→tooling-git failure→audit classification→candidate hash. Đã cung cấp để owner có thể review; chưa khẳng định owner đã đọc/hiểu/nghiệm thu.

SEC rồi EVC độc lập cần APPROVE cùng final candidate **cho tính đúng/an toàn của hồ sơ local có giới hạn**, không phải APPROVE release/all-gates. Review pending lúc freeze, verdict bổ sung metadata riêng. Dừng trước mục2; backup13/10 vẫn strict74/75 vì auth sequence, cleanupEligible=false, scope79 và bảo toàn66 Auth/object3 không đổi. Cơ chế/cửa sổ quiescence cần xác định trước hosted control. Không có quyền release mới phát sinh từ hồ sơ hoặc review.

**Metadata review cuối13/10/2026:** SEC và EVC đã lần lượt APPROVE cùng candidate01 SHA `e0cce54023a6e8e4e43491e381bcf00ee79a0d693b6dc5bc8201f30cba160fcd`, không finding chặn trong phạm vi hồ sơ. [Biên bản](../reviews/2026-10-13-permission-npm-recipe.md). EVC còn làm GET Auth settings độc lập HTTP200, không phải provider write. Snapshot nội dung đang review giữ nguyên; bổ sung này chỉ ghi verdict. LOCAL REPRODUCTION được bàn giao; readiness PARTIAL/BLOCKED, cloud/deploy NOT_RUN và STOP trước mục2 không đổi.
