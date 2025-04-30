import React, { useState, useRef, useEffect, useMemo } from "react";
import { ToolbarSection } from "../_components/ToolbarAtoms";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Wand2 } from "lucide-react";
import { ToolbarPopup } from "@/builder/view/toolbars/rightToolbar/toolbar-popup";
import { FillToolPopup } from "./fill-popup";
import { VideoSettingsControl } from "./video-settings";
import { ImageSettingsControl } from "./image-settings";
import {
  extractUrlFromCssValue,
  getNodeImageSource,
  getNodeVideoSource,
  getNextImageSource,
} from "../utils";
import { useSelectedIds } from "@/builder/context/atoms/select-store";
import {
  NodeId,
  useNodeStyle,
  useNodeBasics,
  useGetNode,
} from "@/builder/context/atoms/node-store";

export const FillTool = () => {
  // Replace nodeState with Jotai hooks
  const getNode = useGetNode();

  // Use subscription-based hook
  const selectedIds = useSelectedIds();

  // Memoize the selected node to prevent unnecessary calculations
  const selectedNode = useMemo(() => {
    if (selectedIds.length === 0) return null;
    return getNode(selectedIds[0]) || null;
  }, [selectedIds, getNode]);

  // Get node type and style using Jotai hooks when we have a selected node
  const nodeType = useMemo(() => {
    if (!selectedNode) return null;
    return selectedNode.type;
  }, [selectedNode]);

  // Get node style using Jotai hooks
  const nodeStyle = useMemo(() => {
    if (!selectedNode) return {};
    return selectedNode.style || {};
  }, [selectedNode]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const previewRef = useRef(null);
  const [actualImageSrc, setActualImageSrc] = useState(null);

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

  // Directly query the DOM to get the actual image source when the node changes
  useEffect(() => {
    if (selectedNode && nodeType === "image") {
      const element = document.querySelector(
        `[data-node-id="${selectedNode.id}"]`
      );
      if (element) {
        const nextImageSrc = getNextImageSource(element);
        if (nextImageSrc) {
          setActualImageSrc(nextImageSrc);
        }
      }
    } else {
      setActualImageSrc(null);
    }
  }, [
    selectedNode,
    nodeType,
    background,
    backgroundColor,
    backgroundImage,
    backgroundVideo,
    src,
  ]);

  // Get direct node styles for more reliable tracking
  const getDirectNodeStyle = () => {
    if (!selectedNode) return {};

    return {
      background: nodeStyle.background,
      backgroundColor: nodeStyle.backgroundColor,
      backgroundImage: nodeStyle.backgroundImage,
      backgroundVideo: nodeStyle.backgroundVideo,
      src: nodeStyle.src,
    };
  };

  if (!selectedNode) return null;

  // Get direct node styles for reliable tracking
  const directStyles = getDirectNodeStyle();

  // Check if the selected node is a video or has video background
  const isVideoNode = nodeType === "video";
  const hasVideoBackground = !!directStyles.backgroundVideo;
  const showVideoSettings = isVideoNode || hasVideoBackground;

  // Check if the selected node is an image or has image background
  const isImageNode = nodeType === "image";
  const hasImageBackground = !!directStyles.backgroundImage;
  const showImageSettings = isImageNode || hasImageBackground;

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
    if (nodeType === "image" && actualImageSrc) {
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
    } else if (nodeType === "video") {
      return {
        type: "video",
        preview: (
          <video
            src={nodeStyle.src}
            className="h-full w-full object-cover"
            autoPlay
            loop
          />
        ),
        label: "Video",
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
        label: nodeType === "image" ? "Image" : "Image Background",
      };
    }

    // 3. Check for node video source
    const nodeVideoSrc = getNodeVideoSource(selectedNode);
    if (nodeVideoSrc) {
      return {
        type: "video",
        preview: (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <video
              src={nodeStyles.backgroundVideo}
              className="h-full w-full object-cover"
              autoPlay
              loop
            />
          </div>
        ),
        label: nodeType === "video" ? "Video" : "Video Background",
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
            <video
              src={nodeStyles.backgroundVideo}
              className="h-full w-full object-cover"
              autoPlay
              loop
            />
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

  const { preview, type } = getFillTypeInfo();

  const handleOpenPopup = (e) => {
    // Stop propagation to prevent event bubbling
    e.stopPropagation();

    if (previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      setPopupPosition({ x: rect.right + 10, y: rect.top });
      setIsPopupOpen(true);
    }
  };

  const sectionName =
    nodeType === "image" ? "Image" : nodeType === "video" ? "Video" : "Fill";

  return (
    <>
      <ToolbarSection solo title={sectionName}>
        <div
          ref={previewRef}
          className="relative mb-1 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md cursor-pointer transition-colors group"
          onClick={handleOpenPopup}
        >
          <div className="w-full h-8 rounded-md overflow-hidden hover:bg-black/10 border border-[var(--border-default)]">
            {preview}
            <div className="absolute bg-black/30 inset-0 flex items-center justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          </div>
        </div>

        {/* Add image settings if the node is an image or has image background */}
        {showImageSettings && (
          <div className="mt-3">
            <ImageSettingsControl selectedNode={selectedNode} />
          </div>
        )}

        {/* Add video settings if the node is a video or has video background */}
        {showVideoSettings && (
          <div className="mt-2">
            <VideoSettingsControl selectedNode={selectedNode} />
          </div>
        )}
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

export default FillTool;
