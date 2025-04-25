import React, { useEffect, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { visualOps } from "../atoms/visual-store";

const parseRotation = (rotate: string | undefined): number => {
  if (!rotate) return 0;
  const match = rotate.match(/([-\d.]+)deg/);
  return match ? parseFloat(match[1]) : 0;
};

const hasRotation = (node: Node, nodes: Node[]): boolean => {
  let currentNode = node;
  while (currentNode) {
    if (parseRotation(currentNode.style.rotate) !== 0) {
      return true;
    }
    if (!currentNode.parentId) break;
    currentNode =
      nodes.find((n) => n.id === currentNode.parentId) || currentNode;
    if (!currentNode) break;
  }
  return false;
};

export const GapHandles = ({
  node,
  isSelected,
  elementRef,
}: {
  node: Node;
  isSelected: boolean;
  elementRef: React.RefObject<HTMLDivElement>;
}) => {
  const {
    setNodeStyle,
    nodeState,
    dragDisp,
    transform,
    setIsAdjustingGap,
    isResizing,
    isMovingCanvas,
    startRecording,
    stopRecording,
  } = useBuilder();
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInteractive(true);
    }, 200); // 100ms delay before making it interactive

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const startAdjustingGap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isInteractive) return;

    // Initialize gap if it doesn't exist or has an invalid value
    const hasInvalidGap =
      !node.style.gap ||
      node.style.gap === "NaNpx" ||
      node.style.gap === "undefinedpx" ||
      isNaN(parseInt(node.style.gap));

    // Set initial gap to 0px if it's invalid or missing
    if (hasInvalidGap) {
      console.log("Initializing gap to 0px");
      setNodeStyle({ gap: "0px" }, [node.id], false);
    }

    const sessionId = startRecording();

    const startX = e.clientX;
    const startY = e.clientY;

    // Parse gap from computed style to ensure we get a number
    let computedGap = getComputedStyle(elementRef.current!).gap;
    let currentGap = 0;

    // Handle different gap formats (can be "10px 10px" or just "10px")
    if (computedGap) {
      if (computedGap.includes(" ")) {
        // For gap with multiple values, take the first one
        currentGap = parseInt(computedGap.split(" ")[0] || "0");
      } else {
        currentGap = parseInt(computedGap || "0");
      }
    }

    // Fallback to 0 if parsing failed
    if (isNaN(currentGap)) {
      currentGap = 0;
    }

    const isHorizontal =
      getComputedStyle(elementRef.current!).flexDirection === "row";

    visualOps.updateStyleHelper({
      type: "gap",
      position: { x: e.clientX, y: e.clientY },
      value: currentGap,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      setIsAdjustingGap(true);

      const deltaX = (moveEvent.clientX - startX) / transform.scale;
      const deltaY = (moveEvent.clientY - startY) / transform.scale;
      const delta = isHorizontal ? deltaX : deltaY;
      const newGap = Math.max(0, currentGap + delta);

      visualOps.updateStyleHelper({
        type: "gap",
        position: { x: moveEvent.clientX, y: moveEvent.clientY },
        value: newGap,
      });

      setNodeStyle({ gap: `${Math.round(newGap)}px` }, [node.id], false);
    };

    const handleMouseUp = () => {
      dragDisp.hideStyleHelper();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setIsAdjustingGap(false);
      stopRecording(sessionId);
      window.dispatchEvent(new Event("resize"));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (
    !elementRef.current ||
    !isSelected ||
    isMovingCanvas ||
    isResizing ||
    transform.scale < 0.2
  )
    return null;
  if (node.type !== "frame") return null;

  // Check if this node or any of its parents have rotation
  if (hasRotation(node, nodeState.nodes)) return null;

  const frameElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!frameElement) return null;

  const computedStyle = window.getComputedStyle(frameElement);

  // Check if flex-wrap is set to "wrap" - if so, don't display handles
  const flexWrap = computedStyle.flexWrap;
  if (flexWrap === "wrap") return null;

  const isColumn = computedStyle.flexDirection === "column";

  const frameChildren = nodeState.nodes
    .filter((child) => child.parentId === node.id)
    .map((childNode) => {
      const el = document.querySelector(
        `[data-node-id="${childNode.id}"]`
      ) as HTMLElement | null;
      return el ? { id: childNode.id, rect: el.getBoundingClientRect() } : null;
    })
    .filter((x): x is { id: string; rect: DOMRect } => !!x);

  if (frameChildren.length < 2) return null;

  const frameRect = frameElement.getBoundingClientRect();
  const gapElements = [];

  for (let i = 0; i < frameChildren.length - 1; i++) {
    const firstElement = frameChildren[i];
    const secondElement = frameChildren[i + 1];

    if (isColumn) {
      const firstElementBottomEdge = firstElement.rect.bottom;
      const secondElementTopEdge = secondElement.rect.top;
      const gapHeight = secondElementTopEdge - firstElementBottomEdge;
      const centerY = (firstElementBottomEdge + secondElementTopEdge) / 2;
      const relativeTop =
        (firstElementBottomEdge - frameRect.top) / transform.scale;
      const gapHeightScaled = gapHeight / transform.scale;

      gapElements.push(
        <div
          key={`gap-bg-${firstElement.id}-${secondElement.id}`}
          className="absolute pointer-events-none transition-opacity duration-150"
          style={{
            top: `${relativeTop}px`,
            left: 0,
            width: "100%",
            height: `${gapHeightScaled}px`,
            backgroundColor: "rgba(244, 114, 182, 0.1)",
            opacity: hoveredGapIndex === i ? 1 : 0,
            pointerEvents: "none",
          }}
        />
      );

      gapElements.push(
        <div
          key={`gap-handle-${firstElement.id}-${secondElement.id}`}
          className="w-10 h-2 bg-pink-400 absolute rounded-t-full rounded-b-full cursor-row-resize pointer-events-auto"
          style={{
            transform: "translateY(-50%)",
            top: `${(centerY - frameRect.top) / transform.scale}px`,
            left: "50%",
            marginLeft: "-20px",
            zIndex: 1,
            pointerEvents: isInteractive ? "auto" : "none",
          }}
          onMouseDown={startAdjustingGap}
          onMouseEnter={() => setHoveredGapIndex(i)}
          onMouseLeave={() => setHoveredGapIndex(null)}
        />
      );
    } else {
      const firstElementRightEdge = firstElement.rect.right;
      const secondElementLeftEdge = secondElement.rect.left;
      const gapWidth = secondElementLeftEdge - firstElementRightEdge;
      const centerX = (firstElementRightEdge + secondElementLeftEdge) / 2;
      const relativeLeft =
        (firstElementRightEdge - frameRect.left) / transform.scale;
      const gapWidthScaled = gapWidth / transform.scale;

      gapElements.push(
        <div
          key={`gap-bg-${firstElement.id}-${secondElement.id}`}
          className="absolute pointer-events-none transition-opacity duration-150"
          style={{
            left: `${relativeLeft}px`,
            top: 0,
            width: `${gapWidthScaled}px`,
            height: "100%",
            backgroundColor: "rgba(244, 114, 182, 0.1)",
            zIndex: 2,
            opacity: hoveredGapIndex === i ? 1 : 0,
            pointerEvents: "none",
          }}
        />
      );

      gapElements.push(
        <div
          key={`gap-handle-${firstElement.id}-${secondElement.id}`}
          className="h-10 w-2 bg-pink-400 absolute rounded-t-full rounded-b-full cursor-col-resize pointer-events-auto"
          style={{
            transform: "translateX(-50%)",
            left: `${(centerX - frameRect.left) / transform.scale}px`,
            top: "50%",
            marginTop: "-20px",
            zIndex: 1,
            pointerEvents: isInteractive ? "auto" : "none",
          }}
          onMouseDown={startAdjustingGap}
          onMouseEnter={() => setHoveredGapIndex(i)}
          onMouseLeave={() => setHoveredGapIndex(null)}
        />
      );
    }
  }

  return <>{gapElements}</>;
};
