import React, { useState } from "react";
import {
  Hand,
  HelpCircle,
  MousePointer2,
  Keyboard,
  Type,
  Frame,
} from "lucide-react";

import ToggleGroup from "@/components/ui/toggle-group";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import { ThemeToggle } from "@/providers/ThemeToggle";
import { useBuilder } from "@/builder/context/builderState";
import { Tooltip } from "react-tooltip";

interface BottomToolbarProps {
  onGrabToggle: (isGrabbing: boolean) => void;
  isGrabbing?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
}

const BottomToolbar = ({ onGrabToggle }: BottomToolbarProps) => {
  const [mode, setMode] = useState("send");
  const {
    isFrameModeActive,
    setIsFrameModeActive,
    isTextModeActive,
    setIsTextModeActive,
  } = useBuilder();

  // Handle Frame and Text mode toggles
  const handleFrameClick = () => {
    // If frame mode is already active, turn it off
    if (isFrameModeActive) {
      setIsFrameModeActive(false);
    } else {
      // Turn on frame mode and ensure text mode is off
      setIsFrameModeActive(true);
      setIsTextModeActive(false);
    }
  };

  const handleTextClick = () => {
    // If text mode is already active, turn it off
    if (isTextModeActive) {
      setIsTextModeActive(false);
    } else {
      // Turn on text mode and ensure frame mode is off
      setIsTextModeActive(true);
      setIsFrameModeActive(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9998] flex justify-center">
      <div className="bg-[var(--bg-surface)] flex items-center p-2 rounded-[var(--radius-md)] border border-[var(--border-light)] shadow-elevation-medium transition-all duration-300 w-auto">
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
            data-tooltip-content="Draw Frame"
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
            data-tooltip-content="Draw Text"
            data-tooltip-place="top"
          />
          <LineSeparator
            orientation="vertical"
            height="26px"
            className="mx-1"
          />

          <ToggleGroup
            type="icons"
            options={[
              { label: <MousePointer2 size={18} />, value: "send" },
              { label: <Hand size={18} />, value: "hand" },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value);
              onGrabToggle(value === "hand");

              // When switching to pointer or hand mode, turn off both drawing modes
              if (isFrameModeActive || isTextModeActive) {
                setIsFrameModeActive(false);
                setIsTextModeActive(false);
              }
            }}
          />

          <Button size="sm" variant="ghost">
            <HelpCircle size={18} />
          </Button>
          <Button size="sm" variant="ghost">
            <Keyboard size={18} />
          </Button>
          <LineSeparator orientation="vertical" height="26px" />
          <ThemeToggle />
        </div>
      </div>

      <Tooltip
        id="bottom-bar-tooltip"
        delayShow={500} // 500ms delay before showing$
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
