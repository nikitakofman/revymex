import {
  nodeFlagsAtom,
  NodeId,
  nodeIdsAtom,
  nodeParentAtom,
  nodeSharedInfoAtom,
  nodeStore,
  nodeSyncFlagsAtom,
} from "..";

/**
 * Find all nodes with the same sharedId
 */
export function findNodesWithSharedId(sharedId: string): NodeId[] {
  const allNodeIds = nodeStore.get(nodeIdsAtom);
  return allNodeIds.filter((id) => {
    const sharedInfo = nodeStore.get(nodeSharedInfoAtom(id));
    return sharedInfo.sharedId === sharedId;
  });
}

/**
 * Mark a node's properties as unsynced from parent viewport
 */
export function markNodeAsUnsynced(nodeId: NodeId, properties: string[]): void {
  const syncFlags = nodeStore.get(nodeSyncFlagsAtom(nodeId));
  const updatedUnsyncProps = {
    ...(syncFlags.unsyncFromParentViewport || {}),
  };

  // Mark each property as unsynced
  properties.forEach((prop) => {
    updatedUnsyncProps[prop] = true;
  });

  // Update the sync flags
  nodeStore.set(nodeSyncFlagsAtom(nodeId), {
    ...syncFlags,
    unsyncFromParentViewport: updatedUnsyncProps,
  });

  // Also update independentStyles for lower viewports
  const updatedIndependentStyles = {
    ...(syncFlags.independentStyles || {}),
  };

  // Mark each property as independent
  properties.forEach((prop) => {
    updatedIndependentStyles[prop] = true;
  });

  // Update the sync flags
  nodeStore.set(nodeSyncFlagsAtom(nodeId), {
    ...syncFlags,
    unsyncFromParentViewport: updatedUnsyncProps,
    independentStyles: updatedIndependentStyles,
  });
}

/**
 * Find the viewport for a node
 */
export function findViewportForNode(nodeId: NodeId): NodeId | null {
  const flags = nodeStore.get(nodeFlagsAtom(nodeId));

  // If node itself is a viewport
  if (flags.isViewport) {
    return nodeId;
  }

  // Otherwise check parent chain
  let currentId: NodeId | null = nodeId;

  while (currentId) {
    const parentId: NodeId | null = nodeStore.get(nodeParentAtom(currentId));
    if (!parentId) break;

    const parentFlags = nodeStore.get(nodeFlagsAtom(parentId));
    if (parentFlags.isViewport) {
      return parentId;
    }

    currentId = parentId;
  }

  return null;
}

export function hasUnsyncBarrier(
  sharedId: string,
  sourceViewportIndex: number,
  targetViewportIndex: number,
  viewportOrder: NodeId[],
  properties: string[]
): boolean {
  // Loop through each viewport between source and target
  for (let i = sourceViewportIndex + 1; i < targetViewportIndex; i++) {
    const viewportId = viewportOrder[i];

    // Find nodes with this sharedId in this viewport
    const nodesInViewport = findNodesWithSharedId(sharedId).filter((nodeId) => {
      const nodeViewportId = findViewportForNode(nodeId);
      return nodeViewportId === viewportId;
    });

    // Check if any node in this viewport has unsyncFromParentViewport set for any property
    for (const nodeId of nodesInViewport) {
      const syncFlags = nodeStore.get(nodeSyncFlagsAtom(nodeId));

      if (
        properties.some((prop) => syncFlags.unsyncFromParentViewport?.[prop])
      ) {
        return true; // Found an unsync barrier
      }
    }
  }

  return false; // No unsync barrier found
}
