import React, { useMemo } from "react";
import LayoutTool from "@/builder/tools/LayoutTool";
import { ToolbarDivider } from "@/builder/tools/_components/ToolbarAtoms";
import DimensionsTool from "@/builder/tools/DimensionsTool";
import SpacingTool from "@/builder/tools/SpacingTool";
import { PositionTool } from "@/builder/tools/PositionTool";
import { BorderTool } from "@/builder/tools/BorderTool";
import { FillTool } from "@/builder/tools/FillTool";
import Button from "@/components/ui/button";
import StylesTool from "@/builder/tools/StylesTool";
import InteractionsTool from "@/builder/tools/InteractionsTool";
import TypographyTool from "@/builder/tools/TypographyTool"; // Add this import
import { useSelectedIds } from "@/builder/context/atoms/select-store";
import { useDynamicModeNodeId } from "@/builder/context/atoms/dynamic-store";
import {
  useGetNodeBasics,
  useGetNodeStyle,
  NodeId,
} from "@/builder/context/atoms/node-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

const getToolTypes = (selectedIds: Node, getNodeBasics) => {
  if (selectedIds.length === 0) return {};

  return {
    hasDimensionTools: selectedIds.every(
      (id) => getNodeBasics(id).type !== "root"
    ),
    hasPositionTools: selectedIds.every(
      (id) => getNodeBasics(id).type !== "root"
    ),
    hasBackgroundTools: selectedIds.every(
      (id) => !["text"].includes(getNodeBasics(id).type)
    ),
    hasBorderTools: selectedIds.every(
      (id) => !["text"].includes(getNodeBasics(id).type)
    ),
    hasLayoutTools: selectedIds.every((id) =>
      ["frame", "root"].includes(getNodeBasics(id).type)
    ),
    hasSpacingTools: selectedIds.every(
      (id) => getNodeBasics(id).type !== "text"
    ),
    hasTransformTools: selectedIds.every(
      (id) => getNodeBasics(id).type !== "root"
    ),
    hasOverflowTools: selectedIds.every((id) =>
      ["frame"].includes(getNodeBasics(id).type)
    ),
    hasEffectsTools: selectedIds.every(
      (id) => !["text"].includes(getNodeBasics(id).type)
    ),
    // Add this new property to determine if typography tools should be shown
    hasTypographyTools: selectedIds.some(
      (id) => getNodeBasics(id).type === "text"
    ),
  };
};

const ElementToolbar = () => {
  const dynamicModeNodeId = useDynamicModeNodeId();
  const selectedIds = useSelectedIds();
  const getNodeBasics = useGetNodeBasics();
  const getNodeStyle = useGetNodeStyle();

  // Check if the primary selected element is hidden
  const isPrimaryElementHidden = () => {
    if (selectedIds.length === 0) return false;

    const primaryId = selectedIds[0];
    const primaryElementStyle = getNodeStyle(primaryId);

    return primaryElementStyle?.display === "none";
  };

  const isHidden = isPrimaryElementHidden();
  const toolTypes = getToolTypes(selectedIds, getNodeBasics);

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
              // Use the updateNodeStyle operation directly
              selectedIds.forEach((id) => {
                updateNodeStyle(id, { display: "flex" });
              });
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
      {dynamicModeNodeId && (
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

      {/* Add the TypographyTool when a text element is selected */}
      {toolTypes.hasTypographyTools && (
        <>
          <TypographyTool />
          <ToolbarDivider />
        </>
      )}

      {toolTypes.hasBackgroundTools && (
        <>
          <FillTool />
          <ToolbarDivider />
        </>
      )}

      <>
        <StylesTool />
        <ToolbarDivider />
      </>
    </div>
  );
};

export default ElementToolbar;
