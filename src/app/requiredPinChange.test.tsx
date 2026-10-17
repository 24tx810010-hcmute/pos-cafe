import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/appError";
import type { PermissionSession, RequiredPinSession } from "@/domain/permissions";
import type { AppPorts } from "@/ports";
import { PortsContext } from "@/features/shared/portsContext";
import { sessionHasPermission, usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { RequiredPinChangeScreen } from "./screens/RequiredPinChangeScreen";

const restricted: RequiredPinSession = {
  kind: "required_pin_change", storeId: "store-1", employeeId: "owner-1", name: "Chủ quán",
  employeeRevision: 3, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300_000).toISOString(),
};

const makePorts = () => {
  const session = {
    checkRequiredPinSession: vi.fn(async () => ({ valid: true as const, purpose: "required_pin_change" as const, employeeRevision: 3, expiresAt: restricted.expiresAt })),
    completeRequiredPinChange: vi.fn(async () => ({ outcome: "applied" as const, credentialChanged: true as const, pinChangeRequired: false as const, employeeRevision: 4 })),
    revokeSession: vi.fn(async () => undefined),
  };
  const auth = { unpairStore: vi.fn(async () => undefined) };
  return { ports: { permission: { session }, auth } as unknown as AppPorts, session, auth };
};

const renderGate = (ports: AppPorts) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PortsContext.Provider value={ports}><RequiredPinChangeScreen /></PortsContext.Provider>
  </QueryClientProvider>,
);

