import { describe, expect, it } from "vitest";
import { AppError } from "@/core/appError";
import {
  getUiErrorTemplate,
  mapAppErrorToUiError,
  mapUnknownErrorToUiError,
} from "./uiError";

describe("uiError", () => {
  it.each([
    ["ORDER_VERSION_CONFLICT", "reloadOrder", true],
    ["MENU_ITEM_UNAVAILABLE", "refreshMenu", true],
    ["OPTION_VALUE_UNAVAILABLE", "refreshMenu", true],
    ["PAYMENT_AMOUNT_TOO_LOW", "collectMoreCash", true],
    ["OPEN_ORDERS_BLOCK_CLEAR_DEMO", "closeOpenOrders", true],
    ["INVALID_PIN", "retry", false],
    ["FORBIDDEN", "requestAdmin", true],
  ] as const)("maps %s to the expected UI action", (code, action, blocking) => {
    const uiError = getUiErrorTemplate(code);

    expect(uiError.action).toBe(action);
    expect(uiError.blocking).toBe(blocking);
    expect(uiError.title.length).toBeGreaterThan(0);
    expect(uiError.message.length).toBeGreaterThan(0);
  });

  it("keeps AppError code and uses runtime message when present", () => {
    const uiError = mapAppErrorToUiError(
      new AppError("PAYMENT_AMOUNT_TOO_LOW", "Khách đưa thiếu 10.000đ."),
    );

    expect(uiError).toMatchObject({
      code: "PAYMENT_AMOUNT_TOO_LOW",
      action: "collectMoreCash",
      message: "Khách đưa thiếu 10.000đ.",
    });
  });

  it("normalizes unknown errors into UNKNOWN UI errors", () => {
    const uiError = mapUnknownErrorToUiError(new Error("Network failed"));

    expect(uiError).toMatchObject({
      code: "UNKNOWN",
      action: "retry",
      message: "Network failed",
      severity: "error",
    });
  });

  it("normalizes non-error throws into a safe UNKNOWN message", () => {
    const uiError = mapUnknownErrorToUiError("raw failure");

    expect(uiError.code).toBe("UNKNOWN");
    expect(uiError.message).toBe("Thao tác chưa hoàn tất. Hãy thử lại hoặc kiểm tra kết nối.");
  });
});
