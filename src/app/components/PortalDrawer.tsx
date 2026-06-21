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

const workspaceOverlayClass = "fixed inset-y-0 right-0 left-[100px] max-[980px]:left-[52px]";
const screenOverlayClass = "fixed inset-0";

const defaultPanelClass =
  "absolute grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0";

const placementClass: Record<DrawerPlacement, string> = {
  Right: "inset-y-3 right-3 max-[980px]:inset-y-0 max-[980px]:right-0",
  Left: "inset-y-3 left-3 max-[980px]:inset-y-0 max-[980px]:left-0",
  Top: "inset-x-3 top-3 h-[min(88vh,720px)] w-auto max-w-none max-[980px]:inset-x-0 max-[980px]:top-0",
  Bottom: "inset-x-3 bottom-3 h-[min(88vh,720px)] w-auto max-w-none max-[980px]:inset-x-0 max-[980px]:bottom-0",
};

export function PortalDrawer({
  children,
  placement = "Right",
  overlayColor = "transparent",
  onOutsideClick,
  zIndex = 10,
  containerId = "portals",
  testId,
  viewport = "workspace",
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
        className={clsx(defaultPanelClass, placementClass[placement], panelClassName)}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    root,
  );
}
