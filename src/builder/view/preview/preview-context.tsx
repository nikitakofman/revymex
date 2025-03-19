// preview-context.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { Node, ResponsiveNode, Viewport } from "./types";
import { buildResponsiveNodeTree } from "./hooks/useResponsiveNodeTree";
import { findNodeById, processInitialDynamicNodes } from "./utils/nodeUtils";
import { buildResponsiveSubtree } from "./utils/sub-tree-builder";

type PreviewContextType = {
  originalNodes: Node[];
  currentViewport: number;
  viewportBreakpoints: Viewport[];
  initialNodeTree: ResponsiveNode[];
  nodeTree: ResponsiveNode[];
  dynamicVariants: { [nodeId: string]: ResponsiveNode };
  transformNode: (sourceId: string, type: string) => void;
};

const defaultContextValue: PreviewContextType = {
  originalNodes: [],
  currentViewport: 1440,
  viewportBreakpoints: [],
  initialNodeTree: [],
  nodeTree: [],
  dynamicVariants: {},
  transformNode: () => {},
};

const PreviewContext = createContext<PreviewContextType>(defaultContextValue);

export const PreviewProvider: React.FC<{
  children: ReactNode;
  nodes: Node[];
}> = ({ children, nodes }) => {
  const originalNodes = useMemo(() => nodes, [nodes]);

  // Basic viewport handling
  const [currentViewport, setCurrentViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  const viewportBreakpoints = useMemo(() => {
    return nodes
      .filter((node) => node.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0))
      .map((viewport) => ({
        id: viewport.id,
        width: viewport.viewportWidth || 0,
        name: viewport.viewportName || "",
      }));
  }, [nodes]);

  // Build initial tree
  const initialNodeTree = useMemo(() => {
    return buildResponsiveNodeTree(nodes, viewportBreakpoints);
  }, [nodes, viewportBreakpoints]);

  const [nodeTree, setNodeTree] = useState<ResponsiveNode[]>([]);
  const [dynamicVariants, setDynamicVariants] = useState<{
    [nodeId: string]: ResponsiveNode;
  }>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setCurrentViewport(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const processed = processInitialDynamicNodes(initialNodeTree);
    setNodeTree(processed);
  }, [initialNodeTree]);

  // The transformNode function:
  const transformNode = useMemo(() => {
    return (sourceId: string, type: string) => {
      console.log(`transformNode: sourceId=${sourceId}, type=${type}`);

      // Check if we're dealing with an already transformed node
      // This is the critical part for cycling from parent variant to parent variant
      const existingVariant = dynamicVariants[sourceId];
      if (existingVariant) {
        console.log(`Source is already a variant: ${sourceId}`);

        // Check if the variant has connections for this specific event type
        const hasConnectionsForEventType =
          existingVariant.dynamicConnections &&
          existingVariant.dynamicConnections.some((conn) => conn.type === type);

        if (!hasConnectionsForEventType) {
          console.log(
            `Variant has no connections for event type: ${type}, skipping transformation`
          );
          return; // Important: exit early if no connections for this event type
        }

        // If we have a variant with connections, use them instead
        if (
          existingVariant.dynamicConnections &&
          existingVariant.dynamicConnections.length > 0
        ) {
          console.log(`Using connections from active variant for cycling`);

          // Look for connection in the active variant
          const connection = existingVariant.dynamicConnections.find(
            (conn) => conn.type === type
          );

          if (connection) {
            console.log(
              `Found connection in active variant: ${connection.sourceId} -> ${connection.targetId}`
            );

            // Find target node
            let targetNode = findNodeById(initialNodeTree, connection.targetId);
            if (!targetNode) {
              targetNode = buildResponsiveSubtree(
                connection.targetId,
                originalNodes
              );
            }

            if (!targetNode) {
              console.log(
                `Target node not found for variant connection: ${connection.targetId}`
              );
              return;
            }

            console.log(`Found target for variant cycling: ${targetNode.id}`);

            // Create enhanced variant with preserved connections
            const nextVariant = {
              ...targetNode,
              _originalTargetId: connection.targetId,
              targetId: connection.targetId,
              id: sourceId, // Use the current ID to maintain continuity
              dynamicConnections: targetNode.dynamicConnections || [],
            };

            // Apply the next variant
            setDynamicVariants((prev) => ({
              ...prev,
              [sourceId]: nextVariant,
            }));

            return; // Exit early - we've handled the variant cycling
          } else {
            console.log(
              `No matching connection found in variant for event type: ${type}`
            );
            return; // Exit early - no connection for this event type
          }
        }
      }

      // Standard processing for first-time transformations
      // Find the source node from nodeTree; fallback to originalNodes for child nodes.
      let sourceNode = findNodeById(nodeTree, sourceId);
      let isChildTrigger = false;

      if (!sourceNode) {
        const originalNode = originalNodes.find((n) => n.id === sourceId);
        if (originalNode && originalNode.dynamicConnections) {
          sourceNode = originalNode;
          isChildTrigger = Boolean(originalNode.dynamicParentId);
          console.log("Found in original nodes:", sourceNode);
        } else {
          console.log("Node not found or no connections");
          return;
        }
      } else {
        // If found in nodeTree, check if it's a child node
        isChildTrigger = Boolean(sourceNode.dynamicParentId);
      }

      if (
        !sourceNode.dynamicConnections ||
        sourceNode.dynamicConnections.length === 0
      ) {
        console.log("Node has no dynamic connections:", sourceId);
        return;
      }

      // Find the connection that matches the event type.
      const connection = sourceNode.dynamicConnections.find(
        (conn) => conn.type === type
      );
      if (!connection) {
        console.log("No matching connection for type:", type);
        return;
      }
      console.log("Found connection:", connection);

      // Try to find the target node in the initial tree.
      let targetNode = findNodeById(initialNodeTree, connection.targetId);
      if (!targetNode) {
        console.log("Not found in initial tree, building sub-tree...");
        const subtree = buildResponsiveSubtree(
          connection.targetId,
          originalNodes
        );
        if (subtree) {
          targetNode = subtree;
        }
      }
      if (!targetNode) {
        console.log("Target node not found anywhere:", connection.targetId);
        return;
      }
      console.log("Found target node:", targetNode);

      // Determine the key for variant storage
      const variantKey = isChildTrigger ? sourceNode.dynamicParentId : sourceId;
      console.log(`Using variant key for storage: ${variantKey}`);

      // IMPORTANT: Store a modified variant with additional information
      // that will help the DynamicNode component find children
      const enhancedVariant = {
        ...targetNode,
        // Store the original target ID so the DynamicNode can find children
        _originalTargetId: connection.targetId,
        // Also store as targetId for compatibility
        targetId: connection.targetId,
        // Set the ID to match where we're storing it
        id: variantKey,
        // CRITICAL: Preserve the connections from the target node
        // This single line is what enables cycling through variants
        dynamicConnections: targetNode.dynamicConnections || [],
      };

      console.log(
        `Storing variant with _originalTargetId: ${connection.targetId}`
      );
      console.log(
        `Preserving ${enhancedVariant.dynamicConnections.length} connections for cycling`
      );
      setDynamicVariants((prev) => ({
        ...prev,
        [variantKey]: enhancedVariant,
      }));
    };
  }, [nodeTree, initialNodeTree, originalNodes, dynamicVariants]);

  const contextValue = useMemo(
    () => ({
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
    }),
    [
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
    ]
  );

  return (
    <PreviewContext.Provider value={contextValue}>
      {children}
    </PreviewContext.Provider>
  );
};

export const usePreview = () => useContext(PreviewContext);
