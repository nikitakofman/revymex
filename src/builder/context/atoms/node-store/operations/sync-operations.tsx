import {
  NodeId,
  nodeStore,
  nodeSharedInfoAtom,
  getCurrentNodes,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
} from "../";
import {
  hierarchyStore,
  childrenMapAtom,
  parentMapAtom,
} from "../hierarchy-store";
import { batchNodeUpdates } from "..";
import {
  moveNode,
  removeNode,
  insertAtIndex,
  addNode,
} from "./insert-operations";
import { updateNodeStyle } from "./style-operations";
import { updateNodeFlags } from "./update-operations";
import {
  arrayMove,
  assignSharedId,
  nanoid,
  removeSharedId,
} from "./utils-operations";

/**
 * Synchronize node positions across all viewports using shared IDs
 * Works for direct viewport children and nested elements
 * Properly handles index adjustment for forward vs backward moves
 *
 * @param nodeId ID of the node being moved/synchronized
 * @param sourceParentId ID of the parent where the operation happened
 * @param targetIndex Index position in the children array (optional)
 */
/**
 * Synchronize node positions across all viewports using shared IDs
 * Works for direct viewport children and nested elements
 * Properly handles index adjustment for forward vs backward moves
 *
 * @param nodeId ID of the node being moved/synchronized
 * @param sourceParentId ID of the parent where the operation happened
 * @param targetIndex Index position in the children array (optional)
 */
/**
 * Synchronize node positions across all viewports using shared IDs
 * Works for direct viewport children and nested elements
 * Properly handles index adjustment for forward vs backward moves
 *
 * @param nodeId ID of the node being moved/synchronized
 * @param sourceParentId ID of the parent where the operation happened
 * @param targetIndex Index position in the children array (optional)
 */
