// Literal test data, independent of application seed, UUID generators and pricing helpers.
export const T = '2026-09-08T00:00:00.000Z';
const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
export const ids = Object.freeze({
  S1:uuid(1),S2:uuid(2),A:uuid(11),B:uuid(12),C:uuid(13),E:uuid(14),X:uuid(15),B01:uuid(21),B02:uuid(22),
  O1:uuid(101),O2:uuid(102),O3:uuid(103),MAX:uuid(120),L1:uuid(201),L2:uuid(202),L30:uuid(230),L35:uuid(235),
  P0:uuid(300),P1:uuid(301),M_A:uuid(401),M_T:uuid(402),Q:uuid(501),Z:uuid(502),OPTION1:uuid(601),OPTION2:uuid(602),
  CATEGORY:uuid(701),GROUP:uuid(702),AREA:uuid(703),K1:uuid(1001),K2:uuid(1002),Knew:uuid(1003),
});
export const freshTestId = uuid;
export function createPayload() {
  return {schemaVersion:1,kind:'submit_order_changes',action:'create',orderId:ids.O1,expectedVersion:null,orderType:'dine_in',tableId:ids.B01,
    newLines:[{id:ids.L1,menuItemId:ids.M_A,quantity:2,quotedBasePrice:30000,options:[]}]};
}
export function payPayload() { return {schemaVersion:1,kind:'pay_order',orderId:ids.O1,paymentId:ids.P1,expectedVersion:5,method:'cash',receivedAmount:200000}; }
export function splitPayload() { return {...payPayload(),kind:'pay_order_items',newOrderId:ids.O2,receivedAmount:50000,lines:[{orderItemId:ids.L1,quantity:1,splitItemId:ids.L2}]}; }
export function updatePayload() { return {schemaVersion:1,kind:'submit_order_changes',action:'update',orderId:ids.O1,expectedVersion:5,retainedLines:[{sourceItemId:ids.L1,quantity:5,note:'ít đá'}],newLines:[]}; }
export function voidPayload() { return {schemaVersion:1,kind:'void_order',orderId:ids.O1,expectedVersion:6,reason:'duplicate'}; }

export function schemaPayload(field: string): any {
  if(field.startsWith('pay.')) return payPayload();
  if(field.startsWith('split.')) return splitPayload();
  if(field.startsWith('void.')) return voidPayload();
  if(field.startsWith('update.')||field.startsWith('retained.')) return updatePayload();
  const payload:any=createPayload();
  if(field.startsWith('option.')) payload.newLines[0].options=[{id:ids.OPTION1,optionValueId:ids.Q,quantity:1,quotedPriceDelta:5000}];
  if(field==='takeaway.tableId') {payload.orderType='takeaway';payload.tableId=null;}
  return payload;
}
export function schemaTarget(payload:any, field:string): {object:any;key:string} {
  const [scope,key]=field.split('.');
  if(scope==='retained')return {object:payload.retainedLines[0],key};
  if(scope==='newLine')return {object:payload.newLines[0],key};
  if(scope==='option')return {object:payload.newLines[0].options[0],key};
  if(scope==='split'&&['orderItemId','quantity','splitItemId'].includes(key))return {object:payload.lines[0],key};
  return {object:payload,key};
}
