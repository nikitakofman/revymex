import { createPortal } from "react-dom";
import { useBuilder } from "../builderState";

export const LineIndicator = () => {
  const { dragState } = useBuilder();

  const { show, x, y, width, height } = dragState.lineIndicator;
  if (!show) return null;

  const isVertical = parseFloat(String(height)) > parseFloat(String(width));

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed z-[9999] bg-blue-500"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width,
          height,
        }}
      />

      {isVertical ? (
        <>
          <div
            className="pointer-events-none fixed z-[9998] w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-40%, -40%)",
            }}
          />
          <div
            className="pointer-events-none fixed z-[9998] w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500"
            style={{
              left: `${x}px`,
              top: `${y + parseFloat(String(height))}px`,
              transform: "translate(-40%, -40%)",
            }}
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none fixed z-[9998] w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-40%, -40%)",
            }}
          />
          <div
            className="pointer-events-none fixed z-[9998] w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500"
            style={{
              left: `${x + parseFloat(String(width))}px`,
              top: `${y}px`,
              transform: "translate(-40%, -40%)",
            }}
          />
        </>
      )}
    </>,
    document.body
  );
};
