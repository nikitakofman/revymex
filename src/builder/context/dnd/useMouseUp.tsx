import { dragOps, useGetDraggedNode } from "../atoms/drag-store";
import {
  useGetNodeParent,
  useGetNodeChildren,
} from "../atoms/node-store/hierarchy-store";
import {
  moveNode,
  removeNode,
} from "../atoms/node-store/operations/insert-operations";

export const useMouseUp = () => {
  // Get non-reactive getters
  const getDraggedNode = useGetDraggedNode();
  const getNodeParent = useGetNodeParent();
  const getNodeChildren = useGetNodeChildren();

  return () => {
    const draggedNode = getDraggedNode();

    // If there's a dragged node and placeholder
    if (draggedNode && draggedNode.offset.placeholderId) {
      const { placeholderId } = draggedNode.offset;
      const draggedNodeId = draggedNode.node.id;

      // Find the placeholder's parent and position
      const placeholderParentId = getNodeParent(placeholderId);

      if (placeholderParentId) {
        // Get siblings to find index
        const siblings = getNodeChildren(placeholderParentId);
        const placeholderIndex = siblings.indexOf(placeholderId);

        if (placeholderIndex !== -1) {
          // Move the dragged node to placeholder position
          moveNode(draggedNodeId, placeholderParentId, placeholderIndex);

          // Remove the placeholder
          removeNode(placeholderId);
        }
      }
    }

    // Reset drag state
    dragOps.setDraggedNode(null, {
      x: 0,
      y: 0,
      mouseX: 0,
      mouseY: 0,
    });
    dragOps.setIsDragging(false);
  };
};
