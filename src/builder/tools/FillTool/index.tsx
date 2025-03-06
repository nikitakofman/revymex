import React, { useState, useRef, useEffect } from "react";
import { ToolbarSection } from "../_components/ToolbarAtoms";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Wand2 } from "lucide-react";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { FillToolPopup } from "./fill-popup";
import {
  extractUrlFromCssValue,
  getNodeImageSource,
  getNodeVideoSource,
  getNextImageSource,
} from "../utils";

export const FillTool = () => {
  const { nodeState, dragState } = useBuilder();
  const selectedNode = nodeState.nodes.find(
    (n) => n.id === dragState.selectedIds[0]
  );

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const previewRef = useRef(null);
  const [actualImageSrc, setActualImageSrc] = useState(null);

  // Force a re-render when node styles change
  const [forceUpdate, setForceUpdate] = useState(0);

  // Style computations
  const background = useComputedStyle({
    property: "background",
    parseValue: false,
    defaultValue: "#FFFFFF",
  });

  const backgroundColor = useComputedStyle({
    property: "backgroundColor",
    parseValue: false,
  });

  const backgroundImage = useComputedStyle({
    property: "backgroundImage",
    parseValue: false,
  });

  const backgroundVideo = useComputedStyle({
    property: "backgroundVideo",
    parseValue: false,
  });

  const src = useComputedStyle({
    property: "src",
    parseValue: false,
  });

  // Force re-render on style changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedNode) {
        setForceUpdate((prev) => prev + 1);
      }
    }, 100); // Check every 100ms for style changes

    return () => clearInterval(interval);
  }, [selectedNode]);

  // Directly query the DOM to get the actual image source
  useEffect(() => {
    if (selectedNode && dragState.selectedIds.length > 0) {
      const nodeId = dragState.selectedIds[0];
      const element = document.querySelector(`[data-node-id="${nodeId}"]`);

      if (element && selectedNode.type === "image") {
        const nextImageSrc = getNextImageSource(element);
        if (nextImageSrc) {
          setActualImageSrc(nextImageSrc);
        }
      } else {
        setActualImageSrc(null);
      }
    }
  }, [selectedNode, dragState.selectedIds, forceUpdate]);

  // Get direct node styles for more reliable tracking
  const getDirectNodeStyle = () => {
    if (!selectedNode) return {};

    return {
      background: selectedNode.style?.background,
      backgroundColor: selectedNode.style?.backgroundColor,
      backgroundImage: selectedNode.style?.backgroundImage,
      backgroundVideo: selectedNode.style?.backgroundVideo,
      src: selectedNode.style?.src,
    };
  };

  // Get direct node styles for reliable tracking
  const directStyles = getDirectNodeStyle();

  if (!selectedNode) return null;

  // Create a clean style object with only one background property
  const createCleanStyleObject = (property, value) => {
    // Only include one background-related property to avoid conflicts
    const styleObj = {};
    styleObj[property] = value;
    return styleObj;
  };

  // Determine the current fill type and preview to show
  const getFillTypeInfo = () => {
    // Direct style values from node (more reliable than computed)
    const nodeStyles = getDirectNodeStyle();

    // 1. First check for image nodes with directly queried src from DOM
    if (selectedNode.type === "image" && actualImageSrc) {
      return {
        type: "image",
        preview: (
          <div
            className="w-full h-full bg-cover bg-center"
            style={createCleanStyleObject(
              "backgroundImage",
              `url(${actualImageSrc})`
            )}
          />
        ),
        label: "Image",
      };
    }

    // 2. Check for node image source from style properties
    const nodeImageSrc = getNodeImageSource(selectedNode);
    if (nodeImageSrc) {
      return {
        type: "image",
        preview: (
          <div
            className="w-full h-full bg-cover bg-center"
            style={createCleanStyleObject(
              "backgroundImage",
              `url(${nodeImageSrc})`
            )}
          />
        ),
        label: selectedNode.type === "image" ? "Image" : "Image Background",
      };
    }

    // 3. Check for node video source
    const nodeVideoSrc = getNodeVideoSource(selectedNode);
    if (nodeVideoSrc) {
      return {
        type: "video",
        preview: (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <span className="text-xs text-white">Video</span>
          </div>
        ),
        label: selectedNode.type === "video" ? "Video" : "Video Background",
      };
    }

    // 4. Check for background image from direct node styles
    if (nodeStyles.backgroundImage && nodeStyles.backgroundImage !== "none") {
      const imageUrl = nodeStyles.backgroundImage.includes("url(")
        ? extractUrlFromCssValue(nodeStyles.backgroundImage)
        : nodeStyles.backgroundImage;

      if (imageUrl && imageUrl !== "none") {
        return {
          type: "image",
          preview: (
            <div
              className="w-full h-full bg-cover bg-center"
              style={createCleanStyleObject(
                "backgroundImage",
                `url(${imageUrl})`
              )}
            />
          ),
          label: "Image Background",
        };
      }
    }

    // 5. Check for background video from direct node styles
    if (nodeStyles.backgroundVideo && nodeStyles.backgroundVideo !== "none") {
      return {
        type: "video",
        preview: (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <span className="text-xs text-white">Video</span>
          </div>
        ),
        label: "Video Background",
      };
    }

    // 6. Check for gradients from direct node styles
    if (nodeStyles.background && typeof nodeStyles.background === "string") {
      if (nodeStyles.background.includes("linear-gradient")) {
        return {
          type: "linear",
          preview: (
            <div
              className="w-full h-full"
              style={createCleanStyleObject(
                "background",
                nodeStyles.background
              )}
            />
          ),
          label: "Linear Gradient",
        };
      }

      if (nodeStyles.background.includes("radial-gradient")) {
        return {
          type: "radial",
          preview: (
            <div
              className="w-full h-full"
              style={createCleanStyleObject(
                "background",
                nodeStyles.background
              )}
            />
          ),
          label: "Radial Gradient",
        };
      }
    }

    // 7. Check for background-color property from direct node styles
    if (
      nodeStyles.backgroundColor &&
      nodeStyles.backgroundColor !== "transparent"
    ) {
      return {
        type: "solid",
        preview: (
          <div
            className="w-full h-full"
            style={createCleanStyleObject(
              "backgroundColor",
              nodeStyles.backgroundColor
            )}
          />
        ),
        label: "Color",
      };
    }

    // 8. Check for background property (solid color) from direct node styles
    if (
      nodeStyles.background &&
      typeof nodeStyles.background === "string" &&
      !nodeStyles.background.includes("gradient")
    ) {
      return {
        type: "solid",
        preview: (
          <div
            className="w-full h-full"
            style={createCleanStyleObject("background", nodeStyles.background)}
          />
        ),
        label: "Color",
      };
    }

    // 9. Fallback to computed styles if direct styles don't work
    if (backgroundColor?.value && backgroundColor.value !== "transparent") {
      return {
        type: "solid",
        preview: (
          <div
            className="w-full h-full"
            style={createCleanStyleObject(
              "backgroundColor",
              backgroundColor.value
            )}
          />
        ),
        label: "Color",
      };
    }

    if (
      background?.value &&
      typeof background.value === "string" &&
      !background.value.includes("gradient")
    ) {
      return {
        type: "solid",
        preview: (
          <div
            className="w-full h-full"
            style={createCleanStyleObject("background", background.value)}
          />
        ),
        label: "Color",
      };
    }

    // Default to solid white
    return {
      type: "solid",
      preview: (
        <div
          className="w-full h-full"
          style={createCleanStyleObject("backgroundColor", "#FFFFFF")}
        />
      ),
      label: "Color",
    };
  };

  const { preview } = getFillTypeInfo();

  const handleOpenPopup = (e) => {
    // Stop propagation to prevent event bubbling
    e.stopPropagation();

    if (previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setIsPopupOpen(true);
    }
  };

  const sectionName = selectedNode.type === "image" ? "Image" : "Fill";

  return (
    <>
      <ToolbarSection title={sectionName}>
        <div
          ref={previewRef}
          className="relative   bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md cursor-pointer transition-colors group"
          onClick={handleOpenPopup}
        >
          <div className="w-full h-8 rounded-md overflow-hidden hover:bg-black/10 border border-[var(--border-default)]">
            {preview}
            <div className="absolute bg-black/30 inset-0 flex items-center justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          </div>
        </div>
      </ToolbarSection>

      <ToolbarPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        triggerPosition={popupPosition}
      >
        <FillToolPopup
          selectedNode={selectedNode}
          onClose={() => setIsPopupOpen(false)}
        />
      </ToolbarPopup>
    </>
  );
};
