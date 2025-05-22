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
import { useGetDynamicModeNodeId } from "../atoms/dynamic-store"; // Add this import for logging

export const useDragStart = () => {
  const getNode = useGetNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();
  const getTransform = useGetTransform();
  const getNodeFlags = useGetNodeFlags();
  const getNodeStyle = useGetNodeStyle();
  const getSelectedIds = useGetSelectedIds();
  const getDynamicModeNodeId = useGetDynamicModeNodeId(); // For logging purposes

  return (
    e: React.MouseEvent,
    fromToolbarType?: string,
    nodeObj?: { id: NodeId; type?: string }
  ) => {
    console.log("🟢 DRAG START - Event:", e.type, "Node:", nodeObj?.id);
    e.preventDefault();
    e.stopPropagation();

    if (!nodeObj?.id) {
      console.log("❌ No node ID provided for drag start");
      return;
    }

    const nodeId = nodeObj.id;
    const node = getNode(nodeId);
    const nodeStyle = getNodeStyle(nodeId);
    const nodeFlags = getNodeFlags(nodeId);
    const dynamicModeNodeId = getDynamicModeNodeId(); // Get dynamic mode node ID for logging

    console.log("🔹 Node info:", {
      id: nodeId,
      style: {
        position: nodeStyle.position,
        isAbsoluteInFrame: nodeStyle.isAbsoluteInFrame,
      },
      flags: {
        isDynamic: nodeFlags.isDynamic,
        isVariant: nodeFlags.isVariant,
        inViewport: nodeFlags.inViewport,
      },
      dynamicMode: !!dynamicModeNodeId,
      dynamicModeNodeId: dynamicModeNodeId,
    });

    const parentId = getNodeParent(nodeId);
    console.log("🔹 Parent ID:", parentId);
    const isOnCanvas = !parentId && !nodeFlags.inViewport;
    console.log("🔹 IsOnCanvas:", isOnCanvas);

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
    console.log("🔹 IsAbsoluteInFrame:", isAbsoluteInFrame);

    let dragSource = "";

    if (isOnCanvas) {
      dragSource = "canvas";
      console.log("🔹 Setting drag source: canvas");
      dragOps.setDragSource("canvas");
    } else if (
      nodeFlags.inViewport &&
      nodeStyle.isAbsoluteInFrame !== "true" &&
      nodeStyle.position !== "fixed" &&
      nodeStyle.position !== "absolute"
    ) {
      dragSource = "viewport";
      console.log("🔹 Setting drag source: viewport");
      dragOps.setDragSource("viewport");
    } else if (fromToolbarType) {
      dragSource = "toolbar";
      console.log("🔹 Setting drag source: toolbar");
      dragOps.setDragSource("toolbar");
    } else if (isAbsoluteInFrame) {
      dragSource = "absolute-in-frame";
      console.log("🔹 Setting drag source: absolute-in-frame");
      dragOps.setDragSource("absolute-in-frame");
    } else {
      dragSource = "parent";
      console.log("🔹 Setting drag source: parent");
      dragOps.setDragSource("parent");
    }

    // Get selected IDs
    const selectedIds = getSelectedIds();
    const isMultiSelection =
      selectedIds.includes(nodeId) && selectedIds.length > 1;
    console.log("🔹 Selected IDs:", selectedIds);
    console.log("🔹 Is multi-selection:", isMultiSelection);

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
    console.log("🔹 Valid selected IDs:", validSelectedIds);

    // For nodes in the same parent, sort them by their DOM order
    if (parentId && validSelectedIds.length > 1) {
      const siblings = getNodeChildren(parentId);
      validSelectedIds.sort(
        (a, b) => siblings.indexOf(a) - siblings.indexOf(b)
      );
      console.log("🔹 Sorted selected IDs:", validSelectedIds);
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

      console.log(
        "🔹 Original indices:",
        Object.fromEntries([...originalIndices])
      );

      // Store in drag state
      dragOps.setDraggedNodesOriginalIndices(originalIndices);
    }

    // Create placeholders for all selected nodes if needed
    const placeholders = [];
    let mainPlaceholder = null;

    if (!isAbsoluteInFrame && !isOnCanvas) {
      console.log("🔹 Creating placeholders for selected nodes");
      // Create placeholders for each selected node
      for (let i = 0; i < validSelectedIds.length; i++) {
        const currentId = validSelectedIds[i];
        const currentNode = getNode(currentId);
        const currentParentId = getNodeParent(currentId);

        if (!currentNode || !currentParentId) {
          console.log(
            `❌ Cannot create placeholder for node ${currentId}: missing node or parent`
          );
          continue;
        }

        const element = document.querySelector(
          `[data-node-id="${currentId}"]`
        ) as HTMLElement;

        if (!element) {
          console.log(`❌ Cannot find DOM element for node ${currentId}`);
          continue;
        }

        // Create placeholder for this node
        const placeholder = createPlaceholder({
          node: currentNode,
          element,
          transform: getTransform(),
        });
        console.log(
          `✅ Created placeholder ${placeholder.id} for node ${currentId}`
        );

        placeholders.push({
          id: placeholder.id,
          nodeId: currentId,
          index: getNodeChildren(currentParentId).indexOf(currentId),
        });

        // Set main placeholder (for the node that initiated the drag)
        if (currentId === nodeId) {
          mainPlaceholder = placeholder;
          console.log(`✅ Set main placeholder to ${placeholder.id}`);
        }
      }

      // Sort placeholders by their index
      placeholders.sort((a, b) => a.index - b.index);
      console.log("🔹 Sorted placeholders:", placeholders);

      // Add all placeholders sequentially to maintain order
      if (parentId && placeholders.length > 0) {
        // Insert all placeholders at the position of the first selected node
        const firstIndex = placeholders[0].index;
        console.log(
          `🔹 Inserting placeholders starting at index ${firstIndex}`
        );

        for (let i = 0; i < placeholders.length; i++) {
          // Add placeholder to parent
          addNode(placeholders[i].id, parentId);
          console.log(
            `✅ Added placeholder ${placeholders[i].id} to parent ${parentId}`
          );

          // Position at sequential indices starting from first index
          moveNode(placeholders[i].id, parentId, firstIndex + i);
          console.log(
            `✅ Moved placeholder ${placeholders[i].id} to index ${
              firstIndex + i
            }`
          );
        }
      }
    } else {
      console.log(
        "🔹 Skipping placeholder creation - node is absolute in frame or on canvas"
      );
    }

    // Use utility to collect all nodes to drag
    console.log("🔹 Collecting dragged nodes info");
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
    console.log("🔹 Dragged nodes info:", draggedNodesInfo);

    // Store all placeholder info for the dragged nodes
    if (draggedNodesInfo.draggedNodes.length > 0 && placeholders.length > 0) {
      // Set main placeholder ID on primary node
      if (mainPlaceholder) {
        draggedNodesInfo.draggedNodes[0].offset.placeholderId =
          mainPlaceholder.id;
        console.log(
          `✅ Set main placeholder ID on primary node: ${mainPlaceholder.id}`
        );
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
      console.log("🔹 Created placeholder info:", placeholderInfo);

      // Store placeholder info in drag state
      dragOps.setPlaceholderInfo(placeholderInfo);
    }

    // Set dragging state
    console.log("🔹 Setting isDragging to true");
    dragOps.setIsDragging(true);

    // Set all dragged nodes
    console.log("🔹 Setting dragged nodes:", draggedNodesInfo.draggedNodes);
    dragOps.setDraggedNodes(draggedNodesInfo.draggedNodes);

    console.log("🟢 DRAG START COMPLETE");
  };
};
