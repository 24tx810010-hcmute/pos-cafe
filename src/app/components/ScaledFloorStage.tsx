import clsx from "clsx";
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { logicalStage } from "../floorStage";

type StageSize = {
  width: number;
  height: number;
};

type ScaledFloorStageContext = {
  scale: number;
};

interface ScaledFloorStageProps {
  children: ReactNode | ((context: ScaledFloorStageContext) => ReactNode);
  className?: string;
  contentClassName?: string;
  testId?: string;
  layerTestId?: string;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}

const setForwardedRef = (ref: Ref<HTMLDivElement>, value: HTMLDivElement | null) => {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    (ref as MutableRefObject<HTMLDivElement | null>).current = value;
  }
};

export const ScaledFloorStage = forwardRef<HTMLDivElement, ScaledFloorStageProps>(function ScaledFloorStage(
  {
    children,
    className,
    contentClassName,
    testId,
    layerTestId = "floor-stage-layer",
    onPointerDown,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });

  const setStageRef = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node;
      setForwardedRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const hasMeasuredSize = size.width > 0 && size.height > 0;
  const scale = hasMeasuredSize
    ? Math.min(1, size.width / logicalStage.width, size.height / logicalStage.height)
    : 1;
  const scaledWidth = logicalStage.width * scale;
  const scaledHeight = logicalStage.height * scale;

  const stageStyle: CSSProperties = {
    width: scaledWidth,
    height: scaledHeight,
  };
  const layerStyle: CSSProperties & Record<"--floor-stage-scale", number> = {
    "--floor-stage-scale": scale,
    width: logicalStage.width,
    height: logicalStage.height,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
  const renderedChildren = typeof children === "function" ? children({ scale }) : children;

  return (
    <div ref={containerRef} className={clsx("grid h-full min-h-0 w-full place-items-center overflow-hidden", className)}>
      <div
        ref={setStageRef}
        className="relative overflow-hidden"
        data-testid={testId}
        onPointerDown={onPointerDown}
        style={stageStyle}
      >
        <div
          className={clsx(
            "absolute left-0 top-0 touch-none overflow-hidden rounded-pos border border-pos-line bg-[#eef3f7] bg-[linear-gradient(90deg,rgb(215_222_232_/_42%)_1px,transparent_1px),linear-gradient(rgb(215_222_232_/_42%)_1px,transparent_1px),#eef3f7] bg-[length:60px_60px]",
            contentClassName,
          )}
          data-testid={layerTestId}
          style={layerStyle}
        >
          {renderedChildren}
        </div>
      </div>
    </div>
  );
});
