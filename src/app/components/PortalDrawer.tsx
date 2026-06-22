import clsx from "clsx";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

type DrawerPlacement = "Left" | "Right" | "Top" | "Bottom";
type DrawerViewport = "workspace" | "screen";

type PortalDrawerProps = {
  children: ReactNode;
  placement?: DrawerPlacement;
  overlayColor?: string;
  onOutsideClick?: () => void;
  zIndex?: number;
  containerId?: string;
  testId?: string;
  viewport?: DrawerViewport;
  panelClassName?: string;
};

const getPortalRoot = (containerId: string): HTMLElement => {
  let root = document.getElementById(containerId);
  if (!root) {
    root = document.createElement("div");
    root.id = containerId;
    document.body.appendChild(root);
  }
  return root;
};

const workspaceOverlayClass = "fixed inset-y-0 right-0 left-[176px] max-[980px]:left-[68px]";
const screenOverlayClass = "fixed inset-0";

const defaultPanelClass =
  "absolute grid w-full max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none border border-pos-line border-y-0 bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)]";

const placementClass: Record<DrawerPlacement, string> = {
  Right: "inset-0",
  Left: "inset-0",
  Top: "inset-0",
  Bottom: "inset-0",
};

const slideAnimationClass: Record<DrawerPlacement, string> = {
  Right: "animate-[portal-drawer-slide-in-right_180ms_ease-out]",
  Left: "animate-[portal-drawer-slide-in-left_180ms_ease-out]",
  Top: "animate-[portal-drawer-slide-in-top_180ms_ease-out]",
  Bottom: "animate-[portal-drawer-slide-in-bottom_180ms_ease-out]",
};

export function PortalDrawer({
  children,
  placement = "Right",
  overlayColor = "rgba(0, 0, 0, 0.2)",
  onOutsideClick,
  zIndex = 10,
  containerId = "portals",
  testId,
  viewport = "screen",
  panelClassName,
}: PortalDrawerProps) {
  const root = getPortalRoot(containerId);
  const overlayStyle: CSSProperties = { backgroundColor: overlayColor, zIndex };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onOutsideClick?.();
    }
    event.stopPropagation();
  };

  return createPortal(
    <div
      className={clsx(viewport === "workspace" ? workspaceOverlayClass : screenOverlayClass)}
      style={overlayStyle}
      onClick={handleOverlayClick}
    >
      <section
        className={clsx(
          defaultPanelClass,
          placementClass[placement],
          slideAnimationClass[placement],
          "motion-reduce:animate-none",
          panelClassName,
        )}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    root,
  );
}
