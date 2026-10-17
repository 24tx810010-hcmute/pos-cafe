import {assert} from './permission-hosted-schema.mjs';

// Split only at a real top-level membership statement. Every original byte is
// replayed; the bootstrap's own exact DDL is repeated after its OID transplant.
export function globalsReplayPlan(sql){
 assert(typeof sql==='string'&&sql.length>0,'HOSTED_INPUT_INVALID');
 let mask='',i=0,state='code',depth=0,tag='',escaped=false;
 while(i<sql.length){const ch=sql[i],two=sql.slice(i,i+2);
  if(state==='line'){mask+=ch==='\n'?'\n':' ';i++;if(ch==='\n')state='code';continue;}
  if(state==='block'){if(two==='/*'){depth++;mask+='  ';i+=2;}else if(two==='*/'){depth--;mask+='  ';i+=2;if(!depth)state='code';}else{mask+=ch==='\n'?'\n':' ';i++;}continue;}
  if(state==='quote'){if(escaped&&ch==='\\'){mask+='  ';i+=2;}else if(two==="''"){mask+='  ';i+=2;}else{mask+=ch==='\n'?'\n':' ';i++;if(ch==="'")state='code';}continue;}
  if(state==='dollar'){if(sql.startsWith(tag,i)){mask+=' '.repeat(tag.length);i+=tag.length;state='code';}else{mask+=ch==='\n'?'\n':' ';i++;}continue;}
  if(state==='identifier'){mask+=ch==='\n'?'\n':' ';i++;if(ch==='"'){if(sql[i]==='"'){mask+=' ';i++;}else state='code';}continue;}
  if(two==='--'){state='line';mask+='  ';i+=2;continue;}
  if(two==='/*'){state='block';depth=1;mask+='  ';i+=2;continue;}
  if(ch==="'"){escaped=/[eE]/.test(sql[i-1]??'')&&(i<2||!/\w/.test(sql[i-2]));state='quote';mask+=' ';i++;continue;}
  if(ch==='"'){state='identifier';mask+=' ';i++;continue;}
  if(ch==='$'){const m=/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(sql.slice(i));if(m){tag=m[0];state='dollar';mask+=' '.repeat(tag.length);i+=tag.length;continue;}}
  mask+=ch;i++;
 }
 assert(state==='code'||state==='line','HOSTED_PROFILE_UNSUPPORTED');
 const inserts=[];
 for(const match of mask.matchAll(/^GRANT\b[^;]*;/gm)){
  const original=sql.slice(match.index,match.index+match[0].length),grantor=/\bGRANTED BY ([a-z_][a-z0-9_$]*);$/.exec(match[0])?.[1];
  assert(grantor,'HOSTED_PROFILE_UNSUPPORTED');
  inserts.push({start:match.index,end:match.index+match[0].length,original,grantor});
 }
 const first=inserts[0]?.start??sql.length;
 const bootstrapStatements=[...mask.matchAll(/^(?:ALTER ROLE supabase_admin\b|COMMENT ON ROLE supabase_admin\b|SECURITY LABEL FOR [a-z_][a-z0-9_$]* ON ROLE supabase_admin\b)[^;]*;/gm)].map(m=>sql.slice(m.index,m.index+m[0].length));
 assert(bootstrapStatements.some(s=>s.startsWith('ALTER ROLE supabase_admin WITH ')),'HOSTED_PROFILE_UNSUPPORTED');
 return {prefix:sql.slice(0,first),suffix:sql.slice(first),grantors:[...new Set(inserts.map(x=>x.grantor))],bootstrapStatements,restrictKey:/^\\restrict ([A-Za-z0-9]+)$/m.exec(sql)?.[1]??null};
}
