import { useRef, useEffect, useState } from "react";

const DragDebugVisualizer = () => {
  const [zones, setZones] = useState([]);
  const [isColumn, setIsColumn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Debug function to calculate zones
  const calculateZones = () => {
    if (!containerRef.current) return [];

    const parentEl = containerRef.current;
    const parentStyle = window.getComputedStyle(parentEl);
    const isColumnLayout = parentStyle.flexDirection.includes("column");
    setIsColumn(isColumnLayout);

    // Get all direct children except placeholders
    const children = Array.from(parentEl.children).filter(
      (child) => !child.getAttribute("data-node-id")?.includes("placeholder")
    );

    const newZones = children.map((child) => {
      const rect = child.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();

      // Calculate relative position to container
      const relativeRect = {
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right - parentRect.left,
        bottom: rect.bottom - parentRect.top,
      };

      // Calculate midpoint
      const midpoint = isColumnLayout
        ? relativeRect.top + relativeRect.height / 2
        : relativeRect.left + relativeRect.width / 2;

      return {
        id:
          child.getAttribute("data-node-id") ||
          `child-${Math.random().toString(36).substr(2, 9)}`,
        rect: relativeRect,
        midpoint,
      };
    });

    // Sort by position
    return newZones.sort((a, b) =>
      isColumnLayout ? a.rect.top - b.rect.top : a.rect.left - b.rect.left
    );
  };

  // Mouse event handlers
  useEffect(() => {
    const handleMouseDown = (e) => {
      // Start dragging only on left click on a non-placeholder
      if (
        e.button === 0 &&
        !e.target.getAttribute("data-node-id")?.includes("placeholder")
      ) {
        setIsDragging(true);
        setZones(calculateZones());
      }
    };

    const handleMouseMove = (e) => {
      if (isDragging) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Draw only when dragging
  if (!isDragging) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Container reference element */}
      <div ref={containerRef} className="absolute inset-0 opacity-0" />

      {/* Zone visualization */}
      {zones.map((zone, index) => {
        const nextZone = index < zones.length - 1 ? zones[index + 1] : null;

        return (
          <div key={zone.id}>
            {/* The element's bounding box */}
            <div
              className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20"
              style={{
                top: `${zone.rect.top}px`,
                left: `${zone.rect.left}px`,
                width: `${zone.rect.width}px`,
                height: `${zone.rect.height}px`,
              }}
            >
              <div className="text-xs text-blue-800 bg-white bg-opacity-70 p-1">
                {zone.id}
              </div>
            </div>

            {/* The midpoint line */}
            {isColumn ? (
              <div
                className="absolute left-0 right-0 border-t-2 border-red-500 border-dashed z-10"
                style={{
                  top: `${zone.midpoint}px`,
                }}
              >
                <div className="absolute right-0 -mt-4 text-xs text-red-800 bg-white p-1">
                  {index === 0 ? "Before" : ""} Midpoint {zone.id}
                </div>
              </div>
            ) : (
              <div
                className="absolute top-0 bottom-0 border-l-2 border-red-500 border-dashed z-10"
                style={{
                  left: `${zone.midpoint}px`,
                }}
              >
                <div className="absolute top-0 -ml-16 text-xs text-red-800 bg-white p-1">
                  {index === 0 ? "Before" : ""} Midpoint {zone.id}
                </div>
              </div>
            )}

            {/* The "before" zone */}
            {index === 0 &&
              (isColumn ? (
                <div
                  className="absolute left-0 right-0 bg-green-200 bg-opacity-20 border-green-500 border-t-2 border-b-2 border-dashed"
                  style={{
                    top: 0,
                    height: `${zone.midpoint}px`,
                  }}
                >
                  <div className="text-xs text-green-800 bg-white p-1">
                    Before first element
                  </div>
                </div>
              ) : (
                <div
                  className="absolute top-0 bottom-0 bg-green-200 bg-opacity-20 border-green-500 border-l-2 border-r-2 border-dashed"
                  style={{
                    left: 0,
                    width: `${zone.midpoint}px`,
                  }}
                >
                  <div className="text-xs text-green-800 bg-white p-1">
                    Before first element
                  </div>
                </div>
              ))}

            {/* The between zone */}
            {nextZone &&
              (isColumn ? (
                <div
                  className="absolute left-0 right-0 bg-purple-200 bg-opacity-20"
                  style={{
                    top: `${zone.midpoint}px`,
                    height: `${nextZone.midpoint - zone.midpoint}px`,
                  }}
                >
                  <div className="text-xs text-purple-800 bg-white p-1">
                    After {zone.id}, Before {nextZone.id}
                  </div>
                </div>
              ) : (
                <div
                  className="absolute top-0 bottom-0 bg-purple-200 bg-opacity-20"
                  style={{
                    left: `${zone.midpoint}px`,
                    width: `${nextZone.midpoint - zone.midpoint}px`,
                  }}
                >
                  <div className="text-xs text-purple-800 bg-white p-1">
                    After {zone.id}, Before {nextZone.id}
                  </div>
                </div>
              ))}

            {/* The "after last" zone */}
            {index === zones.length - 1 &&
              (isColumn ? (
                <div
                  className="absolute left-0 right-0 bg-yellow-200 bg-opacity-20 border-yellow-500 border-t-2 border-b-2 border-dashed"
                  style={{
                    top: `${zone.midpoint}px`,
                    bottom: 0,
                  }}
                >
                  <div className="text-xs text-yellow-800 bg-white p-1">
                    After last element
                  </div>
                </div>
              ) : (
                <div
                  className="absolute top-0 bottom-0 bg-yellow-200 bg-opacity-20 border-yellow-500 border-l-2 border-r-2 border-dashed"
                  style={{
                    left: `${zone.midpoint}px`,
                    right: 0,
                  }}
                >
                  <div className="text-xs text-yellow-800 bg-white p-1">
                    After last element
                  </div>
                </div>
              ))}
          </div>
        );
      })}

      {/* Mouse cursor position indicator */}
      <div
        className="absolute w-6 h-6 rounded-full border-2 border-black bg-white bg-opacity-50 -ml-3 -mt-3"
        style={{
          left: `${mousePos.x}px`,
          top: `${mousePos.y}px`,
        }}
      />

      {/* Vertical line from mouse */}
      {!isColumn && (
        <div
          className="absolute top-0 bottom-0 border-l border-black opacity-50"
          style={{
            left: `${mousePos.x}px`,
          }}
        />
      )}

      {/* Horizontal line from mouse */}
      {isColumn && (
        <div
          className="absolute left-0 right-0 border-t border-black opacity-50"
          style={{
            top: `${mousePos.y}px`,
          }}
        />
      )}

      {/* Debug info */}
      <div className="absolute bottom-4 right-4 bg-white p-4 border shadow-lg text-sm">
        <div>Layout: {isColumn ? "Column" : "Row"}</div>
        <div>
          Mouse: X={mousePos.x}, Y={mousePos.y}
        </div>
        <div>Zones: {zones.length}</div>
        <div>
          <button
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded pointer-events-auto"
            onClick={() => setIsDragging(false)}
          >
            Hide Debug View
          </button>
        </div>
      </div>
    </div>
  );
};

export default DragDebugVisualizer;
