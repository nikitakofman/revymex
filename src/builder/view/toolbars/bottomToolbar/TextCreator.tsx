import React, { useState, useEffect, useRef } from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { nanoid } from "nanoid";
import {
  computeFrameDropIndicator,
  handleMediaToFrameTransformation,
} from "@/builder/context/utils";
import { visualOps } from "@/builder/context/atoms/visual-store";
import {
  canvasOps,
  useGetIsAdjustingBorderRadius,
  useGetIsAdjustingGap,
  useGetIsResizing,
  useGetIsRotating,
  useIsTextModeActive,
  useGetTransform,
} from "@/builder/context/atoms/canvas-interaction-store";
import { useGetDynamicModeNodeId } from "@/builder/context/atoms/drag-store";
import { useGetActiveViewportInDynamicMode } from "@/builder/context/atoms/dynamic-store";

// Import the new store operations
import {
  NodeId,
  getCurrentNodes,
  useGetAllNodes,
  useGetNodeParent,
  batchNodeUpdates,
  nodeStore,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
  nodeParentAtom,
} from "@/builder/context/atoms/node-store";

import {
  addNode,
  moveNode,
  insertAtIndex,
} from "@/builder/context/atoms/node-store/operations/insert-operations";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { updateNodeFlags } from "@/builder/context/atoms/node-store/operations/update-operations";
import { syncViewports } from "@/builder/context/atoms/node-store/operations/sync-operations";
import {
  hierarchyStore,
  childrenMapAtom,
  parentMapAtom,
} from "@/builder/context/atoms/node-store/hierarchy-store";

interface DrawingBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDrawing: boolean;
}

