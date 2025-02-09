import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

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
