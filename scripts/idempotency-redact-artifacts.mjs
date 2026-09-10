import { readdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve,join,extname } from 'node:path';

// Failure snapshots can include the store-key input. Only test artifacts are
// rewritten; never read the application's local or remote credential file.
export function redactTestArtifacts(env=process.env){
  const secrets=['VITE_SUPABASE_ANON_KEY','IDEM_STORE_JWT','IDEM_STORE_S2_JWT','IDEM_OBSERVER_DSN','IDEM_TEST_STORE_KEY'].map(key=>env[key]).filter(Boolean);
  function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())visit(file);else if(['.json','.jsonl','.md','.txt','.log'].includes(extname(file))){const original=readFileSync(file,'utf8');let clean=original;for(const secret of secrets)clean=clean.replaceAll(secret,'[REDACTED_TEST_CREDENTIAL]');clean=clean.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]').replace(/\b\d{4}-[A-Z0-9]{6,32}\b/g,'[REDACTED_STORE_KEY]');if(clean!==original)writeFileSync(file,clean);}}}
  for(const name of ['artifacts','test-results']){const dir=resolve(name);if(existsSync(dir))visit(dir);}
}
