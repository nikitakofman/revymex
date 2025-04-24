import React, { useState, useEffect } from "react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { ToolSelect } from "../_components/ToolSelect";
import { Label } from "../_components/ToolbarAtoms";
import { ToolbarSwitch } from "../_components/ToolbarSwitch";
import { ImageCropPopup } from "./image-crop";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";

export const VideoSettingsControl = ({ selectedNode }) => {
  const { setNodeStyle, dragState } = useBuilder();
  const [videoProps, setVideoProps] = useState({
    autoplay: false,
    loop: false,
    muted: true,
    controls: false,
    objectFit: "cover",
  });

  const currentSelectedIds = useGetSelectedIds();
  // Only use computed style for objectFit which is a CSS property
  const objectFit = useComputedStyle({
    property: "objectFit",
    parseValue: false,
    defaultValue: "cover",
  });

  // Initialize video properties from the selected node
  useEffect(() => {
    if (selectedNode) {
      setVideoProps({
        autoplay: !!selectedNode.style?.autoplay,
        loop: !!selectedNode.style?.loop,
        muted: selectedNode.style?.muted !== false, // Default to true if not specified
        controls: !!selectedNode.style?.controls,
        objectFit: selectedNode.style?.objectFit || objectFit.value || "cover",
      });
    }
  }, [selectedNode, objectFit.value]);

  // Handle toggle for boolean properties
  const handleToggle = (property, value) => {
    const selectedIds = currentSelectedIds();

    const boolValue = value === "true";
    setNodeStyle({ [property]: boolValue }, selectedIds);
    setVideoProps((prev) => ({ ...prev, [property]: boolValue }));
  };

  // Handle fit change
  const handleFitChange = (value) => {
    const selectedIds = currentSelectedIds();

    setNodeStyle({ objectFit: value }, selectedIds);
    setVideoProps((prev) => ({ ...prev, objectFit: value }));
  };

  return (
    <div className="space-y-4">
      {/* Playing/Autoplay Toggle */}
      {/* Fit Dropdown */}
      <div className="flex items-center justify-between gap-2">
        <Label>Fit</Label>
        <ToolSelect
          name="objectFit"
          value={videoProps.objectFit}
          onChange={handleFitChange}
          options={[
            { label: "Cover", value: "cover" },
            { label: "Contain", value: "contain" },
            { label: "Fill", value: "fill" },
          ]}
          label=""
        />
      </div>

      <ToolbarSwitch
        cssProperty="autoplay-custom"
        label="Playing"
        onValue="true"
        offValue="false"
        currentValue={videoProps.autoplay ? "true" : "false"}
        onChange={(value) => handleToggle("autoplay", value)}
      />

      {/* Loop Toggle */}
      <ToolbarSwitch
        cssProperty="loop-custom"
        label="Loop"
        onValue="true"
        offValue="false"
        currentValue={videoProps.loop ? "true" : "false"}
        onChange={(value) => handleToggle("loop", value)}
      />

      {/* Controls Toggle */}
      {selectedNode.type === "video" && (
        <ToolbarSwitch
          cssProperty="controls-custom"
          label="Controls"
          onValue="true"
          offValue="false"
          currentValue={videoProps.controls ? "true" : "false"}
          onChange={(value) => handleToggle("controls", value)}
        />
      )}
      {/* 
      <ImageCropPopup
        selectedNode={selectedNode}
        // onClose={() => setIsCropPopupOpen(false)}
      /> */}

      {/* Muted Toggle */}
      <ToolbarSwitch
        cssProperty="muted-custom"
        label="Muted"
        onValue="true"
        offValue="false"
        currentValue={videoProps.muted ? "true" : "false"}
        onChange={(value) => handleToggle("muted", value)}
      />
    </div>
  );
};
