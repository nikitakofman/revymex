import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Square,
  SquareAsterisk,
  Grid2x2,
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
import { ToolbarSwitch } from "./_components/ToolbarSwitch";

const AlignmentGrid = ({ direction, distribution, alignment, onChange }) => {
  // Track hover state for rows/columns
  const [hoveredPosition, setHoveredPosition] = useState(null);

  // Convert flex-start/flex-end to simpler start/end
  const getSimpleValue = (value) => {
    if (value === "flex-start") return "start";
    if (value === "flex-end") return "end";
    return value;
  };

  // Convert back to CSS values
  const getFlexValue = (value) => {
    if (value === "start") return "flex-start";
    if (value === "end") return "flex-end";
    return value;
  };

  // Determine the active cell
  const justifySimple = getSimpleValue(distribution);
  const alignSimple = getSimpleValue(alignment);

  // Check if we're using an advanced distribution option
  const isAdvancedDistribution = [
    "space-between",
    "space-around",
    "space-evenly",
  ].includes(distribution);

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-1 p-2 bg-[var(--control-bg)] rounded-lg border border-[var(--border-light)]">
        {["start", "center", "end"]
          .map((verticalAlign, vIndex) =>
            ["start", "center", "end"].map((horizontalAlign, hIndex) => {
              // Determine which value maps to justify/align based on direction
              const justifyValue =
                direction === "row" ? horizontalAlign : verticalAlign;
              const alignValue =
                direction === "row" ? verticalAlign : horizontalAlign;

              // Check if this cell is active - special logic for advanced distribution
              let isActive = false;

              if (isAdvancedDistribution) {
                // For row direction, highlight entire row (same vertical align)
                // For column direction, highlight entire column (same horizontal align)
                if (direction === "row") {
                  isActive = alignSimple === alignValue;
                } else {
                  isActive = alignSimple === alignValue;
                }
              } else {
                // Normal case - just match the exact position
                isActive =
                  justifySimple === justifyValue && alignSimple === alignValue;
              }

              // Check if this cell should show hover effect
              let isHovered = false;
              if (hoveredPosition) {
                if (isAdvancedDistribution) {
                  // In advanced distribution mode, hover entire rows/columns
                  if (
                    direction === "row" &&
                    hoveredPosition.vIndex === vIndex
                  ) {
                    isHovered = true;
                  } else if (
                    direction === "column" &&
                    hoveredPosition.hIndex === hIndex
                  ) {
                    isHovered = true;
                  }
                } else {
                  // In normal mode, hover only the exact cell
                  isHovered =
                    hoveredPosition.vIndex === vIndex &&
                    hoveredPosition.hIndex === hIndex;
                }
              }

              return (
                <button
                  key={`${verticalAlign}-${horizontalAlign}`}
                  type="button"
                  className={`relative flex items-center justify-center w-full aspect-square rounded-lg transition-colors
                  ${
                    isActive
                      ? "bg-[var(--accent)] text-white"
                      : isHovered
                      ? "bg-[var(--accent-hover)] text-white"
                      : "bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  }
                `}
                  onClick={() => {
                    if (isAdvancedDistribution) {
                      // In advanced distribution mode, only update alignment
                      // and preserve the current distribution
                      onChange({
                        justify: distribution, // Keep the current distribution mode
                        align: getFlexValue(alignValue),
                        keepDistribution: true, // Flag to indicate we should keep current distribution
                      });
                    } else {
                      // In stack mode, update both justify and align
                      onChange({
                        justify: getFlexValue(justifyValue),
                        align: getFlexValue(alignValue),
                        keepDistribution: false,
                      });
                    }
                  }}
                  onMouseEnter={() => setHoveredPosition({ vIndex, hIndex })}
                  onMouseLeave={() => setHoveredPosition(null)}
                >
                  {/* Show white/gray squares based on active state */}
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className={`w-3 h-3 rounded-sm ${
                        isActive
                          ? "bg-white"
                          : "bg-current hover:bg-white opacity-50"
                      }`}
                    ></div>
                  </div>
                </button>
              );
            })
          )
          .flat()}
      </div>
    </div>
  );
};