export const TextCreator: React.FC = () => {
  const { containerRef } = useBuilderRefs();
  const [box, setBox] = useState<DrawingBoxState | null>(null);
  const targetFrameRef = useRef<{ id: string; element: Element } | null>(null);

  // Use subscription hook for text mode as it affects rendering
  const isTextModeActive = useIsTextModeActive();

  // Use getters for transform and other states that are used in event handlers
  const getTransform = useGetTransform();
  const getIsResizing = useGetIsResizing();
  const getIsAdjustingGap = useGetIsAdjustingGap();
  const getIsRotating = useGetIsRotating();
  const getIsAdjustingBorderRadius = useGetIsAdjustingBorderRadius();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();
  const getActiveViewportInDynamicMode = useGetActiveViewportInDynamicMode();

  // New hooks
  const getAllNodes = useGetAllNodes();
  const getNodeParent = useGetNodeParent();

  // Check if we can enable text creation mode
  const canCreateText = () => {
    return (
      !getIsResizing() &&
      !getIsAdjustingGap() &&
      !getIsRotating() &&
      !getIsAdjustingBorderRadius()
    );
  };

  // Function to add a new node to the store
  const addNewNode = (node) => {
    batchNodeUpdates(() => {
      // Add node ID to the store
      nodeStore.set(nodeIdsAtom, (prev) => [...prev, node.id]);

      // Set basic properties
      nodeStore.set(nodeBasicsAtom(node.id), {
        id: node.id,
        type: node.type,
        customName: node.customName,
      });

      // Set style
      nodeStore.set(nodeStyleAtom(node.id), node.style || {});

      // Set flags
      nodeStore.set(nodeFlagsAtom(node.id), {
        isLocked: node.isLocked,
        inViewport: node.inViewport !== false,
        isViewport: node.isViewport,
        viewportName: node.viewportName,
        viewportWidth: node.viewportWidth,
        isDynamic: node.isDynamic,
        isAbsoluteInFrame: node.isAbsoluteInFrame,
        isVariant: node.isVariant,
      });

      // Set shared info
      if (node.sharedId) {
        nodeStore.set(nodeSharedInfoAtom(node.id), { sharedId: node.sharedId });
      }

      // Set dynamic info
      if (node.dynamicParentId || node.dynamicViewportId) {
        nodeStore.set(nodeDynamicInfoAtom(node.id), {
          dynamicParentId: node.dynamicParentId,
          dynamicViewportId: node.dynamicViewportId,
          dynamicPosition: node.dynamicPosition,
        });
      }

      // Add to parent-child relationship
      if (node.position === "inside" && node.targetId) {
        addNode(node.id, node.targetId);
      } else if (node.position && node.targetId) {
        const targetId = node.targetId;
        const siblings =
          hierarchyStore.get(childrenMapAtom).get(getNodeParent(targetId)) ||
          [];
        const targetIndex = siblings.indexOf(targetId);
        const insertIndex =
          node.position === "after" ? targetIndex + 1 : targetIndex;

        insertAtIndex(node.id, getNodeParent(targetId), insertIndex);
      } else {
        // Add to root if no position specified
        addNode(node.id, null);
      }
    });

    return node.id;
  };

  // Function to handle media to frame transformation
  const handleMediaToFrameTransformationStore = (mediaNode, textNode) => {
    // Create a new frame
    const frameId = nanoid();
    const frameNode = {
      id: frameId,
      type: "frame",
      style: {
        position: mediaNode.style.position,
        left: mediaNode.style.left,
        top: mediaNode.style.top,
        width: mediaNode.style.width,
        height: mediaNode.style.height,
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      inViewport: mediaNode.inViewport,
      sharedId: nanoid(),
      dynamicParentId: mediaNode.dynamicParentId,
      dynamicViewportId: mediaNode.dynamicViewportId,
      position: null,
      targetId: getNodeParent(mediaNode.id),
    };

    // Add the frame node
    addNewNode(frameNode);

    // Update media node style for frame
    updateNodeStyle(mediaNode.id, {
      position: "relative",
      left: "",
      top: "",
      zIndex: "",
    });

    // Move media to frame
    moveNode(mediaNode.id, frameId);

    // Add text node as sibling to media
    addNewNode({
      ...textNode,
      position: "inside",
      targetId: frameId,
    });

    return true;
  };

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const findTargetFrame = (e: MouseEvent) => {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elementsUnder) {
        const frameEl = el.closest('[data-node-type="frame"]');
        if (frameEl && !frameEl.closest(".viewport-header")) {
          const frameId = frameEl.getAttribute("data-node-id");
          if (frameId) {
            const allNodes = getAllNodes();
            const node = allNodes.find((n) => n.id === frameId);
            if (node) {
              return { id: frameId, element: frameEl };
            }
          }
        }
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Early return if not in text mode
      if (!isTextModeActive) return;

      // Early return if we can't create text
      if (!canCreateText()) return;

      targetFrameRef.current = findTargetFrame(e);

      const rect = canvas.getBoundingClientRect();
      setBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
        isDrawing: true,
      });

      // Initialize style helper
      visualOps.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width: 0,
          height: 0,
          unit: "px",
        },
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      // Get current transform for calculations
      const transform = getTransform();

      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setBox((prev) => ({
        ...prev!,
        currentX: newX,
        currentY: newY,
      }));

      // Calculate real dimensions in pixels
      const width = Math.abs(newX - box.startX) / transform.scale;
      const height = Math.abs(newY - box.startY) / transform.scale;

      // Calculate font size (same logic as when creating the text node)
      const calculatedFontSize = Math.max(
        12,
        Math.min(1000, Math.floor(height * 0.7))
      );

      // Update style helper with current dimensions and font size
      visualOps.updateStyleHelper({
        type: "dimensions",
        position: { x: e.clientX, y: e.clientY },
        dimensions: {
          width,
          height,
          unit: "px",
          fontSize: calculatedFontSize,
        },
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!box?.isDrawing) return;

      const dynamicModeNodeId = getDynamicModeNodeId();
      const activeViewportInDynamicMode = getActiveViewportInDynamicMode();

      const transform = getTransform();
      const rect = canvas.getBoundingClientRect();
      const finalX = e.clientX - rect.left;
      const finalY = e.clientY - rect.top;

      // Calculate dimensions
      const left = Math.min(box.startX, finalX);
      const top = Math.min(box.startY, finalY);
      const width = Math.abs(finalX - box.startX);
      const height = Math.abs(finalY - box.startY);

      // Check if we're in dynamic mode
      const inDynamicMode = !!dynamicModeNodeId;
      const dynamicParentId = dynamicModeNodeId;

      if (width > 5 && height > 5) {
        const canvasX = (left - transform.x) / transform.scale;
        const canvasY = (top - transform.y) / transform.scale;

        // Check if we're inside a frame
        const targetFrame = targetFrameRef.current;

        // Check if we're drawing over a media element (image/video)
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        let mediaElement = null;
        const allNodes = getAllNodes();

        for (const el of elementsUnder) {
          const mediaEl = el.closest(
            '[data-node-type="image"], [data-node-type="video"]'
          );
          if (mediaEl) {
            const mediaId = mediaEl.getAttribute("data-node-id");
            if (mediaId) {
              const mediaNode = allNodes.find((n) => n.id === mediaId);
              if (mediaNode) {
                mediaElement = { node: mediaNode, element: mediaEl };
                break;
              }
            }
          }
        }

        // Calculate font size based on height (using about 70% of height as a reasonable font size)
        const scaledHeight = height / transform.scale;
        const calculatedFontSize = Math.max(
          12,
          Math.min(1000, Math.floor(scaledHeight * 0.7))
        );

        // Create text with font size in a span element instead of on the paragraph
        const defaultText = `<p class="text-inherit" style="text-align: center"><span style="color: #000000; font-size: ${calculatedFontSize}px">Text</span></p>`;

        let newNodeId: string;

        // If drawing on a media element, transform it to a frame first
        if (mediaElement) {
          // Create a new text node to add inside the frame
          const newText = {
            id: nanoid(),
            type: "text",
            style: {
              position: "relative",
              width: `auto`,
              height: `auto`,
              flex: "0 0 auto",
              text: defaultText,
            },
            inViewport: mediaElement.node.inViewport || false,
            // If in dynamic mode, add the dynamic parent ID
            ...(inDynamicMode && { dynamicParentId }),
            ...(inDynamicMode && {
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          newNodeId = newText.id;

          // Use the store-based transformation
          handleMediaToFrameTransformationStore(mediaElement.node, newText);
        } else if (targetFrame) {
          // Drawing over a frame - insert text as child
          const frameChildren = allNodes
            .filter((n) => n.parentId === targetFrame.id)
            .map((node) => {
              const el = document.querySelector(`[data-node-id="${node.id}"]`);
              return el
                ? { id: node.id, rect: el.getBoundingClientRect() }
                : null;
            })
            .filter(
              (item): item is { id: string | number; rect: DOMRect } =>
                item !== null
            );

          const newText = {
            id: nanoid(),
            type: "text",
            style: {
              position: "relative",
              width: `auto`,
              height: `auto`,
              flex: "0 0 auto",
              text: defaultText,
            },
            inViewport: true,
            // If in dynamic mode, add the dynamic parent ID
            ...(inDynamicMode && { dynamicParentId }),
            ...(inDynamicMode && {
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          newNodeId = newText.id;

          const dropIndicator = computeFrameDropIndicator(
            targetFrame.element,
            frameChildren,
            e.clientX,
            e.clientY
          );

          if (dropIndicator?.dropInfo) {
            // Add to specific position
            addNewNode({
              ...newText,
              position: dropIndicator.dropInfo.position,
              targetId: dropIndicator.dropInfo.targetId,
            });
          } else {
            // Add as child of target frame
            addNewNode({
              ...newText,
              position: "inside",
              targetId: targetFrame.id,
            });
          }
        } else {
          // Drawing on canvas - create absolute positioned text
          const newText = {
            id: nanoid(),
            type: "text",
            style: {
              position: "absolute",
              left: `${canvasX}px`,
              top: `${canvasY}px`,
              width: `${width / transform.scale}px`,
              height: `${height / transform.scale}px`,
              text: defaultText,
            },
            inViewport: false,
            // If in dynamic mode, add both the dynamic parent ID and dynamicPosition
            ...(inDynamicMode && {
              dynamicParentId,
              dynamicPosition: { x: canvasX, y: canvasY },
              dynamicViewportId: activeViewportInDynamicMode,
            }),
          };

          newNodeId = newText.id;

          // Add to root
          addNewNode({
            ...newText,
            position: null,
            targetId: null,
          });
        }

        // Additional text styling options based on dimensions
        if (width / transform.scale > 500) {
          // For wider text boxes, center align text
          setTimeout(() => {
            updateNodeStyle(newNodeId, {
              text: `<p class="text-inherit" style="text-align: center"><span style="color: #000000; font-size: ${calculatedFontSize}px">Text</span></p>`,
            });
          }, 0);
        }
      }

      if (!dynamicModeNodeId) {
        // Only sync viewports if we're NOT in dynamic mode
        syncViewports(null, null);
      }

      // Hide the style helper
      visualOps.hideStyleHelper();

      // Reset state
      setBox(null);
      targetFrameRef.current = null;

      // Use canvasOps instead of setIsTextModeActive
      canvasOps.setIsTextModeActive(false);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Make sure to hide the style helper when unmounting
      visualOps.hideStyleHelper();
    };
  }, [
    containerRef,
    box?.isDrawing,
    isTextModeActive,
    box?.startX,
    box?.startY,
    getDynamicModeNodeId,
    getActiveViewportInDynamicMode,
    getAllNodes,
    getNodeParent,
  ]);

  // Early return if not drawing
  if (!box?.isDrawing) return null;

  const left = Math.min(box.startX, box.currentX);
  const top = Math.min(box.startY, box.currentY);
  const width = Math.abs(box.currentX - box.startX);
  const height = Math.abs(box.currentY - box.startY);

  return (
    <div
      className="absolute pointer-events-none border border-blue-500 bg-blue-500/10"
      style={{
        left,
        top,
        width,
        height,
        zIndex: 1000,
        userSelect: "none",
      }}
    />
  );
};

export default TextCreator;
