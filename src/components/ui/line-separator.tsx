import React from "react";

type LineSeparatorProps = {
  color?: string;
  thickness?: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
  height?: string; // for vertical separator
};

const LineSeparator: React.FC<LineSeparatorProps> = ({
  color = "var(--border-default)",
  thickness = 1,
  className = "",
  orientation = "horizontal",
  height = "100%", // default height for vertical separator
}) => {
  return (
    <div
      className={`${orientation === "horizontal" && "w-full border-t"}
        ${orientation === "vertical" && "h-full border-l"}
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
