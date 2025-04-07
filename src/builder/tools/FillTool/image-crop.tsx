import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useBuilder } from "@/builder/context/builderState";
import { Label } from "../_components/ToolbarAtoms";
import { RotateCcw, Check, Bug, X, AlertCircle } from "lucide-react";
import { canvasPreview, generateCroppedImageUrl } from "./canvas-preview";

// Enhanced getImageSource function to better handle frame backgrounds and blob URLs
function getImageSource(node) {
  if (!node || !node.style) {
    console.warn("Invalid node or missing style properties");
    return null;
  }

  // CASE 1: Handle image elements with src
  if (node.type === "image" && node.style.src) {
    return node.style.src;
  }

  // CASE 2: Handle backgroundImage property directly
  if (node.style.backgroundImage) {
    // Handle blob URLs directly (they don't always follow the url() pattern)
    if (node.style.backgroundImage.startsWith("blob:")) {
      return node.style.backgroundImage;
    }

    // Handle normal CSS background-image format with url()
    // Try multiple regex patterns to cover different quote styles and formats
    const patterns = [
      /url\(['"]?(.*?)['"]?\)/i, // Standard url() format with optional quotes
      /url\((.*?)\)/i, // url() format without quotes
      /"?url\((.*?)\)"?/i, // Sometimes quotes might be outside
      /(blob:[^"'\s)]+)/i, // Direct blob URL without url()
      /(https?:\/\/[^"'\s)]+)/i, // Direct http/https URL
    ];

    for (const pattern of patterns) {
      const match = node.style.backgroundImage.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  // CASE 3: For frames, also check the background property
  if (node.type === "frame" && node.style.background) {
    // Check if background contains a URL
    if (node.style.background.includes("url(")) {
      const urlMatch = node.style.background.match(/url\(['"]?(.*?)['"]?\)/i);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }
    }

    // Direct blob URL in background property
    const blobMatch = node.style.background.match(/(blob:[^"'\s)]+)/i);
    if (blobMatch && blobMatch[1]) {
      return blobMatch[1];
    }
  }

  // Try to get image from DOM element (fallback method)
  if (node.id) {
    try {
      const element = document.querySelector(`[data-node-id="${node.id}"]`);
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        if (
          computedStyle.backgroundImage &&
          computedStyle.backgroundImage !== "none"
        ) {
          const urlMatch = computedStyle.backgroundImage.match(
            /url\(['"]?(.*?)['"]?\)/i
          );
          if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
          }
        }
      }
    } catch (error) {
      console.warn("Error getting image from DOM:", error);
    }
  }

  return null;
}

// Debug helper to visualize node image issues
function debugNodeImageSource(node) {
  const debugContainer = document.createElement("div");
  debugContainer.style.position = "fixed";
  debugContainer.style.top = "20px";
  debugContainer.style.left = "20px";
  debugContainer.style.backgroundColor = "white";
  debugContainer.style.padding = "20px";
  debugContainer.style.border = "2px solid red";
  debugContainer.style.zIndex = "9999";
  debugContainer.style.maxWidth = "80vw";
  debugContainer.style.maxHeight = "80vh";
  debugContainer.style.overflow = "auto";
  debugContainer.style.fontFamily = "monospace";
  debugContainer.style.fontSize = "12px";

  const title = document.createElement("h3");
  title.textContent = `Image Source Debug for Node ID: ${node.id}`;
  debugContainer.appendChild(title);

  const typeInfo = document.createElement("div");
  typeInfo.textContent = `Node Type: ${node.type}`;
  debugContainer.appendChild(typeInfo);

  const styleKeys = Object.keys(node.style || {});

  const styleSummary = document.createElement("div");
  styleSummary.textContent = `Style Properties: ${styleKeys.join(", ")}`;
  debugContainer.appendChild(styleSummary);

  // Show image-related properties in detail
  const imageProps = [
    "backgroundImage",
    "background",
    "src",
    "style",
    "backgroundUrl",
  ];

  const detailsContainer = document.createElement("div");
  detailsContainer.style.marginTop = "10px";
  detailsContainer.style.border = "1px solid #ccc";
  detailsContainer.style.padding = "10px";

  imageProps.forEach((prop) => {
    if (node.style && node.style[prop]) {
      const propElem = document.createElement("div");
      propElem.style.marginBottom = "5px";
      propElem.innerHTML = `<strong>${prop}:</strong> ${node.style[prop]}`;
      detailsContainer.appendChild(propElem);
    }
  });

  debugContainer.appendChild(detailsContainer);

  // DOM element info if available
  if (node.id) {
    const domInfo = document.createElement("div");
    domInfo.style.marginTop = "10px";
    domInfo.innerHTML = "<strong>DOM Element Check:</strong>";
    debugContainer.appendChild(domInfo);

    const element = document.querySelector(`[data-node-id="${node.id}"]`);
    if (element) {
      const computed = window.getComputedStyle(element);
      domInfo.innerHTML += `<div>Element found. Computed background-image: ${computed.backgroundImage}</div>`;

      // Add the result of our getImageSource function
      const result = getImageSource(node);
      domInfo.innerHTML += `<div>getImageSource result: ${
        result || "null"
      }</div>`;

      // Show the element preview
      if (computed.backgroundImage && computed.backgroundImage !== "none") {
        const previewContainer = document.createElement("div");
        previewContainer.style.marginTop = "10px";
        previewContainer.innerHTML = "<strong>Element Preview:</strong>";

        const preview = document.createElement("div");
        preview.style.width = "200px";
        preview.style.height = "200px";
        preview.style.border = "1px dashed #ccc";
        preview.style.backgroundImage = computed.backgroundImage;
        preview.style.backgroundSize = "cover";
        preview.style.backgroundPosition = "center";
        preview.style.marginTop = "5px";

        previewContainer.appendChild(preview);
        debugContainer.appendChild(previewContainer);
      }
    } else {
      domInfo.innerHTML += `<div>Element not found in DOM</div>`;
    }
  }

  // Close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.marginTop = "10px";
  closeButton.style.padding = "5px 10px";
  closeButton.onclick = () => document.body.removeChild(debugContainer);
  debugContainer.appendChild(closeButton);

  document.body.appendChild(debugContainer);
}

export const ImageCropPopup = ({ selectedNode, onClose }) => {
  const { setNodeStyle, dragState } = useBuilder();
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [aspect, setAspect] = useState(undefined); // undefined for free-form
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  const imageSource = getImageSource(selectedNode);

  // Handle crop complete event
  const onCropComplete = (crop) => {
    setCompletedCrop(crop);
  };

  // Handle the image load event to center the initial crop
  const onImageLoad = useCallback(
    (img) => {
      // Clear any previous error messages
      setErrorMessage(null);

      // Set crossOrigin attribute to handle CORS issues
      img.crossOrigin = "anonymous";

      imgRef.current = img;

      try {
        // Ensure the image has dimensions
        if (!img.width || !img.height) {
          console.warn("Image has zero width or height");
          return;
        }

        // Make a centered crop when the image loads
        const { width, height } = img;

        if (aspect) {
          // Initial centered crop
          const newCrop = centerCrop(
            makeAspectCrop(
              {
                unit: "%",
                width: 50,
              },
              aspect,
              width,
              height
            ),
            width,
            height
          );
          setCrop(newCrop);
        } else {
          // For free-form, start with 50% centered crop
          const newCrop = centerCrop(
            {
              unit: "%",
              width: 50,
              height: 50,
              x: 25,
              y: 25,
            },
            width,
            height
          );
          setCrop(newCrop);
        }
      } catch (error) {
        console.error("Error setting initial crop:", error);
        setErrorMessage("Error setting up crop tool. Try reloading the page.");
      }
    },
    [aspect]
  );

  // Update preview canvas when crop changes
  useEffect(() => {
    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      // Generate preview using the canvasPreview utility
      canvasPreview(
        imgRef.current,
        previewCanvasRef.current,
        completedCrop,
        scale,
        rotate
      );
    }
  }, [completedCrop, scale, rotate]);

  // Apply the crop to the node using official approach
  const applyCrop = async () => {
    if (!imgRef.current || !completedCrop) {
      setErrorMessage("Cannot apply crop: missing image or crop data");
      return;
    }

    try {
      // Generate cropped image URL using the utility function
      const croppedImageUrl = await generateCroppedImageUrl(
        imgRef.current,
        completedCrop,
        scale,
        rotate
      );

      if (!croppedImageUrl) {
        setErrorMessage("Failed to generate cropped image");
        return;
      }

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
        // For elements with background image (including frames)
        setNodeStyle(
          {
            backgroundImage: `url("${croppedImageUrl}")`,
            // Reset any previous cropping styles
            backgroundPosition: "center",
            backgroundSize: "cover",
          },
          dragState.selectedIds
        );
      }

      // Close the popup after successfully applying the crop
      onClose();
    } catch (error) {
      console.error("Error applying crop:", error);
      setErrorMessage(`Error applying crop: ${error.message}`);
    }
  };

  // Reset crop
  const resetCrop = () => {
    setCrop(undefined);
    setCompletedCrop(null);
    setErrorMessage(null);
    setScale(1);
    setRotate(0);

    // Re-trigger the image load handler to center the initial crop
    if (imgRef.current) {
      onImageLoad(imgRef.current);
    }
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
            width: 50,
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
    <div className="w-full max-h-[80vh] overflow-y-auto">
      {/* Aspect ratio controls */}
      <div className="mb-4 space-y-2">
        <Label className="mb-2 block">Aspect Ratio</Label>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAspect(1)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              aspect === 1
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            1:1
          </button>
          <button
            onClick={() => toggleAspect(16 / 9)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              aspect === 16 / 9
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            16:9
          </button>
          <button
            onClick={() => toggleAspect(4 / 3)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              aspect === 4 / 3
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            4:3
          </button>
          <button
            onClick={() => toggleAspect()}
            className={`px-3 py-1 text-xs rounded flex-1 ${
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
      <div className="bg-[var(--bg-elevated)] rounded-md overflow-hidden border border-[var(--border-default)] mb-4">
        {errorMessage ? (
          <div className="h-44 flex items-center justify-center text-sm text-red-500">
            {errorMessage}
          </div>
        ) : imageSource ? (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={onCropComplete}
            aspect={aspect}
            className="w-full"
            ruleOfThirds
          >
            <img
              ref={imgRef}
              src={imageSource}
              alt="Crop"
              crossOrigin="anonymous"
              onLoad={(e) => onImageLoad(e.currentTarget)}
              style={{
                maxWidth: "100%",
                maxHeight: "300px",
                transform: `scale(${scale}) rotate(${rotate}deg)`,
              }}
              onError={() =>
                setErrorMessage(
                  "Error loading image. It may be from a restricted source."
                )
              }
            />
          </ReactCrop>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-sm text-[var(--text-secondary)]">
            <AlertCircle className="mb-2" size={24} />
            <p>No image source found</p>
            <button
              onClick={() => debugNodeImageSource(selectedNode)}
              className="mt-2 px-2 py-1 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] rounded-md"
            >
              Debug Image Source
            </button>
          </div>
        )}
      </div>

      {/* Hidden preview canvas used for generating the crop */}
      <canvas
        ref={previewCanvasRef}
        style={{
          display: "none",
          width: completedCrop?.width ?? 0,
          height: completedCrop?.height ?? 0,
        }}
      />

      {/* Action buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <button
            onClick={applyCrop}
            disabled={!completedCrop || errorMessage}
            className={`px-3 py-1 text-xs ${
              completedCrop && !errorMessage
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                : "bg-[var(--bg-disabled)] text-[var(--text-disabled)]"
            } rounded-md transition-colors flex items-center gap-1`}
          >
            <Check size={14} />
            Apply Crop
          </button>

          <button
            onClick={() => debugNodeImageSource(selectedNode)}
            className="px-2 py-1 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] rounded-md transition-colors flex items-center gap-1"
            title="Debug Image Source"
          >
            <Bug size={14} />
          </button>
        </div>

        <button
          onClick={resetCrop}
          className="px-3 py-1 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] rounded-md transition-colors flex items-center gap-1"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Error message display */}
      {errorMessage && (
        <div className="mt-2 text-xs text-red-500">{errorMessage}</div>
      )}
    </div>
  );
};
