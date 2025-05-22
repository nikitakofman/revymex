import React, { useRef } from "react";
import { useBuilderRefs } from "@/builder/context/builderState";
import { findOrCreateCanvasPosition } from "./utils";
import TreeNodeComponent from "./TreeNodeComponent";
import { ToolbarLabel } from "@/builder/tools/_components/ToolbarAtoms";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";
import { useTransform } from "@/builder/context/atoms/canvas-interaction-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
} from "@/builder/context/atoms/dynamic-store";
import { useRootNodes } from "@/builder/context/atoms/node-store/hierarchy-store";
import {
  useGetNodeBasics,
  useGetNodeStyle,
  useGetNodeFlags,
  useGetNodeParent,
  useGetNodeDynamicInfo,
  getCurrentNodes,
} from "@/builder/context/atoms/node-store";
import { syncViewports } from "@/builder/context/atoms/node-store/operations/sync-operations";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";
import { moveNode } from "@/builder/context/atoms/node-store/operations/insert-operations";

const Layers: React.FC = () => {
  const { contentRef } = useBuilderRefs();

  // Use atoms for state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const isDynamicMode = !!dynamicModeNodeId;

  const currentSelectedIds = useGetSelectedIds();
  const transform = useTransform();

  // Get root nodes directly from hierarchy store
  const rootNodeIds = useRootNodes();

  // Get getter functions
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();
  const getNodeFlags = useGetNodeFlags();
  const getNodeParent = useGetNodeParent();
  const getNodeDynamicInfo = useGetNodeDynamicInfo();

  const panelRef = useRef<HTMLDivElement>(null);

  const handlePanelDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("li")) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePanelDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("li")) return;

    const selectedIds = currentSelectedIds();

    e.preventDefault();

    try {
      const dragData = JSON.parse(
        e.dataTransfer.getData("application/json") || "{}"
      );

      const allNodes = getCurrentNodes();
      const draggedNode = allNodes.find((n) => n.id === dragData.id);
      if (!draggedNode) return;

      const isMultiSelectionDrag =
        selectedIds.length > 1 && selectedIds.includes(draggedNode.id);

      const canvasElement = contentRef.current;
      const position = findOrCreateCanvasPosition(
        canvasElement,
        { nodes: allNodes },
        transform
      );

      let xOffset = 0;
      let yOffset = 0;
      const offsetStep = 20;

      if (isMultiSelectionDrag) {
        selectedIds.forEach((id) => {
          const currentNode = allNodes.find((n) => n.id === id);
          if (!currentNode) return;

          // Use direct moveNode function instead of nodeDisp
          moveNode(id, null);

          // Use direct updateNodeStyle function instead of setNodeStyle
          updateNodeStyle(id, {
            position: "absolute",
            left: `${position.x + xOffset}px`,
            top: `${position.y + yOffset}px`,
            zIndex: "",
            transform: "",
          });

          xOffset += offsetStep;
          yOffset += offsetStep;
        });
      } else {
        // Use direct moveNode function instead of nodeDisp
        moveNode(draggedNode.id, null);

        // Use direct updateNodeStyle function instead of setNodeStyle
        updateNodeStyle(draggedNode.id, {
          position: "absolute",
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: "",
          transform: "",
        });
      }

      // Sync viewports directly if not in dynamic mode
      if (!dynamicModeNodeId) {
        if (isMultiSelectionDrag) {
          selectedIds.forEach((id) => {
            syncViewports(id, null);
          });
        } else {
          syncViewports(draggedNode.id, null);
        }
      }
    } catch (error) {
      console.error("Error handling canvas drop:", error);
    }
  };

  // Filter nodes based on dynamic mode rules
  const getFilteredRootNodes = () => {
    if (!isDynamicMode) {
      // Normal canvas mode - filter out variants and non-top-level dynamic nodes
      return rootNodeIds.filter((nodeId) => {
        const basics = getNodeBasics(nodeId);
        const flags = getNodeFlags(nodeId);
        const dynamicInfo = getNodeDynamicInfo(nodeId);

        // Filter out placeholders
        if (basics.type === "placeholder") return false;

        // Always show viewports
        if (flags.isViewport) return true;

        // Don't show variants in normal mode
        if (flags.isVariant) return false;

        // If it's a dynamic node, only show if it's top-level
        if (flags.isDynamic) {
          return dynamicInfo.isTopLevelDynamicNode === true;
        }

        // Show all other non-dynamic nodes
        return true;
      });
    } else {
      // Dynamic mode - only show nodes belonging to the active viewport, NO viewports
      return rootNodeIds.filter((nodeId) => {
        const basics = getNodeBasics(nodeId);
        const flags = getNodeFlags(nodeId);
        const dynamicInfo = getNodeDynamicInfo(nodeId);

        // Filter out placeholders
        if (basics.type === "placeholder") return false;

        // Don't show viewports in dynamic mode
        if (flags.isViewport) return false;

        // Only show nodes that belong to the active viewport
        if (dynamicInfo.dynamicViewportId === activeViewportInDynamicMode) {
          // Show both dynamic nodes and variants in dynamic mode
          return true;
        }

        return false;
      });
    }
  };

  const filteredRootNodes = getFilteredRootNodes();

  return (
    <div
      className="h-full bg-[var(--bg-surface)] scrollbar-hide pb-10 overflow-auto"
      ref={panelRef}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      <div className="p-2.5 mt-1 mb-6 space-y-2">
        <ToolbarLabel>
          <span className="ml-2">
            Layers {isDynamicMode && "(Dynamic Mode)"}
          </span>
        </ToolbarLabel>
        {filteredRootNodes.map((nodeId) => {
          // Create minimal tree node object with required props
          const dynamicInfo = getNodeDynamicInfo(nodeId);
          const treeNode = {
            id: nodeId,
            type: getNodeBasics(nodeId).type,
            customName: getNodeBasics(nodeId).customName,
            style: getNodeStyle(nodeId),
            isViewport: getNodeFlags(nodeId).isViewport,
            viewportWidth: getNodeFlags(nodeId).viewportWidth,
            inViewport: getNodeFlags(nodeId).inViewport,
            isDynamic: getNodeFlags(nodeId).isDynamic,
            isVariant: getNodeFlags(nodeId).isVariant,
            isLocked: getNodeFlags(nodeId).isLocked,
            isTopLevelDynamicNode: dynamicInfo.isTopLevelDynamicNode,
            dynamicFamilyId: dynamicInfo.dynamicFamilyId,
            dynamicViewportId: dynamicInfo.dynamicViewportId,
            parentId: getNodeParent(nodeId),
            children: [], // Children will be fetched by the component
          };

          return <TreeNodeComponent key={nodeId} node={treeNode} />;
        })}
      </div>
    </div>
  );
};

export default Layers;
