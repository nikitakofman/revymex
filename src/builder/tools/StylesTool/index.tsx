import React, { useState } from "react";
import { ToolbarSection } from "../_components/ToolbarAtoms";
import { useBuilder } from "@/builder/context/builderState";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { BorderToolPopup } from "./BorderToolPopup";
import { TransformPopup } from "./TransformPopup";
import { ShadowToolPopup } from "./ShadowTool";
import { FilterToolPopup } from "./FilterToolPopup";
import { ToolInput } from "../_components/ToolInput";
import { ToolPopupTrigger } from "../_components/ToolbarPopupTrigger";
import ToolbarButton from "../_components/ToolbarButton";

export const StylesTool = () => {
  const { nodeState, dragState, setNodeStyle } = useBuilder();
  const selectedNode = nodeState.nodes.find(
    (n) => n.id === dragState.selectedIds[0]
  );

  const [activeTool, setActiveTool] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Default opacity value state - initially 1 (fully visible)
  const [opacityValue, setOpacityValue] = useState(1);

  if (!selectedNode) return null;

  const handleTriggerPopup = (tool) => (triggerElement, e) => {
    // Stop propagation to prevent event bubbling
    e.stopPropagation();

    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setActiveTool(tool);
    }
  };

  // Handle opacity change with precision fix
  const handleOpacityChange = (value) => {
    // Format to 1 decimal place to avoid floating point precision issues
    const formattedValue = parseFloat(value.toFixed(1));
    setOpacityValue(formattedValue);

    // Apply the opacity to the selected node(s)
    setNodeStyle(
      {
        opacity: formattedValue.toString(),
      },
      undefined,
      true
    );
  };

  return (
    <>
      <ToolbarSection title="Styles">
        <ToolInput
          type="number"
          name="opacity"
          label="Opacity"
          min={0}
          max={1}
          step={0.1}
          value={opacityValue}
          customValue={opacityValue}
          onCustomChange={handleOpacityChange}
          showSlider
          sliderMin={0}
          sliderMax={1}
          sliderStep={0.1}
        />
        <div className="flex flex-col gap-4">
          <ToolPopupTrigger
            title="Border"
            onTriggerPopup={handleTriggerPopup("border")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Shadow"
            onTriggerPopup={handleTriggerPopup("shadow")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Filter"
            onTriggerPopup={handleTriggerPopup("filter")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>

          <ToolPopupTrigger
            title="Transform"
            onTriggerPopup={handleTriggerPopup("transform")}
          >
            <ToolbarButton>Edit</ToolbarButton>
          </ToolPopupTrigger>
        </div>
      </ToolbarSection>

      <ToolbarPopup
        isOpen={activeTool === "border"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        title="Border"
        leftPadding
      >
        <BorderToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "shadow"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        leftPadding
        title="Shadow"
      >
        <ShadowToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "filter"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        leftPadding
        title="Filter"
      >
        <FilterToolPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>

      <ToolbarPopup
        isOpen={activeTool === "transform"}
        onClose={() => setActiveTool(null)}
        triggerPosition={popupPosition}
        title="Transform"
        leftPadding
      >
        <TransformPopup
          selectedNode={selectedNode}
          onClose={() => setActiveTool(null)}
        />
      </ToolbarPopup>
    </>
  );
};

export default StylesTool;
