import React, { useState, useRef, useEffect } from "react";
import { useBuilder, useBuilderDynamic } from "@/builder/context/builderState";
import { Crop, RotateCcw } from "lucide-react";
import { useGetSelectedIds } from "@/builder/context/atoms/select-store";

export const ImageCropInteractive = ({ selectedNode }) => {
  const { setNodeStyle } = useBuilderDynamic();
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cropBoxRef = useRef(null);
  const imagePreviewRef = useRef(null);

  const currentSelectedIds = useGetSelectedIds();
  // Crop values as percentages
  const [cropValues, setCropValues] = useState({
    cropTop: selectedNode?.style?.cropTop || 0,
    cropRight: selectedNode?.style?.cropRight || 0,
    cropBottom: selectedNode?.style?.cropBottom || 0,
    cropLeft: selectedNode?.style?.cropLeft || 0,
  });

  // Initialize crop properties from the selected node
  useEffect(() => {
    if (selectedNode) {
      setCropValues({
        cropTop: selectedNode.style?.cropTop || 0,
        cropRight: selectedNode.style?.cropRight || 0,
        cropBottom: selectedNode.style?.cropBottom || 0,
        cropLeft: selectedNode.style?.cropLeft || 0,
      });
    }
  }, [selectedNode]);

  // Get the image source to display in the crop preview
  const getImageSource = () => {
    if (!selectedNode) return null;

    // Check for different image sources
    if (selectedNode.type === "image" && selectedNode.style.src) {
      return selectedNode.style.src;
    } else if (selectedNode.style.backgroundImage) {
      const bgImage = selectedNode.style.backgroundImage;
      // Extract URL from background-image property
      const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
      return urlMatch ? urlMatch[1] : null;
    }

    return null;
  };

  const handleMouseDown = (e) => {
    if (!cropBoxRef.current) return;

    e.preventDefault();
    setIsDragging(true);

    // Get initial mouse position
    const cropBox = cropBoxRef.current.getBoundingClientRect();
    setStartPos({
      x: e.clientX - cropBox.left,
      y: e.clientY - cropBox.top,
    });

    // Add global mouse event handlers
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !cropBoxRef.current || !imagePreviewRef.current) return;

    // Get preview container dimensions
    const container = imagePreviewRef.current.getBoundingClientRect();
    const containerWidth = container.width;
    const containerHeight = container.height;

    // Calculate new position
    const newLeft = Math.max(
      0,
      Math.min(
        e.clientX - container.left - startPos.x,
        containerWidth - cropBoxRef.current.offsetWidth
      )
    );
    const newTop = Math.max(
      0,
      Math.min(
        e.clientY - container.top - startPos.y,
        containerHeight - cropBoxRef.current.offsetHeight
      )
    );

    // Convert to percentages
    const leftPercent = (newLeft / containerWidth) * 100;
    const topPercent = (newTop / containerHeight) * 100;
    const rightPercent =
      100 -
      leftPercent -
      (cropBoxRef.current.offsetWidth / containerWidth) * 100;
    const bottomPercent =
      100 -
      topPercent -
      (cropBoxRef.current.offsetHeight / containerHeight) * 100;

    // Update crop values
    const newCropValues = {
      cropTop: parseFloat(topPercent.toFixed(1)),
      cropRight: parseFloat(rightPercent.toFixed(1)),
      cropBottom: parseFloat(bottomPercent.toFixed(1)),
      cropLeft: parseFloat(leftPercent.toFixed(1)),
    };

    setCropValues(newCropValues);

    // Apply crop visually during drag
    cropBoxRef.current.style.left = `${leftPercent}%`;
    cropBoxRef.current.style.top = `${topPercent}%`;
    cropBoxRef.current.style.width = `${100 - leftPercent - rightPercent}%`;
    cropBoxRef.current.style.height = `${100 - topPercent - bottomPercent}%`;
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    // Apply the crop to the actual image
    applyCrop();
  };

  // Apply the crop using the improved approach that maintains image size
  const applyCrop = () => {
    // For image elements
    if (selectedNode.type === "image") {
      // Calculate the scale factor needed to maintain size
      const scaleX = 100 / (100 - cropValues.cropLeft - cropValues.cropRight);
      const scaleY = 100 / (100 - cropValues.cropTop - cropValues.cropBottom);
      const scale = Math.max(scaleX, scaleY);

      // Calculate position to center the visible portion
      const posX =
        50 + ((cropValues.cropLeft - cropValues.cropRight) / 2) * scale;
      const posY =
        50 + ((cropValues.cropTop - cropValues.cropBottom) / 2) * scale;

      const selectedIds = currentSelectedIds();

      setNodeStyle(
        {
          objectPosition: `${posX}% ${posY}%`,
          objectFit: "cover", // Ensure image fills the container
          transform: `scale(${scale})`,
          // Store crop values for persistence
          ...cropValues,
        },
        selectedIds
      );
    }
    // For elements with background image
    else if (
      selectedNode.style &&
      (selectedNode.style.backgroundImage || selectedNode.style.background)
    ) {
      // Calculate the scale factor needed
      const scaleX = 100 / (100 - cropValues.cropLeft - cropValues.cropRight);
      const scaleY = 100 / (100 - cropValues.cropTop - cropValues.cropBottom);
      const scale = Math.max(scaleX, scaleY);

      // Calculate position percentages
      const posX =
        50 + ((cropValues.cropLeft - cropValues.cropRight) / 2) * scale;
      const posY =
        50 + ((cropValues.cropTop - cropValues.cropBottom) / 2) * scale;

      const selectedIds = currentSelectedIds();
      setNodeStyle(
        {
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundSize: `${scale * 100}%`, // Scale the background image
          // Store crop values for persistence
          ...cropValues,
        },
        selectedIds
      );
    }
  };

  // Reset crop
  const resetCrop = () => {
    const resetValues = {
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0,
    };
    setCropValues(resetValues);
    const selectedIds = currentSelectedIds();

    if (selectedNode.type === "image") {
      setNodeStyle(
        {
          ...resetValues,
          objectPosition: "center",
          objectFit: "cover",
          transform: "scale(1)",
        },
        selectedIds
      );
    } else {
      setNodeStyle(
        {
          ...resetValues,
          backgroundPosition: "center",
          backgroundSize: "cover",
        },
        selectedIds
      );
    }
  };

  const imageSource = getImageSource();

  return (
    <div className="space-y-3">
      <div
        className="aspect-video relative bg-[var(--bg-elevated)] rounded-md overflow-hidden border border-[var(--border-default)]"
        ref={imagePreviewRef}
      >
        {/* Image Preview */}
        {imageSource && (
          <img
            src={imageSource}
            alt="Crop Preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Crop Overlay - Dark Area */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Interactive Crop Box */}
        <div
          ref={cropBoxRef}
          className={`absolute border-2 border-blue-500 bg-transparent cursor-move ${
            isDragging ? "opacity-70" : "opacity-100"
          }`}
          style={{
            top: `${cropValues.cropTop}%`,
            left: `${cropValues.cropLeft}%`,
            right: `${cropValues.cropRight}%`,
            bottom: `${cropValues.cropBottom}%`,
            boxShadow: "inset 0 0 0 2000px rgba(0, 0, 0, -0.5)",
          }}
          onMouseDown={handleMouseDown}
        />
      </div>

      {/* Crop Controls */}
      <div className="flex justify-between">
        <button
          onClick={applyCrop}
          className="px-3 py-1 text-xs bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] rounded-md transition-colors flex items-center gap-1"
        >
          <Crop size={14} />
          Apply Crop
        </button>

        <button
          onClick={resetCrop}
          className="px-3 py-1 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] rounded-md transition-colors flex items-center gap-1"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Crop Values Display */}
      <div className="text-xs text-[var(--text-secondary)]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>Top: {cropValues.cropTop}%</div>
          <div>Right: {cropValues.cropRight}%</div>
          <div>Bottom: {cropValues.cropBottom}%</div>
          <div>Left: {cropValues.cropLeft}%</div>
        </div>
      </div>
    </div>
  );
};
