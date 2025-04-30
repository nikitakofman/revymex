import React, { useState, useEffect } from "react";
import { ToolInput } from "../_components/ToolInput";
import { ColorPicker } from "../_components/ColorPicker";
import { ChevronLeft } from "lucide-react";
import {
  useGetSelectedIds,
  useSelectedIds,
} from "@/builder/context/atoms/select-store";
import { updateNodeStyle } from "@/builder/context/atoms/node-store/operations/style-operations";

export const FilterToolPopup = () => {
  // Remove the useBuilderDynamic dependency
  const selectedIds = useSelectedIds();

  // Filter states
  const [blur, setBlur] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [invert, setInvert] = useState(0);
  const [saturate, setSaturate] = useState(100);
  const [sepia, setSepia] = useState(0);

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper function to update styles for all selected nodes
  const updateStyleForSelectedNodes = (styles) => {
    selectedIds.forEach((id) => {
      updateNodeStyle(id, styles);
    });
  };

  // Parse filter string on component mount
  useEffect(() => {
    if (!selectedIds.length) return;

    // Get the selected node's style
    const element = document.querySelector(
      `[data-node-id="${selectedIds[0]}"]`
    );
    if (!element) return;

    // Get computed style for filters
    const filterStyle = element.style.filter || "";

    // Parse blur
    const blurMatch = filterStyle.match(/blur\(([0-9]+)px\)/);
    if (blurMatch) {
      setBlur(parseInt(blurMatch[1], 10));
    }

    // Parse brightness
    const brightnessMatch = filterStyle.match(/brightness\(([0-9]+)%\)/);
    if (brightnessMatch) {
      setBrightness(parseInt(brightnessMatch[1], 10));
    }

    // Parse contrast
    const contrastMatch = filterStyle.match(/contrast\(([0-9]+)%\)/);
    if (contrastMatch) {
      setContrast(parseInt(contrastMatch[1], 10));
    }

    // Parse grayscale
    const grayscaleMatch = filterStyle.match(/grayscale\(([0-9]+)%\)/);
    if (grayscaleMatch) {
      setGrayscale(parseInt(grayscaleMatch[1], 10));
    }

    // Parse hue-rotate
    const hueRotateMatch = filterStyle.match(/hue-rotate\(([0-9]+)deg\)/);
    if (hueRotateMatch) {
      setHueRotate(parseInt(hueRotateMatch[1], 10));
    }

    // Parse invert
    const invertMatch = filterStyle.match(/invert\(([0-9]+)%\)/);
    if (invertMatch) {
      setInvert(parseInt(invertMatch[1], 10));
    }

    // Parse saturate
    const saturateMatch = filterStyle.match(/saturate\(([0-9]+)%\)/);
    if (saturateMatch) {
      setSaturate(parseInt(saturateMatch[1], 10));
    }

    // Parse sepia
    const sepiaMatch = filterStyle.match(/sepia\(([0-9]+)%\)/);
    if (sepiaMatch) {
      setSepia(parseInt(sepiaMatch[1], 10));
    }
  }, [selectedIds]);

  // Apply filters
  const applyFilters = () => {
    let filterValue = "";

    // Only add filters that have non-default values
    if (blur > 0) {
      filterValue += `blur(${blur}px) `;
    }

    if (brightness !== 100) {
      filterValue += `brightness(${brightness}%) `;
    }

    if (contrast !== 100) {
      filterValue += `contrast(${contrast}%) `;
    }

    if (grayscale > 0) {
      filterValue += `grayscale(${grayscale}%) `;
    }

    if (hueRotate !== 0) {
      filterValue += `hue-rotate(${hueRotate}deg) `;
    }

    if (invert > 0) {
      filterValue += `invert(${invert}%) `;
    }

    if (saturate !== 100) {
      filterValue += `saturate(${saturate}%) `;
    }

    if (sepia > 0) {
      filterValue += `sepia(${sepia}%) `;
    }

    // Trim trailing space and apply the filter
    filterValue = filterValue.trim();
    updateStyleForSelectedNodes({ filter: filterValue });
  };

  // Update filters when any property changes
  useEffect(() => {
    applyFilters();
  }, [
    blur,
    brightness,
    contrast,
    grayscale,
    hueRotate,
    invert,
    saturate,
    sepia,
  ]);

  // Handle showing color picker
  const handleShowColorPicker = () => {
    setIsTransitioning(true);
    setShowColorPicker(true);
  };

  // Handle back button click
  const handleBackClick = (e) => {
    e.stopPropagation();
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

  // Reset filter
  const resetFilters = () => {
    setBlur(0);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setHueRotate(0);
    setInvert(0);
    setSaturate(100);
    setSepia(0);
  };

  return (
    <div
      className="relative overflow-hidden"
      data-is-expandable={showColorPicker ? "true" : "false"}
      style={{
        minHeight: showColorPicker ? "0" : "auto",
        height: showColorPicker ? "270px" : "340px", // Taller to fit all the filter controls
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
        {/* Main filter settings panel */}
        <div className="w-1/2 space-y-4 p-1 flex-shrink-0">
          <ToolInput
            type="number"
            label="Blur"
            name="filterBlur"
            min={0}
            max={50}
            customValue={blur}
            onCustomChange={(value) => setBlur(parseInt(value.toString(), 10))}
            unit="px"
            showSlider
            sliderMin={0}
            sliderMax={50}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Brightness"
            name="filterBrightness"
            min={0}
            max={200}
            customValue={brightness}
            onCustomChange={(value) =>
              setBrightness(parseInt(value.toString(), 10))
            }
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={200}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Contrast"
            name="filterContrast"
            min={0}
            max={200}
            customValue={contrast}
            onCustomChange={(value) =>
              setContrast(parseInt(value.toString(), 10))
            }
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={200}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Grayscale"
            name="filterGrayscale"
            min={0}
            max={100}
            customValue={grayscale}
            onCustomChange={(value) =>
              setGrayscale(parseInt(value.toString(), 10))
            }
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={100}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Hue Rotate"
            name="filterHueRotate"
            min={0}
            max={360}
            customValue={hueRotate}
            onCustomChange={(value) =>
              setHueRotate(parseInt(value.toString(), 10))
            }
            unit="deg"
            showSlider
            sliderMin={0}
            sliderMax={360}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Invert"
            name="filterInvert"
            min={0}
            max={100}
            customValue={invert}
            onCustomChange={(value) =>
              setInvert(parseInt(value.toString(), 10))
            }
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={100}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Saturate"
            name="filterSaturate"
            min={0}
            max={200}
            customValue={saturate}
            onCustomChange={(value) =>
              setSaturate(parseInt(value.toString(), 10))
            }
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={200}
            sliderStep={1}
          />

          <ToolInput
            type="number"
            label="Sepia"
            name="filterSepia"
            min={0}
            max={100}
            customValue={sepia}
            onCustomChange={(value) => setSepia(parseInt(value.toString(), 10))}
            unit="%"
            showSlider
            sliderMin={0}
            sliderMax={100}
            sliderStep={1}
          />
        </div>

        {/* Color picker panel - for future use */}
        <div
          className="w-1/2 p-1 flex-shrink-0"
          onClick={handleColorPickerClick}
          data-is-color-picker={showColorPicker ? "true" : "false"}
        >
          <div className="flex items-center py-2">
            <button
              onClick={handleBackClick}
              className="flex items-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Filter Settings
            </button>
          </div>

          <div className="p-1">
            <ColorPicker
              displayMode="direct"
              value={"#000000"}
              onChange={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterToolPopup;
