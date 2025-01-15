import React from "react";
import { useBuilder } from "@/builder/context/builderState";

const GuideLineComponent = ({ style }) => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Trigger fade in after mount
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 25); // Small delay to ensure transition works

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        ...style,
        opacity: isVisible ? 0.8 : 0,
        transition: "opacity 150ms ease-in-out",
      }}
    />
  );
};

export const SnapGuides = () => {
  const { dragState, containerRef, transform } = useBuilder();

  const rect = containerRef.current?.getBoundingClientRect();
  const containerWidth = rect ? rect.width : 3000;
  const containerHeight = rect ? rect.height : 3000;

  // Common style for both vertical & horizontal lines
  const guideStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "pink",
    pointerEvents: "none",
  };

  return (
    <>
      {dragState.snapGuides.map((guide, i) => {
        if (guide.orientation === "vertical") {
          const screenX = transform.x + guide.position * transform.scale;
          return (
            <GuideLineComponent
              key={`${guide.orientation}-${guide.position}-${i}`}
              style={{
                ...guideStyle,
                left: screenX,
                top: 0,
                width: 1,
                height: containerHeight,
              }}
            />
          );
        } else {
          const screenY = transform.y + guide.position * transform.scale;
          return (
            <GuideLineComponent
              key={`${guide.orientation}-${guide.position}-${i}`}
              style={{
                ...guideStyle,
                left: 0,
                top: screenY,
                width: containerWidth,
                height: 1,
              }}
            />
          );
        }
      })}
    </>
  );
};