beforeEach(() => {
  usePermissionSession.setState({ compatibilityBlocked: false, session: null, requiredPinSession: null,
    bundle: null, status: "unverified", generation: 0 });
  usePermissionSession.getState().beginRequiredPinChange(restricted);
  useAppStore.setState({ currentEmployee: null, screen: "passcode", sessionNotice: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("required PIN gate", () => {
  it("ignores late normal authority publication while a restricted session is active", () => {
    const bundle = { catalog: { contractVersion: 1, revision: 1, roles: [], permissions: [], defaults: [] },
      snapshot: { storeId: "store-1", employeeId: "owner-1", role: "owner", active: true, employeeRevision: 3,
        catalogRevision: 1, permissions: ["floor.view"], sources: [] } } as never;
    usePermissionSession.getState().apply(bundle);
    usePermissionSession.getState().setStatus("verified");
    expect(usePermissionSession.getState()).toMatchObject({ session: null, requiredPinSession: restricted, bundle: null, status: "unverified" });
    expect(sessionHasPermission("floor.view")).toBe(false);
  });

  it("keeps restricted identity out of normal authority and completes once", async () => {
    const { ports, session } = makePorts();
    expect(() => usePermissionSession.getState().begin(restricted as PermissionSession)).toThrowError(AppError);
    expect(usePermissionSession.getState()).toMatchObject({ session: null, bundle: null, requiredPinSession: restricted });

    renderGate(ports);
    await waitFor(() => expect(session.checkRequiredPinSession).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "384729" } });
    fireEvent.change(screen.getByTestId("required-confirm-pin"), { target: { value: "384729" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    await waitFor(() => expect(session.completeRequiredPinChange).toHaveBeenCalledOnce());
    expect(session.completeRequiredPinChange).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 3, newPin: "384729" }));
    expect(usePermissionSession.getState()).toMatchObject({ session: null, requiredPinSession: null, bundle: null });
    expect(useAppStore.getState().sessionNotice).toBe("Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.");
  });

  it("does not replay a completion whose acknowledgement is unknown", async () => {
    const { ports, session } = makePorts();
    session.completeRequiredPinChange.mockRejectedValueOnce(new Error("transport lost"));
    renderGate(ports);
    await screen.findByRole("button", { name: "Đổi PIN" });
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "384729" } });
    fireEvent.change(screen.getByTestId("required-confirm-pin"), { target: { value: "384729" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    await waitFor(() => expect(useAppStore.getState().sessionNotice).toContain("Vui lòng đăng nhập lại bằng PIN mới"));
    expect(session.completeRequiredPinChange).toHaveBeenCalledOnce();
    expect(usePermissionSession.getState().requiredPinSession).toBeNull();
  });

  it("drops a stale proof callback after the session generation changes", async () => {
    const { ports, session } = makePorts();
    let release!: (value: Awaited<ReturnType<typeof session.checkRequiredPinSession>>) => void;
    session.checkRequiredPinSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    renderGate(ports);
    await waitFor(() => expect(session.checkRequiredPinSession).toHaveBeenCalledOnce());
    act(() => usePermissionSession.getState().clear());
    await act(async () => release({ valid: true, purpose: "required_pin_change", employeeRevision: 3, expiresAt: restricted.expiresAt }));
    expect(screen.queryByTestId("complete-required-pin")).not.toBeInTheDocument();
    expect(usePermissionSession.getState()).toMatchObject({ session: null, requiredPinSession: null, bundle: null });
  });

  it("returns to login when proof reports an expired or revoked restricted session", async () => {
    const { ports, session } = makePorts();
    session.checkRequiredPinSession.mockRejectedValueOnce(new AppError("EMPLOYEE_SESSION_REQUIRED", "expired"));
    renderGate(ports);
    await waitFor(() => expect(useAppStore.getState().sessionNotice).toBe("Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại."));
    expect(usePermissionSession.getState().requiredPinSession).toBeNull();
  });

  it("shows the exact proof-check and version-conflict messages", async () => {
    const { ports, session } = makePorts();
    session.checkRequiredPinSession.mockRejectedValueOnce(new Error("unavailable"));
    const view = renderGate(ports);
    expect(await screen.findByText("Chưa kiểm tra được phiên. Vui lòng thử lại khi có kết nối.")).toBeVisible();
    expect(screen.getByTestId("complete-required-pin")).toBeDisabled();
    view.unmount();
    session.checkRequiredPinSession.mockResolvedValueOnce({ valid: true, purpose: "required_pin_change", employeeRevision: 4, expiresAt: restricted.expiresAt });
    renderGate(ports);
    await waitFor(() => expect(useAppStore.getState().sessionNotice).toBe("PIN hoặc trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại."));
  });

  it("shows exact local PIN and confirmation messages without a server call", async () => {
    const { ports, session } = makePorts();
    renderGate(ports);
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "12345" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    expect(screen.getByText("PIN mới phải gồm 6 chữ số.")).toBeVisible();
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "123456" } });
    fireEvent.change(screen.getByTestId("required-confirm-pin"), { target: { value: "654321" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    expect(screen.getByText("Hai lần nhập PIN mới chưa khớp.")).toBeVisible();
    expect(session.completeRequiredPinChange).not.toHaveBeenCalled();
  });

  it("shows exact PIN reuse and malformed request responses", async () => {
    const { ports, session } = makePorts();
    session.completeRequiredPinChange.mockRejectedValueOnce(new AppError("PIN_REUSE_NOT_ALLOWED", "internal"))
      .mockRejectedValueOnce(new AppError("INVALID_EMPLOYEE_REQUEST", "internal"));
    renderGate(ports);
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "384729" } });
    fireEvent.change(screen.getByTestId("required-confirm-pin"), { target: { value: "384729" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    expect(await screen.findByText("PIN mới phải khác PIN tạm đang dùng.")).toBeVisible();
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    expect(await screen.findByText("Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại.")).toBeVisible();
    expect(session.completeRequiredPinChange).toHaveBeenCalledTimes(2);
  });

  it("gates synchronously offline and requires a fresh proof after reconnect", async () => {
    const { ports, session } = makePorts();
    let online = true;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
    renderGate(ports);
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
    online = false;
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByTestId("complete-required-pin")).toBeDisabled();
    online = true;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(session.checkRequiredPinSession).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
  });

  it("does not let a focus proof invalidate an in-flight completion", async () => {
    const { ports, session } = makePorts();
    let release!: (value: { outcome: "applied"; credentialChanged: true; pinChangeRequired: false; employeeRevision: number }) => void;
    session.completeRequiredPinChange.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    renderGate(ports);
    await waitFor(() => expect(screen.getByTestId("complete-required-pin")).toBeEnabled());
    fireEvent.change(screen.getByTestId("required-new-pin"), { target: { value: "384729" } });
    fireEvent.change(screen.getByTestId("required-confirm-pin"), { target: { value: "384729" } });
    fireEvent.click(screen.getByTestId("complete-required-pin"));
    await waitFor(() => expect(session.completeRequiredPinChange).toHaveBeenCalledOnce());
    act(() => window.dispatchEvent(new Event("focus")));
    expect(session.checkRequiredPinSession).toHaveBeenCalledOnce();
    await act(async () => release({ outcome: "applied", credentialChanged: true, pinChangeRequired: false, employeeRevision: 4 }));
    expect(useAppStore.getState().sessionNotice).toBe("Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.");
    expect(usePermissionSession.getState().requiredPinSession).toBeNull();
  });

  it("clears the gate immediately and invokes revoke even while offline", async () => {
    const { ports, session } = makePorts();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    renderGate(ports);
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(session.revokeSession).toHaveBeenCalledOnce();
    expect(usePermissionSession.getState().requiredPinSession).toBeNull();
    expect(screen.queryByTestId("required-pin-change-screen")).not.toBeInTheDocument();
  });

  it("expires the local restricted form without waiting for another request", async () => {
    vi.useFakeTimers();
    try {
      const expiring = { ...restricted, expiresAt: new Date(Date.now() + 100).toISOString() };
      usePermissionSession.getState().beginRequiredPinChange(expiring);
      const { ports } = makePorts();
      renderGate(ports);
      await act(async () => undefined);
      act(() => vi.advanceTimersByTime(101));
      expect(usePermissionSession.getState().requiredPinSession).toBeNull();
      expect(useAppStore.getState().sessionNotice).toBe("Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not let late revoke or unpair acknowledgements reroute a newer UI state", async () => {
    const { ports, session, auth } = makePorts();
    let releaseRevoke!: () => void;
    let releaseUnpair!: () => void;
    session.revokeSession.mockImplementationOnce(() => new Promise<undefined>(resolve => { releaseRevoke = () => resolve(undefined); }));
    auth.unpairStore.mockImplementationOnce(() => new Promise<undefined>(resolve => { releaseUnpair = () => resolve(undefined); }));
    renderGate(ports);
    fireEvent.click(screen.getByRole("button", { name: "Đổi quán" }));
    expect(session.revokeSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(auth.unpairStore).toHaveBeenCalledOnce());
    act(() => {
      useAppStore.getState().setScreen("createStore");
      useAppStore.getState().setSessionNotice("phiên mới");
    });
    await act(async () => { releaseRevoke(); releaseUnpair(); });
    expect(useAppStore.getState()).toMatchObject({ screen: "createStore", sessionNotice: "phiên mới" });
  });
});
