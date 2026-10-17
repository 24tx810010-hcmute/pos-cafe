import { describe, expect, it } from "vitest";
import { createMockPermissionState } from "@/adapters/mock/permissionState";
import { parseEmployeeAdminCreate, parseEmployeeAdminUpdate, permissionEmployeeName, permissionPin, permissionRevision, permissionUuid, previewPermissionRoleChange, requiredEmployeePatchPermissions, validatePermissionPinConfirmation } from "./permissionInputs";

const ids = { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
describe("TC-PERM-19/core employee input bounds", () => {
  for (const name of ["A", " An ", "é".repeat(120), "😀".repeat(120), "Tên".repeat(40)]) it(`accepts name with ${[...name.trim()].length} code points (${name.codePointAt(0)})`, () => {
    expect(permissionEmployeeName(name)).toBe(name.trim());
  });
  for (const [label, value] of [["empty", ""], ["spaces", "  "], ["121 ascii", "x".repeat(121)], ["121 astral", "😀".repeat(121)], ["null", null], ["number", 1]] as const)
    it(`rejects name ${label}`, () => expect(() => permissionEmployeeName(value)).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" })));
  it("keeps names 101–120 intact and returns only safe field errors", () => {
    expect(permissionEmployeeName("x".repeat(115))).toHaveLength(115);
    expect(() => permissionEmployeeName("😀".repeat(121))).toThrow(expect.objectContaining({ cause: { fieldErrors: { name: "Tên nhân viên tối đa 120 ký tự." } } }));
  });
  for (const value of ["12345", "1234567", "１２３４５６", "١٢٣٤٥٦", "12345a", "123456\n", " 123456", 123456, null]) it(`rejects invalid PIN ${JSON.stringify(value)}`, () => {
    expect(() => permissionPin(value)).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST", cause: { fieldErrors: { pin: "PIN phải gồm đúng 6 chữ số." } } }));
  });
  it("preserves leading zero PIN and validates confirmation", () => {
    expect(permissionPin("000001")).toBe("000001");
    expect(() => validatePermissionPinConfirmation("000001", "000002")).toThrow(expect.objectContaining({ cause: { fieldErrors: { confirmPin: "Xác nhận PIN không khớp." } } }));
    expect(() => validatePermissionPinConfirmation("000001", "000001")).not.toThrow();
  });
  for (const value of [null, undefined, -1, "7", 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) it(`rejects revision ${String(value)}`, () => {
    expect(() => permissionRevision(value)).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it("accepts integer revisions without coercion", () => { expect(permissionRevision(0)).toBe(0); expect(permissionRevision(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER); });
  for (const value of ["bad", "00000000-0000-0000-0000-000000000000", null, 1]) it(`rejects UUID ${String(value)}`, () => {
    expect(() => permissionUuid(value)).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  for (const role of ["owner", "kitchen", "accountant", "admin", "x.invalid", null]) it(`rejects administrative role ${role}`, () => {
    const state = createMockPermissionState();
    expect(() => parseEmployeeAdminCreate(state.catalog, { requestId: ids.requestId, id: ids.targetId, name: "An", role, pin: "123456", expectedCatalogRevision: 0 })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
    expect(() => parseEmployeeAdminUpdate(state.catalog, "cashier", { ...ids, expectedRevision: 0, expectedCatalogRevision: 0, patch: { role } })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it("creates a normalized request without coercing fields or sending confirmation", () => {
    const state = createMockPermissionState();
    const input = { requestId: ids.requestId, id: ids.targetId, name: " An ", role: "waiter", pin: "000001", expectedCatalogRevision: 0, overrides: { grants: ["report.view", "report.view"], denies: [] } };
    expect(parseEmployeeAdminCreate(state.catalog, input)).toEqual({ ...input, name: "An", overrides: { grants: ["report.view"], denies: [] } });
    expect(() => parseEmployeeAdminCreate(state.catalog, { ...input, actorId: ids.targetId })).toThrow();
    expect(() => parseEmployeeAdminCreate(state.catalog, { ...input, confirmPin: "000001" })).toThrow();
  });
});

describe("TC-PERM-04/19/core patch presence and role preview", () => {
  const setup = () => {
    const state = createMockPermissionState(); const employee = state.employees.find(e => e.role === "cashier")!;
    employee.overrides = { grants: [], denies: ["payment.take"] };
    const parse = (patch: unknown, extra: Record<string, unknown> = {}) => parseEmployeeAdminUpdate(state.catalog, employee.role, { ...ids, expectedRevision: 0, patch, ...extra });
    return { state, employee, parse };
  };
  it("distinguishes missing overrides from explicit reset and preserves field authority", () => {
    const { parse } = setup();
    expect(parse({ name: "An" }).patch).toEqual({ name: "An" });
    const reset = parse({ overrides: null }, { expectedCatalogRevision: 0 });
    expect(reset.patch).toEqual({ overrides: null });
    expect(requiredEmployeePatchPermissions(reset.patch)).toEqual(["employee.permission.edit"]);
    expect(requiredEmployeePatchPermissions(parse({ name: "An", overrides: null }, { expectedCatalogRevision: 0 }).patch)).toEqual(["employee.manage", "employee.permission.edit"]);
    expect(requiredEmployeePatchPermissions(parse({ role: "cashier" }, { expectedCatalogRevision: 0 }).patch)).toEqual(["employee.manage"]);
  });
  it("a same-role preview keeps deny; an actual role change resets it without touching input or revision", () => {
    const { state, employee } = setup(); const before = structuredClone(employee);
    const same = previewPermissionRoleChange(state.catalog, employee, "cashier");
    expect(same).toEqual(employee); same.overrides!.denies.length = 0; expect(employee).toEqual(before);
    expect(previewPermissionRoleChange(state.catalog, employee, "waiter")).toEqual({ ...employee, role: "waiter", overrides: null });
    expect(employee).toEqual(before);
  });
  it("checks catalog revision before normalizing overrides", () => {
    const { state, parse } = setup(); state.catalog.revision = 11;
    expect(() => parse({ overrides: { grants: ["bad"], denies: [] } }, { expectedCatalogRevision: 10 })).toThrow(expect.objectContaining({ code: "PERMISSION_CATALOG_STALE" }));
    expect(() => parse({ overrides: null })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
    expect(() => parse({ role: "cashier" })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  for (const [label, patch] of [["null name", { name: null }], ["null role", { role: null }], ["null active", { isActive: null }], ["string active", { isActive: "false" }], ["unknown field", { pinHash: "never echo" }], ["undefined overrides", { overrides: undefined }], ["missing arrays", { overrides: {} }], ["missing patch", undefined]] as const)
    it(`rejects ${label}`, () => {
      const { parse } = setup();
      expect(() => parse(patch, { expectedCatalogRevision: 0 })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
    });
  it("keeps explicit empty patch as a no-op candidate", () => { const { parse } = setup(); expect(parse({}).patch).toEqual({}); });
});
