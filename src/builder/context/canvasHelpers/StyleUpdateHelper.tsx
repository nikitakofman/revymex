import React from "react";
import { createPortal } from "react-dom";
import { useStyleHelper } from "@/builder/context/atoms/visual-store";

export const StyleUpdateHelper = () => {
  const styleHelper = useStyleHelper();

  if (!styleHelper.show) return null;

  const helperPosition = {
    x: styleHelper.position.x + 40,
    y: styleHelper.position.y + 40,
  };

  // Helper function to format the font size display
  const formatFontSize = () => {
    if (styleHelper.isMixed) {
      return "Mixed";
    }

    // Format with appropriate precision based on unit
    if (styleHelper.unit === "vw") {
      // For vw units, show 2 decimal places
      return `${
        typeof styleHelper.value === "number"
          ? styleHelper.value.toFixed(2)
          : styleHelper.value
      }${styleHelper.unit}`;
    } else {
      // For px or other units, round to integer
      return `${Math.round(styleHelper.value ?? 0)}${styleHelper.unit}`;
    }
  };

  return createPortal(
    <div
      className={`fixed ${
        styleHelper.type === "gap" ? "bg-pink-400" : "bg-[var(--accent)]"
      } rounded-lg shadow-lg p-1.5 font-semibold text-sm pointer-events-none text-white`}
      style={{
        left: helperPosition.x,
        top: helperPosition.y,
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
      }}
    >
      {styleHelper.type === "gap" || styleHelper.type === "radius" ? (
        <div className="flex items-center gap-2">
          <span>{Math.round(styleHelper.value ?? 0)}px</span>
        </div>
      ) : styleHelper.type === "dimensions" && styleHelper.dimensions ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>
              {Math.round(styleHelper.dimensions.width)}
              {styleHelper.dimensions.widthUnit || styleHelper.dimensions.unit}
            </span>
            <span>×</span>
            <span>
              {Math.round(styleHelper.dimensions.height)}
              {styleHelper.dimensions.heightUnit || styleHelper.dimensions.unit}
            </span>
          </div>
        </div>
      ) : styleHelper.type === "rotate" ? (
        <div className="flex items-center gap-2">
          <span>{Math.round(styleHelper.value ?? 0)}°</span>
        </div>
      ) : styleHelper.type === "fontSize" ? (
        <div className="flex items-center gap-2">
          <span>{formatFontSize()}</span>
        </div>
      ) : null}
    </div>,
    document.body
  );
};
