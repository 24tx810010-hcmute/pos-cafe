import { describe, expect, test } from 'vitest';
import { assessAllocation, parseArchiveSequences, tocInventory, storageV2Disposition, integer, exactSet, canonicalSchema } from '../../scripts/permission-backup-v2-core.mjs';
import { captureStorageV2 } from '../../scripts/permission-backup-v2-storage.mjs';

const sequence={value:'10',called:true,increment:'1',min:'1',max:'9223372036854775807',cache:'1',cycle:false,type:'bigint'};
const consumer={cast:'bigint'};
describe('TC53-V2 sequence extraction',()=>{
  test('schema comparison retains executable options and comments',()=>{
    const sql='\\restrict abc\n-- Dumped by pg_dump version 17.6\nCREATE TABLE x(a int);\n--\n-- PostgreSQL database dump complete\n--\n\\unrestrict abc';
    expect(canonicalSchema(sql)).toBe(sql);
    expect(canonicalSchema("COMMENT ON TABLE x IS 'changed';")).not.toBe(canonicalSchema("COMMENT ON TABLE x IS 'original';"));
  });
  test.each(['-- Dumped by pg_dump version hidden','-- Completed on hidden','\\unrestrict abc'])('retains framing-like SQL literal line %s',line=>{
    expect(canonicalSchema("COMMENT ON TABLE x IS 'a\n"+line+"\nz';")).not.toBe(canonicalSchema("COMMENT ON TABLE x IS 'a\nz';"));
  });
  test('uses exact BigInt beyond Number precision',()=>expect(parseArchiveSequences("SELECT pg_catalog.setval('public.seq', 9007199254740993, false);",['public.seq'])).toEqual([{name:'public.seq',value:'9007199254740993',called:false}]));
  test.each(['9223372036854775808','-9223372036854775809','01','+1','1.0','1e3'])('rejects noncanonical or overflowing %s',v=>expect(()=>integer(v)).toThrow('BACKUP_V2_SEQUENCE_PARSE'));
  test.each([
    '',"SELECT pg_catalog.setval('public.other', 1, true);",
    "SELECT pg_catalog.setval('public.seq', 1, true);\nSELECT pg_catalog.setval('public.seq', 1, true);",
    "SELECT pg_catalog.setval('public.seq', 1, 'true');", "SELECT pg_catalog.setval('public.seq', 1, true); DROP TABLE x;",
    "SET ROLE postgres;\nSELECT pg_catalog.setval('public.seq', 1, true);",
  ])('rejects missing/extra/duplicate/SQL without executing',sql=>expect(()=>parseArchiveSequences(sql,['public.seq'])).toThrow('BACKUP_V2_SEQUENCE_PARSE'));
  test('TOC preserves exact identities and extraction list',()=>expect(tocInventory('5; 0 1 TABLE DATA public a postgres\n6; 0 2 SEQUENCE SET public seq postgres')).toEqual({tables:['public.a'],sequences:['public.seq'],sequenceList:'6; 0 2 SEQUENCE SET public seq postgres\n'}));
  test('duplicate TOC entry refused',()=>expect(()=>tocInventory('5; 0 1 TABLE DATA public a postgres\n5; 0 1 TABLE DATA public a postgres')).toThrow());
  test('set check detects duplicate even at equal count',()=>expect(exactSet(['a','a'],['a','b'])).toBe(false));
});
describe('TC53-V2 allocation contract',()=>{
  test('positive direction checks all explicit IDs',()=>expect(assessAllocation(sequence,consumer,['1','10'])).toEqual({status:'PASS',next:'11'}));
  test('negative increment and false is_called',()=>expect(assessAllocation({...sequence,value:'-9',called:false,increment:'-2',min:'-20',max:'-1'},consumer,['-8'])).toEqual({status:'PASS',next:'-9'}));
  test.each([
    [{...sequence,called:false},consumer,['10'],'COLLISION'],
    [sequence,consumer,['20'],'UNSAFE_EXTREMA'],
    [{...sequence,value:'9223372036854775807'},consumer,[],'SEQUENCE_RANGE'],
    [{...sequence,value:'2147483647'}, {cast:'integer'},[],'CONSUMER_RANGE'],
    [{...sequence,cycle:true},consumer,[],'CYCLE_UNSUPPORTED'],
    [{...sequence,cache:'5'},consumer,[],'CACHE_UNSUPPORTED'],
    [sequence,undefined,[],'UNSUPPORTED_CONSUMER'],
    [sequence,{cast:'numeric'},[],'UNSUPPORTED_CONSUMER'],
    [{...sequence,increment:'0'},consumer,[],'SEQUENCE_RANGE'],
  ])('rejects unsafe or unsupported profile', (s,c,ids,reason)=>expect(assessAllocation(s,c,ids)).toMatchObject({reason}));
  test.each(['immutable-version','retention','IfMatch','gateway-only',{}])('rejects unsupported Storage control %s',control=>expect(()=>storageV2Disposition({schemaVersion:2,kind:'separate-storage-capture',objects:[],control})).toThrow('BACKUP_V2_STORAGE_UNSUPPORTED'));
  test('missing Storage control remains BLOCKED',()=>expect(storageV2Disposition({schemaVersion:2,kind:'separate-storage-capture',objects:[],control:null}).status).toBe('BLOCKED'));
  test('Storage rejects control before any request',async()=>{
    let calls=0;
    await expect(captureStorageV2({objects:[],metadata:()=>{calls++;},control:'IfMatch'})).rejects.toThrow('BACKUP_V2_STORAGE_UNSUPPORTED');
    expect(calls).toBe(0);
  });
});
