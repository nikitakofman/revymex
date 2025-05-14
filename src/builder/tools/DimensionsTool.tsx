import React, { useEffect, useState } from "react";
import { ToolbarContainer, ToolbarSection } from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { useSelectedIds } from "@/builder/context/atoms/select-store";
import { useElementSize } from "./useElementSize";

const DimensionsTool = () => {
  // Get selected IDs
  const selectedIds = useSelectedIds();

  // State for unit types
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");

  // Track if we're showing a viewport
  const [isViewport, setIsViewport] = useState(true);

  // Use our hook with accurate dimensions
  const { width, height } = useElementSize(selectedIds);

  // Check if primary element is a viewport and determine units
  useEffect(() => {
    if (selectedIds.length === 0) return;

    const primaryId = selectedIds[0];
    setIsViewport(!primaryId.includes("viewport"));

    // Get the element to check its units
    const element = document.querySelector(
      `[data-node-id="${primaryId}"]`
    ) as HTMLElement;
    if (!element) return;

    // Check if there's an inline style with width/height units
    const elementStyle = element.getAttribute("style");

    if (elementStyle) {
      // Extract units directly from style attribute for highest accuracy
      const widthUnitMatch = elementStyle.match(/width:\s*[\d.]+([a-z%]+)/);
      const heightUnitMatch = elementStyle.match(/height:\s*[\d.]+([a-z%]+)/);

      if (widthUnitMatch && widthUnitMatch[1]) {
        setWidthUnit(widthUnitMatch[1]);
      }

      if (heightUnitMatch && heightUnitMatch[1]) {
        setHeightUnit(heightUnitMatch[1]);
      }
    }
  }, [selectedIds]);

  // Debug helper - log actual values to confirm they're correct
  useEffect(() => {}, [width, height]);

  return (
    <ToolbarContainer>
      <ToolbarSection solo={!isViewport} title="Dimensions">
        {isViewport && (
          <ToolInput
            type="number"
            label="Width"
            name="width"
            showUnit
            value={width} // Pass the exact width from our hook
            unit={widthUnit}
            onUnitChange={setWidthUnit}
          />
        )}

        <ToolInput
          type="number"
          label="Height"
          name="height"
          showUnit
          value={height} // Pass the exact height from our hook
          unit={heightUnit}
          onUnitChange={setHeightUnit}
        />
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default DimensionsTool;
