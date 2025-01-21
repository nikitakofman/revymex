import React from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";

export const StyleUpdateHelper = () => {
  const { dragState } = useBuilder();
  const { styleHelper } = dragState;

  // If helper is not meant to be shown, return null
  if (!styleHelper.show) return null;

  // Get the offset position for the helper
  const helperPosition = {
    x: styleHelper.position.x + 40,
    y: styleHelper.position.y + 40,
  };

  return createPortal(
    <div
      className={`fixed ${
        styleHelper.type === "gap" ? "bg-pink-400" : "bg-blue-500"
      } rounded-lg shadow-lg p-1.5 font-semibold text-sm pointer-events-none text-white`}
      style={{
        left: helperPosition.x,
        top: helperPosition.y,
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
      }}
    >
      {styleHelper.type === "gap" ? (
        // Gap value display
        <div className="flex items-center gap-2">
          <span>{Math.round(styleHelper.value ?? 0)}px</span>
        </div>
      ) : styleHelper.type === "dimensions" && styleHelper.dimensions ? (
        // Dimensions display
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>{Math.round(styleHelper.dimensions.width)}px</span>
            <span>×</span>
            <span>{Math.round(styleHelper.dimensions.height)}px</span>
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
};
