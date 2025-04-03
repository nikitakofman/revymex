import React from "react";
import {
  Hand,
  HelpCircle,
  MousePointer2,
  Keyboard,
  Type,
  Frame,
  Pencil,
} from "lucide-react";

import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { ThemeToggle } from "@/providers/ThemeToggle";
import { useBuilder } from "@/builder/context/builderState";
import { Tooltip } from "react-tooltip";

const BottomToolbar = () => {
  const {
    isFrameModeActive,
    setIsFrameModeActive,
    isTextModeActive,
    setIsTextModeActive,
    isMoveCanvasMode,
    setIsMoveCanvasMode,
    isMiddleMouseDown,
  } = useBuilder();

  // Handle Frame and Text mode toggles
  const handleFrameClick = () => {
    // If frame mode is already active, turn it off
    if (isFrameModeActive) {
      setIsFrameModeActive(false);
    } else {
      // Turn on frame mode and ensure other modes are off
      setIsFrameModeActive(true);
      setIsTextModeActive(false);
      setIsMoveCanvasMode(false);
    }
  };

  const handleTextClick = () => {
    // If text mode is already active, turn it off
    if (isTextModeActive) {
      setIsTextModeActive(false);
    } else {
      // Turn on text mode and ensure other modes are off
      setIsTextModeActive(true);
      setIsFrameModeActive(false);
      setIsMoveCanvasMode(false);
    }
  };

  const handleMoveCanvasClick = () => {
    // If move canvas mode is already active, turn it off
    if (isMoveCanvasMode) {
      setIsMoveCanvasMode(false);
    } else {
      // Turn on move canvas mode and ensure other modes are off
      setIsMoveCanvasMode(true);
      setIsFrameModeActive(false);
      setIsTextModeActive(false);
    }
  };

  return (
    <div className="fixed bottom-4 bottom-toolbar left-1/2 transform -translate-x-1/2 z-[9998] flex justify-center">
      <div className="bg-[var(--bg-surface)] flex items-center p-1.5 rounded-[var(--radius-md)] border border-[var(--border-light)] shadow-elevation-medium transition-all duration-300 w-auto">
        <div className="flex items-center gap-1 transition-all duration-300">
          <Button
            leftIcon={<Frame size={32} />}
            size="md"
            onClick={handleFrameClick}
            className={
              isFrameModeActive
                ? "bg-[var(--accent)] hover:bg-[var(--accent)]  text-white"
                : "hover:text-black dark:hover:text-white"
            }
            variant="ghost"
            data-tooltip-id="bottom-bar-tooltip"
            data-tooltip-content="Draw Frame (F)"
            data-tooltip-place="top"
          />
          <Button
            leftIcon={<Type size={32} />}
            size="md"
            variant="ghost"
            onClick={handleTextClick}
            className={
              isTextModeActive
                ? "bg-[var(--accent)] hover:bg-[var(--accent)]  text-white"
                : "hover:text-black dark:hover:text-white"
            }
            data-tooltip-id="bottom-bar-tooltip"
            data-tooltip-content="Draw Text (T)"
            data-tooltip-place="top"
          />
          <LineSeparator
            orientation="vertical"
            height="26px"
            className="mx-1"
          />

          <Button
            leftIcon={<Pencil size={32} />}
            size="md"
            variant="ghost"
            data-tooltip-id="bottom-bar-tooltip"
            data-tooltip-content="Draw"
            data-tooltip-place="top"
          />

          <LineSeparator
            orientation="vertical"
            height="26px"
            className="mx-1"
          />

          <Button
            leftIcon={<Hand size={32} />}
            size="md"
            variant="ghost"
            onClick={handleMoveCanvasClick}
            className={
              isMoveCanvasMode || isMiddleMouseDown
                ? "bg-[var(--accent)] hover:bg-[var(--accent)]  text-white"
                : "hover:text-black dark:hover:text-white"
            }
            data-tooltip-id="bottom-bar-tooltip"
            data-tooltip-content="Move Canvas (Space)"
            data-tooltip-place="top"
          />

          <ThemeToggle
            data-tooltip-id="bottom-bar-tooltip"
            data-tooltip-content="Theme"
            data-tooltip-place="top"
          />
        </div>
      </div>

      <Tooltip
        id="bottom-bar-tooltip"
        delayShow={500}
        opacity={1}
        style={{
          backgroundColor: "var(--accent)",
          padding: "6px 10px",
          borderRadius: "4px",
          fontSize: "12px",
          opacity: "1",
          fontWeight: "500",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        }}
      />
    </div>
  );
};

export default BottomToolbar;
