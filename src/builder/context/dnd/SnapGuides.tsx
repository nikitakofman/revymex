import React from "react";
import { useBuilder } from "@/builder/context/builderState";

const SnapGuides = () => {
  const { transform, dragState } = useBuilder();

  if (!dragState.isDragging || !dragState.snapGuides?.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {dragState.snapGuides.map((guide, i) => {
        const position =
          guide.orientation === "vertical"
            ? transform.x + guide.position * transform.scale
            : transform.y + guide.position * transform.scale;

        return (
          <div
            key={`${guide.orientation}-${guide.position}-${i}`}
            style={{
              position: "absolute",
              backgroundColor: "rgba(255, 105, 180, 0.8)",
              ...(guide.orientation === "vertical"
                ? {
                    left: `${position}px`,
                    top: 0,
                    width: "1px",
                    height: "100%",
                  }
                : {
                    left: 0,
                    top: `${position}px`,
                    width: "100%",
                    height: "1px",
                  }),
              transform: "translateZ(0)",
              willChange: "transform",
            }}
          />
        );
      })}
    </div>
  );
};

export default SnapGuides;
