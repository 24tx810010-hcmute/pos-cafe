import { describe, expect, it } from "vitest";
import type { NewLine, WritePayloadV1 } from "@/domain";
import { createMockPorts, createMockState } from "./mockRepos";
import { mockWriteState } from "./writeState";

const id = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const line = (n = 201): NewLine => ({ id: id(n), menuItemId: id(401), quantity: 1, quotedBasePrice: 30000, options: [] });
const create = (): WritePayloadV1 => ({ schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: id(101), expectedVersion: null, tableId: id(21), orderType: "dine_in", newLines: [line()] });
const payment = (): WritePayloadV1 => ({ schemaVersion: 1, kind: "pay_order", orderId: id(101), paymentId: id(301), method: "cash", expectedVersion: 5, receivedAmount: 200000 });
const split = (): WritePayloadV1 => ({ schemaVersion: 1, kind: "pay_order_items", orderId: id(101), newOrderId: id(102), paymentId: id(301), method: "cash", expectedVersion: 5, receivedAmount: 50000, lines: [{ orderItemId: id(201), quantity: 1, splitItemId: id(202) }] });
async function setup(open = false) {
  const state = createMockState();
  state.session = { storeId: id(1), storeNo: 1 };
  state.employees = [{ id: id(11), name: "A", role: "admin", isActive: true }, { id: id(12), name: "B", role: "cashier", isActive: true }];
  state.pins = { [id(11)]: "123456", [id(12)]: "111111" };
  state.menu.menuItems = [{ id: id(401), name: "Cà phê", price: 30000, categoryId: id(400), imageAssetKey: null, sortOrder: 0, isAvailable: true }];
  state.floorPlan.tables = [{ id: id(21), areaId: id(20), name: "B01", backgroundAssetKey: null, posX: 0, posY: 0, width: 80, height: 80, shape: "square", rotation: 0, seats: 4, sortOrder: 0, status: open ? "occupied" : "empty" }];
  if (open) state.orders.push({ id: id(101), orderNo: 12, businessDate: "2026-09-08", orderType: "dine_in", tableId: id(21), status: "open", lockVersion: 5, total: 150000, items: [{ id: id(201), menuItemId: id(401), itemName: "Cà phê", unitPrice: 30000, quantity: 5, options: [], note: null }], paidAt: null, payment: null, voidedAt: null, voidedByEmployeeId: null, voidReasonCode: null, voidReasonNote: null, createdByEmployeeId: id(11), lastModifiedByEmployeeId: id(11) });
  const writes = mockWriteState(state);
  let clock = Date.parse("2026-09-08T00:00:00.000Z");
  writes.now = () => clock;
  const ports = createMockPorts(state);
  await ports.employee.startSession(id(11), "123456");
  const perform = async (payload: WritePayloadV1, k = 1001) => { await ports.write.register(id(k), payload); return ports.write.execute(id(k), payload); };
  return { state, writes, ports, perform, clock: (ms: number) => { clock = ms; } };
}

