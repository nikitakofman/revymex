import React, { useState, useEffect } from "react";
import { ToolInput } from "../_components/ToolInput";
import { ToolSelect } from "../_components/ToolSelect";
import { ColorPicker } from "../_components/ColorPicker";
import { ChevronLeft } from "lucide-react";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { useBuilder } from "@/builder/context/builderState";

export const BorderToolPopup = () => {
  const { setNodeStyle } = useBuilder();

  // Track state for the color picker
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Get the current border color
  const borderColorStyle = useComputedStyle({
    property: "borderColor",
    usePseudoElement: true,
    pseudoElement: "::after",
    isColor: true,
    defaultValue: "#000000",
  });

  const currentColor = borderColorStyle.mixed
    ? "#000000"
    : (borderColorStyle.value as string);

  // Set up border color handler
  const handleBorderColorChange = (color) => {
    setNodeStyle({ borderColor: color }, undefined, true);
  };

  // Handle switching to color picker with smooth transition
  const handleShowColorPicker = () => {
    setIsTransitioning(true);
    setShowColorPicker(true);
  };

  // Handle back button click with smooth transition
  const handleBackClick = (e) => {
    if (e) e.stopPropagation();
    setIsTransitioning(true);
    setShowColorPicker(false);
  };

  // Reset transition state after animation completes
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match this to the transition duration

      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Handle click on color picker container to prevent event bubbling
  const handleColorPickerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="relative overflow-hidden transition-all duration-300 linear"
      data-is-expandable={showColorPicker ? "true" : "false"}
      style={{
        minHeight: showColorPicker ? "0" : "auto",
        height: showColorPicker ? "270px" : "165px",
      }}
    >
      {/* Slide container for both panels */}
      <div
        className="flex"
        style={{
          transform: showColorPicker ? "translateX(-50%)" : "translateX(0)",
          width: "200%", // Double width to hold both panels side by side
          transitionProperty: "transform",
          transitionDuration: "300ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Main border settings panel - always rendered */}
        <div className="w-1/2 space-y-4 p-1 flex-shrink-0">
          <ToolInput type="number" label="Width" name="borderWidth" />

          <ToolSelect
            label="Style"
            name="borderStyle"
            options={[
              { label: "Solid", value: "solid" },
              { label: "Dashed", value: "dashed" },
              { label: "Dotted", value: "dotted" },
            ]}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Color</span>
            <button
              onClick={handleShowColorPicker}
              className="flex items-center gap-2 h-7 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
            >
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: currentColor }}
              ></div>
              <span className="text-[var(--text-primary)]">
                {currentColor.toUpperCase()}
              </span>
            </button>
          </div>

          <ToolInput type="number" label="Radius" name="borderRadius" />
        </div>

        {/* Color picker panel - always rendered but slides in/out */}
        <div
          className="w-1/2  flex-shrink-0"
          onClick={handleColorPickerClick}
          data-is-color-picker={showColorPicker ? "true" : "false"}
        >
          <div className="flex items-center py-2">
            <button
              onClick={handleBackClick}
              className="flex items-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Border Settings
            </button>
          </div>

          <div className="p-1">
            <ColorPicker
              displayMode="direct"
              value={currentColor}
              onChange={handleBorderColorChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BorderToolPopup;
