import { dragOps } from "../atoms/drag-store";
import { NodeId, useGetNode, useGetNodeStyle } from "../atoms/node-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import { useGetTransform } from "../atoms/canvas-interaction-store";
import { createPlaceholder } from "./createPlaceholder";
import {
  addNode,
  moveNode,
} from "../atoms/node-store/operations/insert-operations";
import { useGetNodeFlags } from "../atoms/node-store";
import { collectDraggedNodesInfo } from "./dnd-utils";
import { useGetSelectedIds } from "../atoms/select-store";

export const useDragStart = () => {
  const getNode = useGetNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getTransform = useGetTransform();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();
  const getSelectedIds = useGetSelectedIds();

  return (
    e: React.MouseEvent,
    fromToolbarType?: string,
    nodeObj?: { id: NodeId; type?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!nodeObj?.id) return;

    const nodeId = nodeObj.id;
    const node = getNode(nodeId);
    const nodeStyle = getNodeStyle(nodeId);
    const nodeFlags = getNodeFlags(nodeId);

    const parentId = getNodeParent(nodeId);
    const isOnCanvas = !parentId && !nodeFlags.inViewport;

    // Reset drag back to parent state on new drag operation
    dragOps.setDragBackToParentInfo({
      isDraggingBackToParent: false,
      originalParentId: parentId,
      draggedNodesOriginalIndices: new Map(),
    });

    // Determine absolute in frame
    const isAbsoluteInFrame =
      (nodeStyle.isAbsoluteInFrame === "true" ||
        nodeStyle.position === "fixed" ||
        nodeStyle.position === "absolute") &&
      parentId;

    // Set drag source
    if (isOnCanvas) {
      dragOps.setDragSource("canvas");
    } else if (
      nodeFlags.inViewport &&
      nodeStyle.isAbsoluteInFrame !== "true" &&
      nodeStyle.position !== "fixed" &&
      nodeStyle.position !== "absolute"
    ) {
      dragOps.setDragSource("viewport");
    } else if (fromToolbarType) {
      dragOps.setDragSource("toolbar");
    } else if (isAbsoluteInFrame) {
      dragOps.setDragSource("absolute-in-frame");
    } else {
      dragOps.setDragSource("parent");
    }

    // Get selected IDs
    const selectedIds = getSelectedIds();
    const isMultiSelection =
      selectedIds.includes(nodeId) && selectedIds.length > 1;

    // Filter selected nodes based on same context (parent container or canvas)
    const validSelectedIds = isMultiSelection
      ? selectedIds.filter((id) => {
          const idParent = getNodeParent(id);
          const idFlags = getNodeFlags(id);
          const idStyle = getNodeStyle(id);

          // Check if node is in same context as primary node
          const idIsOnCanvas = !idParent && !idFlags.inViewport;
          const idIsAbsoluteInFrame =
            (idStyle.isAbsoluteInFrame === "true" ||
              idStyle.position === "fixed" ||
              idStyle.position === "absolute") &&
            idParent;

          // Only include nodes in same parent or all on canvas
          if (isOnCanvas) {
            return idIsOnCanvas;
          } else if (isAbsoluteInFrame) {
            return idIsAbsoluteInFrame && idParent === parentId;
          } else {
            return idParent === parentId && !idIsAbsoluteInFrame;
          }
        })
      : [nodeId];

    // For nodes in the same parent, sort them by their DOM order
    if (parentId && validSelectedIds.length > 1) {
      const siblings = getNodeChildren(parentId);
      validSelectedIds.sort(
        (a, b) => siblings.indexOf(a) - siblings.indexOf(b)
      );
    }

    // Store original indices for all dragged nodes
    if (parentId) {
      const originalIndices = new Map<NodeId, number>();
      const siblings = getNodeChildren(parentId);

      validSelectedIds.forEach((id) => {
        const index = siblings.indexOf(id);
        if (index !== -1) {
          originalIndices.set(id, index);
        }
      });

      // Store in drag state
      dragOps.setDraggedNodesOriginalIndices(originalIndices);
    }

    // Create placeholders for all selected nodes if needed
    const placeholders = [];
    let mainPlaceholder = null;

    if (!isAbsoluteInFrame && !isOnCanvas) {
      // Create placeholders for each selected node
      for (let i = 0; i < validSelectedIds.length; i++) {
        const currentId = validSelectedIds[i];
        const currentNode = getNode(currentId);
        const currentParentId = getNodeParent(currentId);

        if (!currentNode || !currentParentId) continue;

        const element = document.querySelector(
          `[data-node-id="${currentId}"]`
        ) as HTMLElement;

        if (!element) continue;

        // Create placeholder for this node
        const placeholder = createPlaceholder({
          node: currentNode,
          element,
          transform: getTransform(),
        });

        placeholders.push({
          id: placeholder.id,
          nodeId: currentId,
          index: getNodeChildren(currentParentId).indexOf(currentId),
        });

        // Set main placeholder (for the node that initiated the drag)
        if (currentId === nodeId) {
          mainPlaceholder = placeholder;
        }
      }

      // Sort placeholders by their index
      placeholders.sort((a, b) => a.index - b.index);

      // Add all placeholders sequentially to maintain order
      if (parentId && placeholders.length > 0) {
        // Insert all placeholders at the position of the first selected node
        const firstIndex = placeholders[0].index;

        for (let i = 0; i < placeholders.length; i++) {
          // Add placeholder to parent
          addNode(placeholders[i].id, parentId);

          // Position at sequential indices starting from first index
          moveNode(placeholders[i].id, parentId, firstIndex + i);
        }
      }
    }

    // Use utility to collect all nodes to drag
    const draggedNodesInfo = collectDraggedNodesInfo(
      nodeId,
      validSelectedIds,
      getNode,
      getNodeParent,
      getNodeFlags,
      getNodeStyle,
      e,
      getTransform
    );

    // Store all placeholder info for the dragged nodes
    if (draggedNodesInfo.draggedNodes.length > 0 && placeholders.length > 0) {
      // Set main placeholder ID on primary node
      if (mainPlaceholder) {
        draggedNodesInfo.draggedNodes[0].offset.placeholderId =
          mainPlaceholder.id;
      }

      // Create placeholder info for the drag operation
      const placeholderInfo = {
        mainPlaceholderId: mainPlaceholder ? mainPlaceholder.id : null,
        nodeOrder: validSelectedIds,
        additionalPlaceholders: placeholders.map((p) => ({
          placeholderId: p.id,
          nodeId: p.nodeId,
        })),
        targetId: null,
        position: null,
      };

      // Store placeholder info in drag state
      dragOps.setPlaceholderInfo(placeholderInfo);
    }

    // Set dragging state
    dragOps.setIsDragging(true);

    // Set all dragged nodes
    dragOps.setDraggedNodes(draggedNodesInfo.draggedNodes);

    // Debug: Log drag back to parent info
    console.log("Drag start - Original parent:", parentId);
    console.log(
      "Drag start - Original indices:",
      Object.fromEntries([
        ...dragOps.getState().dragBackToParentInfo.draggedNodesOriginalIndices,
      ])
    );
  };
};
