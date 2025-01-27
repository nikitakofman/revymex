import { ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/test-ui";
import { useCallback, useState } from "react";
import { useBuilder } from "@/builder/context/builderState";

export const PositionTool = () => {
  const { dragState, nodeState } = useBuilder();
  const [xUnit, setXUnit] = useState("px");
  const [yUnit, setYUnit] = useState("px");

  const positionOptions = [
    { label: "Default", value: "static" },
    { label: "Relative", value: "relative" },
    { label: "Absolute", value: "absolute" },
    { label: "Fixed", value: "fixed" },
  ];

  const getPositionType = useCallback(() => {
    if (!dragState.selectedIds.length) return "static";

    const element = document.querySelector(
      `[data-node-id="${dragState.selectedIds[0]}"]`
    ) as HTMLElement;
    if (!element) return "static";

    const computedStyle = window.getComputedStyle(element);
    return computedStyle.position || "static";
  }, [dragState.selectedIds, nodeState]);

  const positionType = getPositionType();
  const showCoordinates =
    positionType === "absolute" || positionType === "fixed";

  return (
    <ToolbarSection title="Position">
      <div className="flex flex-col gap-3">
        {/* Position Type */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Type</span>
          <ToolSelect
            value={positionType}
            onChange={(value) => {}}
            options={positionOptions}
          />
        </div>

        {/* Only show X and Y for absolute/fixed positioning */}
        {showCoordinates && (
          <div className="grid grid-cols-2 gap-3">
            <ToolInput
              type="number"
              label="X"
              value="0"
              name="left"
              unit={xUnit}
              onUnitChange={setXUnit}
            />
            <ToolInput
              type="number"
              label="Y"
              value="0"
              name="top"
              unit={yUnit}
              onUnitChange={setYUnit}
            />
          </div>
        )}
      </div>
    </ToolbarSection>
  );
};
