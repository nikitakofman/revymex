import { Node } from "@/builder/reducer/nodeDispatcher";
import {
  nodeStore,
  nodeIdsAtom,
  nodeBasicsAtom,
  nodeStyleAtom,
  nodeFlagsAtom,
  nodeParentAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
  nodeVariantInfoAtom,
  nodeSyncFlagsAtom,
  nodeDynamicStateAtom,
  changedNodesAtom,
  batchNodeUpdates,
} from "../";

/**
 * Completely replace the entire node tree with a new set of nodes
 */
export function pushNodes(nodes: Node[]) {
  batchNodeUpdates(() => {
    // Clear existing nodes
    nodeStore.set(nodeIdsAtom, []);

    // Add all the new nodes
    nodeStore.set(
      nodeIdsAtom,
      nodes.map((node) => node.id)
    );

    // Set all the individual node atoms
    nodes.forEach((node) => {
      // Basic properties
      nodeStore.set(nodeBasicsAtom(node.id), {
        id: node.id,
        type: node.type,
        customName: node.customName,
      });

      // Style
      nodeStore.set(nodeStyleAtom(node.id), node.style || {});

      // Parent
      nodeStore.set(nodeParentAtom(node.id), node.parentId);

      // Flags
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

      // Shared info
      nodeStore.set(nodeSharedInfoAtom(node.id), {
        sharedId: node.sharedId,
      });

      // Dynamic info
      nodeStore.set(nodeDynamicInfoAtom(node.id), {
        dynamicParentId: node.dynamicParentId,
        dynamicViewportId: node.dynamicViewportId,
        dynamicConnections: node.dynamicConnections,
        dynamicPosition: node.dynamicPosition,
        dynamicFamilyId: node.dynamicFamilyId,
        originalParentId: node.originalParentId,
        originalState: node.originalState,
      });

      // Variant info
      nodeStore.set(nodeVariantInfoAtom(node.id), {
        variantParentId: node.variantParentId,
        variantInfo: node.variantInfo,
        variantResponsiveId: node.variantResponsiveId,
      });

      // Dynamic state
      nodeStore.set(nodeDynamicStateAtom(node.id), node.dynamicState || {});

      // Sync flags
      nodeStore.set(nodeSyncFlagsAtom(node.id), {
        independentStyles: node.independentStyles || {},
        unsyncFromParentViewport: node.unsyncFromParentViewport || {},
        variantIndependentSync: node.variantIndependentSync || {},
        lowerSyncProps: node.lowerSyncProps || {},
      });
    });

    // Mark all nodes as changed
    nodeStore.set(changedNodesAtom, new Set(nodes.map((node) => node.id)));
  });
}
