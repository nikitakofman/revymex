import React from "react";

type LineSeparatorProps = {
  color?: string;
  thickness?: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
  height?: string; // for vertical separator
  visible?: boolean;
};

const LineSeparator: React.FC<LineSeparatorProps> = ({
  color = "var(--border-light)",
  thickness = 1,
  className = "",
  orientation = "horizontal",
  height = "100%", // default height for vertical separator
  visible = true,
}) => {
  return (
    <div
      className={`${
        orientation === "horizontal" && `w-full ${visible && "border-t"}`
      }
        ${orientation === "vertical" && `h-full ${visible && "border-l"}`}
       ${className}`}
      style={{
        ...(orientation === "horizontal" && {
          borderTopColor: color,
          borderTopWidth: `${thickness}px`,
        }),
        ...(orientation === "vertical" && {
          borderLeftColor: color,
          borderLeftWidth: `${thickness}px`,
          height: height,
        }),
      }}
    />
  );
};

export default LineSeparator;
