// SpacingTool.tsx
import React, { useState } from "react";
import { ToolbarContainer, ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

const SpacingTool = () => {
  const [paddingUnit, setPaddingUnit] = useState("px");
  const [marginUnit, setMarginUnit] = useState("px");

  return (
    <ToolbarContainer>
      <ToolbarSection title="Spacing">
        <ToolInput
          type="number"
          label="Padding"
          value="0"
          min={0}
          step={1}
          unit={paddingUnit}
          name="padding"
          showUnit
          onUnitChange={setPaddingUnit}
        />
        <ToolInput
          type="number"
          label="Margin"
          value="0"
          min={0}
          step={1}
          unit={marginUnit}
          name="margin"
          showUnit
          onUnitChange={setMarginUnit}
        />
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default SpacingTool;
