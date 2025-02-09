import { useBuilder } from "@/builder/context/builderState";
import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/ToolSelect";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import PlaceholderToolInput from "./_components/ToolInputPlaceholder";

export const PositionTool = () => {
  const { dragState } = useBuilder();

  const positionStyle = useComputedStyle({
    property: "position",
    parseValue: false,
    defaultValue: "static",
  });

  const positionOptions = [
    { label: "Default", value: "static" },
    { label: "Relative", value: "relative" },
    { label: "Absolute", value: "absolute" },
    { label: "Fixed", value: "fixed" },
  ];

  const position = positionStyle.mixed
    ? "static"
    : (positionStyle.value as string);
  const showCoordinates = position === "absolute" || position === "fixed";

  const isDragging = dragState.dragPositions && dragState.isDragging;

  // TODO: check this console log renderes a lot, maybe it causes maximum update depth exceeded

  // console.log("isDragging", isDragging);

  return (
    <ToolbarSection title="Position">
      <div className="flex flex-col gap-3">
        {isDragging ? (
          <div className="grid grid-cols-2 gap-3">
            <PlaceholderToolInput value={dragState.dragPositions.x} label="x" />
            <PlaceholderToolInput value={dragState.dragPositions.y} label="y" />
          </div>
        ) : (
          <>
            <ToolSelect
              label="Type"
              name="position"
              options={positionOptions}
            />
            {showCoordinates && (
              <div className="grid grid-cols-2 gap-3">
                <ToolInput type="number" label="X" name="left" />
                <ToolInput type="number" label="Y" name="top" />
              </div>
            )}
          </>
        )}
      </div>
    </ToolbarSection>
  );
};
