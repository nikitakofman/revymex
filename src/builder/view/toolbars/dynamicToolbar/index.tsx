"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { selectOps } from "@/builder/context/atoms/select-store";

export const DynamicToolbar: React.FC = () => {
  const { nodeState, nodeDisp, dragState, dragDisp } = useBuilder();

  const { setSelectedIds } = selectOps;

  // Initial node ID when first entering dynamic mode
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(
    dragState.activeViewportInDynamicMode
  );

  useEffect(() => {
    setActiveViewportId(dragState.activeViewportInDynamicMode);

    return () => {
      setActiveViewportId(null);
    };
  }, [dragState.activeViewportInDynamicMode]);

  // Improved viewport node mapping - include more identifiers
  const [viewportNodeIds, setViewportNodeIds] = useState<
    Record<string, string[]>
  >({});

  // Get all available viewports from the node state
  const viewports = useMemo(() => {
    return nodeState.nodes
      .filter((node) => node.isViewport)
      .sort((a, b) => {
        // Sort by viewport width (descending)
        const widthA = a.viewportWidth || 0;
        const widthB = b.viewportWidth || 0;
        return widthB - widthA;
      });
  }, [nodeState.nodes]);

  // Helper function to find parent viewport
  function findParentViewport(nodeId, nodes) {
    if (!nodeId) return null;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    if (node.isViewport) return node.id;

    if (node.parentId) {
      return findParentViewport(node.parentId, nodes);
    }

    return null;
  }

  // When first entering dynamic mode, save the initial node ID
  React.useEffect(() => {
    if (dragState.dynamicModeNodeId && !initialNodeId) {
      console.log(`Initializing with node: ${dragState.dynamicModeNodeId}`);

      // Save the initial node ID
      setInitialNodeId(dragState.dynamicModeNodeId as string);

      // Get the current node
      const currentNode = nodeState.nodes.find(
        (n) => n.id === dragState.dynamicModeNodeId
      );
      if (!currentNode) return;

      // Set the default viewport
      const parentViewport = findParentViewport(
        currentNode.parentId,
        nodeState.nodes
      );
      if (parentViewport) {
        setActiveViewportId(parentViewport as string);
        dragDisp.switchDynamicViewport(parentViewport as string);
      }

      // Initialize mapping with the current node
      const initialMapping: Record<string, string[]> = {};

      // Find all related nodes for every viewport
      viewports.forEach((viewport) => {
        const viewportNodes: string[] = [];

        // First add the initial node if it belongs to this viewport
        if (
          currentNode.dynamicViewportId === viewport.id ||
          findParentViewport(currentNode.parentId, nodeState.nodes) ===
            viewport.id
        ) {
          viewportNodes.push(currentNode.id as string);
        }

        // Get all nodes with same sharedId
        if (currentNode.sharedId) {
          const sharedNodes = nodeState.nodes.filter(
            (n) =>
              n.sharedId === currentNode.sharedId &&
              n.id !== currentNode.id &&
              (n.dynamicViewportId === viewport.id ||
                findParentViewport(n.parentId, nodeState.nodes) === viewport.id)
          );

          viewportNodes.push(...sharedNodes.map((n) => n.id as string));
        }

        // Get all nodes with same dynamicFamilyId
        if (currentNode.dynamicFamilyId) {
          const familyNodes = nodeState.nodes.filter(
            (n) =>
              n.dynamicFamilyId === currentNode.dynamicFamilyId &&
              n.id !== currentNode.id &&
              !viewportNodes.includes(n.id as string) &&
              (n.dynamicViewportId === viewport.id ||
                findParentViewport(n.parentId, nodeState.nodes) === viewport.id)
          );

          viewportNodes.push(...familyNodes.map((n) => n.id as string));
        }

        // Get all nodes with same variantResponsiveId
        if (currentNode.variantResponsiveId) {
          const variantNodes = nodeState.nodes.filter(
            (n) =>
              n.variantResponsiveId === currentNode.variantResponsiveId &&
              n.id !== currentNode.id &&
              !viewportNodes.includes(n.id as string) &&
              (n.dynamicViewportId === viewport.id ||
                findParentViewport(n.parentId, nodeState.nodes) === viewport.id)
          );

          viewportNodes.push(...variantNodes.map((n) => n.id as string));
        }

        // Only add non-empty mappings
        if (viewportNodes.length > 0) {
          initialMapping[viewport.id as string] = viewportNodes;
        }
      });

      console.log("Initial viewport mapping:", initialMapping);
      setViewportNodeIds(initialMapping);
    }
  }, [
    dragState.dynamicModeNodeId,
    initialNodeId,
    nodeState.nodes,
    viewports,
    dragDisp,
  ]);

  // Function to get the best node to display for a viewport
  const getBestNodeForViewport = useCallback(
    (viewportId: string, nodeIds: string[]) => {
      if (!nodeIds || nodeIds.length === 0) return null;

      // First try to find a dynamic, non-variant base node
      const baseNode = nodeState.nodes.find(
        (n) =>
          nodeIds.includes(n.id as string) &&
          n.isDynamic &&
          !n.isVariant &&
          n.dynamicViewportId === viewportId
      );

      if (baseNode) return baseNode.id;

      // Next try any node with the viewportId
      const viewportNode = nodeState.nodes.find(
        (n) =>
          nodeIds.includes(n.id as string) && n.dynamicViewportId === viewportId
      );

      if (viewportNode) return viewportNode.id;

      // Last resort, just use the first node
      return nodeIds[0];
    },
    [nodeState.nodes]
  );

  // Function to switch to a different viewport
  const switchToViewport = useCallback(
    (viewportId: string) => {
      console.log(`Switching to viewport: ${viewportId}`);

      // Update the active viewport ID
      setActiveViewportId(viewportId);

      // Store it in drag state
      dragDisp.switchDynamicViewport(viewportId);

      // Get the node IDs for this viewport from the mapping
      const targetNodeIds = viewportNodeIds[viewportId] || [];

      // Find the best node to display
      if (targetNodeIds.length > 0) {
        const bestNodeId = getBestNodeForViewport(viewportId, targetNodeIds);

        if (bestNodeId) {
          console.log(`Using best node for ${viewportId}: ${bestNodeId}`);
          dragDisp.setDynamicModeNodeId(bestNodeId);
          return;
        }
      }

      // No valid mapping, so we need to find the right node
      console.log(`No valid mapping for ${viewportId}, searching by shared ID`);

      // Get the current dynamic node to find its sharedId
      const currentDynamicNode = nodeState.nodes.find(
        (n) => n.id === dragState.dynamicModeNodeId
      );

      if (!currentDynamicNode) {
        console.log("Current dynamic node not found");
        return;
      }

      console.log("Current node information:");
      console.log(
        `Node ${currentDynamicNode.id}: sharedId=${currentDynamicNode.sharedId}, dynamicFamilyId=${currentDynamicNode.dynamicFamilyId}, variantResponsiveId=${currentDynamicNode.variantResponsiveId}`
      );

      // Improved search strategy with specific priority order:
      // 1. First try to find the primary dynamic base node for this viewport
      let counterpart = null;

      if (currentDynamicNode.sharedId) {
        counterpart = nodeState.nodes.find(
          (n) =>
            n.sharedId === currentDynamicNode.sharedId &&
            n.dynamicViewportId === viewportId &&
            n.isDynamic &&
            !n.isVariant // Prefer non-variant base nodes!
        );

        // If not found, try any node with the sharedId for this viewport
        if (!counterpart) {
          counterpart = nodeState.nodes.find(
            (n) =>
              n.sharedId === currentDynamicNode.sharedId &&
              n.dynamicViewportId === viewportId
          );
        }
      }

      // 2. If not found, try by variantResponsiveId
      if (!counterpart && currentDynamicNode.variantResponsiveId) {
        // First try to find a non-variant base node
        counterpart = nodeState.nodes.find(
          (n) =>
            n.variantResponsiveId === currentDynamicNode.variantResponsiveId &&
            n.dynamicViewportId === viewportId &&
            !n.isVariant
        );

        // If still not found, try any node
        if (!counterpart) {
          counterpart = nodeState.nodes.find(
            (n) =>
              n.variantResponsiveId ===
                currentDynamicNode.variantResponsiveId &&
              n.dynamicViewportId === viewportId
          );
        }
      }

      // 3. If not found, try by dynamicFamilyId
      if (!counterpart && currentDynamicNode.dynamicFamilyId) {
        // First try to find a non-variant base node
        counterpart = nodeState.nodes.find(
          (n) =>
            n.dynamicFamilyId === currentDynamicNode.dynamicFamilyId &&
            n.dynamicViewportId === viewportId &&
            !n.isVariant
        );

        // If still not found, try any node
        if (!counterpart) {
          counterpart = nodeState.nodes.find(
            (n) =>
              n.dynamicFamilyId === currentDynamicNode.dynamicFamilyId &&
              n.dynamicViewportId === viewportId
          );
        }
      }

      // 4. If still not found, try by original parent relationship
      if (!counterpart && currentDynamicNode.sharedId) {
        counterpart = nodeState.nodes.find(
          (n) =>
            n.sharedId === currentDynamicNode.sharedId &&
            (findParentViewport(n.originalParentId, nodeState.nodes) ===
              viewportId ||
              findParentViewport(n.parentId, nodeState.nodes) === viewportId)
        );
      }

      if (counterpart) {
        console.log(`Found counterpart: ${counterpart.id}`);
        dragDisp.setDynamicModeNodeId(counterpart.id);

        // Update mapping for future use
        setViewportNodeIds((prev) => {
          const updatedMapping = { ...prev };

          if (!updatedMapping[viewportId]) {
            updatedMapping[viewportId] = [counterpart.id];
          } else if (!updatedMapping[viewportId].includes(counterpart.id)) {
            updatedMapping[viewportId] = [
              ...updatedMapping[viewportId],
              counterpart.id,
            ];
          }

          return updatedMapping;
        });
      } else {
        console.log(`No counterpart found for viewport ${viewportId}`);
      }
    },
    [
      dragDisp,
      nodeState.nodes,
      viewportNodeIds,
      dragState.dynamicModeNodeId,
      getBestNodeForViewport,
    ]
  );

  // Function to get viewport icon based on width
  const getViewportIcon = useCallback((width: number) => {
    if (width >= 1200) {
      return <Monitor size={16} />;
    } else if (width >= 768) {
      return <Tablet size={16} />;
    } else {
      return <Smartphone size={16} />;
    }
  }, []);

  if (!dragState.dynamicModeNodeId) return null;

  return createPortal(
    <div className="fixed p-4 resize top-[52px] items-center left-[308px] flex gap-3 shadow-[var(--shadow-sm)] border-b border-[var(--border-default)] bg-[var(--bg-canvas)] w-[calc(100%-565px)]">
      <Button
        size="sm"
        className="outline outline-[var(--accent-secondary)]"
        onClick={() => {
          nodeDisp.resetDynamicNodePositions();
          dragDisp.setDynamicModeNodeId(null);
          dragDisp.setDynamicState("normal");
          setSelectedIds([]);
          dragDisp.switchDynamicViewport(null);
          setActiveViewportId(null);
          setViewportNodeIds({});
          setInitialNodeId(null);
        }}
      >
        Home
      </Button>

      <LineSeparator
        orientation="vertical"
        color="var(--border-default)"
        height="20px"
      />

      {/* Viewport buttons */}
      <div className="flex gap-2">
        {viewports.map((viewport) => (
          <Button
            key={viewport.id}
            size="sm"
            variant={activeViewportId === viewport.id ? "primary" : "ghost"}
            onClick={() => {
              switchToViewport(viewport.id as string);
              setSelectedIds([]);
            }}
            className="flex items-center gap-1"
          >
            {getViewportIcon(viewport.viewportWidth || 0)}
            {viewport.viewportName || `${viewport.viewportWidth}px`}
          </Button>
        ))}
      </div>
    </div>,
    document.body
  );
};
