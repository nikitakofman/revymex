import React, { useState, useEffect } from "react";
import { ToolInput } from "../_components/ToolInput";
import { ColorPicker } from "../_components/ColorPicker";
import { ChevronLeft } from "lucide-react";
import { ToolbarSwitch } from "../_components/ToolbarSwitch";
import {
  useGetSelectedIds,
  useSelectedIds,
} from "@/builder/context/atoms/select-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

export const ShadowToolPopup = () => {
  // Remove the useBuilderDynamic dependency
  const [x, setX] = useState(0);
  const [y, setY] = useState(4);
  const [blur, setBlur] = useState(8);
  const [spread, setSpread] = useState(0);
  const [color, setColor] = useState("rgba(0, 0, 0, 0.2)");
  const [inset, setInset] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Use both reactive and imperative hooks for selected IDs
  const getSelectedIds = useGetSelectedIds();

  // Helper function to update styles for all selected nodes
  const updateStyleForSelectedNodes = (styles) => {
    const ids = getSelectedIds();
    ids.forEach((id) => {
      updateNodeStyle(id, styles);
    });
  };

  // This effect runs when the component mounts or when selection changes
  useEffect(() => {
    const ids = getSelectedIds();

    if (!ids.length) return;

    // Get the selected node's style
    const element = document.querySelector(`[data-node-id="${ids[0]}"]`);
    if (!element) return;

    // Use the inline style directly instead of computed style
    const inlineBoxShadow = element.style.boxShadow;

    console.log("Current box-shadow:", inlineBoxShadow);

    if (!inlineBoxShadow || inlineBoxShadow === "none") return;

    // Try to parse with color first (standard format: x y blur spread color)
    let match = inlineBoxShadow.match(
      /(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]+|[a-z]+)/i
    );

    // If that fails, try format with color first (color x y blur spread)
    if (!match) {
      match = inlineBoxShadow.match(
        /(rgba?\([^)]+\)|#[0-9A-Fa-f]+|[a-z]+)\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px/i
      );

      if (match) {
        // Color is first in this format
        setColor(match[1]);
        setX(parseInt(match[2], 10));
        setY(parseInt(match[3], 10));
        setBlur(parseInt(match[4], 10));
        setSpread(parseInt(match[5], 10));
      }
    } else {
      // Standard format - color is last
      setX(parseInt(match[1], 10));
      setY(parseInt(match[2], 10));
      setBlur(parseInt(match[3], 10));
      setSpread(parseInt(match[4], 10));
      setColor(match[5]);
    }

    // Check for inset
    setInset(inlineBoxShadow.includes("inset"));
  }, [getSelectedIds]);

  // Apply the complete shadow
  const applyShadow = () => {
    // Two possible formats: "x y blur spread color" or "color x y blur spread"
    // We'll use the standard format: "x y blur spread color"
    const insetText = inset ? "inset " : "";
    const shadowValue = `${insetText}${x}px ${y}px ${blur}px ${spread}px ${color}`;

    console.log("Applying shadow:", shadowValue);
    updateStyleForSelectedNodes({ boxShadow: shadowValue });
  };

  // Update shadow when any property changes
  useEffect(() => {
    applyShadow();
  }, [x, y, blur, spread, color, inset]);

  // Handle color change from the color picker
  const handleColorChange = (newColor) => {
    setColor(newColor);
  };

  // Handle back button click
  const handleBackClick = (e) => {
    e.stopPropagation();
    setShowColorPicker(false);
  };

  // Handle click on color picker container to prevent event bubbling
  const handleColorPickerClick = (e) => {
    e.stopPropagation();
  };

  const handleInsetToggle = (value) => {
    setInset(value === "inset");
  };

  return (
    <div
      className="relative overflow-hidden transition-all duration-300"
      data-is-expandable={showColorPicker ? "true" : "false"}
      style={{
        minHeight: showColorPicker ? "0" : "auto",
        height: showColorPicker ? "270px" : "245px",
      }}
    >
      {/* Slide container for both panels */}
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{
          transform: showColorPicker ? "translateX(-50%)" : "translateX(0)",
          width: "200%", // Double width to hold both panels side by side
        }}
      >
        {/* Main shadow settings panel - always rendered */}
        <div className="w-1/2 space-y-4 p-1 flex-shrink-0">
          <ToolInput
            type="number"
            label="X Offset"
            name="shadowX"
            customValue={x}
            onCustomChange={(value) => setX(parseInt(value.toString(), 10))}
            unit="px"
          />
          <ToolInput
            type="number"
            label="Y Offset"
            name="shadowY"
            customValue={y}
            onCustomChange={(value) => setY(parseInt(value.toString(), 10))}
            unit="px"
          />
          <ToolInput
            type="number"
            label="Blur"
            name="shadowBlur"
            min={0}
            customValue={blur}
            onCustomChange={(value) => setBlur(parseInt(value.toString(), 10))}
            unit="px"
          />
          <ToolInput
            type="number"
            label="Spread"
            name="shadowSpread"
            customValue={spread}
            onCustomChange={(value) =>
              setSpread(parseInt(value.toString(), 10))
            }
            unit="px"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Color</span>
            <button
              onClick={() => setShowColorPicker(true)}
              className="flex items-center gap-2 h-7 px-2 text-xs bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
            >
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: color }}
              ></div>
              <span className="text-[var(--text-primary)]">
                {color.startsWith("#") ? color.toUpperCase() : color}
              </span>
            </button>
          </div>
          <ToolbarSwitch
            label="Inset Shadow"
            cssProperty="boxShadow.inset"
            onValue="inset"
            offValue="normal"
            currentValue={inset ? "inset" : "normal"}
            onChange={handleInsetToggle}
          />
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
              Shadow Settings
            </button>
          </div>

          <div className="p-1">
            <ColorPicker
              displayMode="direct"
              value={color.startsWith("#") ? color : "#000000"}
              onChange={handleColorChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadowToolPopup;
