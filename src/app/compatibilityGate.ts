import { isAppError } from "@/core/appError";
import { useAppStore } from "./useAppStore";
import { usePermissionSession } from "@/features/shared/permissionSession";

export const isWriteProtocolUnsupported = (error: unknown): boolean =>
  isAppError(error) && error.code === "WRITE_PROTOCOL_UNSUPPORTED";

/** This latch only clears when updated application code loads. */
export const requireCompatibilityUpdate = (error: unknown): boolean => {
  if (!isWriteProtocolUnsupported(error)) return false;
  usePermissionSession.getState().blockCompatibility();
  useAppStore.setState({ updateRequired: true });
  return true;
};
