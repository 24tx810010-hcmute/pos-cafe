import toast from "react-hot-toast";
import { formatUiErrorForToast, mapUnknownErrorToUiError } from "@/features/integration";
import { useAppStore } from "./useAppStore";
import { requireCompatibilityUpdate } from "./compatibilityGate";

export const toToastError = (error: unknown): string => mapUnknownErrorToUiError(error).message;

export const notifyUiError = (error: unknown) => {
  requireCompatibilityUpdate(error);
  const uiError = mapUnknownErrorToUiError(error);
  if (uiError.action === "enterPin" || uiError.action === "pairStore") {
    useAppStore.getState().setCurrentEmployee(null);
    useAppStore.getState().setScreen(uiError.action === "enterPin" ? "passcode" : "landing");
  }
  toast.error(formatUiErrorForToast(uiError));
  return uiError;
};
