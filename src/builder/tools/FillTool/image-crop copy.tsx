import React, { useState, useCallback, useRef, useEffect } from "react";
import Cropper from "react-easy-crop"; // For aspect ratio modes
import ReactCrop from "react-image-crop"; // For free-form mode
import "react-image-crop/dist/ReactCrop.css";
import { useBuilder } from "@/builder/context/builderState";
import { Label } from "../_components/ToolbarAtoms";
import { RotateCcw, Check, Bug, AlertCircle } from "lucide-react";
import { ToolbarSlider } from "../_components/ToolbarSlider";
import { canvasPreview } from "./canvas-preview"; // Import your canvas preview utility

// Enhanced getImageSource function to handle various image sources
function getImageSource(node) {
  if (!node || !node.style) {
    console.warn("Invalid node or missing style properties");
    return null;
  }

  // Handle image elements with src
  if (node.type === "image" && node.style.src) {
    return node.style.src;
  }

  // Handle backgroundImage property
  if (node.style.backgroundImage) {
    // Handle blob URLs directly
    if (node.style.backgroundImage.startsWith("blob:")) {
      return node.style.backgroundImage;
    }

    // Handle normal CSS background-image format with url()
    const patterns = [
      /url\(['"]?(.*?)['"]?\)/i,
      /url\((.*?)\)/i,
      /"?url\((.*?)\)"?/i,
      /(blob:[^"'\s)]+)/i,
      /(https?:\/\/[^"'\s)]+)/i,
    ];

    for (const pattern of patterns) {
      const match = node.style.backgroundImage.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  // For frames, also check the background property
  if (node.type === "frame" && node.style.background) {
    if (node.style.background.includes("url(")) {
      const urlMatch = node.style.background.match(/url\(['"]?(.*?)['"]?\)/i);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }
    }

    const blobMatch = node.style.background.match(/(blob:[^"'\s)]+)/i);
    if (blobMatch && blobMatch[1]) {
      return blobMatch[1];
    }
  }

  // Try to get image from DOM element
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

// Debug helper function
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

// Creates a cropped image from crop data - Easy Crop version
const createCroppedImageEasyCrop = async (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = () => {
        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Ensure crop dimensions are valid
        if (!pixelCrop.width || !pixelCrop.height) {
          reject(new Error("Invalid crop dimensions"));
          return;
        }

        // Set canvas dimensions to match the crop
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // Draw the cropped image
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            resolve(URL.createObjectURL(blob));
          },
          "image/jpeg",
          0.95
        );
      };

      image.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      image.src = imageSrc;
    } catch (error) {
      reject(error);
    }
  });
};

// Generate cropped image URL using ReactCrop's approach
const generateCroppedImageUrl = async (
  image,
  crop,
  scale = 1,
  rotation = 0
) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No canvas 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set the canvas size to the scaled crop
  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  // Draw the cropped image to the canvas
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width * scaleX,
    crop.height * scaleY
  );

  // Return a promise that resolves with the blob URL
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve(url);
      },
      "image/jpeg",
      0.95
    );
  });
};

export const ImageCropPopup = ({ selectedNode, onClose }) => {
  const { setNodeStyle, dragState } = useBuilder();
  // Easy Crop state
  const [easyCrop, setEasyCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  // ReactCrop state
  const [reactCrop, setReactCrop] = useState({
    unit: "%",
    width: 50,
    height: 50,
    x: 25,
    y: 25,
  });
  const [completedReactCrop, setCompletedReactCrop] = useState(null);
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const [errorMessage, setErrorMessage] = useState(null);
  const [aspect, setAspect] = useState(4 / 3); // Default aspect ratio
  const [mode, setMode] = useState("aspect"); // 'aspect' or 'free'

  const imageSource = getImageSource(selectedNode);
  const isVideo =
    selectedNode.type === "video" ||
    (imageSource && imageSource.match(/\.(mp4|webm|ogg)$/i));

  // Handle Easy Crop completion
  const onEasyCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handle React Crop completion
  const onReactCropComplete = (crop, pixelCrop) => {
    setCompletedReactCrop(pixelCrop);
  };

  // Update preview canvas for ReactCrop
  useEffect(() => {
    if (
      mode === "free" &&
      completedReactCrop &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      canvasPreview(
        imgRef.current,
        previewCanvasRef.current,
        completedReactCrop,
        1,
        0
      );
    }
  }, [completedReactCrop, mode]);

  const resetCrop = () => {
    setEasyCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setReactCrop({
      unit: "%",
      width: 50,
      height: 50,
      x: 25,
      y: 25,
    });
    setCompletedReactCrop(null);
    setErrorMessage(null);
  };

  const applyCrop = async () => {
    if (!imageSource) {
      setErrorMessage("Cannot apply crop: No image source found");
      return;
    }

    try {
      let croppedImageUrl;

      // Generate crop based on current mode
      if (mode === "aspect" && croppedAreaPixels) {
        croppedImageUrl = await createCroppedImageEasyCrop(
          imageSource,
          croppedAreaPixels
        );
      } else if (mode === "free" && completedReactCrop && imgRef.current) {
        croppedImageUrl = await generateCroppedImageUrl(
          imgRef.current,
          completedReactCrop
        );
      } else {
        setErrorMessage("No crop data available");
        return;
      }

      // Apply to the node based on its type
      if (selectedNode.type === "image") {
        setNodeStyle(
          {
            src: croppedImageUrl,
            objectPosition: "center",
            objectFit: "cover",
            transform: "none",
          },
          dragState.selectedIds
        );
      } else {
        setNodeStyle(
          {
            backgroundImage: `url("${croppedImageUrl}")`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          },
          dragState.selectedIds
        );
      }

      onClose();
    } catch (error) {
      console.error("Error applying crop:", error);
      setErrorMessage(`Error applying crop: ${error.message}`);
    }
  };

  // Handle aspect ratio changes
  const handleAspectChange = (newAspect) => {
    if (newAspect === null) {
      // Switch to free mode
      setMode("free");
    } else {
      // Switch to aspect mode with specific ratio
      setMode("aspect");
      setAspect(newAspect);
    }
  };

  // Handle image load for ReactCrop
  const onReactCropImageLoad = (e) => {
    imgRef.current = e.currentTarget;
  };

  return (
    <div className="w-full max-h-[80vh] overflow-y-auto p-2">
      {/* Aspect ratio controls */}
      <div className="mb-4 space-y-2">
        <Label className="mb-2 block">Aspect Ratio</Label>
        <div className="flex gap-2">
          <button
            onClick={() => handleAspectChange(1)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              mode === "aspect" && aspect === 1
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            1:1
          </button>
          <button
            onClick={() => handleAspectChange(16 / 9)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              mode === "aspect" && aspect === 16 / 9
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            16:9
          </button>
          <button
            onClick={() => handleAspectChange(4 / 3)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              mode === "aspect" && aspect === 4 / 3
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            4:3
          </button>
          <button
            onClick={() => handleAspectChange(null)}
            className={`px-3 py-1 text-xs rounded flex-1 ${
              mode === "free"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-hover)]"
            }`}
          >
            Free
          </button>
        </div>
      </div>

      {/* Crop container */}
      <div className="bg-[var(--bg-elevated)] rounded-md overflow-hidden border border-[var(--border-default)] mb-4">
        {errorMessage ? (
          <div className="h-44 flex items-center justify-center text-sm text-red-500">
            {errorMessage}
          </div>
        ) : imageSource ? (
          <div className="h-[300px] relative">
            {/* Show appropriate cropper based on mode */}
            {mode === "aspect" ? (
              <Cropper
                image={isVideo ? undefined : imageSource}
                video={isVideo ? imageSource : undefined}
                crop={easyCrop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setEasyCrop}
                onCropComplete={onEasyCropComplete}
                onZoomChange={setZoom}
                showGrid={true}
                objectFit="contain"
                restrictPosition={false}
                onError={(error) => {
                  console.error("Cropper error:", error);
                  setErrorMessage(`Error loading media: ${error.message}`);
                }}
              />
            ) : (
              <ReactCrop
                crop={reactCrop}
                onChange={(c) => setReactCrop(c)}
                onComplete={onReactCropComplete}
                ruleOfThirds
              >
                <img
                  ref={imgRef}
                  src={imageSource}
                  alt="Crop"
                  crossOrigin="anonymous"
                  onLoad={onReactCropImageLoad}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "300px",
                    transform: `scale(${zoom})`,
                  }}
                  onError={() =>
                    setErrorMessage(
                      "Error loading image. It may be from a restricted source."
                    )
                  }
                />
              </ReactCrop>
            )}
          </div>
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

      {/* Hidden preview canvas used for generating the crop (ReactCrop) */}
      <canvas
        ref={previewCanvasRef}
        style={{
          display: "none",
          width: completedReactCrop?.width ?? 0,
          height: completedReactCrop?.height ?? 0,
        }}
      />

      {/* Zoom control using ToolbarSlider - available in both modes */}
      {imageSource && (
        <div className="mb-4">
          <ToolbarSlider
            value={Math.round(zoom * 100)}
            min={100}
            max={300}
            onChange={(value) => setZoom(value / 100)}
            label="Zoom"
            unit="%"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <button
            onClick={applyCrop}
            disabled={
              (!croppedAreaPixels && !completedReactCrop) || errorMessage
            }
            className={`px-3 py-1 text-xs ${
              (croppedAreaPixels || completedReactCrop) && !errorMessage
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
