import React, { useState, useRef, useCallback } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useBuilder } from "@/builder/context/builderState";
import { Label } from "../_components/ToolbarAtoms";
import { RotateCcw, Check } from "lucide-react";

// A helper function to get the image source from a node
function getImageSource(node) {
  if (node.type === "image" && node.style.src) {
    return node.style.src;
  } else if (node.style.backgroundImage) {
    const bgImage = node.style.backgroundImage;
    const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
    return urlMatch ? urlMatch[1] : null;
  }
  return null;
}

// Helper function to generate a cropped image as a base64 string
function getCroppedImg(image, crop) {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return canvas.toDataURL("image/jpeg");
}

export const ImageCropTool = ({ selectedNode }) => {
  const { setNodeStyle, dragState } = useBuilder();
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [aspect, setAspect] = useState(undefined); // undefined for free-form
  const imgRef = useRef(null);

  const imageSource = getImageSource(selectedNode);

  // Handle crop complete event
  const onCropComplete = (crop, pixelCrop) => {
    setCompletedCrop(pixelCrop);
  };

  // Handle the image load event to center the initial crop
  const onImageLoad = useCallback(
    (img) => {
      imgRef.current = img;

      // Make a centered crop when the image loads
      const { width, height } = img;
      const crop = centerCrop(
        makeAspectCrop(
          {
            unit: "%",
            width: 80,
          },
          aspect || 16 / 9,
          width,
          height
        ),
        width,
        height
      );

      setCrop(crop);
    },
    [aspect]
  );

  // Apply the crop to the node
  const applyCrop = () => {
    if (!imgRef.current || !completedCrop) return;

    // Generate a cropped image as base64
    const croppedImageUrl = getCroppedImg(imgRef.current, completedCrop);

    // Apply to the node based on its type
    if (selectedNode.type === "image") {
      // For image elements
      setNodeStyle(
        {
          src: croppedImageUrl,
          // Reset any previous cropping styles
          objectPosition: "center",
          objectFit: "cover",
          transform: "none",
        },
        dragState.selectedIds
      );
    } else {
      // For elements with background image
      setNodeStyle(
        {
          backgroundImage: `url('${croppedImageUrl}')`,
          // Reset any previous cropping styles
          backgroundPosition: "center",
          backgroundSize: "cover",
        },
        dragState.selectedIds
      );
    }
  };

  // Reset crop
  const resetCrop = () => {
    setCrop(undefined);
    setCompletedCrop(null);
  };

  // Toggle aspect ratio
  const toggleAspect = (newAspect) => {
    setAspect(aspect === newAspect ? undefined : newAspect);
    // Recenter crop with new aspect if image is loaded
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const crop = centerCrop(
        makeAspectCrop(
          {
            unit: "%",
            width: 80,
          },
          newAspect || 16 / 9,
          width,
          height
        ),
        width,
        height
      );
      setCrop(crop);
    }
  };

  return (
    <div className="space-y-4">
      {/* Aspect ratio controls */}
      <div className="flex flex-wrap gap-2 justify-between">
        <Label>Aspect Ratio</Label>
        <div className="flex gap-1">
          <button
            onClick={() => toggleAspect(1)}
            className={`px-2 py-1 text-xs rounded ${
              aspect === 1
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            1:1
          </button>
          <button
            onClick={() => toggleAspect(16 / 9)}
            className={`px-2 py-1 text-xs rounded ${
              aspect === 16 / 9
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            16:9
          </button>
          <button
            onClick={() => toggleAspect(4 / 3)}
            className={`px-2 py-1 text-xs rounded ${
              aspect === 4 / 3
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            4:3
          </button>
          <button
            onClick={() => toggleAspect()}
            className={`px-2 py-1 text-xs rounded ${
              aspect === undefined
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            Free
          </button>
        </div>
      </div>

      {/* Crop interface */}
      <div className="bg-[var(--bg-elevated)] rounded-md overflow-hidden border border-[var(--border-default)]">
        {imageSource ? (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={onCropComplete}
            aspect={aspect}
            className="w-full"
            ruleOfThirds
          >
            <img
              src={imageSource}
              alt="Crop"
              onLoad={(e) => onImageLoad(e.currentTarget)}
              style={{ maxWidth: "100%", maxHeight: "300px" }}
            />
          </ReactCrop>
        ) : (
          <div className="h-44 flex items-center justify-center text-sm text-[var(--text-secondary)]">
            No image source found
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between">
        <button
          onClick={applyCrop}
          disabled={!completedCrop}
          className={`px-3 py-1 text-xs ${
            completedCrop
              ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              : "bg-[var(--bg-disabled)] text-[var(--text-disabled)]"
          } rounded-md transition-colors flex items-center gap-1`}
        >
          <Check size={14} />
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
    </div>
  );
};
