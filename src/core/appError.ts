export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_PIN"
  | "ORDER_VERSION_CONFLICT"
  | "MENU_ITEM_UNAVAILABLE"
  | "OPTION_VALUE_UNAVAILABLE"
  | "PAYMENT_AMOUNT_TOO_LOW"
  | "OPEN_ORDERS_BLOCK_CLEAR_DEMO"
  | "INVALID_ORDER_ITEMS"
  | "INVALID_ORDER_ID"
  | "INVALID_PAYMENT_ID"
  | "TABLE_NOT_FOUND"
  | "NOT_FOUND"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
