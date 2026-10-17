import pg from 'pg';
import { assertPinOnboardTarget, pinOnboardEnvironment } from '../tests/supabase/permissionPinOnboardEnvironment.ts';
const env = pinOnboardEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
await db.connect();
try {
  await assertPinOnboardTarget(db, env);
  const routes = (await db.query(`select p.oid::regprocedure::text signature,p.proargnames args
    from pg_proc p where p.pronamespace='public'::regnamespace
    and has_function_privilege('authenticated',p.oid,'EXECUTE') order by 1`)).rows;
  console.log(JSON.stringify({ project: env.project, count: routes.length,
    routes: routes.map(row => ({ signature: row.signature.replace(/^public\./, ''), args: row.args })),
    storageColumns: (await db.query(`select column_name,is_nullable,column_default from information_schema.columns
      where table_schema='storage' and table_name='objects' order by ordinal_position`)).rows,
    storageTriggers: (await db.query(`select tgname,tgenabled from pg_trigger
      where tgrelid='storage.objects'::regclass and not tgisinternal order by tgname`)).rows,
    protectDelete: (await db.query(`select pg_get_functiondef(tgfoid) definition from pg_trigger
      where tgrelid='storage.objects'::regclass and tgname='protect_objects_delete'`)).rows[0]?.definition,
    storageOwner: (await db.query(`select current_user caller, pg_get_userbyid(relowner) owner,
      pg_has_role(current_user,relowner,'MEMBER') member from pg_class where oid='storage.objects'::regclass`)).rows[0] }));
} finally { await db.end(); }
