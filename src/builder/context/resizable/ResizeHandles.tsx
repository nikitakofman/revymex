import React, { useLayoutEffect, useState, useRef } from "react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Direction, getHandleCursor } from "../utils";
import { useBuilder } from "../builderState";

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
   * A ref to the actual DOM element that may have skew/scale transforms.
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
   2D MATRIX HELPERS
--------------------------------------------*/
function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function multiply2D(A: number[], B: number[]) {
  // 3x3 row-major matrix multiply
  const C = new Array(9).fill(0);
  C[0] = A[0] * B[0] + A[1] * B[3] + A[2] * B[6];
  C[1] = A[0] * B[1] + A[1] * B[4] + A[2] * B[7];
  C[2] = A[0] * B[2] + A[1] * B[5] + A[2] * B[8];

  C[3] = A[3] * B[0] + A[4] * B[3] + A[5] * B[6];
  C[4] = A[3] * B[1] + A[4] * B[4] + A[5] * B[7];
  C[5] = A[3] * B[2] + A[4] * B[5] + A[5] * B[8];

  C[6] = A[6] * B[0] + A[7] * B[3] + A[8] * B[6];
  C[7] = A[6] * B[1] + A[7] * B[4] + A[8] * B[7];
  C[8] = A[6] * B[2] + A[7] * B[5] + A[8] * B[8];
  return C;
}

function applyMatrixToPoint(m: number[], x: number, y: number) {
  const nx = m[0] * x + m[1] * y + m[2];
  const ny = m[3] * x + m[4] * y + m[5];
  return { x: nx, y: ny };
}

/**
 * Get full transformation chain matrix for any node (including all ancestors)
 */
function getFullTransformMatrix(
  node: Node,
  nodeState: { nodes: Node[] },
  width: number,
  height: number
) {
  // Start with identity matrix
  let fullMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // Gather the ancestor chain from root to this node
  const chain: Node[] = [];
  let current: Node | undefined = node;

  while (current) {
    chain.unshift(current); // Add to front to get root → ... → node order

    if (!current.parentId) break;
    current = nodeState.nodes.find((n) => n.id === current!.parentId);
  }

  // Process each node in the chain and multiply matrices
  for (const node of chain) {
    // Extract transform values
    const skewX = parseSkewValue(node.style.transform, "skewX");
    const skewY = parseSkewValue(node.style.transform, "skewY");
    const scaleX = parseScaleValue(node.style.transform, "scaleX");
    const scaleY = parseScaleValue(node.style.transform, "scaleY");

    // Create local transform matrix for this node
    const localMatrix = build2DMatrix({
      tx: 0,
      ty: 0,
      cx: width / 2, // Use element's dimensions for pivoting
      cy: height / 2,
      scaleX,
      scaleY,
      skewXDeg: skewX,
      skewYDeg: skewY,
    });

    // Multiply with accumulated matrix
    fullMatrix = multiply2D(fullMatrix, localMatrix);
  }

  return fullMatrix;
}

/**
 * Parse skew values from transform string
 */
