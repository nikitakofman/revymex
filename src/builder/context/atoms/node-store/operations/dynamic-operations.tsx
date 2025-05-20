// src/builder/context/atoms/node-store/operations/dynamic-operations.ts

import { NodeId, nodeStore, batchNodeUpdates, getCurrentNodes } from "../index";
import { updateNodeStyle } from "./style-operations";
import { findParentViewport } from "../../../utils";
import { atom } from "jotai/vanilla";

// Create atoms for dynamic mode state
export const dynamicModeNodeIdAtom = atom<NodeId | null>(null);
export const activeViewportInDynamicModeAtom = atom<NodeId | null>(null);

// Initialize the atoms in the nodeStore
nodeStore.set(dynamicModeNodeIdAtom, null);
nodeStore.set(activeViewportInDynamicModeAtom, null);

/**
 * Enter dynamic mode by setting the dynamic mode node ID
 * @param nodeId ID of the node to make the dynamic mode focus
 * @param viewportId Optional ID of the viewport to use for context
 */
export function setDynamicModeNodeId(
  nodeId: NodeId | null,
  viewportId?: NodeId | null
) {
  batchNodeUpdates(() => {
    nodeStore.set(dynamicModeNodeIdAtom, nodeId);

    if (viewportId) {
      nodeStore.set(activeViewportInDynamicModeAtom, viewportId);
    } else if (!nodeId) {
      // If exiting dynamic mode, clear viewport too
      nodeStore.set(activeViewportInDynamicModeAtom, null);
    }
  });
}

/**
 * Set the active viewport to use in dynamic mode
 * @param viewportId ID of the viewport to use
 */
export function setActiveViewportInDynamicMode(viewportId: NodeId | null) {
  nodeStore.set(activeViewportInDynamicModeAtom, viewportId);
}

/**
 * Enter dynamic mode for a node and set its position to absolute
 * @param nodeId ID of the node to enter dynamic mode
 */
export function enterDynamicMode(nodeId: NodeId) {
  const allNodes = getCurrentNodes();
  const node = allNodes.find((n) => n.id === nodeId);

  if (!node || !node.isDynamic) {
    console.warn("Cannot enter dynamic mode for non-dynamic node:", nodeId);
    return;
  }

  // Make sure the node is positioned absolutely for dynamic mode
  updateNodeStyle(nodeId, { position: "absolute" });

  // Find the appropriate viewport for this node
  const parentViewportId =
    node.dynamicViewportId ||
    findParentViewport(node.originalParentId as string, allNodes) ||
    findParentViewport(node.parentId as string, allNodes);

  // Set the active viewport
  if (parentViewportId) {
    console.log(`Setting active viewport to: ${parentViewportId}`);
    setActiveViewportInDynamicMode(parentViewportId);
  } else {
    console.warn("Could not determine viewport for node:", nodeId);
    setActiveViewportInDynamicMode("viewport-1440");
  }

  // Set the dynamic mode node ID
  setDynamicModeNodeId(nodeId);
}

/**
 * Exit dynamic mode
 */
export function exitDynamicMode() {
  setDynamicModeNodeId(null);
  setActiveViewportInDynamicMode(null);
}

/**
 * Check if a node is part of the dynamic mode hierarchy
 * @param nodeId ID of the node to check
 * @param dynamicModeNodeId ID of the dynamic mode node
 * @param getNodeParent Function to get a node's parent
 * @returns boolean indicating if the node is in the dynamic hierarchy
 */
export function isInDynamicModeHierarchy(
  nodeId: NodeId,
  dynamicModeNodeId: NodeId,
  getNodeParent: (id: NodeId) => NodeId | null
): boolean {
  if (!dynamicModeNodeId) return false;
  if (nodeId === dynamicModeNodeId) return true;

  // Check if this is a child of the dynamic node
  let currentParent = getNodeParent(nodeId);
  while (currentParent) {
    if (currentParent === dynamicModeNodeId) {
      return true;
    }
    currentParent = getNodeParent(currentParent);
  }

  return false;
}

/**
 * Get the current dynamic mode node ID
 * @returns The ID of the currently active dynamic mode node, or null
 */
export function getDynamicModeNodeId(): NodeId | null {
  return nodeStore.get(dynamicModeNodeIdAtom);
}

/**
 * Get the current active viewport in dynamic mode
 * @returns The ID of the active viewport in dynamic mode, or null
 */
export function getActiveViewportInDynamicMode(): NodeId | null {
  return nodeStore.get(activeViewportInDynamicModeAtom);
}
