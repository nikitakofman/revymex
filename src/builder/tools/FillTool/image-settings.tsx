import React, { useState, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { ToolSelect } from "../_components/ToolSelect";
import { Label } from "../_components/ToolbarAtoms";

export const ImageSettingsControl = ({ selectedNode }) => {
  const { setNodeStyle, dragState } = useBuilder();
  const [imageProps, setImageProps] = useState({
    objectFit: "cover",
    objectPosition: "center",
    resolution: "Small",
    type: "Fill",
    position: "Top Center",
    altText: "",
  });

  // Initialize image properties from the selected node
  useEffect(() => {
    if (selectedNode) {
      setImageProps({
        objectFit: selectedNode.style?.objectFit || "cover",
        objectPosition: selectedNode.style?.objectPosition || "center",
        resolution: selectedNode.style?.resolution || "Small",
        type: selectedNode.style?.fillType || "Fill",
        position: selectedNode.style?.position || "Top Center",
        altText: selectedNode.style?.alt || selectedNode.style?.altText || "",
      });
    }
  }, [selectedNode]);

  // Handle changes to the image properties
  const handleChange = (property, value) => {
    setNodeStyle({ [property]: value }, dragState.selectedIds);
    setImageProps((prev) => ({ ...prev, [property]: value }));
  };

  const handleAltTextChange = (e) => {
    const value = e.target.value;
    setNodeStyle({ alt: value, altText: value }, dragState.selectedIds);
    setImageProps((prev) => ({ ...prev, altText: value }));
  };

  return (
    <div className="space-y-4">
      {/* Resolution Dropdown */}
      <div className="flex items-center justify-between gap-2">
        <Label>Fit</Label>
        <ToolSelect
          name="objectFit"
          value={imageProps.type}
          onChange={(value) => handleChange("objectFit", value)}
          options={[
            { label: "Cover", value: "cover" },
            { label: "Contain", value: "contain" },
            { label: "Fill", value: "fill" },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label>Resolution</Label>
        <ToolSelect
          name="resolution"
          value={imageProps.resolution}
          onChange={(value) => handleChange("resolution", value)}
          options={[
            { label: "Small", value: "Small" },
            { label: "Medium", value: "Medium" },
            { label: "Large", value: "Large" },
            { label: "Original", value: "Original" },
          ]}
        />
      </div>

      {/* Type Dropdown */}

      {/* Position Dropdown */}
      {/* <div className="flex items-center justify-between gap-2">
        <Label>Position</Label>
        <ToolSelect
          name="objectPosition"
          value={imageProps.objectPosition}
          onChange={(value) => handleChange("objectPosition", value)}
          options={[
            { label: "Top Left", value: "top left" },
            { label: "Top Center", value: "top center" },
            { label: "Top Right", value: "top right" },
            { label: "Center Left", value: "center left" },
            { label: "Center", value: "center" },
            { label: "Center Right", value: "center right" },
            { label: "Bottom Left", value: "bottom left" },
            { label: "Bottom Center", value: "bottom center" },
            { label: "Bottom Right", value: "bottom right" },
          ]}
        />
      </div> */}

      {/* Alt Text Input */}
      <div className="flex items-center justify-between gap-2">
        <Label>Alt Text</Label>
        <input
          type="text"
          value={imageProps.altText}
          onChange={handleAltTextChange}
          placeholder="Describe Image..."
          className="w-[117px] h-7 px-2 text-xs bg-[var(--grid-line)] border border-[var(--control-border)] hover:border-[var(--control-border-hover)] focus:border-[var(--border-focus)] text-[var(--text-primary)] rounded-[var(--radius-lg)] focus:outline-none transition-colors"
        />
      </div>
    </div>
  );
};
