import React, { useState, useEffect } from "react";
import { ImageIcon, Video, Eraser, Loader2 } from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { ToolSelect } from "../_components/ToolSelect";
import { ColorPicker } from "../_components/ColorPicker";
import { removeBackground } from "@imgly/background-removal";
import { preload } from "@imgly/background-removal";
import BackgroundRemovalNoSSR from "../BackgroundRemovalNoSSR";
import { ToolbarSegmentedControl } from "../_components/ToolbarSegmentedControl";
import { ImageSearchModal, VideoSearchModal } from "./media-search";
import { GradientEditor } from "./gradient-editor";
import Button from "@/components/ui/button";
import {
  extractUrlFromCssValue,
  getNodeImageSource,
  getNodeVideoSource,
} from "../utils";

// Types
export type FillType = "solid" | "linear" | "radial" | "image" | "video";

// Helper function to transform node types
export const transformNodeToFrame = (node, style, nodeDisp) => {
  const frameNode = {
    ...node,
    type: "frame",
    style: {
      ...node.style,
      ...style,
    },
  };
  nodeDisp.replaceNode(node.id, frameNode);
};

export const FillToolPopup = ({ selectedNode, onClose }) => {
  const { nodeDisp, dragState, setNodeStyle } = useBuilder();

  // Determine initial fill type based on node properties
  const [fillType, setFillType] = useState<FillType>(() => {
    if (selectedNode?.type === "image") return "image";
    if (selectedNode?.type === "video") return "video";
    // Determine fill type from style
    if (selectedNode?.style.backgroundImage) return "image";
    if (selectedNode?.style.backgroundVideo) return "video";
    if (selectedNode?.style.background?.includes("linear-gradient"))
      return "linear";
    if (selectedNode?.style.background?.includes("radial-gradient"))
      return "radial";
    return "solid";
  });

  const [removingBackground, setRemovingBackground] = useState(false);
  const [cleanImageSrc, setCleanImageSrc] = useState(null);

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

  const src = useComputedStyle({
    property: "src",
    parseValue: false,
  });

  const objectFit = useComputedStyle({
    property: "objectFit",
    parseValue: false,
    defaultValue: "cover",
  });

  const objectPosition = useComputedStyle({
    property: "objectPosition",
    parseValue: false,
    defaultValue: "center",
  });

  // Extract clean image source when selected node changes
  useEffect(() => {
    if (selectedNode) {
      const imageSrc = getNodeImageSource(selectedNode);
      setCleanImageSrc(imageSrc);
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  // Handle fill type change
  const handleFillTypeChange = (newType: FillType) => {
    // Only proceed if the type is actually changing
    if (newType === fillType) return;

    console.log("newType:", newType);

    if (newType === "solid") {
      setNodeStyle(
        {
          src: undefined,
          backgroundImage: undefined,
          backgroundVideo: undefined,
        },
        undefined,
        true
      );
    }

    if (newType === "image") {
      setNodeStyle(
        {
          backgroundVideo: undefined,
          backgroundColor: undefined,
        },
        undefined,
        true
      );
    }

    if (newType === "video") {
      setNodeStyle(
        {
          backgroundImage: undefined,
          backgroundColor: undefined,
        },
        undefined,
        true
      );
    }

    setFillType(newType);
  };

  // Render media controls for image and video
  const renderMediaControls = () => (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <ToolSelect
        name="objectFit"
        label="Fit"
        value={objectFit.value}
        onChange={(value) => setNodeStyle({ objectFit: value })}
        options={[
          { label: "Fill", value: "cover" },
          { label: "Fit", value: "contain" },
          { label: "Stretch", value: "fill" },
        ]}
      />
      <ToolSelect
        name="objectPosition"
        label="Position"
        value={objectPosition.value}
        onChange={(value) => setNodeStyle({ objectPosition: value })}
        options={[
          { label: "Center", value: "center" },
          { label: "Top", value: "top" },
          { label: "Bottom", value: "bottom" },
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
        ]}
      />
    </div>
  );

  // Render controls for image or video nodes
  if (
    (selectedNode.type === "image" || selectedNode.type === "video") &&
    !selectedNode.children?.length
  ) {
    return (
      <div className="space-y-4">
        {/* Display media search directly */}
        {selectedNode.type === "image" ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              {selectedNode.type === "image" && (
                <BackgroundRemovalNoSSR
                  imageUrl={cleanImageSrc || ""}
                  disabled={!cleanImageSrc}
                  onComplete={(newUrl) => {
                    setNodeStyle({ src: newUrl }, dragState.selectedIds);
                  }}
                />
              )}
            </div>
            <ImageSearchModal
              onSelectImage={(url) => {
                setNodeStyle({ src: url }, dragState.selectedIds);
                setCleanImageSrc(url);
              }}
              onClose={() => {}}
              embedded={true}
            />
          </div>
        ) : (
          <div>
            <VideoSearchModal
              onSelectVideo={(url) => {
                setNodeStyle({ src: url }, dragState.selectedIds);
              }}
              onClose={() => {}}
              embedded={true}
            />
          </div>
        )}

        {renderMediaControls()}

        {selectedNode.type === "video" && (
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.autoplay || false}
                onChange={(e) => {
                  setNodeStyle(
                    { autoplay: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Autoplay
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.loop || false}
                onChange={(e) => {
                  setNodeStyle(
                    { loop: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Loop
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.muted || true}
                onChange={(e) => {
                  setNodeStyle(
                    { muted: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Muted
            </label>
          </div>
        )}
      </div>
    );
  }

  // Render controls for frame or other node types
  return (
    <div className="space-y-3">
      <ToolbarSegmentedControl
        cssProperty="fill-type" // Custom property to track the fill type
        defaultValue={fillType}
        onChange={(value) => handleFillTypeChange(value as FillType)}
        options={[
          {
            label: "Color",
            icon: <div className="size-3 bg-pink-200" />,
            value: "solid",
          },
          {
            label: "Image",
            icon: <ImageIcon className="w-4 h-4" />,
            value: "image",
          },
          {
            label: "Video",
            icon: <Video className="w-4 h-4" />,
            value: "video",
          },
        ]}
        className="grid grid-cols-3 gap-1 p-1 bg-[var(--control-bg)] rounded-md"
        currentValue={fillType} // Pass current fillType to ensure active state
      />

      {fillType === "solid" && (
        <ColorPicker
          value={backgroundColor.value || background.value}
          onChange={(color) => {
            // We're just setting backgroundColor without clearing anything
            const styles = {
              backgroundColor: color,
            };

            if (selectedNode.type !== "frame") {
              transformNodeToFrame(selectedNode, styles, nodeDisp);
            } else {
              setNodeStyle(styles, dragState.selectedIds);
            }
          }}
          displayMode="direct" // Use direct mode to show the color picker immediately
          containerClassName="mt-2" // Add some margin to the top
        />
      )}

      {(fillType === "linear" || fillType === "radial") && (
        <GradientEditor
          fillType={fillType}
          selectedNode={selectedNode}
          nodeDisp={nodeDisp}
          dragState={dragState}
          setNodeStyle={setNodeStyle}
        />
      )}

      {fillType === "image" && (
        <>
          <div>
            <ImageSearchModal
              onSelectImage={(url) => {
                // Just set the backgroundImage without clearing anything
                const styles = {
                  backgroundImage: url,
                };

                if (selectedNode.type !== "frame") {
                  transformNodeToFrame(selectedNode, styles, nodeDisp);
                } else {
                  setNodeStyle(styles, dragState.selectedIds);
                }
                setCleanImageSrc(url);
              }}
              onClose={() => {}}
              embedded={true}
            />
          </div>

          {renderMediaControls()}
        </>
      )}

      {fillType === "video" && (
        <>
          <div>
            <VideoSearchModal
              onSelectVideo={(url) => {
                // Just set the backgroundVideo without clearing anything
                const styles = {
                  backgroundVideo: url,
                };

                if (selectedNode.type !== "frame") {
                  transformNodeToFrame(selectedNode, styles, nodeDisp);
                } else {
                  setNodeStyle(styles, dragState.selectedIds);
                }
              }}
              onClose={() => {}}
              embedded={true}
            />
          </div>

          {renderMediaControls()}

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.autoplay || false}
                onChange={(e) => {
                  setNodeStyle(
                    { autoplay: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Autoplay
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.loop || false}
                onChange={(e) => {
                  setNodeStyle(
                    { loop: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Loop
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedNode.style.muted || true}
                onChange={(e) => {
                  setNodeStyle(
                    { muted: e.target.checked },
                    dragState.selectedIds
                  );
                }}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              Muted
            </label>
          </div>
        </>
      )}
    </div>
  );
};
