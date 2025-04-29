import React, { useState, useEffect, useRef } from "react";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import { ToolSelect } from "../_components/ToolSelect";
import { Label } from "../_components/ToolbarAtoms";
import { Crop, Maximize, MinusCircle } from "lucide-react";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { ImageCropPopup } from "./image-crop";
import ToolbarButton from "../_components/ToolbarButton";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";

export const ImageSettingsControl = ({ selectedNode }) => {
  const { setNodeStyle } = useBuilderDynamic();
  const [imageProps, setImageProps] = useState({
    objectFit: "cover",
    objectPosition: "center",
    resolution: "Small",
    type: "Fill",
    position: "Top Center",
    altText: "",
  });

  const currentSelectedIds = useGetSelectedIds();
  // State for popup handling
  const [isCropPopupOpen, setIsCropPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const cropButtonRef = useRef(null);

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
    const selectedIds = currentSelectedIds();
    setNodeStyle({ [property]: value }, selectedIds);
    setImageProps((prev) => ({ ...prev, [property]: value }));
  };

  const handleAltTextChange = (e) => {
    const selectedIds = currentSelectedIds();

    const value = e.target.value;
    setNodeStyle({ alt: value, altText: value }, selectedIds);
    setImageProps((prev) => ({ ...prev, altText: value }));
  };

  // Handle opening the crop popup
  const handleOpenCropPopup = (e) => {
    e.stopPropagation();

    if (cropButtonRef.current) {
      const rect = cropButtonRef.current.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setIsCropPopupOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Image Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Fit</Label>
          <ToolSelect
            name="objectFit"
            value={imageProps.objectFit}
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

        {/* Crop Button */}

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
        <div
          ref={cropButtonRef}
          className="flex items-center justify-between rounded-md transition-colors"
        >
          <ToolbarButton
            className="cursor-pointer w-full"
            onClick={handleOpenCropPopup}
          >
            Crop image
          </ToolbarButton>
        </div>
        <div
          ref={cropButtonRef}
          className="flex items-center justify-between rounded-md transition-colors"
        >
          <ToolbarButton
            className="cursor-pointer w-full"
            onClick={handleOpenCropPopup}
          >
            Remove background
          </ToolbarButton>
        </div>
      </div>

      {/* Popup for the crop tool */}
      <ToolbarPopup
        isOpen={isCropPopupOpen}
        onClose={() => setIsCropPopupOpen(false)}
        triggerPosition={popupPosition}
        title="Crop"
      >
        <ImageCropPopup
          selectedNode={selectedNode}
          onClose={() => setIsCropPopupOpen(false)}
        />
      </ToolbarPopup>
    </div>
  );
};
