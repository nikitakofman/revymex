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

export default function LayoutTool() {
  const { setNodeStyle, nodeState, dragState } = useBuilder();

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
    setNodeStyle(
      {
        justifyContent: value,
      },
      undefined,
      true
    );
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

  // Distribution options for dropdown
  const distributionOptions = [
    { label: "Start", value: "flex-start" },
    { label: "Center", value: "center" },
    { label: "End", value: "flex-end" },
    { label: "Space Between", value: "space-between" },
    { label: "Space Around", value: "space-around" },
    { label: "Space Evenly", value: "space-evenly" },
  ];

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
                    label: "Stack",
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
              <div className="flex justify-between items-center">
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
              </div>

              {/* Distribute Dropdown */}
              <div className="flex justify-between items-center">
                <Label>Distribute</Label>
                <div className="w-3/5">
                  <ToolSelect
                    name="distribute"
                    value={distribution}
                    onChange={handleDistributionChange}
                    options={distributionOptions}
                  />
                </div>
              </div>

              {/* Align: Left, Center, Right */}
              <div className="flex justify-between items-center">
                <Label>Align</Label>
                <div className="w-3/5">
                  <ToolbarSegmentedControl
                    cssProperty="alignItems"
                    defaultValue="flex-start"
                    size="sm"
                    options={[
                      {
                        value: "flex-start",
                        icon: <AlignLeft className="w-4 h-4" />,
                      },
                      {
                        value: "center",
                        icon: <AlignCenter className="w-4 h-4" />,
                      },
                      {
                        value: "flex-end",
                        icon: <AlignRight className="w-4 h-4" />,
                      },
                    ]}
                    onChange={handleAlignmentChange}
                    currentValue={alignment}
                  />
                </div>
              </div>

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