export default function LayoutTool() {
  const { setNodeStyle } = useBuilder();

  // Track layout mode (Stack/Grid)
  const [layoutMode, setLayoutMode] = useState("flex");
  // Track direction (Row/Column)
  const [direction, setDirection] = useState("row");
  // Track distribution (Start/Center/End/Space Between/etc)
  const [distribution, setDistribution] = useState("flex-start");
  // Track alignment (Start/Center/End)
  const [alignment, setAlignment] = useState("flex-start");
  // Track gap
  const [gap, setGap] = useState(0);
  // Track padding
  const [padding, setPadding] = useState(0);
  // Track grid columns and rows
  const [gridColumns, setGridColumns] = useState(3);
  const [gridRows, setGridRows] = useState(3);

  // -- COMPUTED STYLES --
  const computedDisplay = useComputedStyle({
    property: "display",
    defaultValue: "flex",
  });

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

  const computedWrap = useComputedStyle({
    property: "flexWrap",
    defaultValue: "nowrap",
  });

  const computedGap = useComputedStyle({
    property: "gap",
    defaultValue: "0px",
  });

  const computedPadding = useComputedStyle({
    property: "padding",
    defaultValue: "0px",
  });

  const computedGridCols = useComputedStyle({
    property: "gridTemplateColumns",
    defaultValue: "repeat(3, 1fr)",
  });

  const computedGridRows = useComputedStyle({
    property: "gridTemplateRows",
    defaultValue: "repeat(3, 1fr)",
  });

  // Parse a grid template string like "repeat(3, 1fr)" to get the number
  const parseGridTemplate = (template) => {
    if (!template || template === "none") return 3;
    const match = template.match(/repeat\((\d+)/);
    return match ? parseInt(match[1], 10) : 3;
  };

  // Update local state from computed styles on initial load
  useEffect(() => {
    if (!computedDisplay.mixed) {
      setLayoutMode(computedDisplay.value === "grid" ? "grid" : "flex");
    }

    if (!computedDirection.mixed) {
      setDirection(computedDirection.value);
    }

    if (!computedJustify.mixed) {
      setDistribution(computedJustify.value);
    }

    if (!computedAlign.mixed) {
      setAlignment(computedAlign.value);
    }

    if (!computedGap.mixed) {
      const gapValue = parseInt(computedGap.value) || 0;
      setGap(gapValue);
    }

    if (!computedPadding.mixed) {
      const paddingValue = parseInt(computedPadding.value) || 0;
      setPadding(paddingValue);
    }

    if (!computedGridCols.mixed) {
      const colsValue = parseGridTemplate(computedGridCols.value);
      setGridColumns(colsValue);
    }

    if (!computedGridRows.mixed) {
      const rowsValue = parseGridTemplate(computedGridRows.value);
      setGridRows(rowsValue);
    }
  }, [
    computedDisplay,
    computedDirection,
    computedJustify,
    computedAlign,
    computedGap,
    computedPadding,
    computedGridCols,
    computedGridRows,
  ]);

  // Handler functions for control changes
  const handleLayoutChange = (value) => {
    setLayoutMode(value);

    if (value === "grid") {
      // When switching to grid, set grid template columns and rows
      setNodeStyle(
        {
          display: "grid",
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        },
        undefined,
        true
      );
    } else {
      // When switching to flex, set flex properties
      setNodeStyle(
        {
          display: "flex",
          flexDirection: direction,
          justifyContent: distribution,
          alignItems: alignment,
        },
        undefined,
        true
      );
    }
  };

  const handleDirectionChange = (value) => {
    setDirection(value);
    setNodeStyle(
      {
        flexDirection: value,
      },
      undefined,
      true
    );
  };

  const handleDistributionChange = (value) => {
    setDistribution(value);

    // If switching to "stack" mode, restore standard justify content based on grid selection
    if (value === "stack") {
      // Get simple value for alignment
      const alignSimple =
        alignment === "flex-start"
          ? "start"
          : alignment === "flex-end"
          ? "end"
          : "center";

      // For row direction, use horizontal position from grid
      // For column direction, use vertical position from grid
      const position = direction === "row" ? "center" : "center"; // Default center

      const newJustify =
        position === "start"
          ? "flex-start"
          : position === "end"
          ? "flex-end"
          : "center";

      // Update with standard value based on current grid selection
      setNodeStyle(
        {
          justifyContent: newJustify,
        },
        undefined,
        true
      );

      setDistribution(newJustify);
    } else {
      // Apply advanced distribution
      setNodeStyle(
        {
          justifyContent: value,
        },
        undefined,
        true
      );
    }
  };

  const handleAlignmentChange = (value) => {
    setAlignment(value);
    setNodeStyle(
      {
        alignItems: value,
      },
      undefined,
      true
    );
  };

  // New combined handler for alignment grid
  const handleAlignmentGridChange = ({ justify, align, keepDistribution }) => {
    // Update alignment state
    setAlignment(align);

    // Only update distribution if we're not keeping the current distribution
    if (!keepDistribution) {
      setDistribution(justify);
    }

    // Apply the changes to the node
    setNodeStyle(
      {
        // Use the existing distribution if keepDistribution flag is true
        justifyContent: keepDistribution ? distribution : justify,
        alignItems: align,
      },
      undefined,
      true
    );
  };

  const handleGridColumnsChange = (value) => {
    setGridColumns(value);
    setNodeStyle(
      {
        display: "grid",
        gridTemplateColumns: `repeat(${value}, 1fr)`,
      },
      undefined,
      true
    );
  };

  const handleGridRowsChange = (value) => {
    setGridRows(value);
    setNodeStyle(
      {
        display: "grid",
        gridTemplateRows: `repeat(${value}, 1fr)`,
      },
      undefined,
      true
    );
  };

  // Distribution options for dropdown - added "Stack" option
  const distributionOptions = [
    { label: "Stack", value: "stack" },
    { label: "Between", value: "space-between" },
    { label: "Around", value: "space-around" },
    { label: "Evenly", value: "space-evenly" },
  ];

  // Get the current distribution value for the dropdown
  const getCurrentDistributionValue = () => {
    if (
      ["space-between", "space-around", "space-evenly"].includes(distribution)
    ) {
      return distribution;
    }
    return "stack";
  };

  return (
    <ToolbarContainer>
      <ToolbarSection title="Layout">
        <div className="flex flex-col space-y-4">
          {/* Type: Stack vs Grid */}
          <div className="flex justify-between items-center">
            <Label>Type</Label>
            <div className="w-3/5">
              <ToolbarSegmentedControl
                cssProperty="display"
                defaultValue="flex"
                size="sm"
                options={[
                  {
                    label: "Flex",
                    value: "flex",
                  },
                  {
                    label: "Grid",
                    value: "grid",
                  },
                ]}
                onChange={handleLayoutChange}
                currentValue={layoutMode}
              />
            </div>
          </div>

          {/* Stack-specific controls */}
          {layoutMode === "flex" && (
            <>
              {/* Direction: Row vs Column */}
              {/* <div className="flex justify-between items-center">
                <Label>Direction</Label>
                <div className="w-3/5">
                  <ToolbarSegmentedControl
                    cssProperty="flexDirection"
                    defaultValue="row"
                    size="sm"
                    options={[
                      {
                        value: "row",
                        icon: <ArrowRight className="w-4 h-4" />,
                      },
                      {
                        value: "column",
                        icon: <ArrowDown className="w-4 h-4" />,
                      },
                    ]}
                    onChange={handleDirectionChange}
                    currentValue={direction}
                  />
                </div>
              </div> */}

              {/* New Alignment Grid */}
              <div className="flex flex-row-reverse gap-4">
                <div className=" w-1/2 flex flex-col space-y-2 mt-1.5">
                  <Label>Alignment</Label>
                  <AlignmentGrid
                    direction={direction}
                    distribution={distribution}
                    alignment={alignment}
                    onChange={handleAlignmentGridChange}
                  />
                </div>
                <div className="w-1/2 space-y-1.5">
                  <Label>Direction</Label>
                  <ToolbarSegmentedControl
                    cssProperty="flexDirection"
                    defaultValue="row"
                    size="sm"
                    options={[
                      {
                        value: "row",
                        icon: <ArrowRight className="w-4 h-4" />,
                      },
                      {
                        value: "column",
                        icon: <ArrowDown className="w-4 h-4" />,
                      },
                    ]}
                    onChange={handleDirectionChange}
                    currentValue={direction}
                  />
                  <div className="flex pt-1 flex-col space-y-2 justify-between items-center">
                    <ToolSelect
                      customSelectWidth="w-24"
                      name="distribute"
                      value={getCurrentDistributionValue()}
                      onChange={handleDistributionChange}
                      options={distributionOptions}
                    />
                  </div>
                </div>
              </div>

              {/* Distribution options */}
              {/* <div className="flex justify-between items-center">
                <Label>Distribute</Label>
                <div className="w-3/5">
                  <ToolSelect
                    name="distribute"
                    value={getCurrentDistributionValue()}
                    onChange={handleDistributionChange}
                    options={distributionOptions}
                  />
                </div>
              </div> */}

              {/* Wrap: Yes/No */}
              <div className="flex justify-between w-full items-center">
                <Label>Wrap</Label>
                <ToolbarSwitch
                  cssProperty="flexWrap"
                  onValue="wrap"
                  offValue="nowrap"
                />
              </div>
            </>
          )}

          {/* Grid-specific controls */}
          {layoutMode === "grid" && (
            <>
              {/* Grid Columns */}
              <div className="flex justify-between items-center">
                <Label>Columns</Label>
                <ToolInput
                  type="number"
                  name="gridTemplateColumns"
                  value={gridColumns}
                  min={1}
                  max={12}
                  step={1}
                  onChange={handleGridColumnsChange}
                />
              </div>

              {/* Grid Rows */}
              <div className="flex justify-between items-center">
                <Label>Rows</Label>
                <ToolInput
                  type="number"
                  name="gridTemplateRows"
                  value={gridRows}
                  min={1}
                  max={12}
                  step={1}
                  onChange={handleGridRowsChange}
                />
              </div>
            </>
          )}

          {/* Common controls for both modes */}
          {/* Gap with slider */}
          <div className="flex justify-between items-center">
            <Label>Gap</Label>
            <ToolInput
              type="number"
              name="gap"
              min={0}
              max={100}
              step={1}
              showSlider
              sliderMin={0}
              sliderMax={100}
              sliderStep={1}
            />
          </div>

          {/* Padding */}
          <div className="flex justify-between items-center">
            <Label>Padding</Label>
            <ToolInput
              type="number"
              name="padding"
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="flex justify-between items-center">
            <Label>Overflow</Label>
            <ToolSelect
              name="overflow"
              options={[
                { value: "hidden", label: "Hidden" },
                { value: "visible", label: "Visible" },
              ]}
            />
          </div>
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
}
