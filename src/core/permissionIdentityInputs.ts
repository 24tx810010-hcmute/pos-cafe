import type { OwnerPinChangeRequest, PermissionBootstrapRequest, RequiredPinChangeRequest } from "@/domain/permissions";
import { AppError } from "./appError";
import { permissionError } from "./permissionErrors";
import { permissionEmployeeName, permissionPin, permissionRevision, permissionUuid } from "./permissionInputs";

export function parseOwnerPinChange(value: unknown): OwnerPinChangeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(k => !["requestId", "expectedRevision", "currentPin", "newPin"].includes(k)))
    throw permissionError("INVALID_EMPLOYEE_REQUEST");
  const p = value as Record<string, unknown>;
  return { requestId: permissionUuid(p.requestId), expectedRevision: permissionRevision(p.expectedRevision),
    currentPin: permissionPin(p.currentPin), newPin: permissionPin(p.newPin) };
}
export function parsePermissionBootstrap(value: unknown): PermissionBootstrapRequest {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(k => !["requestId", "ownerId", "storeNo", "displayName", "address", "seedDemo"].includes(k))) throw new Error();
    const p = value as Record<string, unknown>;
    if (typeof p.storeNo !== "number" || !Number.isInteger(p.storeNo) || p.storeNo < 1 || p.storeNo > 2147483647
      || typeof p.address !== "string" || [...p.address.trim()].length > 500 || typeof p.seedDemo !== "boolean") throw new Error();
    return { requestId: permissionUuid(p.requestId), ownerId: permissionUuid(p.ownerId), storeNo: p.storeNo,
      displayName: permissionEmployeeName(p.displayName), address: p.address.trim(), seedDemo: p.seedDemo };
  } catch { throw new AppError("INVALID_WRITE_REQUEST", "Dữ liệu thao tác không hợp lệ."); }
}

export function parseRequiredPinChange(value: unknown): RequiredPinChangeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(k => !["requestId", "expectedRevision", "newPin"].includes(k)))
    throw new AppError("INVALID_EMPLOYEE_REQUEST", "Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại.");
  const p = value as Record<string, unknown>;
  let requestId: string;
  let expectedRevision: number;
  try { requestId = permissionUuid(p.requestId); expectedRevision = permissionRevision(p.expectedRevision); }
  catch { throw new AppError("INVALID_EMPLOYEE_REQUEST", "Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại."); }
  let newPin: string;
  try { newPin = permissionPin(p.newPin); }
  catch { throw new AppError("INVALID_EMPLOYEE_REQUEST", "PIN mới phải gồm 6 chữ số."); }
  return { requestId, expectedRevision, newPin };
}
