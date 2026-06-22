import clsx from "clsx";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type PopupPlacement =
  | "Centered"
  | "Top left"
  | "Top center"
  | "Top right"
  | "Bottom left"
  | "Bottom center"
  | "Bottom right";

type PopupViewport = "workspace" | "screen";

type PortalPopupProps = {
  children: ReactNode;
  placement?: PopupPlacement;
  overlayColor?: string;
  onOutsideClick?: () => void;
  zIndex?: number;
  containerId?: string;
  testId?: string;
  overlayClassName?: string;
  contentClassName?: string;
  viewport?: PopupViewport;
  relativeLayerRef?: RefObject<HTMLElement>;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
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

export function PortalPopup({
  children,
  placement = "Centered",
  overlayColor,
  onOutsideClick,
  zIndex = 20,
  containerId = "portals",
  testId,
  overlayClassName,
  contentClassName,
  viewport = "screen",
  relativeLayerRef,
  left = 0,
  right = 0,
  top = 0,
  bottom = 0,
}: PortalPopupProps) {
  const root = getPortalRoot(containerId);
  const contentRef = useRef<HTMLDivElement>(null);
  const [relativeStyle, setRelativeStyle] = useState<CSSProperties>({ opacity: 0 });

  const overlayStyle = useMemo<CSSProperties>(() => {
    const style: CSSProperties = { zIndex };
    if (overlayColor) {
      style.backgroundColor = overlayColor;
    }

    if (!relativeLayerRef?.current) {
      switch (placement) {
        case "Centered":
          style.alignItems = "center";
          style.justifyContent = "center";
          break;
        case "Top left":
          style.alignItems = "flex-start";
          break;
        case "Top center":
          style.alignItems = "center";
          break;
        case "Top right":
          style.alignItems = "flex-end";
          break;
        case "Bottom left":
          style.alignItems = "flex-start";
          style.justifyContent = "flex-end";
          break;
        case "Bottom center":
          style.alignItems = "center";
          style.justifyContent = "flex-end";
          break;
        case "Bottom right":
          style.alignItems = "flex-end";
          style.justifyContent = "flex-end";
          break;
      }
    }

    return style;
  }, [overlayColor, placement, relativeLayerRef, zIndex]);

  const setPosition = useCallback(() => {
    const relativeItem = relativeLayerRef?.current?.getBoundingClientRect();
    const contentItem = contentRef.current?.getBoundingClientRect();
    const style: CSSProperties = { opacity: 1 };

    if (relativeItem && contentItem) {
      style.position = "absolute";
      switch (placement) {
        case "Top left":
          style.top = relativeItem.y - contentItem.height - top;
          style.left = relativeItem.x + left;
          break;
        case "Top right":
          style.top = relativeItem.y - contentItem.height - top;
          style.left = relativeItem.x + relativeItem.width - contentItem.width - right;
          break;
        case "Bottom left":
          style.top = relativeItem.y + relativeItem.height + bottom;
          style.left = relativeItem.x + left;
          break;
        case "Bottom right":
          style.top = relativeItem.y + relativeItem.height + bottom;
          style.left = relativeItem.x + relativeItem.width - contentItem.width - right;
          break;
        default:
          break;
      }
    } else {
      style.maxWidth = "90%";
      style.maxHeight = "90%";
    }

    setRelativeStyle(style);
  }, [bottom, left, placement, relativeLayerRef, right, top]);

  useEffect(() => {
    setPosition();
    window.addEventListener("resize", setPosition);
    window.addEventListener("scroll", setPosition, true);

    return () => {
      window.removeEventListener("resize", setPosition);
      window.removeEventListener("scroll", setPosition, true);
    };
  }, [setPosition]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onOutsideClick?.();
    }
    event.stopPropagation();
  };

  return createPortal(
    <div
      className={clsx(viewport === "workspace" ? workspaceOverlayClass : screenOverlayClass, "flex flex-col", overlayClassName)}
      data-testid={testId}
      style={overlayStyle}
      onClick={handleOverlayClick}
    >
      <div ref={contentRef} className={contentClassName} style={relativeStyle}>
        {children}
      </div>
    </div>,
    root,
  );
}
