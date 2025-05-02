import { CSSProperties } from "react";
import {
  useBuilderDynamic,
  useBuilderRefs,
} from "@/builder/context/builderState";
import { calculateAndUpdateDimensions, isAbsoluteInFrame } from "../utils";
import { nanoid } from "nanoid";
import { createPlaceholder } from "./createPlaceholder";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import {
  dragOps,
  useGetDynamicModeNodeId,
  useGetRecordingSessionId,
  useIsDragging,
} from "../atoms/drag-store";
import {
  useGetTransform,
  useIsMiddleMouseDown,
} from "../atoms/canvas-interaction-store";
import {
  NodeId,
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeDynamicInfo,
} from "../atoms/node-store";
import {
  addNode,
  insertAtIndex,
  removeNode,
} from "../atoms/node-store/operations/insert-operations";
import { updateNodeStyle } from "../atoms/node-store/operations/style-operations";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";

export const useDragStart = () => {
  const { startRecording, stopRecording } = useBuilderDynamic();
  const { contentRef, selectedIdsRef } = useBuilderRefs();

  const getTransform = useGetTransform();
  const currentSelectedIds = useGetSelectedIds();
  const isMiddleMouseDown = useIsMiddleMouseDown();
  const getDynamicModeNodeId = useGetDynamicModeNodeId();

  // Get non-reactive getters
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  const getDynamicParentNode = (nodeId: NodeId): NodeId | null => {
    let currentId = nodeId;
    while (true) {
      const parentId = getNodeParent(currentId);
      if (!parentId) break;

      const parentFlags = getNodeFlags(parentId);
      if (parentFlags.isDynamic) return parentId;

      currentId = parentId;
    }
    return null;
  };

  const isDragging = useIsDragging();
  const getRecordingSessionId = useGetRecordingSessionId();

  if (isMiddleMouseDown) return null;

  return (
    e: React.MouseEvent,
    fromToolbarType?: string,
    nodeObj?: { id: NodeId }
  ) => {
    const recordingSessionId = getRecordingSessionId();
    const transform = getTransform();

    // Check if the click is on a resize handle or its parent resize handle container
    if (recordingSessionId && !isDragging) {
      console.warn(
        "Inconsistent state detected: recordingSessionId exists but not dragging. Resetting state."
      );
      stopRecording(recordingSessionId);
      dragOps.resetDragState();

      // Clean up any dangling placeholders
      // Instead of searching through nodeState, use DOM query to find placeholders
      const placeholderElements = document.querySelectorAll(
        '[data-node-type="placeholder"]'
      );
      placeholderElements.forEach((el) => {
        const nodeId = el.getAttribute("data-node-id");
        if (nodeId) removeNode(nodeId);
      });
    }

    const target = e.target as HTMLElement;
    const resizeHandle = target.closest('[data-resize-handle="true"]');
    const borderRadiusHandle = target.closest(
      '[data-border-radius-handle="true"]'
    );
    const selectedNodes = currentSelectedIds();
    selectedIdsRef.current = [...selectedNodes];

    // Store original selection
    const originalSelectedIds = [...selectedNodes];

    // Filter out any selected nodes that are children of other selected nodes
    let selectedIds = [...originalSelectedIds];

    // Create a map of parent-child relationships for quick lookup
    const childParentMap = new Map();

    // Build parent-child relationship map using hierarchy store
    const buildChildParentMap = (nodeId: NodeId) => {
      const children = getNodeChildren(nodeId);
      children.forEach((childId) => {
        childParentMap.set(childId, nodeId);
        buildChildParentMap(childId);
      });
    };

    // Start with root nodes
    const rootNodes = getNodeChildren(null);
    rootNodes.forEach((rootId) => {
      buildChildParentMap(rootId);
    });

    // Only filter out child nodes if there are multiple nodes selected
    if (
      originalSelectedIds.length > 1 &&
      nodeObj &&
      originalSelectedIds.includes(nodeObj.id)
    ) {
      // Find nodes to remove (children whose parents are also selected)
      const nodesToRemove = [];

      originalSelectedIds.forEach((id) => {
        // Check if any parent in the hierarchy is selected
        let currentId = id;
        let parentId = childParentMap.get(currentId);

        while (parentId) {
          if (originalSelectedIds.includes(parentId)) {
            // This node has a parent (or ancestor) that's selected
            nodesToRemove.push(id);
            break;
          }
          // Move up the hierarchy
          currentId = parentId;
          parentId = childParentMap.get(currentId);
        }
      });

      // If we found child nodes to remove from selection, update the selection
      if (nodesToRemove.length > 0) {
        console.log(
          `Filtering out ${nodesToRemove.length} child nodes from dragging:`,
          nodesToRemove
        );

        // Remove child nodes from the selection used for dragging
        selectedIds = selectedIds.filter((id) => !nodesToRemove.includes(id));
      }
    }

    e.preventDefault();
    dragOps.setIsDragging(true);

    const sessionId = startRecording();
    dragOps.setRecordingSessionId(sessionId);

    if (fromToolbarType) {
      const newNodeId = nanoid();

      // Create new node with basic properties using node store atoms
      const newNodeBasics = {
        id: newNodeId,
        type: fromToolbarType,
        customName: undefined,
      };

      const newNodeStyle = {
        width: "150px",
        height: "150px",
        position: "fixed",
        backgroundColor: fromToolbarType === "frame" ? "gray" : undefined,
        flex: "0 0 auto",
      };

      const newNodeFlags = {
        inViewport: true,
      };

      // Add node to hierarchy store with null parent (root node)
      addNode(newNodeId, null);

      // Create dragged node object for drag ops
      const newNode = {
        id: newNodeId,
        type: fromToolbarType,
        style: newNodeStyle,
        inViewport: true,
        parentId: null,
      };

      dragOps.setDraggedNode(newNode, {
        x: e.clientX,
        y: e.clientY,
        mouseX: 0,
        mouseY: 0,
      });
      dragOps.setIsDragging(true);
      dragOps.setDraggedItem(fromToolbarType);
      dragOps.setDragSource("toolbar");
      return;
    }

    if (!nodeObj || !contentRef.current) return;
    const nodeId = nodeObj.id;

    // Get actual node data from atoms store
    const nodeBasics = getNodeBasics(nodeId);
    const nodeStyle = getNodeStyle(nodeId);
    const nodeFlags = getNodeFlags(nodeId);
    const nodeParentId = getNodeParent(nodeId);

    // Construct node object
    const node = {
      id: nodeId,
      type: nodeBasics.type,
      style: nodeStyle,
      parentId: nodeParentId,
      inViewport: nodeFlags.inViewport,
      isAbsoluteInFrame: nodeFlags.isAbsoluteInFrame,
      isDynamic: nodeFlags.isDynamic,
    };

    // Check if node is in the filtered selection
    if (!selectedIds.includes(nodeId) && selectedIds.length > 1) {
      // The clicked node isn't in the filtered selection and we have multiple nodes selected
      // This means it's likely a child of a selected parent

      // Find its top-most selected parent
      let currentId = nodeId;
      let parentId = childParentMap.get(currentId);
      let foundParent = false;
      let parentNode = null;

      while (parentId) {
        if (selectedIds.includes(parentId)) {
          // Use this parent's node data instead
          parentNode = {
            id: parentId,
            type: getNodeBasics(parentId).type,
            style: getNodeStyle(parentId),
            parentId: getNodeParent(parentId),
            inViewport: getNodeFlags(parentId).inViewport,
            isAbsoluteInFrame: getNodeFlags(parentId).isAbsoluteInFrame,
            isDynamic: getNodeFlags(parentId).isDynamic,
          };

          foundParent = true;
          break;
        }
        // Move up the hierarchy
        currentId = parentId;
        parentId = childParentMap.get(currentId);
      }

      // If we found a parent in the selection, use it
      if (foundParent && parentNode) {
        node.id = parentNode.id;
        node.type = parentNode.type;
        node.style = parentNode.style;
        node.parentId = parentNode.parentId;
        node.inViewport = parentNode.inViewport;
        node.isAbsoluteInFrame = parentNode.isAbsoluteInFrame;
        node.isDynamic = parentNode.isDynamic;
      } else {
        // Clear the existing selection and just use this node
        selectedIds = [nodeId];
        selectOps.setSelectedIds([nodeId]);
      }
    }

    // Check if node is absolutely positioned in a frame
    if (isAbsoluteInFrame(node)) {
      dragOps.setDragSource("absolute-in-frame");

      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (!element) return;

      const elementRect = element.getBoundingClientRect();

      // Calculate initial position
      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      // Set up dragging
      dragOps.setDraggedNode(node, {
        x: currentLeft,
        y: currentTop,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });

      dragOps.setIsDragging(true);
      dragOps.setDraggedItem(null);

      // Handle multiple selection for absolute positioned elements
      if (selectedIds.length > 1) {
        const additional = selectedIds
          .filter((id) => id !== node.id)
          .map((id) => {
            // Get node data from atoms
            const otherNodeBasics = getNodeBasics(id);
            const otherNodeStyle = getNodeStyle(id);
            const otherNodeFlags = getNodeFlags(id);
            const otherNodeParent = getNodeParent(id);

            const otherNode = {
              id,
              type: otherNodeBasics.type,
              style: otherNodeStyle,
              parentId: otherNodeParent,
              inViewport: otherNodeFlags.inViewport,
              isAbsoluteInFrame: otherNodeFlags.isAbsoluteInFrame,
            };

            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            const rect = el.getBoundingClientRect();

            // Calculate position for additional node
            const xPos = parseFloat(otherNode.style.left as string) || 0;
            const yPos = parseFloat(otherNode.style.top as string) || 0;

            const mouseOffsetX = (e.clientX - rect.left) / transform.scale;
            const mouseOffsetY = (e.clientY - rect.top) / transform.scale;

            return {
              node: otherNode,
              offset: {
                x: xPos,
                y: yPos,
                mouseX: mouseOffsetX,
                mouseY: mouseOffsetY,
              },
            };
          })
          .filter(Boolean) as Array<{
          node: { id: NodeId; [key: string]: any };
          offset: any;
        }>;

        dragOps.setAdditionalDraggedNodes(additional);
      }

      return;
    }

    const dynamicModeNodeId = getDynamicModeNodeId();

    if (!dynamicModeNodeId) {
      const dynamicParentId = getDynamicParentNode(nodeId);
      if (dynamicParentId && !nodeFlags.isDynamic) {
        // Use the dynamic parent instead
        const dynamicParentBasics = getNodeBasics(dynamicParentId);
        const dynamicParentStyle = getNodeStyle(dynamicParentId);
        const dynamicParentFlags = getNodeFlags(dynamicParentId);
        const dynamicParentParent = getNodeParent(dynamicParentId);

        // Update node to use dynamic parent
        node.id = dynamicParentId;
        node.type = dynamicParentBasics.type;
        node.style = dynamicParentStyle;
        node.parentId = dynamicParentParent;
        node.inViewport = dynamicParentFlags.inViewport;
        node.isAbsoluteInFrame = dynamicParentFlags.isAbsoluteInFrame;
        node.isDynamic = dynamicParentFlags.isDynamic;
      }
    }

    const element = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!element) return;

    const elementRect = element.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    if (node.inViewport) {
      dragOps.setDragSource("viewport");

      // Find index within parent using DOM order instead of nodeState
      const parentElement = element.parentElement;
      let oldIndex = 0;

      if (parentElement) {
        const siblings = Array.from(parentElement.children).filter(
          (el) =>
            el.hasAttribute("data-node-id") &&
            !el.getAttribute("data-node-id")?.includes("placeholder")
        );
        oldIndex = siblings.findIndex(
          (el) => el.getAttribute("data-node-id") === node.id.toString()
        );
        if (oldIndex === -1) oldIndex = 0;
      }

      const htmlElement = element as HTMLElement;

      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element: htmlElement,
        transform,
        // Use updateNodeStyle instead of setNodeStyle
        setNodeStyle: (style, ids) => {
          if (ids && ids.length > 0) {
            ids.forEach((id) => updateNodeStyle(id, style));
          } else {
            updateNodeStyle(node.id, style);
          }
        },
        preventUnsync: true,
      });

      // Create main placeholder
      const mainPlaceholder = createPlaceholder({
        node,
        element: htmlElement,
        transform,
        finalWidth,
        finalHeight,
      });

      const isFillMode = htmlElement.style.flex === "1 0 0px";

      const mainDimensions = {
        width: htmlElement.style.width,
        height: htmlElement.style.height,
        isFillMode: isFillMode,
        finalWidth,
        finalHeight,
      };

      dragOps.setNodeDimensions(node.id, mainDimensions);

      const placeholderInfo = {
        mainPlaceholderId: mainPlaceholder.id,
        // Instead of using selectedIds, get nodes in DOM order
        nodeOrder: selectedIds
          .map((id) => {
            // Find index within parent using DOM
            const el = document.querySelector(`[data-node-id="${id}"]`);
            if (!el) return null;

            const parent = el.parentElement;
            let index = 0;

            if (parent) {
              const siblings = Array.from(parent.children).filter(
                (sib) =>
                  sib.hasAttribute("data-node-id") &&
                  !sib.getAttribute("data-node-id")?.includes("placeholder")
              );
              index = siblings.findIndex(
                (sib) => sib.getAttribute("data-node-id") === id.toString()
              );
              if (index === -1) index = 0;
            }

            return {
              id,
              index,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.index - b.index)
          .map((item) => item.id),
        additionalPlaceholders: [],
        targetId: node.parentId || "",
        position: "inside",
      };

      // Insert placeholder at the correct position
      insertAtIndex(mainPlaceholder.id, node.parentId, oldIndex);

      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      dragOps.setDraggedNode(node, {
        x:
          (elementRect.left - contentRect.left - transform.x) / transform.scale,
        y: (elementRect.top - contentRect.top - transform.y) / transform.scale,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });

      if (selectedIds.length > 1) {
        const additional = selectedIds
          .filter((id) => id !== node.id)
          .map((id) => {
            // Get node data from atoms
            const otherNodeBasics = getNodeBasics(id);
            const otherNodeStyle = getNodeStyle(id);
            const otherNodeFlags = getNodeFlags(id);
            const otherNodeParent = getNodeParent(id);

            const otherNode = {
              id,
              type: otherNodeBasics.type,
              style: otherNodeStyle,
              parentId: otherNodeParent,
              inViewport: otherNodeFlags.inViewport,
            };

            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            // Find index within parent for additional node
            const parentEl = el.parentElement;
            let additionalOldIndex = 0;

            if (parentEl) {
              const siblings = Array.from(parentEl.children).filter(
                (sib) =>
                  sib.hasAttribute("data-node-id") &&
                  !sib.getAttribute("data-node-id")?.includes("placeholder")
              );
              additionalOldIndex = siblings.findIndex(
                (sib) => sib.getAttribute("data-node-id") === id.toString()
              );
              if (additionalOldIndex === -1) additionalOldIndex = 0;
            }

            const {
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            } = calculateAndUpdateDimensions({
              node: otherNode,
              element: el,
              transform,
              // Use updateNodeStyle instead of setNodeStyle
              setNodeStyle: (style, ids) => {
                if (ids && ids.length > 0) {
                  ids.forEach((id) => updateNodeStyle(id, style));
                } else {
                  updateNodeStyle(otherNode.id, style);
                }
              },
            });

            dragOps.setNodeDimensions(otherNode.id, {
              width: el.style.width,
              height: el.style.height,
              isFillMode: el.style.flex === "1 0 0px",
              finalWidth: additionalWidth as string,
              finalHeight: additionalHeight as string,
            });

            const additionalPlaceholder = createPlaceholder({
              node: otherNode,
              element: el,
              transform,
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            });

            // Insert additional placeholder using hierarchy operations
            insertAtIndex(
              additionalPlaceholder.id,
              otherNode.parentId,
              additionalOldIndex
            );

            // Add to placeholder tracking
            placeholderInfo.additionalPlaceholders.push({
              placeholderId: additionalPlaceholder.id,
              nodeId: otherNode.id,
            });

            const rect = el.getBoundingClientRect();
            const contentRect = contentRef.current!.getBoundingClientRect();

            const xPos =
              (rect.left - contentRect.left - transform.x) / transform.scale;
            const yPos =
              (rect.top - contentRect.top - transform.y) / transform.scale;

            const mouseOffsetX = (e.clientX - rect.left) / transform.scale;
            const mouseOffsetY = (e.clientY - rect.top) / transform.scale;

            return {
              node: otherNode,
              offset: {
                x: xPos,
                y: yPos,
                mouseX: mouseOffsetX,
                mouseY: mouseOffsetY,
              },
              placeholderId: additionalPlaceholder.id,
            };
          })
          .filter(Boolean) as Array<{
          node: { id: NodeId; [key: string]: any };
          offset: any;
        }>;

        dragOps.setPlaceholderInfo(placeholderInfo);
        dragOps.setAdditionalDraggedNodes(additional);
      }
    } else {
      dragOps.setDragSource("canvas");

      // Get the element
      const htmlElement = element as HTMLElement;

      // Calculate initial position
      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      // Calculate mouse offset
      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      // Apply calculateAndUpdateDimensions logic for percentage widths
      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element: htmlElement,
        transform,
        // Use updateNodeStyle instead of setNodeStyle
        setNodeStyle: (style, ids) => {
          if (ids && ids.length > 0) {
            ids.forEach((id) => updateNodeStyle(id, style));
          } else {
            updateNodeStyle(node.id, style);
          }
        },
        preventUnsync: true,
      });

      // Store dimensions so they're available to the drag component
      const isFillMode = htmlElement.style.flex === "1 0 0px";

      // Save the dimensions for reference during drag
      dragOps.setNodeDimensions(node.id, {
        width: htmlElement.style.width,
        height: htmlElement.style.height,
        isFillMode: isFillMode,
        finalWidth,
        finalHeight,
      });

      // Update style to absolute positioning for dragging
      updateNodeStyle(node.id, {
        position: "absolute",
        left: undefined,
        top: undefined,
      });

      // Set up dragging
      dragOps.setIsDragging(true);

      dragOps.setDraggedNode(node, {
        x: currentLeft,
        y: currentTop,
        mouseX: mouseOffsetX,
        mouseY: mouseOffsetY,
      });

      if (selectedIds.length > 1) {
        const additional = selectedIds
          .filter((id) => id !== node.id)
          .map((id) => {
            // Get node data from atoms
            const otherNodeBasics = getNodeBasics(id);
            const otherNodeStyle = getNodeStyle(id);
            const otherNodeFlags = getNodeFlags(id);
            const otherNodeParent = getNodeParent(id);

            const otherNode = {
              id,
              type: otherNodeBasics.type,
              style: otherNodeStyle,
              parentId: otherNodeParent,
              inViewport: otherNodeFlags.inViewport,
            };

            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            // Apply dimension conversion for additional nodes
            const {
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            } = calculateAndUpdateDimensions({
              node: otherNode,
              element: el,
              transform,
              // Use updateNodeStyle instead of setNodeStyle
              setNodeStyle: (style, ids) => {
                if (ids && ids.length > 0) {
                  ids.forEach((id) => updateNodeStyle(id, style));
                } else {
                  updateNodeStyle(otherNode.id, style);
                }
              },
              preventUnsync: true,
            });

            // Save dimensions for reference during drag
            dragOps.setNodeDimensions(otherNode.id, {
              width: el.style.width,
              height: el.style.height,
              isFillMode: el.style.flex === "1 0 0px",
              finalWidth: additionalWidth as string,
              finalHeight: additionalHeight as string,
            });

            const rect = el.getBoundingClientRect();

            const xPos =
              (rect.left - contentRect.left - transform.x) / transform.scale;
            const yPos =
              (rect.top - contentRect.top - transform.y) / transform.scale;

            const mouseOffsetX = (e.clientX - rect.left) / transform.scale;
            const mouseOffsetY = (e.clientY - rect.top) / transform.scale;

            // Update style to absolute positioning
            updateNodeStyle(otherNode.id, {
              position: "absolute",
              left: "0px",
              top: "0px",
            });

            return {
              node: otherNode,
              offset: {
                x: xPos,
                y: yPos,
                mouseX: mouseOffsetX,
                mouseY: mouseOffsetY,
              },
            };
          })
          .filter(Boolean) as Array<{
          node: { id: NodeId; [key: string]: any };
          offset: any;
        }>;

        dragOps.setAdditionalDraggedNodes(additional);
      }
    }

    dragOps.setDraggedItem(null);
  };
};
