import React, { useRef } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { buildTreeFromNodes, findOrCreateCanvasPosition } from "./utils";
import TreeNodeComponent from "./TreeNodeComponent";
import { TreeNodeWithChildren } from "@/builder/types";
import { Label, ToolbarLabel } from "@/builder/tools/_components/ToolbarAtoms";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";
import { useTransform } from "@/builder/context/atoms/canvas-interaction-store";
import {
  useDynamicModeNodeId,
  useActiveViewportInDynamicMode,
} from "@/builder/context/atoms/dynamic-store";

const Layers: React.FC = () => {
  const { nodeState, nodeDisp, setNodeStyle, contentRef } = useBuilder();

  // Use atoms for state
  const dynamicModeNodeId = useDynamicModeNodeId();
  const activeViewportInDynamicMode = useActiveViewportInDynamicMode();
  const isDynamicMode = !!dynamicModeNodeId;

  const currentSelectedIds = useGetSelectedIds();
  const transform = useTransform();

  const treeData = buildTreeFromNodes(
    nodeState.nodes,
    isDynamicMode,
    dynamicModeNodeId,
    activeViewportInDynamicMode
  );
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
      const draggedNode = nodeState.nodes.find((n) => n.id === dragData.id);
      if (!draggedNode) return;

      const isMultiSelectionDrag =
        selectedIds.length > 1 && selectedIds.includes(draggedNode.id);

      const canvasElement = contentRef.current;
      const position = findOrCreateCanvasPosition(
        canvasElement,
        nodeState,
        transform
      );

      let xOffset = 0;
      let yOffset = 0;
      const offsetStep = 20;

      if (isMultiSelectionDrag) {
        selectedIds.forEach((id) => {
          const currentNode = nodeState.nodes.find((n) => n.id === id);
          if (!currentNode) return;

          nodeDisp.moveNode(id, false);

          setNodeStyle(
            {
              position: "absolute",
              left: `${position.x + xOffset}px`,
              top: `${position.y + yOffset}px`,
              zIndex: "",
              transform: "",
            },
            [id],
            undefined
          );

          xOffset += offsetStep;
          yOffset += offsetStep;
        });
      } else {
        nodeDisp.moveNode(draggedNode.id, false);

        setNodeStyle(
          {
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: "",
            transform: "",
          },
          [draggedNode.id],
          undefined
        );
      }

      if (!dynamicModeNodeId) {
        nodeDisp.syncViewports();
      }
    } catch (error) {
      console.error("Error handling canvas drop:", error);
    }
  };

  return (
    <div
      className="h-full bg-[var(--bg-surface)] scrollbar-hide pb-10 overflow-auto"
      ref={panelRef}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      <div className="p-2.5 mt-1 mb-6 space-y-2">
        <ToolbarLabel>
          <span className="ml-2">Layers</span>
        </ToolbarLabel>
        {treeData.map((node) => (
          <TreeNodeComponent
            key={node.id}
            node={node as TreeNodeWithChildren}
          />
        ))}
      </div>
    </div>
  );
};

export default Layers;
