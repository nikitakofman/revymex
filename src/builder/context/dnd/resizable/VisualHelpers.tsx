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
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [localComputedStyle, setLocalComputedStyle] =
    useState<CSSStyleDeclaration | null>(null);
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
    <div className="pointer-events-none" style={helperStyles}>
      {!isAdjustingGap &&
        !isMovingCanvas &&
        !isRotating &&
        !dragState.dragSource &&
        isSelected && (
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
        )}

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

      {showHelpers && isSelected && (
        <>
          <ResizeHandles node={node} handleResizeStart={handleResizeStart} />
          <GripHandles node={node} elementRef={elementRef} />
          <RotateHandle node={node} elementRef={elementRef} />
          {(!node.isDynamic || dragState.dynamicModeNodeId === node.id) &&
            localComputedStyle?.display !== "grid" && (
              <GapHandles
                node={node}
                isSelected={isSelected}
                elementRef={elementRef}
              />
            )}
          {node.isDynamic && !dragState.dynamicModeNodeId && (
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
          )}
          <ConnectionHandle node={node} transform={transform} />
        </>
      )}
    </div>,
    contentRef.current
  );
};
