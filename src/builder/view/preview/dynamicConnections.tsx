import { Node } from "@/builder/reducer/nodeDispatcher";
import { ResponsiveNode } from "./types"; // You'll need to create this type file or import from where it's defined

/**
 * Checks if a node has any dynamic connections of a specific type
 */
export function hasConnectionOfType(
  node: ResponsiveNode | Node,
  originalNodes: Node[],
  type: "click" | "hover"
): boolean {
  // Find the correct node for connections
  let sourceNodeId =
    "originalId" in node ? node.originalId || node.id : node.id;

  // Find the node with connections
  const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return false;

  // Check if it has connections of specified type
  return (
    sourceNode.dynamicConnections?.some(
      (conn) => conn.sourceId === sourceNodeId && conn.type === type
    ) ?? false
  );
}

/**
 * Gets connection target for a specific connection type
 */
export function getConnectionTarget(
  node: ResponsiveNode | Node,
  originalNodes: Node[],
  type: "click" | "hover",
  activeVariantId?: string | number | null
): string | number | null {
  // If we're already showing a variant, we need to use that variant's ID for connections
  let sourceNodeId =
    "originalId" in node ? node.originalId || node.id : node.id;

  if (activeVariantId) {
    const activeVariantNode = originalNodes.find(
      (n) => n.id === activeVariantId
    );
    if (activeVariantNode && activeVariantNode.dynamicConnections) {
      sourceNodeId = activeVariantId;
    }
  }

  // Find the node with connections
  const sourceNode = originalNodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return null;

  // Find connection of specified type
  const connection = sourceNode.dynamicConnections?.find(
    (conn) => conn.sourceId === sourceNodeId && conn.type === type
  );

  return connection ? connection.targetId : null;
}

/**
 * Handle click on a dynamic element
 */
export function handleDynamicClick(
  node: ResponsiveNode,
  originalNodes: Node[],
  activeVariantId: string | number | null,
  setNodeState: (nodeId: string, stateId: string | number | null) => void
): void {
  const targetId = getConnectionTarget(
    node,
    originalNodes,
    "click",
    activeVariantId
  );

  if (targetId) {
    console.log(`Switching from ${node.id} to ${targetId}`);
    setNodeState(node.id, targetId);
  }
}

/**
 * Handle mouse enter for hover connections
 */
export function handleDynamicMouseEnter(
  node: ResponsiveNode,
  originalNodes: Node[],
  activeVariantId: string | number | null,
  setNodeState: (nodeId: string, stateId: string | number | null) => void
): void {
  const targetId = getConnectionTarget(
    node,
    originalNodes,
    "hover",
    activeVariantId
  );

  if (targetId) {
    console.log(`Hover connection from ${node.id} to ${targetId}`);
    setNodeState(node.id, targetId);
  }
}

/**
 * Handle mouse leave for hover connections
 */
export function handleDynamicMouseLeave(
  node: ResponsiveNode,
  originalNodes: Node[],
  setNodeState: (nodeId: string, stateId: string | number | null) => void
): void {
  // Check if the node has a hover connection
  if (hasConnectionOfType(node, originalNodes, "hover")) {
    console.log(`Hover ended for ${node.id}`);
    setNodeState(node.id, null); // Reset to default state
  }
}

/**
 * Get mouse event handlers for a node
 */
export function getDynamicEventHandlers(
  node: ResponsiveNode,
  originalNodes: Node[],
  activeVariantId: string | number | null,
  setNodeState: (nodeId: string, stateId: string | number | null) => void
) {
  const hasClickConnection = hasConnectionOfType(node, originalNodes, "click");
  const hasHoverConnection = hasConnectionOfType(node, originalNodes, "hover");

  const handlers: {
    onClick?: (e: React.MouseEvent) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  } = {};

  if (hasClickConnection) {
    handlers.onClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleDynamicClick(node, originalNodes, activeVariantId, setNodeState);
    };
  }

  if (hasHoverConnection) {
    handlers.onMouseEnter = () =>
      handleDynamicMouseEnter(
        node,
        originalNodes,
        activeVariantId,
        setNodeState
      );

    handlers.onMouseLeave = () =>
      handleDynamicMouseLeave(node, originalNodes, setNodeState);
  }

  return handlers;
}

/**
 * Get interactive style properties for dynamic elements
 */
export function getDynamicStyles(
  node: ResponsiveNode | Node,
  originalNodes: Node[]
) {
  const hasDynamicConnection =
    hasConnectionOfType(node, originalNodes, "click") ||
    hasConnectionOfType(node, originalNodes, "hover");

  if (hasDynamicConnection || ("isDynamic" in node && node.isDynamic)) {
    return {
      cursor: "pointer",
      transition: "all 0.3s ease",
    };
  }

  return {};
}
