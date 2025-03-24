"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { set } from "lodash";

export const DynamicToolbar: React.FC = () => {
  const { nodeState, nodeDisp, dragState, dragDisp } = useBuilder();

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

  // Hard-coded mapping of viewport IDs to node IDs
  const [viewportNodeIds, setViewportNodeIds] = useState<
    Record<string, string>
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
      const parentViewport = currentNode.parentId;
      if (parentViewport) {
        setActiveViewportId(parentViewport as string);
        dragDisp.switchDynamicViewport(parentViewport as string);
      }

      // Initialize mapping with the current node
      const initialMapping: Record<string, string> = {};

      // First add the initial node
      if (currentNode.parentId) {
        initialMapping[currentNode.parentId as string] =
          currentNode.id as string;
      }

      // Get its sharedId
      const sharedId = currentNode.sharedId;
      if (sharedId) {
        // Find corresponding nodes in other viewports
        viewports.forEach((viewport) => {
          // Skip the current viewport
          if (viewport.id === currentNode.parentId) return;

          const correspondingNode = nodeState.nodes.find(
            (n) => n.sharedId === sharedId && n.parentId === viewport.id
          );

          if (correspondingNode) {
            initialMapping[viewport.id as string] =
              correspondingNode.id as string;
          }
        });
      }

      console.log("Initial mapping:", initialMapping);
      setViewportNodeIds(initialMapping);
    }
  }, [
    dragState.dynamicModeNodeId,
    initialNodeId,
    nodeState.nodes,
    viewports,
    dragDisp,
  ]);

  // Function to switch to a different viewport
  // Function to switch to a different viewport
  const switchToViewport = useCallback(
    (viewportId: string) => {
      console.log(`Switching to viewport: ${viewportId}`);

      // Update the active viewport ID
      setActiveViewportId(viewportId);

      // Store it in drag state
      dragDisp.switchDynamicViewport(viewportId);

      // Get the target node ID from our mapping
      const targetNodeId = viewportNodeIds[viewportId];

      if (targetNodeId) {
        console.log(`Using mapped node: ${targetNodeId}`);
        dragDisp.setDynamicModeNodeId(targetNodeId);
        return;
      }

      // If no mapping found, perform a search
      console.log(`No mapping for ${viewportId}, searching for shared ID`);

      // Use the initial node to find its sharedId
      let sharedIdToFind;

      if (initialNodeId) {
        const initialNode = nodeState.nodes.find((n) => n.id === initialNodeId);
        sharedIdToFind = initialNode?.sharedId;
      } else {
        // Fallback to current node
        const currentNode = nodeState.nodes.find(
          (n) => n.id === dragState.dynamicModeNodeId
        );
        sharedIdToFind = currentNode?.sharedId;
      }

      if (!sharedIdToFind) {
        console.log("No shared ID to search for");
        return;
      }

      // Remove the hardcoded fallback and make it generic
      // Search for the corresponding node
      const correspondingNode = nodeState.nodes.find(
        (n) => n.sharedId === sharedIdToFind && n.parentId === viewportId
      );

      if (correspondingNode) {
        console.log(`Found corresponding node: ${correspondingNode.id}`);
        dragDisp.setDynamicModeNodeId(correspondingNode.id);

        // Update mapping for future use
        setViewportNodeIds((prev) => ({
          ...prev,
          [viewportId]: correspondingNode.id as string,
        }));
      } else {
        console.log(`No corresponding node found in ${viewportId}`);

        // Special case for desktop viewport (initial node)
        if (viewportId === "viewport-1440" && initialNodeId) {
          console.log("DESKTOP FALLBACK: Using initial node");
          dragDisp.setDynamicModeNodeId(initialNodeId);

          // Update mapping for future use
          setViewportNodeIds((prev) => ({
            ...prev,
            [viewportId]: initialNodeId,
          }));
        }
      }
    },
    [
      dragDisp,
      nodeState.nodes,
      viewportNodeIds,
      initialNodeId,
      dragState.dynamicModeNodeId,
    ]
  );

  // Debug info
  // console.log("initial node:", initialNodeId);
  // console.log("current viewport:", activeViewportId);
  // console.log("current dynamic mode node:", dragState.dynamicModeNodeId);
  // console.log("viewport node mappings:", viewportNodeIds);

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
          dragDisp.setSelectedIds([]);
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
              dragDisp.setSelectedIds([]);
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
