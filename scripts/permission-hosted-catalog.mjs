import {QUERIES,RELATIONS,SEQUENCES} from './permission-backup-v2-catalog.mjs';
import {CATALOG_IDS} from './permission-backup-v2-core.mjs';
import {quote,literal} from './permission-backup-v2-local.mjs';
import {assert,hash,stable,QUALIFIED,IDENT} from './permission-hosted-schema.mjs';
import {validateInventory} from './permission-hosted-compare.mjs';

const cOrder=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const canonicalRows=x=>(Array.isArray(x)?x:[x]).map(stable).sort(cOrder);
export async function captureHostedInventory(runtime,target,{token=null,appName,consumers=[]}={}){
 runtime.guard(target);assert(/^hp1_[a-z0-9_]+$/.test(appName));const session=runtime.session(target);
 const query=async sql=>JSON.parse(await session.send(sql.replace(/;\s*$/,'')+';'));
 try{
  if(token)assert(/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(token),'HOSTED_SNAPSHOT_INVALID');
  await session.send(`SET application_name=${literal(appName)};`);
  await session.send(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL application_name=${literal(appName)}; ${token?'SET TRANSACTION SNAPSHOT '+literal(token)+';':''} SET LOCAL statement_timeout='20s'; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'; SET LOCAL extra_float_digits=3; SET LOCAL bytea_output='hex'; SET LOCAL IntervalStyle='iso_8601'; SET LOCAL row_security=off;`);
  const backend=await query("select json_build_object('database',current_database(),'actor',current_user,'sessionUser',session_user,'pid',pg_backend_pid(),'serverVersion',version())");
  assert(backend.database==='postgres'&&backend.actor==='postgres'&&backend.sessionUser==='postgres','HOSTED_PROOF_INVALID');
  const visible=await session.send('SELECT pg_current_snapshot()::text;');
  const out={backend,snapshot:{tokenHash:token?hash(token):null,visibleHash:token?hash(visible):null},relations:await query(RELATIONS),sequenceDefinitions:await query(SEQUENCES),tables:[],catalog:[],occupied:[],unsupported:[]};
  for(const r of out.relations){
   assert(IDENT.test(r.schema)&&IDENT.test(r.name),'HOSTED_COVERAGE_INVALID');const identity=r.schema+'.'+r.name;
   if(!['r','p'].includes(r.kind)||r.extension&&(!r.config||r.condition))out.unsupported.push({identity,reason:'UNSUPPORTED_RELATION_OR_EXTENSION_CONTENT'});
   if(r.kind!=='r')continue;
   const rows=await query(`select coalesce(json_agg(canonical order by canonical collate "C"),'[]') from(select to_jsonb(r)::text canonical from only ${quote(r.schema)}.${quote(r.name)} r) q`);
   out.tables.push({identity,rows:rows.sort(cOrder)});
  }
  for(const id of CATALOG_IDS)out.catalog.push({id,rows:canonicalRows(await query(QUERIES[id]))});
  for(const c of consumers){
   assert(QUALIFIED.test(c.table)&&QUALIFIED.test(c.sequence)&&IDENT.test(c.column));const [schema,table]=c.table.split('.');
   const actual=await query(`select json_build_object('table',${literal(c.table)},'column',a.attname,'cast',format_type(a.atttypid,a.atttypmod)) from pg_attribute a where a.attrelid=${literal(c.table)}::regclass and a.attname=${literal(c.column)} and not a.attisdropped`);
   assert(actual&&actual.cast===c.cast,'HOSTED_CONSUMERS_UNCERTIFIED');
   const values=await query(`select coalesce(json_agg(${quote(c.column)}::text order by ${quote(c.column)}),'[]') from only ${quote(schema)}.${quote(table)} where ${quote(c.column)} is not null`);
   out.occupied.push({sequence:c.sequence,...actual,values});
  }
  out.tables.sort((a,b)=>a.identity<b.identity?-1:1);out.relations.sort((a,b)=>(a.schema+'.'+a.name)<(b.schema+'.'+b.name)?-1:1);out.sequenceDefinitions.sort((a,b)=>a.name<b.name?-1:1);
  return validateInventory(out);
 }finally{await session.close();}
}
export function sequenceState(runtime,target,names){return names.map(name=>{assert(QUALIFIED.test(name));const [s,n]=name.split('.');return {name,...JSON.parse(runtime.sql(target,`select json_build_object('value',last_value::text,'called',is_called) from ${quote(s)}.${quote(n)}`))};}).sort((a,b)=>a.name<b.name?-1:1);}

export const CLOSURE_SQL=`WITH RECURSIVE edges(a,b) AS (
 SELECT confrelid,conrelid FROM pg_constraint WHERE contype='f'
 UNION SELECT inhparent,inhrelid FROM pg_inherits UNION SELECT inhrelid,inhparent FROM pg_inherits
), closure(oid) AS (
 SELECT to_regclass('public.stores')::oid UNION SELECT to_regclass('auth.users')::oid
 UNION SELECT e.b FROM closure c JOIN edges e ON e.a=c.oid
) SELECT coalesce(json_agg(n.nspname||'.'||r.relname order by n.nspname,r.relname),'[]') FROM closure c JOIN pg_class r ON r.oid=c.oid JOIN pg_namespace n ON n.oid=r.relnamespace`;
export async function observeHostedClosure(runtime,target){
 const relations=JSON.parse(runtime.sql(target,CLOSURE_SQL));
 const query=sql=>JSON.parse(runtime.sql(target,`select coalesce(json_agg(x),'[]') from (${sql}) x`));
 const fk=query("select conrelid::regclass::text||'->'||confrelid::regclass::text||':'||conname identity,'OBSERVED_CATALOG' classification from pg_constraint where contype='f'");
 const partitions=query("select inhparent::regclass::text||'->'||inhrelid::regclass::text identity,'OBSERVED_CATALOG' classification from pg_inherits");
 const sideEffects=query("select n.nspname||'.'||c.relname||':'||t.tgname||':'||t.tgfoid::regprocedure::text identity,'UNCLASSIFIED' classification from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname<>'information_schema'");
 const kCount=runtime.sql(target,'SELECT count(*)::text FROM public.write_operations');
 return {relations,fkEdges:fk,partitions,sideEffects,catalogRolesDdlControl:false,actualActorRehearsal:false,lockedFullRows:false,kCount};
}
