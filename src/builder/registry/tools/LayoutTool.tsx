import React, { useState, CSSProperties } from "react";
import {
  ArrowRight,
  ArrowDown,
  AlignJustify,
  MoreHorizontal,
  MoreVertical,
  Layers2,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignHorizontalDistributeCenter,
} from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import {
  ToolbarContainer,
  ToolbarSection,
  ToolbarSegmentedControl,
} from "./_components/test-ui";
import { ToolInput } from "./_components/ToolInput";

type Distribution = "stack" | "space-between" | "space-around" | "space-evenly";

export const LayoutTool = () => {
  const { setNodeStyle } = useBuilder();
  const [direction, setDirection] = useState<"row" | "column">("row");
  const [distribution, setDistribution] = useState<Distribution>("stack");

  const alignMap = ["flex-start", "center", "flex-end"] as const;
  const justifyMap = ["flex-start", "center", "flex-end"] as const;

  const handleGridClick = (row: number, col: number) => {
    if (distribution === "stack") {
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
          justifyContent: distribution,
          alignItems: direction === "row" ? alignMap[row] : alignMap[col],
        },
        undefined,
        true
      );
    }
  };

  const handleDirectionChange = (value: "row" | "column") => {
    setDirection(value);
    setNodeStyle(
      {
        flexDirection: value,
      },
      undefined,
      true
    );
  };

  const handleDistributionChange = (value: Distribution) => {
    setDistribution(value);
    setNodeStyle(
      {
        justifyContent: value === "stack" ? "flex-start" : value,
      },
      undefined,
      true
    );
  };

  const handleGapChange = (value: string) => {
    setNodeStyle(
      {
        gap: `${value}px`,
      },
      undefined,
      true
    );
  };

  const getBoxStyle = () => ({
    width: "4px",
    height: "4px",
    background: "var(--accent)",
    borderRadius: "1px",
  });

  const GridCell = ({
    row,
    col,
    isDisabled,
  }: {
    row: number;
    col: number;
    isDisabled: boolean;
  }) => {
    const getVisualStyles = () => ({
      display: "flex",
      flexDirection: "row",
      justifyContent: justifyMap[col],
      alignItems: alignMap[row],
    });

    return (
      <button
        className={`
          aspect-square relative 
          bg-[var(--control-bg)]
          hover:bg-[var(--control-bg-hover)]
          border border-[var(--control-border)]
          rounded-[var(--radius-sm)]
          ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onClick={() => !isDisabled && handleGridClick(row, col)}
        disabled={isDisabled}
      >
        <div className="absolute inset-0.5" style={getVisualStyles()}>
          <div style={getBoxStyle()} />
        </div>
      </button>
    );
  };

  return (
    <ToolbarContainer>
      <ToolbarSection title="Layout">
        <div className="flex flex-col space-y-3">
          {/* Direction and Distribution Controls */}
          <div className="space-y-1">
            <ToolbarSegmentedControl
              value={direction}
              onChange={handleDirectionChange}
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
              value={distribution}
              onChange={handleDistributionChange}
              size="sm"
              options={[
                {
                  value: "stack",
                  icon: <Layers2 className="w-3.5 h-3.5" />,
                },
                {
                  value: "space-between",
                  icon: (
                    <AlignHorizontalSpaceBetween
                      className={` ${
                        direction === "column" && "rotate-90"
                      }  w-3.5 h-3.5`}
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
                      className={` ${
                        direction === "column" && "rotate-90"
                      } w-3.5 h-3.5`}
                    />
                  ),
                },
              ]}
            />
          </div>

          {/* Alignment Grid */}
          <div className="grid grid-cols-3 gap-0.5">
            {[0, 1, 2].map((row) => (
              <React.Fragment key={row}>
                {[0, 1, 2].map((col) => {
                  const isDisabled =
                    distribution !== "stack" &&
                    (direction === "row" ? col !== 0 : row !== 0);
                  return (
                    <GridCell
                      key={`${row}-${col}`}
                      row={row}
                      col={col}
                      isDisabled={isDisabled}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Gap Control */}
          <ToolInput
            type="number"
            name="gap"
            label="Gap"
            unit="px"
            min={0}
            max={100}
            step={1}
            onChange={(e) => handleGapChange(e.target.value)}
          />
        </div>
      </ToolbarSection>
    </ToolbarContainer>
  );
};

export default LayoutTool;
