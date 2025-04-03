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

  const getAllConnectionsForNode = (nodeId, eventType) => {
    const connections = [];

    // First, look for connections in the original node
    const sourceNode = originalNodes.find((n) => n.id === nodeId);
    if (sourceNode && sourceNode.dynamicConnections) {
      const sourceConnections = sourceNode.dynamicConnections.filter(
        (conn) => conn.type === eventType
      );
      connections.push(...sourceConnections);
    }

    // Next, look for connections in any target variants that match this node's shared ID
    if (sourceNode && sourceNode.sharedId) {
      const variantNodes = originalNodes.filter(
        (n) =>
          n.sharedId === sourceNode.sharedId && n.isVariant && n.id !== nodeId
      );

      variantNodes.forEach((variantNode) => {
        if (variantNode.dynamicConnections) {
          const variantConnections = variantNode.dynamicConnections.filter(
            (conn) => conn.type === eventType
          );
          connections.push(...variantConnections);
        }
      });
    }

    return connections;
  };

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
  // Updated transformNode function to fix connection detection issues
  // This should replace the transformNode function in the preview-context.tsx file

  // Updated transformNode function to fix connection detection issues
  // This should replace the transformNode function in the preview-context.tsx file

  // SIMPLIFIED TransformNode Fix - Replace your transformNode function with this version

  // Final transformNode function addressing all issues
  // Replace the current transformNode in preview-context.tsx with this version

  const transformNode = useMemo(() => {
    return (sourceId: string, type: string) => {
      console.log(
        `🔍 DEBUG: transformNode called for ${sourceId} with event type ${type}`
      );

      // First, find the node for this ID
      let sourceNode = originalNodes.find((n) => n.id === sourceId);
      if (!sourceNode) {
        console.warn(`Source node ${sourceId} not found`);
        return;
      }

      // Get the actual source node (handle child trigger case)
      let actualSourceId = sourceId;
      let actualSourceNode = sourceNode;

      if (sourceNode.dynamicParentId) {
        console.log(
          `This is a child trigger. Parent ID: ${sourceNode.dynamicParentId}`
        );
        const parentNode = originalNodes.find(
          (n) => n.id === sourceNode.dynamicParentId
        );
        if (parentNode) {
          actualSourceId = parentNode.id;
          actualSourceNode = parentNode;
        }
      }

      // Find the connection
      let connections = [];
      const existingVariant = dynamicVariants[actualSourceId];

      if (existingVariant) {
        console.log(`Source has active variant:`, existingVariant);
        const targetId =
          existingVariant.targetId || existingVariant._originalTargetId;
        if (targetId) {
          const targetNode = originalNodes.find((n) => n.id === targetId);
          if (targetNode && targetNode.dynamicConnections) {
            connections = targetNode.dynamicConnections.filter(
              (c) => c.type === type
            );
          }
        }
      } else if (sourceNode.dynamicConnections) {
        console.log(`Source has direct connections`);
        connections = sourceNode.dynamicConnections.filter(
          (c) => c.type === type
        );
      }

      if (connections.length === 0 && sourceNode.dynamicConnections) {
        console.log(`Using fallback connections from source node`);
        connections = sourceNode.dynamicConnections.filter(
          (c) => c.type === type
        );
      }

      if (connections.length === 0) {
        console.log(`❌ No connections found for event type ${type}`);
        return;
      }

      const connection = connections[0];
      console.log(
        `✅ Using connection: ${connection.sourceId || actualSourceId} -> ${
          connection.targetId
        }`
      );

      const targetNode = originalNodes.find(
        (n) => n.id === connection.targetId
      );
      if (!targetNode) {
        console.warn(`❌ Target node ${connection.targetId} not found`);
        return;
      }

      console.log(`Target Node Info:`, {
        id: targetNode.id,
        type: targetNode.type,
        isVariant: targetNode.isVariant,
        backgroundColor: targetNode.style.backgroundColor,
      });

      // Create enhanced variant
      const enhancedVariant = {
        ...targetNode,
        _originalTargetId: connection.targetId,
        targetId: connection.targetId,
        id: actualSourceId,
      };

      console.log(`💡 Enhanced Variant:`, {
        id: enhancedVariant.id,
        targetId: enhancedVariant.targetId,
        backgroundColor: enhancedVariant.style.backgroundColor,
      });

      // Update the variant
      setDynamicVariants((prev) => {
        const newVariants = { ...prev };
        newVariants[actualSourceId] = enhancedVariant;

        // Debug state update
        console.log(`📊 Updated dynamicVariants state:`, {
          [actualSourceId]: {
            id: enhancedVariant.id,
            targetId: enhancedVariant.targetId,
            backgroundColor: enhancedVariant.style.backgroundColor,
          },
        });

        return newVariants;
      });

      // Apply DOM changes for immediate feedback
      setTimeout(() => {
        try {
          // Debug DOM application
          const element = document.querySelector(
            `[data-node-id="${actualSourceId}"]`
          );
          if (element) {
            console.log(`🎨 DOM Before:`, {
              backgroundColor: element.style.backgroundColor,
              computedBgColor: window.getComputedStyle(element).backgroundColor,
            });

            // Apply background color directly
            if (targetNode.style.backgroundColor) {
              element.style.backgroundColor = targetNode.style.backgroundColor;
              console.log(
                `🎨 Setting backgroundColor:`,
                targetNode.style.backgroundColor
              );
            }

            console.log(`🎨 DOM After:`, {
              backgroundColor: element.style.backgroundColor,
              computedBgColor: window.getComputedStyle(element).backgroundColor,
            });
          } else {
            console.log(`❌ Element not found in DOM:`, actualSourceId);
          }
        } catch (error) {
          console.error("Error in DOM manipulation:", error);
        }
      }, 100);

      console.log(`✅ Transform complete`);
    };
  }, [originalNodes, dynamicVariants]);

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
