import React from "react";
import LayoutTool from "@/builder/registry/tools/LayoutTool";
import { ImageSettings } from "@/builder/registry/tools/ImageSettingsTool";
import { ToolbarDivider } from "@/builder/registry/tools/_components/ToolbarAtoms";
import DimensionsTool from "@/builder/registry/tools/DimensionsTool";
import { BackgroundTool } from "@/builder/registry/tools/BackgroundTool";
import SpacingTool from "@/builder/registry/tools/SpacingTool";
import { EffectsTool, OverflowTool } from "@/builder/registry/tools/allTools";
import { PositionTool } from "@/builder/registry/tools/PositionTool";
import { useBuilder } from "@/builder/context/builderState";
import { BorderTool } from "@/builder/registry/tools/BorderTool";
import { TransformTool } from "@/builder/registry/tools/TransformTool";
import { TypographyTool } from "@/builder/registry/tools/TypographyTool";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { FillTool } from "@/builder/registry/tools/FillTool";

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
    hasTypographyTools: elements.every((el) => ["text"].includes(el.type)),
    // hasImageTools: elements.every((el) => el.type === "image"),
    hasOverflowTools: elements.every((el) => ["frame"].includes(el.type)),
    hasEffectsTools: elements.every((el) => !["text"].includes(el.type)),
  };
};

const RightToolbar = () => {
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
    <div className="w-64 fixed pt-3 border-l border-[var(--border-light)] right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]">
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

      {toolTypes.hasImageTools && (
        <>
          <ImageSettings />
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
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasTypographyTools && (
        <>
          <TypographyTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasOverflowTools && (
        <>
          <OverflowTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasEffectsTools && (
        <>
          <EffectsTool />
        </>
      )}
    </div>
  );
};

export default RightToolbar;