describe("write protocol mock (memory only)", () => {
  it("TC-IDEM-051/mock replay keeps historical 120k while current source is 90k and never duplicates payment", async () => {
    const { state, ports, perform, writes } = await setup(true);
    const firstPayload = split(); const first = await perform(firstPayload);
    const secondPayload = split();
    if (secondPayload.kind !== "pay_order_items") throw Error();
    secondPayload.expectedVersion = 6; secondPayload.paymentId = id(302); secondPayload.newOrderId = id(103); secondPayload.lines[0].splitItemId = id(203);
    expect((await perform(secondPayload, 1002)).status).toBe("applied");
    expect(state.orders.find(order => order.id === id(101))?.total).toBe(90_000);
    const replay = await ports.write.execute(id(1001), firstPayload);
    expect(replay.result).toEqual(first.result);
    expect(replay).toMatchObject({ status: "applied", replayCount: "1", result: { sourceOrder: { total: 120_000 }, paidOrder: { total: 30_000 }, receipt: { total: 30_000 } } });
    expect(state.orders.filter(order => order.payment)).toHaveLength(2); expect(writes.events).toHaveLength(2);
  });

  it("TC-IDEM-076/mock quoted total plus retained total overflow precedes PRICE_CHANGED",async()=>{
    const {ports,state}=await setup(true);const before=structuredClone(state);const p:WritePayloadV1={schemaVersion:1,kind:"submit_order_changes",action:"update",orderId:id(101),expectedVersion:5,retainedLines:[{sourceItemId:id(201),quantity:5}],newLines:[{...line(202),quotedBasePrice:2147483647}]};await ports.write.register(id(1001),p);
    expect(await ports.write.execute(id(1001),p)).toMatchObject({status:"rejected",error:{code:"INVALID_WRITE_REQUEST"}});expect(state).toEqual(before);
  });
  it("TC-IDEM-057/mock keyset cursor stays bounded and binds filters",async()=>{
    const {ports}=await setup();await ports.write.register(id(1001),create());const p=create();p.orderId=id(102);await ports.write.register(id(1002),p);
    const filter={kinds:["submit_order_changes","pay_order","pay_order_items","void_order"] as import("@/domain").WriteKind[],statuses:["pending","applied","rejected","cancelled","expired"] as import("@/domain").WriteStatus[],registeredFrom:"2026-09-07T00:00:00.000Z",registeredTo:"2026-09-10T00:00:00.000Z",limit:1};
    const first=await ports.write.list(filter);expect(first.items.map(o=>o.operationId)).toEqual([id(1002)]);expect(first.nextCursor!.length).toBeLessThanOrEqual(512);const second=await ports.write.list({...filter,cursor:first.nextCursor!});expect(second.items.map(o=>o.operationId)).toEqual([id(1001)]);expect(second.nextCursor).toBeNull();
    await expect(ports.write.list({...filter,statuses:["pending"],cursor:first.nextCursor!})).rejects.toMatchObject({code:"INVALID_WRITE_REQUEST"});
  });
  it("TC-IDEM-013/mock registration retry preserves initial timestamps through expiry",async()=>{
    const {ports,clock,state}=await setup();const p=create();const first=await ports.write.register(id(1001),p);
    clock(Date.parse("2026-09-08T18:00:00.000Z"));await ports.employee.startSession(id(11),"123456");const again=await ports.write.register(id(1001),p);expect(again).toEqual(first);
    clock(Date.parse("2026-09-09T00:00:00.000Z"));const terminal=await ports.write.register(id(1001),p);expect(terminal).toMatchObject({status:"expired",registeredAt:"2026-09-08T00:00:00.000Z",expiresAt:"2026-09-09T00:00:00.000Z",replayCount:"0"});expect(state.orders).toEqual([]);
  });
  it("TC-IDEM-030/mock old modifier quantity snapshot plus current new portion",async()=>{
    const {state,perform}=await setup(true);const old=state.orders[0];old.items[0].quantity=2;old.items[0].options=[{id:id(601),optionValueId:id(501),optionName:"Topping cũ",priceDelta:5000,quantity:2}];old.total=80000;
    state.menu.menuItems[0].price=35000;state.menu.optionGroups=[{id:id(702),name:"Topping",isRequired:false,selectType:"multi",sortOrder:0}];state.menu.optionValues=[{id:id(501),optionGroupId:id(702),name:"Topping mới",priceDelta:7000,sortOrder:0}];state.menu.menuItemOptionGroups=[{id:id(703),menuItemId:id(401),optionGroupId:id(702),sortOrder:0}];
    const r=await perform({schemaVersion:1,kind:"submit_order_changes",action:"update",orderId:id(101),expectedVersion:5,retainedLines:[{sourceItemId:id(201),quantity:2}],newLines:[{...line(202),quotedBasePrice:35000,options:[{id:id(602),optionValueId:id(501),quantity:2,quotedPriceDelta:7000}]}]});
    expect(r).toMatchObject({status:"applied",result:{order:{total:129000,items:[{id:id(201),unitTotal:40000,lineTotal:80000,options:[{name:"Topping cũ",quantity:2,priceDelta:5000}]},{id:id(202),unitTotal:49000,lineTotal:49000,options:[{name:"Topping mới",quantity:2,priceDelta:7000}]}]}}});
  });
  it("TC-IDEM-046/mock void paid preserves original payment and new occupant",async()=>{
    const {state,perform}=await setup(true);await perform(payment());const paid=structuredClone(state.orders[0]);state.orders.push({...structuredClone(paid),id:id(103),status:"open",payment:null,paidAt:null,lockVersion:0,items:[],total:20000});state.floorPlan.tables[0].status="occupied";
    const r=await perform({schemaVersion:1,kind:"void_order",orderId:id(101),expectedVersion:6,reason:"duplicate"},1002);expect(r).toMatchObject({status:"applied",result:{order:{status:"void",total:150000,lockVersion:7}}});expect(state.orders[0].payment).toEqual(paid.payment);expect(state.orders[0].paidAt).toBe(paid.paidAt);expect(state.floorPlan.tables[0].status).toBe("occupied");
  });
  it("TC-IDEM-072/mock unexpected error never becomes durable business rejection",async()=>{
    const {writes,ports,state}=await setup(true);const p=payment();await ports.write.register(id(1001),p);const before=structuredClone(state);writes.fault=()=>{throw new TypeError("connection interrupted");};await expect(ports.write.execute(id(1001),p)).rejects.toThrow(TypeError);expect(state).toEqual(before);expect(await ports.write.get(id(1001))).toMatchObject({status:"pending",error:null,result:null,replayCount:"0"});delete writes.fault;expect((await ports.write.execute(id(1001),p)).status).toBe("applied");
  });
  it("TC-IDEM-012/mock register has no business effects", async () => {
    const { state, ports, writes } = await setup(); const before = structuredClone(state);
    expect(await ports.write.register(id(1001), create())).toMatchObject({ status: "pending", replayCount: "0", result: null });
    expect(state).toEqual(before); expect(writes.events).toEqual([]);
  });
  it("TC-IDEM-014/mock create R1 correct, replay immutable after catalog change", async () => {
    const { state, ports, perform, writes } = await setup(); const p = create();
    const first = await perform(p);
    expect(first.result).toMatchObject({ kind: "submit_order_changes", order: { id: id(101), orderNo: 1, total: 30000, lockVersion: 0, createdByEmployeeId: id(11), items: [{ id: id(201), name: "Cà phê", baseUnitPrice: 30000, quantity: 1, unitTotal: 30000, lineTotal: 30000 }] } });
    state.menu.menuItems[0].price = 40000;
    const replay = await ports.write.execute(id(1001), p);
    expect(replay.result).toEqual(first.result); expect(replay.replayCount).toBe("1");
    expect(state.orders).toHaveLength(1); expect(writes.events).toHaveLength(1);
  });
  it("TC-IDEM-015/mock key ordering is irrelevant", async () => {
    const { ports } = await setup(); const p = create(); const reordered = Object.fromEntries(Object.entries(p).reverse()) as WritePayloadV1;
    const a = await ports.write.register(id(1001), p); expect(await ports.write.register(id(1001), reordered)).toEqual(a);
  });
  it("TC-IDEM-016/mock array order remains significant", async () => {
    const { ports } = await setup(); const p = create(); if (p.kind !== "submit_order_changes" || p.action !== "create") throw Error();
    p.newLines.push(line(202)); await ports.write.register(id(1001), p); p.newLines.reverse();
    await expect(ports.write.execute(id(1001), p)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });
  it("TC-IDEM-017/mock absent versus null note", async () => {
    const { ports } = await setup(); const p = create(); if (p.kind !== "submit_order_changes" || p.action !== "create") throw Error();
    await ports.write.register(id(1001), p); p.newLines[0].note = null;
    await expect(ports.write.register(id(1001), p)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });
  it("TC-IDEM-019/mock serial concurrent execute creates one result", async () => {
    const { ports, writes, state } = await setup(); const p = create(); await ports.write.register(id(1001), p);
    const [a,b] = await Promise.all([ports.write.execute(id(1001),p), ports.write.execute(id(1001),p)]);
    expect([a.status,b.status]).toEqual(["applied","applied"]); expect([a.replayCount,b.replayCount]).toEqual(["0","1"]); expect(a.result).toEqual(b.result); expect(writes.events).toHaveLength(1); expect(state.orders).toHaveLength(1);
  });
  it("TC-IDEM-021/mock different keys same table", async () => {
    const { perform, state } = await setup(); expect((await perform(create())).status).toBe("applied");
    const p = create(); p.orderId = id(102); if (p.kind === "submit_order_changes" && p.action === "create") p.newLines[0].id = id(202);
    expect(await perform(p,1002)).toMatchObject({ status: "rejected", error: {code:"TABLE_OCCUPIED"} }); expect(state.orders).toHaveLength(1);
  });
  it("TC-IDEM-025/mock preserves 2 x 30k plus new 40k as distinct rows", async () => {
    const { state, perform } = await setup(true); state.orders[0].items[0].quantity = 2; state.orders[0].total = 60000; state.menu.menuItems[0].price = 40000;
    const result = await perform({ schemaVersion:1,kind:"submit_order_changes",action:"update",orderId:id(101),expectedVersion:5,retainedLines:[{sourceItemId:id(201),quantity:2}],newLines:[{...line(202),quotedBasePrice:40000}] });
    expect(result).toMatchObject({status:"applied",result:{order:{total:100000,items:[{id:id(201),quantity:2,baseUnitPrice:30000,lineTotal:60000},{id:id(202),quantity:1,baseUnitPrice:40000,lineTotal:40000}]}}});
  });
  it("TC-IDEM-028/mock removed line keeps original quantity and snapshots", async () => {
    const { state, writes, perform } = await setup(true); const original = structuredClone(state.orders[0].items[0]);
    await perform({schemaVersion:1,kind:"submit_order_changes",action:"update",orderId:id(101),expectedVersion:5,retainedLines:[{sourceItemId:id(201),quantity:0}],newLines:[line(202)]});
    expect(writes.removedItems).toEqual([{orderId:id(101),item:original}]); expect(state.orders[0].total).toBe(30000);
  });
  for (const price of [35000,25000]) it(`TC-IDEM-034/mock/${price} changed quote rejected durably`,async()=>{
    const {state,ports,perform}=await setup(); state.menu.menuItems[0].price=price; const before=structuredClone(state);
    const r=await perform(create()); expect(r).toMatchObject({status:"rejected",error:{code:"PRICE_CHANGED",details:{proposedNewLinesTotal:price}}}); expect(state).toEqual(before);
    state.menu.menuItems[0].price=30000; expect((await ports.write.execute(id(1001),create())).result).toBeNull();
  });
  it("TC-IDEM-037/mock void open preserves removed history",async()=>{
    const {state,writes,perform}=await setup(true); const old=structuredClone(state.orders[0].items);
    const r=await perform({schemaVersion:1,kind:"submit_order_changes",action:"void_open",orderId:id(101),expectedVersion:5});
    expect(r).toMatchObject({status:"applied",result:{order:{status:"void",items:[],total:0,lockVersion:6}}}); expect(writes.removedItems.map(x=>x.item)).toEqual(old);expect(state.floorPlan.tables[0].status).toBe("empty");
  });
  it("TC-IDEM-038/mock receipt uses option quantity, literal 80k",async()=>{
    const {state,perform}=await setup(true); Object.assign(state.orders[0].items[0],{quantity:2,options:[{id:id(501),optionValueId:id(502),optionName:"Topping cũ",priceDelta:5000,quantity:2}]});state.orders[0].total=80000;
    const p=payment();if(p.kind!=="pay_order")throw Error();p.receivedAmount=100000;
    const r=await perform(p);expect(r).toMatchObject({status:"applied",result:{receipt:{total:80000,receivedAmount:100000,changeAmount:20000,lines:[{baseUnitPrice:30000,quantity:2,unitTotal:40000,lineTotal:80000,options:[{name:"Topping cũ",quantity:2,priceDelta:5000}]}]}}});
  });
  it("TC-IDEM-039/mock low cash leaves entire business state untouched",async()=>{
    const {state,perform}=await setup(true); const p=payment();if(p.kind!=="pay_order")throw Error();p.receivedAmount=149999;const before=structuredClone(state);
    expect(await perform(p)).toMatchObject({status:"rejected",error:{code:"PAYMENT_AMOUNT_TOO_LOW"}});expect(state).toEqual(before);
  });
  it("TC-IDEM-040/mock split partial keeps numbering and exact quantities",async()=>{
    const {state,perform,writes,ports}=await setup(true);state.orders.push({...structuredClone(state.orders[0]),id:id(103),orderNo:20,tableId:null,status:"void",items:[]});
    const p=split();const r=await perform(p);
    expect(r).toMatchObject({status:"applied",result:{sourceOrder:{id:id(101),orderNo:21,total:120000,lockVersion:6,items:[{id:id(201),quantity:4}]},paidOrder:{id:id(102),orderNo:12,total:30000,items:[{id:id(202),quantity:1}]},payment:{id:id(301),amount:30000,receivedAmount:50000,changeAmount:20000}}});
    expect(writes.events).toHaveLength(1);expect((await ports.write.execute(id(1001),p)).result).toEqual(r.result);expect(state.orders.filter(o=>o.payment)).toHaveLength(1);
  });
  it("TC-IDEM-043/mock full split rejected, no implicit full pay",async()=>{
    const {state,perform}=await setup(true);const p=split();if(p.kind!=="pay_order_items")throw Error();p.lines[0].quantity=5;const before=structuredClone(state);
    expect(await perform(p)).toMatchObject({status:"rejected",error:{code:"INVALID_ORDER_ITEMS"}});expect(state).toEqual(before);
  });
  it("TC-IDEM-056/mock takeover uses current actor but keeps initiator and creator",async()=>{
    const {ports,state}=await setup(true);const p=payment();await ports.write.register(id(1001),p);const other=createMockPorts(state);await other.employee.startSession(id(12),"111111");
    const r=await other.write.execute(id(1001),p);expect(r).toMatchObject({initiatedByEmployeeId:id(11),executedByEmployeeId:id(12),result:{order:{createdByEmployeeId:id(11)},payment:{employeeId:id(12)}}});
  });
  it("TC-IDEM-058/mock execute and cancel do not implicitly register",async()=>{
    const {ports,writes}=await setup();await expect(ports.write.execute(id(1001),create())).rejects.toMatchObject({code:"OPERATION_NOT_FOUND"});await expect(ports.write.cancel(id(1001))).rejects.toMatchObject({code:"OPERATION_NOT_FOUND"});expect(writes.operations).toEqual({});
  });
  it("TC-IDEM-059/mock pending cancellation never touches business",async()=>{
    const {ports,state}=await setup();const p=create();await ports.write.register(id(1001),p);expect((await ports.write.cancel(id(1001))).status).toBe("cancelled");expect((await ports.write.execute(id(1001),p)).status).toBe("cancelled");expect(state.orders).toEqual([]);
  });
  it("TC-IDEM-066/mock 48h open order can be paid using new K",async()=>{
    const {ports,perform,clock}=await setup(true);clock(Date.parse("2026-09-10T00:00:00.000Z"));await ports.employee.startSession(id(11),"123456");expect((await perform(payment())).status).toBe("applied");
  });
  it("TC-IDEM-067/mock applied replay at 48h preserves exact R1",async()=>{
    const {ports,perform,clock}=await setup(true);const p=payment();const r=await perform(p);clock(Date.parse("2026-09-10T00:00:00.000Z"));await ports.employee.startSession(id(11),"123456");expect((await ports.write.execute(id(1001),p)).result).toEqual(r.result);
  });
  for(const stage of ["after_business","before_commit"] as const)it(`TC-IDEM-070/mock/${stage} fault rolls back everything and retry works`,async()=>{
    const {ports,writes,state}=await setup(true);const p=split();await ports.write.register(id(1001),p);const before=structuredClone(state);writes.fault=s=>{if(s===stage)throw Error("injected infrastructure error");};
    await expect(ports.write.execute(id(1001),p)).rejects.toThrow("injected");expect(state).toEqual(before);expect(writes.events).toEqual([]);expect((await ports.write.get(id(1001))).status).toBe("pending");writes.fault=undefined;expect((await ports.write.execute(id(1001),p)).status).toBe("applied");
  });
  it("TC-IDEM-073/mock reads and registration never increment replay counter",async()=>{
    const {ports,perform}=await setup();const p=create();await perform(p);await ports.write.get(id(1001));await ports.write.list();await ports.write.cancel(id(1001));await ports.write.register(id(1001),p);expect((await ports.write.get(id(1001))).replayCount).toBe("0");await ports.write.execute(id(1001),p);await ports.write.execute(id(1001),p);expect((await ports.write.get(id(1001))).replayCount).toBe("2");
  });
  it("TC-IDEM-093/mock terminal mismatch and denied actor leave record unchanged",async()=>{
    const {ports,perform,state}=await setup(true);const p=payment();const first=await perform(p);const changed={...p,receivedAmount:180000} as WritePayloadV1;await expect(ports.write.execute(id(1001),changed)).rejects.toMatchObject({code:"IDEMPOTENCY_KEY_REUSED"});state.employees[0].permissionOverrides={grants:[],denies:["payment.take"]};await expect(ports.write.execute(id(1001),p)).rejects.toMatchObject({code:"FORBIDDEN"});state.employees[0].permissionOverrides=undefined;expect(await ports.write.get(id(1001))).toEqual(first);
  });
});
