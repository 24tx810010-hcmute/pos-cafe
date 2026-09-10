// Supplemental native PostgreSQL checks, not a replacement for the manifest or
// PostgREST/browser contract suite. Creates a NEW test DB; no application .env.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cwd=resolve(import.meta.dirname,'..');
const runtime=mkdtempSync(join(tmpdir(),'pos-cafe-native-audit-'));
function run(file,env){
 const result=spawnSync(process.execPath,[join(cwd,'scripts',file)],{cwd,env:{...process.env,...env},encoding:'utf8',timeout:90000});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted-dsn]'));
 if(result.status!==0)throw new Error(`${file} failed (exit ${result.status ?? 'timeout'})`);
}
run('idempotency-local-bootstrap.mjs',{IDEM_RUNTIME_DIR:runtime});
const envText=readFileSync(join(runtime,'idempotency.env'),'utf8');
const dsn=envText.split(/\r?\n/).find(line=>line.startsWith('IDEM_OBSERVER_DSN='))?.slice('IDEM_OBSERVER_DSN='.length);
if(!dsn)throw new Error('isolated bootstrap did not supply observer DSN');
for(const file of ['idempotency-native-business.mjs','idempotency-native-security.mjs','idempotency-native-atomicity.mjs'])run(file,{IDEM_SQL_CHECK_DSN:dsn});
console.log(JSON.stringify({status:'PASS',scope:'supplemental-native-checks',manifestCoverage:false,remoteDataTouched:false}));
