import { describe, expect, it } from "vitest";
import type { PermissionCode, PermissionOverrides } from "@/domain/permissions";
import { createMockPermissionCatalog } from "@/adapters/mock/permissionState";
import { configuredPermissions, normalizePermissionOverrides } from "./permissionOverrides";

describe("TC-PERM-04/core override normalization", () => {
  const cases: [string, unknown, PermissionOverrides][] = [
    ["null", null, null], ["empty", { grants: [], denies: [] }, null],
    ["default grant", { grants: ["order.create"], denies: [] }, null],
    ["unneeded deny", { grants: [], denies: ["report.view"] }, null],
    ["duplicate and sorted", { grants: ["report.view", "order.voidPaid", "order.voidPaid"], denies: [] }, { grants: ["order.voidPaid", "report.view"], denies: [] }],
    ["overlap on default", { grants: ["order.create"], denies: ["order.create"] }, { grants: [], denies: ["order.create"] }],
    ["overlap outside default", { grants: ["report.view"], denies: ["report.view"] }, null],
    ["100 grants", { grants: Array(100).fill("report.view"), denies: [] }, { grants: ["report.view"], denies: [] }],
    ["100 denies", { grants: [], denies: Array(100).fill("payment.take") }, { grants: [], denies: ["payment.take"] }],
  ];
  for (const [name, input, expected] of cases) it(`normalizes ${name}`, () => {
    const catalog = createMockPermissionCatalog(), before = structuredClone(input);
    expect(normalizePermissionOverrides(catalog, "cashier", input)).toEqual(expected);
    expect(input).toEqual(before);
    expect(normalizePermissionOverrides(catalog, "cashier", expected)).toEqual(expected);
  });
  const invalid: [string, unknown][] = [
    ["undefined", undefined], ["empty object", {}], ["array", []], ["boolean", false],
    ["missing denies", { grants: [] }], ["wrong grants", { grants: "report.view", denies: [] }],
    ["wrong denies", { grants: [], denies: null }], ["number element", { grants: [1], denies: [] }],
    ["unknown code", { grants: ["x.invalid"], denies: [] }], ["removed code", { grants: ["data.wipe"], denies: [] }],
    ["extra field", { grants: [], denies: [], token: "must-not-echo" }],
    ["sparse array", { grants: Array(2), denies: [] }],
    ["101 grants", { grants: Array(101).fill("report.view"), denies: [] }],
    ["101 denies", { grants: [], denies: Array(101).fill("payment.take") }],
  ];
  for (const [name, input] of invalid) it(`rejects ${name}`, () => {
    expect(() => normalizePermissionOverrides(createMockPermissionCatalog(), "cashier", input)).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it("rejects forbidden baseline and owner-only overrides even when overlapping", () => {
    const catalog = createMockPermissionCatalog();
    expect(() => normalizePermissionOverrides(catalog, "cashier", { grants: ["floor.view"], denies: ["floor.view"] })).toThrow(expect.objectContaining({ code: "PERMISSION_BASELINE_REQUIRED" }));
    expect(() => normalizePermissionOverrides(catalog, "manager", { grants: ["data.clearDemo"], denies: ["data.clearDemo"] })).toThrow(expect.objectContaining({ code: "OWNER_ONLY_PERMISSION" }));
    expect(normalizePermissionOverrides(catalog, "manager", { grants: ["settings.manage", "employee.permission.edit"], denies: [] })).toEqual({ grants: ["employee.permission.edit", "settings.manage"], denies: [] });
  });
  it("explains baseline/default/grant/deny with denied defaults preserved", () => {
    const rights = configuredPermissions(createMockPermissionCatalog(), "cashier", { grants: ["report.view", "payment.take"], denies: ["payment.take"] });
    expect(rights.sources.find(s => s.permission === "floor.view")).toEqual({ permission: "floor.view", effective: true, sources: ["default", "baseline"] });
    expect(rights.sources.find(s => s.permission === "payment.take")).toEqual({ permission: "payment.take", effective: false, sources: ["default", "deny"] });
    expect(rights.sources.find(s => s.permission === "report.view")).toEqual({ permission: "report.view", effective: true, sources: ["grant"] });
  });
  it("matches an independent set oracle for every grant/deny state across default and extra rights", () => {
    const catalog = createMockPermissionCatalog();
    const codes: PermissionCode[] = ["order.create", "payment.take", "report.view", "receipt.reprint"];
    const defaults: PermissionCode[] = ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "receipt.reprint"];
    for (let mask = 0; mask < 256; mask++) {
      const grants = codes.filter((_, i) => (mask >> (2 * i)) & 1), denies = codes.filter((_, i) => (mask >> (2 * i)) & 2);
      const expected = [...new Set([...defaults, ...grants])].filter(p => !denies.includes(p)).sort();
      expect(configuredPermissions(catalog, "cashier", { grants, denies }).permissions).toEqual(expected);
    }
  });
});
