import { sha256, stable, exactSet, fail } from './permission-backup-v2-core.mjs';
// Capture fidelity is useful without a concurrency guarantee. An unimplemented
// control is refused, never silently treated as effective version retention.
export async function captureStorageV2({objects,metadata,get,putClone,getClone,control=null}) {
  if(control!==null)fail('BACKUP_V2_STORAGE_UNSUPPORTED');
  if(!Array.isArray(objects)||objects.length!==3||!exactSet(objects.map(x=>x.id),objects.map(x=>x.id)))fail('BACKUP_V2_STORAGE_SCOPE');
  const before=await metadata(),captured=[];
  if(!exactSet(before.map(x=>x.id),objects.map(x=>x.id)))fail('BACKUP_V2_STORAGE_SCOPE');
  for(const object of objects){
    const row=before.find(x=>x.id===object.id);
    if(!row.version || row.bucket!==object.bucket || row.path!==object.path)fail('BACKUP_V2_STORAGE_SCOPE');
    const response=await get(row);
    if(response.status!==200||!Buffer.isBuffer(response.bytes)||response.bytes.length!==row.size||response.mime!==row.mime)fail('BACKUP_V2_STORAGE_PAYLOAD');
    captured.push({...row,sha256:sha256(response.bytes),bytes:response.bytes});
  }
  const after=await metadata();if(stable(before)!==stable(after))fail('BACKUP_V2_STORAGE_DRIFT');
  const clone=[];
  for(const object of captured){const uploaded=await putClone(object);if(uploaded.status!==200)fail('BACKUP_V2_STORAGE_CLONE');
    const read=await getClone(object);if(read.status!==200||read.bytes.length!==object.size||read.mime!==object.mime||sha256(read.bytes)!==object.sha256)fail('BACKUP_V2_STORAGE_CLONE');
    clone.push({id:object.id,matched:true,size:read.bytes.length,mime:read.mime,sha256:sha256(read.bytes)});}
  return {schemaVersion:2,kind:'separate-storage-capture',objects:captured.map(({bytes,...row})=>row),control:null,
    payloadClone:{status:'PASS',checks:clone,newApiMetadata:true},status:'BLOCKED',captureBoundary:'MUTABLE_KEY_ENDPOINT_CHECKS_ONLY',
    payloads:captured.map(x=>({id:x.id,base64:x.bytes.toString('base64')})),metadataSha256:sha256(stable(before)),immutableVersionRead:false,retention:false,conditionalDelete:false,globalControl:false,cleanupEligible:false};
}
