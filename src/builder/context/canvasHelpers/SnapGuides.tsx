// SnapGuides.tsx

import React from "react";
import { useBuilder } from "@/builder/context/builderState";
import { SnapLine } from "@/builder/context/canvasHelpers/SnapGrid";
import { useSnapGuides } from "@/builder/context/atoms/visual-store";
import { useIsDragging } from "../atoms/drag-store";

const SnapGuides: React.FC = () => {
  const { transform, dragState } = useBuilder();
  const snapGuides = useSnapGuides();

  const isDragging = useIsDragging();

  if (!isDragging || !snapGuides?.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {snapGuides.map((guide: SnapLine, i: number) => {
        // 1) Spacing line with arrowheads
        if (guide.spacing) {
          // horizontal arrow
          if (
            guide.orientation === "horizontal" &&
            guide.x1 != null &&
            guide.x2 != null &&
            guide.y != null
          ) {
            const screenX1 = transform.x + guide.x1 * transform.scale;
            const screenX2 = transform.x + guide.x2 * transform.scale;
            const screenY = transform.y + guide.y * transform.scale;
            const left = Math.min(screenX1, screenX2);
            const right = Math.max(screenX1, screenX2);
            const width = right - left;

            return (
              <React.Fragment key={i}>
                {/* dashed line */}
                <div
                  style={{
                    position: "absolute",
                    left: left,
                    top: screenY,
                    width: width,
                    height: "0px",
                    borderTop: "1px dashed rgba(255,0,0,0.8)",
                  }}
                />
                {/* arrowhead on the left side */}
                <div
                  style={{
                    position: "absolute",
                    left: left - 6, // a bit to the left
                    top: screenY - 5,
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "6px solid rgba(255,0,0,0.8)",
                  }}
                />
                {/* arrowhead on the right side */}
                <div
                  style={{
                    position: "absolute",
                    left: right,
                    top: screenY - 5,
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderLeft: "6px solid rgba(255,0,0,0.8)",
                  }}
                />
                {/* label in the middle */}
                <div
                  style={{
                    position: "absolute",
                    left: left + width / 2,
                    top: screenY - 20,
                    transform: "translateX(-50%)",
                    background: "#fff",
                    color: "#f00",
                    fontSize: 10,
                    padding: "2px 4px",
                    borderRadius: 4,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                >
                  {guide.spacing}px
                </div>
              </React.Fragment>
            );
          }
          // vertical arrow
          else if (
            guide.orientation === "vertical" &&
            guide.y1 != null &&
            guide.y2 != null &&
            guide.x != null
          ) {
            const screenX = transform.x + guide.x * transform.scale;
            const screenY1 = transform.y + guide.y1 * transform.scale;
            const screenY2 = transform.y + guide.y2 * transform.scale;
            const top = Math.min(screenY1, screenY2);
            const bottom = Math.max(screenY1, screenY2);
            const height = bottom - top;

            return (
              <React.Fragment key={i}>
                {/* dashed line */}
                <div
                  style={{
                    position: "absolute",
                    left: screenX,
                    top: top,
                    width: "0px",
                    height: height,
                    borderLeft: "1px dashed rgba(255,0,0,0.8)",
                  }}
                />
                {/* arrowhead at the top */}
                <div
                  style={{
                    position: "absolute",
                    left: screenX - 5,
                    top: top - 6,
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderBottom: "6px solid rgba(255,0,0,0.8)",
                  }}
                />
                {/* arrowhead at the bottom */}
                <div
                  style={{
                    position: "absolute",
                    left: screenX - 5,
                    top: bottom,
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "6px solid rgba(255,0,0,0.8)",
                  }}
                />
                {/* label in the middle */}
                <div
                  style={{
                    position: "absolute",
                    left: screenX - 30, // place label to the left
                    top: top + height / 2,
                    transform: "translateY(-50%)",
                    background: "#fff",
                    color: "#f00",
                    fontSize: 10,
                    padding: "2px 4px",
                    borderRadius: 4,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                >
                  {guide.spacing}px
                </div>
              </React.Fragment>
            );
          }
          return null;
        }
        // 2) normal alignment line
        else if (guide.position != null) {
          const screenPos =
            guide.orientation === "vertical"
              ? transform.x + guide.position * transform.scale
              : transform.y + guide.position * transform.scale;

          return guide.orientation === "vertical" ? (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenPos,
                top: 0,
                width: "1px",
                height: "100%",
                backgroundColor: "rgba(255, 105, 180, 0.8)",
              }}
            />
          ) : (
            <div
              key={i}
              style={{
                position: "absolute",
                top: screenPos,
                left: 0,
                height: "1px",
                width: "100%",
                backgroundColor: "rgba(255,105,180,0.8)",
              }}
            />
          );
        }

        // fallback
        return null;
      })}
    </div>
  );
};

export default SnapGuides;
