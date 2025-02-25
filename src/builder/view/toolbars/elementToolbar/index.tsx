import React from "react";
import LayoutTool from "@/builder/elementTools/LayoutTool";
import { ToolbarDivider } from "@/builder/elementTools/_components/ToolbarAtoms";
import DimensionsTool from "@/builder/elementTools/DimensionsTool";
import SpacingTool from "@/builder/elementTools/SpacingTool";
import { PositionTool } from "@/builder/elementTools/PositionTool";
import { useBuilder } from "@/builder/context/builderState";
import { BorderTool } from "@/builder/elementTools/BorderTool";
import { TransformTool } from "@/builder/elementTools/TransformTool";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { FillTool } from "@/builder/elementTools/FillTool";

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
  const { dragState, nodeState } = useBuilder();
  const selectedElements = nodeState.nodes.filter((node) =>
    dragState.selectedIds.includes(node.id)
  );

  const toolTypes = getToolTypes(selectedElements);

  if (dragState.selectedIds.length === 0) {
    return (
      <div className="w-64 fixed pt-3 right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]" />
    );
  }

  return (
    <div className="w-64 fixed scrollbar-hide pt-3 border-l pb-[80px] border-[var(--border-light)] right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]">
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

      {toolTypes.hasBackgroundTools && (
        <>
          <FillTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasLayoutTools && (
        <>
          <LayoutTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasBorderTools && (
        <>
          <BorderTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasSpacingTools && (
        <>
          <SpacingTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasTransformTools && (
        <>
          <TransformTool />
          {/* <ToolbarDivider /> */}
        </>
      )}
    </div>
  );
};

export default ElementToolbar;
