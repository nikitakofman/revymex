import React, { useState, useRef, useEffect } from "react";
import { ToolbarSection } from "./_components/ToolbarAtoms";
import { ColorPicker } from "./_components/ColorPicker";
import {
  Plus,
  Trash2,
  ImageIcon,
  Video,
  Search,
  RefreshCw,
  Eraser,
  Loader2,
} from "lucide-react";
import { useBuilder } from "@/builder/context/builderState";
import { useComputedStyle } from "@/builder/context/hooks/useComputedStyle";
import { Node } from "@/builder/reducer/nodeDispatcher";
import { ToolSelect } from "./_components/ToolSelect";
import { removeBackground } from "@imgly/background-removal";
import { preload } from "@imgly/background-removal";
import BackgroundRemovalNoSSR from "./BackgroundRemovalNoSSR";
import { ToolbarSegmentedControl } from "./_components/ToolbarSegmentedControl";

type FillType = "solid" | "linear" | "radial" | "image" | "video";

interface GradientStop {
  color: string;
  position: number;
  id: string;
}

// Helper function to transform node types
const transformNodeToFrame = (node: Node, style: any, nodeDisp: any): void => {
  const frameNode: Node = {
    ...node,
    type: "frame",
    style: {
      ...node.style,
      ...style,
    },
  };
  nodeDisp.replaceNode(node.id, frameNode);
};

