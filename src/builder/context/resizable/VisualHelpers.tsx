import React, { useState, useLayoutEffect, RefObject, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import { ConnectionHandle } from "../canvasHelpers/ConnectionHandle";
import { ResizeHandles } from "./ResizeHandles";
import { GapHandles } from "./GapHandles";
import { GripHandles } from "./GripHandles";
import {
  hasSkewTransform,
  parseSkew,
  createSkewTransform,
  Direction,
  isAbsoluteInFrame,
  getCumulativeRotation,
  getCumulativeSkew,
  computeFullMatrixChain,
  matrixToCss,
} from "../utils";
import { RotateHandle } from "./RotateHandle";
import { BorderRadiusHandle } from "./BorderRadiusHandle";
import AddVariantsUI from "../canvasHelpers/AddVariantUI";
import NameDisplay from "./NameDisplay";
import { AxeIcon } from "lucide-react";
import { FontSizeHandle } from "./FontSizeHandle";
import { ObjectPositionHandle } from "./ObjectPositionHandle";
import { useNodeHovered } from "../atoms/hover-store";
import {
  primarySelectedIdAtom,
  selectionCountAtom,
  selectStore,
  useGetSelectedIds,
  useNodeSelected,
  useNodeTempSelected,
} from "../atoms/select-store";
import { useAtomValue } from "jotai";
import { useDragSource } from "../atoms/drag-store";
import {
  useGetTransform,
  useIsAdjustingGap,
  useIsEditingText,
  useIsMovingCanvas,
  useIsResizing,
  useIsRotating,
} from "../atoms/canvas-interaction-store";
import { useDynamicModeNodeId } from "../atoms/dynamic-store";
import {
  useNodeStyle,
  useNodeFlags,
  useNodeParent,
  useNodeSharedInfo,
  useNodeDynamicInfo,
  useNodeBasics,
  useNodeState,
  useGetNode,
} from "@/builder/context/atoms/node-store";

export const VisualHelpers = ({
  elementRef,
  nodeId,
  handleResizeStart,
}: {
  elementRef: RefObject<HTMLDivElement>;
  nodeId: string;
  handleResizeStart: (e: React.PointerEvent, direction: Direction) => void;
}) => {
  // Get all node data from atoms - reactive approach
  const style = useNodeStyle(nodeId);
  const flags = useNodeFlags(nodeId);
  const parentId = useNodeParent(nodeId);
  const sharedInfo = useNodeSharedInfo(nodeId);
  const dynamicInfo = useNodeDynamicInfo(nodeId);
  const basics = useNodeBasics(nodeId);

  // Get full node state for complex operations
  const nodeState = useNodeState();

  // Get a single node getter for compatibility
  const getNode = useGetNode();

  // Extract commonly used properties
  const { isLocked = false, isDynamic = false, isViewport = false } = flags;
  const { type } = basics;

  // Create a compatibility node object for functions that still require it
  const node = {
    id: nodeId,
    type,
    style,
    isLocked,
    isDynamic,
    ...flags,
    ...dynamicInfo,
    ...sharedInfo,
    parentId,
  };

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

  const { contentRef } = useBuilderRefs();

  // Use atoms for state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const isResizing = useIsResizing();
  const isEditingText = useIsEditingText();
  const getTransform = useGetTransform();
  const isHovered = useNodeHovered(nodeId);
  const isNodeTempSelected = useNodeTempSelected(nodeId);
  const isSelected = useNodeSelected(nodeId);
  const getSelectedIds = useGetSelectedIds();
  const dragSource = useDragSource();
  const isMovingCanvas = useIsMovingCanvas();
  const isAdjustingGap = useIsAdjustingGap();
  const isRotating = useIsRotating();

  const cumulativeSkew = getCumulativeSkew(node, nodeState);

  // Whether we can show selection or hover
  const isInteractive =
    !isResizing && !isAdjustingGap && !isRotating && !dragSource;
  const showHelpers = !isMovingCanvas && isInteractive;

  // Use the derived atoms for specific selection state
  const selectionCount = useAtomValue(selectionCountAtom, {
    store: selectStore,
  });
  const primarySelectedId = useAtomValue(primarySelectedIdAtom, {
    store: selectStore,
  });
  const isMultiSelection = selectionCount > 1;
  const isPrimarySelected = isSelected && primarySelectedId === nodeId;

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

    const transform = getTransform();

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
    getTransform,
    isSelected,
    dragSource,
    isMovingCanvas,
    nodeId,
    style.transform,
  ]);

  /* ---------------------------------
     2) Compute the multi-selection group bounding box
  ----------------------------------*/
  useLayoutEffect(() => {
    let rafId: number;

    const transform = getTransform();

    const updateGroupBounds = () => {
      // Only if more than 1 element is selected
      if (!contentRef.current || selectionCount <= 1) {
        setGroupBoundsState(null);
        return;
      }

      // Get current selection imperatively - only when needed
      const selectedIds = getSelectedIds();

      const contentRect = contentRef.current.getBoundingClientRect();
      const scale = transform.scale;

      const selectedElements = selectedIds
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
  }, [selectionCount, contentRef, getTransform, getSelectedIds]);

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
    const transform = getTransform();

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
              style={{
                ...getBorderStyle(
                  isDynamic || dynamicModeNodeId
                    ? "var(--accent-secondary)"
                    : "var(--accent)",
                  998
                ),
                pointerEvents: "none",
              }}
            />
          )}

          {/* Temp selection border */}
          {isNodeTempSelected && (
            <div
              style={{
                ...getBorderStyle(
                  isDynamic || dynamicModeNodeId
                    ? "var(--accent-secondary)"
                    : "var(--accent)",
                  999
                ),
                pointerEvents: "none",
              }}
            />
          )}

          {!isMovingCanvas && <NameDisplay nodeId={nodeId} />}

          {/* Actual selection border + handles */}
          {showHelpers && isSelected && !isEditingText && (
            <>
              <div
                style={{
                  ...getBorderStyle(
                    isDynamic || dynamicModeNodeId
                      ? "var(--accent-secondary)"
                      : "#3b82f6",
                    1000
                  ),
                  pointerEvents: "none",
                }}
              />
              {!isLocked && (
                <ResizeHandles
                  nodeId={nodeId}
                  handleResizeStart={handleResizeStart}
                  isGroupSelection={false}
                  targetRef={elementRef}
                  cumulativeSkew={cumulativeSkew}
                />
              )}

              {/* Single-element controls if not locked */}
              {!isLocked && (
                <>
                  {!nodeId.includes("viewport") &&
                    !hasSkewTransform(style.transform) && (
                      <FontSizeHandle nodeId={nodeId} elementRef={elementRef} />
                    )}
                  {/* Rotate handle if no skew */}
                  {!nodeId.includes("viewport") &&
                    !hasSkewTransform(style.transform) && (
                      <RotateHandle nodeId={nodeId} elementRef={elementRef} />
                    )}

                  {/* BorderRadius handle */}
                  {!nodeId.includes("viewport") &&
                    !hasSkewTransform(style.transform) &&
                    type !== "text" && (
                      <BorderRadiusHandle
                        nodeId={nodeId}
                        elementRef={elementRef}
                      />
                    )}

                  {!hasSkewTransform(style.transform) &&
                    (type === "image" ||
                      type === "video" ||
                      (type === "frame" &&
                        (style.backgroundImage || style.backgroundVideo))) && (
                      <ObjectPositionHandle
                        nodeId={nodeId}
                        elementRef={elementRef}
                      />
                    )}

                  {/* Grip handles */}
                  {!nodeId.includes("viewport") &&
                    !hasSkewTransform(style.transform) &&
                    !isAbsoluteInFrame(node) && (
                      <GripHandles nodeId={nodeId} elementRef={elementRef} />
                    )}

                  {/* Gap handles (only if not display:grid) */}
                  {(!isDynamic || dynamicModeNodeId === nodeId) &&
                    localComputedStyle?.display !== "grid" && (
                      <GapHandles
                        nodeId={nodeId}
                        isSelected={isSelected}
                        elementRef={elementRef}
                      />
                    )}

                  {/* Connection handle */}
                  {dynamicModeNodeId !== null && (
                    <ConnectionHandle nodeId={nodeId} />
                  )}
                  <AddVariantsUI nodeId={nodeId} />
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
              border: (() => {
                // Get transform only when this style is rendered
                const transform = getTransform();
                return isDynamic || dynamicModeNodeId
                  ? `${2 / transform.scale}px solid var(--accent-secondary)`
                  : `${2 / transform.scale}px solid #3b82f6`;
              })(),
              boxSizing: "border-box",
            }}
          />

          {/* Group handles only on the *primary* selected node */}
          {!isLocked && isPrimarySelected && (
            <>
              <ResizeHandles
                nodeId={nodeId}
                handleResizeStart={handleResizeStart}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
                targetRef={elementRef}
              />

              <RotateHandle
                nodeId={nodeId}
                elementRef={elementRef}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
              />

              <BorderRadiusHandle
                nodeId={nodeId}
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
