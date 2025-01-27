// Example usage in DimensionsTool.tsx
import React, { useState } from "react";
import { ToolbarContainer, ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

const DimensionsTool = () => {
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");

  return (
    <ToolbarContainer>
      <ToolbarSection title="Dimensions">
        <ToolInput
          type="number"
          label="Width"
          value="100"
          unit={widthUnit}
          name="width"
          showUnit
          onUnitChange={setWidthUnit}
        />
        <ToolInput
          type="number"
          label="Height"
          value="100"
          unit={heightUnit}
          name="height"
          showUnit
          onUnitChange={setHeightUnit}
        />
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default DimensionsTool;
