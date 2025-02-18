import React, { useState, useLayoutEffect, RefObject } from "react";
import { createPortal } from "react-dom";
import { useBuilder } from "@/builder/context/builderState";
import { ConnectionHandle } from "../ConnectionHandle";
import { ResizeHandles } from "./ResizeHandles";
import { GapHandles } from "./GapHandles";
import { GripHandles } from "./GripHandles";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { Direction } from "../utils";
import { RotateHandle } from "./RotateHandle";
import { BorderRadiusHandle } from "./BorderRadiusHandle";

const parseRotation = (rotate: string | undefined): number => {
  if (!rotate) return 0;
  const match = rotate.match(/([-\d.]+)deg/);
  return match ? parseFloat(match[1]) : 0;
};

const getCumulativeRotation = (
  node: Node,
  nodeState: { nodes: Node[] }
): number => {
  let totalRotation = 0;
  let currentNode = node;
  while (currentNode) {
    totalRotation += parseRotation(currentNode.style.rotate);
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
  // State for individual element's bounding rectangle
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [localComputedStyle, setLocalComputedStyle] =
    useState<CSSStyleDeclaration | null>(null);
  // State for group (multi-selection) bounds
  const [groupBoundsState, setGroupBoundsState] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

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

  const isInteractive =
    !isResizing && !isAdjustingGap && !isRotating && !dragState.dragSource;
  const showHelpers = !isMovingCanvas && isInteractive;
  const cumulativeRotation = getCumulativeRotation(node, nodeState);

  // --- Individual Element Calculation (Same as Original) ---
  useLayoutEffect(() => {
    if (!elementRef.current || !contentRef.current) return;
    const updateRect = () => {
      const element = elementRef.current;
      const content = contentRef.current;
      if (!element || !content) return;
      const elementRect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      setLocalComputedStyle(computedStyle);
      const width = parseFloat(computedStyle.width);
      const height = parseFloat(computedStyle.height);
      const centerX =
        (elementRect.left - contentRect.left + elementRect.width / 2) /
        transform.scale;
      const centerY =
        (elementRect.top - contentRect.top + elementRect.height / 2) /
        transform.scale;
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
    transform,
    isSelected,
    dragState.dragSource,
    isMovingCanvas,
    node.id,
    dragState.hoverNodeId,
    dragDisp,
  ]);

  // --- Group Bounds Calculation for Multi-Selection ---
  useLayoutEffect(() => {
    let rafId: number;
    const updateGroupBounds = () => {
      if (!contentRef.current) return;
      // Only proceed if more than one element is selected.
      if (dragState.selectedIds.length <= 1) {
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

  if (!contentRef.current) return null;
  const isHovered = dragState.hoverNodeId === node.id;
  const helperStyles = {
    position: "absolute" as const,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    zIndex: 2000,
    rotate: `${cumulativeRotation}deg`,
    transformOrigin: "center center",
  };

  return createPortal(
    <>
      {/* Individual Element Helpers */}
      <div className="pointer-events-none" style={helperStyles}>
        {showHelpers && !isSelected && isHovered && (
          <div
            className="absolute pointer-events-none"
            style={{
              position: "absolute",
              inset: 0,
              border: `${2 / transform.scale}px solid ${
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "var(--accent-secondary)"
                  : "var(--accent)"
              }`,
              zIndex: 998,
              borderRadius: 0,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        )}
        {dragState.tempSelectedIds.includes(node.id) && (
          <div
            className="absolute pointer-events-none"
            style={{
              position: "absolute",
              inset: 0,
              border: `${2 / transform.scale}px solid ${
                node.isDynamic || dragState.dynamicModeNodeId
                  ? "var(--accent-secondary)"
                  : "var(--accent)"
              }`,
              zIndex: 998,
              borderRadius: 0,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        )}

        {showHelpers && isSelected && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{
                position: "absolute",
                inset: 0,
                border:
                  node.isDynamic || dragState.dynamicModeNodeId
                    ? `${2 / transform.scale}px solid var(--accent-secondary)`
                    : `${2 / transform.scale}px solid #3b82f6`,
                zIndex: 999,
                borderRadius: 0,
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />
            {/* Always show Resize and Grip handles */}
            {/* Only for single selection: show Border Radius, Rotate, and Gap controls */}
            {dragState.selectedIds.length <= 1 && (
              <>
                <ResizeHandles
                  node={node}
                  handleResizeStart={handleResizeStart}
                />
                {!node.id.includes("viewport") && (
                  <>
                    <GripHandles node={node} elementRef={elementRef} />
                    <BorderRadiusHandle node={node} elementRef={elementRef} />
                    <RotateHandle node={node} elementRef={elementRef} />
                  </>
                )}

                {(!node.isDynamic || dragState.dynamicModeNodeId === node.id) &&
                  localComputedStyle?.display !== "grid" && (
                    <GapHandles
                      node={node}
                      isSelected={isSelected}
                      elementRef={elementRef}
                    />
                  )}
                <ConnectionHandle node={node} transform={transform} />
              </>
            )}
            {/* {node.isDynamic && !dragState.dynamicModeNodeId && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ zIndex: 1000 }}
              >
                <button
                  className="rounded text-white text-[10px]"
                  style={{
                    backgroundColor: "var(--accent-secondary)",
                    transformOrigin: "center center",
                    padding: "8px",
                    fontSize: `${10 / transform.scale}px`,
                    lineHeight: 1,
                    pointerEvents: "auto",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    dragDisp.setDynamicModeNodeId(node.id);
                  }}
                >
                  Edit
                </button>
              </div>
            )} */}
          </>
        )}
      </div>

      {/* Group (Multi-Selection) Border */}
      {dragState.selectedIds.length > 1 &&
        groupBoundsState &&
        !isMovingCanvas &&
        isInteractive && (
          <div
            style={{
              position: "absolute",
              left: `${groupBoundsState.left}px`,
              top: `${groupBoundsState.top}px`,
              width: `${groupBoundsState.width}px`,
              height: `${groupBoundsState.height}px`,
              pointerEvents: "none",
              zIndex: 999,
            }}
          >
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
            {node.id === dragState.selectedIds[0] && (
              <ResizeHandles
                node={node}
                handleResizeStart={handleResizeStart}
                groupBounds={groupBoundsState}
                isGroupSelection={true}
              />
            )}
          </div>
        )}
    </>,
    contentRef.current
  );
};
