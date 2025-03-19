import React, { useState, useLayoutEffect, RefObject } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";
import { ConnectionHandle } from "../canvasHelpers/ConnectionHandle";
import { ResizeHandles } from "./ResizeHandles";
import { GapHandles } from "./GapHandles";
import { GripHandles } from "./GripHandles";
import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  hasSkewTransform,
  parseSkew,
  createSkewTransform,
  Direction,
  isAbsoluteInFrame,
} from "../utils";
import { RotateHandle } from "./RotateHandle";
import { BorderRadiusHandle } from "./BorderRadiusHandle";
import AddVariantsUI from "../canvasHelpers/AddVariantUI";

/* -------------------------------------------
   2D MATRIX HELPERS
--------------------------------------------*/
function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function multiply2D(A: number[], B: number[]) {
  // Multiply two 3x3 matrices (row-major order)
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
 * Create a 3×3 2D transform matrix, applying:
 *   translate(tx, ty) → translate(cx, cy) → scale → skewX → skewY → translate(-cx, -cy)
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
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // 1) Translate by (tx, ty)
  M = multiply2D(M, [1, 0, tx, 0, 1, ty, 0, 0, 1]);

  // 2) Translate pivot (cx, cy)
  M = multiply2D(M, [1, 0, cx, 0, 1, cy, 0, 0, 1]);

  // 3) Scale
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

function matrixToCss(m: number[]) {
  // return a "matrix(...)" 2D transform string
  return `matrix(${m[0]}, ${m[3]}, ${m[1]}, ${m[4]}, ${m[2]}, ${m[5]})`;
}

/**
 * Parse numeric rotation (in deg) from style.rotate if present, else 0
 */
function parseRotation(rotate: string | undefined): number {
  if (!rotate) return 0;
  const match = rotate.match(/([-\d.]+)deg/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extract scaleX, scaleY, skewX, skewY from a node's .style.transform (like "scaleX(0.8) skewX(10deg)" etc).
 * If absent, defaults to (scale=1, skew=0).
 */
function parseTransformValues(transformStr: string | undefined) {
  const result = { scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 };
  if (!transformStr) return result;

  // scaleX(...)
  const sxMatch = transformStr.match(/scaleX\(([-\d.]+)\)/);
  if (sxMatch) result.scaleX = parseFloat(sxMatch[1]);

  // scaleY(...)
  const syMatch = transformStr.match(/scaleY\(([-\d.]+)\)/);
  if (syMatch) result.scaleY = parseFloat(syMatch[1]);

  // skewX(...deg)
  const kxMatch = transformStr.match(/skewX\(([-\d.]+)deg\)/);
  if (kxMatch) result.skewX = parseFloat(kxMatch[1]);

  // skewY(...deg)
  const kyMatch = transformStr.match(/skewY\(([-\d.]+)deg\)/);
  if (kyMatch) result.skewY = parseFloat(kyMatch[1]);

  return result;
}

/**
 * Recursively compute a final 2D matrix for a node by:
 *   - Summing up all rotations in the chain (for rotate handle)
 *   - Multiplying all local transforms in the chain (for skew/scale).
 *
 * This returns:
 *   {
 *     totalRotationDeg: number,
 *     fullMatrix: number[]    // final 3x3 matrix from ancestors + self
 *   }
 *
 * For simplicity, we pivot each node at its center for skew/scale.
 * (Exactly as done in your POC and ResizeHandles.)
 */
function computeFullMatrixChain(
  node: Node,
  nodes: Node[],
  // The actual DOM width/height for pivot
  width: number,
  height: number
) {
  let totalRotationDeg = 0;

  // We'll gather transforms from ancestor → ... → self
  // so we can multiply them in order
  const transformMatrices: number[][] = [];

  let current: Node | undefined = node;
  let depth = 0;

  // We'll "unshift" each parent's matrix so that the root is first
  // and the child is last, then multiply in sequence
  while (current) {
    // Add rotation
    totalRotationDeg += parseRotation(current.style.rotate);

    // parse local skew/scale
    const { scaleX, scaleY, skewX, skewY } = parseTransformValues(
      current.style.transform
    );

    // Build local matrix with pivot at the center of *this* node:
    const localM = build2DMatrix({
      tx: 0,
      ty: 0,
      cx: width / 2,
      cy: height / 2,
      scaleX,
      scaleY,
      skewXDeg: skewX,
      skewYDeg: skewY,
    });

    // We'll store it
    transformMatrices.unshift(localM);

    if (!current.parentId) break;
    current = nodes.find((n) => n.id === current?.parentId);
    depth++;
    // NOTE: If each ancestor might have a *different* width/height pivot,
    // you would need a more advanced approach (like your POC with each parent's dimension).
    // But if you keep it simplified to the child's dimension,
    // or if your parent doesn't scale child differently, this is enough.
    // If you do want *each* parent's pivot dimension, you'd track them in a chain.
  }

  // Multiply all from root → child in order
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (const mat of transformMatrices) {
    M = multiply2D(M, mat);
  }

  return {
    totalRotationDeg,
    fullMatrix: M,
  };
}

/**
 * Get cumulative skew for an element and its ancestors
 * For a child element, include only parent skew
 */
const getCumulativeSkew = (
  node: Node,
  nodeState: { nodes: Node[] }
): { skewX: number; skewY: number } => {
  let totalSkewX = 0;
  let totalSkewY = 0;
  let currentNode = node;
  let isFirst = true;

  while (currentNode) {
    if (isFirst) {
      // Skip the first node (self) when calculating parent cumulative skew
      isFirst = false;
    } else {
      const skewValues = parseSkew(currentNode.style.transform);
      totalSkewX += skewValues.skewX;
      totalSkewY += skewValues.skewY;
    }

    if (!currentNode.parentId) break;

    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return { skewX: totalSkewX, skewY: totalSkewY };
};

/**
 * NEW: Get cumulative rotation from all ancestors
 */
const getCumulativeRotation = (
  node: Node,
  nodeState: { nodes: Node[] }
): number => {
  let totalRotation = 0;
  let currentNode = node;
  let isFirst = true;

  while (currentNode) {
    if (isFirst) {
      // For the node itself, include its own rotation
      totalRotation += parseRotation(currentNode.style.rotate);
      isFirst = false;
    } else {
      // For ancestors, add their rotations to the total
      totalRotation += parseRotation(currentNode.style.rotate);
    }

    if (!currentNode.parentId) break;

    currentNode =
      nodeState.nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }

  return totalRotation;
};

export const VisualHelpers = ({
  elementRef,
  node,
  isSelected,
  handleResizeStart,
}: {
  elementRef: RefObject<HTMLDivElement>;
  node: Node;
  isSelected: boolean;
  handleResizeStart: (e: React.PointerEvent, direction: Direction) => void;
}) => {
  // bounding rect in the *canvas* coordinate system
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [localComputedStyle, setLocalComputedStyle] =
    useState<CSSStyleDeclaration | null>(null);

  // For group (multi-selection) bounding box
  const [groupBoundsState, setGroupBoundsState] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Final matrix + total rotation for this node
  const [fullMatrixCss, setFullMatrixCss] = useState<string>("none");
  const [totalRotationDeg, setTotalRotationDeg] = useState<number>(0);

  // Track parent's rotation as well (for children to inherit)
  const [cumulativeRotation, setCumulativeRotation] = useState<number>(0);

  const {
    contentRef,
    transform,
    dragState,
    isResizing,
    isMovingCanvas,
    dragDisp,
    isAdjustingGap,
    isRotating,
    nodeState,
  } = useBuilder();

  const cumulativeSkew = getCumulativeSkew(node, nodeState);

  const isLocked = node.isLocked === true;

  // Whether we can show selection or hover
  const isInteractive =
    !isResizing && !isAdjustingGap && !isRotating && !dragState.dragSource;
  const showHelpers = !isMovingCanvas && isInteractive;

  // Are we dealing with multi-selection?
  const isMultiSelection = dragState.selectedIds.length > 1;
  const isPrimarySelected = isSelected && dragState.selectedIds[0] === node.id;
  const isHovered = dragState.hoverNodeId === node.id;

  /* ---------------------------------
     Calculate cumulative parent rotation
  ----------------------------------*/
  useLayoutEffect(() => {
    // Get cumulative rotation from all parent nodes
    const totalRot = getCumulativeRotation(node, nodeState);
    setCumulativeRotation(totalRot);
  }, [node, nodeState]);

  /* ---------------------------------
     1) Track the element's bounding rect
        and computed style
  ----------------------------------*/
  useLayoutEffect(() => {
    if (!elementRef.current || !contentRef.current) return;

    const updateRect = () => {
      const element = elementRef.current!;
      const content = contentRef.current!;
      const elementRect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      setLocalComputedStyle(computedStyle);

      const width = parseFloat(computedStyle.width);
      const height = parseFloat(computedStyle.height);

      // convert from screen coords to "canvas" coords (account for .scale)
      const scale = transform.scale;
      const offsetX = (elementRect.left - contentRect.left) / scale;
      const offsetY = (elementRect.top - contentRect.top) / scale;
      const boundingWidth = elementRect.width / scale;
      const boundingHeight = elementRect.height / scale;

      // center approach
      const centerX = offsetX + boundingWidth / 2;
      const centerY = offsetY + boundingHeight / 2;

      setRect({
        top: centerY - height / 2,
        left: centerX - width / 2,
        width,
        height,
      });
    };

    const elementObserver = new MutationObserver(updateRect);
    const contentObserver = new MutationObserver(updateRect);

    elementObserver.observe(elementRef.current, {
      attributes: true,
      attributeFilter: ["style", "class", "transform"],
      subtree: false,
    });
    contentObserver.observe(contentRef.current, {
      attributes: true,
      attributeFilter: ["style", "class", "transform"],
      subtree: false,
    });
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    updateRect();

    return () => {
      elementObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [
    elementRef,
    contentRef,
    transform.scale,
    isSelected,
    dragState.dragSource,
    isMovingCanvas,
    node.id,
    dragState.hoverNodeId,
    dragDisp,
    node.style.transform,
  ]);

  /* ---------------------------------
     2) Compute the multi-selection group bounding box
  ----------------------------------*/
  useLayoutEffect(() => {
    let rafId: number;

    const updateGroupBounds = () => {
      // Only if more than 1 element is selected
      if (!contentRef.current || dragState.selectedIds.length <= 1) {
        setGroupBoundsState(null);
        return;
      }
      const contentRect = contentRef.current.getBoundingClientRect();
      const scale = transform.scale;

      const selectedElements = dragState.selectedIds
        .map((id) => document.querySelector(`[data-node-id="${id}"]`))
        .filter((el): el is HTMLElement => el !== null);

      if (selectedElements.length === 0) {
        setGroupBoundsState(null);
        return;
      }

      const rects = selectedElements.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: (r.left - contentRect.left) / scale,
          top: (r.top - contentRect.top) / scale,
          right: (r.right - contentRect.left) / scale,
          bottom: (r.bottom - contentRect.top) / scale,
        };
      });
      const minLeft = Math.min(...rects.map((r) => r.left));
      const minTop = Math.min(...rects.map((r) => r.top));
      const maxRight = Math.max(...rects.map((r) => r.right));
      const maxBottom = Math.max(...rects.map((r) => r.bottom));
      setGroupBoundsState({
        left: minLeft,
        top: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      });
    };

    const tick = () => {
      updateGroupBounds();
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(rafId);
  }, [dragState.selectedIds, contentRef, transform.scale]);

  /* ---------------------------------
     3) Compute the final matrix for
        the single element's border alignment
  ----------------------------------*/
  useLayoutEffect(() => {
    if (!isMultiSelection && elementRef.current && rect.width && rect.height) {
      // Build full chain matrix for this node
      const { totalRotationDeg, fullMatrix } = computeFullMatrixChain(
        node,
        nodeState.nodes,
        rect.width,
        rect.height
      );
      setTotalRotationDeg(totalRotationDeg);

      const cssMatrix = matrixToCss(fullMatrix);
      setFullMatrixCss(cssMatrix);
    } else {
      // for multi-selection, just skip
      setFullMatrixCss("none");
      setTotalRotationDeg(0);
    }
  }, [isMultiSelection, node, nodeState.nodes, rect.width, rect.height]);

  // ───────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────

  if (!contentRef.current) return null;

  // For single-node helper container:
  //   We absolutely position an outer <div> at (rect.top, rect.left, rect.width, rect.height)
  //   Then we have an inner <div> for the border with "inset:0" + the final transform matrix
  //   so that it lines up exactly around the node's actual skewed shape.
  const helperContainerStyle: React.CSSProperties = {
    position: "absolute",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: "none",
    rotate: `${cumulativeRotation}deg`, // Use cumulative rotation from all parents
    zIndex: 2000,
  };

  const getBorderStyle = (
    baseColor: string,
    zIndex: number
  ): React.CSSProperties => {
    // We nest a full-size box, then apply the final matrix so it skews/rotates exactly.
    // transform-origin: 0 0 (so that (0,0) is top-left) or "center" if you prefer
    // But since we used "build2DMatrix" pivoting at center, we usually keep origin at top-left
    // and trust the matrix to handle that pivot shift.
    return {
      position: "absolute",
      inset: 0,
      transform: !isMultiSelection ? fullMatrixCss : "none",
      transformOrigin: "0 0",
      border: `${2 / transform.scale}px solid ${baseColor}`,
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex,
    };
  };

  return createPortal(
    <>
      {/* -------------------------
          SINGLE ELEMENT Helpers
      ------------------------- */}
      {!isMultiSelection && (
        <div className="isthis" style={helperContainerStyle}>
          {/* Hover border */}
          {showHelpers && !isSelected && isHovered && (
            <div
              style={getBorderStyle(
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "var(--accent-secondary)"
                  : "var(--accent)",
                998
              )}
            />
          )}

          {/* Temp selection border */}
          {dragState.tempSelectedIds.includes(node.id) && (
            <div
              style={getBorderStyle(
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "var(--accent-secondary)"
                  : "var(--accent)",
                999
              )}
            />
          )}

          {/* Actual selection border + handles */}
          {showHelpers && isSelected && (
            <>
              <div
                style={{
                  ...getBorderStyle(
                    node.isDynamic || dragState.dynamicModeNodeId
                      ? "var(--accent-secondary)"
                      : "#3b82f6",
                    1000
                  ),
                }}
              />
              {!isLocked && (
                <ResizeHandles
                  node={node}
                  handleResizeStart={handleResizeStart}
                  isGroupSelection={false}
                  targetRef={elementRef}
                  cumulativeSkew={cumulativeSkew}
                />
              )}

              {/* Single-element controls if not locked */}
              {!isLocked && (
                <>
                  {/* Rotate handle if no skew */}
                  {!node.id.includes("viewport") &&
                    !hasSkewTransform(node.style.transform) && (
                      <RotateHandle node={node} elementRef={elementRef} />
                    )}

                  {/* BorderRadius handle */}
                  {!node.id.includes("viewport") &&
                    !hasSkewTransform(node.style.transform) &&
                    node.type !== "text" && (
                      <BorderRadiusHandle node={node} elementRef={elementRef} />
                    )}

                  {/* Grip handles */}
                  {!node.id.includes("viewport") &&
                    !hasSkewTransform(node.style.transform) &&
                    !isAbsoluteInFrame(node) && (
                      <GripHandles node={node} elementRef={elementRef} />
                    )}

                  {/* Gap handles (only if not display:grid) */}
                  {(!node.isDynamic ||
                    dragState.dynamicModeNodeId === node.id) &&
                    localComputedStyle?.display !== "grid" && (
                      <GapHandles
                        node={node}
                        isSelected={isSelected}
                        elementRef={elementRef}
                      />
                    )}

                  {/* Connection handle */}
                  <ConnectionHandle node={node} transform={transform} />
                  {/* <AddVariantsUI node={node} transform={transform} /> */}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* -------------------------
          MULTI-SELECTION Helpers
      ------------------------- */}
      {isMultiSelection && groupBoundsState && showHelpers && (
        <div
          style={{
            position: "absolute",
            left: groupBoundsState.left,
            top: groupBoundsState.top,
            width: groupBoundsState.width,
            height: groupBoundsState.height,
            pointerEvents: "none",
            zIndex: 999,
          }}
        >
          {/* Group selection border */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border:
                node.isDynamic || dragState.dynamicModeNodeId
                  ? `${2 / transform.scale}px solid var(--accent-secondary)`
                  : `${2 / transform.scale}px solid #3b82f6`,
              boxSizing: "border-box",
            }}
          />

          {/* Group handles only on the *primary* selected node */}
          {!isLocked && isPrimarySelected && (
            <>
              <ResizeHandles
                node={node}
                handleResizeStart={handleResizeStart}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
                targetRef={elementRef}
              />

              <RotateHandle
                node={node}
                elementRef={elementRef}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
              />

              <BorderRadiusHandle
                node={node}
                elementRef={elementRef}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
              />
            </>
          )}
        </div>
      )}
    </>,
    contentRef.current
  );
};
