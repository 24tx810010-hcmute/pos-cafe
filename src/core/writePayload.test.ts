import { describe, expect, it } from "vitest";
import { checkedMoney, isWriteUuid, jsonbText, sameWritePayload, validateWritePayload } from "./writePayload";
import type { WritePayloadV1 } from "@/domain";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12,"0")}`;
const newLine = () => ({id:id(201),menuItemId:id(401),quantity:1,quotedBasePrice:30000,options:[{id:id(601),optionValueId:id(501),quantity:2,quotedPriceDelta:5000}]});
const makeCreate = () => ({schemaVersion:1,kind:"submit_order_changes",action:"create",orderId:id(101),expectedVersion:null,orderType:"dine_in",tableId:id(21),newLines:[newLine()]});
const makeUpdate = () => ({schemaVersion:1,kind:"submit_order_changes",action:"update",orderId:id(101),expectedVersion:5,retainedLines:[{sourceItemId:id(201),quantity:2}],newLines:[newLine()]});
const makePay = () => ({schemaVersion:1,kind:"pay_order",orderId:id(101),paymentId:id(301),expectedVersion:5,method:"cash",receivedAmount:100000});
const makeSplit = () => ({...makePay(),kind:"pay_order_items",newOrderId:id(102),lines:[{orderItemId:id(201),quantity:1,splitItemId:id(202)}]});
const makeVoid = () => ({schemaVersion:1,kind:"void_order",orderId:id(101),expectedVersion:5,reason:"wrong_order"});
type Json = Record<string,unknown>;
type Field = { label:string; make:()=>Json; path:string; nullable?:boolean };
const at = (value:Json,path:string):{obj:Json;key:string} => { const parts=path.split(".");let obj=value;for(const part of parts.slice(0,-1))obj=obj[part] as Json;return {obj,key:parts[parts.length-1]}; };
const fields:Field[] = [
  ...["schemaVersion","kind"].map(k=>({label:`common.${k}`,make:makeCreate,path:k})),
  ...["action","orderId"].map(k=>({label:`submit.${k}`,make:makeCreate,path:k})),
  ...["expectedVersion","orderType","tableId","newLines"].map(k=>({label:`create.${k}`,make:makeCreate,path:k,nullable:k==="expectedVersion"})),
  {label:"takeaway.tableId",make:()=>({...makeCreate(),orderType:"takeaway",tableId:null}),path:"tableId",nullable:true},
  ...["expectedVersion","retainedLines","newLines"].map(k=>({label:`update.${k}`,make:makeUpdate,path:k})),
  ...["sourceItemId","quantity"].map(k=>({label:`retained.${k}`,make:makeUpdate,path:`retainedLines.0.${k}`})),
  ...["id","menuItemId","quantity","quotedBasePrice","options"].map(k=>({label:`newLine.${k}`,make:makeCreate,path:`newLines.0.${k}`})),
  ...["id","optionValueId","quantity","quotedPriceDelta"].map(k=>({label:`option.${k}`,make:makeCreate,path:`newLines.0.options.0.${k}`})),
  ...["orderId","paymentId","expectedVersion","method","receivedAmount"].map(k=>({label:`pay.${k}`,make:makePay,path:k})),
  ...["newOrderId","lines"].map(k=>({label:`split.${k}`,make:makeSplit,path:k})),
  ...["orderItemId","quantity","splitItemId"].map(k=>({label:`split.${k}`,make:makeSplit,path:`lines.0.${k}`})),
  ...["reason","expectedVersion"].map(k=>({label:`void.${k}`,make:makeVoid,path:k})),
];
describe("WritePayloadV1 strict schema",()=>{
  for(const f of fields)for(const variant of ["missing","null","wrong_type","positive"])it(`TC-IDEM-074/core/field=${f.label}/variant=${variant}`,()=>{
    const p=f.make();const {obj,key}=at(p,f.path);const original=obj[key];
    if(variant==="missing")delete obj[key];
    if(variant==="null")obj[key]=null;
    if(variant==="wrong_type")obj[key]=Array.isArray(original)?{}:typeof original==="number"?String(original):typeof original==="string"?[]:1;
    if(variant==="positive"||variant==="null"&&f.nullable)expect(()=>validateWritePayload(p)).not.toThrow();else expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
  for(const field of ["kind","schemaVersion","action","orderType","method","reason"])it(`TC-IDEM-074/core/field=${field}/variant=invalid_literal`,()=>{
    const p:Json=field==="method"?makePay():field==="reason"?makeVoid():makeCreate();p[field]=field==="schemaVersion"?2:"unsupported";expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
  for(const [field,path] of [["common",""],["retained","retainedLines.0"],["newLine","newLines.0"],["option","newLines.0.options.0"]])it(`TC-IDEM-074/core/field=${field}/variant=unknown_field`,()=>{
    const p:Json=field==="retained"?makeUpdate():makeCreate();const {obj,key}=at(p,path?path+".employeeId":"employeeId");obj[key]=id(11);expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
  it("TC-IDEM-074/core no implicit UUID coercion",()=>{for(const value of [null,undefined,12,{},"00000000-0000-0000-0000-000000000000","a"])expect(isWriteUuid(value)).toBe(false);expect(isWriteUuid(id(1))).toBe(true);});
  for(const kind of ["update","pay","split","void"])for(const version of ["missing","null","positive"])it(`TC-IDEM-047/core/kind=${kind}/version=${version}`,()=>{
    const p:Json=({update:makeUpdate,pay:makePay,split:makeSplit,void:makeVoid}[kind]!)();if(version==="missing")delete p.expectedVersion;if(version==="null")p.expectedVersion=null;
    if(version==="positive")expect(()=>validateWritePayload(p)).not.toThrow();else expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
  it("TC-IDEM-076/core money exact bounds and invalid representations",()=>{
    expect(checkedMoney(0)).toBe(0);expect(checkedMoney(2147483647)).toBe(2147483647);
    for(const invalid of [-1,2147483648,0.1,NaN,Infinity])expect(()=>checkedMoney(invalid)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
    const p=makeCreate();p.newLines[0].quotedBasePrice=2147483647;expect(()=>validateWritePayload(p)).not.toThrow();
  });
  it("TC-IDEM-077/core line and option quantity boundaries",()=>{
    for(const [n,valid] of [[0,false],[1,true],[999,true],[1000,false],[1.5,false]] as const){const p=makeCreate();p.newLines[0].quantity=n;if(valid)expect(()=>validateWritePayload(p)).not.toThrow();else expect(()=>validateWritePayload(p)).toThrow();}
    for(const [n,valid] of [[0,false],[1,true],[99,true],[100,false],[1.5,false]] as const){const p=makeCreate();p.newLines[0].options[0].quantity=n;if(valid)expect(()=>validateWritePayload(p)).not.toThrow();else expect(()=>validateWritePayload(p)).toThrow();}
  });
  for(const array of ["create_lines","options"])for(const count of ["0","1","max","max_plus_1"])it(`TC-IDEM-078/core/array=${array}/count=${count}`,()=>{
    const max=array==="create_lines"?200:20;const n=count==="max"?max:count==="max_plus_1"?max+1:Number(count);const p=makeCreate();if(array==="create_lines")p.newLines=Array.from({length:n},(_,i)=>({...newLine(),id:id(10000+i),options:[{...newLine().options[0],id:id(20000+i)}]}));else p.newLines[0].options=Array.from({length:n},(_,i)=>({...newLine().options[0],id:id(10000+i),optionValueId:id(20000+i)}));
    if(n>max||array==="create_lines"&&n===0)expect(()=>validateWritePayload(p)).toThrow();else expect(()=>validateWritePayload(p)).not.toThrow();
  });
  for(const note of ["absent","null","empty","500_ascii","501_ascii","500_emoji","501_emoji"])it(`TC-IDEM-079/core/note=${note}`,()=>{
    const p:Json=makeCreate();const value=note==="null"?null:note==="empty"?"":(note.endsWith("emoji")?"😀":"a").repeat(note.startsWith("501")?501:500);if(note!=="absent")((p.newLines as Json[])[0]).note=value;
    if(note.startsWith("501"))expect(()=>validateWritePayload(p)).toThrow();else expect(()=>validateWritePayload(p)).not.toThrow();
  });
  for(const bytes of [262144,262145])it(`TC-IDEM-078/core/bytes=${bytes}`,()=>{
    const p=makeCreate();
    p.newLines=Array.from({length:200},(_,i)=>({id:id(10000+i),menuItemId:id(401),quantity:1,quotedBasePrice:0,options:Array.from({length:8},(_,j)=>({id:id(20000+i*8+j),optionValueId:id(501+j),quantity:1,quotedPriceDelta:0}))}));
    // Independent JSON serializer for PostgreSQL's documented spaces; DB suite
    // separately verifies the same boundary via octet_length(payload::text).
    const stringify=(v:unknown):string=>Array.isArray(v)?`[${v.map(stringify).join(", ")}]`:v!==null&&typeof v==="object"?`{${Object.entries(v).map(([k,value])=>JSON.stringify(k)+": "+stringify(value)).join(", ")}}`:JSON.stringify(v);
    const size=()=>new TextEncoder().encode(stringify(p)).length;
    for(const line of p.newLines)Object.assign(line,{note:""});
    let remaining=bytes-size();expect(remaining).toBeGreaterThanOrEqual(0);expect(remaining).toBeLessThanOrEqual(100000);
    for(const line of p.newLines){const count=Math.min(remaining,500);Object.assign(line,{note:"a".repeat(count)});remaining-=count;}
    expect(size()).toBe(bytes);
    if(bytes===262144)expect(()=>validateWritePayload(p)).not.toThrow();else expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
  it("TC-IDEM-081/core only cash accepted; missing cash rejected",()=>{
    for(const method of ["qr","bank_transfer","other"]){const p=makePay();p.method=method;expect(()=>validateWritePayload(p)).toThrow();}const p:Json=makePay();delete p.receivedAmount;expect(()=>validateWritePayload(p)).toThrow();
  });
  it("TC-IDEM-015/core JSONB equality ignores object ordering",()=>{
    const a=makeCreate() as WritePayloadV1;expect(sameWritePayload(a,Object.fromEntries(Object.entries(a).reverse()) as WritePayloadV1)).toBe(true);
    expect(jsonbText({a:1,b:"x, y: z"})).toBe('{"a": 1, "b": "x, y: z"}');
  });
  it("TC-IDEM-016/core JSONB array order stays significant",()=>{
    const a=makeCreate();a.newLines.push({...newLine(),id:id(202)});const b=structuredClone(a);b.newLines.reverse();expect(sameWritePayload(a as WritePayloadV1,b as WritePayloadV1)).toBe(false);
  });
  it("TC-IDEM-017/core optional absent and null remain distinct",()=>{
    const a=makeCreate();const b=structuredClone(a);Object.assign(b.newLines[0],{note:null});validateWritePayload(a);validateWritePayload(b);expect(sameWritePayload(a,b)).toBe(false);
  });
  it("TC-IDEM-033/core retained cannot replace menu price name or modifiers",()=>{
    for(const key of ["id","menuItemId","options","price","name","quotedBasePrice"]){const p=makeUpdate();Object.assign(p.retainedLines[0],{[key]:key==="options"?[]:1});expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));}
  });
  for(const duplicate of ["line","option","split"])it(`TC-IDEM-075/core/duplicate=${duplicate}`,()=>{
    const p=duplicate==="split"?makeSplit():makeCreate();
    if("newLines" in p){p.newLines.push({...newLine(),id:duplicate==="line"?p.newLines[0].id:id(202),options:duplicate==="line"?[]:[{...newLine().options[0]}]});}
    else p.lines.push({...p.lines[0],orderItemId:id(203)});
    expect(()=>validateWritePayload(p)).toThrowError(expect.objectContaining({code:"INVALID_WRITE_REQUEST"}));
  });
});
