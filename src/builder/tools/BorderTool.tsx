import React from "react";
import { ToolInput } from "./_components/ToolInput";
import { ToolbarSection } from "./_components/ToolbarAtoms";
import { ColorPicker } from "./_components/ColorPicker";
import { ToolSelect } from "./_components/ToolSelect";

export const BorderTool = () => {
  return (
    <ToolbarSection title="Border">
      <div className="space-y-4">
        <ToolInput type="number" label="Width" name="borderWidth" />
        <ToolSelect
          label="Style"
          name="borderStyle"
          options={[
            { label: "Solid", value: "solid" },
            { label: "Dashed", value: "dashed" },
            { label: "Dotted", value: "dotted" },
          ]}
        />
        <ColorPicker
          label="Color"
          name="borderColor"
          usePseudoElement
          pseudoElement="::after"
        />
        <ToolInput type="number" label="Radius" name="borderRadius" />
      </div>
    </ToolbarSection>
  );
};

export default BorderTool;
