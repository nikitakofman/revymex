import React, {
  useLayoutEffect,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  applyMatrixToPoint,
  Direction,
  getFullTransformMatrix,
  getHandleCursor,
  matrixToCss,
} from "../utils";
import { useBuilder } from "../builderState";
import { useGetSelectedIds } from "../atoms/select-store";
import {
  useGetTransform,
  useTransform,
} from "../atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "../atoms/dynamic-store";

interface GroupBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ResizeHandlesProps {
  node: Node;
  handleResizeStart: (
    e: React.PointerEvent,
    direction: Direction,
    isDirectBorderResize?: boolean
  ) => void;
  groupBounds?: GroupBounds | null;
  isGroupSelection?: boolean;
  /**
   * A ref to the actual DOM element that may have skew/getTransform().scale transforms.
   */
  targetRef?: React.RefObject<HTMLElement>;
  /**
   * Cumulative skew values from parent elements
   */
  cumulativeSkew?: { skewX: number; skewY: number };
}

// For storing coordinates of corners
interface CornerPositions {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  // Edge midpoints
  top: { x: number; y: number };
  right: { x: number; y: number };
  bottom: { x: number; y: number };
  left: { x: number; y: number };
}

/* -------------------------------------------
   RESIZE HANDLES COMPONENT
--------------------------------------------*/
export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  node,
  handleResizeStart,
  groupBounds,
  isGroupSelection,
  targetRef,
}) => {
  const { nodeState } = useBuilder();

  const getTransform = useGetTransform();

  const [isInteractive, setIsInteractive] = useState(false);

  console.log(`Resize Handles re-rendering ${node.id}`, new Date().getTime());

  // Use the imperative getter function instead of subscription
  const getSelectedIds = useGetSelectedIds();
  const dynamicModeNodeId = useDynamicModeNodeId();

  // Add useEffect to delay handle interactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 200); // 200ms delay before making handles interactive

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Determine if width/height are set to auto
  const isWidthAuto = node.style.width === "auto";
  const isHeightAuto = node.style.height === "auto";

  const [cornerPositions, setCornerPositions] =
    useState<CornerPositions | null>(null);
  const [, setElementSize] = useState({ width: 0, height: 0 });
  const [, setFullMatrix] = useState<number[] | null>(null);
  const [matrixCss, setMatrixCss] = useState<string | null>(null);

  // Function to check if this node is the primary selected node
  // This is called during render but doesn't create a subscription
  const isPrimarySelectedNode = useCallback(() => {
    if (!isGroupSelection) return true;
    const selectedIds = getSelectedIds();
    return selectedIds.length > 0 && node.id === selectedIds[0];
  }, [isGroupSelection, node.id, getSelectedIds]);

  // Group selection: only render for the first selected node.
  useLayoutEffect(() => {
    if (isGroupSelection || !targetRef?.current) {
      setCornerPositions(null);
      return;
    }

    const el = targetRef.current;
    const style = window.getComputedStyle(el);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);

    if (width === 0 || height === 0 || isNaN(width) || isNaN(height)) {
      return; // Skip if dimensions are invalid
    }

    setElementSize({ width, height });

    // Get the full transform matrix for the entire node chain
    const matrix = getFullTransformMatrix(node, nodeState, width, height);
    setFullMatrix(matrix);
    setMatrixCss(matrixToCss(matrix));

    // Calculate corner positions using the matrix transform
    const topLeft = applyMatrixToPoint(matrix, 0, 0);
    const topRight = applyMatrixToPoint(matrix, width, 0);
    const bottomRight = applyMatrixToPoint(matrix, width, height);
    const bottomLeft = applyMatrixToPoint(matrix, 0, height);

    // Calculate mid-edge positions
    const top = {
      x: (topLeft.x + topRight.x) / 2,
      y: (topLeft.y + topRight.y) / 2,
    };
    const right = {
      x: (topRight.x + bottomRight.x) / 2,
      y: (topRight.y + bottomRight.y) / 2,
    };
    const bottom = {
      x: (bottomLeft.x + bottomRight.x) / 2,
      y: (bottomLeft.y + bottomRight.y) / 2,
    };
    const left = {
      x: (topLeft.x + bottomLeft.x) / 2,
      y: (topLeft.y + bottomLeft.y) / 2,
    };

    // Normalize positions relative to element size
    // This is critical for proper positioning regardless of nesting level
    const normalizeCoords = (coords: { x: number; y: number }) => ({
      x: coords.x / width,
      y: coords.y / height,
    });

    setCornerPositions({
      topLeft: normalizeCoords(topLeft),
      topRight: normalizeCoords(topRight),
      bottomRight: normalizeCoords(bottomRight),
      bottomLeft: normalizeCoords(bottomLeft),
      top: normalizeCoords(top),
      right: normalizeCoords(right),
      bottom: normalizeCoords(bottom),
      left: normalizeCoords(left),
    });
  }, [
    targetRef,
    isGroupSelection,
    getTransform,
    node,
    nodeState,
    // Including these dependencies ensures we recalculate when any transform changes
    node.style.transform,
  ]);

  // Early return conditions using the isPrimarySelectedNode function
  if (isGroupSelection && !groupBounds) return null;
  if (isGroupSelection && !isPrimarySelectedNode()) return null;

  const handleBorderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handlePointerDown = (e: React.PointerEvent, direction: Direction) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    const isDirectBorderResize = ["top", "right", "bottom", "left"].includes(
      direction
    );
    handleResizeStart(e, direction, isDirectBorderResize);
  };

  // ────────────────────────────────
  // GROUP SELECTION RENDERING (unchanged)
  // ────────────────────────────────
  if (isGroupSelection && groupBounds) {
    const scale = getTransform().scale;

    const getGroupBorderStyles = (
      direction: Direction
    ): React.CSSProperties => {
      const borderSize = 4 / scale;
      const baseStyles: React.CSSProperties = {
        position: "absolute",
        transformOrigin: "center",
        pointerEvents: "all",
      };
      switch (direction) {
        case "top":
          return {
            ...baseStyles,
            top: 0,
            left: 0,
            right: 0,
            height: borderSize,
            transform: "translateY(-50%)",
          };
        case "right":
          return {
            ...baseStyles,
            top: 0,
            right: 0,
            bottom: 0,
            width: borderSize,
            transform: "translateX(50%)",
          };
        case "bottom":
          return {
            ...baseStyles,
            bottom: 0,
            left: 0,
            right: 0,
            height: borderSize,
            transform: "translateY(50%)",
          };
        case "left":
          return {
            ...baseStyles,
            top: 0,
            left: 0,
            bottom: 0,
            width: borderSize,
            transform: "translateX(-50%)",
          };
        default:
          return baseStyles;
      }
    };

    return (
      <>
        {["topRight", "bottomRight", "bottomLeft", "topLeft"].map(
          (direction) => (
            <div
              key={direction}
              data-resize-handle="true"
              className={`absolute bg-white rounded-full`}
              style={{
                position: "absolute",
                [direction.includes("Left") ? "left" : "right"]: 0,
                [direction.includes("top") ? "top" : "bottom"]: 0,
                cursor: getHandleCursor(direction as Direction),
                zIndex: 8000,
                width: `${8 / scale}px`,
                height: `${8 / scale}px`,
                transform: `translate(${
                  direction.includes("Right") ? "50%" : "-50%"
                }, ${direction.includes("bottom") ? "50%" : "-50%"})`,
                border: `${1 / scale}px solid var(--accent)`,
                pointerEvents: "all",
              }}
              onClick={handleBorderClick}
              onMouseDown={handleBorderClick}
              onPointerDown={(e) =>
                handlePointerDown(e, direction as Direction)
              }
            />
          )
        )}
        {["top", "right", "bottom", "left"].map((direction) => (
          <div
            key={direction}
            data-resize-handle="true"
            data-direct-resize="true"
            className="bg-transparent"
            style={{
              ...getGroupBorderStyles(direction as Direction),
              cursor: getHandleCursor(direction as Direction),
              zIndex: 999,
            }}
            onClick={handleBorderClick}
            onMouseDown={handleBorderClick}
            onPointerDown={(e) => handlePointerDown(e, direction as Direction)}
          />
        ))}
      </>
    );
  }

  // ────────────────────────────────
  // SINGLE-ELEMENT RENDER (using matrix-based positioning)
  // ────────────────────────────────

  const getFallbackCornerStyle = (
    direction: Direction
  ): React.CSSProperties => ({
    position: "absolute",
    [direction.includes("Left") ? "left" : "right"]: 0,
    [direction.includes("top") ? "top" : "bottom"]: 0,
    transform: `translate(${direction.includes("Right") ? "50%" : "-50%"}, ${
      direction.includes("bottom") ? "50%" : "-50%"
    })`,
  });

  const handleSize = 8 / getTransform().scale;

  return (
    <>
      {/* Corner Handles for single element */}
      {!isWidthAuto && !isHeightAuto ? (
        <>
          {["topLeft", "topRight", "bottomRight", "bottomLeft"].map(
            (direction) => {
              if (node.isViewport) {
                return null;
              }

              if (cornerPositions && targetRef?.current) {
                const corner =
                  cornerPositions[direction as keyof typeof cornerPositions];
                const topVal = `${corner.y * 100}%`;
                const leftVal = `${corner.x * 100}%`;
                return (
                  <div
                    key={direction}
                    data-resize-handle="true"
                    className={`absolute bg-white rounded-full`}
                    style={{
                      position: "absolute",
                      top: topVal,
                      left: leftVal,
                      cursor: getHandleCursor(direction as Direction),
                      zIndex: 1000,
                      width: `${handleSize}px`,
                      height: `${handleSize}px`,
                      transform: "translate(-50%, -50%)",
                      border: `${1 / getTransform().scale}px solid ${
                        node.isDynamic || dynamicModeNodeId
                          ? "var(--accent-secondary)"
                          : "var(--accent)"
                      }`,
                      pointerEvents: isInteractive ? "all" : "none",
                    }}
                    onClick={handleBorderClick}
                    onMouseDown={handleBorderClick}
                    onPointerDown={(e) =>
                      handlePointerDown(e, direction as Direction)
                    }
                  />
                );
              } else {
                return (
                  <div
                    key={direction}
                    data-resize-handle="true"
                    className={`absolute bg-white rounded-full`}
                    style={{
                      ...getFallbackCornerStyle(direction as Direction),
                      cursor: getHandleCursor(direction as Direction),
                      zIndex: 1000,
                      width: `${handleSize}px`,
                      height: `${handleSize}px`,
                      border: `${1 / getTransform().scale}px solid ${
                        node.isDynamic || dynamicModeNodeId
                          ? "var(--accent-secondary)"
                          : "var(--accent)"
                      }`,
                      pointerEvents: isInteractive ? "all" : "none",
                    }}
                    onClick={handleBorderClick}
                    onMouseDown={handleBorderClick}
                    onPointerDown={(e) =>
                      handlePointerDown(e, direction as Direction)
                    }
                  />
                );
              }
            }
          )}
        </>
      ) : isWidthAuto && !isHeightAuto ? (
        // Only top & bottom handles for auto width
        ["top", "bottom"].map((direction) => {
          if (cornerPositions && targetRef?.current) {
            const edge =
              cornerPositions[direction as keyof typeof cornerPositions];
            return (
              <div
                key={direction}
                data-resize-handle="true"
                data-direct-resize="true"
                className={`absolute bg-white rounded-full`}
                style={{
                  position: "absolute",
                  top: `${edge.y * 100}%`,
                  left: `${edge.x * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  border: `${1 / getTransform().scale}px solid ${
                    node.isDynamic || dynamicModeNodeId
                      ? "var(--accent-secondary)"
                      : "var(--accent)"
                  }`,
                  cursor: getHandleCursor(direction as Direction),
                  zIndex: 1000,
                  pointerEvents: isInteractive ? "all" : "none",
                }}
                onClick={handleBorderClick}
                onMouseDown={handleBorderClick}
                onPointerDown={(e) =>
                  handlePointerDown(e, direction as Direction)
                }
              />
            );
          } else {
            return (
              isInteractive && (
                <div
                  key={direction}
                  data-resize-handle="true"
                  data-direct-resize="true"
                  className={`absolute bg-white rounded-full`}
                  style={{
                    position: "absolute",
                    [direction]: 0,
                    left: "50%",
                    transform:
                      direction === "top"
                        ? "translate(-50%, -50%)"
                        : "translate(-50%, 50%)",
                    width: `${handleSize}px`,
                    height: `${handleSize}px`,
                    border: `${1 / getTransform().scale}px solid ${
                      node.isDynamic || dynamicModeNodeId
                        ? "var(--accent-secondary)"
                        : "var(--accent)"
                    }`,
                    cursor: getHandleCursor(direction as Direction),
                    zIndex: 1000,
                    pointerEvents: "all",
                  }}
                  onClick={handleBorderClick}
                  onMouseDown={handleBorderClick}
                  onPointerDown={(e) =>
                    handlePointerDown(e, direction as Direction)
                  }
                />
              )
            );
          }
        })
      ) : !isWidthAuto && isHeightAuto ? (
        // Only left & right handles for auto height
        ["left", "right"].map((direction) => {
          if (cornerPositions && targetRef?.current) {
            const edge =
              cornerPositions[direction as keyof typeof cornerPositions];
            return (
              isInteractive && (
                <div
                  key={direction}
                  data-resize-handle="true"
                  data-direct-resize="true"
                  className={`absolute bg-white rounded-full`}
                  style={{
                    position: "absolute",
                    top: `${edge.y * 100}%`,
                    left: `${edge.x * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${handleSize}px`,
                    height: `${handleSize}px`,
                    border: `${1 / getTransform().scale}px solid ${
                      node.isDynamic || dynamicModeNodeId
                        ? "var(--accent-secondary)"
                        : "var(--accent)"
                    }`,
                    cursor: getHandleCursor(direction as Direction),
                    zIndex: 1000,
                    pointerEvents: "all",
                  }}
                  onClick={handleBorderClick}
                  onMouseDown={handleBorderClick}
                  onPointerDown={(e) =>
                    handlePointerDown(e, direction as Direction)
                  }
                />
              )
            );
          } else {
            return (
              isInteractive && (
                <div
                  key={direction}
                  data-resize-handle="true"
                  data-direct-resize="true"
                  className={`absolute bg-white rounded-full`}
                  style={{
                    position: "absolute",
                    [direction]: 0,
                    top: "50%",
                    transform:
                      direction === "left"
                        ? "translate(-50%, -50%)"
                        : "translate(50%, -50%)",
                    width: `${handleSize}px`,
                    height: `${handleSize}px`,
                    border: `${1 / getTransform().scale}px solid ${
                      node.isDynamic || dynamicModeNodeId
                        ? "var(--accent-secondary)"
                        : "var(--accent)"
                    }`,
                    cursor: getHandleCursor(direction as Direction),
                    zIndex: 1000,
                    pointerEvents: "all",
                  }}
                  onClick={handleBorderClick}
                  onMouseDown={handleBorderClick}
                  onPointerDown={(e) =>
                    handlePointerDown(e, direction as Direction)
                  }
                />
              )
            );
          }
        })
      ) : null}

      {node.isViewport && (
        <div
          data-resize-handle="true"
          data-direct-resize="true"
          className="absolute bg-white rounded-full"
          style={{
            bottom: 0,
            left: "50%",
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            transform: "translate(-50%, 50%)",
            border: `${1 / getTransform().scale}px solid var(--accent)`,
            cursor: "ns-resize",
            zIndex: 1000,
            pointerEvents: "all",
          }}
          onClick={handleBorderClick}
          onMouseDown={handleBorderClick}
          onPointerDown={(e) => handlePointerDown(e, "bottom" as Direction)}
        />
      )}

      {/* Edge Resize Handles */}
      {!isWidthAuto && !isHeightAuto ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            transform: matrixCss || "none", // Use the same matrix as the border
            transformOrigin: "0 0",
          }}
        >
          {/* Use a container with the calculated matrix transform */}
          {["top", "right", "bottom", "left"].map((direction) => {
            // Skip edges that should be disabled based on auto dimensions

            if (node.isViewport && direction !== "bottom") {
              return null;
            }

            if (
              (isWidthAuto &&
                (direction === "left" || direction === "right")) ||
              (isHeightAuto && (direction === "top" || direction === "bottom"))
            ) {
              return null;
            }

            const borderSize = 4 / getTransform().scale;

            // Create standard edges that will be properly transformed by the parent container
            return (
              isInteractive && (
                <div
                  key={direction}
                  data-resize-handle="true"
                  data-direct-resize="true"
                  style={{
                    position: "absolute",
                    cursor: getHandleCursor(direction as Direction),
                    zIndex: 999,
                    backgroundColor: "transparent",
                    pointerEvents: "all",
                    ...(direction === "top"
                      ? {
                          top: 0,
                          left: "5%",
                          width: "90%",
                          height: borderSize,
                          transform: "translateY(-50%)",
                        }
                      : direction === "right"
                      ? {
                          top: "5%",
                          right: 0,
                          height: "90%",
                          width: borderSize,
                          transform: "translateX(50%)",
                        }
                      : direction === "bottom"
                      ? {
                          bottom: 0,
                          left: "5%",
                          width: "90%",
                          height: borderSize,
                          transform: "translateY(50%)",
                        }
                      : {
                          top: "5%",
                          left: 0,
                          height: "90%",
                          width: borderSize,
                          transform: "translateX(-50%)",
                        }),
                  }}
                  onClick={handleBorderClick}
                  onMouseDown={handleBorderClick}
                  onPointerDown={(e) =>
                    handlePointerDown(e, direction as Direction)
                  }
                />
              )
            );
          })}
        </div>
      ) : (
        // Fallback for auto width/height elements - use standard edges without skew
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            transformOrigin: "center center",
          }}
        >
          {["top", "right", "bottom", "left"].map((direction) => {
            // Skip edges that should be disabled based on auto dimensions
            if (
              (isWidthAuto &&
                (direction === "left" || direction === "right")) ||
              (isHeightAuto && (direction === "top" || direction === "bottom"))
            ) {
              return null;
            }

            const borderSize = 4 / getTransform().scale;

            return (
              isInteractive && (
                <div
                  key={direction}
                  data-resize-handle="true"
                  data-direct-resize="true"
                  style={{
                    position: "absolute",
                    cursor: getHandleCursor(direction as Direction),
                    zIndex: 999,
                    backgroundColor: "transparent",
                    pointerEvents: "all",
                    ...(direction === "top"
                      ? {
                          top: 0,
                          left: 0,
                          right: 0,
                          height: borderSize,
                          transform: "translateY(-50%)",
                        }
                      : direction === "right"
                      ? {
                          top: 0,
                          right: 0,
                          bottom: 0,
                          width: borderSize,
                          transform: "translateX(50%)",
                        }
                      : direction === "bottom"
                      ? {
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: borderSize,
                          transform: "translateY(50%)",
                        }
                      : {
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: borderSize,
                          transform: "translateX(-50%)",
                        }),
                  }}
                  onClick={handleBorderClick}
                  onMouseDown={handleBorderClick}
                  onPointerDown={(e) =>
                    handlePointerDown(e, direction as Direction)
                  }
                />
              )
            );
          })}
        </div>
      )}
    </>
  );
};
