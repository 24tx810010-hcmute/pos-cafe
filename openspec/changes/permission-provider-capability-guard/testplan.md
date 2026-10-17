# Test plan

Không mở UI/business flow mới. Bốn nhóm chính/exception/biên/security được phủ ở công cụ và runtime; release gates tổng theo change phân quyền giữ riêng, chưa chạy trong slice này.

| Case | Nhóm và bước | Expected |
| --- | --- | --- |
| PGCG-T01 | Main/native: native hook+owner true, provider absent; gọi shared guard | Resolve; chỉ SELECT; actor sai/superuser/không BYPASSRLS/không CREATEROLE bị chặn với mã PGCG-01 |
| PGCG-T02 | Main/provider: native flags false; full typed profile đúng và inherited role true; guard | Resolve; không có mutation query; chạy đúng guard ở các orchestration entry points như cũ |
| PGCG-T03 | Exception/security: mỗi variant thiếu preload, thiếu một GUC, context user/nguồn session/pending_restart, privileged role absent/noinherit, thiếu whitelist, reserved token sai, policy grant thiếu/key sai | Fallback false, trả missing native capability code; không tới prepare/effect |
| PGCG-T04 | Boundary: whitespace tokens, exact parameter/prefix token; gần giống `pgrstx.*`, `authenticator`, relation suffix/prefix, JSON malformed/null/array/wrong value type | Chỉ exact supported tokens/shape được nhận; malformed/near match bị chặn; DML true không thay policy quyền |
| PGCG-T05 | Runtime main: clone offline/read-only nguồn, pin binary/profile; native flags false; guard thật; exact compatibility prepare rồi fixed restore; image fragment trong BEGIN/ROLLBACK | Guard pass; DDL thành công bằng postgres NOSUPERUSER; native grants/owner membership vẫn absent; baseline data/catalog/setting/owner phục hồi; không cleanup/Storage API/live |
| PGCG-T06 | Runtime security: clone variants thiếu preload/membership/whitelist/reserved token/policy grant; reconnect, đọc effective config, guard thật, compare baseline quanh guard | Chặn trước effect; có evidence per-case; ghi rõ conservative guard denial không tự chứng minh PostgreSQL cũng từ chối mọi DDL |
| PGCG-T07 | Regression/tooling: existing cutover/rehearsal/empty activation tests cùng source mới, syntax checks | Toàn bộ required case pass, 0 skip/retry/pending; rollback/default mode/commit unknown/source/target gates còn đúng trong scope tooling |
| PGCG-T08 | Evidence/docs: manifest+snapshot/source before/after, report hash, image/binary/config, clone isolation/source offline, service cleanup, links và hai final reviewers | Bằng chứng đủ tái hiện, status không overstate hosted/release; artifacts old không ghi đè; main dirty khác được giữ |

Lệnh focused tooling sẽ dùng `node node_modules/vitest/vitest.mjs run --config vitest.permission-tooling.config.ts` với file guard mới/cutover/rehearsal/empty activation, reporter JSON và output artifacts riêng. Runner runtime phải yêu cầu đích clone nguồn explicit và kiểm môi trường trước setup; ghi exact command/env/profile cùng log khi chạy. Không chạy smoke live hoặc full product gate để thay proof này.

## Fixture và oracle cụ thể cho PGCG-T01–T04

Fixture B: role `postgres`, superuser=false, bypass_rls=true, can_alter_roles=true; native hook=false/policy=false. Profile P: preload `supautils`; bốn GUC có context=sighup, source=configuration file, pending_restart=false; privileged_role=`supabase_privileged_role`, inherited USAGE=true, configs=`pgrst.*`, reserved=`authenticator*`, policy grants=`{"postgres":["storage.objects"]}`. Một variant chỉ đổi trường được nêu, các trường còn lại giữ B/P. Tooling inject kết quả catalog vào connection giả ghi query; gọi shared guard rồi kiểm mã exact và không có query mutation. Runtime cases được ghi riêng ở bảng dưới.

