import { readFileSync } from 'node:fs';
import { sha256, stable, fail, IDENT, CATALOG_IDS } from './permission-backup-v2-core.mjs';
import { quote, literal, utc } from './permission-backup-v2-local.mjs';
const recipes=JSON.parse(readFileSync(new URL('./permission-backup-v2-queries.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const userSchema="n.nspname !~ '^pg_' and n.nspname<>'information_schema'";
const array=sql=>`select coalesce(jsonb_agg(x order by to_jsonb(x)::text collate "C"),'[]') from (${sql}) x`;
export const RELATIONS=array(`select n.nspname schema,c.relname name,c.relkind kind,pg_get_userbyid(c.relowner) owner,
 e.extname extension,coalesce(c.oid=any(e.extconfig),false) config,ec.condition
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 left join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
 left join pg_extension e on e.oid=d.refobjid
 left join lateral unnest(e.extconfig,e.extcondition) ec(relid,condition) on ec.relid=c.oid
 where c.relkind in('r','p','m','f') and ${userSchema}`);
export const SEQUENCES=array(`select n.nspname||'.'||c.relname name,format_type(s.seqtypid,null) type,s.seqstart::text start,
 s.seqincrement::text increment,s.seqmin::text min,s.seqmax::text max,s.seqcache::text cache,s.seqcycle cycle,pg_get_userbyid(c.relowner) owner
 from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace where ${userSchema}`);
export const QUERIES={
  relations:RELATIONS,
  constraints:array(`select n.nspname schema,c.relname relation,k.conname name,pg_get_constraintdef(k.oid,true) definition,k.convalidated validated from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where ${userSchema}`),
  partitions:array('select i.inhparent::regclass::text parent,i.inhrelid::regclass::text child,pg_get_expr(c.relpartbound,c.oid) bounds from pg_inherits i join pg_class c on c.oid=i.inhrelid'),
  columns:array(`select n.nspname schema,c.relname relation,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) def from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped and c.relkind in('r','p','S') and ${userSchema}`),
  roles:array(`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolconfig,rolvaliduntil::text,
    shobj_description(r.oid,'pg_authid') comment,
    (select jsonb_agg(jsonb_build_object('provider',s.provider,'label',s.label) order by s.provider collate "C") from pg_shseclabel s where s.classoid='pg_authid'::regclass and s.objoid=r.oid) security_labels from pg_roles r`),
  memberships:array('select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option from pg_auth_members'),
  database:recipes.databaseMetadataJsonQuery,
  extensionInventory:recipes.extensionInventoryJsonQuery,
  ...Object.fromEntries(Object.entries(recipes.metadataRowQueries).map(([key,query])=>[key,`select coalesce(jsonb_agg(canonical::jsonb order by canonical collate "C"),'[]') from (${query}) x`])),
  largeObjects:`select coalesce(jsonb_agg(canonical::jsonb order by canonical collate "C"),'[]') from (${recipes.largeObjectRowQuery}) x`,
  triggers:array(`select n.nspname schema,c.relname relation,t.tgname name,t.tgenabled,pg_get_triggerdef(t.oid,true) definition,pg_get_functiondef(t.tgfoid) function from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where ${userSchema}`),
  sequenceDependencies:array(`select x.type,x.schema,x.name,x.identity,d.deptype,y.type reference_type,y.schema reference_schema,y.name reference_name,y.identity reference_identity from pg_depend d cross join lateral pg_identify_object(d.classid,d.objid,d.objsubid) x cross join lateral pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) y where (d.classid='pg_class'::regclass and d.objid in(select seqrelid from pg_sequence)) or (d.refclassid='pg_class'::regclass and d.refobjid in(select seqrelid from pg_sequence))`),
  indexes:array(`select n.nspname schema,c.relname relation,i.relname name,pg_get_indexdef(i.oid) definition,idx.indisvalid,idx.indisready from pg_index idx join pg_class c on c.oid=idx.indrelid join pg_class i on i.oid=idx.indexrelid join pg_namespace n on n.oid=c.relnamespace where ${userSchema}`),
  views:array(`select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,pg_get_viewdef(c.oid,true) definition,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('v','m') and ${userSchema}`),
  types:array(`select n.nspname schema,t.typname name,t.typtype kind,format_type(t.typbasetype,t.typtypmod) base,t.typnotnull,t.typdefault,pg_get_userbyid(t.typowner) owner,(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid) labels from pg_type t join pg_namespace n on n.oid=t.typnamespace where ${userSchema}`),
};
export async function captureInventory(runtime,target,{snapshot,consumers=[]}={}) {
  const session=runtime.session(target),out={importedSnapshot:Boolean(snapshot),snapshotHash:snapshot?sha256(snapshot):null,tables:[],catalog:{},occupied:{},consumerFacts:{}};
  try{
    if(snapshot&&!/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(snapshot))fail('BACKUP_V2_SNAPSHOT_INVALID');
    await session.send(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ${snapshot?'SET TRANSACTION SNAPSHOT '+literal(snapshot)+';':''} SET LOCAL statement_timeout='20s'; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'; SET LOCAL extra_float_digits=3; SET LOCAL bytea_output='hex'; SET LOCAL IntervalStyle='iso_8601'; SET LOCAL row_security=off;`);
    const json=async sql=>JSON.parse(await session.send(sql.trim().replace(/;$/,'')+';'));
    out.relations=await json(RELATIONS);out.sequenceDefinitions=await json(SEQUENCES);
    for(const r of out.relations){
      if(!['r','p'].includes(r.kind)||!IDENT.test(r.schema)||!IDENT.test(r.name))fail('BACKUP_V2_CONTENT_UNSUPPORTED');
      if(r.extension && (!r.config || r.condition))fail('BACKUP_V2_EXTENSION_CONTENT_UNSUPPORTED');
      if(r.kind==='p')continue;
      // Same canonical COPY-text representation used by C's full-row recheck.
      const data=await json(`select json_build_object('rowCount',count(*)::text,'sha256',encode(extensions.digest(convert_to(coalesce(string_agg(replace(canonical,chr(92),chr(92)||chr(92))||chr(10),'' order by canonical collate "C"),''),'UTF8'),'sha256'),'hex')) from(select to_jsonb(r)::text canonical from only ${quote(r.schema)}.${quote(r.name)} r) q`);
      out.tables.push({schema:r.schema,name:r.name,...data});
    }
    for(const id of CATALOG_IDS){const data=await json(QUERIES[id]);out.catalog[id]={rowCount:String(Array.isArray(data)?data.length:1),sha256:sha256(stable(data))};if(id==='extensions')out.extensions=data;if(id==='sequences')out.sequenceCatalog=data;}
    for(const consumer of consumers){const [schema,table]=consumer.table.split('.');
      out.consumerFacts[consumer.sequence]=await json(`select json_build_object('table',${literal(consumer.table)},'column',a.attname,'cast',format_type(a.atttypid,a.atttypmod)) from pg_attribute a where a.attrelid=${literal(consumer.table)}::regclass and a.attname=${literal(consumer.column)} and not a.attisdropped`);
      out.occupied[consumer.sequence]=await json(`select coalesce(json_agg(${quote(consumer.column)}::text order by ${quote(consumer.column)}),'[]') from ${quote(schema)}.${quote(table)} where ${quote(consumer.column)} is not null`);
    }
    out.tables.sort((a,b)=>`${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`));out.sequenceDefinitions.sort((a,b)=>a.name.localeCompare(b.name));
    return out;
  }finally{await session.close();}
}
export function observeSequences(runtime,target,names){return names.map(name=>{const [schema,relation]=name.split('.');const started=utc();const value=JSON.parse(runtime.sql(target,`select json_build_object('value',last_value::text,'called',is_called) from ${quote(schema)}.${quote(relation)}`));return {name,...value,started,completed:utc()};});}
export const sequenceValues=observations=>observations.map(({name,value,called})=>({name,value,called})).sort((a,b)=>a.name.localeCompare(b.name));
export function captureRoles(runtime,target,restrictKey) {
  if(!/^[a-f0-9]{64}$/.test(restrictKey))fail('BACKUP_V2_CONFIG_INVALID');
  runtime.guard(target);
  return runtime.docker(['exec',target.container,'pg_dumpall','-h','/lab','-U','lab_restore','--roles-only','--no-role-passwords','--restrict-key='+restrictKey]);
}
