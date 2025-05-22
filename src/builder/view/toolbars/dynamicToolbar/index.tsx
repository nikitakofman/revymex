"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { selectOps } from "@/builder/context/atoms/select-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
  dynamicOps,
  useGetDetachedNodes,
} from "@/builder/context/atoms/dynamic-store";
import {
  useGetNodeIds,
  useGetNodeBasics,
  useGetNodeFlags,
  useGetNodeParent,
  useGetNodeSharedInfo,
  useGetNodeDynamicInfo,
  useGetNodeStyle,
} from "@/builder/context/atoms/node-store";

export const DynamicToolbar: React.FC = () => {
  // Use node store hooks instead of nodeState
  const getNodeIds = useGetNodeIds();
  const getNodeBasics = useGetNodeBasics();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeSharedInfo = useGetNodeSharedInfo();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();
  const getNodeStyle = useGetNodeStyle();
  const getDetachedNodes = useGetDetachedNodes?.() || (() => new Set());

  // Use atoms for state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();

  const { setSelectedIds } = selectOps;

  // Initial node ID when first entering dynamic mode
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(
    activeViewportInDynamicMode as string | null
  );

  // Add a state variable for viewports to ensure updates trigger re-renders
  const [viewportsList, setViewportsList] = useState<
    Array<{
      id: string | number;
      viewportWidth: number;
      viewportName: string;
      type: string;
    }>
  >([]);

  // Force an update of the viewports state whenever entering dynamic mode
  useEffect(() => {
    if (dynamicModeNodeId) {
      const nodeIds = getNodeIds();
      const viewports = [];

      // Collect viewport information
      for (const id of nodeIds) {
        const flags = getNodeFlags(id);
        if (flags.isViewport) {
          const basics = getNodeBasics(id);
          viewports.push({
            id: id,
            viewportWidth: flags.viewportWidth || 0,
            viewportName: flags.viewportName || `${flags.viewportWidth}px`,
            type: basics.type,
          });
        }
      }

      // Sort by viewport width (descending)
      const sortedViewports = viewports.sort(
        (a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0)
      );

      console.log("Updated viewports on dynamic mode change:", sortedViewports);
      setViewportsList(sortedViewports);
    }
  }, [dynamicModeNodeId, getNodeIds, getNodeFlags, getNodeBasics]);

  useEffect(() => {
    setActiveViewportId(activeViewportInDynamicMode as string | null);

    return () => {
      setActiveViewportId(null);
    };
  }, [activeViewportInDynamicMode]);

  // Improved viewport node mapping - include more identifiers
  const [viewportNodeIds, setViewportNodeIds] = useState<
    Record<string, string[]>
  >({});

  // Helper function to find parent viewport
  function findParentViewport(nodeId, allNodeIds) {
    if (!nodeId) return null;

    let currentId = nodeId;
    while (currentId) {
      const flags = getNodeFlags(currentId);
      if (flags.isViewport) {
        return currentId;
      }

      currentId = getNodeParent(currentId);
    }

    return null;
  }

  // When first entering dynamic mode, save the initial node ID
  React.useEffect(() => {
    if (dynamicModeNodeId && !initialNodeId) {
      console.log(`Initializing with node: ${dynamicModeNodeId}`);

      // Save the initial node ID
      setInitialNodeId(dynamicModeNodeId as string);

      // Get all node IDs
      const allNodeIds = getNodeIds();

      // Set the default viewport
      const parentViewport = findParentViewport(
        getNodeParent(dynamicModeNodeId),
        allNodeIds
      );

      if (parentViewport) {
        setActiveViewportId(parentViewport as string);
        dynamicOps.switchDynamicViewport(parentViewport);
      }

      // Initialize mapping with the current node
      const initialMapping: Record<string, string[]> = {};

      // Find all related nodes for every viewport
      viewportsList.forEach((viewport) => {
        const viewportNodes: string[] = [];
        const currentNodeSharedInfo = getNodeSharedInfo(dynamicModeNodeId);
        const currentNodeDynamicInfo = getNodeDynamicInfo(dynamicModeNodeId);

        // First add the initial node if it belongs to this viewport
        if (
          currentNodeDynamicInfo.dynamicViewportId === viewport.id ||
          findParentViewport(getNodeParent(dynamicModeNodeId), allNodeIds) ===
            viewport.id
        ) {
          viewportNodes.push(dynamicModeNodeId as string);
        }

        // Get all nodes with same sharedId
        if (currentNodeSharedInfo.sharedId) {
          // Loop through all nodes
          for (const id of allNodeIds) {
            const sharedInfo = getNodeSharedInfo(id);
            const dynamicInfo = getNodeDynamicInfo(id);
            const flags = getNodeFlags(id);

            if (
              sharedInfo.sharedId === currentNodeSharedInfo.sharedId &&
              id !== dynamicModeNodeId &&
              (dynamicInfo.dynamicViewportId === viewport.id ||
                findParentViewport(getNodeParent(id), allNodeIds) ===
                  viewport.id)
            ) {
              viewportNodes.push(id as string);
            }
          }
        }

        // Get all nodes with same dynamicFamilyId
        if (currentNodeDynamicInfo.dynamicFamilyId) {
          // Loop through all nodes
          for (const id of allNodeIds) {
            if (viewportNodes.includes(id as string)) continue;

            const dynamicInfo = getNodeDynamicInfo(id);

            if (
              dynamicInfo.dynamicFamilyId ===
                currentNodeDynamicInfo.dynamicFamilyId &&
              id !== dynamicModeNodeId &&
              (dynamicInfo.dynamicViewportId === viewport.id ||
                findParentViewport(getNodeParent(id), allNodeIds) ===
                  viewport.id)
            ) {
              viewportNodes.push(id as string);
            }
          }
        }

        // Get all nodes with same variantResponsiveId
        if (currentNodeDynamicInfo.variantResponsiveId) {
          // Loop through all nodes
          for (const id of allNodeIds) {
            if (viewportNodes.includes(id as string)) continue;

            const dynamicInfo = getNodeDynamicInfo(id);

            if (
              dynamicInfo.variantResponsiveId ===
                currentNodeDynamicInfo.variantResponsiveId &&
              id !== dynamicModeNodeId &&
              (dynamicInfo.dynamicViewportId === viewport.id ||
                findParentViewport(getNodeParent(id), allNodeIds) ===
                  viewport.id)
            ) {
              viewportNodes.push(id as string);
            }
          }
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
    dynamicModeNodeId,
    initialNodeId,
    getNodeIds,
    getNodeSharedInfo,
    getNodeDynamicInfo,
    getNodeFlags,
    getNodeParent,
    viewportsList, // Use viewportsList instead of viewports
  ]);

  // Function to get the best node to display for a viewport
  const getBestNodeForViewport = useCallback(
    (viewportId: string, nodeIds: string[]) => {
      if (!nodeIds || nodeIds.length === 0) return null;

      // First try to find a dynamic, non-variant base node
      for (const id of nodeIds) {
        const flags = getNodeFlags(id);
        const dynamicInfo = getNodeDynamicInfo(id);

        if (
          flags.isDynamic &&
          !flags.isVariant &&
          dynamicInfo.dynamicViewportId === viewportId
        ) {
          return id;
        }
      }

      // Next try any node with the viewportId
      for (const id of nodeIds) {
        const dynamicInfo = getNodeDynamicInfo(id);

        if (dynamicInfo.dynamicViewportId === viewportId) {
          return id;
        }
      }

      // Last resort, just use the first node
      return nodeIds[0];
    },
    [getNodeFlags, getNodeDynamicInfo]
  );

  // Function to switch to a different viewport
  const switchToViewport = useCallback(
    (viewportId: string) => {
      console.log(`Switching to viewport: ${viewportId}`);

      // Update the active viewport ID
      setActiveViewportId(viewportId);

      // Store it in dynamic store
      dynamicOps.switchDynamicViewport(viewportId);

      // Get the node IDs for this viewport from the mapping
      const targetNodeIds = viewportNodeIds[viewportId] || [];

      // Find the best node to display
      if (targetNodeIds.length > 0) {
        const bestNodeId = getBestNodeForViewport(viewportId, targetNodeIds);

        if (bestNodeId) {
          console.log(`Using best node for ${viewportId}: ${bestNodeId}`);
          dynamicOps.setDynamicModeNodeId(bestNodeId);
          return;
        }
      }

      // No valid mapping, so we need to find the right node
      console.log(`No valid mapping for ${viewportId}, searching by shared ID`);

      // Get the current dynamic node to find its sharedId
      if (!dynamicModeNodeId) {
        console.log("No current dynamic node");
        return;
      }

      const currentNodeSharedInfo = getNodeSharedInfo(dynamicModeNodeId);
      const currentNodeDynamicInfo = getNodeDynamicInfo(dynamicModeNodeId);

      console.log("Current node information:");
      console.log(
        `Node ${dynamicModeNodeId}: sharedId=${currentNodeSharedInfo.sharedId}, dynamicFamilyId=${currentNodeDynamicInfo.dynamicFamilyId}, variantResponsiveId=${currentNodeDynamicInfo.variantResponsiveId}`
      );

      // Improved search strategy with specific priority order
      let counterpart = null;
      const allNodeIds = getNodeIds();

      // 1. First try to find by sharedId
      if (currentNodeSharedInfo.sharedId) {
        // Try to find non-variant base node
        for (const id of allNodeIds) {
          const sharedInfo = getNodeSharedInfo(id);
          const dynamicInfo = getNodeDynamicInfo(id);
          const flags = getNodeFlags(id);

          if (
            sharedInfo.sharedId === currentNodeSharedInfo.sharedId &&
            dynamicInfo.dynamicViewportId === viewportId &&
            flags.isDynamic &&
            !flags.isVariant
          ) {
            counterpart = id;
            break;
          }
        }

        // If not found, try any node with the sharedId for this viewport
        if (!counterpart) {
          for (const id of allNodeIds) {
            const sharedInfo = getNodeSharedInfo(id);
            const dynamicInfo = getNodeDynamicInfo(id);

            if (
              sharedInfo.sharedId === currentNodeSharedInfo.sharedId &&
              dynamicInfo.dynamicViewportId === viewportId
            ) {
              counterpart = id;
              break;
            }
          }
        }
      }

      // 2. If not found, try by variantResponsiveId
      if (!counterpart && currentNodeDynamicInfo.variantResponsiveId) {
        // First try to find a non-variant base node
        for (const id of allNodeIds) {
          const dynamicInfo = getNodeDynamicInfo(id);
          const flags = getNodeFlags(id);

          if (
            dynamicInfo.variantResponsiveId ===
              currentNodeDynamicInfo.variantResponsiveId &&
            dynamicInfo.dynamicViewportId === viewportId &&
            !flags.isVariant
          ) {
            counterpart = id;
            break;
          }
        }

        // If still not found, try any node
        if (!counterpart) {
          for (const id of allNodeIds) {
            const dynamicInfo = getNodeDynamicInfo(id);

            if (
              dynamicInfo.variantResponsiveId ===
                currentNodeDynamicInfo.variantResponsiveId &&
              dynamicInfo.dynamicViewportId === viewportId
            ) {
              counterpart = id;
              break;
            }
          }
        }
      }

      // 3. If not found, try by dynamicFamilyId
      if (!counterpart && currentNodeDynamicInfo.dynamicFamilyId) {
        // First try to find a non-variant base node
        for (const id of allNodeIds) {
          const dynamicInfo = getNodeDynamicInfo(id);
          const flags = getNodeFlags(id);

          if (
            dynamicInfo.dynamicFamilyId ===
              currentNodeDynamicInfo.dynamicFamilyId &&
            dynamicInfo.dynamicViewportId === viewportId &&
            !flags.isVariant
          ) {
            counterpart = id;
            break;
          }
        }

        // If still not found, try any node
        if (!counterpart) {
          for (const id of allNodeIds) {
            const dynamicInfo = getNodeDynamicInfo(id);

            if (
              dynamicInfo.dynamicFamilyId ===
                currentNodeDynamicInfo.dynamicFamilyId &&
              dynamicInfo.dynamicViewportId === viewportId
            ) {
              counterpart = id;
              break;
            }
          }
        }
      }

      // 4. If still not found, try by original parent relationship
      if (!counterpart && currentNodeSharedInfo.sharedId) {
        for (const id of allNodeIds) {
          const sharedInfo = getNodeSharedInfo(id);
          const dynamicInfo = getNodeDynamicInfo(id);

          if (sharedInfo.sharedId === currentNodeSharedInfo.sharedId) {
            const isInViewport =
              findParentViewport(dynamicInfo.originalParentId, allNodeIds) ===
                viewportId ||
              findParentViewport(getNodeParent(id), allNodeIds) === viewportId;

            if (isInViewport) {
              counterpart = id;
              break;
            }
          }
        }
      }

      if (counterpart) {
        console.log(`Found counterpart: ${counterpart}`);

        // Get the currently detached nodes
        const detachedNodes = getDetachedNodes();

        // First, store state for the new node we're about to switch to
        if (!detachedNodes.has(counterpart)) {
          dynamicOps.storeDynamicNodeState(counterpart);
          dynamicOps.detachNodeForDynamicMode(counterpart);
        }

        // Set the dynamic mode ID to the new node
        dynamicOps.setDynamicModeNodeId(counterpart);

        // Update mapping for future use
        setViewportNodeIds((prev) => {
          const updatedMapping = { ...prev };

          if (!updatedMapping[viewportId]) {
            updatedMapping[viewportId] = [counterpart];
          } else if (!updatedMapping[viewportId].includes(counterpart)) {
            updatedMapping[viewportId] = [
              ...updatedMapping[viewportId],
              counterpart,
            ];
          }

          return updatedMapping;
        });
      } else {
        console.log(`No counterpart found for viewport ${viewportId}`);
      }
    },
    [
      viewportNodeIds,
      dynamicModeNodeId,
      getBestNodeForViewport,
      getNodeIds,
      getNodeSharedInfo,
      getNodeDynamicInfo,
      getNodeFlags,
      getNodeParent,
      getDetachedNodes,
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

  // Function to exit dynamic mode
  const handleExitDynamicMode = useCallback(() => {
    console.log("Exiting dynamic mode");

    // Exit dynamic mode - restoration is handled inside setDynamicModeNodeId
    dynamicOps.setDynamicModeNodeId(null);

    // Clear selections and state
    setSelectedIds([]);
    setActiveViewportId(null);
    setViewportNodeIds({});
    setInitialNodeId(null);
  }, [setSelectedIds]);

  if (!dynamicModeNodeId) return null;

  return createPortal(
    <div className="fixed p-4 resize top-[52px] items-center left-[308px] flex gap-3 shadow-[var(--shadow-sm)] border-b border-[var(--border-default)] bg-[var(--bg-canvas)] w-[calc(100%-565px)]">
      <Button
        size="sm"
        className="outline outline-[var(--accent-secondary)]"
        onClick={handleExitDynamicMode}
      >
        Home
      </Button>

      <LineSeparator
        orientation="vertical"
        color="var(--border-default)"
        height="20px"
      />

      <div className="flex gap-2">
        {viewportsList.map((viewport) => (
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
