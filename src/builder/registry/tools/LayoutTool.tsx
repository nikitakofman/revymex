import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowDown,
  Layers2,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignHorizontalDistributeCenter,
} from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { ToolbarContainer, ToolbarSection } from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";
import { ToolbarSegmentedControl } from "./_components/ToolbarSegmentedControl";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { ToolSelect } from "./_components/ToolSelect";

type DistributionMode =
  | "stack"
  | "space-between"
  | "space-around"
  | "space-evenly";

function LayoutTool() {
  const { setNodeStyle } = useBuilder();
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("stack");

  const computedDirection = useComputedStyle({
    property: "flexDirection",
    defaultValue: "row",
  });

  const computedJustify = useComputedStyle({
    property: "justifyContent",
    defaultValue: "flex-start",
  });

  const computedAlign = useComputedStyle({
    property: "alignItems",
    defaultValue: "flex-start",
  });

  const direction = (
    computedDirection.mixed ? "row" : computedDirection.value
  ) as "row" | "column";
  const justifyContent = (
    computedJustify.mixed ? "flex-start" : computedJustify.value
  ) as string;
  const alignItems = (
    computedAlign.mixed ? "flex-start" : computedAlign.value
  ) as string;

  // Keep distributionMode in sync with computed justifyContent
  useEffect(() => {
    if (justifyContent === "flex-start") {
      setDistributionMode("stack");
    } else if (
      justifyContent === "space-between" ||
      justifyContent === "space-around" ||
      justifyContent === "space-evenly"
    ) {
      setDistributionMode(justifyContent);
    }
  }, [justifyContent]);

  const alignMap = ["flex-start", "center", "flex-end"] as const;
  const justifyMap = ["flex-start", "center", "flex-end"] as const;

  const handleGridClick = (row: number, col: number) => {
    if (distributionMode === "stack") {
      setNodeStyle(
        {
          display: "flex",
          flexDirection: direction,
          justifyContent:
            direction === "row" ? justifyMap[col] : justifyMap[row],
          alignItems: direction === "row" ? alignMap[row] : alignMap[col],
        },
        undefined,
        true
      );
    } else {
      setNodeStyle(
        {
          display: "flex",
          flexDirection: direction,
          justifyContent: distributionMode,
          alignItems: direction === "row" ? alignMap[row] : alignMap[col],
        },
        undefined,
        true
      );
    }
  };

  const getCellActive = (row: number, col: number) => {
    if (distributionMode === "stack") {
      // In stack mode, show dot based on current alignItems and justifyContent
      if (direction === "row") {
        return (
          alignMap[row] === alignItems && justifyMap[col] === justifyContent
        );
      } else {
        return (
          alignMap[col] === alignItems && justifyMap[row] === justifyContent
        );
      }
    } else {
      // In distribution mode, show dot in the row/column that matches alignItems
      if (direction === "row") {
        return alignMap[row] === alignItems && col === 0;
      } else {
        return alignMap[col] === alignItems && row === 0;
      }
    }
  };

  return (
    <ToolbarContainer>
      <ToolbarSection title="Layout">
        <div className="flex flex-col space-y-3">
          <ToolbarSegmentedControl
            cssProperty="flexDirection"
            defaultValue="row"
            size="sm"
            options={[
              {
                label: "Row",
                value: "row",
                icon: <ArrowRight className="w-3.5 h-3.5" />,
              },
              {
                label: "Column",
                value: "column",
                icon: <ArrowDown className="w-3.5 h-3.5" />,
              },
            ]}
          />

          <ToolbarSegmentedControl
            cssProperty="justifyContent"
            defaultValue="flex-start"
            size="sm"
            options={[
              {
                label: "Stack",
                value: "flex-start",
                icon: <Layers2 className="w-3.5 h-3.5" />,
              },
              {
                value: "space-between",
                icon: (
                  <AlignHorizontalSpaceBetween
                    className={`${
                      direction === "column" && "rotate-90"
                    } w-3.5 h-3.5`}
                  />
                ),
              },
              {
                value: "space-around",
                icon: (
                  <AlignHorizontalSpaceAround
                    className={`${
                      direction === "column" && "rotate-90"
                    } w-3.5 h-3.5`}
                  />
                ),
              },
              {
                value: "space-evenly",
                icon: (
                  <AlignHorizontalDistributeCenter
                    className={`${
                      direction === "column" && "rotate-90"
                    } w-3.5 h-3.5`}
                  />
                ),
              },
            ]}
          />

          <div className="grid grid-cols-3 h-full gap-[8px] bg-transparent p-[10px] justify-items-center rounded-lg">
            {[0, 1, 2].map((row) => (
              <React.Fragment key={row}>
                {[0, 1, 2].map((col) => {
                  const isActive = getCellActive(row, col);
                  const isDisabled =
                    distributionMode !== "stack" &&
                    (direction === "row"
                      ? alignMap[row] !== alignItems
                      : alignMap[col] !== alignItems);

                  return (
                    <button
                      key={`${row}-${col}`}
                      className={`
                        w-full h-10
                        rounded-lg
                        flex items-center justify-center
                        transition-colors
                        ${isDisabled ? "opacity-30" : "hover:bg-blue-300/25"}
                        ${isActive ? "bg-blue-300/25" : "bg-gray-800"}
                      `}
                      onClick={() => !isDisabled && handleGridClick(row, col)}
                      disabled={isDisabled}
                    >
                      {isActive && (
                        <div className="size-2 bg-blue-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <ToolInput
            type="number"
            name="gap"
            label="Gap"
            unit="px"
            min={0}
            max={100}
            step={1}
            showUnit
          />
          <ToolSelect
            label="Overflow"
            name="overflow"
            options={[
              { label: "Hidden", value: "hidden" },
              { label: "Visible", value: "visible" },
            ]}
          />
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
}

export default LayoutTool;
