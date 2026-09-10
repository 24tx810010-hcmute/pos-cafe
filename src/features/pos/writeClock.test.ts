import { describe, expect, it } from "vitest";
import type { NewLine, WritePayloadV1 } from "@/domain";
import { createMockPorts, createMockState } from "@/adapters/mock/mockRepos";
import { mockWriteState } from "@/adapters/mock/writeState";

const id = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const line = (n = 201): NewLine => ({ id: id(n), menuItemId: id(401), quantity: 1, quotedBasePrice: 30000, options: [] });
const create = (): WritePayloadV1 => ({ schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: id(101), expectedVersion: null, tableId: id(21), orderType: "dine_in", newLines: [line()] });
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


// Unit clock seams over the memory adapter; not evidence of database timing.
  for(const offset of [-1,0,1])it(`TC-IDEM-062/core/boundary=${offset<0?"minus_1ms":offset===0?"equal":"plus_1ms"} unit clock seam independent from employee TTL`,async()=>{
    const {ports,state,clock}=await setup();const p=create();await ports.write.register(id(1001),p);clock(Date.parse("2026-09-09T00:00:00.000Z")+offset);await ports.employee.startSession(id(11),"123456");
    expect((await ports.write.execute(id(1001),p)).status).toBe(offset<0?"applied":"expired");expect(state.orders).toHaveLength(offset<0?1:0);
  });
  for(const sessionExpiry of [false,true])it(`TC-IDEM-062/core/${sessionExpiry?"validation_session_expiry":"validation_k_expiry"}`,async()=>{
    const {ports,state,clock,writes}=await setup();const p=create();await ports.write.register(id(1001),p);
    if(!sessionExpiry){clock(Date.parse("2026-09-08T23:59:59.999Z"));await ports.employee.startSession(id(11),"123456");}
    writes.beforeCheckpoint=()=>clock(Date.parse(sessionExpiry?"2026-09-08T12:00:00.000Z":"2026-09-09T00:00:00.000Z"));
    if(sessionExpiry){await expect(ports.write.execute(id(1001),p)).rejects.toMatchObject({code:"EMPLOYEE_SESSION_REQUIRED"});await ports.employee.startSession(id(11),"123456");expect((await ports.write.get(id(1001))).status).toBe("pending");}
    else expect((await ports.write.execute(id(1001),p)).status).toBe("expired");
    expect(state.orders).toEqual([]);expect(writes.events).toEqual([]);
  });
