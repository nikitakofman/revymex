// Example usage in DimensionsTool.tsx
import React, { useEffect, useState } from "react";
import { ToolbarContainer, ToolbarSection } from "./_components/ToolbarAtoms";
import { ToolInput } from "./_components/ToolInput";
import { useBuilder } from "@/builder/context/builderState";
import { useGetSelectedIds } from "../context/atoms/select-store";

const DimensionsTool = () => {
  const { dragState } = useBuilder();
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");
  const [isViewport, setIsViewport] = useState(true);

  // Replace subscription with imperative getter
  const getSelectedIds = useGetSelectedIds();

  useEffect(() => {
    // Get the current selected IDs only when this effect runs
    const selectedIds = getSelectedIds();

    if (selectedIds.length > 0) {
      // Check if the selected node is a viewport
      setIsViewport(!selectedIds[0].includes("viewport"));

      const element = document.querySelector(
        `[data-node-id="${selectedIds[0]}"]`
      ) as HTMLElement;

      if (element) {
        const style = window.getComputedStyle(element);
        const widthMatch = style.width.match(/[a-z%]+$/);
        const heightMatch = style.height.match(/[a-z%]+$/);

        if (widthMatch) setWidthUnit(widthMatch[0]);
        if (heightMatch) setHeightUnit(heightMatch[0]);
      }
    }
  }, [getSelectedIds]);

  // Set up a DOM-based observer to detect selection changes
  useEffect(() => {
    const selectionObserver = new MutationObserver(() => {
      // When selection changes, re-run the logic
      const selectedIds = getSelectedIds();

      if (selectedIds.length > 0) {
        setIsViewport(!selectedIds[0].includes("viewport"));

        const element = document.querySelector(
          `[data-node-id="${selectedIds[0]}"]`
        ) as HTMLElement;

        if (element) {
          const style = window.getComputedStyle(element);
          const widthMatch = style.width.match(/[a-z%]+$/);
          const heightMatch = style.height.match(/[a-z%]+$/);

          if (widthMatch) setWidthUnit(widthMatch[0]);
          if (heightMatch) setHeightUnit(heightMatch[0]);
        }
      }
    });

    // Observe changes to data-selected attribute on any element
    selectionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected"],
      subtree: true,
    });

    return () => {
      selectionObserver.disconnect();
    };
  }, [getSelectedIds]);

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