export function syncViewports(
  nodeId: NodeId,
  sourceParentId: NodeId,
  targetIndex?: number
) {
  // Helper function to get the full path to a node
  function getAncestorChain(
    nodeId: NodeId,
    parentMap: Map<NodeId, NodeId | null>
  ): NodeId[] {
    const chain: NodeId[] = [];
    let current: NodeId | null = nodeId;

    while (current != null) {
      chain.unshift(current); // add to beginning
      current = parentMap.get(current) || null;
    }

    return chain;
  }

  try {
    let allNodes = getCurrentNodes();
    if (!allNodes.length) return;

    // quick lookup: nodeId -> sharedId
    const sharedById = new Map<NodeId, string | undefined>();
    allNodes.forEach((n) => sharedById.set(n.id, n.sharedId));

    // Get parent map for ancestry checks
    const parentMap = hierarchyStore.get(parentMapAtom);

    // Helper function to check if a node is in a specific viewport
    const isInViewport = (id: NodeId, viewportId: NodeId): boolean => {
      let current: NodeId | null | undefined = id;
      while (current != null) {
        if (current === viewportId) return true;
        current = parentMap.get(current);
      }
      return false;
    };

    // Helper to find top-level viewport for a node
    const findTopViewport = (id: NodeId): NodeId | null => {
      let current: NodeId | null | undefined = id;
      let lastViewport: NodeId | null = null;

      while (current != null) {
        if (typeof current === "string" && current.includes("viewport")) {
          lastViewport = current;
        }
        current = parentMap.get(current);
      }

      return lastViewport;
    };

    // Get the node being moved
    const movedNode = allNodes.find((n) => n.id === nodeId);
    if (!movedNode) return;

    // Get the actual parent ID (after the move)
    const nodeParentId = parentMap.get(nodeId);

    // Get ancestor chain for better debugging
    const ancestorChain = getAncestorChain(nodeId, parentMap);
    console.log("Node ancestry:", ancestorChain);

    // Get parent node info for shared ID
    const parentNode = nodeParentId
      ? allNodes.find((n) => n.id === nodeParentId)
      : null;
    const parentSharedId = parentNode?.sharedId;

    // Collect all viewports
    let childrenMap = hierarchyStore.get(childrenMapAtom);

    // Children list of the *source* parent *after* the drop has happened
    const sourceSiblings = [...(childrenMap.get(sourceParentId) || [])];

    const viewports: NodeId[] = [];
    childrenMap.forEach((_, key) => {
      if (typeof key === "string" && key.includes("viewport")) {
        viewports.push(key);
      }
    });

    batchNodeUpdates(() => {
      // CASE 1: DROPPING FROM VIEWPORT TO CANVAS
      // If the node was moved to the canvas (null parent) and had a shared ID
      if (nodeParentId === null && movedNode.sharedId) {
        console.log(
          "Handling drop from viewport to canvas - removing shared instances"
        );

        // Remove shared ID from the dragged node
        removeSharedId(nodeId);

        // Find and remove all corresponding nodes in other viewports
        for (const viewportId of viewports) {
          // Skip source viewport
          const sourceViewport = findTopViewport(sourceParentId);
          if (viewportId === sourceViewport) continue;

          // Find all nodes with the same shared ID in this viewport
          const nodesToRemove = allNodes
            .filter(
              (n) =>
                n.sharedId === movedNode.sharedId &&
                isInViewport(n.id, viewportId)
            )
            .map((n) => n.id);

          // Remove all corresponding nodes
          nodesToRemove.forEach((id) => removeNode(id));
        }

        return;
      }

      // CASE 2: MOVING FROM CANVAS TO VIEWPORT
      // Check if node is being moved into a viewport (simplified check)
      const isMovingToViewport = !!findTopViewport(nodeParentId);

      if (!movedNode.sharedId && isMovingToViewport) {
        console.log(
          "Handling move from canvas to viewport - duplicating to other viewports"
        );

        // Get the top-level viewport containing the node
        const targetViewport = findTopViewport(nodeParentId);
        if (!targetViewport) {
          console.error("Could not find top-level viewport for node");
          return;
        }

        // Ensure the parent also has a shared ID if it's in a viewport
        if (!parentSharedId && nodeParentId) {
          // Assign shared ID to the parent first to ensure proper ancestry chain
          const newParentSharedId = assignSharedId(nodeParentId);
          console.log(
            `Assigned shared ID ${newParentSharedId} to parent ${nodeParentId}`
          );

          // Update our reference to parent's shared ID
          const updatedParentNode = allNodes.find((n) => n.id === nodeParentId);
          if (updatedParentNode) {
            parentSharedId = updatedParentNode.sharedId;
          }
        }

        // Assign a shared ID to the node
        const newSharedId = assignSharedId(nodeId);

        // Clone to ALL other viewports
        for (const viewportId of viewports) {
          // Skip the viewport that already contains the node
          if (viewportId === targetViewport) {
            console.log(`Skipping source viewport ${viewportId}`);
            continue;
          }

          let targetParentInOtherViewport: NodeId;

          // If node's immediate parent has a shared ID, find matching parent in target viewport
          if (parentSharedId) {
            // Find all nodes with the matching parent shared ID in the target viewport
            const matchingParents = allNodes.filter(
              (n) =>
                n.sharedId === parentSharedId && isInViewport(n.id, viewportId)
            );

            // Use the first matching parent, or fallback to viewport root
            targetParentInOtherViewport =
              matchingParents.length > 0 ? matchingParents[0].id : viewportId;
          } else {
            // If parent doesn't have shared ID, use viewport root
            targetParentInOtherViewport = viewportId;
          }

          console.log(
            `Duplicating to viewport ${viewportId} under parent ${targetParentInOtherViewport}`
          );

          // Create a clone in the target viewport
          duplicateNodeToViewport(
            nodeId,
            targetParentInOtherViewport,
            newSharedId,
            targetIndex
          );
        }

        return;
      }

      // CASE 3: REGULAR VIEWPORT SYNCHRONIZATION for nodes with shared IDs
      // Including nested drops - syncing position inside nested elements
      if (!movedNode.sharedId) return;

      // Find source top viewport
      const sourceTopViewport = findTopViewport(sourceParentId);

      // Count instances with this sharedId in source parent
      const instancesInSourceParent = sourceSiblings.filter(
        (sibId) => sharedById.get(sibId) === movedNode.sharedId
      ).length;

      console.log(
        `Found ${instancesInSourceParent} instances with sharedId ${movedNode.sharedId} in source parent`
      );

      // Track new shared IDs for duplicates
      const newSharedIdsByViewport = new Map<NodeId, string[]>();

      for (const viewportId of viewports) {
        // Skip the viewport where the drag originated
        if (viewportId === sourceTopViewport) continue;

        // Find all instances of the node with the same shared ID in this viewport
        let correspondingNodes = allNodes.filter(
          (n) =>
            n.sharedId === movedNode.sharedId && isInViewport(n.id, viewportId)
        );

        console.log(
          `Found ${correspondingNodes.length} corresponding nodes in viewport ${viewportId}`
        );

        // Check if we need to create additional instances
        if (correspondingNodes.length < instancesInSourceParent) {
          console.log(
            `Need to create ${
              instancesInSourceParent - correspondingNodes.length
            } additional instances in viewport ${viewportId}`
          );

          // Find the corresponding parent in this viewport
          let targetParentId: NodeId;
          if (parentSharedId) {
            // Find parent with matching shared ID in target viewport
            const matchingParents = allNodes.filter(
              (n) =>
                n.sharedId === parentSharedId && isInViewport(n.id, viewportId)
            );

            // Use first matching parent or fallback to viewport
            targetParentId =
              matchingParents.length > 0 ? matchingParents[0].id : viewportId;
          } else {
            // If no parent shared ID, use viewport root
            targetParentId = viewportId;
          }

          // Initialize shared IDs array for this viewport
          newSharedIdsByViewport.set(viewportId, []);

          // Create the missing instances
          const missingCount =
            instancesInSourceParent - correspondingNodes.length;
          for (let i = 0; i < missingCount; i++) {
            console.log(
              `Creating instance ${
                i + 1
              } of ${missingCount} in viewport ${viewportId}`
            );

            // Calculate the adjusted index for new nodes
            let adjustedIndex = 0;
            if (targetIndex !== undefined) {
              // Calculate viewport-relative index
              adjustedIndex = 0;
              for (let j = 0; j < targetIndex; j++) {
                const idAhead = sourceSiblings[j];
                const sharedAhead = sharedById.get(idAhead);

                // skip the dragged node itself
                if (sharedAhead === movedNode.sharedId) continue;

                // count it only if a sibling with the SAME sharedId exists here
                const siblings = [...(childrenMap.get(targetParentId) || [])];
                const existsInViewport = siblings.some(
                  (sib) => sharedById.get(sib) === sharedAhead
                );
                if (existsInViewport) adjustedIndex++;
              }

              // Place new instances after existing ones with the same sharedId
              adjustedIndex += correspondingNodes.length + i;
            } else {
              // Without targetIndex, place after existing instances
              const siblings = [...(childrenMap.get(targetParentId) || [])];
              adjustedIndex = siblings.length;
            }

            // FIX: Use the original node's shared ID instead of generating a new one
            // to maintain consistency across viewports
            const newSharedId = movedNode.sharedId;

            // Store this shared ID
            newSharedIdsByViewport.get(viewportId)!.push(newSharedId);

            console.log(`Using shared ID ${newSharedId} for duplicate`);

            // Create a clone with the shared ID
            const cloneId = duplicateNodeToViewport(
              nodeId,
              targetParentId,
              newSharedId,
              adjustedIndex
            );

            console.log(
              "Clone created:",
              cloneId,
              "with shared ID:",
              newSharedId
            );
          }

          // Refresh the data after creating instances
          allNodes = getCurrentNodes();
          childrenMap = hierarchyStore.get(childrenMapAtom);

          // Re-fetch corresponding nodes with fresh data - only for the ORIGINAL shared ID
          correspondingNodes = allNodes.filter(
            (n) =>
              n.sharedId === movedNode.sharedId &&
              isInViewport(n.id, viewportId)
          );

          console.log(
            `After refresh: found ${correspondingNodes.length} corresponding nodes in viewport ${viewportId}`
          );
        }

        // Skip if no matching nodes (shouldn't happen after the refresh)
        if (correspondingNodes.length === 0) {
          console.warn(
            `No corresponding nodes found in viewport ${viewportId} even after refresh!`
          );
          continue;
        }

        // For each corresponding node - reposition or reparent as needed
        for (const correspondingNode of correspondingNodes) {
          // Find the corresponding parent in the target viewport
          let targetParentId: NodeId;

          if (parentSharedId) {
            // Find parent with matching shared ID in target viewport
            const matchingParents = allNodes.filter(
              (n) =>
                n.sharedId === parentSharedId && isInViewport(n.id, viewportId)
            );

            // Use first matching parent or fallback to viewport
            targetParentId =
              matchingParents.length > 0 ? matchingParents[0].id : viewportId;
          } else {
            // If no parent shared ID, use viewport root
            targetParentId = viewportId;
          }

          // If targetIndex is specified, reorder within parent
          if (targetIndex !== undefined) {
            const siblings = [...(childrenMap.get(targetParentId) || [])];
            const currentIndex = siblings.indexOf(correspondingNode.id);

            // --- NEW: turn the desktop index into a viewport-relative index -----------
            let adjustedIndex = 0;
            for (let i = 0; i < targetIndex; i++) {
              const idAhead = sourceSiblings[i];
              const sharedAhead = sharedById.get(idAhead);

              // skip the dragged node itself
              if (sharedAhead === movedNode.sharedId) continue;

              // count it only if a sibling with the SAME sharedId exists here
              const existsInViewport = siblings.some(
                (sib) => sharedById.get(sib) === sharedAhead
              );
              if (existsInViewport) adjustedIndex++;
            }
            // --------------------------------------------------------------------------

            if (currentIndex === -1) {
              // Node doesn't live here yet
              insertAtIndex(
                correspondingNode.id,
                targetParentId,
                Math.min(adjustedIndex, siblings.length)
              );
              console.log(
                `Inserted ${correspondingNode.id} at adjusted index ${adjustedIndex} in ${targetParentId}`
              );
            } else {
              // Move inside this parent
              siblings.splice(currentIndex, 1);
              siblings.splice(
                Math.min(adjustedIndex, siblings.length),
                0,
                correspondingNode.id
              );

              hierarchyStore.set(childrenMapAtom, (prev) => {
                const next = new Map(prev);
                next.set(targetParentId, siblings);
                return next;
              });

              console.log(
                `Reordered ${correspondingNode.id} from ${currentIndex} to adjusted index ${adjustedIndex}`
              );
            }
          } else {
            // Just ensure the node is a child of the correct parent
            const currentParentId = parentMap.get(correspondingNode.id);
            if (currentParentId !== targetParentId) {
              moveNode(correspondingNode.id, targetParentId);
            }
          }

          // Update style to relative for viewport children
          updateNodeStyle(correspondingNode.id, {
            position: "relative",
            left: "",
            top: "",
            zIndex: "",
          });

          // Update viewport flag
          updateNodeFlags(correspondingNode.id, {
            inViewport: true,
          });
        }
      }

      // Now, sync the new duplicates across viewports
      // First, find desktop viewport shared IDs
      const desktopSharedIds =
        newSharedIdsByViewport.get(sourceTopViewport) || [];

      // For each desktop duplicate's shared ID, find a matching one in other viewports
      for (let i = 0; i < desktopSharedIds.length; i++) {
        const desktopSharedId = desktopSharedIds[i];

        // For each other viewport
        for (const viewportId of viewports) {
          if (viewportId === sourceTopViewport) continue;

          const viewportSharedIds =
            newSharedIdsByViewport.get(viewportId) || [];

          if (i < viewportSharedIds.length) {
            const otherSharedId = viewportSharedIds[i];

            // Make sure all duplicates with the same index across viewports have consistent style
            const nodesWithOtherSharedId = allNodes.filter(
              (n) =>
                n.sharedId === otherSharedId && isInViewport(n.id, viewportId)
            );

            for (const node of nodesWithOtherSharedId) {
              // Update style and flags for consistent appearance
              updateNodeStyle(node.id, {
                position: "relative",
                left: "",
                top: "",
                zIndex: "",
              });

              updateNodeFlags(node.id, {
                inViewport: true,
              });
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("syncViewports error:", e);
  }
}

/**
 * Duplicate a node and its children to another viewport
 * @param sourceNodeId Source node to duplicate
 * @param targetParentId Parent in target viewport to attach duplicate to
 * @param sharedId Shared ID for viewport synchronization
 * @param targetIndex Position to insert at (optional)
 * @returns ID of the duplicated node
 */
export function duplicateNodeToViewport(
  sourceNodeId: NodeId,
  targetParentId: NodeId,
  sharedId: string,
  targetIndex?: number
): NodeId {
  try {
    console.log(
      `Duplicating node ${sourceNodeId} to ${targetParentId} with sharedId ${sharedId}`
    );

    // Generate a unique ID for the clone
    const cloneId = nanoid();

    // Add node ID to the store
    nodeStore.set(nodeIdsAtom, (prev) => [...prev, cloneId]);

    // Get all the source node data
    const allNodes = getCurrentNodes();
    const sourceNode = allNodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found`);
      throw new Error("Source node not found");
    }

    // Clone basic properties
    nodeStore.set(nodeBasicsAtom(cloneId), {
      id: cloneId,
      type: sourceNode.type,
      customName: sourceNode.customName,
    });

    // Clone style
    nodeStore.set(nodeStyleAtom(cloneId), { ...sourceNode.style });

    // Clone flags
    nodeStore.set(nodeFlagsAtom(cloneId), {
      isLocked: sourceNode.isLocked,
      inViewport: true, // Always true for viewport children
      isViewport: sourceNode.isViewport,
      viewportName: sourceNode.viewportName,
      viewportWidth: sourceNode.viewportWidth,
    });

    // Set the shared ID
    nodeStore.set(nodeSharedInfoAtom(cloneId), { sharedId });

    // Add the node to the parent
    if (targetIndex !== undefined) {
      // Get the current children map
      const currentChildrenMap = hierarchyStore.get(childrenMapAtom);
      const siblings = currentChildrenMap.get(targetParentId) || [];
      const safeIndex = Math.max(0, Math.min(targetIndex, siblings.length));
      insertAtIndex(cloneId, targetParentId, safeIndex);
    } else {
      addNode(cloneId, targetParentId);
    }

    // Update style to relative for viewport children
    updateNodeStyle(cloneId, {
      position: "relative",
      left: "",
      top: "",
      zIndex: "",
    });

    // Update viewport flag
    updateNodeFlags(cloneId, {
      inViewport: true,
    });

    // Now recursively duplicate all children
    const currentChildrenMap = hierarchyStore.get(childrenMapAtom);
    const sourceChildren = currentChildrenMap.get(sourceNodeId) || [];

    sourceChildren.forEach((childId, index) => {
      const childNode = allNodes.find((n) => n.id === childId);
      if (!childNode) {
        console.warn(`Child node ${childId} not found, skipping`);
        return;
      }

      // FIX: Preserve the child's existing shared ID if it has one
      // Otherwise, use a predictable ID pattern based on the parent shared ID
      const childSharedId = childNode.sharedId || `${sharedId}-child-${index}`;

      console.log(
        `Duplicating child ${childId} with shared ID ${childSharedId}`
      );
      duplicateNodeToViewport(childId, cloneId, childSharedId);
    });

    console.log(`Successfully duplicated node ${sourceNodeId} to ${cloneId}`);
    return cloneId;
  } catch (e) {
    console.error("Error duplicating node to viewport:", e);
    return sourceNodeId; // Return original ID as fallback
  }
}
