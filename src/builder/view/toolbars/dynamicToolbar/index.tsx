"use client";

import React, { useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useTheme } from "next-themes";
import { Sun, Moon, PlayCircle, Copy } from "lucide-react";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { createPortal } from "react-dom";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";

export const DynamicToolbar: React.FC = () => {
  const {
    transform,
    setTransform,
    nodeState,
    nodeDisp,
    dragState,
    dragDisp,
    operations,
    clearOperations,
  } = useBuilder();

  return (
    dragState.dynamicModeNodeId &&
    createPortal(
      <>
        <div className="fixed p-4 resize top-[52px] items-center left-[308px]  flex gap-3  shadow-[var(--shadow-sm)] border-b border-[var(--border-default)] bg-[var(--bg-canvas)] w-[calc(100%-565px)] ">
          <Button
            size="sm"
            className="outline outline-[var(--accent-secondary)]"
            onClick={() => {
              nodeDisp.resetDynamicNodePositions();
              dragDisp.setDynamicModeNodeId(null);
              nodeDisp.syncViewports();
              dragDisp.setDynamicState("normal");
            }}
          >
            Home
          </Button>
          <LineSeparator
            orientation="vertical"
            color="var(--border-default)"
            height="20px"
          />
          <Button
            variant="secondary"
            size="sm"
            className={` ${
              dragState.dynamicState === "normal"
                ? " outline outline-[var(--accent)] "
                : "bg-transparent"
            }`}
            onClick={() => dragDisp.setDynamicState("normal")}
          >
            Normal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={`${
              dragState.dynamicState === "hovered"
                ? " outline outline-[var(--accent)] "
                : "bg-transparent"
            }`}
            onClick={() => dragDisp.setDynamicState("hovered")}
          >
            Hovered
          </Button>
        </div>
      </>,
      document.body
    )
  );
};
