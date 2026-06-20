import toast from "react-hot-toast";
import { formatUiErrorForToast, mapUnknownErrorToUiError } from "@/features/integration";

export const toToastError = (error: unknown): string => mapUnknownErrorToUiError(error).message;

export const notifyUiError = (error: unknown) => {
  const uiError = mapUnknownErrorToUiError(error);
  toast.error(formatUiErrorForToast(uiError));
  return uiError;
};