function parseSkewValue(
  transform: string | undefined,
  prop: "skewX" | "skewY"
): number {
  if (!transform) return 0;
  const regex = new RegExp(`${prop}\\(([-\\d.]+)deg\\)`);
  const match = transform.match(regex);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse scale values from transform string
 */
function parseScaleValue(
  transform: string | undefined,
  prop: "scaleX" | "scaleY"
): number {
  if (!transform) return 1;
  const regex = new RegExp(`${prop}\\(([-\\d.]+)\\)`);
  const match = transform.match(regex);
  return match ? parseFloat(match[1]) : 1;
}

/**
 * build2DMatrix:
 *  - Applies: translate(tx, ty) → translate(cx, cy) → scaleX, scaleY → skewX, skewY → translate back.
 */
function build2DMatrix({
  tx,
  ty,
  cx,
  cy,
  scaleX,
  scaleY,
  skewXDeg,
  skewYDeg,
}: {
  tx: number;
  ty: number;
  cx: number;
  cy: number;
  scaleX: number;
  scaleY: number;
  skewXDeg: number;
  skewYDeg: number;
}) {
  // Start with identity
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // 1) Translate(tx, ty)
  M = multiply2D(M, [1, 0, tx, 0, 1, ty, 0, 0, 1]);

  // 2) Translate(cx, cy)
  M = multiply2D(M, [1, 0, cx, 0, 1, cy, 0, 0, 1]);

  // 3) Scale (scaleX, scaleY)
  M = multiply2D(M, [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);

  // 4) SkewX
  const sx = Math.tan(degToRad(skewXDeg));
  M = multiply2D(M, [1, sx, 0, 0, 1, 0, 0, 0, 1]);

  // 5) SkewY
  const sy = Math.tan(degToRad(skewYDeg));
  M = multiply2D(M, [1, 0, 0, sy, 1, 0, 0, 0, 1]);

  // 6) Translate back (-cx, -cy)
  M = multiply2D(M, [1, 0, -cx, 0, 1, -cy, 0, 0, 1]);

  return M;
}

/**
 * Convert matrix to CSS string format
 */
function matrixToCss(m: number[]) {
  return `matrix(${m[0]}, ${m[3]}, ${m[1]}, ${m[4]}, ${m[2]}, ${m[5]})`;
}

/**
 * parseTransformValues:
 * Extracts scaleX, scaleY, skewX, skewY from the transform string.
 */
function parseTransformValues(transformString: string | undefined) {
  const result = {
    skewX: 0,
    skewY: 0,
    scaleX: 1,
    scaleY: 1,
  };
  if (!transformString) return result;

  const scaleXMatch = transformString.match(/scaleX\(([-\d.]+)\)/);
  if (scaleXMatch) {
    result.scaleX = parseFloat(scaleXMatch[1]);
  }
  const scaleYMatch = transformString.match(/scaleY\(([-\d.]+)\)/);
  if (scaleYMatch) {
    result.scaleY = parseFloat(scaleYMatch[1]);
  }
  const skewXMatch = transformString.match(/skewX\(([-\d.]+)deg\)/);
  if (skewXMatch) {
    result.skewX = parseFloat(skewXMatch[1]);
  }
  const skewYMatch = transformString.match(/skewY\(([-\d.]+)deg\)/);
  if (skewYMatch) {
    result.skewY = parseFloat(skewYMatch[1]);
  }
  return result;
}

/**
 * Create a CSS transform string from skew values
 */
function createSkewTransform(skewX: number, skewY: number): string {
  let transform = "";
  if (skewX !== 0) transform += `skewX(${skewX}deg) `;
  if (skewY !== 0) transform += `skewY(${skewY}deg)`;
  return transform.trim();
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
  cumulativeSkew,
}) => {
  const { dragState, transform, nodeState } = useBuilder();
  const { scale } = transform;

  // Determine if width/height are set to auto
  const isWidthAuto = node.style.width === "auto";
  const isHeightAuto = node.style.height === "auto";

  // Group selection: only render for the first selected node.
  if (isGroupSelection && !groupBounds) return null;
  if (isGroupSelection && node.id !== dragState.selectedIds[0]) return null;

  const [cornerPositions, setCornerPositions] =
    useState<CornerPositions | null>(null);
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 });
  const [fullMatrix, setFullMatrix] = useState<number[] | null>(null);
  const [matrixCss, setMatrixCss] = useState<string | null>(null);

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
    transform,
    node,
    nodeState,
    // Including these dependencies ensures we recalculate when any transform changes
    node.style.transform,
  ]);

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

  const handleSize = 8 / scale;

  return (
    <>
      {/* Corner Handles for single element */}
      {!isWidthAuto && !isHeightAuto ? (
        <>
          {["topLeft", "topRight", "bottomRight", "bottomLeft"].map(
            (direction) => {
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
                      border: `${1 / scale}px solid ${
                        node.isDynamic || dragState.dynamicModeNodeId
                          ? "var(--accent-secondary)"
                          : "var(--accent)"
                      }`,
                      pointerEvents: "all",
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
                      border: `${1 / scale}px solid ${
                        node.isDynamic || dragState.dynamicModeNodeId
                          ? "var(--accent-secondary)"
                          : "var(--accent)"
                      }`,
                      pointerEvents: "all",
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
                  border: `${1 / scale}px solid ${
                    node.isDynamic || dragState.dynamicModeNodeId
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
            );
          } else {
            return (
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
                  border: `${1 / scale}px solid ${
                    node.isDynamic || dragState.dynamicModeNodeId
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
                  border: `${1 / scale}px solid ${
                    node.isDynamic || dragState.dynamicModeNodeId
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
            );
          } else {
            return (
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
                  border: `${1 / scale}px solid ${
                    node.isDynamic || dragState.dynamicModeNodeId
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
            );
          }
        })
      ) : null}

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
            if (
              (isWidthAuto &&
                (direction === "left" || direction === "right")) ||
              (isHeightAuto && (direction === "top" || direction === "bottom"))
            ) {
              return null;
            }

            const borderSize = 4 / scale;

            // Create standard edges that will be properly transformed by the parent container
            return (
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

            const borderSize = 4 / scale;

            return (
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
            );
          })}
        </div>
      )}
    </>
  );
};
