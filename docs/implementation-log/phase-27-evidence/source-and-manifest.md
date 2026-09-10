# Mã nguồn và manifest

Code main@3ada48c0c9c494d9b34838fd3739bda6091e0bb9; fingerprint `f9eaf52a7c1acd1f22b585c363df2e3fac1a32e566cdd251a20d4708bcc74915`.

Manifest 93 gốc / 669 execution: db 415, e2e 34, mock 13, core 199, tool 8. Danh mục expected trước code: `tests/contracts/caseCatalog.json`, hash `256699b72d53770a1f596378664a2bd5681848534bd87648cc3901c43fdfc698`. Expansion: `tests/contracts/caseManifest.ts`, hash `64c6575490d7db3dee1b2caa795b67304e32efaea700e303dd644adba361a872`. Actual discovery: `e77c643536c5e3a8cb3dc8f28c98b9cac93ed0382da4b3ae5ef5657035a157e4`.

| Migration | SHA-256 file đã áp vào test DB |
| --- | --- |
| supabase/migrations/001_schema_enums.sql | f6d3cdd7f7adb9cc34899296b3d361ba08f8be59e3a4a5f34d7a9d8f448f7637 |
| supabase/migrations/002_indexes_rls_triggers.sql | af3be75bb90ebb3de20d43195ec2a10a24169ff4eaea970a0fbd19f5c321dadf |
| supabase/migrations/003_rpc_functions.sql | 447e4ba1de5da694edf8f8adb30a651a77556431454494174101f9dd997e6f3c |
| supabase/migrations/004_realtime_publication.sql | cd553e55072fb5c0f8f96bb74231a8e07aba7c794a6bcac1cbc8b3ccafd00a09 |
| supabase/migrations/005_menu_item_images_storage.sql | 47888b10b601e80c2df41e02527882fafa35fec330e74f36c9df927f17d52755 |
| supabase/migrations/006_menu_item_image_asset_key.sql | 5c7ed74e5698ac78f100173ea4b93c94f48090552e3ae8bb03630312a48b9bb0 |
| supabase/migrations/007_wipe_all_data.sql | a2f41c0c87df134a54ec1c2a8620bb2497c0a3bf5465ec152017128388402b8e |
| supabase/migrations/008_modifier_rework.sql | 4a104d2091dfb6f7002eb09d8645168023ad2d69906a13d39548a90e76d1b6fb |
| supabase/migrations/009_partial_payment.sql | 226f7a84d239df46d0dbbedf913a56e59a64fa5802e0853f256c9bc8722c2745 |
| supabase/migrations/010_split_payment.sql | 5adb200fcf241064d3708ad63dccc293c0ec9aaeab7a3a9f894954fd1722f93e |
| supabase/migrations/011_void_paid_order.sql | 5eff39afcdba6155031a56f59cf0377854868f8b70e4022913ba77114b6d8979 |
| supabase/migrations/012_action_permission_guardrails.sql | 0af2e00b16ac5e7478eac2a78afb97decec8d7c61db542052893a68774a89e98 |
| supabase/migrations/013_table_background_asset_key.sql | 9a018476ebfd2148aaf4dbeb7b4840be56ff159ed20dca2925eed6d2dd2b2b65 |
| supabase/migrations/014_write_identity_and_ledger.sql | 148491449485efed645814223adf89026e08d6a263f1365b917bd1d7f92b5747 |
| supabase/migrations/015_write_business_helpers.sql | c54dd6b91d36d574baa4e522c5fa6b7f635043a0dcdfcd5322b15dee266924a6 |
| supabase/migrations/016_activate_write_protocol.sql | 3267239282a699551d067d38944069a166c476bcbf340c26e89fcbf79344edf9 |

Các migration 014–016 mới chỉ được áp vào DB test riêng; chưa apply môi trường thật. Các migration cũ destructive không được chạy lại trên database đang có dữ liệu. [Rollout](../phase-27-idempotency-rollout.md).
