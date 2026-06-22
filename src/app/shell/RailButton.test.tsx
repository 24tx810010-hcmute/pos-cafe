import { render, screen } from "@testing-library/react";
import { LayoutDashboard } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RailButton } from "./RailButton";

describe("RailButton", () => {
  it("renders as a readable desktop nav row that collapses labels on compact screens", () => {
    render(<RailButton active icon={<LayoutDashboard size={18} />} label="Bàn" onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Bàn" });
    expect(button).toHaveClass("flex", "min-h-11", "items-center", "justify-start", "gap-3");
    expect(button).toHaveClass("bg-pos-primary", "text-white");
    expect(button).not.toHaveClass("bg-transparent");
    expect(screen.getByText("Bàn")).toHaveClass("max-[980px]:sr-only");
  });

  it("does not show enabled desktop nav items through a tooltip wrapper", () => {
    render(<RailButton active={false} icon={<LayoutDashboard size={18} />} label="Mang đi" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Mang đi" }).parentElement).not.toHaveClass("contents");
  });
});
