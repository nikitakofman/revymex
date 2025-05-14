import React, { useState, useEffect, useMemo } from "react";
import { Play, Settings } from "lucide-react";
import Button from "@/components/ui/button";
import LineSeparator from "@/components/ui/line-separator";
import RevymeIcon from "./revyme-icon";
import { Tooltip } from "react-tooltip";
import { ToolbarSlider } from "@/builder/tools/_components/ToolbarSlider";
import {
  useIsPreviewOpen,
  usePreviewWidth,
  interfaceOps,
} from "@/builder/context/atoms/interface-store";
import { ChevronDown } from "lucide-react";
import { canvasOps } from "@/builder/context/atoms/canvas-interaction-store";
import { getCurrentNodes } from "@/builder/context/atoms/node-store";

interface SimplifiedToolSelectProps {
  value: string;
  options: { label: string; value: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  className?: string;
}

export const SimplifiedToolSelect: React.FC<SimplifiedToolSelectProps> = ({
  value,
  options,
  onChange,
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 pl-2 pr-6 text-xs appearance-none bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={option.disabled ? "opacity-50" : ""}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)] pointer-events-none" />
    </div>
  );
};

const Header = () => {
  // Get interface state from the interface store
  const isPreviewOpen = useIsPreviewOpen();
  const previewWidth = usePreviewWidth();

  const [inputValue, setInputValue] = useState(
    previewWidth?.toString() || "1440"
  );
  const [maxWidth, setMaxWidth] = useState(2560);
  const [selectedViewport, setSelectedViewport] = useState("custom");

  const viewportOptions = useMemo(() => {
    // Get all nodes directly from the store
    const allNodes = getCurrentNodes();

    // Get all viewports
    const viewports = allNodes
      .filter((node) => node.isViewport)
      .sort((a, b) => (b.viewportWidth || 0) - (a.viewportWidth || 0))
      .map((viewport) => ({
        label: viewport.viewportName || `${viewport.viewportWidth}px`,
        value: viewport.viewportWidth?.toString() || "",
      }));

    // Add custom option
    return [...viewports, { label: "Custom", value: "custom" }];
  }, []); // Empty dependency array since we'll get fresh data on each render

  // Get max width from screen on mount and when window resizes
  useEffect(() => {
    const updateMaxWidth = () => {
      setMaxWidth(window.innerWidth);
    };

    // Set initial max width
    updateMaxWidth();

    // Update max width when window resizes
    window.addEventListener("resize", updateMaxWidth);

    return () => {
      window.removeEventListener("resize", updateMaxWidth);
    };
  }, []);

  // Update local state when previewWidth changes
  useEffect(() => {
    if (previewWidth) {
      setInputValue(previewWidth.toString());

      // Check if the new width matches any viewport width
      const matchingViewport = viewportOptions.find(
        (option) => option.value === previewWidth.toString()
      );

      setSelectedViewport(matchingViewport ? matchingViewport.value : "custom");
    }
  }, [previewWidth, viewportOptions]);

  // Handler for width input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setSelectedViewport("custom");
  };

  // Handler for input blur (apply changes)
  const handleInputBlur = () => {
    canvasOps.setIsEditingText(false);
    const newWidth = Number(inputValue);
    if (!isNaN(newWidth) && newWidth >= 1 && newWidth <= maxWidth) {
      interfaceOps.setPreviewWidth(newWidth);
    } else {
      // Reset to valid value if input is invalid
      setInputValue(previewWidth?.toString() || "1440");
    }
  };

  // Handler for Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.currentTarget.blur(); // Trigger blur to apply changes
    }
  };

  // Handler for slider changes
  const handleSliderChange = (newWidth: number) => {
    setInputValue(newWidth.toString());
    interfaceOps.setPreviewWidth(newWidth);
    setSelectedViewport("custom");
  };

  // Handler for viewport select change
  const handleViewportChange = (viewportWidth: string) => {
    if (viewportWidth === "custom") {
      return; // Do nothing for custom option
    }

    const width = Number(viewportWidth);
    if (!isNaN(width)) {
      setInputValue(width.toString());
      interfaceOps.setPreviewWidth(width);
      setSelectedViewport(viewportWidth);
    }
  };

  return (
    <div className="h-[52px] header bg-[var(--bg-surface)] border-b border-[var(--border-light)] fixed w-full z-[9999] flex items-center justify-between px-3">
      <div className="flex items-center gap-4 px-2">
        <RevymeIcon />

        <LineSeparator orientation="vertical" height="26px" />

        <p className="text-sm font-bold">onedriverexpress</p>
      </div>

      {/* Preview width control in the middle */}
      {isPreviewOpen && (
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <div className="flex items-center">
            <span className="text-xs text-[var(--text-secondary)] mr-2">
              Width
            </span>
            <input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              onSelect={(e) => canvasOps.setIsEditingText(true)}
              min={1}
              max={maxWidth}
              className="w-[60px] h-7 px-2 text-xs 
                bg-[var(--grid-line)] border border-[var(--control-border)] 
                hover:border-[var(--control-border-hover)] 
                focus:border-[var(--border-focus)] 
                text-[var(--text-primary)] rounded-[var(--radius-lg)] 
                focus:outline-none transition-colors
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-[var(--text-secondary)] ml-1">
              px
            </span>
          </div>

          <div className=" ml-2">
            <ToolbarSlider
              value={Number(inputValue) || 1440}
              min={1}
              max={maxWidth}
              onChange={handleSliderChange}
              className="w-[50px]"
            />
          </div>

          <SimplifiedToolSelect
            value={selectedViewport}
            options={viewportOptions}
            onChange={handleViewportChange}
            className="ml-2"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          leftIcon={<Settings size={20} />}
          size="sm"
          variant="primary"
        ></Button>

        <Button
          leftIcon={<Play size={20} />}
          size="sm"
          variant="primary"
          className={isPreviewOpen ? "bg-[var(--accent)]" : ""}
          onClick={() => interfaceOps.togglePreview()}
          data-tooltip-id="header-tooltip"
          data-tooltip-content="Preview"
        ></Button>

        <Button
          size="sm"
          variant="secondary"
          data-tooltip-id="header-tooltip"
          data-tooltip-content="Export your project"
        >
          Export
        </Button>

        <Button
          size="sm"
          variant="primary"
          data-tooltip-id="header-tooltip"
          data-tooltip-content="Publish your project"
        >
          Publish
        </Button>
      </div>

      <Tooltip
        id="header-tooltip"
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

export default Header;
