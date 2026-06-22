import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalPopup } from "./PortalPopup";

afterEach(() => {
  cleanup();
  document.getElementById("portals")?.remove();
});

describe("PortalPopup", () => {
  it("renders popup content into the portals root", () => {
    render(
      <PortalPopup testId="confirm-popup">
        <div>Confirm body</div>
      </PortalPopup>,
    );

    const root = document.getElementById("portals");
    expect(root).toBeInTheDocument();
    expect(root).toContainElement(screen.getByTestId("confirm-popup"));
    expect(screen.getByText("Confirm body")).toBeInTheDocument();
  });

  it("only calls outside click when the overlay is clicked", () => {
    const onOutsideClick = vi.fn();
    render(
      <PortalPopup testId="confirm-popup" onOutsideClick={onOutsideClick}>
        <button type="button">Stay inside</button>
      </PortalPopup>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stay inside" }));
    expect(onOutsideClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("confirm-popup"));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("can render within the workspace viewport", () => {
    render(
      <PortalPopup testId="confirm-popup" viewport="workspace">
        <div>Confirm body</div>
      </PortalPopup>,
    );

    const overlay = screen.getByTestId("confirm-popup");
    expect(overlay.className).toContain("left-[176px]");
    expect(overlay.className).toContain("max-[980px]:left-[68px]");
  });
});
