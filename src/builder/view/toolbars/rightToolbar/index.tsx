import React, { useEffect } from "react";
import LayoutTool from "@/builder/tools/LayoutTool";
import { ToolbarDivider } from "@/builder/tools/_components/ToolbarAtoms";
import DimensionsTool from "@/builder/tools/DimensionsTool";
import SpacingTool from "@/builder/tools/SpacingTool";
import { PositionTool } from "@/builder/tools/PositionTool";
import { useBuilder } from "@/builder/context/builderState";
import { BorderTool } from "@/builder/tools/BorderTool";
import { TransformTool } from "@/builder/tools/TransformTool";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { FillTool } from "@/builder/tools/FillTool";
import Button from "@/components/ui/button";
import StylesTool from "@/builder/tools/StylesTool";
import InteractionsTool from "@/builder/tools/InteractionsTool";
import { useSelectedIds } from "@/builder/context/atoms/select-store";

const getToolTypes = (elements: Node[]) => {
  if (elements.length === 0) return {};

  return {
    hasDimensionTools: elements.every((el) => el.type !== "root"),
    hasPositionTools: elements.every((el) => el.type !== "root"),
    hasBackgroundTools: elements.every((el) => !["text"].includes(el.type)),
    hasBorderTools: elements.every((el) => !["text"].includes(el.type)),
    hasLayoutTools: elements.every((el) => ["frame", "root"].includes(el.type)),
    hasSpacingTools: elements.every((el) => el.type !== "text"),
    hasTransformTools: elements.every((el) => el.type !== "root"),
    hasOverflowTools: elements.every((el) => ["frame"].includes(el.type)),
    hasEffectsTools: elements.every((el) => !["text"].includes(el.type)),
  };
};

const ElementToolbar = () => {
  const { dragState, nodeState, setNodeStyle } = useBuilder();

  const selectedIds = useSelectedIds();

  const selectedElements = nodeState.nodes.filter((node) =>
    selectedIds.includes(node.id)
  );

  // Check if the primary selected element is hidden
  const isPrimaryElementHidden = () => {
    if (selectedIds.length === 0) return false;

    const primaryElement = nodeState.nodes.find(
      (node) => node.id === selectedIds[0]
    );

    return primaryElement?.style?.display === "none";
  };

  const isHidden = isPrimaryElementHidden();
  const toolTypes = getToolTypes(selectedElements);

  if (selectedIds.length === 0) {
    return (
      <div className="w-64 fixed pt-3 right-toolbar right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]" />
    );
  }

  // If the element is hidden, show a message instead of the tools
  if (isHidden) {
    return (
      <div className="w-64 fixed right-toolbar scrollbar-hide pt-3 border-l pb-[80px] border-[var(--border-light)] right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]">
        <div className="flex flex-col items-center justify-center h-full px-6 gap-2">
          <div className="text-[var(--text-primary)] text-center text-xs font-medium mb-2">
            This element is hidden.
          </div>
          <Button
            onClick={() => {
              setNodeStyle({ display: "flex" }, undefined, true);
            }}
            variant="primary"
            size="sm"
          >
            Unhide
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 fixed right-toolbar scrollbar-hide pt-3 border-l pb-[80px] border-[var(--border-light)] right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]">
      {dragState.dynamicModeNodeId && (
        <>
          <InteractionsTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasDimensionTools && (
        <>
          <DimensionsTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasPositionTools && (
        <>
          <PositionTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasLayoutTools && (
        <>
          <LayoutTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasBackgroundTools && (
        <>
          <FillTool />
          <ToolbarDivider />
        </>
      )}

      {/* {toolTypes.hasSpacingTools && (
        <>
          <SpacingTool />
          <ToolbarDivider />
        </>
      )} */}

      <>
        <StylesTool />
        <ToolbarDivider />
      </>

      {/* {toolTypes.hasBorderTools && (
        <>
          <BorderTool />
          <ToolbarDivider />
        </>
      )} */}
    </div>
  );
};

export default ElementToolbar;
