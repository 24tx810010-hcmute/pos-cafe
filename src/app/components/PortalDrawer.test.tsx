import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalDrawer } from "./PortalDrawer";

afterEach(() => {
  cleanup();
  document.getElementById("portals")?.remove();
});

describe("PortalDrawer", () => {
  it("renders a workspace drawer panel into the portals root", () => {
    render(
      <PortalDrawer testId="kitchen-drawer">
        <div>Drawer body</div>
      </PortalDrawer>,
    );

    const root = document.getElementById("portals");
    const panel = screen.getByTestId("kitchen-drawer");
    const overlay = panel.parentElement;

    expect(root).toBeInTheDocument();
    expect(root).toContainElement(panel);
    expect(panel).toHaveTextContent("Drawer body");
    expect(overlay?.className).toContain("left-[176px]");
    expect(overlay?.className).toContain("max-[980px]:left-[68px]");
  });

  it("uses a visible dim overlay by default", () => {
    render(
      <PortalDrawer testId="kitchen-drawer">
        <div>Drawer body</div>
      </PortalDrawer>,
    );

    const overlay = screen.getByTestId("kitchen-drawer").parentElement;
    expect(overlay).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0.2)" });
  });

  it("animates the default right drawer into view", () => {
    render(
      <PortalDrawer testId="kitchen-drawer">
        <div>Drawer body</div>
      </PortalDrawer>,
    );

    expect(screen.getByTestId("kitchen-drawer").className).toContain(
      "animate-[portal-drawer-slide-in-right_180ms_ease-out]",
    );
  });

  it("uses a placement-specific slide animation", () => {
    render(
      <PortalDrawer testId="kitchen-drawer" placement="Left">
        <div>Drawer body</div>
      </PortalDrawer>,
    );

    expect(screen.getByTestId("kitchen-drawer").className).toContain(
      "animate-[portal-drawer-slide-in-left_180ms_ease-out]",
    );
  });

  it("only calls outside click when the overlay is clicked", () => {
    const onOutsideClick = vi.fn();
    render(
      <PortalDrawer testId="kitchen-drawer" onOutsideClick={onOutsideClick}>
        <button type="button">Drawer action</button>
      </PortalDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Drawer action" }));
    expect(onOutsideClick).not.toHaveBeenCalled();

    const overlay = screen.getByTestId("kitchen-drawer").parentElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });
});
