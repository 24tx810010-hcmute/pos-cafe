import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RequiredPinSession } from "@/domain/permissions";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { App } from "./App";

const authorityLifecycle = vi.hoisted(() => vi.fn());
vi.mock("@/features/session", () => ({ useStoreSessionQuery: () => ({
  data: { status: "paired", session: { storeId: "store-1", storeNo: 1 } }, error: null,
}) }));
vi.mock("./PermissionLifecycle", () => ({ PermissionLifecycle: () => { authorityLifecycle(); return <div data-testid="authority-lifecycle" />; } }));
vi.mock("./InitialSeedLifecycle", () => ({ InitialSeedLifecycle: () => <div data-testid="seed-lifecycle" /> }));
vi.mock("./screens/RequiredPinChangeScreen", () => ({ RequiredPinChangeScreen: () => <div data-testid="restricted-gate" /> }));
vi.mock("./screens/RotateGuidance", () => ({ RotateGuidance: () => null }));
vi.mock("./screens/LandingScreen", () => ({ LandingScreen: () => null }));
vi.mock("./screens/StorePairingScreen", () => ({ StorePairingScreen: () => null }));
vi.mock("./screens/CreateStoreScreen", () => ({ CreateStoreScreen: () => null }));
vi.mock("./screens/PasscodeScreen", () => ({ PasscodeScreen: () => <div data-testid="passcode" /> }));
vi.mock("./shell/AppShell", () => ({ AppShell: () => <div data-testid="protected-shell" /> }));

afterEach(() => { cleanup(); authorityLifecycle.mockClear(); usePermissionSession.getState().clear();
  useAppStore.setState({ updateRequired: false, currentEmployee: null, screen: "passcode" }); });

it("mounts only the required-PIN gate for a restricted session", () => {
  const restricted: RequiredPinSession = { kind: "required_pin_change", storeId: "store-1", employeeId: "owner-1", name: "Chủ quán",
    employeeRevision: 1, issuedAt: "2026-09-22T00:00:00.000Z", expiresAt: "2026-09-22T00:05:00.000Z" };
  usePermissionSession.getState().beginRequiredPinChange(restricted);
  render(<App />);
  expect(screen.getByTestId("restricted-gate")).toBeVisible();
  expect(screen.queryByTestId("protected-shell")).not.toBeInTheDocument();
  expect(screen.queryByTestId("seed-lifecycle")).not.toBeInTheDocument();
  expect(screen.queryByTestId("authority-lifecycle")).not.toBeInTheDocument();
  expect(authorityLifecycle).not.toHaveBeenCalled();
  expect(usePermissionSession.getState().bundle).toBeNull();
});