| Variant | Input đổi từ B/P | Expected guard |
| --- | --- | --- |
| ACT01/02/03 | role=`another_actor`; hoặc superuser=true; hoặc bypass_rls=false | `PRODUCTION_EQUIVALENT_ROLE_REQUIRED` |
| ACT04 | can_alter_roles=false | `ALTER_ROLE_PRIVILEGE_REQUIRED` |
| NAT01 | Native hook=true/policy=true; provider không có | Resolve |
| MIX01/02 | Native hook=true/policy=false; hoặc hook=false/policy=true; profile P đầy đủ | Resolve cả hai |
| MIX03 | Native hook=true/policy=false; bỏ preload | `STORAGE_OBJECTS_OWNERSHIP_REQUIRED` |
| MIX04 | Native hook=false/policy=true; bỏ preload | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| MIX05 | Native hook=false/policy=false; profile P đầy đủ | Resolve |
| MIX06 | Native hook=true/policy=true; policy JSON malformed=`{` | Resolve bằng native, fallback không được dùng |
| GUC01 | Preload shared/session đều chuỗi rỗng | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| GUC02 | Bỏ từng row trong bốn GUC PGCG-03 (4 variants) | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| GUC03/04/05 | Đổi từng GUC context=`user`; source=`session`; hoặc pending_restart=true (12 variants) | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| ROLE01/02 | privileged_role=`another_role`; hoặc inherited USAGE=false | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| CFG01/02 | configs=`log_duration` hoặc `pgrstx.*` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| RSV01/02 | reserved=`authenticator` hoặc `authenticator_extra*` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| POL01–06 | policy JSON lần lượt `{`, `null`, `[]`, `{"other_role":["storage.objects"]}`, `{"postgres":"storage.objects"}`, `{"postgres":["storage.objects_extra"]}` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED` |
| POL07 | policy JSON=`{"postgres":["public.storage.objects"]}`; native hook=true/policy=false | `STORAGE_OBJECTS_OWNERSHIP_REQUIRED` |
| BND01 | configs=` pgrst.db_pre_request , log_duration `, reserved=` anon*, authenticator* `, preload=` supautils ` | Resolve |
| DML01 | Provider thiếu policy grant; SELECT/INSERT/UPDATE/DELETE bool đều true; native hook=true/policy=false | `STORAGE_OBJECTS_OWNERSHIP_REQUIRED` |

Full-profile fallback là một điều kiện chung. Khi native cả hai false và profile thiếu bất kỳ thành phần nào, kiểm hook đứng trước policy nên mã lỗi là `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`; mã này không phải lời khẳng định thành phần thiếu duy nhất là whitelist hook.

## Variants runtime PGCG-T06

Mỗi variant bắt đầu từ clone B/P thực; setup actor `supabase_admin` chỉ đổi cấu hình/membership local được nêu và reconnect actor `postgres`. Đọc lại effective profile và hai native flags; gọi guard thật, so baseline catalog/data/settings trước/sau guard; phục hồi P trước variant kế tiếp. Native flags phải false, không chạy DDL candidate khi guard bị chặn.

| Variant | Setup cụ thể | Expected |
| --- | --- | --- |
| RT01 | `session_preload_libraries=''`, shared preload vẫn rỗng | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`, không effect |
| RT02 | Revoke membership `supabase_privileged_role` khỏi postgres; xác minh USAGE=false | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`, không effect |
| RT03 | `supautils.privileged_role_allowed_configs='log_duration'` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`, không effect |
| RT04 | `supautils.reserved_roles='authenticator'` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`, không effect |
| RT05 | `supautils.policy_grants='{"postgres":["storage.buckets"]}'` | `PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED`, không effect |

Runtime setup dùng trusted startup config của clone; các variant không nhằm chứng minh live có cấu hình lỗi. Guard denial bảo thủ không tự chứng minh PostgreSQL từ chối mọi DDL tương ứng.
