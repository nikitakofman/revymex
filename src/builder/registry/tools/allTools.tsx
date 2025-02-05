// tools/TypographyTool.tsx
import React from "react";
import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";
import ColorPicker from "./_components/ColorPicker";

export const TypographyTool = () => {
  return (
    <ToolbarSection title="Typography">
      <ToolInput
        type="select"
        label="Font"
        value="Inter"
        options={[
          { label: "Inter", value: "Inter" },
          { label: "Roboto", value: "Roboto" },
          { label: "SF Pro", value: "SF Pro" },
        ]}
      />
      <ToolInput
        type="number"
        label="Size"
        value="16"
        showUnit
        name="fontSize"
      />
      <ToolInput
        type="select"
        label="Weight"
        value="400"
        options={[
          { label: "Regular", value: "400" },
          { label: "Medium", value: "500" },
          { label: "Bold", value: "700" },
        ]}
      />
      <ToolInput
        type="number"
        label="Line Height"
        value="1.5"
        step={0.1}
        name="lineHeight"
      />
      <ToolInput
        type="number"
        label="Letter Spacing"
        value="0"
        showUnit
        name="letterSpacing"
      />
    </ToolbarSection>
  );
};

// tools/EffectsTool.tsx
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
