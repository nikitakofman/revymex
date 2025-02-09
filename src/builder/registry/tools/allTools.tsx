import React from "react";
import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

export const EffectsTool = () => {
  return (
    <ToolbarSection title="Effects">
      <ToolInput
        type="number"
        label="Opacity"
        value="100"
        min={0}
        max={100}
        unit="%"
        name="opacity"
      />
      <ToolInput
        type="number"
        label="Blur"
        value="0"
        showUnit
        name="filter.blur"
      />
      <ToolInput
        type="select"
        label="Shadow"
        value="none"
        options={[
          { label: "None", value: "none" },
          { label: "Small", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
        ]}
      />
    </ToolbarSection>
  );
};

// tools/OverflowTool.tsx
export const OverflowTool = () => {
  return (
    <ToolbarSection title="Overflow">
      <ToolInput
        type="select"
        label="Type"
        value="visible"
        options={[
          { label: "Visible", value: "visible" },
          { label: "Hidden", value: "hidden" },
          { label: "Scroll", value: "scroll" },
          { label: "Auto", value: "auto" },
        ]}
      />
    </ToolbarSection>
  );
};
