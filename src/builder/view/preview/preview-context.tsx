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
  setDynamicVariants: React.Dispatch<
    React.SetStateAction<{ [nodeId: string]: ResponsiveNode }>
  >;
};

const defaultContextValue: PreviewContextType = {
  originalNodes: [],
  currentViewport: 1440,
  viewportBreakpoints: [],
  initialNodeTree: [],
  nodeTree: [],
  dynamicVariants: {},
  transformNode: () => {},
  setDynamicVariants: () => {},
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
      // Find the current viewport in breakpoints
      const getActiveBreakpoint = (width, breakpoints) => {
        const sortedBreakpoints = [...breakpoints].sort(
          (a, b) => b.width - a.width
        );

        for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
          const current = sortedBreakpoints[i];
          const next = sortedBreakpoints[i + 1];

          if (width > next.width && width <= current.width) {
            return current;
          }
        }

        if (width <= sortedBreakpoints[sortedBreakpoints.length - 1].width) {
          return sortedBreakpoints[sortedBreakpoints.length - 1];
        }

        return sortedBreakpoints[0];
      };

      const currentViewportObj = getActiveBreakpoint(
        currentViewport,
        viewportBreakpoints
      );

      if (!currentViewportObj) {
        return;
      }

      // First, find the node for this ID
      let sourceNode = findNodeById(nodeTree, sourceId);
      let isResponsiveNode = false;
      let isChildTrigger = false;

      if (!sourceNode) {
        sourceNode = originalNodes.find((n) => n.id === sourceId);
        if (!sourceNode) {
          return;
        }

        isChildTrigger = Boolean(sourceNode.dynamicParentId);
      } else {
        // If found in nodeTree, it's a responsive node
        isResponsiveNode = true;
        isChildTrigger = Boolean(sourceNode.dynamicParentId);
      }

      // If this node has a sharedId, find the version for the current viewport
      if (sourceNode.sharedId && !isChildTrigger) {
        // Try to find a version of this node with the same sharedId that's in the current viewport
        const viewportNode = originalNodes.find(
          (n) =>
            n.sharedId === sourceNode.sharedId &&
            n.parentId === currentViewportObj.id
        );

        if (viewportNode && viewportNode.id !== sourceNode.id) {
          sourceNode = viewportNode;
        }
      }

      // Check if we're dealing with an already transformed node (variant cycling)
      const existingVariant = dynamicVariants[sourceId];
      if (existingVariant) {
        // Check if the variant has connections for this specific event type
        const hasConnectionsForEventType =
          existingVariant.dynamicConnections &&
          existingVariant.dynamicConnections.some((conn) => conn.type === type);

        if (!hasConnectionsForEventType) {
          return; // Important: exit early if no connections for this event type
        }

        // If we have a variant with connections, use them instead
        if (
          existingVariant.dynamicConnections &&
          existingVariant.dynamicConnections.length > 0
        ) {
          // Look for connection in the active variant
          const connection = existingVariant.dynamicConnections.find(
            (conn) => conn.type === type
          );

          if (connection) {
            // Find target node
            let targetNode = findNodeById(initialNodeTree, connection.targetId);
            if (!targetNode) {
              targetNode = buildResponsiveSubtree(
                connection.targetId,
                originalNodes
              );
            }

            if (!targetNode) {
              return;
            }

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
            return; // Exit early - no connection for this event type
          }
        }
      }

      // Check if this node has connections
      if (
        !sourceNode.dynamicConnections ||
        sourceNode.dynamicConnections.length === 0
      ) {
        return;
      }

      // Find the connection that matches the event type
      const connection = sourceNode.dynamicConnections.find(
        (conn) => conn.type === type
      );

      if (!connection) {
        return;
      }

      // Try to find the target node in the initial tree
      let targetNode = findNodeById(initialNodeTree, connection.targetId);
      if (!targetNode) {
        const subtree = buildResponsiveSubtree(
          connection.targetId,
          originalNodes
        );
        if (subtree) {
          targetNode = subtree;
        }
      }

      if (!targetNode) {
        return;
      }

      // Determine the key for variant storage
      let variantKey = sourceId;

      // If this is a child trigger, we need to ensure it's stored under the correct parent ID
      if (isChildTrigger && sourceNode.dynamicParentId) {
        // Verify if this parent ID actually exists as a dynamic node in the tree
        const parentExists = nodeTree.some(
          (node) => node.id === sourceNode.dynamicParentId
        );

        if (parentExists) {
          variantKey = sourceNode.dynamicParentId;
          console.log(
            `Child trigger: storing variant under parent ID: ${variantKey}`
          );
        } else {
          // Maybe the parent has a different ID in different viewports?
          // Try to find a matching parent node
          console.log(
            `Parent ID ${sourceNode.dynamicParentId} not found in nodeTree, searching for alternative...`
          );
          const possibleParent = originalNodes.find(
            (node) =>
              node.isDynamic &&
              // Either the node has the same ID as dynamicParentId
              (node.id === sourceNode.dynamicParentId ||
                // Or the node has the same shared ID as the parent referenced in dynamicParentId
                (node.sharedId &&
                  originalNodes.some(
                    (n) =>
                      n.id === sourceNode.dynamicParentId &&
                      n.sharedId === node.sharedId
                  )))
          );

          if (possibleParent) {
            variantKey = possibleParent.id;
            console.log(`Found alternative parent ID: ${variantKey}`);
          }
        }
      }
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
      setDynamicVariants((prev) => ({
        ...prev,
        [variantKey]: enhancedVariant,
      }));
    };
  }, [
    nodeTree,
    initialNodeTree,
    originalNodes,
    dynamicVariants,
    currentViewport,
    viewportBreakpoints,
  ]);

  const contextValue = useMemo(
    () => ({
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
      setDynamicVariants,
    }),
    [
      originalNodes,
      currentViewport,
      viewportBreakpoints,
      initialNodeTree,
      nodeTree,
      dynamicVariants,
      transformNode,
      setDynamicVariants,
    ]
  );

  return (
    <PreviewContext.Provider value={contextValue}>
      {children}
    </PreviewContext.Provider>
  );
};

export const usePreview = () => useContext(PreviewContext);
