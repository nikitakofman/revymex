import { createPortal } from "react-dom";
import { useLineIndicator } from "../atoms/visual-store";
import { useLineIndicatorController } from "./useLineIndicatorController";

export const LineIndicator = () => {
  useLineIndicatorController();

  const { show, x, y, width, height } = useLineIndicator();

  if (!show) return null;

  const isVertical = height > width;

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed z-[9999] bg-blue-500"
        style={{ left: x, top: y, width, height }}
      />
      {/* two little end‑caps so it's visible on white backgrounds */}
      {isVertical ? (
        <>
          <Dot x={x} y={y} />
          <Dot x={x} y={y + height} />
        </>
      ) : (
        <>
          <Dot x={x} y={y} />
          <Dot x={x + width} y={y} />
        </>
      )}
    </>,
    document.body
  );
};

const Dot = ({ x, y }: { x: number; y: number }) => (
  <div
    className="pointer-events-none fixed z-[9998] w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500"
    style={{ left: x, top: y, transform: "translate(-40%, -40%)" }}
  />
);