// Gradient Stop Component
const GradientStopButton = ({
  color,
  isSelected,
  position,
  onClick,
  onDrag,
}: {
  color: string;
  isSelected: boolean;
  position: number;
  onClick: () => void;
  onDrag: (position: number) => void;
}) => {
  const { startRecording, stopRecording } = useBuilder();
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    if (!buttonRef.current?.parentElement) return;
    const rect = buttonRef.current.parentElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onDrag(Math.round(x * 100));
  };

  useEffect(() => {
    const sessionId = startRecording();

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        updatePosition(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      stopRecording(sessionId);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onDrag, startRecording, stopRecording]);

  return (
    <div
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      className={`absolute -translate-x-1/2 cursor-move transition-shadow ${
        isSelected ? "z-10" : "z-0"
      }`}
      style={{ left: `${position}%`, top: "-4px" }}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 ${
          isSelected
            ? "border-[var(--accent)] shadow-md"
            : "border-white shadow-sm"
        }`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

// Image Search Modal
const ImageSearchModal = ({
  onSelectImage,
  onClose,
}: {
  onSelectImage: (url: string) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("minimal");
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async (searchQuery: string = "minimal") => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=20&page=1`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`,
          },
        }
      );
      const data = await response.json();
      setImages(data.results);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-sm">
      <div className="flex gap-2 mb-4">
        <input
          type="text" // Changed from ToolInput to native text input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search images..."
          className="flex-1 px-3 py-1.5 bg-[var(--bg-default)] border border-[var(--border-default)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <button
          className="px-3 py-1.5 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center transition-colors"
          onClick={() => fetchImages(query)}
        >
          <Search className="w-4 h-4 mr-1.5" />
          Search
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer aspect-square rounded-md overflow-hidden"
            onClick={() => {
              onSelectImage(image.urls.regular);
              onClose();
            }}
          >
            <img
              src={image.urls.small}
              alt={image.alt_description}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-default)]" />
        </div>
      )}
    </div>
  );
};

// Video Search Modal
const VideoSearchModal = ({
  onSelectVideo,
  onClose,
}: {
  onSelectVideo: (url: string) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("minimal");
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVideos = async (searchQuery: string = "minimal") => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${searchQuery}&per_page=20`
      );
      const data = await response.json();
      setVideos(data.hits);
    } catch (error) {
      console.error("Error fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-sm">
      <div className="flex gap-2 mb-4">
        <input
          type="text" // Changed from ToolInput to native text input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search videos..."
          className="flex-1 px-3 py-1.5 bg-[var(--bg-default)] border border-[var(--border-default)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <button
          className="px-3 py-1.5 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center transition-colors"
          onClick={() => fetchVideos(query)}
        >
          <Search className="w-4 h-4 mr-1.5" />
          Search
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        {videos.map((video) => (
          <div
            key={video.id}
            className="relative group cursor-pointer aspect-video rounded-md overflow-hidden"
            onClick={() => {
              onSelectVideo(video.videos.tiny.url);
              onClose();
            }}
          >
            <video
              src={video.videos.tiny.url}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              muted
              loop
              onMouseOver={(e) => e.currentTarget.play()}
              onMouseOut={(e) => e.currentTarget.pause()}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center mt-4">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-default)]" />
        </div>
      )}
    </div>
  );
};

export const FillTool = () => {
  const { nodeState, dragState, nodeDisp, setNodeStyle } = useBuilder();
  const selectedNode = nodeState.nodes.find(
    (n) => n.id === dragState.selectedIds[0]
  );

  const [fillType, setFillType] = useState<FillType>(() => {
    if (selectedNode?.type === "image") return "image";
    if (selectedNode?.type === "video") return "video";
    return "solid";
  });

  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [gradientStops, setGradientStops] = useState<GradientStop[]>([
    { color: "#FFFFFF", position: 0, id: "1" },
    { color: "#000000", position: 100, id: "2" },
  ]);
  const [selectedStopId, setSelectedStopId] = useState(gradientStops[0].id);

  // Style computations
  const background = useComputedStyle({
    property: "background",
    parseValue: false,
    defaultValue: "#FFFFFF",
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

  const handleRemoveBackground = async () => {
    let imageUrl =
      selectedNode?.style.src || selectedNode?.style.backgroundImage;
    if (!imageUrl) {
      alert("No image found");
      return;
    }

    // Remove 'url()' wrapper if it exists
    imageUrl = imageUrl.replace(/^url\(['"](.+)['"]\)$/, "$1");

    setRemovingBackground(true);

    const config = {
      debug: false,
      progress: (key: string, current: number, total: number) => {
        const [type, subtype] = key.split(":");
        const progress = Math.round((current / total) * 100);
        console.log(`${type} ${subtype} ${progress}%`);
      },
      rescale: true,
      device: "cpu",
      output: {
        quality: 0.8,
        format: "image/png",
      },
    };

    try {
      await preload(config);
      const processedBlob = await removeBackground(imageUrl, config);
      const processedImageUrl = URL.createObjectURL(processedBlob);

      if (selectedNode?.type === "image") {
        setNodeStyle({ src: processedImageUrl }, dragState.selectedIds);
      } else {
        setNodeStyle(
          {
            backgroundImage: `url('${processedImageUrl}')`,
            src: undefined,
          },
          dragState.selectedIds
        );
      }

      alert("Background removed");
    } catch (error) {
      console.error("Error removing background:", error);
      alert("Failed to remove background");
    } finally {
      setRemovingBackground(false);
    }
  };

  if (!selectedNode) return null;

  const handleFillTypeChange = (newType: FillType) => {
    setFillType(newType);
    if (newType === "image" || newType === "video") {
      setShowMediaSearch(true);
    }
  };

  const updateGradientBackground = (stops: GradientStop[]) => {
    const gradientStopsString = stops
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(", ");

    const gradientValue =
      fillType === "linear"
        ? `linear-gradient(90deg, ${gradientStopsString})`
        : `radial-gradient(circle at center, ${gradientStopsString})`;

    if (selectedNode.type !== "frame") {
      transformNodeToFrame(
        selectedNode,
        { background: gradientValue },
        nodeDisp
      );
    } else {
      setNodeStyle({ background: gradientValue }, dragState.selectedIds);
    }
  };

  const handleStopColorChange = (color: string) => {
    const newStops = gradientStops.map((stop) =>
      stop.id === selectedStopId ? { ...stop, color } : stop
    );
    setGradientStops(newStops);
    updateGradientBackground(newStops);
  };

  const renderMediaControls = () => (
    <div className="grid grid-cols-2 gap-3">
      <ToolSelect
        name="objectFit"
        label="Fit"
        value={objectFit.value as string}
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
        value={objectPosition.value as string}
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

  // Render different controls based on node type
  const renderControls = () => {
    if (selectedNode.type === "image" && !selectedNode.children?.length) {
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setShowMediaSearch(true)}
              className="flex-1 px-3 py-2 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center transition-colors"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Choose Image
            </button>
            <BackgroundRemovalNoSSR
              imageUrl={
                selectedNode?.style.src ||
                selectedNode?.style.backgroundImage ||
                ""
              }
              disabled={
                !selectedNode?.style.src && !selectedNode?.style.backgroundImage
              }
              onComplete={(newUrl) => {
                if (selectedNode?.type === "image") {
                  setNodeStyle({ src: newUrl }, dragState.selectedIds);
                } else {
                  setNodeStyle(
                    { backgroundImage: `url(${newUrl})` },
                    dragState.selectedIds
                  );
                }
              }}
            />
          </div>

          {showMediaSearch && (
            <ImageSearchModal
              onSelectImage={(url) => {
                setNodeStyle({ src: url }, dragState.selectedIds);
                setShowMediaSearch(false);
              }}
              onClose={() => setShowMediaSearch(false)}
            />
          )}

          {renderMediaControls()}
        </div>
      );
    }

    if (selectedNode.type === "video" && !selectedNode.children?.length) {
      return (
        <div className="space-y-4">
          <button
            onClick={() => setShowMediaSearch(true)}
            className="w-full px-3 py-2 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center transition-colors"
          >
            <Video className="w-4 h-4 mr-2" />
            Choose Video
          </button>

          {showMediaSearch && (
            <VideoSearchModal
              onSelectVideo={(url) => {
                setNodeStyle({ src: url }, dragState.selectedIds);
                setShowMediaSearch(false);
              }}
              onClose={() => setShowMediaSearch(false)}
            />
          )}

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
        </div>
      );
    }

    // Frame or element with children (showing all fill options)
    return (
      <div className="space-y-4">
        <ToolbarSegmentedControl
          value={fillType}
          onChange={(value) => handleFillTypeChange(value as FillType)}
          options={[
            {
              icon: (
                <div className="w-3 h-3 bg-[var(--text-primary)] rounded-sm" />
              ),
              value: "solid",
            },
            { label: "Linear", value: "linear" },
            { label: "Radial", value: "radial" },
            { icon: <ImageIcon className="w-4 h-4" />, value: "image" },
            { icon: <Video className="w-4 h-4" />, value: "video" },
          ]}
          className="grid grid-cols-5 gap-1 p-1 bg-[var(--control-bg)] rounded-md"
        />

        {fillType === "solid" && (
          <ColorPicker
            value={background.value as string}
            onChange={(color) => {
              if (selectedNode.type !== "frame") {
                transformNodeToFrame(
                  selectedNode,
                  { background: color },
                  nodeDisp
                );
              } else {
                setNodeStyle({ background: color }, dragState.selectedIds);
              }
            }}
          />
        )}

        {(fillType === "linear" || fillType === "radial") && (
          <div className="space-y-3">
            <div className="relative h-2 bg-[var(--control-bg)] rounded-full overflow-hidden">
              <div
                className="absolute inset-0 h-full"
                style={{
                  background: `linear-gradient(to right, ${gradientStops
                    .map((stop) => `${stop.color} ${stop.position}%`)
                    .join(", ")})`,
                }}
              />
              {gradientStops.map((stop) => (
                <GradientStopButton
                  key={stop.id}
                  color={stop.color}
                  position={stop.position}
                  isSelected={stop.id === selectedStopId}
                  onClick={() => setSelectedStopId(stop.id)}
                  onDrag={(position) => {
                    const newStops = gradientStops
                      .map((s) => (s.id === stop.id ? { ...s, position } : s))
                      .sort((a, b) => a.position - b.position);
                    setGradientStops(newStops);
                    updateGradientBackground(newStops);
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const newStop = {
                      color: "#808080",
                      position: 50,
                      id: Math.random().toString(36).substr(2, 9),
                    };
                    const newStops = [...gradientStops, newStop].sort(
                      (a, b) => a.position - b.position
                    );
                    setGradientStops(newStops);
                    setSelectedStopId(newStop.id);
                    updateGradientBackground(newStops);
                  }}
                  className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
                <button
                  onClick={() => {
                    if (gradientStops.length <= 2) return;
                    const newStops = gradientStops.filter(
                      (stop) => stop.id !== selectedStopId
                    );
                    setGradientStops(newStops);
                    setSelectedStopId(newStops[0].id);
                    updateGradientBackground(newStops);
                  }}
                  className="p-1.5 hover:bg-[var(--control-bg-hover)] rounded-md transition-colors disabled:opacity-50"
                  disabled={gradientStops.length <= 2}
                >
                  <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
              {selectedStopId && (
                <ColorPicker
                  value={
                    gradientStops.find((stop) => stop.id === selectedStopId)
                      ?.color || "#000000"
                  }
                  onChange={handleStopColorChange}
                />
              )}
            </div>
          </div>
        )}

        {fillType === "image" && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMediaSearch(true)}
                className="flex-1 px-3 py-2 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center transition-colors"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Choose Image
              </button>

              <button
                onClick={handleRemoveBackground}
                disabled={
                  removingBackground || !selectedNode?.style.backgroundImage
                }
                className={`flex-1 px-3 py-2 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center transition-colors ${
                  removingBackground || !selectedNode?.style.backgroundImage
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {removingBackground ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eraser className="w-4 h-4 mr-2" />
                )}
                Remove BG
              </button>
            </div>

            {showMediaSearch && (
              <ImageSearchModal
                onSelectImage={(url) => {
                  if (selectedNode.type !== "frame") {
                    transformNodeToFrame(
                      selectedNode,
                      { backgroundImage: `url(${url})`, src: undefined },
                      nodeDisp
                    );
                  } else {
                    setNodeStyle(
                      { backgroundImage: `url(${url})`, src: undefined },
                      dragState.selectedIds
                    );
                  }
                  setShowMediaSearch(false);
                }}
                onClose={() => setShowMediaSearch(false)}
              />
            )}
          </>
        )}

        {fillType === "video" && (
          <>
            <button
              onClick={() => setShowMediaSearch(true)}
              className="w-full px-3 py-2 bg-[var(--bg-default)] hover:bg-[var(--bg-hover)] rounded-md text-sm flex items-center justify-center transition-colors"
            >
              <Video className="w-4 h-4 mr-2" />
              Choose Video
            </button>

            {showMediaSearch && (
              <VideoSearchModal
                onSelectVideo={(url) => {
                  if (selectedNode.type !== "frame") {
                    transformNodeToFrame(
                      selectedNode,
                      { backgroundVideo: url, src: undefined },
                      nodeDisp
                    );
                  } else {
                    setNodeStyle(
                      { backgroundVideo: url, src: undefined },
                      dragState.selectedIds
                    );
                  }
                  setShowMediaSearch(false);
                }}
                onClose={() => setShowMediaSearch(false)}
              />
            )}
          </>
        )}

        {(fillType === "image" || fillType === "video") &&
          renderMediaControls()}
      </div>
    );
  };

  return (
    <ToolbarSection
      title={
        selectedNode.type !== "frame"
          ? selectedNode.type.slice(0, 1).toUpperCase() +
            selectedNode.type.slice(1)
          : "Fill"
      }
      className="p-4 bg-[var(--bg-surface)] rounded-lg shadow-sm"
    >
      {renderControls()}
    </ToolbarSection>
  );
};
