import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, type AppErrorCode } from "@/core/appError";
import { PasscodeScreen } from "./screens/PasscodeScreen";

const state = vi.hoisted(() => ({ code: "INVALID_PIN" as AppErrorCode }));
vi.mock("@/features/session", () => ({
  useActiveEmployeesQuery: () => ({ data: [{ id: "owner-1", name: "Chủ quán" }], isLoading: false }),
  useStoreSessionQuery: () => ({ data: { session: { storeNo: 1 } } }),
  useUnpairStoreMutation: () => ({ mutate: vi.fn() }),
  useVerifyEmployeeMutation: () => ({ isPending: false,
    mutate: (_request: unknown, options: { onError: (error: Error) => void }) =>
      options.onError(new AppError(state.code, "backend detail must not be shown")),
  }),
}));

afterEach(cleanup);

describe("passcode error contexts", () => {
  it.each([
    ["INVALID_PIN", "PIN không đúng. Vui lòng thử lại."],
    ["AUTH_REQUIRED", "Phiên cửa hàng không còn hợp lệ. Vui lòng ghép quán lại."],
  ] as const)("shows the exact %s message without backend detail", (code, message) => {
    state.code = code;
    render(<PasscodeScreen />);
    fireEvent.click(screen.getByTestId("employee-owner-1"));
    for (const digit of "123456") fireEvent.click(screen.getByTestId(`pin-${digit}`));
    fireEvent.click(screen.getByTestId("unlock-button"));
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.queryByText("backend detail must not be shown")).not.toBeInTheDocument();
  });
});
