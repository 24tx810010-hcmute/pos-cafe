import { beforeEach, describe, expect, it } from "vitest";
import type { PermissionEmployee, PermissionRole } from "@/domain/permissions";
import type { WritePayloadV1 } from "@/domain";
import { createMockPermissionState } from "./permissionState";
import { createMockPermissionRuntime } from "./permissionRuntime";

const uuid = (n: number) => `73000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("new unified mock permission runtime", () => {
  let state: ReturnType<typeof createMockPermissionState>, runtime: ReturnType<typeof createMockPermissionRuntime>;
  const employee = (role: PermissionRole) => state.employees.find(candidate => candidate.role === role)!;
  const login = async (candidate: PermissionEmployee, pin = "384729") => runtime.session.startSession(candidate.id, pin);
  beforeEach(() => { state = createMockPermissionState(); state.now = () => Date.UTC(2026, 8, 17); runtime = createMockPermissionRuntime(state); });

  it("uses one current session for authority reads and financial writes, including revocation", async () => {
    const owner = employee("owner"); await login(owner);
    expect((await runtime.authority.getAuthority()).snapshot.employeeId).toBe(owner.id);
    await expect(runtime.read.getSettingsAdmin()).resolves.toMatchObject({ storeId: state.storeId });
    await expect(runtime.write.capabilities()).resolves.toMatchObject({ writeProtocolVersion: 1 });
    state.session!.revoked = true;
    await expect(runtime.read.getSettingsAdmin()).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
    await expect(runtime.write.capabilities()).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  });

  it("shares employee creation, PIN, name, session, history projection, and write authority", async () => {
    await login(employee("owner")); const targetId = uuid(101);
    const created = await runtime.employeeAdmin.createEmployee({ requestId: uuid(1), id: targetId, name: "Mai mới", role: "cashier", pin: "927416", expectedCatalogRevision: state.catalog.revision });
    expect(created).toMatchObject({ ok: true, data: { id: targetId, name: "Mai mới" } });
    const paid = state.business.orders.find(order => order.status === "paid")!; paid.payment!.employeeId = targetId;
    expect((await runtime.read.getOrderHistoryDetail(paid.id)).cashierName).toBe("Mai mới");
    await runtime.session.revokeSession(); await login(state.employees.find(candidate => candidate.id === targetId)!, "927416");
    expect(state.session?.employeeId).toBe(targetId); await expect(runtime.write.capabilities()).resolves.toMatchObject({ writeProtocolVersion: 1 });
  });

  it("never grants write authority from the legacy business employee store", async () => {
    const cashier = employee("cashier"); cashier.overrides = { grants: [], denies: ["order.create"] };
    state.business.employees[0] = { ...state.business.employees[0], role: "admin", isActive: true };
    await login(cashier);
    const payload: WritePayloadV1 = { schemaVersion: 1, kind: "submit_order_changes", action: "create", orderId: uuid(201), expectedVersion: null,
      tableId: null, orderType: "takeaway", newLines: [{ id: uuid(202), menuItemId: state.business.menu.menuItems[0].id, quantity: 1,
        quotedBasePrice: state.business.menu.menuItems[0].price, options: [] }] };
    await expect(runtime.write.register(uuid(203), payload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.business.orders.some(order => order.id === payload.orderId)).toBe(false);
  });

  it("lets a cashier resolve published menu images without granting menu management", async () => {
    await login(employee("owner"));
    const item = state.business.menu.menuItems[0];
    const file = new File(["image"], "item.png", { type: "image/png" });
    const published = await runtime.menuImages.stageMenuItemImage({ itemId: item.id, file });
    const empty = () => ({ created: [], updated: [], deleted: [] });
    const changes = {
      categories: empty(), menuItems: empty(), optionGroups: empty(), optionValues: empty(),
      menuItemOptionGroups: empty(), imageChanges: [{ itemId: item.id, uploadHandle: published.uploadHandle }],
    };
    await runtime.changes.saveMenuChanges(changes);
    const publishedUrl = runtime.menuImages.getImageUrl(published.uploadHandle);
    expect(publishedUrl).toMatch(/^(blob:|data:)/);
    const staged = await runtime.menuImages.stageMenuItemImage({ itemId: item.id, file });

    await runtime.session.revokeSession();
    await login(employee("cashier"));
    expect(runtime.menuImages.getImageUrl(published.uploadHandle)).toBe(publishedUrl);
    for (const key of [null, undefined, "unknown-asset", staged.uploadHandle])
      expect(runtime.menuImages.getImageUrl(key)).toBeNull();
    await expect(runtime.menuImages.stageMenuItemImage({ itemId: item.id, file })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(runtime.menuImages.readStagedMenuItemImage(staged.uploadHandle)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(runtime.menuImages.discardStagedMenuItemImage(staged.uploadHandle)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(runtime.changes.saveMenuChanges({
      ...changes, imageChanges: [{ itemId: item.id, uploadHandle: staged.uploadHandle }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.business.menu.menuItems.find(candidate => candidate.id === item.id)?.imageAssetKey).toBe(published.uploadHandle);

    state.session!.revoked = true;
    for (const key of [published.uploadHandle, null])
      expect(() => runtime.menuImages.getImageUrl(key)).toThrowError(expect.objectContaining({ code: "EMPLOYEE_SESSION_REQUIRED" }));
    await login(employee("owner"));
    await expect(runtime.menuImages.readStagedMenuItemImage(staged.uploadHandle)).resolves.toBe(file);
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toBeNull();
  });

  it("pairs and unpairs the shared store/session state without retaining employee authority", async () => {
    await runtime.auth.unpairStore(); expect(state.paired).toBe(false); expect(state.business.session).toBeNull();
    await expect(runtime.authority.listRoster()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await runtime.auth.pairStore("0042-ABCDEF"); expect(state.paired).toBe(true);
    expect(await runtime.auth.getStoreSession()).toEqual({ storeId: state.storeId, storeNo: 42 });
    expect(state.session).toBeNull(); await expect(runtime.write.capabilities()).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  });

  it("creates one blank restricted owner context and retains the same result until acknowledgement", async () => {
    const input = { displayName: "  Cà phê Mây  ", address: " 12 Nguyễn Huệ ", seedDemo: true };
    const first = await runtime.auth.createStore(input);
    expect(first).toMatchObject({ adminPin: "123456", seedStatus: "pending", canRetrySeed: false });
    expect(await runtime.auth.createStore(input)).toEqual(first);
    expect(state.business.settings).toMatchObject({ displayName: "Cà phê Mây", address: "12 Nguyễn Huệ" });
    expect(state.business.menu.menuItems).toHaveLength(0);
    expect(state.business.floorPlan.tables).toHaveLength(0);
    expect(state.employees).toHaveLength(1);

    const restricted = await runtime.session.startSession(state.employees[0].id, "123456");
    expect(restricted).toMatchObject({ kind: "required_pin_change", employeeRevision: 0 });
    const blocked = [
      () => runtime.authority.getAuthority(),
      () => runtime.read.getSettingsAdmin(),
      () => runtime.employeeAdmin.listEmployees(),
      () => runtime.changes.updateSettings({ displayName: "Không được ghi" }),
      () => runtime.write.capabilities(),
      () => runtime.menuImages.stageMenuItemImage({ itemId: uuid(301), file: new File(["x"], "x.png", { type: "image/png" }) }),
      () => runtime.print.prepareReceiptReprint(uuid(302)),
      () => runtime.legacyPrint.renderReceipt({} as never),
      () => runtime.initialSeed.getStatus(),
    ];
    for (const action of blocked) await expect(action()).rejects.toMatchObject({ code: "PIN_CHANGE_REQUIRED" });
    expect(() => runtime.menuImages.getImageUrl("private-asset")).toThrowError(expect.objectContaining({ code: "PIN_CHANGE_REQUIRED" }));
    expect(() => runtime.menuImages.getImageUrl(null)).toThrowError(expect.objectContaining({ code: "PIN_CHANGE_REQUIRED" }));
    expect(() => runtime.legacyMenuImages.getImageUrl("private-asset")).toThrowError(expect.objectContaining({ code: "PIN_CHANGE_REQUIRED" }));

    await expect(runtime.auth.createStore({ ...input, address: "Địa chỉ khác" })).rejects.toMatchObject({ code: "BOOTSTRAP_CONFLICT" });
    runtime.auth.acknowledgeCreatedStore();
    await expect(runtime.auth.createStore(input)).rejects.toMatchObject({ code: "BOOTSTRAP_CONFLICT" });
  });

  it("rejects non-canonical create inputs before changing an established fixture", async () => {
    const before = structuredClone(state.business);
    await expect(runtime.auth.createStore({ displayName: " ", seedDemo: true })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(runtime.auth.createStore({ displayName: "Quán", seedDemo: "true" } as never)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    await expect(runtime.auth.createStore({ displayName: "Quán", seedDemo: true, extra: true } as never)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    expect(state.business).toEqual(before);
  });
});
