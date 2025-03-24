// Example usage in DimensionsTool.tsx
import React, { useEffect, useState } from "react";
import { ToolbarContainer, ToolbarSection } from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { useBuilder } from "@/builder/context/builderState";

const DimensionsTool = () => {
  const { dragState } = useBuilder();
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");

  useEffect(() => {
    if (dragState.selectedIds.length > 0) {
      const element = document.querySelector(
        `[data-node-id="${dragState.selectedIds[0]}"]`
      ) as HTMLElement;

      if (element) {
        const style = window.getComputedStyle(element);
        const widthMatch = style.width.match(/[a-z%]+$/);
        const heightMatch = style.height.match(/[a-z%]+$/);

        if (widthMatch) setWidthUnit(widthMatch[0]);
        if (heightMatch) setHeightUnit(heightMatch[0]);
      }
    }
  }, [dragState.selectedIds]);

  const isViewport = !dragState.selectedIds[0].includes("viewport");

  return (
    <ToolbarContainer>
      <ToolbarSection solo={!isViewport} title="Dimensions">
        {isViewport && (
          <ToolInput
            type="number"
            label="Width"
            name="width"
            showUnit
            unit={widthUnit}
            onUnitChange={setWidthUnit}
          />
        )}

        <ToolInput
          type="number"
          label="Height"
          name="height"
          showUnit
          unit={heightUnit}
          onUnitChange={setHeightUnit}
        />
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default DimensionsTool;
