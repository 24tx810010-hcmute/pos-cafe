import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../useAppStore";
import { LeftNav } from "./LeftNav";

const admin = { id: "30000000-0000-4000-8000-000000000011", name: "Chủ cửa hàng" };

afterEach(() => {
  cleanup();
  useAppStore.setState({
    screen: "landing",
    currentEmployee: null,
    activeAreaId: null,
    activeCategoryId: null,
    drawer: null,
    orderContext: null,
    paymentOrderId: null,
    draftItems: [],
  });
});

describe("LeftNav", () => {
  it("owns the sidebar navigation and drawer selection actions", () => {
    useAppStore.setState({ currentEmployee: admin, drawer: null });

    render(<LeftNav />);

    expect(screen.getByRole("navigation", { name: "POS modules" })).toBeInTheDocument();
    expect(screen.getByText("Vận hành")).toBeInTheDocument();
    expect(screen.getByText("Quản trị")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-kitchen")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mang đi" }));

    expect(useAppStore.getState().drawer).toBe("takeaway");
  });

  it("surfaces the signed-in employee as a dedicated session block", () => {
    useAppStore.setState({ currentEmployee: admin, drawer: null });

    render(<LeftNav />);

    expect(screen.getByTestId("left-nav-session")).toHaveAttribute("aria-label", "Đang đăng nhập: Chủ cửa hàng · ");
    expect(screen.getByText("Đang đăng nhập")).toBeInTheDocument();
  });

  it("keeps the left nav focused on the signed-in employee instead of app copy", () => {
    useAppStore.setState({ currentEmployee: admin, drawer: null });

    render(<LeftNav />);

    expect(screen.queryByText("POS Cafe")).not.toBeInTheDocument();
    expect(screen.queryByText("Ca làm việc")).not.toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();
  });
});
