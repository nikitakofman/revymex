import React, { useRef, useCallback, RefObject } from "react";

import { useBuilder } from "@/builder/context/builderState";
import { Direction, ResizableWrapperProps } from "../utils";
import { VisualHelpers } from "./VisualHelpers";

const SHIFT_INCREMENT = 100;

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  node,
  children,
  minWidth = 50,
  minHeight = 50,
}) => {
  const {
    nodeDisp,
    dragState,
    transform,
    setNodeStyle,
    dragDisp,
    setIsResizing,
    startRecording,
    stopRecording,
  } = useBuilder();

  const elementRef = useRef<HTMLDivElement | null>(
    null
  ) as RefObject<HTMLDivElement>;
  const isSelected = dragState.selectedIds.includes(node.id);
  const aspectRatioRef = useRef<{
    ratio: number;
    primaryAxis: "x" | "y" | null;
  }>({ ratio: 1, primaryAxis: null });

  const initialSizesRef = useRef<
    Record<string, { width: number; height: number; x: number; y: number }>
  >({});

  const handleResizeStart = useCallback(
    (
      e: React.PointerEvent,
      direction: Direction,
      isDirectBorderResize = false
    ) => {
      if (!elementRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const sessionId = startRecording();
      const selectedNodes =
        dragState.selectedIds.length > 0 ? dragState.selectedIds : [node.id];

      selectedNodes.forEach((nodeId) => {
        const el = document.querySelector(
          `[data-node-id="${nodeId}"]`
        ) as HTMLElement;
        if (el) {
          const computed = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          initialSizesRef.current[nodeId] = {
            width: parseFloat(computed.width),
            height: parseFloat(computed.height),
            x: rect.left,
            y: rect.top,
          };
        }
      });

      const computedStyle = window.getComputedStyle(elementRef.current);
      const parentElement = elementRef.current.parentElement;
      const widthStyle = elementRef.current.style.width;
      const heightStyle = elementRef.current.style.height;
      const isWidthPercent = widthStyle.includes("%");
      const isHeightPercent = heightStyle.includes("%");
      const isWidthAuto = widthStyle === "auto";
      const isHeightAuto = heightStyle === "auto";

      const startWidth = parseFloat(computedStyle.width);
      const startHeight = parseFloat(computedStyle.height);
      aspectRatioRef.current = {
        ratio: startWidth / startHeight,
        primaryAxis: null,
      };

      const parentWidth = parentElement ? parentElement.clientWidth : 0;
      const parentHeight = parentElement ? parentElement.clientHeight : 0;

      const startX = e.clientX;
      const startY = e.clientY;

      setIsResizing(true);

      dragDisp.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width: isWidthPercent ? (startWidth / parentWidth) * 100 : startWidth,
          height: isHeightPercent
            ? (startHeight / parentHeight) * 100
            : startHeight,
          unit: isWidthPercent ? "%" : "px",
          widthUnit: isWidthPercent ? "%" : "px",
          heightUnit: isHeightPercent ? "%" : "px",
        },
      });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();

        let deltaX = (moveEvent.clientX - startX) / transform.scale;
        let deltaY = (moveEvent.clientY - startY) / transform.scale;

        // Apply increment snapping for direct border resize with shift key
        if (isDirectBorderResize && moveEvent.shiftKey) {
          // For horizontal resize (left/right handles)
          if (direction === "left" || direction === "right") {
            // Calculate raw delta
            const rawDeltaX = deltaX;
            // Round to nearest SHIFT_INCREMENT
            deltaX = Math.round(rawDeltaX / SHIFT_INCREMENT) * SHIFT_INCREMENT;
          }
          // For vertical resize (top/bottom handles)
          else if (direction === "top" || direction === "bottom") {
            // Calculate raw delta
            const rawDeltaY = deltaY;
            // Round to nearest SHIFT_INCREMENT
            deltaY = Math.round(rawDeltaY / SHIFT_INCREMENT) * SHIFT_INCREMENT;
          }
        }

        const isCornerResize = [
          "topLeft",
          "topRight",
          "bottomLeft",
          "bottomRight",
        ].includes(direction);
        const isShiftPressed = moveEvent.shiftKey;

        let mainFinalWidth: number | undefined;
        let mainFinalHeight: number | undefined;

        selectedNodes.forEach((nodeId) => {
          const initial = initialSizesRef.current[nodeId];
          if (!initial) return;

          let newWidth = initial.width;
          let newHeight = initial.height;
          let newX = initial.x;
          let newY = initial.y;
          const ratio = initial.width / initial.height;

          if (
            isCornerResize &&
            isShiftPressed &&
            !isWidthAuto &&
            !isHeightAuto
          ) {
            if (aspectRatioRef.current.primaryAxis === null) {
              aspectRatioRef.current.primaryAxis =
                Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
            }
            if (aspectRatioRef.current.primaryAxis === "x") {
              newWidth = Math.max(
                initial.width +
                  (direction.includes("Right") ? deltaX : -deltaX),
                minWidth
              );
              newHeight = newWidth / ratio;
            } else {
              newHeight = Math.max(
                initial.height +
                  (direction.includes("bottom") ? deltaY : -deltaY),
                minHeight
              );
              newWidth = newHeight * ratio;
            }
            if (direction.includes("Left")) {
              newX += initial.width - newWidth;
            }
            if (direction.includes("top")) {
              newY += initial.height - newHeight;
            }
          } else {
            switch (direction) {
              case "right":
                newWidth = Math.max(initial.width + deltaX, minWidth);
                break;
              case "bottom":
                newHeight = Math.max(initial.height + deltaY, minHeight);
                break;
              case "left":
                newWidth = Math.max(initial.width - deltaX, minWidth);
                if (newWidth !== initial.width) {
                  newX += initial.width - newWidth;
                }
                break;
              case "top":
                newHeight = Math.max(initial.height - deltaY, minHeight);
                if (newHeight !== initial.height) {
                  newY += initial.height - newHeight;
                }
                break;
              case "topRight":
                newWidth = Math.max(initial.width + deltaX, minWidth);
                newHeight = Math.max(initial.height - deltaY, minHeight);
                if (newHeight !== initial.height) {
                  newY += initial.height - newHeight;
                }
                break;
              case "bottomRight":
                newWidth = Math.max(initial.width + deltaX, minWidth);
                newHeight = Math.max(initial.height + deltaY, minHeight);
                break;
              case "bottomLeft":
                newWidth = Math.max(initial.width - deltaX, minWidth);
                newHeight = Math.max(initial.height + deltaY, minHeight);
                if (newWidth !== initial.width) {
                  newX += initial.width - newWidth;
                }
                break;
              case "topLeft":
                newWidth = Math.max(initial.width - deltaX, minWidth);
                newHeight = Math.max(initial.height - deltaY, minHeight);
                if (newWidth !== initial.width) {
                  newX += initial.width - newWidth;
                }
                if (newHeight !== initial.height) {
                  newY += initial.height - newHeight;
                }
                break;
            }
          }

          const finalWidth = isWidthPercent
            ? (newWidth / parentWidth) * 100
            : newWidth;
          const finalHeight = isHeightPercent
            ? (newHeight / parentHeight) * 100
            : newHeight;

          if (nodeId === node.id) {
            mainFinalWidth = finalWidth;
            mainFinalHeight = finalHeight;
          }

          const updatedStyle: Record<string, string> = {};
          if (
            !isWidthAuto &&
            [
              "left",
              "right",
              "topLeft",
              "topRight",
              "bottomLeft",
              "bottomRight",
            ].includes(direction)
          ) {
            updatedStyle.width = `${finalWidth}${isWidthPercent ? "%" : "px"}`;
          }
          if (
            !isHeightAuto &&
            [
              "top",
              "bottom",
              "topLeft",
              "topRight",
              "bottomLeft",
              "bottomRight",
            ].includes(direction)
          ) {
            updatedStyle.height = `${finalHeight}${
              isHeightPercent ? "%" : "px"
            }`;
          }

          setNodeStyle(updatedStyle, [nodeId], true);
          if (newX !== initial.x || newY !== initial.y) {
            nodeDisp.updateNodePosition(nodeId, { x: newX, y: newY });
          }
        });

        if (mainFinalWidth !== undefined && mainFinalHeight !== undefined) {
          dragDisp.updateStyleHelper({
            type: "dimensions",
            position: { x: moveEvent.clientX, y: moveEvent.clientY },
            dimensions: {
              width: mainFinalWidth,
              height: mainFinalHeight,
              unit: isWidthPercent ? "%" : "px",
              widthUnit: isWidthPercent ? "%" : "px",
              heightUnit: isHeightPercent ? "%" : "px",
            },
          });
        }
      };

      const handlePointerUp = () => {
        dragDisp.hideStyleHelper();
        stopRecording(sessionId);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        setIsResizing(false);
        aspectRatioRef.current.primaryAxis = null;

        initialSizesRef.current = {};
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [
      node,
      nodeDisp,
      dragState.selectedIds,
      minWidth,
      minHeight,
      dragDisp,
      setNodeStyle,
      startRecording,
      stopRecording,
      transform.scale,
      setIsResizing,
    ]
  );

  return (
    <>
      {React.cloneElement(children, {
        ref: elementRef,
        style: {
          ...children.props.style,
          pointerEvents: dragState.isSelectionBoxActive ? "none" : "auto",
        },
        children: children.props.children,
      } as React.HTMLAttributes<HTMLElement>)}

      <VisualHelpers
        elementRef={elementRef}
        node={node}
        isSelected={isSelected}
        handleResizeStart={handleResizeStart}
      />
    </>
  );
};
