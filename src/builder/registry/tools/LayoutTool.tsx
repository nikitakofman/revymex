import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  Layers2,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignHorizontalDistributeCenter,
  Grid2x2,
  FileX,
} from "lucide-react";

// Replace these imports with your actual component paths
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

import { ToolbarContainer, ToolbarSection } from "./_components/test-ui";
import { ToolbarSegmentedControl } from "./_components/ToolbarSegmentedControl";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/ToolSelect";

/** Possible layout modes */
type LayoutMode = "flex" | "grid";

/** Possible distribution modes for flex */
type DistributionMode =
  | "stack"
  | "space-between"
  | "space-around"
  | "space-evenly";

export default function LayoutTool() {
  const { setNodeStyle } = useBuilder();

  // Track which layout mode we're in
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("flex");

  // For flex, track distribution (stack / space-between / space-around / space-evenly)
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("stack");

  // For our alignment grid (both flex & grid):
  const alignMap = ["flex-start", "center", "flex-end"] as const;
  const justifyMap = ["flex-start", "center", "flex-end"] as const;

  // -- COMPUTED STYLES --

  // Display property - used to switch between flex & grid
  const computedDisplay = useComputedStyle({
    property: "display",
    defaultValue: "flex",
  });

  // For flex
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

  // For grid
  const computedGridCols = useComputedStyle({
    property: "gridTemplateColumns",
    defaultValue: "repeat(3, 1fr)",
  });
  const computedGridRows = useComputedStyle({
    property: "gridTemplateRows",
    defaultValue: "repeat(3, 1fr)",
  });

  // Convert computedDirection to a normal string (row or column)
  const direction = computedDirection.mixed
    ? "row"
    : (computedDirection.value as "row" | "column");

  // Convert justifyContent to a normal string
  const justifyContent = computedJustify.mixed
    ? "flex-start"
    : computedJustify.value;

  // Convert alignItems to a normal string
  const alignItems = computedAlign.mixed ? "flex-start" : computedAlign.value;

  // Sync the layoutMode with the actual computed display
  useEffect(() => {
    if (computedDisplay.mixed) {
      setLayoutMode("flex");
    } else {
      setLayoutMode(computedDisplay.value === "grid" ? "grid" : "flex");
    }
  }, [computedDisplay]);

  // Keep distributionMode in sync with computedJustify
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

  // -- GRID ALIGNMENT CELLS --

  /**
   * handleGridClick: Called when we click one of the 3x3 alignment cells.
   * For Grid mode, sets `justifyItems` + `alignItems`.
   * For Flex mode, sets `justifyContent` + `alignItems` (depending on distributionMode).
   */
  function handleGridClick(row: number, col: number) {
    if (layoutMode === "grid") {
      // For grid: set "justifyItems" & "alignItems"
      setNodeStyle(
        {
          display: "grid",
          // We do not touch the columns/rows here; that is handled by the ToolInputs
          justifyItems: justifyMap[col],
          alignItems: alignMap[row],
        },
        undefined,
        true
      );
    } else {
      // For flex:
      if (distributionMode === "stack") {
        // "stack" means no special space-between/around
        // We want to set justifyContent = (left/center/right) if direction is row
        // and alignItems = top/middle/bottom if direction is row
        // etc.
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
        // distribution is space-between|around|evenly
        // so we keep justifyContent as distributionMode
        // only alignItems changes
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
    }
  }

  /**
   * Used by the 3x3 grid to see if a cell is "active" based on current alignment/justification
   */
  function getCellActive(row: number, col: number) {
    if (layoutMode === "grid") {
      // For grid: compare alignItems + justifyItems
      // But we only have alignItems from computed styles so far.
      // If you also track "justifyItems" with a useComputedStyle, you can do:
      // `justifyItems: computedJustifyItems.value`
      // For now we only compare alignItems + justifyContent. It's an approximation.
      return alignMap[row] === alignItems && justifyMap[col] === justifyContent;
    }

    // For flex:
    if (distributionMode === "stack") {
      // E.g. direction: row => justify=col index, align=row index
      if (direction === "row") {
        return (
          alignMap[row] === alignItems && justifyMap[col] === justifyContent
        );
      } else {
        // direction column => justify = row index, align = col index
        return (
          alignMap[col] === alignItems && justifyMap[row] === justifyContent
        );
      }
    } else {
      // distribution is something like "space-between|around|evenly"
      // We only vary alignItems; justifyContent is the distributionMode
      if (direction === "row") {
        return alignMap[row] === alignItems && col === 0; // pick left col as "active"
      } else {
        return alignMap[col] === alignItems && row === 0; // pick top row as "active"
      }
    }
  }

  return (
    <ToolbarContainer>
      <ToolbarSection title="Layout">
        <div className="flex flex-col space-y-3">
          {/* 1) Layout Mode Toggle: Flex vs. Grid */}
          <ToolbarSegmentedControl
            cssProperty="display"
            defaultValue="flex"
            size="sm"
            options={[
              {
                label: "Flex",
                value: "flex",
                icon: <FileX className="w-3.5 h-3.5" />,
              },
              {
                label: "Grid",
                value: "grid",
                icon: <Grid2x2 className="w-3.5 h-3.5" />,
              },
            ]}
          />

          {/* 2) If Flex: show direction + distribution controls */}
          {layoutMode === "flex" && (
            <>
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
                          direction === "column" ? "rotate-90" : ""
                        } w-3.5 h-3.5`}
                      />
                    ),
                  },
                  {
                    value: "space-around",
                    icon: (
                      <AlignHorizontalSpaceAround
                        className={`${
                          direction === "column" ? "rotate-90" : ""
                        } w-3.5 h-3.5`}
                      />
                    ),
                  },
                  {
                    value: "space-evenly",
                    icon: (
                      <AlignHorizontalDistributeCenter
                        className={`${
                          direction === "column" ? "rotate-90" : ""
                        } w-3.5 h-3.5`}
                      />
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* 3) If Grid: show controls for columns/rows */}
          {layoutMode === "grid" && (
            <>
              <ToolInput
                type="number"
                name="gridTemplateColumns"
                label="Columns"
                min={1}
                max={12}
                step={1}
              />
              <ToolInput
                type="number"
                name="gridTemplateRows"
                label="Rows"
                min={1}
                max={12}
                step={1}
              />
            </>
          )}

          {/* 4) The 3x3 alignment matrix (works for both flex & grid) */}
          <div className="grid grid-cols-3 gap-2 bg-transparent p-2 justify-items-center rounded-lg">
            {[0, 1, 2].map((row) => (
              <React.Fragment key={row}>
                {[0, 1, 2].map((col) => {
                  const isActive = getCellActive(row, col);

                  // For “stack” flex distributions, only the col for justify or row for align is relevant
                  const isDisabled =
                    layoutMode === "flex" &&
                    distributionMode !== "stack" &&
                    // If distribution is space-between/around/evenly, we typically only allow changing alignItems
                    // We'll let the code below disable anything that doesn't match the single col or row
                    false;

                  return (
                    <button
                      key={`${row}-${col}`}
                      className={`
                        w-full h-10 rounded-lg
                        flex items-center justify-center
                        transition-colors
                        ${isDisabled ? "opacity-30" : "hover:bg-blue-300/25"}
                        ${isActive ? "bg-blue-300/25" : "bg-gray-800"}
                      `}
                      onClick={() => !isDisabled && handleGridClick(row, col)}
                      disabled={isDisabled}
                    >
                      {isActive && (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* 5) Universal controls: Gap, Overflow, etc. */}
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
              // Add more if you like
            ]}
          />
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
}
