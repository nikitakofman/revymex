import { Node } from "@/builder/reducer/nodeDispatcher";
import { useBuilder } from "@/builder/context/builderState";
import {
  calculateAndUpdateDimensions,
  findIndexWithinParent,
  isAbsoluteInFrame,
} from "../utils";
import { nanoid } from "nanoid";
import { createPlaceholder } from "./createPlaceholder";
import { selectOps, useGetSelectedIds } from "../atoms/select-store";
import { dragOps, useIsDragging } from "../atoms/drag-store";

export const useDragStart = () => {
  const {
    dragDisp,
    nodeDisp,
    transform,
    contentRef,
    nodeState,
    dragState,
    setNodeStyle,
    startRecording,
    stopRecording,
    selectedIdsRef,
    isMiddleMouseDown,
  } = useBuilder();

  const currentSelectedIds = useGetSelectedIds();

  const getDynamicParentNode = (node: Node): Node | null => {
    let currentNode = node;
    while (currentNode.parentId) {
      const parent = nodeState.nodes.find((n) => n.id === currentNode.parentId);
      if (!parent) break;
      if (parent.isDynamic) return parent;
      currentNode = parent;
    }
    return null;
  };

  const isDragging = useIsDragging();

  if (isMiddleMouseDown) return null;

  return (e: React.MouseEvent, fromToolbarType?: string, node?: Node) => {
    // Check if the click is on a resize handle or its parent resize handle container
    if (dragState.recordingSessionId && !isDragging) {
      console.warn(
        "Inconsistent state detected: recordingSessionId exists but not dragging. Resetting state."
      );
      stopRecording(dragState.recordingSessionId);
      dragOps.resetDragState();
      // Clean up any dangling placeholders
      const placeholders = nodeState.nodes.filter(
        (n) => n.type === "placeholder"
      );
      placeholders.forEach((p) => nodeDisp.removeNode(p.id));
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

    // NEW: Filter out any selected nodes that are children of other selected nodes
    let selectedIds = [...originalSelectedIds];

    // Create a map of parent-child relationships for quick lookup
    const childParentMap = new Map();

    // Build the parent-child relationship map for the entire node tree
    nodeState.nodes.forEach((node) => {
      if (node.parentId) {
        childParentMap.set(node.id, node.parentId);
      }
    });

    // Initialize selectedIds to the original selection

    // Only filter out child nodes if there are multiple nodes selected
    // This is the key change - only apply this filtering if we actually have multiple items selected
    if (
      originalSelectedIds.length > 1 &&
      node &&
      originalSelectedIds.includes(node.id)
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
    dragDisp.setRecordingSessionId(sessionId);

    if (fromToolbarType) {
      const newNode: Node = {
        id: nanoid(),
        type: fromToolbarType,
        style: {
          width: "150px",
          height: "150px",
          position: "fixed",
          backgroundColor: fromToolbarType === "frame" ? "gray" : undefined,
          flex: "0 0 auto",
        },
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

    if (!node || !contentRef.current) return;

    // Check if node is in the filtered selection
    if (!selectedIds.includes(node.id) && selectedIds.length > 1) {
      // The clicked node isn't in the filtered selection and we have multiple nodes selected
      // This means it's likely a child of a selected parent

      // Find its top-most selected parent
      let currentId = node.id;
      let parentId = childParentMap.get(currentId);
      let foundParent = false;

      while (parentId) {
        if (selectedIds.includes(parentId)) {
          // Use this parent instead
          const parentNode = nodeState.nodes.find((n) => n.id === parentId);
          if (parentNode) {
            node = parentNode;
            foundParent = true;
            break;
          }
        }
        // Move up the hierarchy
        currentId = parentId;
        parentId = childParentMap.get(currentId);
      }

      // If we didn't find a parent in the selection, just use the clicked node directly
      if (!foundParent) {
        // Clear the existing selection and just use this node
        selectedIds = [node.id];
        selectOps.setSelectedIds([node.id]);
      }
    }

    // NEW: Check if node is absolutely positioned in a frame
    if (isAbsoluteInFrame(node)) {
      dragOps.setDragSource("absolute-in-frame"); // New drag source type

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
            const otherNode = nodeState.nodes.find((n) => n.id === id);
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
          .filter(Boolean) as Array<{ node: Node; offset: any }>;

        dragOps.setAdditionalDraggedNodes(additional);
      }

      return;
    }

    if (!dragState.dynamicModeNodeId) {
      const dynamicParent = getDynamicParentNode(node);
      if (dynamicParent && !node.isDynamic) {
        node = dynamicParent;
      }
    }

    const element = document.querySelector(`[data-node-id="${node.id}"]`);
    if (!element) return;

    const elementRect = element.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    if (node.inViewport) {
      dragOps.setDragSource("viewport");
      const oldIndex = findIndexWithinParent(
        nodeState.nodes,
        node.id,
        node.parentId
      );

      const element = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;

      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element,
        transform,
        setNodeStyle,
        preventUnsync: true,
      });

      // Create main placeholder
      const mainPlaceholder = createPlaceholder({
        node,
        element: element as HTMLElement,
        transform,
        finalWidth,
        finalHeight,
      });

      const isFillMode = element.style.flex === "1 0 0px";

      const mainDimensions = {
        width: element.style.width,
        height: element.style.height,
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
            const node = nodeState.nodes.find((n) => n.id === id);
            return node
              ? {
                  id: node.id,
                  index: findIndexWithinParent(
                    nodeState.nodes,
                    node.id,
                    node.parentId
                  ),
                }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.index - b.index)
          .map((item) => item.id),
        additionalPlaceholders: [],
      };

      nodeDisp.insertAtIndex(mainPlaceholder, oldIndex, node.parentId);

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
            const otherNode = nodeState.nodes.find((n) => n.id === id);
            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            const {
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            } = calculateAndUpdateDimensions({
              node: otherNode,
              element: el,
              transform,
              setNodeStyle,
            });

            dragOps.setNodeDimensions(otherNode.id, {
              width: el.style.width,
              height: el.style.height,
              isFillMode: el.style.flex === "1 0 0px",
              finalWidth: additionalWidth as string,
              finalHeight: additionalHeight as string,
            });

            const additionalOldIndex = findIndexWithinParent(
              nodeState.nodes,
              otherNode.id,
              otherNode.parentId
            );
            const additionalPlaceholder = createPlaceholder({
              node: otherNode,
              element: el,
              transform,
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            });

            // Insert additional placeholder
            nodeDisp.insertAtIndex(
              additionalPlaceholder,
              additionalOldIndex,
              otherNode.parentId
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
          .filter(Boolean) as Array<{ node: Node; offset: any }>;

        dragOps.setPlaceholderInfo(placeholderInfo);
        dragOps.setAdditionalDraggedNodes(additional);
      }
    } else {
      dragOps.setDragSource("canvas");

      // Get the element
      const element = document.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;

      // Calculate initial position
      const currentLeft = parseFloat(node.style.left as string) || 0;
      const currentTop = parseFloat(node.style.top as string) || 0;

      // Calculate mouse offset
      const mouseOffsetX = (e.clientX - elementRect.left) / transform.scale;
      const mouseOffsetY = (e.clientY - elementRect.top) / transform.scale;

      // IMPORTANT: Apply the same calculateAndUpdateDimensions logic for percentage widths
      // This fixes the issue with percentage/flex-fill dimensions in dynamic mode
      const { finalWidth, finalHeight } = calculateAndUpdateDimensions({
        node,
        element,
        transform,
        setNodeStyle,
        preventUnsync: true,
      });

      // Store dimensions so they're available to the drag component
      const isFillMode = element.style.flex === "1 0 0px";

      // Save the dimensions for reference during drag
      dragOps.setNodeDimensions(node.id, {
        width: element.style.width,
        height: element.style.height,
        isFillMode: isFillMode,
        finalWidth,
        finalHeight,
      });

      // Update style to absolute positioning for dragging
      setNodeStyle(
        {
          position: "absolute",
          left: undefined,
          top: undefined,
        },
        [node.id]
      );

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
            const otherNode = nodeState.nodes.find((n) => n.id === id);
            if (!otherNode) return null;

            const el = document.querySelector(
              `[data-node-id="${id}"]`
            ) as HTMLElement;
            if (!el) return null;

            // IMPORTANT: Apply the same dimension conversion for additional nodes
            const {
              finalWidth: additionalWidth,
              finalHeight: additionalHeight,
            } = calculateAndUpdateDimensions({
              node: otherNode,
              element: el,
              transform,
              setNodeStyle,
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

            setNodeStyle(
              {
                position: "absolute",
                left: "0px",
                top: "0px",
              },
              [otherNode.id]
            );

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
          .filter(Boolean) as Array<{ node: Node; offset: any }>;

        dragOps.setAdditionalDraggedNodes(additional);
      }
    }

    dragOps.setDraggedItem(null);
  };
};
