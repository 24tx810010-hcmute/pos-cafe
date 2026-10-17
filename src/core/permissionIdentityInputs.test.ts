import { describe, expect, it } from "vitest";
import { parseOwnerPinChange, parsePermissionBootstrap, parseRequiredPinChange } from "./permissionIdentityInputs";
const id = "30000000-0000-4000-8000-000000000001";
const own = { requestId: id, expectedRevision: 0, currentPin: "384729", newPin: "927416" };
const bootstrap = { requestId: id, ownerId: id, storeNo: 1, displayName: " Cà phê ", address: " ", seedDemo: false };
describe("T04 identity inputs", () => {
  it.each(["actorId", "permissions", "targetId", "role"])("rejects spoofed self PIN field %s", key => {
    expect(() => parseOwnerPinChange({ ...own, [key]: id })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it.each([null, -1, 1.1, "0", 9007199254740992])("rejects invalid revision variant %s", revision => {
    expect(() => parseOwnerPinChange({ ...own, expectedRevision: revision })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it("accepts exact request and preserves its identity", () => { expect(parseOwnerPinChange(own)).toEqual(own); });
  it("bootstrap trims Unicode boundaries and accepts maximum store number", () => {
    expect(parsePermissionBootstrap(bootstrap)).toEqual({ ...bootstrap, displayName: "Cà phê", address: "" });
    expect(parsePermissionBootstrap({ ...bootstrap, storeNo: 2147483647, displayName: "😀".repeat(120), address: "😀".repeat(500) }).storeNo).toBe(2147483647);
  });
  it.each([
    ["PIN injection", { pin: "111111" }], ["seed option string", { seedDemo: "true" }], ["seed option missing", { seedDemo: undefined }], ["zero store", { storeNo: 0 }],
    ["overflow", { storeNo: 2147483648 }], ["long name", { displayName: "😀".repeat(121) }], ["long address", { address: "😀".repeat(501) }],
  ])("rejects invalid bootstrap %s", (_label, patch) => {
    expect(() => parsePermissionBootstrap({ ...bootstrap, ...patch })).toThrow(expect.objectContaining({ code: "INVALID_WRITE_REQUEST" }));
  });
});

describe("required PIN input", () => {
  const required = { requestId: id, expectedRevision: 0, newPin: "927416" };
  it("accepts only the restricted completion payload", () => expect(parseRequiredPinChange(required)).toEqual(required));
  it.each(["currentPin", "targetId", "role", "pinChangeRequired", "confirmPin"])("rejects extra %s", key => {
    expect(() => parseRequiredPinChange({ ...required, [key]: "123456" })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST" }));
  });
  it.each(["", "12345", "1234567", "１２３４５６", 123456, null])("rejects non-ASCII/sized PIN %s", newPin => {
    expect(() => parseRequiredPinChange({ ...required, newPin })).toThrow(expect.objectContaining({ code: "INVALID_EMPLOYEE_REQUEST", message: "PIN mới phải gồm 6 chữ số." }));
  });
  it.each([
    { requestId: "bad-id" }, { expectedRevision: -1 }, { unexpected: true },
  ])("shows the payload message for malformed non-PIN fields %#", patch => {
    expect(() => parseRequiredPinChange({ ...required, ...patch })).toThrow(expect.objectContaining({
      code: "INVALID_EMPLOYEE_REQUEST", message: "Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại.",
    }));
  });
});
