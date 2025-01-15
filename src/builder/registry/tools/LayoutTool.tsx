import React, { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  AlignJustify,
  MoreHorizontal,
  MoreVertical,
} from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import {
  ToolContainer,
  ToolSection,
  ToolButton,
  ToolButtonGroup,
  ToolGrid,
} from "./_components/tool-ui";
import { ToolInput } from "./_components/ToolInput";

type Distribution = "stack" | "space-between" | "space-around" | "space-evenly";

const LayoutTool = () => {
  const { setNodeStyle } = useBuilder();
  const [direction, setDirection] = useState<"row" | "column">("row");
  const [distribution, setDistribution] = useState<Distribution>("stack");

  const alignMap = ["flex-start", "center", "flex-end"] as const;
  const justifyMap = ["flex-start", "center", "flex-end"] as const;

  const handleGridClick = (row: number, col: number) => {
    if (distribution === "stack") {
      setNodeStyle({
        display: "flex",
        flexDirection: direction,
        justifyContent: justifyMap[col],
        alignItems: alignMap[row],
      });
    } else {
      setNodeStyle({
        display: "flex",
        flexDirection: direction,
        justifyContent: distribution,
        alignItems: alignMap[row],
      });
    }
  };

  const getBoxStyle = () => ({
    width: "8px",
    height: "8px",
    background: "var(--accent)",
    borderRadius: "var(--radius-sm)",
  });

  return (
    <ToolContainer>
      {/* Direction Controls */}
      <ToolSection>
        <ToolButtonGroup>
          <ToolButton
            active={direction === "row"}
            variant="primary"
            onClick={() => setDirection("row")}
          >
            <ArrowRight className="w-4 h-4" />
          </ToolButton>
          <ToolButton
            active={direction === "column"}
            variant="primary"
            onClick={() => setDirection("column")}
          >
            <ArrowDown className="w-4 h-4" />
          </ToolButton>
        </ToolButtonGroup>
      </ToolSection>

      {/* Distribution Controls */}
      <ToolSection>
        {(
          ["stack", "space-between", "space-around", "space-evenly"] as const
        ).map((dist) => (
          <ToolButton
            key={dist}
            active={distribution === dist}
            onClick={() => setDistribution(dist)}
            className="w-full justify-start"
            size="sm"
          >
            {dist === "stack" && <AlignJustify className="w-4 h-4" />}
            {dist === "space-between" && <MoreHorizontal className="w-4 h-4" />}
            {dist === "space-around" && <MoreVertical className="w-4 h-4" />}
            {dist === "space-evenly" && <AlignJustify className="w-4 h-4" />}
            <span className="capitalize">{dist}</span>
          </ToolButton>
        ))}
      </ToolSection>

      {/* Alignment Grid */}
      <ToolSection>
        <ToolGrid>
          {[0, 1, 2].map((row) => (
            <React.Fragment key={row}>
              {[0, 1, 2].map((col) => {
                const isDisabled = distribution !== "stack" && col !== 0;
                return (
                  <button
                    key={`${row}-${col}`}
                    className={`
                      aspect-square relative 
                      bg-[var(--control-bg)]
                      hover:bg-[var(--control-bg-hover)]
                      border border-[var(--control-border)]
                      rounded-[var(--radius-sm)]
                      p-1
                      ${
                        isDisabled
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }
                    `}
                    onClick={() => !isDisabled && handleGridClick(row, col)}
                    disabled={isDisabled}
                  >
                    <div
                      className="absolute inset-1"
                      style={{
                        display: "flex",
                        flexDirection: direction,
                        justifyContent:
                          distribution === "stack"
                            ? justifyMap[col]
                            : distribution,
                        alignItems: alignMap[row],
                      }}
                    >
                      <div style={getBoxStyle()} />
                    </div>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </ToolGrid>
      </ToolSection>

      <ToolSection>
        <ToolInput
          type="number"
          name="gap"
          label="Gap"
          unit="px"
          min={0}
          max={10000}
          step={1}
        />
      </ToolSection>
    </ToolContainer>
  );
};

export default LayoutTool;
