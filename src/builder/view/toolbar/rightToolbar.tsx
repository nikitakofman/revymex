import React from "react";
import LayoutTool from "@/builder/registry/tools/LayoutTool";
import { ImageSettings } from "@/builder/registry/tools/ImageSettingsTool";
import { ToolbarDivider } from "@/builder/registry/tools/_components/test-ui";
import DimensionsTool from "@/builder/registry/tools/DimensionsTool";
import BackgroundTool from "@/builder/registry/tools/BackgroundTool";
import SpacingTool from "@/builder/registry/tools/SpacingTool";
import {
  BorderTool,
  EffectsTool,
  OverflowTool,
  TransformTool,
  TypographyTool,
} from "@/builder/registry/tools/allTools";
import { PositionTool } from "@/builder/registry/tools/PositionTool";
import { useBuilder } from "@/builder/context/builderState";

const RIghtToolbar = () => {
  const { dragState } = useBuilder();

  if (dragState.selectedIds.length === 0) {
    return (
      <div className="w-64 fixed pt-3 right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]" />
    );
  }
  return (
    <div className="w-64 fixed pt-3 right-0 z-20 h-screen overflow-auto bg-[var(--bg-toolbar)]">
      <DimensionsTool />
      <ToolbarDivider />
      <PositionTool />
      <ToolbarDivider />
      <BackgroundTool />
      <ToolbarDivider />
      <LayoutTool />
      <ToolbarDivider />
      <SpacingTool />
      <ToolbarDivider />
      <ImageSettings />
      <ToolbarDivider />
      <TransformTool />
      <ToolbarDivider />
      <OverflowTool />
      <ToolbarDivider />
      <ToolbarDivider />
      <EffectsTool />
      <ToolbarDivider />
      <BorderTool />
      <ToolbarDivider />
      <TypographyTool />
    </div>
  );
};

export default RIghtToolbar;
