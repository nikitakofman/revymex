import { CSSProperties } from "react";
import {
  NodeId,
  nodeStore,
  nodeSharedInfoAtom,
  nodeSyncFlagsAtom,
  viewportOrderAtom,
} from "../";
import {
  findNodesWithSharedId,
  findViewportForNode,
  hasUnsyncBarrier,
  markNodeAsUnsynced,
} from "./utils-rules";

// Types for the rule system
interface StyleOperation {
  type: "update";
  targetId: NodeId;
  style: CSSProperties;
  reason: string;
}

// Type for a style rule
export interface StyleRule {
  name: string;
  description: string;
  condition: (nodeId: NodeId, style: CSSProperties) => boolean;
  operations: (nodeId: NodeId, style: CSSProperties) => StyleOperation[];
  after?: (nodeId: NodeId, style: CSSProperties) => void;
}

export const viewportCascadingRule = {
  name: "viewport-cascading",
  description: "Cascade style changes based on viewport hierarchy",

  // Rule applies when node has a sharedId (has responsive counterparts)
  condition: (nodeId: NodeId) => {
    const sharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
    return !!sharedInfo.sharedId;
  },

  // Generate operations for cascading changes to other nodes
  operations: (nodeId: NodeId, style: CSSProperties) => {
    const operations: StyleOperation[] = [];

    // Get node's sharedId
    const sharedInfo = nodeStore.get(nodeSharedInfoAtom(nodeId));
    const sharedId = sharedInfo.sharedId;
    if (!sharedId) return operations;

    // Get all viewports ordered by size (largest/desktop first)
    const viewportOrder = nodeStore.get(viewportOrderAtom);

    // Get current node's viewport information
    const nodeViewportId = findViewportForNode(nodeId);
    if (!nodeViewportId) return operations;

    const currentViewportIndex = viewportOrder.indexOf(nodeViewportId);
    if (currentViewportIndex === -1) return operations;

    // Find all nodes with the same sharedId
    const sharedNodes = findNodesWithSharedId(sharedId);

    // Properties being changed - we'll use this to check for barriers
    const changedProps = Object.keys(style);

    // Different behavior based on viewport level
    if (currentViewportIndex === 0) {
      // We're in the highest viewport (desktop)
      // Cascade to all lower viewports, respecting protection flags and unsync barriers

      sharedNodes.forEach((targetId) => {
        if (targetId === nodeId) return; // Skip source node

        const targetViewportId = findViewportForNode(targetId);
        if (!targetViewportId) return;

        const targetViewportIndex = viewportOrder.indexOf(targetViewportId);
        if (
          targetViewportIndex === -1 ||
          targetViewportIndex <= currentViewportIndex
        )
          return;

        // Check if there's an unsync barrier between desktop and this target viewport
        const hasBarrier = hasUnsyncBarrier(
          sharedId,
          currentViewportIndex,
          targetViewportIndex,
          viewportOrder,
          changedProps
        );

        if (hasBarrier) {
          // Skip this node - there's an unsync barrier in a viewport between source and target
          return;
        }

        // Check if target itself has protection flags for any properties
        const syncFlags = nodeStore.get(nodeSyncFlagsAtom(targetId));

        const hasProtection = changedProps.some(
          (prop) =>
            syncFlags.unsyncFromParentViewport?.[prop] ||
            syncFlags.lowerSyncProps?.[prop]
        );

        if (!hasProtection) {
          operations.push({
            type: "update",
            targetId,
            style,
            reason: `Cascading from desktop viewport to lower viewport`,
          });
        }
      });
    } else {
      // We're in a lower viewport (tablet, mobile, etc.)

      // 1. Mark this node's changed properties as unsynced from parent viewport
      markNodeAsUnsynced(nodeId, changedProps);

      // 2. Only cascade to even lower viewports
      sharedNodes.forEach((targetId) => {
        if (targetId === nodeId) return; // Skip source node

        const targetViewportId = findViewportForNode(targetId);
        if (!targetViewportId) return;

        const targetViewportIndex = viewportOrder.indexOf(targetViewportId);

        // Only cascade to immediately lower viewports
        if (targetViewportIndex > currentViewportIndex) {
          // Check if there's an unsync barrier between this viewport and the target
          const hasBarrier = hasUnsyncBarrier(
            sharedId,
            currentViewportIndex,
            targetViewportIndex,
            viewportOrder,
            changedProps
          );

          if (hasBarrier) {
            // Skip this node - there's an unsync barrier in a viewport between source and target
            return;
          }

          // Check if target has protection flags
          const syncFlags = nodeStore.get(nodeSyncFlagsAtom(targetId));

          const hasProtection = changedProps.some(
            (prop) =>
              syncFlags.unsyncFromParentViewport?.[prop] ||
              syncFlags.lowerSyncProps?.[prop] ||
              syncFlags.independentStyles?.[prop]
          );

          if (!hasProtection) {
            operations.push({
              type: "update",
              targetId,
              style,
              reason: `Cascading from lower viewport to even lower viewport`,
            });
          }
        }
      });
    }

    return operations;
  },
};

// Export the collection of style rules
export const STYLE_RULES: StyleRule[] = [
  // Rule for cascading styles based on viewport hierarchy
  viewportCascadingRule,
];
