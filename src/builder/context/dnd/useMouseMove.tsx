import { useBuilder } from "@/builder/context/builderState";
import {
  getDropPosition,
  computeFrameDropIndicator,
  computeSiblingReorderResult,
  getFilteredElementsUnderMouseDuringDrag,
  getCalibrationAdjustedPosition,
} from "./utils";
import { useEffect, useRef } from "react";
import { EDGE_SIZE, useAutoScroll } from "../hooks/useAutoScroll";

export const useMouseMove = () => {
  const {
    dragState,
    transform,
    contentRef,
    nodeDisp,
    dragDisp,
    nodeState,
    containerRef,
  } = useBuilder();

  const { startAutoScroll, updateScrollPosition, stopAutoScroll } =
    useAutoScroll();
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const originalIndexRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  return (e: MouseEvent) => {
    e.preventDefault();

    if (
      !dragState.isDragging ||
      !dragState.draggedNode ||
      !contentRef.current ||
      !containerRef.current
    ) {
      if (isAutoScrollingRef.current) {
        stopAutoScroll();
        isAutoScrollingRef.current = false;
      }
      return;
    }

    const draggedNode = dragState.draggedNode.node;

    const containerRect = containerRef.current.getBoundingClientRect();

    const rect = document
      .querySelector(`[data-node-dragged]`)
      ?.getBoundingClientRect();

    let finalX;
    let finalY;
    if (rect) {
      finalX =
        (rect!.left - containerRect.left - transform.x) / transform.scale;
      finalY = (rect!.top - containerRect.top - transform.y) / transform.scale;

      const adjustedPosition = getCalibrationAdjustedPosition(
        { x: finalX, y: finalY },
        draggedNode.style.rotate,
        transform
      );

      finalX = Math.round(adjustedPosition.x);
      finalY = Math.round(adjustedPosition.y);

      dragDisp.setDragPositions(finalX, finalY);
    }

    const isNearEdge =
      e.clientX <= containerRect.left + EDGE_SIZE ||
      e.clientX >= containerRect.right - EDGE_SIZE ||
      e.clientY <= containerRect.top + EDGE_SIZE ||
      e.clientY >= containerRect.bottom - EDGE_SIZE;

    if (isNearEdge) {
      if (!isAutoScrollingRef.current) {
        startAutoScroll(e.clientX, e.clientY, containerRef.current);
        isAutoScrollingRef.current = true;
      } else {
        updateScrollPosition(e.clientX, e.clientY);
      }
    } else if (isAutoScrollingRef.current) {
      stopAutoScroll();
      isAutoScrollingRef.current = false;
    }

    const canvasX =
      (e.clientX - containerRect.left - transform.x) / transform.scale;
    const canvasY =
      (e.clientY - containerRect.top - transform.y) / transform.scale;

    if (dragState.dragSource === "gripHandle") {
      const draggedElement = document.querySelector(
        `[data-node-id="${draggedNode.id}"]`
      ) as HTMLElement | null;

      if (!draggedElement) return;

      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );

      if (parentElement) {
        const reorderResult = computeSiblingReorderResult(
          draggedNode,
          nodeState.nodes,
          parentElement,
          e.clientX,
          e.clientY,
          prevMousePosRef.current.x,
          prevMousePosRef.current.y
        );
        if (reorderResult) {
          if (dragState.placeholderInfo) {
            // Get all nodes and placeholders info
            const allDraggedNodes = [
              {
                nodeId: draggedNode.id,
                placeholderId: dragState.placeholderInfo.mainPlaceholderId,
              },
              ...dragState.placeholderInfo.additionalPlaceholders,
            ];

            // Sort based on the original stored order
            const sortedNodes = allDraggedNodes.sort((a, b) => {
              const orderA = dragState.placeholderInfo!.nodeOrder.indexOf(
                a.nodeId
              );
              const orderB = dragState.placeholderInfo!.nodeOrder.indexOf(
                b.nodeId
              );
              return orderA - orderB;
            });

            console.log("REORDER - Current State:", {
              placeholderInfo: dragState.placeholderInfo,
              originalOrder: dragState.placeholderInfo.nodeOrder,
              reorderTarget: reorderResult.targetId,
              position: reorderResult.position,
            });

            // First move the first placeholder to establish the group position
            nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
              targetId: reorderResult.targetId,
              position: reorderResult.position,
            });

            // Then move each subsequent placeholder after the previous one
            for (let i = 1; i < sortedNodes.length; i++) {
              nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
                targetId: sortedNodes[i - 1].placeholderId,
                position: "after",
              });
            }

            console.log("REORDER - After Sort:", {
              sortedNodes,
              moveSequence: sortedNodes.map((n) => n.nodeId),
            });
          } else {
            // Single node case
            const placeholder = nodeState.nodes.find(
              (n) => n.type === "placeholder"
            );
            if (placeholder) {
              nodeDisp.moveNode(placeholder.id, true, {
                targetId: reorderResult.targetId,
                position: reorderResult.position,
              });
            }
          }
        }
      }

      dragDisp.setDropInfo(
        dragState.dropInfo.targetId,
        dragState.dropInfo.position,
        canvasX,
        canvasY
      );
      return;
    }

    if (dragState.draggedItem) {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);

      // Check for both frames and images as potential drop targets
      const dropTargetElement = elementsUnder.find(
        (el) =>
          el.getAttribute("data-node-type") === "frame" ||
          el.getAttribute("data-node-type") === "image" ||
          el.getAttribute("data-node-type") === "video"
      );

      if (dropTargetElement) {
        const targetId = dropTargetElement.getAttribute("data-node-id")!;
        const targetNode = nodeState.nodes.find(
          (n) => String(n.id) === targetId
        );
        const nodeType = dropTargetElement.getAttribute("data-node-type");

        if (targetNode?.isDynamic && !dragState.dynamicModeNodeId) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          return;
        }

        if (!targetNode) {
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // If it's an image, always set position to "inside" when hovering near center
        if (nodeType === "image" || nodeType === "video") {
          const rect = dropTargetElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
          );
          const threshold = Math.min(rect.width, rect.height) * 0.4;

          if (distanceFromCenter < threshold) {
            dragDisp.setDropInfo(targetId, "inside", canvasX, canvasY);
            dragDisp.hideLineIndicator();
          } else {
            const { position, lineIndicator } = getDropPosition(
              e.clientY,
              rect,
              nodeType
            );
            if (position !== "inside") {
              dragDisp.setLineIndicator(lineIndicator);
            }
            dragDisp.setDropInfo(targetId, position, canvasX, canvasY);
          }
          prevMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Existing frame handling logic
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === targetId
        );
        const childRects = frameChildren
          .map((childNode) => {
            const el = document.querySelector(
              `[data-node-id="${childNode.id}"]`
            ) as HTMLElement | null;
            return el
              ? { id: childNode.id, rect: el.getBoundingClientRect() }
              : null;
          })
          .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

        const result = computeFrameDropIndicator(
          dropTargetElement,
          childRects,
          e.clientX,
          e.clientY
        );

        if (result) {
          dragDisp.setDropInfo(
            result.dropInfo.targetId,
            result.dropInfo.position,
            canvasX,
            canvasY
          );
          if (result.lineIndicator.show) {
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.hideLineIndicator();
          }
        }

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      } else {
        dragDisp.hideLineIndicator();
        dragDisp.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    const overCanvas = getFilteredElementsUnderMouseDuringDrag(
      e,
      draggedNode.id,
      "canvas"
    );
    const draggedElement = document.querySelector(
      `[data-node-id="${draggedNode.id}"]`
    ) as HTMLElement | null;
    if (!draggedElement) return;

    const isReorderingNode =
      dragState.dragSource === "viewport" &&
      (draggedNode.inViewport || originalIndexRef.current !== null);

    if (isReorderingNode) {
      const parentElement = document.querySelector(
        `[data-node-id="${draggedNode.parentId}"]`
      );

      if (!parentElement) return;

      const reorderResult = computeSiblingReorderResult(
        draggedNode,
        nodeState.nodes,
        parentElement,
        e.clientX,
        e.clientY,
        prevMousePosRef.current.x,
        prevMousePosRef.current.y
      );

      if (reorderResult) {
        if (dragState.placeholderInfo) {
          // Get all nodes and placeholders info
          const allDraggedNodes = [
            {
              nodeId: draggedNode.id,
              placeholderId: dragState.placeholderInfo.mainPlaceholderId,
            },
            ...dragState.placeholderInfo.additionalPlaceholders,
          ];

          // Sort based on the original stored order
          const sortedNodes = allDraggedNodes.sort((a, b) => {
            const orderA = dragState.placeholderInfo!.nodeOrder.indexOf(
              a.nodeId
            );
            const orderB = dragState.placeholderInfo!.nodeOrder.indexOf(
              b.nodeId
            );
            return orderA - orderB;
          });

          console.log("REORDER - Current State:", {
            placeholderInfo: dragState.placeholderInfo,
            originalOrder: dragState.placeholderInfo.nodeOrder,
            reorderTarget: reorderResult.targetId,
            position: reorderResult.position,
          });

          // First move the first placeholder to establish the group position
          nodeDisp.moveNode(sortedNodes[0].placeholderId, true, {
            targetId: reorderResult.targetId,
            position: reorderResult.position,
          });

          // Then move each subsequent placeholder after the previous one
          for (let i = 1; i < sortedNodes.length; i++) {
            nodeDisp.moveNode(sortedNodes[i].placeholderId, true, {
              targetId: sortedNodes[i - 1].placeholderId,
              position: "after",
            });
          }

          console.log("REORDER - After Sort:", {
            sortedNodes,
            moveSequence: sortedNodes.map((n) => n.nodeId),
          });
        } else {
          // Single node case
          const placeholder = nodeState.nodes.find(
            (n) => n.type === "placeholder"
          );
          if (placeholder) {
            nodeDisp.moveNode(placeholder.id, true, {
              targetId: reorderResult.targetId,
              position: reorderResult.position,
            });
          }
        }
      }
      dragDisp.hideLineIndicator();
    } else {
      dragDisp.hideLineIndicator();
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const filteredElements = elementsUnder.filter((el) => {
        const closestNode = el.closest(`[data-node-id="${draggedNode.id}"]`);
        return !closestNode;
      });

      const frameElement = filteredElements.find(
        (el) => el.getAttribute("data-node-type") === "frame"
      );

      if (frameElement) {
        if (draggedNode.isViewport) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          dragDisp.hideLineIndicator();
          return;
        }

        const frameId = frameElement.getAttribute("data-node-id")!;
        const frameChildren = nodeState.nodes.filter(
          (child) => child.parentId === frameId
        );
        const frameNode = nodeState.nodes.find((n) => n.id === frameId);

        if (frameNode?.isDynamic && !dragState.dynamicModeNodeId) {
          dragDisp.setDropInfo(null, null, canvasX, canvasY);
          dragDisp.hideLineIndicator();
          return;
        }

        const hasChildren = frameChildren.length > 0;
        if (hasChildren) {
          const childRects = frameChildren
            .map((childNode) => {
              const el = document.querySelector(
                `[data-node-id="${childNode.id}"]`
              ) as HTMLElement | null;
              return el
                ? { id: childNode.id, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter((x): x is { id: string | number; rect: DOMRect } => !!x);

          const result = computeFrameDropIndicator(
            frameElement,
            childRects,
            e.clientX,
            e.clientY
          );

          if (result && result.lineIndicator.show) {
            dragDisp.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            dragDisp.setLineIndicator(result.lineIndicator);
          } else {
            dragDisp.setDropInfo(null, null, canvasX, canvasY);
            dragDisp.hideLineIndicator();
          }
        } else {
          const result = computeFrameDropIndicator(
            frameElement,
            [],
            e.clientX,
            e.clientY
          );

          if (result) {
            dragDisp.setDropInfo(
              result.dropInfo.targetId,
              result.dropInfo.position,
              canvasX,
              canvasY
            );
            dragDisp.hideLineIndicator();
          }
        }

        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const siblingElement = filteredElements.find((el) => {
        if (!el.hasAttribute("data-node-id")) return false;
        return el.getAttribute("data-node-type") !== "placeholder";
      });

      if (siblingElement) {
        const siblingId = siblingElement.getAttribute("data-node-id")!;
        const nodeType = siblingElement.getAttribute("data-node-type");
        const rect = siblingElement.getBoundingClientRect();

        const { position, lineIndicator } = getDropPosition(
          e.clientY,
          rect,
          nodeType
        );

        if (position !== "inside") {
          dragDisp.setLineIndicator(lineIndicator);
        }
        dragDisp.setDropInfo(siblingId, position, canvasX, canvasY);
      } else {
        dragDisp.setDropInfo(null, null, canvasX, canvasY);
      }
    }

    if (overCanvas) {
      dragDisp.setIsOverCanvas(true);

      // TODO: WHEN I DRAG FROM FRAME/VIEWPORT TO CANVAS IF MULTI SELECT ITS ONLY REMOVING THE MAIN ANCHOR NODE NOT THE OTHER ONES, I HAVE TO DO ANY ACTION ON THE OTHER NODES AFTER DROPPING FOR IT TO BE SYNCED AND REMOVE THE OTHER NODES FROM VIEWPORT

      const placeholder = nodeState.nodes.find((n) => n.type === "placeholder");
      if (placeholder && isReorderingNode) {
        if (originalIndexRef.current === null) {
          originalIndexRef.current = nodeState.nodes.findIndex(
            (n) => n.type === "placeholder"
          );
        }
        nodeDisp.removeNode(placeholder.id);
      }

      nodeDisp.moveNode(draggedNode.id, false);
      dragDisp.hideLineIndicator();

      dragDisp.setDropInfo(null, null, canvasX, canvasY);

      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (
        !dragState.dynamicModeNodeId &&
        (!draggedNode.isDynamic || draggedNode.inViewport)
      ) {
        nodeDisp.syncViewports();
      }
      return;
    }

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };
};
