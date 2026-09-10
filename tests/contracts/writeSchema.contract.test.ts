import { afterAll, expect, test } from 'vitest';
import { schemaFields } from './caseManifest.ts';
import { ContractHarness, businessOnly } from './harness.ts';
import { ids, schemaPayload, schemaTarget, createPayload, payPayload, splitPayload, updatePayload, voidPayload } from './fixtures.ts';

const h=new ContractHarness();afterAll(()=>h.clock(null));
const payloadFields=schemaFields.filter((field)=>field!=='register.operationId'&&field!=='execute.operationId');
for(const endpoint of ['register','execute'])for(const variant of ['missing','null','wrong_type','positive'])test(`TC-IDEM-074/db/field=${endpoint}.operationId/variant=${variant} validates the RPC UUID boundary`,async()=>{
  await h.reset();const token=await h.login();const p=createPayload();if(endpoint==='execute')await h.register(p,token);
  const args:any={p_payload:p};if(variant!=='missing')args.p_operation_id=variant==='null'?null:variant==='wrong_type'?17:ids.K1;
  const result=await h.rpcRaw(`${endpoint}_write_operation`,args,token);
  if(variant==='positive')expect(result.data.operation.status).toBe(endpoint==='register'?'pending':'applied');
  else{expect(result.status>=400||result.data.ok===false).toBe(true);expect((await h.snapshot()).orders).toHaveLength(0);}
});
for(const field of payloadFields)for(const variant of ['missing','null','wrong_type','positive']) {
  test(`TC-IDEM-074/db/field=${field}/variant=${variant} validates this field without an earlier business failure`,async()=>{
    await h.reset('F0');const token=await h.login();const payload=schemaPayload(field);const {object,key}=schemaTarget(payload,field);
    if(variant==='missing')delete object[key];
    if(variant==='null')object[key]=null;
    if(variant==='wrong_type')object[key]=Array.isArray(object[key])?{}:typeof object[key]==='string'?[]:typeof object[key]==='number'?'1':17;
    const nullable=field==='create.expectedVersion'||field==='takeaway.tableId';
    const valid=variant==='positive'||(variant==='null'&&nullable);
    const before=await h.snapshot();
    if(valid){const result=await h.register(payload,token);expect(result.status).toBe('pending');expect((await h.snapshot()).write_operations).toHaveLength(1);}
    else{await expect(h.register(payload,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect((await h.snapshot()).write_operations).toHaveLength(0);}
    expect(businessOnly(await h.snapshot())).toEqual(businessOnly(before));
  });
}
for(const field of ['kind','schemaVersion','action','orderType','method','reason'])test(`TC-IDEM-074/db/field=${field}/variant=invalid_literal rejects an unsupported enum value`,async()=>{
  await h.reset();const token=await h.login();const p:any=field==='method'?payPayload():field==='reason'?voidPayload():createPayload();p[field]=field==='schemaVersion'?2:'unsupported';
  await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect((await h.snapshot()).write_operations).toHaveLength(0);
});
for(const field of ['common','retained','newLine','option'])test(`TC-IDEM-074/db/field=${field}/variant=unknown_field rejects rather than stripping unexpected fields`,async()=>{
  await h.reset();const token=await h.login();const p=schemaPayload(field==='retained'?'retained.quantity':field==='option'?'option.id':'create.orderType');
  const target=field==='common'?p:field==='retained'?p.retainedLines[0]:field==='option'?p.newLines[0].options[0]:p.newLines[0];target.unexpected='not allowed';
  await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect((await h.snapshot()).write_operations).toHaveLength(0);
});
for(const kind of ['update','pay','split','void'])for(const version of ['missing','null','positive'])test(`TC-IDEM-047/db/kind=${kind}/version=${version} checks valid state before version behavior`,async()=>{
  await h.reset(kind==='void'?'F4':'F1');const token=await h.login();const p:any=kind==='update'?updatePayload():kind==='pay'?payPayload():kind==='split'?splitPayload():voidPayload();
  if(version==='missing')delete p.expectedVersion;if(version==='null')p.expectedVersion=null;
  if(version==='positive'){await h.register(p,token);expect((await h.execute(p,token)).status).toBe('applied');}
  else{const before=await h.snapshot();await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});expect(await h.snapshot()).toEqual(before);}
});
for(const note of ['absent','null','empty','500_ascii','501_ascii','500_emoji','501_emoji'])test(`TC-IDEM-079/db/note=${note} counts Unicode code points rather than UTF16 units`,async()=>{
  await h.reset('F1');const token=await h.login();const p:any=updatePayload();
  if(note==='absent')delete p.retainedLines[0].note;else p.retainedLines[0].note=note==='null'?null:note==='empty'?'':note.includes('emoji')?'😀'.repeat(note.startsWith('500')?500:501):'a'.repeat(note.startsWith('500')?500:501);
  if(note.startsWith('501'))await expect(h.register(p,token)).rejects.toMatchObject({code:'INVALID_WRITE_REQUEST'});
  else{await h.register(p,token);expect((await h.execute(p,token)).status).toBe('applied');}
});
for(const reason of ['absent','null','empty','spaces','nonblank'])test(`TC-IDEM-079/db/reason_other=${reason} requires explicit nonblank explanation for other`,async()=>{
  await h.reset('F4');const token=await h.login();const p:any={...voidPayload(),reason:'other'};
  if(reason!=='absent')p.reasonNote=reason==='null'?null:reason==='empty'?'':reason==='spaces'?'   ':'Nhập nhầm';
  await h.register(p,token);const result=await h.execute(p,token);expect(result.status).toBe(reason==='nonblank'?'applied':'rejected');if(reason!=='nonblank')expect(result.error.code).toBe('VOID_REASON_REQUIRED');
});
