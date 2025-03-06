import React, { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  ArrowDown,
  Layers2,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignHorizontalDistributeCenter,
  Grid2x2,
  FileX,
  Check,
  Cross,
} from "lucide-react";

// Replace these imports with your actual component paths
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";

import {
  Label,
  ToolbarContainer,
  ToolbarSection,
} from "./_components/ToolbarAtoms";
import { ToolbarSegmentedControl } from "./_components/ToolbarSegmentedControl";
import { ToolInput } from "./_components/ToolInput";
import { ToolSelect } from "./_components/ToolSelect";
import ToolbarButton from "./_components/ToolbarButton";
import { ToolbarSwitch } from "./_components/ToolbarSwitch";

/** Possible layout modes */
type LayoutMode = "flex" | "grid";

/** Possible distribution modes for flex */
type DistributionMode =
  | "stack"
  | "space-between"
  | "space-around"
  | "space-evenly";

export default function LayoutTool() {
  const { setNodeStyle, nodeState, dragState } = useBuilder();

  // Track which layout mode we're in - fix controlled component issues
  const [displayValue, setDisplayValue] = useState<LayoutMode>("flex");
  const [directionValue, setDirectionValue] = useState<"row" | "column">("row");
  const [justifyValue, setJustifyValue] = useState<string>("flex-start");

  // For flex, track distribution (stack / space-between / space-around / space-evenly)
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("stack");

  // Track active cell in the 3x3 grid
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });

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

  // Also track justifyItems for more accurate grid representation
  const computedJustifyItems = useComputedStyle({
    property: "justifyItems",
    defaultValue: "start",
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

  // Convert justifyItems to a normal string
  const justifyItems = computedJustifyItems.mixed
    ? "start"
    : computedJustifyItems.value;

  // Update local state from computed styles
  useEffect(() => {
    // Update display mode state
    if (!computedDisplay.mixed) {
      const displayMode = computedDisplay.value === "grid" ? "grid" : "flex";
      setDisplayValue(displayMode);
    }

    // Update direction state
    if (!computedDirection.mixed) {
      setDirectionValue(computedDirection.value as "row" | "column");
    }

    // Update justify state
    if (!computedJustify.mixed) {
      setJustifyValue(computedJustify.value as string);
    }

    // Update distribution mode
    if (justifyContent === "flex-start") {
      setDistributionMode("stack");
    } else if (
      justifyContent === "space-between" ||
      justifyContent === "space-around" ||
      justifyContent === "space-evenly"
    ) {
      setDistributionMode(justifyContent as DistributionMode);
    }
  }, [computedDisplay, computedDirection, computedJustify, justifyContent]);

  // Update active cell based on computed styles
  const updateActiveCell = useCallback(() => {
    // Find row index from alignItems
    let rowIndex = alignMap.indexOf(alignItems as any);
    if (rowIndex === -1) rowIndex = 0;

    // Find column index for justifyContent or justifyItems
    let colIndex;
    if (displayValue === "grid") {
      colIndex = justifyMap.indexOf(justifyItems as any);
      if (colIndex === -1) colIndex = 0;
    } else {
      if (distributionMode === "stack") {
        if (directionValue === "row") {
          colIndex = justifyMap.indexOf(justifyContent as any);
        } else {
          // For column direction, justifyContent maps to rows
          rowIndex = justifyMap.indexOf(justifyContent as any);
          colIndex = alignMap.indexOf(alignItems as any);
        }
      } else {
        // For distribution modes, we only track alignItems
        if (directionValue === "row") {
          colIndex = 0; // Fixed at left column
        } else {
          rowIndex = 0; // Fixed at top row
          colIndex = alignMap.indexOf(alignItems as any);
        }
      }
    }

    if (colIndex === -1) colIndex = 0;

    setActiveCell({ row: rowIndex, col: colIndex });
  }, [
    alignItems,
    justifyContent,
    justifyItems,
    displayValue,
    distributionMode,
    directionValue,
  ]);

  // Update active cell when styles change
  useEffect(() => {
    updateActiveCell();
  }, [
    updateActiveCell,
    alignItems,
    justifyContent,
    justifyItems,
    displayValue,
    distributionMode,
    directionValue,
  ]);

  // -- GRID ALIGNMENT CELLS --

  /**
   * handleGridClick: Called when we click one of the 3x3 alignment cells.
   * For Grid mode, sets `justifyItems` + `alignItems`.
   * For Flex mode, sets `justifyContent` + `alignItems` (depending on distributionMode).
   */
  function handleGridClick(row: number, col: number) {
    // Set the active cell immediately for visual feedback
    setActiveCell({ row, col });

    if (displayValue === "grid") {
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
            flexDirection: directionValue,
            justifyContent:
              directionValue === "row" ? justifyMap[col] : justifyMap[row],
            alignItems:
              directionValue === "row" ? alignMap[row] : alignMap[col],
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
            flexDirection: directionValue,
            justifyContent: distributionMode,
            alignItems:
              directionValue === "row" ? alignMap[row] : alignMap[col],
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
    return row === activeCell.row && col === activeCell.col;
  }

  // Add this function to handle fill mode updates
  const updateFillModeChildren = (newDirection: "row" | "column") => {
    // Get selected parent node's children
    const selectedId = dragState.selectedIds[0];
    if (!selectedId) return;

    console.log("Updating fill mode for direction:", newDirection);

    const childNodes = nodeState.nodes.filter(
      (node) => node.parentId === selectedId
    );

    childNodes.forEach((childNode) => {
      const childElement = document.querySelector(
        `[data-node-id="${childNode.id}"]`
      ) as HTMLElement;

      // Check if child is in fill mode
      if (childElement?.style.flex === "1 0 0px") {
        console.log("Found fill mode child:", {
          childId: childNode.id,
          newDirection,
          currentStyles: {
            flex: childElement.style.flex,
            width: childElement.style.width,
            height: childElement.style.height,
          },
        });

        if (newDirection === "column") {
          setNodeStyle(
            {
              width: "100%",
              height: "1px",
              flex: "1 0 0px",
            },
            [childNode.id],
            true
          );
        } else {
          // row
          setNodeStyle(
            {
              width: "1px",
              height: "100%",
              flex: "1 0 0px",
            },
            [childNode.id],
            true
          );
        }
      }
    });
  };

  // Handle direct mode changes manually
  const handleDisplayChange = (value) => {
    setDisplayValue(value);
    setNodeStyle(
      {
        display: value,
      },
      undefined,
      true
    );
  };

  const handleWrapChange = (value) => {
    setNodeStyle(
      {
        flexWrap: value,
      },
      undefined,
      true
    );
  };

  // Handle direction changes manually
  const handleDirectionChange = (value) => {
    setDirectionValue(value);
    setNodeStyle(
      {
        flexDirection: value,
      },
      undefined,
      true
    );

    // Update fill mode children after the direction has been applied
    requestAnimationFrame(() => {
      updateFillModeChildren(value as "row" | "column");
    });
  };

  // Handle distribution changes manually
  const handleDistributionChange = (value) => {
    setJustifyValue(value);
    if (value === "flex-start") {
      setDistributionMode("stack");
    } else {
      setDistributionMode(value as DistributionMode);
    }

    setNodeStyle(
      {
        justifyContent: value,
      },
      undefined,
      true
    );
  };

  return (
    <ToolbarContainer>
      <ToolbarSection title="Layout">
        <div className="flex flex-col space-y-3">
          {/* 1) Layout Mode Toggle: Flex vs. Grid */}
          <div className="relative">
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
              onChange={handleDisplayChange}
              currentValue={displayValue}
            />
          </div>

          {/* 2) If Flex: show direction + distribution controls */}
          {displayValue === "flex" && (
            <>
              <div className="relative">
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
                  onChange={handleDirectionChange}
                  currentValue={directionValue}
                />
              </div>

              <div className="relative">
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
                            directionValue === "column" ? "rotate-90" : ""
                          } w-3.5 h-3.5`}
                        />
                      ),
                    },
                    {
                      value: "space-around",
                      icon: (
                        <AlignHorizontalSpaceAround
                          className={`${
                            directionValue === "column" ? "rotate-90" : ""
                          } w-3.5 h-3.5`}
                        />
                      ),
                    },
                    {
                      value: "space-evenly",
                      icon: (
                        <AlignHorizontalDistributeCenter
                          className={`${
                            directionValue === "column" ? "rotate-90" : ""
                          } w-3.5 h-3.5`}
                        />
                      ),
                    },
                  ]}
                  onChange={handleDistributionChange}
                  currentValue={justifyValue}
                />
              </div>
            </>
          )}

          {/* 3) If Grid: show controls for columns/rows */}
          {displayValue === "grid" && (
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
          <div className="grid grid-cols-3 gap-2 bg-transparent py-2 px-3 justify-items-center rounded-lg">
            {[0, 1, 2].map((row) => (
              <React.Fragment key={row}>
                {[0, 1, 2].map((col) => {
                  const isActive = getCellActive(row, col);

                  // For "stack" flex distributions, only the col for justify or row for align is relevant
                  const isDisabled =
                    displayValue === "flex" &&
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
                        
                        bg-slate-200

                        dark:bg-[var(--control-bg)]
                        ${
                          isDisabled
                            ? "opacity-30"
                            : "hover:bg-slate-300 dark:hover:bg-slate-600"
                        }
                        ${
                          isActive
                            ? "bg-slate-300 dark:bg-slate-600"
                            : "bg-[var(--bg-default)]"
                        }
                      `}
                      onClick={() => !isDisabled && handleGridClick(row, col)}
                      disabled={isDisabled}
                    >
                      {isActive && (
                        <div className="w-2.5 h-2.5 bg-[var(--accent)] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="w-full flex items-center justify-between">
            <Label>Wrap</Label>
            <ToolbarSwitch
              cssProperty="flexWrap"
              onValue="wrap"
              offValue="nowrap"
            />
          </div>
          <ToolSelect
            label="Overflow"
            name="overflow"
            options={[
              { label: "Hidden", value: "hidden" },
              { label: "Visible", value: "visible" },
              // Add more if you like
            ]}
          />
          <ToolInput
            type="number"
            label="Padding"
            value="0"
            min={0}
            step={1}
            // unit={paddingUnit}
            name="padding"
            // onUnitChange={setPaddingUnit}
          />
          <ToolInput
            type="number"
            name="gap"
            label="Gap"
            unit="px"
            min={0}
            max={100}
            step={1}
            showSlider
            sliderMin={0}
            sliderMax={100}
            sliderStep={1}
          />
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
}
