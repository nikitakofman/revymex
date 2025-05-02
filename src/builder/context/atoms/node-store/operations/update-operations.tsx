import {
  NodeId,
  nodeStore,
  nodeFlagsAtom,
  nodeSharedInfoAtom,
  nodeDynamicInfoAtom,
} from "../";
import { batchNodeUpdates } from "../";

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
