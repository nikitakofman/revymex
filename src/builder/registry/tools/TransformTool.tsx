import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

export const TransformTool = () => {
  return (
    <ToolbarSection title="Transform">
      <ToolInput
        type="number"
        label="Rotate"
        value="0"
        unit="deg"
        name="rotate"
      />
      <div className="grid grid-cols-2 gap-2">
        <ToolInput
          type="number"
          label="Scale X"
          value="1"
          step={0.1}
          name="transform.scaleX"
        />
        <ToolInput
          type="number"
          label="Scale Y"
          value="1"
          step={0.1}
          name="transform.scaleY"
        />
      </div>
    </ToolbarSection>
  );
};
