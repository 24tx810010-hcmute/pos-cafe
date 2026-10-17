import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "./useAppStore";
import { ReloadRecoveryNotice, wasPageReloaded } from "./App";

afterEach(cleanup);

it("detects reload navigation without treating normal navigation as a lost-key event", () => {
  expect(wasPageReloaded([{ type: "reload" }])).toBe(true);
  expect(wasPageReloaded([{ type: "navigate" }])).toBe(false);
  expect(wasPageReloaded([])).toBe(false);
});

it("shows the neutral reload notice without changing authentication or navigation state", () => {
  usePermissionSession.getState().clear();
  useAppStore.setState({ screen: "passcode", currentEmployee: null, sessionNotice: null });
  const beforeApp = useAppStore.getState();
  const beforePermission = usePermissionSession.getState();
  const view = render(<ReloadRecoveryNotice reloaded />);
  expect(screen.getByTestId("reload-store-key-notice")).toHaveTextContent(
    "Nếu bạn vừa tạo quán, hãy dùng Store Key đã lưu để ghép quán khi cần",
  );
  expect(useAppStore.getState()).toBe(beforeApp);
  expect(usePermissionSession.getState()).toBe(beforePermission);
  view.rerender(<ReloadRecoveryNotice reloaded={false} />);
  expect(screen.queryByTestId("reload-store-key-notice")).not.toBeInTheDocument();
});
