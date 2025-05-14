import {
  NodeId,
  nodeStore,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
  changedNodesAtom,
} from "../";
import { batchNodeUpdates } from "../";
import { updateNodeStyle } from "./style-operations";

/**
 * Update a node's flags
 * @param nodeId ID of the node to update
 * @param updates Object containing the flag updates to apply
 */
export function updateNodeFlags(
  nodeId: NodeId,
  updates: Partial<{
    isViewport: boolean;
    viewportWidth: number;
    viewportName: string;
    isVariant: boolean;
    isDynamic: boolean;
    isLocked: boolean;
    isAbsoluteInFrame: boolean;
    inViewport: boolean;
    [key: string]: any;
  }>
) {
  batchNodeUpdates(() => {
    nodeStore.set(nodeFlagsAtom(nodeId), (prev) => ({
      ...prev,
      ...updates,
    }));
  });
}

/**
 * Update a node's shared information
 * @param nodeId ID of the node to update
 * @param updates Object containing the shared info updates to apply
 */
export function updateNodeSharedInfo(
  nodeId: NodeId,
  updates: Partial<{
    sharedId: string | undefined;
    [key: string]: any;
  }>
) {
  batchNodeUpdates(() => {
    nodeStore.set(nodeSharedInfoAtom(nodeId), (prev) => ({
      ...prev,
      ...updates,
    }));
  });
}

/**
 * Update a node's dynamic information
 * @param nodeId ID of the node to update
 * @param updates Object containing the dynamic info updates to apply
 */
export function updateNodeDynamicInfo(
  nodeId: NodeId,
  updates: Partial<{
    dynamicViewportId: string | null;
    dynamicFamilyId: string | null;
    dynamicParentId: string | null;
    dynamicConnections: Record<string, any>;
    dynamicPosition: { x: number; y: number } | null;
    originalParentId: string | null;
    originalState: Record<string, any> | null;
    variantResponsiveId: string | null;
    [key: string]: any;
  }>
) {
  batchNodeUpdates(() => {
    nodeStore.set(nodeDynamicInfoAtom(nodeId), (prev) => ({
      ...prev,
      ...updates,
    }));
  });
}

/**
 * Update a viewport node's width and name
 * @param viewportId ID of the viewport to update
 * @param width New width for the viewport
 * @param name New name for the viewport
 */
export function updateViewport(
  viewportId: NodeId,
  width: number,
  name: string
) {
  // Batch updates for better performance
  batchNodeUpdates(() => {
    // Check if viewport exists and is actually a viewport
    const flags = nodeStore.get(nodeFlagsAtom(viewportId));
    if (!flags.isViewport) {
      console.error(`Node ${viewportId} is not a viewport`);
      return;
    }

    // Update the viewport width flag
    nodeStore.set(nodeFlagsAtom(viewportId), (prev) => ({
      ...prev,
      viewportWidth: width,
      viewportName: name,
    }));

    // Update the viewport's style width with dontSync option
    updateNodeStyle(viewportId, { width: `${width}px` }, { dontSync: true });

    // Mark the node as changed for optimization
    nodeStore.set(changedNodesAtom, (prev: Set<NodeId>) => {
      const newSet = new Set(prev);
      newSet.add(viewportId);
      return newSet;
    });

    // Reset any nodes with styles tied to viewport width (advanced feature)
    // This would be implemented if there are viewport-dependent styles
  });
}
